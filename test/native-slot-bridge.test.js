import test from 'node:test';
import assert from 'node:assert/strict';
import {registerNativeSlotBridge} from '../src/native-slot-bridge.js';

function fixture() {
  const declared = new Set(['conversation.chat.node', 'native.reasoning', 'native.images']);
  const entries = new Map();
  const listeners = new Map();
  const slots = {
    entries: name => entries.get(name) || [],
    subscribe(name, listener) {
      const set = listeners.get(name) || new Set(); listeners.set(name, set); set.add(listener);
      return () => set.delete(listener);
    },
    register(options, component) {
      assert.ok(declared.has(options.name));
      for (const child of Object.keys(options.children || {})) {
        assert.ok(!declared.has(child), `duplicate child ${child}`);
        declared.add(child);
      }
      const entry = {options, component, inject: options.inject, locale: options.locale, children: options.children};
      entries.set(options.name, [...(entries.get(options.name) || []), entry]);
      for (const listener of listeners.get(options.name) || []) listener();
      let disposed = false;
      return () => {
        if (disposed) return; disposed = true;
        entries.set(options.name, (entries.get(options.name) || []).filter(candidate => candidate !== entry));
        for (const child of Object.keys(options.children || {})) declared.delete(child);
        for (const listener of listeners.get(options.name) || []) listener();
      };
    },
  };
  const injection = () => ({hooks: {presentation: {}}});
  const Native = () => null;
  const base = {component: Native, options: {key: 'assistant-step'}, locale: 'chat', inject: injection,
    children: {'native.reasoning': {kind: 'single', scope: 'session'}, 'native.images': {kind: 'single', scope: 'session'}}};
  entries.set('conversation.chat.node', [base]);
  entries.set('native.reasoning', [{component: Native, options: {priority: 100}, locale: 'reasoning'}]);
  entries.set('native.images', [{component: Native, options: {}, inject: () => ({images: true})}]);
  return {ctx: {slots}, base, entries, declared, listeners};
}

test('decorator aliases child slots and retains native injection, locale and components', () => {
  const {ctx, base, entries, declared} = fixture();
  const Decorated = () => null;
  const dispose = registerNativeSlotBridge(ctx, base, native => { assert.equal(native, base.component); return Decorated; });
  const entry = entries.get('conversation.chat.node').at(-1);
  assert.equal(entry.options.priority, -100);
  assert.equal(entry.inject, base.inject);
  assert.equal(entry.locale, base.locale);
  const calls = [];
  const element = entry.component({node: {data: {}}, renderSlot: (...args) => calls.push(args)});
  assert.equal(element.type, Decorated);
  element.props.renderSlot('native.images', {images: []});
  assert.equal(calls[0][0], 'dsh-better-answer-view.native.native.images');
  const imageEntry = entries.get('dsh-better-answer-view.native.native.images')[0];
  assert.equal(imageEntry.inject, entries.get('native.images')[0].inject);
  dispose();
  assert.deepEqual(entries.get('conversation.chat.node'), [base]);
  assert.deepEqual([...declared].sort(), ['conversation.chat.node', 'native.images', 'native.reasoning']);
});

test('native child replacement is mirrored and cleanup leaves the original untouched', () => {
  const {ctx, base, entries, listeners} = fixture();
  const dispose = registerNativeSlotBridge(ctx, base, native => native);
  const replacement = {component: () => null, options: {priority: 100}, locale: 'updated'};
  entries.set('native.reasoning', [replacement]);
  for (const listener of listeners.get('native.reasoning')) listener();
  assert.equal(entries.get('dsh-better-answer-view.native.native.reasoning').length, 1);
  assert.equal(entries.get('dsh-better-answer-view.native.native.reasoning')[0].locale, 'updated');
  dispose();
  assert.deepEqual(entries.get('native.reasoning'), [replacement]);
  assert.equal(listeners.get('native.reasoning').size, 0);
});
