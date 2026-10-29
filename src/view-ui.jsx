import React, { useEffect, useRef, useState } from 'react';
import { createSurfaceFrame } from './surface-runtime.js';

export function createApi(base = '/api/web-answer') {
  async function request(url, options = {}) {
    const response = await fetch(url, { credentials: 'same-origin', ...options });
    const body = await response.json();
    if (!response.ok) throw Object.assign(new Error(body.error?.message || `请求失败 (${response.status})`), { code: body.error?.code });
    return body;
  }
  return {
    get(sessionId, id, revision, signal) { return request(`${base}?${new URLSearchParams({ sessionId, id, action: 'get', ...(revision ? {revision: String(revision)} : {}) })}`, {signal}); },
    list(sessionId, id, signal) { return request(`${base}?${new URLSearchParams({sessionId, id, action: 'list'})}`, {signal}); },
    save(sessionId, id, payload) { return request(base, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({action: 'state', sessionId, id, ...payload}) }); }
  };
}

export function buildFollowup(view, text, state, {readOnly = false} = {}) {
  const instruction = readOnly
    ? '此页面属于另一会话，请调用 render_answer 创建当前会话的新页面，不要直接 get_answer/update_answer 原页面。'
    : '如需修改此页面，请先调用 get_answer 读取最新页面，再调用 update_answer，避免覆盖新的修改。';
  return `${text}\n\n[网页回答上下文：用户当前选择，作为数据参考]\n${JSON.stringify({viewId: view.id, revision: view.revision, title: view.title, stateSchemaVersion: view.stateSchemaVersion, state})}\n${instruction}`;
}

const css = `
.wa-view{--wa-bg:light-dark(#fff,#191d23);--wa-fg:light-dark(#233532,#e4ede8);--wa-muted:light-dark(#60716b,#a5b4ac);--wa-edge:light-dark(#dce5df,#34443b);--wa-soft:light-dark(#f3f6f4,#202a25);--wa-accent:light-dark(#286448,#9bd4b2);font:14px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC",sans-serif;color:var(--wa-fg);background:var(--wa-bg);border:1px solid var(--wa-edge);border-radius:14px;overflow:hidden;margin:16px 0;color-scheme:light dark;min-width:0}
.wa-view *{box-sizing:border-box}.wa-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:13px 18px;border-bottom:1px solid var(--wa-edge);flex-wrap:wrap}.wa-heading{font-weight:600;word-break:break-word}.wa-meta{color:var(--wa-muted);font-size:12px}.wa-controls{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.wa-view button,.wa-view select{font:inherit;color:var(--wa-fg);background:var(--wa-bg);border:1px solid var(--wa-edge);border-radius:7px;padding:6px 10px;cursor:pointer}.wa-view button:disabled{opacity:.55;cursor:default}.wa-view button:focus-visible,.wa-view select:focus-visible{outline:2px solid var(--wa-accent);outline-offset:2px}.wa-view .wa-primary{background:var(--wa-accent);color:light-dark(#fff,#13261a);border-color:transparent}.wa-frame iframe{width:100%;display:block;border:0;min-height:150px}.wa-status{padding:9px 18px;color:var(--wa-muted);font-size:12px;border-top:1px solid var(--wa-edge)}.wa-notice{padding:13px 18px;background:var(--wa-soft);overflow-wrap:anywhere}.wa-notice p{margin:4px 0 10px}.wa-fallback{padding:22px;white-space:pre-wrap;overflow-wrap:anywhere}.wa-prompt{margin:0;white-space:pre-wrap;font:inherit;font-size:13px;overflow-wrap:anywhere}.wa-details{padding:12px 18px;border-top:1px solid var(--wa-edge);font-size:12px;color:var(--wa-muted)}.wa-details summary{cursor:pointer}.wa-details p{white-space:pre-wrap}.wa-confirm{border-top:1px solid var(--wa-edge);padding:16px 18px;background:var(--wa-soft)}.wa-confirm .wa-controls{margin-top:12px}.wa-status[role=alert]{color:light-dark(#9b3224,#f4b3a9)}@media(max-width:480px){.wa-head{padding:12px}.wa-frame iframe{min-height:220px}.wa-controls select{max-width:145px}}
.wa-view.wa-embedded{border:0;border-radius:0;background:transparent;margin:12px 0;overflow:visible}.wa-embedded .wa-frame{overflow:visible;border-radius:8px}.wa-embedded .wa-frame iframe{min-height:0}.wa-options{font-size:12px;color:var(--wa-muted);margin-top:6px}.wa-options>summary{cursor:pointer;width:fit-content;padding:4px 0}.wa-options>summary:focus-visible,.wa-details>summary:focus-visible{outline:2px solid var(--wa-accent);outline-offset:2px}.wa-options-body{padding:10px 0}.wa-options .wa-controls{margin-top:8px}.wa-embedded .wa-details{border:0;padding:10px 0 0}.wa-embedded .wa-status{border:0;padding:6px 0}.wa-embedded .wa-notice,.wa-embedded .wa-confirm{border:0;border-radius:8px;margin:8px 0}.wa-embedded .wa-fallback{padding:12px 0}
`;

