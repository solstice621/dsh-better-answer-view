import test from 'node:test';
import assert from 'node:assert/strict';
import { byteLength, copyState, validateView, receiverDocument, createSurfaceFrame } from '../src/surface-runtime.js';

const view = { id: 'view-1', revision: 1, title: '交互回答', html: '<p>Model content</p>', stateSchemaVersion: 1 };

test('UTF-8 payload limits count bytes, not characters', () => {
  assert.equal(byteLength('你好'), 6);
  assert.throws(() => copyState({ text: '你'.repeat(6000) }), /16 KiB/);
  assert.throws(() => validateView({ ...view, html: '你'.repeat(90000) }), /256 KiB/);
});

test('state is copied and rejects cycles, executable values and non-finite numbers', () => {
  const original = { nested: { value: 1 }, list: [true, null, 'a'] };
  const clone = copyState(original);
  clone.nested.value = 2;
  assert.equal(original.nested.value, 1);
  const cyclic = {}; cyclic.self = cyclic;
  for (const invalid of [cyclic, [], { f() {} }, { value: undefined }, { number: Infinity }, { date: new Date() }]) {
    assert.throws(() => copyState(invalid));
  }
});

test('view validation requires a stable identity and positive revision', () => {
  assert.equal(validateView(view).id, view.id);
  assert.throws(() => validateView({ ...view, id: '' }), /view id/);
  assert.throws(() => validateView({ ...view, revision: 0 }), /revision/);
  assert.throws(() => validateView({ ...view, revision: 1.5 }), /revision/);
});

test('fixed receiver has restrictive resource policy and no model content', () => {
  const html = receiverDocument();
  assert.match(html, /connect-src 'none'/);
  assert.match(html, /form-action 'none'/);
  assert.match(html, /frame-src 'none'/);
  assert.match(html, /worker-src 'none'/);
  assert.doesNotMatch(html, /Model content/);
  assert.match(html, /event\.source !== window\.parent/);
});

async function until(predicate) {
  const deadline = Date.now() + 1000;
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error('Timed out waiting for message.');
    await new Promise((resolve) => setTimeout(resolve, 2));
  }
}

async function mount(callbacks = {}) {
  const originalDocument = globalThis.document;
  const listeners = new Map();
  const attributes = new Map();
  let initialization;
  const fakeFrame = {
    style: {}, dataset: {},
    setAttribute: (key, value) => attributes.set(key, value),
    addEventListener: (type, callback) => listeners.set(type, callback),
    removeEventListener: (type) => listeners.delete(type),
    contentWindow: { postMessage: (data, origin, ports) => { initialization = { data, origin, ports }; } },
  };
  globalThis.document = { createElement: (tag) => { assert.equal(tag, 'iframe'); return fakeFrame; } };
  let surface;
  try { surface = createSurfaceFrame({ view, state: { reward: 100 }, ...callbacks }); }
  finally { globalThis.document = originalDocument; }
  listeners.get('load')();
  const port = initialization.ports[0];
  const session = initialization.data.session;
  const received = [];
  port.onmessage = (event) => received.push(event.data);
  port.start();
  const send = (data) => port.postMessage({ session, ...data });
  send({ type: 'ready' });
  await until(() => received.some((message) => message.type === 'render'));
  return { surface, fakeFrame, listeners, attributes, received, send, port };
}

test('iframe uses an isolated sandbox; HTML travels only over its private channel', async () => {
  let readyView;
  const mounted = await mount({ onReady: (value) => { readyView = value; } });
  try {
    assert.equal(mounted.attributes.get('sandbox'), 'allow-scripts');
    assert.equal(mounted.fakeFrame.title, view.title);
    assert.doesNotMatch(mounted.fakeFrame.srcdoc, /Model content/);
    assert.equal(mounted.received[0].html, view.html);
    mounted.send({ type: 'rendered', errorCount: 0 });
    await until(() => readyView);
    assert.deepEqual(readyView, { viewId: 'view-1', revision: 1 });
    mounted.surface.setTheme('dark');
    await until(() => mounted.received.some((message) => message.type === 'theme'));
    assert.equal(mounted.received.find((message) => message.type === 'theme').theme, 'dark');
  } finally { mounted.surface.dispose(); }
});

