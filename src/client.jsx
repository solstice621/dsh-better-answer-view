import React, { useEffect, useRef, useSyncExternalStore } from 'react';
import { AnswerView, createApi } from './view-ui.jsx';
import { webAnswerDefinition } from './conversation.js';
import { parseInlineReferences } from './inline-reference.js';
import { registerNativeSlotBridge } from './native-slot-bridge.js';

const api = createApi();
const EMPTY_VIEWS = [];
let inlineReady = false;
const inlineReadyListeners = new Set();
const readInlineReady = () => inlineReady;
const subscribeInlineReady = listener => { inlineReadyListeners.add(listener); return () => inlineReadyListeners.delete(listener); };
function setInlineReady(ready) {
  if (inlineReady === ready) return;
  inlineReady = ready;
  for (const listener of inlineReadyListeners) listener();
}

function partsForBlocks(blocks, streaming) {
  const parts = [];
  let native = [];
  const flush = () => {
    if (native.length) parts.push({kind: 'native', blocks: native});
    native = [];
  };
  for (const block of blocks) {
    if (block.kind !== 'text') { native.push(block); continue; }
    for (const part of parseInlineReferences(block.text, {streaming})) {
      if (part.kind === 'text') native.push({...block, text: part.text});
      else { flush(); parts.push(part); }
    }
  }
  flush();
  return parts;
}

function inlineDecorator(ctx) {
  return NativeAssistant => function InlineAssistant(props) {
    const {node, sessionId, groupPart, useTurnData} = props;
    const turnAnswers = useTurnData('web-answer');
    const receipts = turnAnswers?.views || EMPTY_VIEWS;
    const parts = partsForBlocks(node.data.blocks, node.data.status === 'running');
    // Unmarked answers, reasoning-only seats, and ordinary code examples retain
    // the native renderer intact, with no replacement of historical content.
    if (groupPart === 'reasoning' || !parts.some(part => part.kind !== 'native')) return <NativeAssistant {...props} />;
    if (turnAnswers?.inlineStep !== undefined && node.data.step !== turnAnswers.inlineStep) {
      // Completed intermediate steps may be folded by DSH. Their diagrams are
      // delivered by the final-answer/fallback seat, not hidden in the process.
      const blocks = node.data.blocks.map(block => block.kind !== 'text' ? block : {
        ...block,
        text: parseInlineReferences(block.text).map(part => part.kind === 'text' ? part.text
          : receipts.some(view => view.id === part.id) ? '（图文内容见本轮回答。）\n'
          : `:::web-answer ${part.id}\n:::\n`).join(''),
      });
      return <NativeAssistant {...props} node={{...node, data: {...node.data, blocks}}} />;
    }
    const sendMessage = text => ctx.sessions.scope(sessionId).conversation.send(text);
    return <div data-web-answer-inline="true" style={{display: 'flex', flexDirection: 'column', gap: 16}}>
      {parts.map((part, index) => {
        if (part.kind === 'native') {
          const segmentNode = {...node, data: {...node.data, blocks: part.blocks,
            // The interruption notice belongs to the final displayed segment.
            ...(node.data.status === 'interrupted' && index !== parts.length - 1 ? {status: 'settled'} : {}),
          }};
          return <NativeAssistant key={`text:${index}`} {...props} node={segmentNode} />;
        }
        if (part.kind === 'pending') return <div key={`pending:${index}`} role="status" style={{fontSize: 13, opacity: 0.65}}>正在准备图文内容…</div>;
        const receipt = receipts.find(view => view.id === part.id);
        // Only successful, session-bound tool receipts authorize an embed.
        if (!receipt) return <div key={`missing:${index}`} role="status" style={{fontSize: 13}}>这处图文内容暂不可用（{part.id}）。</div>;
        return <AnswerView key={`answer:${part.id}:${index}`} embedded sessionId={receipt.sessionId}
          readOnly={Boolean(sessionId && receipt.sessionId !== sessionId)} receipt={receipt} api={api} sendMessage={sendMessage} />;
      })}
    </div>;
  };
}

function registerInlineAssistant(ctx) {
  return ctx.slots.inject('conversation.chat.node', () => {
    let activeBase;
    let stopBridge;
    let stopped = false;
    const reconcile = () => {
      if (stopped) return;
      const candidates = ctx.slots.entries('conversation.chat.node').filter(entry =>
        entry.options.key === 'assistant-step' && entry.registrant !== 'dsh-better-answer-view');
      const base = candidates.find(entry => entry.registrant === '@deepseek-ai/dsh-client-ui-chat')
        || candidates.find(entry => (entry.options.priority ?? 0) >= 0);
      if (base === activeBase) return;
      const previousBridge = stopBridge;
      stopBridge = undefined;
      // Slot disposal can notify subscribers synchronously. Publish the new
      // selection before releasing the old bridge to avoid reentrant teardown.
      activeBase = base;
      setInlineReady(false);
      previousBridge?.();
      if (base) {
        try {
          stopBridge = registerNativeSlotBridge(ctx, base, inlineDecorator(ctx));
          setInlineReady(true);
        } catch (error) {
          console.warn('[dsh-better-answer-view] Inline renderer unavailable; keeping answer blocks at the end of the turn.', error);
        }
      }
    };
    reconcile();
    const unsubscribe = ctx.slots.subscribe('conversation.chat.node', reconcile);
    return () => { stopped = true; unsubscribe(); stopBridge?.(); setInlineReady(false); };
  });
}

