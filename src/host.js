import { homedir } from 'node:os';
import { isAbsolute, join, resolve } from 'node:path';
import { ViewStore } from './view-store.js';
import { validateCreate, validateUpdate, MAX_HTML_BYTES } from './validation.js';

export const name = 'web-answer';
export const inject = ['tools', 'connection'];
export const API_PATH = '/api/web-answer';
export const MAX_REQUEST_BYTES = 128 * 1024;

const RECEIPT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    kind: { type: 'string', const: 'web-answer' },
    id: { type: 'string' },
    revision: { type: 'integer' },
    title: { type: 'string' },
    summary: { type: 'string' },
    sessionId: { type: 'string' },
    embed: { type: 'string', description: 'Paste this exact marker into the final reply beside the paragraph about this block. Other topics use their own blocks and returned markers.' },
  },
  required: ['kind', 'id', 'revision', 'title', 'summary', 'sessionId', 'embed'],
};

const SNAPSHOT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    id: { type: 'string' },
    sessionId: { type: 'string' },
    revision: { type: 'integer' },
    latestRevision: { type: 'integer' },
    title: { type: 'string' },
    html: { type: 'string' },
    summary: { type: 'string' },
    stateSchemaVersion: { type: 'string' },
    state: { type: 'object' },
    stateVersion: { type: 'integer' },
    createdAt: { type: 'string' },
    updatedAt: { type: 'string' },
  },
  required: ['id', 'sessionId', 'revision', 'latestRevision', 'title', 'html', 'summary', 'stateSchemaVersion', 'state', 'stateVersion', 'createdAt', 'updatedAt'],
};

const INLINE_EMBED_GUIDANCE = 'After render_answer or update_answer succeeds, include the exact returned embed marker in your final reply at the position where that block belongs. Paste it verbatim, unquoted and unfenced, on its own lines between paragraphs with a blank line before and after. Never wrap the marker in a Markdown code block. Use each block once in the reply; any surrounding prose should connect it to the answer without repeating its content.';

export const DEFAULT_PRESENTATION_POLICY = [
  'Choose the clearest presentation automatically. Do not wait for the user to request a webpage, chart, or card, and do not ask permission to use render_answer.',
  'Use render_answer when the visual or interactive structure does useful work: revealing a numerical trend, comparing several meaningful dimensions, showing a spatial or causal relationship, making a sequence or schedule easier to follow, or letting the user explore a calculation. A long answer, several headings, or a list of facts alone is not a reason to make cards. If a short paragraph or ordinary list communicates equally well, use ordinary chat.',
  'Keep simple facts, greetings, brief confirmations, straightforward prose explanations, translations, casual conversation, and code-focused answers in ordinary chat unless a visual would add useful understanding. Do not decorate these answers with a card, a metric tile, or an unnecessary table. Always respect an explicit user preference for plain text, Markdown, code, or another format.',
  'Compose focused inline answer blocks in the current conversation: a chart, comparison table, diagram, cards, or a compact explanation. The unit of rendering is one visual idea, not the whole answer. Only render the parts that benefit from this treatment; surrounding prose can introduce them, connect them, or add a distinct interpretation.',
  'When an answer has two or more distinct topics that benefit from visuals, call render_answer separately for each topic, usually producing two to four small independent blocks with different ids. Do not combine a multi-topic answer into one large HTML document, dashboard, tabbed page, or stack of internal cards. Multiple cards inside one HTML document still count as one block and do not achieve this interleaved layout.',
  'Keep tightly coupled elements together, such as one chart and its legend or a short supporting table. A single visual idea needs only one block; simple answers need none. Do not split a cohesive visual or invent extra content merely to reach a block count. Use compact natural-height content that expands into the conversation, without full-screen sizing, oversized padding, fixed-height panels, scrolling containers, or wide minimum widths. Long content should remain readable through the conversation scroll; narrow layouts should wrap or stack instead of creating an inner scrollbar.',
  'Place each returned embed marker beside the relevant prose, preserving the reasoning order: brief setup, first block, useful transition or new interpretation, second block, and any remaining explanation. Do not collect all blocks at the end or place adjacent blocks without context when they address different topics. Connective prose must add meaning rather than repeat a block or announce that you made a webpage.',
  'These blocks are embedded parts of the reply. Do not build a separate website, open a browser tab, or add site navigation, hero sections, repeated page titles, or decorative application chrome. Put sources, definitions, assumptions, and limitations beside the claims or figures they support.',
  INLINE_EMBED_GUIDANCE,
  'Present each piece of information only once. After a successful render_answer or update_answer, do not repeat its numbers, tables, bullet points, conclusions, or source list in Markdown chat. The final chat text should contain only useful connective prose or new information; omit a redundant textual recap. If rendering fails, give the information in ordinary chat instead.',
].join(' ');

