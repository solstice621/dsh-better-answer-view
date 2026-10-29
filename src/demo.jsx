import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { AnswerView, createApi } from './view-ui.jsx';
const api = createApi();
function Demo() {
  const [receipt, setReceipt] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function seed(action = 'seed') {
    setBusy(true); setError('');
    try {
      const result = await fetch('/demo/' + action, {method:'POST'});
      const data = await result.json();
      if (!result.ok) throw new Error(data.error?.message || '操作失败');
      setReceipt(data);
    } catch(err) {setError(err.message);} finally {setBusy(false);}
  }
  useEffect(() => { seed(); }, []);
  return <main className="demo-shell">
    <header className="demo-header"><div><div className="demo-eyebrow">WEB ANSWER / 开发版</div><h1>让回答成为可以探索的页面。</h1><p>已实现页面运行、参数保存、版本更新和追问准备。</p></div><span className="demo-label">本地交互演示 · 未连接模型</span></header>
    <div className="demo-layout"><aside><h2>试试这条流程</h2><ol><li>拖动奖励，选一个阶段。</li><li>刷新浏览器，查看参数恢复。</li><li>更新方案，回看旧版本。</li><li>点击讨论，检查发送给 AI 的内容。</li></ol><button disabled={busy || !receipt} onClick={() => seed('update')}>{busy ? '处理中…' : '将后期需求降低 30%'}</button><p className="demo-note">更新会保留参数并创建新版本。此按钮仅使用演示数据。</p>{error && <p role="alert">{error}</p>}</aside>
    <div>{receipt && <AnswerView sessionId={receipt.sessionId} receipt={receipt} api={api} sendMessage={async text => {setMessage(text);}} />}{message && <section className="demo-message"><h2>已捕获追问</h2><p>本地演示没有调用模型。DSH 插件会把这段内容发到同一会话。</p><pre>{message}</pre></section>}</div></div>
  </main>;
}
createRoot(document.getElementById('root')).render(<Demo />);
