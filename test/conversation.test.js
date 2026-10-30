import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import { registerWebAnswerConversation, webAnswerDefinition } from '../src/conversation.js';
import { webAnswerReplyDefinition } from '../src/reply-conversation.js';

function event(type, seq, data) {
  return { type, seq, time: 1700000000000 + seq, data };
}

function receipt(id = 'answer-a', revision = 1, overrides = {}) {
  return { kind: 'web-answer', id, revision, title: `Answer ${id}`, summary: 'A durable summary.', sessionId: 'session-a', ...overrides };
}

function call(seq, name = 'render_answer', callId = `call-${seq}`, turn = 1) {
  return event('tool/call', seq, { turn, step: 1, callId, name, arguments: '{}' });
}

function result(seq, value = receipt(), options = {}) {
  const { turn = 1, callId = `call-${seq - 1}`, meta = true, isError = false, format = 'nested' } = options;
  const content = [{ type: 'text', text: JSON.stringify(value) }];
  return event('tool/result', seq, {
    turn,
    step: 1,
    message: {
      id: `message-${seq}`,
      source: { kind: 'tool', callId },
      ...(format === 'flat'
        ? { role: 'tool', toolCallId: callId, isError, content }
        : { role: 'user', content: [{ type: 'tool-result', toolCallId: callId, isError, content }] }),
    },
    ...(meta ? { meta: value } : {}),
  });
}

const start = (seq = 1, turn = 1) => event('turn/start', seq, { turn });
const end = (seq = 20, turn = 1) => event('turn/end', seq, { turn, reason: { kind: 'completed' } });
const ANSWER_A = '10000000-0000-4000-8000-000000000001';
const ANSWER_B = '10000000-0000-4000-8000-000000000002';
const marker = id => `:::web-answer ${id}\n:::`;
function assistant(seq, text, { turn = 1, step = 2, content } = {}) {
  return { ...event('assistant/message', seq, {
    turn, step, message: { id: `assistant-${seq}`, role: 'assistant', content: content ?? [{ type: 'text', text }] },
  }), surfaceOp: 'append' };
}
const chunk = (seq, value, step = 2) => event('assistant/live-chunk', seq, { turn: 1, step, chunk: value });
const fallbackIds = node => node.data.views.filter(view => !node.data.inlineIds.includes(view.id)).map(view => view.id);

/**
 * Simulate the installed rc.3 Definition lifecycle: update-only Contexts keep
 * state undefined; a complete replay has exactly one start and ordered updates.
 * Events and tool-result nesting follow the installed .d.ts contracts.
 */
function fold(events) {
  const contexts = new Map();
  const turns = new Map();
  for (const input of events) {
    const number = input.data.turn;
    let turn = turns.get(number);
    if (turn === undefined) {
      turn = { turn: number, start: undefined, end: undefined, status: 'unknown', steps: [], data: new Map() };
      turns.set(number, turn);
    }
    if (input.type === 'turn/start') Object.assign(turn, { start: input, status: 'open' });
    if (input.type === 'turn/end') Object.assign(turn, { end: input, status: 'closed' });
    const matched = webAnswerDefinition.match(input);
    if (matched === null) continue;
    let context = contexts.get(matched.id);
    if (context === undefined) {
      context = { key: `10:web-answer${matched.id}`, kind: 'web-answer', id: matched.id, matches: [], start: undefined, state: undefined, current: new Map() };
      contexts.set(matched.id, context);
    }
    const match = { event: input, role: matched.role, location: { kind: 'turn', turn } };
    context.matches.push(match);
    if (matched.role === 'start') {
      assert.equal(context.start, undefined, 'rc.3 rejects duplicate starts');
      assert.equal(context.matches.length, 1, 'start must precede updates');
      context.start = match;
      context.state = webAnswerDefinition.start(context, match, { previous() {} });
    } else if (context.state !== undefined) context.state = webAnswerDefinition.update(context, match);
    context.locationData = webAnswerDefinition.buildLocationData(context, 'turn', context.locationData);
    if (context.locationData !== null) turn.data.set(context.locationData.key, context.locationData.value);
    const node = webAnswerDefinition.buildViewNode(context);
    context.current.set('chat', node);
  }
  return [...contexts.values()].map(context => webAnswerDefinition.buildViewNode(context)).filter(Boolean);
}