export const INLINE_STYLE_GUIDANCE = [
  'The surface supplies a readable, responsive light/dark design system. Prefer small semantic HTML fragments using these built-in styles; do not redesign every block with a new font, palette, gradients, shadows, or decorative icons. Use var(--answer-fg), --answer-muted, --answer-accent, --answer-soft and --answer-border for custom SVG or CSS so it follows the conversation theme.',
  'Start with one short h2 or h3 only when it helps identify the visual. The host already supplies breathing room: avoid body/main padding or stacked outer wrappers. An optional .answer-block is one subtle bordered surface; never wrap every section in nested .card elements. Keep labels brief, units visible, and sources or assumptions in .answer-source or .answer-note near the relevant evidence.',
  'Use p.answer-note for a padded explanatory callout, .answer-inline-note for a short inline annotation, and .answer-cell-detail for secondary text inside a table cell. Put a price and its percentage on separate readable lines, for example <strong>$241</strong><br><small class="answer-cell-detail">−24%</small>. Use div/section/article for full .card, .answer-block, .answer-metric and .answer-decision surfaces. Keep default natural height, border-box sizing and normal line spacing; avoid fixed/minimum widths, negative margins, zero line-height or transforms that move content over neighboring text. Hide disclosures with hidden or aria-controls/aria-expanded. Reserve data-answer-scroll for actual interactive scrolling controls, not ordinary reading content.',
  'Available classes: .grid and .row for responsive grouping; .answer-metric-grid with .answer-metric, .answer-metric-label, .answer-metric-value, .answer-metric-unit and .answer-metric-detail for genuinely important related values; .answer-bar-list with .answer-bar-row containing .answer-bar-label, .answer-bar-value and .answer-bar-track > .answer-bar-fill for compact comparisons (set --value to the computed percentage of one shared, stated scale); .answer-timeline with .answer-timeline-item, .answer-timeline-date and a short heading for a useful sequence; .answer-decision and .answer-evidence for a supported choice and its reasons; .answer-legend, .answer-legend-item and .answer-swatch for chart keys; .answer-control with .answer-control-heading, a label and output for a slider or other useful input. Plain semantic tables, buttons and details are styled too. These are optional building blocks, not a checklist to fill.',
  'Match the visual to the question. Prefer a concise comparison or labeled chart over a wall of tables; keep tables narrow and choose only meaningful columns, using stacked rows when needed at 320px. Make SVG charts responsive with a viewBox, readable labels and an accessible title or description. Use truthful scales, units, direct values and uncertainty; do not invent scores, percentages, trends or progress bars to make a card look analytical. Interactive controls must change a meaningful result and remain keyboard usable. Avoid duplicate totals, unnecessary status badges and empty decorative space.',
].join(' ');