function isReceipt(value) {
  return value?.kind === 'web-answer'
    && typeof value.id === 'string' && value.id.trim() !== ''
    && Number.isSafeInteger(value.revision) && value.revision > 0
    && typeof value.title === 'string' && typeof value.summary === 'string'
    && typeof value.sessionId === 'string' && value.sessionId.trim() !== '';
}

function resultText(block) {
  return Array.isArray(block?.content)
    ? block.content.filter(part => part?.type === 'text' && typeof part.text === 'string').map(part => part.text).join('\n')
    : '';
}

function hasReceipt(block) {
  if (isReceipt(block.meta)) return true;
  try { return isReceipt(JSON.parse(resultText(block))); }
  catch { return false; }
}

function ToolReceipt({block, toolName, inspect}) {
  // Both supported versions provide block; desktop 0.2.1 also supplies phase.
  const settled = block?.kind === 'tool-result';
  const stopped = settled && block.error?.code === 'interrupted';
  const failed = settled && (block.isError === true || block.error !== undefined);
  const complete = settled && !failed && hasReceipt(block);
  const operation = toolName === 'update_answer' ? '更新' : '生成';
  const message = !settled ? `正在${operation}网页回答…`
    : stopped ? `网页回答${operation}已停止。`
    : failed ? `网页回答${operation}失败。`
    : complete ? '图文内容已保存，将嵌入回答的相应位置。'
    : '调用已结束，但没有收到可展示的网页回执。';
  const showDetails = settled && !complete;
  const details = showDetails ? resultText(block).slice(0, 8000) : '';
  return <div style={{padding: '8px 12px', fontSize: 13}}>
    <div>{message}</div>
    {showDetails && details && <details style={{marginTop: 6}}><summary>查看结果详情</summary><pre style={{whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', font: 'inherit'}}>{details}</pre></details>}
    {showDetails && inspect && <button type="button" onClick={inspect} style={{marginTop: 6}}>查看工具详情</button>}
  </div>;
}

export const inject = ['slots', 'uiConversation', 'sessions', 'conversation'];
export function apply(ctx) {
  ctx.uiConversation.events.register(webAnswerDefinition);
  registerInlineAssistant(ctx);
  ctx.slots.inject('conversation.chat.node', () => ctx.slots.register({
    name: 'conversation.chat.node', key: 'web-answer',
    inject: sessionId => ({sendMessage: text => ctx.sessions.scope(sessionId).conversation.send(text)})
  }, function WebAnswerNode({node, sessionId, sendMessage}) {
    const canEmbedInline = useSyncExternalStore(subscribeInlineReady, readInlineReady, readInlineReady);
    const notified = useRef(new Map());
    const allViews = node?.visibility === 'hidden' ? EMPTY_VIEWS : node?.data?.views || EMPTY_VIEWS;
    const inlineIds = node?.data?.inlineIds || [];
    const views = canEmbedInline ? allViews.filter(view => !inlineIds.includes(view.id)) : allViews;
    useEffect(() => {
      for (const view of allViews) {
        const key = `${view.sessionId}:${view.id}`;
        if ((notified.current.get(key) ?? 0) >= view.revision) continue;
        notified.current.set(key, view.revision);
        window.dispatchEvent(new CustomEvent('web-answer:updated', {detail: {id: view.id, revision: view.revision}}));
      }
    }, [allViews]);
    if (views.length === 0) return null;
    // Receipts retain their storage Session when inherited by another chat;
    // sendMessage remains bound to the currently displayed Session above.
    return <div>{views.map(receipt => <AnswerView embedded key={`${receipt.sessionId}:${receipt.id}`} sessionId={receipt.sessionId || sessionId} readOnly={Boolean(sessionId && receipt.sessionId && sessionId !== receipt.sessionId)} receipt={receipt} api={api} sendMessage={sendMessage} />)}</div>;
  }));
  for (const tool of ['render_answer', 'update_answer']) {
    ctx.slots.inject('tool.call.toolview', () => ctx.slots.register({name: 'tool.call.toolview', key: tool}, ToolReceipt));
  }
}