test('registers and disposes both answer receipts and non-folding reply seats', () => {
  const registered = [], disposed = [];
  const ctx = { uiConversation: { events: { register(value) {
    registered.push(value); return () => disposed.push(value.kind);
  } } } };
  const dispose = registerWebAnswerConversation(ctx);
  assert.deepEqual(registered, [webAnswerDefinition, webAnswerReplyDefinition]);
  dispose();
  assert.deepEqual(disposed, ['web-answer-reply', 'web-answer']);
});

test('ordinary turns and errors do not produce a web answer', () => {
  assert.deepEqual(fold([start(), call(2), result(3, receipt(), { isError: true }), end()]), []);
  assert.deepEqual(fold([start(), end()]), []);
});

test('publishes on a successful result and anchors the same node to turn/end', () => {
  const events = [start(), call(2), result(3)];
  const [live] = fold(events);
  const [settled] = fold([...events, end()]);
  assert.equal(live.anchorSeq, 3);
  assert.equal(settled.anchorSeq, 20);
  assert.equal(settled.key, live.key);
  assert.equal(settled.kind, 'web-answer');
  assert.equal(settled.target, 'chat');
  assert.equal(settled.visibility, 'visible');
  assert.equal(settled.groupTree, 'turn');
  assert.equal(settled.location.turn.end.seq, 20);
  assert.deepEqual(settled.data, { views: [receipt()], inlineIds: [], inlineStep: null, inlineOwners: [], promotedSteps: [] });
});

test('keeps each view once, retains first appearance order, and never regresses revisions', () => {
  const [node] = fold([
    start(), call(2), result(3),
    call(4), result(5, receipt('answer-b')),
    call(6, 'update_answer'), result(7, receipt('answer-a', 3, { title: 'Updated' })),
    call(8, 'update_answer'), result(9, receipt('answer-a', 2)), end(),
  ]);
  assert.deepEqual(node.data.views, [receipt('answer-a', 3, { title: 'Updated' }), receipt('answer-b')]);
});

test('reads the model-facing JSON result when presentation metadata is absent', () => {
  const [node] = fold([start(), call(2), result(3, receipt(), { meta: false }), end()]);
  assert.deepEqual(node.data.views, [receipt()]);
});

test('desktop 0.2.x flat tool messages publish live, restore from history, and read JSON fallback', () => {
  // This is the persisted 0.2.x message shape; no real conversation data is used.
  for (const meta of [true, false]) {
    const answer = result(3, receipt(), { format: 'flat', meta });
    const [live] = fold([start(), call(2), answer]);
    const [settled] = fold([start(), call(2), answer, end()]);
    const [cold] = fold([answer, end()]);
    assert.equal(live.anchorSeq, 3);
    assert.equal(settled.anchorSeq, 20);
    assert.equal(cold.key, settled.key);
    assert.deepEqual(settled.data.views, [receipt()]);
    assert.deepEqual(cold.data, settled.data);
  }
});

test('desktop flat tool messages reject errors, mismatched identities, malformed content, and unrelated tools', () => {
  const flat = options => result(3, receipt(), { format: 'flat', ...options });
  assert.equal(webAnswerDefinition.match(flat({ isError: true })), null);
  const mismatched = flat();
  mismatched.data.message.toolCallId = 'another-call';
  assert.equal(webAnswerDefinition.match(mismatched), null);
  const missingCallId = flat();
  delete missingCallId.data.message.toolCallId;
  assert.equal(webAnswerDefinition.match(missingCallId), null);
  const malformed = flat();
  malformed.data.message.content = null;
  assert.equal(webAnswerDefinition.match(malformed), null);
  const nonJson = flat({ meta: false });
  nonJson.data.message.content[0].text = 'not JSON';
  assert.equal(webAnswerDefinition.match(nonJson), null);
  assert.deepEqual(fold([start(), call(2, 'read'), flat(), end()]), []);
});

