import test from 'node:test';
import assert from 'node:assert/strict';
import {inlineAnswerIds, parseInlineReferences} from '../src/inline-reference.js';

const ID = '2412b11a-1165-44d1-98fb-a4823981aba6';
const marker = `:::web-answer ${ID}\n:::`;

test('answer references preserve surrounding prose and order', () => {
  assert.deepEqual(parseInlineReferences(`before\n\n${marker}\n\nafter`), [
    {kind: 'text', text: 'before\n\n'}, {kind: 'answer', id: ID}, {kind: 'text', text: '\nafter'},
  ]);
  assert.deepEqual(inlineAnswerIds(`${marker}\n${marker}`), [ID]);
});

test('references in fenced code, quoted lines, and indented code remain text', () => {
  for (const text of [`\`\`\`text\n${marker}\n\`\`\``, `~~~\n${marker}\n~~~`, `> ${marker.replace('\n', '\n> ')}`, `    ${marker.replace('\n', '\n    ')}`]) {
    assert.deepEqual(parseInlineReferences(text), [{kind: 'text', text}]);
  }
  assert.deepEqual(inlineAnswerIds(`\`\`\`\n${marker}\n\`\`\`\n${marker}`), [ID]);
});

test('partial streamed reference is neutral, final malformed text is preserved', () => {
  for (const text of [':::web-answer', ':::web-answer 2412b11a-', `:::web-answer ${ID}\n:`]) {
    assert.deepEqual(parseInlineReferences(text, {streaming: true}), [{kind: 'pending', text}]);
    assert.deepEqual(parseInlineReferences(text), [{kind: 'text', text}]);
  }
  assert.deepEqual(parseInlineReferences(':::web-answer nope\n:::', {streaming: true}), [{kind: 'text', text: ':::web-answer nope\n:::'}]);
});

test('markers must own a line, contain a UUID, and have an immediate terminator', () => {
  for (const text of [`inline ${marker}`, `:::web-answer ../secret\n:::`, `:::web-answer ${ID}\nextra\n:::`]) assert.deepEqual(inlineAnswerIds(text), []);
  assert.deepEqual(inlineAnswerIds(`  :::web-answer ${ID.toUpperCase()}\r\n  :::\r\n`), [ID]);
});
