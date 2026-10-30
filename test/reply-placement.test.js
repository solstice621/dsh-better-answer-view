import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { webAnswerDefinition } from '../src/conversation.js';
import { webAnswerReplyDefinition } from '../src/reply-conversation.js';

const A = '10000000-0000-4000-8000-000000000001';
const B = '10000000-0000-4000-8000-000000000002';
const marker = id => `:::web-answer ${id}\n:::`;
const event = (type, seq, data) => ({ type, seq, time: 1700000000000 + seq, data });
const receipt = id => ({ kind: 'web-answer', id, revision: 1, title: id, summary: 'Example', sessionId: 'example-session' });
function result(seq, id) {
  return event('tool/result', seq, { turn: 1, step: 1, meta: receipt(id), message: {
    role: 'tool', source: { kind: 'tool', callId: `call-${seq}` }, toolCallId: `call-${seq}`,
    content: [{ type: 'text', text: JSON.stringify(receipt(id)) }],
  } });
}
const reply = (seq, step, text, extra = []) => ({ ...event('assistant/message', seq, {
  turn: 1, step, message: { id: `message-${seq}`, role: 'assistant', content: [{ type: 'text', text }, ...extra] },
}), surfaceOp: 'append' });

export const exampleEvents = [
  event('turn/start', 0, { turn: 1 }), result(1, A), result(2, B),
  reply(3, 2, `Product introduction\n\n${marker(A)}\n\nBusiness explanation\n\n${marker(B)}\n\nConclusion`),
  event('step/start', 4, { turn: 1, step: 3 }),
  reply(5, 3, 'An additional clarification.'),
  event('turn/end', 6, { turn: 1, reason: { kind: 'completed' } }),
];

function project(events) {
  const matches = events.flatMap(event => {
    const match = webAnswerDefinition.match(event);
    return match ? [{ ...match, event, location: { kind: 'unresolved' } }] : [];
  });
  return webAnswerDefinition.buildViewNode({ id: '1', key: 'web-answer:1', matches, current: new Map() });
}

test('a later clarification keeps both cards attached to the original full reply', () => {
  const node = project(exampleEvents);
  assert.deepEqual(node.data.inlineIds, [A, B]);
  assert.deepEqual(node.data.promotedSteps, [2]);
  assert.deepEqual(node.data.inlineOwners, [[A, 2], [B, 2]]);
  assert.deepEqual(node.data.views.filter(view => !node.data.inlineIds.includes(view.id)), []);
  assert.deepEqual(project(exampleEvents.slice(1)).data, node.data, 'cold history retains the same ownership');
});

test('the most recent complete reference owns a repeated card without duplicate placement', () => {
  const events = [...exampleEvents.slice(0, -2), reply(5, 3, `Updated explanation\n\n${marker(A)}`), exampleEvents.at(-1)];
  const node = project(events);
  assert.deepEqual(node.data.inlineOwners, [[A, 3], [B, 2]]);
  assert.deepEqual(node.data.promotedSteps, [2, 3]);
});

test('a tool-calling message cannot replace the earlier completed answer owner', () => {
  const events = [...exampleEvents.slice(0, -2), reply(5, 3, marker(A), [{ type: 'tool-call', id: 'next-call' }]), exampleEvents.at(-1)];
  const node = project(events);
  assert.deepEqual(node.data.promotedSteps, [2]);
  assert.deepEqual(node.data.inlineOwners, [[A, 2], [B, 2]]);
});

test('a retry withdraws a promoted reply until its replacement has settled', () => {
  const events = [...exampleEvents.slice(0, 4), event('llm/retry', 4, { turn: 1, step: 2 }), exampleEvents.at(-1)];
  const node = project(events);
  assert.deepEqual(node.data.promotedSteps, []);
  assert.deepEqual(node.data.inlineIds, []);
});

function replyNode(events) {
  const matches = events.flatMap(event => {
    const match = webAnswerReplyDefinition.match(event);
    return match ? [{ ...match, event, location: { kind: 'unresolved' } }] : [];
  });
  return webAnswerReplyDefinition.buildViewNode({ id: '1:2', key: 'reply:1:2', matches, current: new Map() });
}

