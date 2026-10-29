import assert from 'node:assert/strict';
import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { ViewStore } from '../src/view-store.js';
import { MAX_HTML_BYTES, MAX_STATE_BYTES, validateCreate, validateState, validateUpdate } from '../src/validation.js';

const base = () => ({ title: 'Experience curve', html: '<main>Experience</main>', summary: 'Compare rewards', initialState: { reward: 100 } });
const hasCode = (code) => (cause) => cause?.code === code;

async function fixture(t) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'web-answer-store-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return { directory, store: new ViewStore(directory) };
}

test('restores a persisted view and state from a fresh store instance', async (t) => {
  const { directory, store } = await fixture(t);
  const created = await store.create('session-1', base());
  assert.match(created.id, /^[0-9a-f-]{36}$/);
  assert.equal(created.revision, 1);
  assert.equal(created.latestRevision, 1);
  assert.equal(created.stateVersion, 0);
  assert.equal(created.stateSchemaVersion, '1');
  const saved = await store.saveState('session-1', created.id, { revision: 1, expectedStateVersion: 0, state: { reward: 90 } });
  const restored = await new ViewStore(directory).get('session-1', created.id);
  assert.deepEqual(restored, saved);
  restored.state.reward = 999;
  assert.equal((await store.get('session-1', created.id)).state.reward, 90);
  const directories = await readdir(directory);
  assert.equal(directories.length, 1);
  assert.match(directories[0], /^[0-9a-f]{64}$/);
  assert.deepEqual(await readdir(path.join(directory, directories[0])), [`${created.id}.json`]);
});

test('new revisions inherit live state and freeze earlier revisions', async (t) => {
  const { store } = await fixture(t);
  const created = await store.create('session-1', base());
  await store.saveState('session-1', created.id, { revision: 1, expectedStateVersion: 0, state: { reward: 90 } });
  const updated = await store.update('session-1', created.id, { expectedRevision: 1, html: '<main>Updated</main>', initialState: { reward: 0 } });
  assert.equal(updated.revision, 2);
  assert.equal(updated.stateVersion, 0);
  assert.deepEqual(updated.state, { reward: 90 });
  await store.saveState('session-1', created.id, { revision: 2, expectedStateVersion: 0, state: { reward: 80 } });
  const historical = await store.get('session-1', created.id, 1);
  assert.deepEqual(historical.state, { reward: 90 });
  assert.equal(historical.stateVersion, 1);
  assert.equal(historical.latestRevision, 2);
  assert.equal(historical.html, base().html);
  assert.deepEqual((await store.list('session-1', created.id)).map((item) => item.revision), [1, 2]);
  await assert.rejects(store.saveState('session-1', created.id, { revision: 1, expectedStateVersion: 1, state: {} }), hasCode('CONFLICT'));
  await assert.rejects(store.update('session-1', created.id, { expectedRevision: 1, html: '<p>Stale</p>' }), hasCode('CONFLICT'));
  await assert.rejects(store.get('session-1', created.id, 3), hasCode('NOT_FOUND'));
});

test('schema changes require explicit new initial state', async (t) => {
  const { store } = await fixture(t);
  const created = await store.create('session-1', base());
  await assert.rejects(store.update('session-1', created.id, { expectedRevision: 1, html: '<p>v2</p>', stateSchemaVersion: '2' }), hasCode('INVALID_INPUT'));
  const updated = await store.update('session-1', created.id, { expectedRevision: 1, html: '<p>v2</p>', stateSchemaVersion: '2', initialState: { multiplier: 1.2 } });
  assert.equal(updated.stateSchemaVersion, '2');
  assert.deepEqual(updated.state, { multiplier: 1.2 });
  assert.deepEqual((await store.get('session-1', created.id, 1)).state, { reward: 100 });
});

test('concurrent updates through separate instances commit exactly one new revision', async (t) => {
  const { directory, store } = await fixture(t);
  const created = await store.create('session-1', base());
  const secondStore = new ViewStore(directory);
  const results = await Promise.allSettled([
    store.update('session-1', created.id, { expectedRevision: 1, html: '<p>A</p>' }),
    secondStore.update('session-1', created.id, { expectedRevision: 1, html: '<p>B</p>' }),
  ]);
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
  assert.equal(results.find((result) => result.status === 'rejected').reason.code, 'CONFLICT');
  assert.equal((await store.get('session-1', created.id)).revision, 2);
  // A rejected operation must not poison the per-document queue.
  assert.equal((await store.update('session-1', created.id, { expectedRevision: 2, html: '<p>C</p>' })).revision, 3);
});

