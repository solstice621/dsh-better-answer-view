import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { apply, API_PATH, createApiHandler, createToolDefinitions, DEFAULT_PRESENTATION_POLICY, INLINE_STYLE_GUIDANCE, MAX_REQUEST_BYTES, storageDirectory } from '../src/host.js';
import { ViewStore } from '../src/view-store.js';

async function fixture(t) {
  const temporary = await mkdtemp(join(tmpdir(), 'web-answer-host-'));
  t.after(() => rm(temporary, { recursive: true, force: true }));
  const root = join(temporary, 'data');
  const store = new ViewStore(root);
  const [render, update, get] = createToolDefinitions(store);
  const exec = { agent: { session: { id: 'session-a' } }, signal: new AbortController().signal };
  const args = { title: 'Reward curve', html: '<!doctype html><h1>Original</h1>', summary: 'Illustrative reward curve.', initialState: { reward: 100 } };
  const created = await render.execute(args, exec);
  const handle = createApiHandler(store);
  const url = (query = {}) => `http://localhost${API_PATH}?${new URLSearchParams({ sessionId: 'session-a', id: created.id, ...query })}`;
  const post = (body, headers = { 'content-type': 'application/json' }) => new Request(`http://localhost${API_PATH}`, { method: 'POST', headers, body: JSON.stringify(body) });
  return { root, store, render, update, get, exec, args, created, handle, url, post };
}

test('registration is side-effect-free until an answer is created', async (t) => {
  const temporary = await mkdtemp(join(tmpdir(), 'web-answer-registration-'));
  t.after(() => rm(temporary, { recursive: true, force: true }));
  const root = join(temporary, 'new-data');
  const tools = [], routes = [], sections = [];
  apply({
    tools: { register: (tool) => tools.push(tool) },
    connection: { fetch: { register: (route) => routes.push(route) } },
    get: () => ({ section: (section) => sections.push(section) }),
  }, { storageDir: root });
  assert.deepEqual(tools.map((tool) => tool.name), ['render_answer', 'update_answer', 'get_answer']);
  assert.equal(routes[0].path, API_PATH);
  assert.deepEqual(routes[0].methods, ['GET', 'POST']);
  assert.equal(routes[0].requestBody, 'buffered');
  assert.equal(sections[0].name, 'web-answer:format');
  assert.match(sections[0].text, /first use get_answer/);
  await assert.rejects(access(root), { code: 'ENOENT' });
});

test('registered presentation policy and shared visual guidance reach prompt and both writing tools', () => {
  const tools = [], sections = [];
  apply({
    tools: { register: (tool) => tools.push(tool) },
    connection: { fetch: { register() {} } },
    get: () => ({ section: (section) => sections.push(section) }),
  }, { storageDir: '/tmp/web-answer-presentation-registration' });
  const prompt = sections[0].text;
  const render = tools.find((tool) => tool.name === 'render_answer');
  // The same policy must reach both prompt assembly and tool-only hosts.
  assert.ok(prompt.includes(DEFAULT_PRESENTATION_POLICY));
  assert.ok(render.description.includes(DEFAULT_PRESENTATION_POLICY));
  assert.ok(prompt.includes(INLINE_STYLE_GUIDANCE));
  for (const tool of tools.filter(({ name }) => name !== 'get_answer')) {
    assert.ok(tool.description.includes(INLINE_STYLE_GUIDANCE));
    assert.match(tool.parameters.properties.html.description, /HTML fragment/);
  }
  // Behavioral choices and visual quality are checked with actual model/UI cases;
  // these assertions only protect the registration paths, not exact prompt prose.
  assert.equal(tools.find(({ name }) => name === 'get_answer').description.includes(INLINE_STYLE_GUIDANCE), false);
  assert.match(render.parameters.properties.summary.description, /fallback[\s\S]*duplicate full answer/);
});

test('automatic presentation guidance remains available without optional systemPrompt service', () => {
  const tools = [];
  assert.doesNotThrow(() => apply({
    tools: { register: (tool) => tools.push(tool) },
    connection: { fetch: { register() {} } },
    get: () => undefined,
  }, { storageDir: '/tmp/web-answer-tool-only-registration' }));
  assert.ok(tools.find((tool) => tool.name === 'render_answer').description.includes(DEFAULT_PRESENTATION_POLICY));
  assert.ok(tools.find((tool) => tool.name === 'render_answer').description.includes(INLINE_STYLE_GUIDANCE));
  assert.match(tools.find((tool) => tool.name === 'update_answer').description, /Do not repeat[\s\S]*Markdown chat/);
});

