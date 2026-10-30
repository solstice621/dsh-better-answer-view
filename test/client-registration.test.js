import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {build} from 'esbuild';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';

const require = createRequire(import.meta.url);
const compiled = await build({entryPoints: [new URL('../src/client.jsx', import.meta.url).pathname], bundle: true,
  format: 'cjs', platform: 'node', external: ['react'], write: false});

function setup({failInline = false, failPromoted = false} = {}) {
  const warnings = [];
  const module = {exports: {}};
  vm.runInNewContext(compiled.outputFiles[0].text, {module, exports: module.exports, require, console: {warn: (...args) => warnings.push(args)}});
  const entries = [{options: {key: 'assistant-step'}, registrant: '@deepseek-ai/dsh-client-ui-chat', component: ({node}) => React.createElement('p', null, node.data.blocks.filter(block => block.kind !== 'image').map(block => block.text).join(''))}];
  const registered = [];
  const ctx = {
    uiConversation: {events: {register() {}}},
    sessions: {scope() {return {conversation: {send() {}}};}},
    slots: {
      inject(_name, fn) {return fn();},
      entries() {return entries;},
      subscribe() {return () => {};},
      register(options, component) {
        if (options.key === 'assistant-step' && failInline) throw new Error('native registration unavailable');
        if (options.key === 'web-answer-reply' && failPromoted) throw new Error('promoted registration unavailable');
        registered.push({options, component});
        return () => { const index = registered.findIndex(entry => entry.component === component); if (index !== -1) registered.splice(index, 1); };
      },
    },
  };
  module.exports.apply(ctx);
  return {registered, warnings};
}

const receipt = {kind: 'web-answer', id: '2412b11a-1165-44d1-98fb-a4823981aba6', revision: 1,
  sessionId: 'test-session', title: 'A saved diagram', summary: 'Diagram summary'};
const node = {visibility: 'visible', data: {views: [receipt], inlineIds: [receipt.id]}};

test('a failed inline registration leaves the fallback answer available', () => {
  const {registered, warnings} = setup({failInline: true});
  assert.equal(warnings.length, 1);
  const Renderer = registered.find(entry => entry.options.key === 'web-answer').component;
  const html = renderToStaticMarkup(React.createElement(Renderer, {node, sessionId: receipt.sessionId}));
  assert.match(html, /wa-view wa-embedded/);
  assert.match(html, /A saved diagram/);
});

test('a failed promoted renderer rolls back both bridges and retains fallback content', () => {
  const {registered, warnings} = setup({failPromoted: true});
  assert.equal(warnings.length, 1);
  assert.equal(registered.some(entry => ['assistant-step', 'web-answer-reply'].includes(entry.options.key)), false);
  const Fallback = registered.find(entry => entry.options.key === 'web-answer').component;
  assert.match(renderToStaticMarkup(React.createElement(Fallback, {node, sessionId: receipt.sessionId})), /A saved diagram/);
});

test('a registered inline renderer suppresses the matching fallback but leaves ordinary prose native', () => {
  const {registered, warnings} = setup();
  assert.equal(warnings.length, 0);
  const Fallback = registered.find(entry => entry.options.key === 'web-answer').component;
  assert.equal(renderToStaticMarkup(React.createElement(Fallback, {node, sessionId: receipt.sessionId})), '');
  const Assistant = registered.find(entry => entry.options.key === 'assistant-step').component;
  const html = renderToStaticMarkup(React.createElement(Assistant, {node: {data: {status: 'settled', blocks: [{kind: 'text', text: 'Ordinary answer'}]}},
    sessionId: receipt.sessionId, useTurnData: () => undefined}));
  assert.equal(html, '<p>Ordinary answer</p>');
});

