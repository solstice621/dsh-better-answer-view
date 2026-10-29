/**
 * Chat-node assembly for DSH 0.1.5-rc.3 and 0.2.1-rc.3.
 *
 * This version permits only one start match per Context. turn/start owns that
 * role; a history window without it is reconstructed from the loaded matches
 * in buildViewNode, just as the installed turn-process Definition does.
 */

import { inlineAnswerIds } from './inline-reference.js';

const ANSWER_TOOLS = new Set(['render_answer', 'update_answer']);

function isCoordinate(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

function readReceipt(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || value.kind !== 'web-answer'
    || typeof value.id !== 'string' || value.id.trim() === ''
    || !Number.isSafeInteger(value.revision) || value.revision < 1
    || typeof value.title !== 'string'
    || typeof value.summary !== 'string'
    || typeof value.sessionId !== 'string' || value.sessionId.trim() === '') return null;

  // Retain only the durable receipt, never arbitrary result fields or UI state.
  return {
    kind: 'web-answer',
    id: value.id,
    revision: value.revision,
    title: value.title,
    summary: value.summary,
    sessionId: value.sessionId,
  };
}

function resultReceipt(event) {
  if (event?.type !== 'tool/result' || event.data?.error !== undefined) return null;
  const message = event.data?.message;
  if (message?.source?.kind !== 'tool'
    || typeof message.source.callId !== 'string' || message.source.callId === ''
    || message.isError === true) return null;

  let content;
  if (message.role === 'tool') {
    // DSH 0.2.x stores tool output directly on the tool-role message.
    if (message.toolCallId !== message.source.callId) return null;
    content = message.content;
  } else {
    // DSH 0.1.x wraps output in a tool-result block on a user-role message.
    const block = message.content?.[0];
    if (block?.type !== 'tool-result' || block.isError === true
      || block.toolCallId !== message.source.callId) return null;
    content = block.content;
  }
  if (!Array.isArray(content)) return null;

  // Both releases persist output.presentationMeta as event.data.meta.
  const receipt = readReceipt(event.data.meta);
  if (receipt !== null) return receipt;
  const text = content.filter(part => part?.type === 'text'
    && typeof part.text === 'string').map(part => part.text).join('\n');
  try {
    return readReceipt(JSON.parse(text));
  } catch {
    return null;
  }
}

function emptyState(turn) {
  return { turn, callNames: new Map(), views: new Map(), assistantBlocks: new Map(), latestStep: undefined, resultSeq: undefined, endSeq: undefined };
}

function isAssistantUpdate(event) {
  if (!isCoordinate(event.data.step)) return false;
  if (event.type === 'assistant/message') {
    return event.surfaceOp === 'append' && event.data.message?.role === 'assistant'
      && Array.isArray(event.data.message.content);
  }
  if (event.type === 'llm/retry') return true;
  const chunk = event.data.chunk;
  return event.type === 'assistant/live-chunk' && isCoordinate(chunk?.index)
    && ['block-start', 'text-delta', 'reasoning-delta', 'tool-call-delta', 'block-end'].includes(chunk.type);
}

function referenceBlock(block) {
  // Keep only public text. Other kinds are needed solely to determine whether
  // the final step is a reply or another tool execution, never for references.
  return block?.type === 'text' && typeof block.text === 'string'
    ? { type: 'text', text: block.text } : { type: block?.type };
}

function updateAssistant(state, event) {
  const assistantBlocks = new Map(state.assistantBlocks);
  const step = event.data.step;
  if (event.type === 'llm/retry') assistantBlocks.delete(step);
  else if (event.type === 'assistant/message') {
    assistantBlocks.set(step, event.data.message.content.map(referenceBlock));
  } else {
    const blocks = [...(assistantBlocks.get(step) || [])];
    const chunk = event.data.chunk;
    if (chunk.type === 'block-start') blocks[chunk.index] = referenceBlock({ type: chunk.blockType, text: '' });
    else if (chunk.type === 'text-delta') {
      if (typeof chunk.text !== 'string') return state;
      const previous = blocks[chunk.index];
      blocks[chunk.index] = { type: 'text', text: (previous?.type === 'text' ? previous.text : '') + chunk.text };
    } else if (chunk.type === 'reasoning-delta' || chunk.type === 'tool-call-delta') {
      blocks[chunk.index] = { type: chunk.type === 'reasoning-delta' ? 'reasoning' : 'tool-call' };
    } else if (chunk.type === 'block-end') {
      blocks[chunk.index] = referenceBlock(chunk.block);
    }
    assistantBlocks.set(step, blocks);
  }
  return { ...state, assistantBlocks };
}