test('tool returns a small receipt and the API restores the persisted document', async (t) => {
  const f = await fixture(t);
  assert.equal(f.created.kind, 'web-answer');
  assert.equal(f.created.sessionId, 'session-a');
  assert.equal(f.created.revision, 1);
  assert.equal(f.created.embed, `:::web-answer ${f.created.id}\n:::`);
  assert.equal(Object.hasOwn(f.created, 'html'), false);
  const text = f.render.output.render(f.args, f.created)[0].text;
  assert.deepEqual(JSON.parse(text), f.created);
  assert.deepEqual(f.render.output.presentationMeta(f.args, f.created), f.created);
  const reloadedHandler = createApiHandler(new ViewStore(f.root));
  const response = await reloadedHandler(new Request(f.url()));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const snapshot = await response.json();
  assert.equal(snapshot.html, f.args.html);
  assert.deepEqual(snapshot.state, { reward: 100 });
  assert.equal((await f.handle(new Request(f.url({ sessionId: 'session-b' })))).status, 404);
});

test('render and update expose the same embeddable identity while reads stay undisplayed', async (t) => {
  const f = await fixture(t);
  for (const tool of [f.render, f.update]) {
    assert.equal(tool.output.schema.properties.embed.type, 'string');
    assert.ok(tool.output.schema.required.includes('embed'));
    assert.match(tool.description, /returned embed marker[\s\S]*final reply[\s\S]*unquoted and unfenced/);
  }
  const updated = await f.update.execute({ id: f.created.id, expectedRevision: 1, html: '<h1>Revised inline block</h1>' }, f.exec);
  assert.equal(updated.revision, 2);
  assert.equal(updated.embed, f.created.embed);
  assert.equal(JSON.parse(f.update.output.render({}, updated)[0].text).embed, updated.embed);
  const snapshot = await f.get.execute({ id: updated.id }, f.exec);
  assert.equal(snapshot.latestRevision, 2);
  assert.equal(Object.hasOwn(snapshot, 'embed'), false);
  assert.equal(Object.hasOwn(f.get.output.schema.properties, 'embed'), false);
});

test('state saves, version conflicts, page updates and history use one durable store', async (t) => {
  const f = await fixture(t);
  const stateWrite = { action: 'state', sessionId: 'session-a', id: f.created.id, revision: 1, expectedStateVersion: 0, state: { reward: 150 } };
  const saved = await f.handle(f.post(stateWrite));
  assert.equal(saved.status, 200);
  assert.equal((await saved.json()).stateVersion, 1);
  assert.equal((await f.handle(f.post(stateWrite))).status, 409);
  const updated = await f.update.execute({ id: f.created.id, expectedRevision: 1, html: '<h1>Updated</h1>' }, f.exec);
  assert.equal(updated.revision, 2);
  assert.deepEqual((await (await f.handle(new Request(f.url()))).json()).state, { reward: 150 });
  assert.equal((await (await f.handle(new Request(f.url({ revision: '1' })))).json()).html, f.args.html);
  const history = await (await f.handle(new Request(f.url({ action: 'list' })))).json();
  assert.deepEqual(history.map((entry) => entry.revision), [1, 2]);
  await assert.rejects(f.update.execute({ id: f.created.id, expectedRevision: 1, html: '<h1>Stale</h1>' }, f.exec), { code: 'CONFLICT' });
  await assert.rejects(f.update.execute({ id: f.created.id, expectedRevision: 2, html: '<h1>Wrong session</h1>' }, { ...f.exec, agent: { session: { id: 'session-b' } } }), { code: 'NOT_FOUND' });
});

test('get_answer reads the latest HTML and state without creating another UI node or modifying storage', async (t) => {
  const f = await fixture(t);
  await f.store.saveState('session-a', f.created.id, { revision: 1, expectedStateVersion: 0, state: { reward: 150 } });
  const before = await f.store.get('session-a', f.created.id);
  const snapshot = await f.get.execute({ id: f.created.id }, f.exec);
  assert.deepEqual(snapshot, before);
  assert.equal(snapshot.html, f.args.html);
  assert.equal(snapshot.latestRevision, 1);
  assert.equal(snapshot.stateVersion, 1);
  assert.equal(snapshot.stateSchemaVersion, '1');
  assert.deepEqual(snapshot.state, { reward: 150 });
  assert.equal(Object.hasOwn(snapshot, 'kind'), false);
  assert.equal(Object.hasOwn(f.get.output, 'presentationMeta'), false);
  assert.deepEqual(JSON.parse(f.get.output.render({ id: f.created.id }, snapshot)[0].text), snapshot);
  assert.deepEqual(await f.store.get('session-a', f.created.id), before);
  const updated = await f.update.execute({ id: snapshot.id, expectedRevision: snapshot.latestRevision, html: '<h1>From restored context</h1>' }, f.exec);
  assert.equal(updated.revision, 2);
});