test('state compare-and-swap prevents concurrent pages from losing saved edits', async (t) => {
  const { store } = await fixture(t);
  const created = await store.create('session-1', base());
  const results = await Promise.allSettled([
    store.saveState('session-1', created.id, { revision: 1, expectedStateVersion: 0, state: { reward: 80 } }),
    store.saveState('session-1', created.id, { revision: 1, expectedStateVersion: 0, state: { reward: 120 } }),
  ]);
  const successful = results.find((result) => result.status === 'fulfilled').value;
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
  assert.equal(results.find((result) => result.status === 'rejected').reason.code, 'CONFLICT');
  assert.deepEqual(await store.get('session-1', created.id), successful);
  const next = await store.saveState('session-1', created.id, { revision: 1, expectedStateVersion: 1, state: { reward: 50 } });
  assert.equal(next.stateVersion, 2);
});

test('session ownership and path validation apply to reads and writes', async (t) => {
  const { store } = await fixture(t);
  const created = await store.create('owner', base());
  await assert.rejects(store.get('other', created.id), hasCode('NOT_FOUND'));
  await assert.rejects(store.list('other', created.id), hasCode('NOT_FOUND'));
  await assert.rejects(store.update('other', created.id, { expectedRevision: 1, html: '<p>Other</p>' }), hasCode('NOT_FOUND'));
  await assert.rejects(store.saveState('other', created.id, { revision: 1, expectedStateVersion: 0, state: {} }), hasCode('NOT_FOUND'));
  for (const session of ['../escape', '..', '/tmp/escape', 'a\\b', '', 'a'.repeat(257)]) {
    await assert.rejects(store.create(session, base()), hasCode('INVALID_INPUT'));
  }
  await assert.rejects(store.get('owner', '../escape'), hasCode('INVALID_INPUT'));
  await assert.rejects(store.get('owner', created.id, 0), hasCode('INVALID_INPUT'));
});

test('rejects invalid JSON state and prototype pollution without running getters', () => {
  const cyclic = {}; cyclic.self = cyclic;
  const accessor = {}; Object.defineProperty(accessor, 'value', { enumerable: true, get() { throw new Error('Getter executed'); } });
  const sparse = []; sparse.length = 1;
  const invalid = [null, [], new Date(), { value: undefined }, { value: NaN }, { value: Infinity }, { value: 1n }, { value() {} }, cyclic, accessor, { list: sparse }, JSON.parse('{"nested":{"__proto__":{"polluted":true}}}'), { constructor: {} }, { prototype: {} }, { value: 'x'.repeat(MAX_STATE_BYTES) }];
  for (const state of invalid) assert.throws(() => validateState(state), hasCode('INVALID_INPUT'));
  assert.equal({}.polluted, undefined);
  const state = { reward: 100, nested: { values: [null, true, '字', 1.5] } };
  const copy = validateState(state);
  copy.nested.values.push('different');
  assert.equal(state.nested.values.length, 4);
});

test('validates content boundaries, schema versions and required fields', () => {
  for (const changes of [
    { title: '' }, { title: 'x'.repeat(201) }, { summary: 'x'.repeat(8001) },
    { html: 'x'.repeat(MAX_HTML_BYTES + 1) }, { html: '字'.repeat(MAX_HTML_BYTES / 3 + 1) },
    { stateSchemaVersion: '' }, { stateSchemaVersion: 'x'.repeat(65) }, { stateSchemaVersion: ' 1' },
    { initialState: undefined }, { extra: true },
  ]) assert.throws(() => validateCreate({ ...base(), ...changes }), hasCode('INVALID_INPUT'));
  assert.equal(validateCreate({ ...base(), html: 'x'.repeat(MAX_HTML_BYTES) }).html.length, MAX_HTML_BYTES);
  for (const payload of [{ expectedRevision: 0, html: 'x' }, { expectedRevision: 1.5, html: 'x' }, { expectedRevision: 1 }, { expectedRevision: 1, html: 'x', stateSchemaVersion: 2 }]) {
    assert.throws(() => validateUpdate(payload), hasCode('INVALID_INPUT'));
  }
});

test('propagates storage IO failures rather than reporting a successful save', async (t) => {
  const { directory } = await fixture(t);
  const blocked = path.join(directory, 'not-a-directory');
  await writeFile(blocked, 'occupied');
  await assert.rejects(new ViewStore(blocked).create('session-1', base()), (cause) => ['ENOTDIR', 'EEXIST'].includes(cause.code));
  // A corrupt record is diagnosed explicitly and is never overwritten by update.
  const store = new ViewStore(path.join(directory, 'valid'));
  const created = await store.create('session-1', base());
  await writeFile(store.file('session-1', created.id), '{broken', 'utf8');
  await assert.rejects(store.get('session-1', created.id), hasCode('STORAGE_CORRUPT'));
  await assert.rejects(store.update('session-1', created.id, { expectedRevision: 1, html: '<p>New</p>' }), hasCode('STORAGE_CORRUPT'));
});