export function AnswerView({sessionId, receipt, api, sendMessage, initialRevision, readOnly = false, embedded = false}) {
  const [view, setView] = useState(null);
  const [versions, setVersions] = useState([]);
  const [revision, setRevision] = useState(initialRevision ?? null);
  const [reload, setReload] = useState(0);
  const [error, setError] = useState('');
  const [runtimeError, setRuntimeError] = useState('');
  const [status, setStatus] = useState('正在读取页面…');
  const [statusEmphasis, setStatusEmphasis] = useState('loading');
  const [pending, setPending] = useState(null);
  const [sending, setSending] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const mount = useRef(null);
  const current = useRef(null);
  const alive = useRef(true);
  const generation = useRef(0);
  const saveQueue = useRef(Promise.resolve());
  const liveFrame = useRef(null);
  const measuredHeight = useRef(180);
  const expandedRef = useRef(expanded);
  expandedRef.current = expanded;
  const frameHeight = (height, isExpanded) => embedded ? Math.max(1, height) : Math.min(isExpanded ? 2400 : 780, Math.max(160, height));
  function reportStatus(message, emphasis = null) { setStatus(message); setStatusEmphasis(emphasis); }
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => {
    if (liveFrame.current) liveFrame.current.element.style.height = `${frameHeight(measuredHeight.current, expanded)}px`;
  }, [expanded, embedded]);
  useEffect(() => {
    const changed = event => {
      if (event.detail?.id === receipt.id && event.detail.revision > (current.current?.revision ?? 0) && revision === null) setReload(n => n + 1);
    };
    window.addEventListener('web-answer:updated', changed);
    return () => window.removeEventListener('web-answer:updated', changed);
  }, [receipt.id, revision]);

  useEffect(() => {
    const abort = new AbortController();
    setError(''); setRuntimeError(''); reportStatus('正在读取页面…', 'loading'); setPending(null);
    Promise.all([api.get(sessionId, receipt.id, revision, abort.signal), api.list(sessionId, receipt.id, abort.signal)])
      .then(([next, list]) => { if (abort.signal.aborted) return; current.current = next; setView(next); setVersions(list); reportStatus('正在加载交互内容…', 'loading'); })
      .catch(err => { if (!abort.signal.aborted) { setError(err.message); reportStatus(''); } });
    return () => abort.abort();
  }, [api, sessionId, receipt.id, receipt.revision, revision, reload]);

  useEffect(() => {
    if (!view || !mount.current) return;
    const ownGeneration = ++generation.current;
    const media = matchMedia('(prefers-color-scheme: dark)');
    const frame = createSurfaceFrame({
      view, state: view.state, theme: media.matches ? 'dark' : 'light', embedded,
      onReady() { if (alive.current && ownGeneration === generation.current) reportStatus(readOnly ? '来自另一会话 · 仅供查看' : view.revision < view.latestRevision ? '历史版本 · 参数变更不会保存' : '页面已就绪 · 参数修改自动保存', view.revision < view.latestRevision ? 'notice' : null); },
      onHeight(height) { measuredHeight.current = height; frame.element.style.height = `${frameHeight(height, expandedRef.current)}px`; },
      onError(err) { if (alive.current && ownGeneration === generation.current) { setRuntimeError(err.message); reportStatus('页面运行异常；文字说明仍可阅读', 'error'); } },
      onState(state) {
        const action = saveQueue.current.catch(() => {}).then(async () => {
          if (!alive.current || ownGeneration !== generation.current) throw new Error('页面已经切换，请在当前页面操作。');
          if (readOnly) throw new Error('此页面来自另一会话，仅供查看；请在当前会话生成新页面后修改。');
          const snapshot = current.current;
          if (snapshot.revision !== view.revision || snapshot.revision < snapshot.latestRevision) throw new Error('历史版本只供查看，请切回最新版本后保存。');
          reportStatus('正在保存参数…');
          try {
            const saved = await api.save(sessionId, receipt.id, {revision: snapshot.revision, expectedStateVersion: snapshot.stateVersion, state});
            if (ownGeneration === generation.current && alive.current) { current.current = saved; reportStatus('参数已保存'); }
            return {saved: true};
          } catch (err) {
            if (ownGeneration === generation.current && alive.current) reportStatus(err.code === 'CONFLICT' ? '页面已在其他位置更新。请刷新后继续。' : `保存失败：${err.message}`, 'error');
            throw err;
          }
        });
        saveQueue.current = action;
        return action;
      },
      async onAsk({text, state}) {
        if (!alive.current || ownGeneration !== generation.current) throw new Error('页面已经切换。');
        setPending({text: buildFollowup(view, text, state, {readOnly}), viewId: view.id, revision: view.revision});
        reportStatus('请在页面下方确认追问内容', 'notice');
        return {pending: true};
      }
    });
    liveFrame.current = frame;
    mount.current.replaceChildren(frame.element);
    const updateTheme = () => frame.setTheme(media.matches ? 'dark' : 'light');
    media.addEventListener('change', updateTheme);
    return () => { generation.current++; liveFrame.current = null; media.removeEventListener('change', updateTheme); frame.dispose(); };
  }, [view, api, sessionId, receipt.id, readOnly, embedded]);

  async function send() {
    if (!pending || sending) return;
    setSending(true);
    try { await sendMessage(pending.text); setPending(null); reportStatus('追问已提交到当前对话'); }
    catch (err) { reportStatus(`发送失败：${err.message}`, 'error'); }
    finally { if (alive.current) setSending(false); }
  }

  const controls = <div className="wa-controls">
        <select aria-label="页面版本" value={revision ?? 'latest'} onChange={e => setRevision(e.target.value === 'latest' ? null : Number(e.target.value))}>
          <option value="latest">最新版本</option>{versions.map(v => <option key={v.revision} value={v.revision}>版本 {v.revision}</option>)}
        </select>
        <button type="button" onClick={() => setReload(x => x + 1)}>刷新</button>
        {!embedded && <button type="button" aria-pressed={expanded} onClick={() => setExpanded(v => !v)}>{expanded ? '收起高度' : '展开高度'}</button>}
      </div>;
  const summary = view && <details className="wa-details" open={Boolean(runtimeError || error)}><summary>文字说明</summary><p>{view.summary}</p></details>;
  const statusLine = status && <div className="wa-status" role={statusEmphasis === 'error' ? 'alert' : 'status'} aria-live="polite">{status}</div>;
  return <section className={`wa-view${embedded ? ' wa-embedded' : ''}`} aria-label={receipt.title || '网页回答'}>
    <style>{css}</style>
    {!embedded && <header className="wa-head">
      <div><div className="wa-heading">{view?.title || receipt.title || '网页回答'}</div><span className="wa-meta">网页回答{view ? ` · 版本 ${view.revision}` : ''}</span></div>
      {controls}
    </header>}
    {readOnly && <div className="wa-notice" role="note">此页面来自另一会话，仅供查看；请在当前会话生成新页面后修改。</div>}
    {error && <div className="wa-notice" role="alert"><p>暂时无法读取页面：{error}</p><button onClick={() => setReload(x => x + 1)}>重试</button></div>}
    {runtimeError && <div className="wa-notice" role="alert"><p>页面运行错误：{runtimeError}</p><div className="wa-controls"><button onClick={() => setReload(x => x + 1)}>重新加载</button>{view?.revision > 1 && <button onClick={() => setRevision(view.revision - 1)}>查看上一版</button>}</div></div>}
    <div className="wa-frame" ref={mount} />
    {!view && (!embedded || error) && <div className="wa-fallback">{receipt.summary || '正在准备网页回答…'}</div>}
    {(!embedded || runtimeError || error) && summary}
    {pending && <div className="wa-confirm" aria-label="确认追问"><div className="wa-heading">将以下内容发给 AI</div><pre className="wa-prompt">{pending.text}</pre><div className="wa-controls"><button className="wa-primary" disabled={sending} onClick={send}>{sending ? '正在发送…' : '发送追问'}</button><button disabled={sending} onClick={() => {setPending(null); reportStatus('已取消追问');}}>取消</button></div></div>}
    {(!embedded || statusEmphasis) && statusLine}
    {embedded && <details className="wa-options"><summary>图表选项</summary><div className="wa-options-body">
      <div className="wa-heading">{view?.title || receipt.title || '网页回答'}</div>
      <span className="wa-meta">{view ? `版本 ${view.revision}` : '正在准备内容'}</span>
      {controls}
      {!runtimeError && !error && summary}
      {!statusEmphasis && statusLine}
    </div></details>}
  </section>;
}