test('get_answer can inspect frozen history while reporting the current revision', async (t) => {
  const f = await fixture(t);
  await f.store.saveState('session-a', f.created.id, { revision: 1, expectedStateVersion: 0, state: { reward: 150 } });
  await f.update.execute({ id: f.created.id, expectedRevision: 1, html: '<h1>Version 2</h1>' }, f.exec);
  await f.store.saveState('session-a', f.created.id, { revision: 2, expectedStateVersion: 0, state: { reward: 200 } });
  const historical = await f.get.execute({ id: f.created.id, revision: 1 }, f.exec);
  assert.equal(historical.revision, 1);
  assert.equal(historical.latestRevision, 2);
  assert.equal(historical.html, f.args.html);
  assert.deepEqual(historical.state, { reward: 150 });
  const current = await f.get.execute({ id: f.created.id }, f.exec);
  assert.equal(current.revision, 2);
  assert.equal(current.html, '<h1>Version 2</h1>');
  assert.deepEqual(current.state, { reward: 200 });
  await assert.rejects(f.get.execute({ id: f.created.id, revision: 3 }, f.exec), { code: 'NOT_FOUND' });
});

test('get_answer binds session ownership to execution and rejects invalid arguments', async (t) => {
  const f = await fixture(t);
  await assert.rejects(f.get.execute({ id: f.created.id }, { ...f.exec, agent: { session: { id: 'session-b' } } }), { code: 'NOT_FOUND' });
  await assert.rejects(f.get.execute({ id: f.created.id, sessionId: 'session-a' }, { ...f.exec, agent: { session: { id: 'session-b' } } }), { code: 'INVALID_INPUT' });
  await assert.rejects(f.get.execute({ id: f.created.id }, { signal: f.exec.signal }), { code: 'INVALID_INPUT' });
  for (const args of [{}, { id: '../escape' }, { id: f.created.id, revision: 0 }, { id: f.created.id, revision: 1.5 }, { id: f.created.id, revision: '1' }, { id: f.created.id, revision: undefined }, { id: f.created.id, extra: true }]) {
    await assert.rejects(f.get.execute(args, f.exec), { code: 'INVALID_INPUT' });
  }
  await assert.rejects(f.get.execute({ id: f.created.id }, { ...f.exec, signal: AbortSignal.abort() }), { name: 'AbortError' });
  assert.deepEqual(Object.keys(f.get.parameters.properties), ['id', 'revision']);
  assert.deepEqual(f.get.parameters.required, ['id']);
  assert.match(f.update.description, /First call get_answer/);
});

test('API rejects invalid media types, malformed JSON, ambiguous query and oversized actual body', async (t) => {
  const f = await fixture(t);
  assert.equal((await f.handle(f.post({}, { 'content-type': 'text/plain' }))).status, 415);
  assert.equal((await f.handle(new Request(`http://localhost${API_PATH}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{' }))).status, 400);
  assert.equal((await f.handle(new Request(f.url({ revision: '1.5' })))).status, 400);
  assert.equal((await f.handle(new Request(`${f.url()}&id=duplicate`))).status, 400);
  assert.equal((await f.handle(new Request(f.url({ action: 'list', revision: '1' })))).status, 400);
  assert.equal((await f.handle(new Request(f.url({ unexpected: 'true' })))).status, 400);
  const huge = f.post({ text: 'x'.repeat(MAX_REQUEST_BYTES + 1) });
  assert.equal((await f.handle(huge)).status, 413);
  assert.equal((await f.handle(f.post({}, { 'content-type': 'application/json', 'content-length': String(MAX_REQUEST_BYTES + 1) }))).status, 413);
  assert.equal((await f.handle(new Request(f.url(), { method: 'DELETE' }))).status, 405);
});

test('tools bind session identity to execution and validate unknown fields', async (t) => {
  const f = await fixture(t);
  await assert.rejects(f.render.execute({ ...f.args, sessionId: 'session-b' }, f.exec), { code: 'INVALID_INPUT' });
  await assert.rejects(f.render.execute(f.args, { signal: f.exec.signal }), { code: 'INVALID_INPUT' });
  await assert.rejects(f.render.execute({ ...f.args, initialState: { invalid: Number.NaN } }, f.exec), { code: 'INVALID_INPUT' });
  const signal = AbortSignal.abort();
  await assert.rejects(f.render.execute(f.args, { ...f.exec, signal }), { name: 'AbortError' });
});

test('unexpected storage errors do not disclose filesystem paths', async () => {
  const handler = createApiHandler({ get: async () => { throw Object.assign(new Error('/private/secret/path EACCES'), { code: 'EACCES' }); } });
  const response = await handler(new Request(`http://localhost${API_PATH}?sessionId=test&id=test`));
  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), { error: { code: 'INTERNAL_ERROR', message: 'The web answer could not be loaded or saved.' } });
});

test('storageDir must be explicit absolute path, otherwise follows DSH_HOME', () => {
  assert.equal(storageDirectory({ storageDir: '/tmp/answers' }, { DSH_HOME: '/tmp/ignored' }), '/tmp/answers');
  assert.equal(storageDirectory({}, { DSH_HOME: '/tmp/harness' }), '/tmp/harness/web-answer');
  assert.throws(() => storageDirectory({ storageDir: './answers' }), { code: 'INVALID_INPUT' });
  assert.throws(() => storageDirectory({ unknown: true }), { code: 'INVALID_INPUT' });
});