const BRIDGE_GUIDANCE = [
  'Provide a self-contained HTML fragment for one focused block; an entire HTML document is also accepted but unnecessary. Use the built-in styles and only the inline CSS or JavaScript needed for this block.',
  INLINE_STYLE_GUIDANCE,
  'Use inline classic scripts and initialize the inserted DOM immediately; DOMContentLoaded and window.load have already fired, so do not wait for them.',
  'External network requests, scripts, frames, navigation, and browser storage are unavailable.',
  'Use window.answer.getState() to read restored JSON state; await window.answer.setState(state) to save explicit form values or selections.',
  'Call window.answer.ask(text) only from a deliberate user button click to prepare a follow-up in this same conversation; the current page identity and saved state are included.',
  'Use local JavaScript for sliders and charts. Never claim demo computations or invented data are real observations.',
  'Include accessible readable content inside the block and a short summary for the fallback display; the summary is not a second full answer.',
].join(' ');

const PROMPT = `${DEFAULT_PRESENTATION_POLICY} Before revising an existing web answer, first use get_answer with its id and no revision to retrieve the current HTML, saved state and latestRevision, then use update_answer with that id and latestRevision as expectedRevision. Use get_answer again after a revision conflict or when prior page content is no longer in context. It is read-only and does not create a new displayed answer. Retain registered state unless a deliberate stateSchemaVersion change resets its meaning. ${BRIDGE_GUIDANCE}`;

function invalid(message, status = 400, code = 'INVALID_INPUT') {
  return Object.assign(new Error(message), { code, status });
}

function record(value, label) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw invalid(`${label} must be an object.`);
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) throw invalid(`${label} must be a JSON object.`);
  return value;
}

function knownKeys(value, allowed) {
  for (const key of Object.keys(value)) if (!allowed.includes(key)) throw invalid(`Unknown field: ${key}.`);
}

function identity(value, label) {
  if (typeof value !== 'string' || value.length > 256 || !/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(value) || value.includes('..')) {
    throw invalid(`${label} is invalid.`);
  }
  return value;
}

function integer(value, label, minimum = 1) {
  if (!Number.isSafeInteger(value) || value < minimum) throw invalid(`${label} must be an integer of at least ${minimum}.`);
  return value;
}

function toolInput(value, update) {
  const args = record(value, 'Arguments');
  knownKeys(args, ['title', 'html', 'summary', 'initialState', 'stateSchemaVersion', ...(update ? ['id', 'expectedRevision'] : [])]);
  if (update) {
    identity(args.id, 'id');
    const { id, ...change } = args;
    return { id, ...validateUpdate(change) };
  }
  return validateCreate(args);
}

function sessionOf(exec) {
  if (!exec?.agent?.session) throw invalid('This tool requires an agent conversation.');
  return identity(exec.agent.session.id, 'sessionId');
}

export function receipt(snapshot) {
  return {
    kind: 'web-answer',
    id: snapshot.id,
    revision: snapshot.revision,
    title: snapshot.title,
    summary: snapshot.summary,
    sessionId: snapshot.sessionId,
    embed: `:::web-answer ${snapshot.id}\n:::`,
  };
}

