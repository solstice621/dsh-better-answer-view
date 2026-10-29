import { createHash, randomUUID } from 'node:crypto';
import { mkdir, open, readFile, rename, unlink } from 'node:fs/promises';
import path from 'node:path';
import { inputError, validateCreate, validateInteger, validateStateWrite, validateUpdate } from './validation.js';

// Shared across instances in this process. The host must be a single writer process.
const locks = new Map();

function error(code, message) {
  return Object.assign(new Error(message), { code });
}

async function serialized(key, operation) {
  const prior = locks.get(key) ?? Promise.resolve();
  const next = prior.catch(() => {}).then(operation);
  locks.set(key, next);
  try {
    return await next;
  } finally {
    if (locks.get(key) === next) locks.delete(key);
  }
}

function validateSession(sessionId) {
  if (typeof sessionId !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,255}$/u.test(sessionId) || sessionId.includes('..')) {
    throw inputError('sessionId must be 1–256 letters, digits, dots, underscores, colons or hyphens and must not contain ".."');
  }
  return sessionId;
}

function validateId(id) {
  if (typeof id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u.test(id)) {
    throw inputError('id must be a host-generated UUID');
  }
  return id;
}

function snapshot(document, revision = document.latestRevision) {
  const value = document.revisions[revision - 1];
  if (!value) throw error('NOT_FOUND', 'View revision was not found');
  return structuredClone({ ...value, latestRevision: document.latestRevision });
}

async function readDocument(filename, sessionId, id) {
  let text;
  try {
    text = await readFile(filename, 'utf8');
  } catch (cause) {
    if (cause.code === 'ENOENT') throw error('NOT_FOUND', 'View was not found in this session');
    throw cause;
  }
  let document;
  try {
    document = JSON.parse(text);
  } catch (cause) {
    throw Object.assign(error('STORAGE_CORRUPT', 'Stored view is not valid JSON'), { cause });
  }
  if (document?.sessionId !== sessionId || document?.id !== id) {
    throw error('NOT_FOUND', 'View was not found in this session');
  }
  if (document.format !== 1 || !Number.isSafeInteger(document.latestRevision) || document.latestRevision < 1 ||
      !Array.isArray(document.revisions) || document.revisions.length !== document.latestRevision ||
      document.revisions.some((item, index) => !item || item.id !== id || item.sessionId !== sessionId || item.revision !== index + 1)) {
    throw error('STORAGE_CORRUPT', 'Stored view has an invalid revision history');
  }
  return document;
}

async function atomicWrite(filename, document) {
  await mkdir(path.dirname(filename), { recursive: true, mode: 0o700 });
  const temporary = `${filename}.${randomUUID()}.tmp`;
  let handle;
  try {
    handle = await open(temporary, 'wx', 0o600);
    await handle.writeFile(`${JSON.stringify(document)}\n`, 'utf8');
    await handle.sync();
    await handle.close();
    handle = undefined;
    // One atomic replacement commits both the revision history and current state.
    await rename(temporary, filename);
  } catch (cause) {
    if (handle) {
      try { await handle.close(); } catch (closeError) { cause.closeError = closeError; }
    }
    try { await unlink(temporary); } catch (cleanupError) {
      if (cleanupError.code !== 'ENOENT') cause.cleanupError = cleanupError;
    }
    throw cause;
  }
}

/** Durable, session-scoped storage for webpage answers. All methods return promises. */
export class ViewStore {
  constructor(rootDir) {
    if (typeof rootDir !== 'string' || !rootDir.trim()) throw inputError('rootDir must be a nonempty path');
    this.rootDir = path.resolve(rootDir);
  }

  file(sessionId, id) {
    validateSession(sessionId);
    validateId(id);
    const sessionHash = createHash('sha256').update(sessionId, 'utf8').digest('hex');
    return path.join(this.rootDir, sessionHash, `${id}.json`);
  }

  async create(sessionId, payload) {
    const values = validateCreate(payload);
    const id = randomUUID();
    const filename = this.file(sessionId, id);
    return serialized(filename, async () => {
      const timestamp = new Date().toISOString();
      const first = {
        id, sessionId, revision: 1,
        title: values.title, html: values.html, summary: values.summary,
        stateSchemaVersion: values.stateSchemaVersion,
        state: values.initialState, stateVersion: 0,
        createdAt: timestamp, updatedAt: timestamp,
      };
      const document = { format: 1, id, sessionId, latestRevision: 1, revisions: [first] };
      await atomicWrite(filename, document);
      return snapshot(document);
    });
  }

  async update(sessionId, id, payload) {
    const values = validateUpdate(payload);
    const filename = this.file(sessionId, id);
    return serialized(filename, async () => {
      const document = await readDocument(filename, sessionId, id);
      if (values.expectedRevision !== document.latestRevision) {
        throw error('CONFLICT', 'View changed; reload the latest revision before updating');
      }
      const current = snapshot(document);
      const nextSchema = values.stateSchemaVersion ?? current.stateSchemaVersion;
      const changedSchema = nextSchema !== current.stateSchemaVersion;
      if (changedSchema && !Object.hasOwn(values, 'initialState')) {
        throw inputError('A schema change requires initialState');
      }
      const timestamp = new Date().toISOString();
      const revision = document.latestRevision + 1;
      validateInteger(revision, 'revision', 1);
      const next = {
        id, sessionId, revision,
        title: values.title ?? current.title,
        html: values.html,
        summary: values.summary ?? current.summary,
        stateSchemaVersion: nextSchema,
        state: changedSchema ? values.initialState : current.state,
        stateVersion: 0,
        createdAt: timestamp, updatedAt: timestamp,
      };
      document.latestRevision = revision;
      document.revisions.push(next);
      await atomicWrite(filename, document);
      return snapshot(document);
    });
  }

  async get(sessionId, id, revision) {
    const filename = this.file(sessionId, id);
    if (revision !== undefined) validateInteger(revision, 'revision', 1);
    return serialized(filename, async () => snapshot(await readDocument(filename, sessionId, id), revision));
  }

  async list(sessionId, id) {
    const filename = this.file(sessionId, id);
    return serialized(filename, async () => {
      const document = await readDocument(filename, sessionId, id);
      return document.revisions.map(({ revision, title, createdAt }) => ({ revision, title, createdAt }));
    });
  }

  async saveState(sessionId, id, payload) {
    const values = validateStateWrite(payload);
    const filename = this.file(sessionId, id);
    return serialized(filename, async () => {
      const document = await readDocument(filename, sessionId, id);
      const current = document.revisions[document.latestRevision - 1];
      if (values.revision !== document.latestRevision) {
        throw error('CONFLICT', 'Only the latest revision can save state');
      }
      if (values.expectedStateVersion !== current.stateVersion) {
        throw error('CONFLICT', 'State changed; reload before saving');
      }
      validateInteger(current.stateVersion + 1, 'stateVersion', 0);
      current.state = values.state;
      current.stateVersion += 1;
      current.updatedAt = new Date().toISOString();
      await atomicWrite(filename, document);
      return snapshot(document);
    });
  }
}