test('cold history reconstructs results and the completed-turn position without turn/start', () => {
  const one = result(3);
  const two = result(7, receipt('answer-a', 2), { meta: false });
  const [cold] = fold([one, two, end()]);
  const [complete] = fold([start(), call(2), one, call(6, 'update_answer'), two, end()]);
  assert.deepEqual(cold.data, complete.data);
  assert.equal(cold.key, complete.key);
  assert.equal(cold.anchorSeq, complete.anchorSeq);
  assert.equal(cold.visibility, 'visible');
  assert.equal(webAnswerDefinition.match(one).role, 'update');
  assert.equal(webAnswerDefinition.match(two).role, 'update');
});

test('cold open history also displays a successful result before the turn ends', () => {
  const [node] = fold([result(8)]);
  assert.equal(node.anchorSeq, 8);
  assert.deepEqual(node.data.views, [receipt()]);
});

test('known unrelated tools cannot create web-answer nodes using receipt-like content', () => {
  assert.deepEqual(fold([start(), call(2, 'read'), result(3), end()]), []);
  assert.deepEqual(fold([call(2, 'read'), result(3), end()]), []);
});

test('ignores malformed receipts, mismatched call identities, and explicit error events', () => {
  for (const invalid of [null, {}, receipt('', 1), receipt('a', 0), receipt('a', 1.5), receipt('a', 1, { sessionId: '' }), receipt('a', 1, { title: null })]) {
    assert.equal(webAnswerDefinition.match(result(3, invalid)), null);
  }
  const mismatched = result(3);
  mismatched.data.message.content[0].toolCallId = 'another-call';
  assert.equal(webAnswerDefinition.match(mismatched), null);
  const error = result(3);
  error.data.error = { name: 'Failure', code: 'FAILED' };
  assert.equal(webAnswerDefinition.match(error), null);
  const nonJson = result(3, receipt(), { meta: false });
  nonJson.data.message.content[0].content[0].text = 'not JSON';
  assert.equal(webAnswerDefinition.match(nonJson), null);
  assert.equal(webAnswerDefinition.match(event('turn/start', 1, { turn: '1' })), null);
});

test('different turns retain independent answer nodes even for the same view id', () => {
  const nodes = fold([
    start(), call(2), result(3), end(4),
    start(5, 2), call(6, 'update_answer', 'call-6', 2),
    result(7, receipt('answer-a', 2), { turn: 2 }), end(8, 2),
  ]);
  assert.equal(nodes.length, 2);
  assert.notEqual(nodes[0].key, nodes[1].key);
  assert.equal(nodes[0].data.views[0].revision, 1);
  assert.equal(nodes[1].data.views[0].revision, 2);
  assert.deepEqual(nodes.map(node => node.anchorSeq), [4, 8]);
});

test('inline markers resolve only same-turn receipts and retain unmatched answers as fallbacks', () => {
  const first = receipt(ANSWER_A, 1, { sessionId: 'inherited-session' });
  const second = receipt(ANSWER_B);
  const events = [start(), call(2), result(3, first), call(4), result(5, second),
    assistant(6, `Before\n\n${marker(ANSWER_A)}\n\nAfter\n\n${marker(ANSWER_A)}`), end()];
  const [node] = fold(events);
  assert.deepEqual(node.data.views, [first, second]);
  assert.deepEqual(node.data.inlineIds, [ANSWER_A]);
  assert.deepEqual(fallbackIds(node), [ANSWER_B]);
  assert.equal(node.visibility, 'visible', 'inline receipts remain available to the assistant wrapper');
  assert.deepEqual(node.location.turn.data.get('web-answer'), node.data);
  const [historical] = fold(events.slice(2));
  assert.deepEqual(historical.data, node.data);
  assert.deepEqual(historical.location.turn.data.get('web-answer').views, [first, second]);
  assert.equal(webAnswerDefinition.buildLocationData({ state: {} }, 'step'), null);

  const [previousTurn] = fold([start(), call(2), result(3, first), end(4),
    start(5, 2), assistant(6, marker(ANSWER_A), { turn: 2 }), end(7, 2)]);
  assert.deepEqual(previousTurn.data.inlineIds, []);
  assert.deepEqual(fallbackIds(previousTurn), [ANSWER_A]);
});