/** The raw supported DSH JSON Schema subset deliberately avoids maxLength/minimum. */
export function createToolDefinitions(store) {
  const properties = {
    title: { type: 'string', description: 'A short descriptive title for this inline answer block.' },
    html: { type: 'string', description: `Self-contained HTML fragment for one focused visual idea, at most ${MAX_HTML_BYTES} UTF-8 bytes. Built-in responsive classes and theme colors are available; add inline styles or classic scripts only as needed. A complete document is accepted but unnecessary. For another visually useful topic, call render_answer again and place its own marker beside the relevant prose. Do not put the whole multi-topic answer in this block. Content must grow naturally and fit 320px: no fixed-height/max-height scrolling panels, viewport-height layout, wide minimum widths, website navigation or decorative page chrome.` },
    summary: { type: 'string', description: 'Short readable fallback for this block, including material limitations or fictional data. Do not write a duplicate full answer.' },
    initialState: { type: 'object', description: 'JSON object for the first render, at most 16 KiB. This does not overwrite saved state on compatible updates.' },
    stateSchemaVersion: { type: 'string', description: 'State contract version, defaults to "1". Change only when state becomes incompatible.' },
  };
  const output = {
    schema: RECEIPT_SCHEMA,
    render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }],
    presentationMeta: (_args, value) => value,
  };
  return [
    {
      name: 'render_answer',
      description: `Create an inline interactive answer block in the current conversation. ${DEFAULT_PRESENTATION_POLICY} Keep the returned id; before subsequent updates call get_answer to retrieve the current HTML, state and latestRevision. ${BRIDGE_GUIDANCE}`,
      parameters: { type: 'object', additionalProperties: false, properties, required: ['title', 'html', 'summary'] },
      output,
      async execute(value, exec) {
        const args = toolInput(value, false);
        const sessionId = sessionOf(exec);
        exec.signal?.throwIfAborted();
        return receipt(await store.create(sessionId, args));
      },
    },
    {
      name: 'update_answer',
      description: `Replace an existing inline answer block in this same conversation. First call get_answer with its id and no revision to read the current HTML and saved state. Supply that id and its returned latestRevision as expectedRevision; a stale revision is rejected and requires another get_answer. Compatible registered state is preserved. ${INLINE_EMBED_GUIDANCE} Do not repeat the updated block's content in Markdown chat. ${BRIDGE_GUIDANCE}`,
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: {
          ...properties,
          id: { type: 'string', description: 'The id returned by render_answer.' },
          expectedRevision: { type: 'integer', description: 'The latest known revision; prevents overwriting a newer page.' },
        },
        required: ['id', 'expectedRevision', 'html'],
      },
      output,
      async execute(value, exec) {
        const args = toolInput(value, true);
        const sessionId = sessionOf(exec);
        exec.signal?.throwIfAborted();
        const { id, ...change } = args;
        return receipt(await store.update(sessionId, id, change));
      },
    },
    {
      name: 'get_answer',
      description: 'Read an existing webpage answer in this same conversation without creating a displayed answer or changing it. Omit revision to retrieve current HTML, saved state, stateSchemaVersion and latestRevision before update_answer, including after conversation context was compacted or an update conflicted. Supply revision only to inspect a historical snapshot; historical state is read-only.',
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: {
          id: { type: 'string', description: 'The id returned by render_answer or referenced by the current webpage.' },
          revision: { type: 'integer', description: 'Optional positive revision to inspect. Omit to get the latest page and saved state.' },
        },
        required: ['id'],
      },
      output: {
        schema: SNAPSHOT_SCHEMA,
        render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }],
      },
      async execute(value, exec) {
        const args = record(value, 'Arguments');
        knownKeys(args, ['id', 'revision']);
        identity(args.id, 'id');
        if (Object.hasOwn(args, 'revision')) integer(args.revision, 'revision');
        const sessionId = sessionOf(exec);
        exec.signal?.throwIfAborted();
        return store.get(sessionId, args.id, args.revision);
      },
    },
  ];
}