test('reply seats preserve public text, images and message identity, but do not copy reasoning or model metadata', () => {
  const source = reply(3, 2, `Before\n\n${marker(A)}\n\nAfter`, [
    { type: 'reasoning', text: 'Private reasoning' }, { type: 'image', attachment: { id: 'picture' } },
  ]);
  source.data.message.source = { replayState: 'not part of presentation' };
  const node = replyNode([source]);
  assert.equal(node.groupTree, 'turn');
  assert.equal(node.anchorSeq, 3);
  assert.equal(node.data.finalNode.messageId, 'message-3');
  assert.deepEqual(node.data.blocks, [{ kind: 'text', text: source.data.message.content[0].text },
    { kind: 'image', attachment: { id: 'picture' } }]);
  assert.ok(!JSON.stringify(node).includes('Private reasoning'));
  assert.ok(!JSON.stringify(node).includes('replayState'));
  assert.equal(replyNode([reply(4, 2, 'No marker')]), null);
  assert.equal(replyNode([reply(4, 2, marker(A), [{ type: 'tool-call' }])]), null);
});

test('retry and an unmarked replacement hide an already published reply without withdrawing its stable key', () => {
  const source = reply(3, 2, marker(A));
  const current = replyNode([source]);
  for (const replacement of [event('llm/retry', 4, { turn: 1, step: 2 }), reply(4, 2, 'Replacement')]) {
    const context = { id: '1:2', key: current.key, state: null,
      matches: [{ event: replacement, location: { kind: 'unresolved' } }], current: new Map([['chat', current]]) };
    const hidden = webAnswerReplyDefinition.buildViewNode(context);
    assert.equal(hidden.key, current.key);
    assert.equal(hidden.visibility, 'hidden');
    assert.equal(project([exampleEvents[0], result(1, A), source, replacement, exampleEvents.at(-1)]).data.promotedSteps.length, 0);
  }
});

test('installed assembler preserves original reply placement through cold history, prepend and live continuation', {
  skip: !process.env.DSH_CONVERSATION_CLIENT_BUNDLE,
}, async () => {
  const source = await readFile(process.env.DSH_CONVERSATION_CLIENT_BUNDLE, 'utf8');
  const from = source.indexOf('//#region lib/types/client/contract/conversation.js');
  const until = source.indexOf('//#region lib/types/client/conversation/definition-registry.js', from);
  assert.ok(from >= 0 && until > from);
  const Assembler = vm.runInNewContext(`${source.slice(from, until)}\nConversationNodeAssembler`, {
    _deepseek_ai_dsh_client_store: { notifySubscribers(listeners) { for (const listener of listeners) listener(); } },
  });
  function assembler() {
    return new Assembler({ entries: () => [webAnswerDefinition, webAnswerReplyDefinition], fallbackEntry() {} }, {
      entries: () => [{ target: 'chat', create() {
        let nodes = new Map();
        return { empty: [], replace(input) { nodes = new Map(input.nodes.map(node => [node.key, node])); return [...nodes.values()]; },
          apply(input) { for (const node of input.upserts) nodes.set(node.key, node); return [...nodes.values()]; } };
      } }],
    });
  }
  const wrap = event => ({ type: 'event', event });
  function check(assembly) {
    assembly.flush();
    const nodes = assembly.snapshot('chat');
    const answer = nodes.find(node => node.kind === 'web-answer');
    const reply = nodes.find(node => node.kind === 'web-answer-reply' && node.visibility !== 'hidden');
    assert.deepEqual(answer.data.promotedSteps, [2]);
    assert.deepEqual(answer.data.inlineIds, [A, B]);
    assert.equal(reply.data.step, 2);
    assert.equal(reply.groupTree, 'turn');
    assert.equal(reply.anchorSeq, 3, 'original reply remains before the later clarification at sequence 5');
    assert.deepEqual(reply.location.turn.data.get('web-answer'), answer.data);
    return { answer: answer.data, reply: reply.data };
  }
  const complete = assembler();
  complete.replaceWindow(exampleEvents.map(wrap), false); complete.activateTarget('chat');
  const expected = check(complete);
  const cold = assembler();
  cold.replaceWindow(exampleEvents.slice(1).map(wrap), true); cold.activateTarget('chat');
  assert.deepEqual(check(cold), expected);
  cold.prepend(exampleEvents.slice(0, 1).map(wrap), false);
  assert.deepEqual(check(cold), expected);
  const lateReceipts = assembler();
  lateReceipts.replaceWindow(exampleEvents.slice(3).map(wrap), true); lateReceipts.activateTarget('chat'); lateReceipts.flush();
  lateReceipts.prepend(exampleEvents.slice(0, 3).map(wrap), false);
  assert.deepEqual(check(lateReceipts), expected);
  const live = assembler();
  live.replaceWindow([], false); live.activateTarget('chat');
  for (const event of exampleEvents) { live.append(wrap(event)); live.flush(); }
  assert.deepEqual(check(live), expected);
});