test('code examples, reasoning, malformed markers, and failed or unrelated receipts never suppress an answer', () => {
  const text = `Example:\n\n\`\`\`text\n${marker(ANSWER_A)}\n\`\`\`\n\n${marker(ANSWER_B)}\n\n:::web-answer ${ANSWER_A}\ninvalid\n:::`;
  const [node] = fold([start(), call(2), result(3, receipt(ANSWER_A)),
    call(4), result(5, receipt(ANSWER_B), { isError: true, format: 'flat' }),
    assistant(6, '', { content: [{ type: 'reasoning', text: marker(ANSWER_A) }, { type: 'text', text }] }), end()]);
  assert.deepEqual(node.data.inlineIds, []);
  assert.deepEqual(fallbackIds(node), [ANSWER_A]);
  assert.deepEqual(fold([start(), call(2, 'read'), result(3, receipt(ANSWER_A)), assistant(4, marker(ANSWER_A)), end()]), []);
  const nonSurface = assistant(4, marker(ANSWER_A));
  nonSurface.surfaceOp = 'replace';
  const [unchanged] = fold([start(), call(2), result(3, receipt(ANSWER_A)), nonSurface, end()]);
  assert.deepEqual(unchanged.data.inlineIds, []);
});

test('streamed references suppress fallback only after closing and retry or final text replaces draft references', () => {
  const prefix = [start(), call(2), result(3, receipt(ANSWER_A)),
    chunk(4, { type: 'block-start', index: 0, blockType: 'reasoning' }),
    chunk(5, { type: 'reasoning-delta', index: 0, text: marker(ANSWER_A) }),
    chunk(6, { type: 'block-start', index: 1, blockType: 'text' }),
    chunk(7, { type: 'text-delta', index: 1, text: `Before\n\n:::web-answer ${ANSWER_A}\n::` })];
  assert.deepEqual(fallbackIds(fold(prefix)[0]), [ANSWER_A]);
  const complete = [...prefix, chunk(8, { type: 'text-delta', index: 1, text: ':\n\nAfter' })];
  assert.deepEqual(fold(complete)[0].data.inlineIds, [ANSWER_A]);
  assert.deepEqual(fallbackIds(fold(complete)[0]), []);
  assert.deepEqual(fallbackIds(fold([...complete, event('llm/retry', 9, { turn: 1, step: 2 })])[0]), [ANSWER_A]);
  assert.deepEqual(fallbackIds(fold([...complete, assistant(9, 'Final answer without a reference.')])[0]), [ANSWER_A]);
  const [settled] = fold([...complete, assistant(9, marker(ANSWER_A)), end()]);
  assert.deepEqual(settled.data.inlineIds, [ANSWER_A]);
  assert.deepEqual(settled.location.turn.data.get('web-answer').inlineIds, [ANSWER_A]);
  assert.equal(webAnswerDefinition.publication({ event: complete.at(-1) }), 'animation-frame');
});

test('markers cannot be assembled across separate text blocks', () => {
  const [node] = fold([start(), call(2), result(3, receipt(ANSWER_A)), assistant(4, '', {
    content: [{ type: 'text', text: `:::web-answer ${ANSWER_A}\n` }, { type: 'text', text: ':::' }],
  }), end()]);
  assert.deepEqual(fallbackIds(node), [ANSWER_A]);
});

