import { inlineAnswerIds } from './inline-reference.js';

function projectReply(event) {
  const content = event.data.message.content;
  if (content.some(block => block.type === 'tool-call')
    || !content.some(block => block.type === 'text' && inlineAnswerIds(block.text).length > 0)) return null;
  // Only public response content is repeated in this presentation seat. The
  // original assistant node still owns reasoning, timing and transcript data.
  const blocks = content.filter(block => block.type !== 'reasoning').map(block => {
    if (block.type === 'text') return { kind: 'text', text: block.text };
    if (block.type === 'image') return { kind: 'image', attachment: block.attachment };
    return { kind: 'other', block };
  });
  const { turn, step, interrupted } = event.data;
  const finalNode = { kind: 'assistant', seq: event.seq, time: event.time, turn, step, blocks,
    messageId: event.data.message.id, ...(interrupted ? { interrupted: true } : {}) };
  return { status: interrupted ? 'interrupted' : 'settled', turn, step, time: event.time, blocks, finalNode };
}

function updateReply(state, event) {
  if (event.type === 'llm/retry') return null;
  return event.type === 'assistant/message' ? projectReply(event) : state;
}

/** One stable, non-folding seat per settled reply that contains a marker.
 * The renderer additionally requires a same-turn successful receipt and an
 * active native bridge before displaying it or suppressing the original seat.
 */
export const webAnswerReplyDefinition = {
  kind: 'web-answer-reply',
  target: 'chat',
  match(event) {
    const { turn, step } = event?.data ?? {};
    if (!Number.isSafeInteger(turn) || turn < 0 || !Number.isSafeInteger(step) || step < 0) return null;
    const id = `${turn}:${step}`;
    if (event.type === 'step/start') return { id, role: 'start' };
    if (event.type === 'llm/retry' || (event.type === 'assistant/message' && event.surfaceOp === 'append'
      && event.data.message?.role === 'assistant' && Array.isArray(event.data.message.content))) return { id, role: 'update' };
    return null;
  },
  start() { return null; },
  update(context, match) { return updateReply(context.state, match.event); },
  buildViewNode(context) {
    let data = context.state;
    if (data === undefined) {
      data = null;
      for (const match of context.matches) data = updateReply(data, match.event);
    }
    const location = context.matches.at(-1)?.location ?? context.start?.location ?? { kind: 'unresolved' };
    if (data === null) {
      const current = context.current.get('chat');
      return current == null ? null : { ...current, location, visibility: 'hidden' };
    }
    return { key: context.key, kind: 'web-answer-reply', id: context.id, target: 'chat',
      anchorSeq: data.finalNode.seq, location, groupTree: 'turn', visibility: 'visible', data };
  },
};