function projectedData(state) {
  const finalBlocks = state.assistantBlocks.get(state.latestStep) ?? [];
  // DSH's latestAnswer only promotes the last step, with reply content and no
  // tool call. A marker in an earlier step will be folded with the process.
  const finalStep = finalBlocks.some(block => block?.type === 'text' && block.text.trim() !== '')
    && !finalBlocks.some(block => block?.type === 'tool-call') ? state.latestStep : null;
  const inlineStep = state.endSeq === undefined ? undefined : finalStep;
  const inlineIds = new Set();
  for (const [step, blocks] of state.assistantBlocks) {
    if (inlineStep !== undefined && step !== inlineStep) continue;
    for (const block of blocks) {
      if (block?.type !== 'text') continue;
      for (const id of inlineAnswerIds(block.text)) if (state.views.has(id)) inlineIds.add(id);
    }
  }
  return { views: [...state.views.values()], inlineIds: [...inlineIds], inlineStep };
}

function sameData(left, right) {
  return left !== undefined && left.views.length === right.views.length
    && left.views.every((view, index) => view === right.views[index])
    && left.inlineStep === right.inlineStep
    && left.inlineIds.length === right.inlineIds.length
    && left.inlineIds.every((id, index) => id === right.inlineIds[index]);
}

function foldEvent(state, event) {
  if (event.data.turn !== state.turn) return state;
  if (isCoordinate(event.data.step) && (state.latestStep === undefined || event.data.step > state.latestStep)) {
    state = { ...state, latestStep: event.data.step };
  }
  if (event.type === 'tool/call') {
    const callNames = new Map(state.callNames);
    callNames.set(event.data.callId, event.data.name);
    return { ...state, callNames };
  }
  if (event.type === 'turn/end') return { ...state, endSeq: event.seq };
  if (isAssistantUpdate(event)) return updateAssistant(state, event);
  const receipt = resultReceipt(event);
  if (receipt === null) return state;
  const name = state.callNames.get(event.data.message.source.callId);
  // A result-only historical window has no tool name. Its explicitly branded,
  // validated receipt remains sufficient to restore the recorded answer.
  if (name !== undefined && !ANSWER_TOOLS.has(name)) return state;
  const previous = state.views.get(receipt.id);
  if (previous !== undefined && previous.revision > receipt.revision) return state;
  const views = new Map(state.views);
  views.set(receipt.id, receipt);
  return { ...state, views, resultSeq: event.seq };
}

function replayLoadedMatches(context) {
  let state = emptyState(Number(context.id));
  for (const match of context.matches) state = foldEvent(state, match.event);
  return state;
}

/** One renderer-ready node per Turn; node.data.views holds each latest receipt. */
export const webAnswerDefinition = {
  kind: 'web-answer',
  target: 'chat',
  match(event) {
    if (!isCoordinate(event?.data?.turn)) return null;
    const id = String(event.data.turn);
    if (event.type === 'turn/start') return { id, role: 'start' };
    if (event.type === 'turn/end') return { id, role: 'update' };
    if ((event.type === 'step/start' || event.type === 'step/end') && isCoordinate(event.data.step)) return { id, role: 'update' };
    if (event.type === 'tool/call'
      && typeof event.data.callId === 'string'
      && typeof event.data.name === 'string') return { id, role: 'update' };
    if (isAssistantUpdate(event)) return { id, role: 'update' };
    if (resultReceipt(event) !== null) return { id, role: 'update' };
    return null;
  },
  start(_context, match) {
    return emptyState(match.event.data.turn);
  },
  update(context, match) {
    return foldEvent(context.state, match.event);
  },
  publication(match) {
    return match?.event.type === 'assistant/live-chunk' ? 'animation-frame' : 'immediate';
  },
  buildLocationData(context, scope, previous) {
    if (scope !== 'turn') return null;
    const state = context.state ?? replayLoadedMatches(context);
    const value = projectedData(state);
    if (previous?.kind === 'turn' && previous.turn === state.turn && sameData(previous.value, value)) return previous;
    return { kind: 'turn', turn: state.turn, key: 'web-answer', value };
  },
  buildViewNode(context) {
    const state = context.state ?? replayLoadedMatches(context);
    const location = context.matches.at(-1)?.location
      ?? context.start?.location
      ?? { kind: 'unresolved' };
    if (state.views.size === 0) {
      const current = context.current.get('chat');
      // Older history can reveal that a receipt-looking result came from an
      // unrelated tool. rc.3 forbids withdrawing an already published Node.
      return current == null ? null : {
        ...current, location, visibility: 'hidden', data: projectedData(state),
      };
    }
    return {
      key: context.key,
      kind: 'web-answer',
      id: context.id,
      target: 'chat',
      // Compact Chat folds process nodes before the final answer boundary.
      // A completed web answer belongs at the durable Turn end instead.
      anchorSeq: state.endSeq ?? state.resultSeq,
      location,
      visibility: 'visible',
      // DSH 0.2.x groups unclassified custom nodes as execution details.
      // A delivered answer belongs to the Turn, outside collapsible processes.
      groupTree: 'turn',
      // The assistant wrapper resolves inline references from the same Turn's
      // complete receipt list. The standalone renderer filters inlineIds only.
      data: projectedData(state),
    };
  },
};

/** Register alongside the plugin's conversation.chat.node renderer. */
export function registerWebAnswerConversation(ctx) {
  return ctx.uiConversation.events.register(webAnswerDefinition);
}