test('completed turns retain the earlier inline answer when a later clarification settles', () => {
  const intermediate = [start(), call(2), result(3, receipt(ANSWER_A)), assistant(4, marker(ANSWER_A), { step: 2 })];
  const [running] = fold(intermediate);
  assert.deepEqual(fallbackIds(running), []);
  assert.equal(running.data.inlineStep, undefined);

  const finalText = [...intermediate, assistant(5, 'Final plain-text explanation.', { step: 3 }), end()];
  const [settled] = fold(finalText);
  assert.deepEqual(fallbackIds(settled), []);
  assert.equal(settled.data.inlineStep, 3);
  assert.deepEqual(settled.data.promotedSteps, [2]);
  assert.deepEqual(settled.location.turn.data.get('web-answer').inlineIds, [ANSWER_A]);
  assert.deepEqual(fold(finalText.slice(2))[0].data, settled.data);

  const [finalInline] = fold([...intermediate, assistant(5, `Final\n\n${marker(ANSWER_A)}`, { step: 3 }), end()]);
  assert.deepEqual(fallbackIds(finalInline), []);
  assert.equal(finalInline.data.inlineStep, 3);
  assert.deepEqual(finalInline.data.inlineIds, [ANSWER_A]);
});

test('a last tool, reasoning-only, or empty step cannot hide an earlier page as a final inline answer', () => {
  const prefix = [start(), call(2), result(3, receipt(ANSWER_A)), assistant(4, marker(ANSWER_A), { step: 2 })];
  const lastSteps = [
    assistant(5, '', { step: 3, content: [{ type: 'reasoning', text: marker(ANSWER_A) }] }),
    assistant(5, '', { step: 3, content: [{ type: 'text', text: marker(ANSWER_A) }, { type: 'tool-call', id: 'next-call' }] }),
    event('step/start', 5, { turn: 1, step: 3 }),
  ];
  for (const lastStep of lastSteps) {
    const [node] = fold([...prefix, lastStep, end()]);
    assert.equal(node.data.inlineStep, null);
    assert.deepEqual(node.data.promotedSteps, [2]);
    assert.deepEqual(fallbackIds(node), []);
  }
});

test('desktop process grouping keeps web answers outside collapsed execution groups', {
  skip: !process.env.DSH_CHAT_CLIENT_BUNDLE,
}, async () => {
  const source = await readFile(process.env.DSH_CHAT_CLIENT_BUNDLE, 'utf8');
  function region(name) {
    const from = source.indexOf(`//#region lib/types/client/${name}.js`);
    const until = source.indexOf('//#endregion', from);
    assert.ok(from >= 0 && until > from, `expected installed Chat region ${name}`);
    return source.slice(from, until);
  }
  // Exercise the installed segmentation and position comparison unchanged.
  // Only display-summary calculation (irrelevant to grouping) is supplied here.
  const TurnGroups = vm.runInNewContext(`${region('contract/group-tree')}\n${region('conversation-nodes/process-groups')}\nTurnGroups`, {
    brandString: value => value,
    processActivity: () => ({ counts: [], running: undefined, runningDetail: '' }),
  });
  function grouped(node) {
    const groups = new TurnGroups(1);
    groups.rebuild({
      readTurn: () => [node.key],
      readPosition: () => ({ previous: undefined, next: undefined }),
      readNode: key => key === node.key ? node : undefined,
      timeline: { turns: new Map([[1, { status: 'closed' }]]) },
    }, new Set([node.key]));
    return groups;
  }
  const [node] = fold([start(), call(2), result(3, receipt(), { format: 'flat' }), end()]);
  const visible = grouped(node);
  assert.equal(visible.snapshots().length, 0);
  assert.equal(visible.references(node.key)[0].kind, 'node');
  assert.equal(visible.references(node.key)[0].key, node.key);

  // Prove the fixture detects the original bug, even at the same end anchor.
  const { groupTree, ...unclassified } = node;
  const hidden = grouped(unclassified);
  assert.equal(hidden.snapshots().length, 1);
  assert.equal(hidden.references(node.key)[0].kind, 'group');
});

