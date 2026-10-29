/**
 * Opt-in integration fixture for an isolated DSH profile. Never included in the
 * production patch. It records synthetic events and never invokes an LLM.
 * Mount this module only with DSH_WEB_ANSWER_SMOKE=1 and a dedicated DSH_HOME.
 */
import { readFile } from 'node:fs/promises';
import { join, isAbsolute } from 'node:path';
import { pathToFileURL } from 'node:url';

export const inject = ['tools', 'sessions', 'sessionPersistence', 'connection'];

export async function apply(ctx) {
  const packagePath = process.env.DSH_PACKAGE_PATH || (process.env.DSH_INSTALL ? join(process.env.DSH_INSTALL, 'lib/node_modules/@deepseek-ai/dsh') : '');
  if (process.env.DSH_WEB_ANSWER_SMOKE !== '1' || !isAbsolute(process.env.DSH_HOME ?? '') || !isAbsolute(packagePath)) {
    throw new Error('Smoke fixture requires DSH_WEB_ANSWER_SMOKE=1, an explicit absolute DSH_HOME, and DSH_PACKAGE_PATH or DSH_INSTALL.');
  }
  const llm = await import(pathToFileURL(join(packagePath, 'node_modules/@deepseek-ai/dsh-llm/lib/index.js')).href);
  const html = await readFile(new URL('../examples/leveling.html', import.meta.url), 'utf8');
  let seeded;
  let pending;
  const seed = async () => {
    if (seeded) return seeded;
    if (pending) return pending;
    pending = (async () => {
      const registered = ['render_answer', 'update_answer', 'get_answer'].map((name) => ctx.tools.get(name));
      if (registered.some((tool) => !tool)) throw new Error('Web answer tools are not registered.');
      const sessionId = `web-answer-smoke-${Date.now()}`;
      const session = ctx.sessions.prepare(sessionId, { meta: { cwd: process.env.DSH_HOME } });
      const args = { title: '交互回答 · DSH 集成验证', html, summary: '虚构数据演示：拖动经验奖励，保存状态，并准备追问。未调用任何真实模型。', initialState: { reward: 100 } };
      const callId = 'web-answer-smoke-call';
      const turn = 1, step = 1;
      session.append('turn/start', { turn });
      session.append('step/start', { turn, step });
      session.append('user/message', llm.createUserMessage({ source: { kind: 'user' }, content: [{ type: 'text', text: '展示网页式回答，测试交互与刷新后的状态恢复。（本会话为自动生成的测试数据。）' }] }), { surfaceOp: 'append' });
      session.append('assistant/message', {
        turn, step,
        message: llm.createAssistantMessage({ source: { provider: 'integration-fixture', model: 'no-model-called' }, content: [{ type: 'tool_call', id: callId, name: 'render_answer', arguments: JSON.stringify(args) }] }),
        stream: [],
      }, { surfaceOp: 'append' });
      session.append('tool/call', { turn, step, callId, name: 'render_answer', arguments: JSON.stringify(args) });
      const value = await registered[0].execute(args, { agent: { session }, callId, signal: new AbortController().signal });
      session.append('tool/result', {
        turn, step,
        message: llm.createToolResultMessage({ callId, content: registered[0].output.render(args, value), isError: false }),
        meta: registered[0].output.presentationMeta(args, value),
      }, { surfaceOp: 'append' });
      session.append('step/end', { turn, step });
      session.append('step/start', { turn, step: 2 });
      session.append('assistant/message', {
        turn, step: 2,
        message: llm.createAssistantMessage({ source: { provider: 'integration-fixture', model: 'no-model-called' }, content: [{ type: 'text', text: '交互页面已准备好。下面是测试用的示例页面。' }] }),
        stream: [],
      }, { surfaceOp: 'append' });
      session.append('step/end', { turn, step: 2 });
      session.append('turn/end', { turn, reason: { kind: 'completed' } });
      const handle = await ctx.sessionPersistence.create(session.header);
      try {
        await handle.append(session.snapshotEvents());
        await handle.flush();
      } finally {
        await handle.close();
      }
      seeded = { sessionId, receipt: value, events: session.seq, registered: registered.map((tool) => tool.name), modelCalls: 0 };
      return seeded;
    })();
    try { return await pending; } finally { pending = undefined; }
  };
  ctx.connection.fetch.register({
    path: '/api/web-answer-smoke',
    methods: ['GET', 'POST'],
    requestBody: 'buffered',
    async fetch(request) {
      try {
        if (request.method === 'POST') return Response.json(await seed());
        return Response.json({ registered: ['render_answer', 'update_answer', 'get_answer'].filter((name) => ctx.tools.get(name)), seeded, modelCalls: 0 });
      } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
      }
    },
  });
}