test('distinct inline blocks preserve prose between them and suppress both fallback copies', () => {
  const second = {...receipt, id: '49982f4a-98e9-4471-8f56-fcdc7c86fa00', title: 'A separate comparison'};
  // Receipt order follows tool execution; display order follows the reply.
  const turnAnswers = {views: [second, receipt], inlineIds: [receipt.id, second.id], inlineStep: 3};
  const text = `Before the diagram\n\n:::web-answer ${receipt.id}\n:::\n\nBetween the two blocks\n\n:::web-answer ${second.id}\n:::\n\nAfter the comparison`;
  const {registered} = setup();
  const Assistant = registered.find(entry => entry.options.key === 'assistant-step').component;
  const html = renderToStaticMarkup(React.createElement(Assistant, {
    node: {data: {status: 'settled', step: 3, blocks: [{kind: 'text', text}]}},
    sessionId: receipt.sessionId, useTurnData: () => turnAnswers,
  }));
  assert.equal((html.match(/class="wa-view wa-embedded"/g) || []).length, 2);
  const positions = ['Before the diagram', `aria-label="${receipt.title}"`, 'Between the two blocks',
    `aria-label="${second.title}"`, 'After the comparison'].map(fragment => html.indexOf(fragment));
  assert.ok(positions.every((position, index) => position >= 0 && (index === 0 || position > positions[index - 1])),
    'each distinct block appears once at its marker, with native prose before, between, and after');
  assert.ok(!html.includes(':::web-answer'), 'raw markers are replaced by inline blocks');
  const Fallback = registered.find(entry => entry.options.key === 'web-answer').component;
  assert.equal(renderToStaticMarkup(React.createElement(Fallback, {
    node: {visibility: 'visible', data: turnAnswers}, sessionId: receipt.sessionId,
  })), '', 'neither already embedded block appears again at the turn end');
});

test('a promoted reply renders native prose and cards in order, while its original seat keeps only reasoning', () => {
  const second = {...receipt, id: '49982f4a-98e9-4471-8f56-fcdc7c86fa00', title: 'A separate comparison'};
  const turnAnswers = {views: [receipt, second], inlineIds: [receipt.id, second.id], inlineStep: 18,
    promotedSteps: [17], inlineOwners: [[receipt.id, 17], [second.id, 17]]};
  const text = `Product introduction\n\n:::web-answer ${receipt.id}\n:::\n\nBusiness explanation\n\n:::web-answer ${second.id}\n:::\n\nConclusion`;
  const {registered} = setup();
  const Assistant = registered.find(entry => entry.options.key === 'assistant-step').component;
  const Promoted = registered.find(entry => entry.options.key === 'web-answer-reply').component;
  const Fallback = registered.find(entry => entry.options.key === 'web-answer').component;
  const props = {node: {kind: 'web-answer-reply', visibility: 'visible', data: {status: 'settled', step: 17, blocks: [{kind: 'text', text}]}},
    sessionId: receipt.sessionId, useTurnData: () => turnAnswers};
  const html = renderToStaticMarkup(React.createElement(Promoted, props));
  const positions = ['Product introduction', `aria-label="${receipt.title}"`, 'Business explanation',
    `aria-label="${second.title}"`, 'Conclusion'].map(fragment => html.indexOf(fragment));
  assert.ok(positions.every((position, index) => position >= 0 && (index === 0 || position > positions[index - 1])));
  assert.equal((html.match(/class="wa-view wa-embedded"/g) || []).length, 2);
  assert.equal(renderToStaticMarkup(React.createElement(Assistant, props)), '', 'no duplicate body in the old seat');
  assert.equal(renderToStaticMarkup(React.createElement(Assistant, {...props, node: {...props.node,
    data: {...props.node.data, blocks: [{kind: 'reasoning', text: 'Original reasoning'}, ...props.node.data.blocks]}}})), '<p>Original reasoning</p>');
  assert.equal(renderToStaticMarkup(React.createElement(Fallback, {node: {data: turnAnswers}})), '');
  assert.equal(renderToStaticMarkup(React.createElement(Assistant, {...props, node: {data: {
    status: 'settled', step: 18, blocks: [{kind: 'text', text: 'An additional clarification.'}],
  }}})), '<p>An additional clarification.</p>');
});

test('untrusted, withdrawn, and superseded reply seats never duplicate a card', () => {
  const {registered} = setup();
  const Promoted = registered.find(entry => entry.options.key === 'web-answer-reply').component;
  const text = `Before\n\n:::web-answer ${receipt.id}\n:::\n\nAfter`;
  const props = {node: {visibility: 'visible', data: {status: 'settled', step: 2, blocks: [{kind: 'text', text}]}},
    sessionId: receipt.sessionId, useTurnData: () => ({views: [], promotedSteps: []})};
  assert.equal(renderToStaticMarkup(React.createElement(Promoted, props)), '');
  assert.equal(renderToStaticMarkup(React.createElement(Promoted, {...props, node: {...props.node, visibility: 'hidden'},
    useTurnData: () => ({views: [receipt], promotedSteps: [2], inlineOwners: [[receipt.id, 2]]})})), '');
  const html = renderToStaticMarkup(React.createElement(Promoted, {...props,
    useTurnData: () => ({views: [receipt], promotedSteps: [2], inlineOwners: [[receipt.id, 3]]})}));
  assert.ok(!html.includes('wa-view'), 'a card owned by a later answer is not rendered here');
  assert.match(html, /Before/);
  assert.match(html, /After/);
});