test('installed rc.3 assembler: replace, cold history, prepend, and live append agree', {
  skip: !process.env.DSH_CONVERSATION_CLIENT_BUNDLE,
}, async () => {
  // The installed browser bundle cannot be imported as a Node module. Evaluate
  // its unmodified, self-contained assembly regions; only its notification
  // helper is supplied here. No production code relies on these bundle markers.
  const source = await readFile(process.env.DSH_CONVERSATION_CLIENT_BUNDLE, 'utf8');
  const from = source.indexOf('//#region lib/types/client/contract/conversation.js');
  const until = source.indexOf('//#region lib/types/client/conversation/definition-registry.js', from);
  assert.ok(from >= 0 && until > from, 'expected the installed rc.3 assembly regions');
  const Assembler = vm.runInNewContext(`${source.slice(from, until)}\nConversationNodeAssembler`, {
    _deepseek_ai_dsh_client_store: { notifySubscribers(listeners) { for (const listener of listeners) listener(); } },
  });
  function assembler() {
    return new Assembler({ entries: () => [webAnswerDefinition], fallbackEntry() {} }, {
      entries: () => [{ target: 'chat', create() {
        let nodes = new Map();
        return {
          empty: [],
          replace(input) { nodes = new Map(input.nodes.map(node => [node.key, node])); return [...nodes.values()]; },
          apply(input) { for (const node of input.upserts) nodes.set(node.key, node); return [...nodes.values()]; },
        };
      } }],
    });
  }
  const wrap = input => ({ type: 'event', event: input });
  // A saved history can span an upgrade: the assembler must accept both
  // message layouts in the same replay and when newer results arrive live.
  const events = [start(), call(2), result(3, receipt(ANSWER_A)), call(4),
    result(5, receipt(ANSWER_B), { format: 'flat' }), call(6, 'update_answer'),
    result(7, receipt(ANSWER_A, 2), { format: 'flat' }),
    assistant(8, `Before\n\n${marker(ANSWER_A)}\n\nBetween\n\n${marker(ANSWER_B)}\n\nAfter`), end(9)];
  const complete = assembler();
  complete.replaceWindow(events.map(wrap), false);
  complete.activateTarget('chat');
  complete.flush();
  const [expected] = complete.snapshot('chat');
  assert.equal(expected.key, '10:web-answer1');
  assert.equal(expected.anchorSeq, 9);
  assert.equal(expected.groupTree, 'turn');
  assert.deepEqual(expected.data.views, [receipt(ANSWER_A, 2), receipt(ANSWER_B)]);
  assert.deepEqual(expected.data.inlineIds, [ANSWER_A, ANSWER_B]);
  assert.deepEqual(fallbackIds(expected), [], 'both distinct inline blocks survive without turn-end copies');
  assert.deepEqual(expected.location.turn.data.get('web-answer'), expected.data);

  const cold = assembler();
  cold.replaceWindow(events.slice(2).map(wrap), true);
  cold.activateTarget('chat');
  cold.flush();
  assert.deepEqual(cold.snapshot('chat')[0].data, expected.data);
  cold.prepend(events.slice(0, 2).map(wrap), false);
  cold.flush();
  assert.deepEqual(cold.snapshot('chat')[0].data, expected.data);
  assert.equal(cold.snapshot('chat')[0].key, expected.key);

  const live = assembler();
  live.replaceWindow([], false);
  live.activateTarget('chat');
  for (const input of events) { live.append(wrap(input)); live.flush(); }
  assert.deepEqual(live.snapshot('chat')[0].data, expected.data);
  assert.equal(live.snapshot('chat')[0].anchorSeq, expected.anchorSeq);
  assert.deepEqual(live.snapshot('chat')[0].location.turn.data.get('web-answer'), expected.data);

  const corrected = assembler();
  corrected.replaceWindow([result(3), end(4)].map(wrap), true);
  corrected.activateTarget('chat');
  corrected.flush();
  assert.equal(corrected.snapshot('chat')[0].visibility, 'visible');
  corrected.prepend([start(), call(2, 'read')].map(wrap), false);
  corrected.flush();
  assert.equal(corrected.snapshot('chat')[0].visibility, 'hidden');
  assert.deepEqual(corrected.snapshot('chat')[0].location.turn.data.get('web-answer').views, []);
});