function json(value, status = 200) {
  return Response.json(value, {
    status,
    headers: { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' },
  });
}

function errorResponse(error) {
  const publicCodes = {
    INVALID_INPUT: 400,
    NOT_FOUND: 404,
    CONFLICT: 409,
    PAYLOAD_TOO_LARGE: 413,
    UNSUPPORTED_MEDIA_TYPE: 415,
    METHOD_NOT_ALLOWED: 405,
  };
  const status = publicCodes[error?.code];
  if (status) return json({ error: { code: error.code, message: error.message } }, status);
  return json({ error: { code: 'INTERNAL_ERROR', message: 'The web answer could not be loaded or saved.' } }, 500);
}

async function readJson(request) {
  const type = request.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase();
  if (type !== 'application/json') throw invalid('Use Content-Type: application/json.', 415, 'UNSUPPORTED_MEDIA_TYPE');
  const size = request.headers.get('content-length');
  if (size !== null && (!/^\d+$/.test(size) || Number(size) > MAX_REQUEST_BYTES)) {
    throw invalid('The request body is too large.', 413, 'PAYLOAD_TOO_LARGE');
  }
  if (!request.body) throw invalid('A JSON request body is required.');
  const reader = request.body.getReader();
  let length = 0;
  const chunks = [];
  try {
    for (;;) {
      request.signal.throwIfAborted();
      const { value, done } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > MAX_REQUEST_BYTES) {
        await reader.cancel();
        throw invalid('The request body is too large.', 413, 'PAYLOAD_TOO_LARGE');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  try {
    const bytes = Buffer.concat(chunks, length);
    return record(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)), 'Request');
  } catch (error) {
    if (error?.code === 'INVALID_INPUT') throw error;
    throw invalid('The request body must contain valid JSON.');
  }
}

/** Register behind DSH Connection's existing Host/Origin and browser-auth fence. */
export function createApiHandler(store) {
  return async function handle(request) {
    try {
      request.signal.throwIfAborted();
      const query = new URL(request.url).searchParams;
      if (request.method === 'GET') {
        for (const key of query.keys()) {
          if (!['action', 'sessionId', 'id', 'revision'].includes(key) || query.getAll(key).length !== 1) throw invalid('Invalid query parameters.');
        }
        const action = query.get('action') ?? 'get';
        const sessionId = identity(query.get('sessionId'), 'sessionId');
        const id = identity(query.get('id'), 'id');
        const rawRevision = query.get('revision');
        let revision;
        if (rawRevision !== null) {
          if (!/^[1-9]\d*$/.test(rawRevision)) throw invalid('revision must be a positive integer.');
          revision = integer(Number(rawRevision), 'revision');
        }
        if (action === 'get') return json(await store.get(sessionId, id, revision));
        if (action === 'list' && revision === undefined) return json(await store.list(sessionId, id));
        throw invalid('action must be get or list; list does not accept revision.');
      }
      if (request.method === 'POST') {
        if (query.size !== 0) throw invalid('POST parameters belong in the JSON body.');
        const body = await readJson(request);
        knownKeys(body, ['action', 'sessionId', 'id', 'revision', 'expectedStateVersion', 'state']);
        if (body.action !== 'state') throw invalid('POST action must be state.');
        identity(body.sessionId, 'sessionId');
        identity(body.id, 'id');
        integer(body.revision, 'revision');
        integer(body.expectedStateVersion, 'expectedStateVersion', 0);
        if (!Object.hasOwn(body, 'state')) throw invalid('state is required.');
        request.signal.throwIfAborted();
        return json(await store.saveState(body.sessionId, body.id, {
          revision: body.revision,
          expectedStateVersion: body.expectedStateVersion,
          state: body.state,
        }));
      }
      throw invalid('Only GET and POST are supported.', 405, 'METHOD_NOT_ALLOWED');
    } catch (error) {
      request.signal.throwIfAborted();
      return errorResponse(error);
    }
  };
}

/** Resolve configuration without creating directories or reading user configuration. */
export function storageDirectory(config = {}, environment = process.env) {
  record(config, 'Plugin config');
  knownKeys(config, ['storageDir']);
  if (config.storageDir !== undefined) {
    if (typeof config.storageDir !== 'string' || !isAbsolute(config.storageDir)) throw invalid('storageDir must be an absolute path.');
    return resolve(config.storageDir);
  }
  const dshHome = typeof environment.DSH_HOME === 'string' && environment.DSH_HOME.trim() ? environment.DSH_HOME : join(homedir(), '.dsh');
  const expandedHome = dshHome === '~' ? homedir() : dshHome.startsWith('~/') ? join(homedir(), dshHome.slice(2)) : dshHome;
  return join(resolve(expandedHome), 'web-answer');
}

export function apply(ctx, config = {}) {
  const store = new ViewStore(storageDirectory(config));
  for (const tool of createToolDefinitions(store)) ctx.tools.register(tool);
  ctx.connection.fetch.register({ path: API_PATH, methods: ['GET', 'POST'], requestBody: 'buffered', fetch: createApiHandler(store) });
  const systemPrompt = typeof ctx.get === 'function' ? ctx.get('systemPrompt') : ctx.systemPrompt;
  if (systemPrompt?.section) systemPrompt.section({ name: 'web-answer:format', order: 10000, text: PROMPT });
}