test('embedded bridge accepts intrinsic height above old caps and can shrink again', async () => {
  const heights = [];
  const mounted = await mount({ embedded: true, onHeight: height => heights.push(height) });
  try {
    assert.equal(mounted.received[0].embedded, true);
    mounted.send({ type: 'height', height: 18640 });
    await until(() => heights.length === 1);
    assert.equal(mounted.fakeFrame.style.height, '18640px');
    mounted.send({ type: 'height', height: 64.2 });
    await until(() => heights.length === 2);
    assert.deepEqual(heights, [18640, 65]);
    assert.equal(mounted.fakeFrame.style.height, '65px');
    for (const height of [-1, 0, Infinity, NaN, Number.MAX_VALUE]) mounted.send({ type: 'height', height });
    await new Promise(resolve => setTimeout(resolve, 10));
    assert.deepEqual(heights, [18640, 65]);
  } finally { mounted.surface.dispose(); }
});

test('state saves and questions are serialized and callback results return to the page', async () => {
  const calls = [];
  let releaseSave;
  const saveGate = new Promise((resolve) => { releaseSave = resolve; });
  const mounted = await mount({
    onState: async (state) => { calls.push(['save', state]); await saveGate; },
    onAsk: async (question) => { calls.push(['ask', question]); return { pending: true }; },
  });
  try {
    mounted.send({ type: 'state', id: '1', state: { reward: 90 } });
    mounted.send({ type: 'ask', id: '2', text: '重新分析', state: { reward: 90 } });
    await until(() => calls.length === 1);
    assert.equal(calls[0][0], 'save');
    releaseSave();
    await until(() => mounted.received.some((message) => message.id === '2'));
    assert.deepEqual(calls[1], ['ask', { text: '重新分析', state: { reward: 90 } }]);
    assert.deepEqual(mounted.received.find((message) => message.id === '2').result, { pending: true });
  } finally { releaseSave(); mounted.surface.dispose(); }
});

test('host rejects oversized requests, ignores wrong sessions and rejects failed saves', async () => {
  let calls = 0;
  const errors = [];
  const mounted = await mount({
    onState: async () => { calls++; throw new Error('Disk full'); },
    onAsk: async () => { calls++; },
    onError: (error) => errors.push(error.message),
  });
  try {
    mounted.send({ session: 'wrong-channel', type: 'ask', id: '9', text: 'ignored', state: {} });
    mounted.send({ type: 'ask', id: '1', text: 'x'.repeat(8193), state: {} });
    mounted.send({ type: 'state', id: '2', state: { value: 'x'.repeat(16385) } });
    mounted.send({ type: 'state', id: '3', state: { value: 1 } });
    await until(() => mounted.received.some((message) => message.id === '3'));
    assert.equal(calls, 1);
    for (const id of ['1', '2', '3']) assert.equal(mounted.received.find((message) => message.id === id).ok, false);
    assert.ok(errors.includes('Disk full'));
  } finally { mounted.surface.dispose(); }
});

test('dispose closes the bridge and navigation closes a mounted surface', async () => {
  const errors = [];
  let calls = 0;
  const mounted = await mount({ onAsk: () => { calls++; }, onError: (error) => errors.push(error.message) });
  mounted.listeners.get('load')();
  assert.match(errors[0], /navigate/);
  assert.match(mounted.fakeFrame.srcdoc, /不支持页面导航/);
  mounted.send({ type: 'ask', id: '1', text: 'ignored', state: {} });
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(calls, 0);
  mounted.surface.dispose();
});
