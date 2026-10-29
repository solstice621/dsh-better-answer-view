import assert from 'node:assert/strict';
import { SURFACE_LIMITS } from '../src/surface-runtime.js';

const classes = ['card', 'answer-block', 'answer-note', 'answer-metric', 'answer-decision'];
const tags = ['em', 'strong', 'span', 'small', 'div'];
const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

function rows(count, prefix = 'static') {
  return Array.from({ length: count }, (_, index) => {
    const tag = tags[index % tags.length];
    const name = classes[Math.floor(index / tags.length) % classes.length];
    return `<section data-stress-row="${prefix}-${index}"><b data-before>before ${index}</b><br><${tag} data-surface class="${name}">Visible content ${index}: A long value / +12.5%.</${tag}><br><b data-after>after ${index}</b></section>`;
  }).join('');
}

async function dimensions(frame) {
  return frame.evaluate(() => ({
    width: innerWidth,
    height: innerHeight,
    bottom: document.body.getBoundingClientRect().bottom,
    scrollWidth: document.documentElement.scrollWidth,
  }));
}

async function settle(frame, label) {
  const deadline = Date.now() + 20000;
  let last = '', stable = 0;
  while (Date.now() < deadline) {
    const size = await dimensions(frame);
    const signature = JSON.stringify(size);
    stable = signature === last && size.bottom <= size.height + 1 ? stable + 1 : 0;
    if (stable >= 4) return size;
    last = signature;
    await delay(45);
  }
  throw new Error(`${label}: dimensions did not converge within 20 seconds; ${JSON.stringify(await dimensions(frame))}`);
}

async function assertRows(frame, count, label) {
  const size = await settle(frame, label);
  const result = await frame.evaluate(() => {
    const root = document.getElementById('answer-content').getBoundingClientRect();
    const groups = [...document.querySelectorAll('[data-stress-row]')];
    const bad = [];
    const inside = (outer, inner) => inner.left >= outer.left - 1 && inner.right <= outer.right + 1 && inner.top >= outer.top - 1 && inner.bottom <= outer.bottom + 1;
    for (const group of groups) {
      const surface = group.querySelector('[data-surface]');
      const box = surface.getBoundingClientRect();
      const before = group.querySelector('[data-before]').getBoundingClientRect();
      const after = group.querySelector('[data-after]').getBoundingClientRect();
      const range = document.createRange();
      range.selectNodeContents(surface);
      const reasons = [];
      if (before.bottom > box.top + 1) reasons.push('covers preceding text');
      if (box.bottom > after.top + 1) reasons.push('covers following text');
      if (!inside(root, box)) reasons.push('escapes root');
      if (![...range.getClientRects()].every(rect => inside(box, rect))) reasons.push('text escapes surface');
      if (reasons.length) bad.push({ name: group.dataset.stressRow, reasons });
    }
    return { count: groups.length, failures: bad.length, examples: bad.slice(0, 6) };
  });
  assert.equal(result.count, count, `${label}: all generated rows survive parsing`);
  assert.equal(result.failures, 0, `${label}: ${result.failures} broken surfaces; ${JSON.stringify(result.examples)}`);
  assert.ok(size.scrollWidth <= size.width + 1, `${label}: horizontal overflow ${JSON.stringify(size)}`);
  assert.ok(size.bottom <= size.height + 1, `${label}: content cut off at iframe bottom ${JSON.stringify(size)}`);
  return size;
}

async function assertIdle(frame, page, label) {
  await settle(frame, label);
  // Start AFTER the normalization and ResizeObserver work, so the observable
  // budget catches continued repair loops rather than legitimate first writes.
  await delay(250);
  await frame.evaluate(() => {
    const observation = { styles: 0, all: 0, heights: [innerHeight] };
    observation.observer = new MutationObserver(records => {
      observation.all += records.length;
      observation.styles += records.filter(record => record.type === 'attributes' && record.attributeName === 'style').length;
    });
    observation.observer.observe(document.getElementById('answer-content'), { subtree: true, attributes: true, childList: true, characterData: true });
    observation.timer = setInterval(() => observation.heights.push(innerHeight), 35);
    window.__componentStressObservation = observation;
  });
  await page.evaluate(() => {
    const observation = { heights: 0 };
    observation.observer = new MutationObserver(records => { observation.heights += records.length; });
    observation.observer.observe(document.querySelector('iframe'), { attributes: true, attributeFilter: ['style'] });
    window.__componentStressHostObservation = observation;
  });
  await delay(450);
  const observation = await frame.evaluate(() => {
    const current = window.__componentStressObservation;
    current.observer.disconnect(); clearInterval(current.timer);
    const result = { styles: current.styles, all: current.all, heights: current.heights };
    delete window.__componentStressObservation;
    return result;
  });
  const host = await page.evaluate(() => {
    const current = window.__componentStressHostObservation;
    current.observer.disconnect(); delete window.__componentStressHostObservation;
    return { heights: current.heights };
  });
  assert.ok(observation.styles <= 2 && observation.all <= 2, `${label}: idle repair mutations must stop, ${JSON.stringify(observation)}`);
  assert.ok(host.heights <= 2, `${label}: host must not continually rewrite iframe height, ${JSON.stringify(host)}`);
  assert.ok(Math.max(...observation.heights) - Math.min(...observation.heights) <= 1, `${label}: idle iframe height oscillates, ${JSON.stringify(observation.heights)}`);
}

/** Volume and convergence checks through the real AnswerView and opaque iframe. */
export async function runComponentStressBrowserTests({ page, show }) {
  const failures = [];
  let passed = 0;
  const run = async (name, check) => {
    if (process.env.COMPONENT_STRESS_CASE && !name.includes(process.env.COMPONENT_STRESS_CASE)) return;
    const started = Date.now();
    try { await check(); passed++; console.log(`PASS: component stress — ${name} (${Date.now() - started}ms)`); }
    catch (error) { failures.push({ name, message: error.message }); console.error(`FAIL: component stress — ${name}: ${error.message}`); }
  };

  await run('7000 compact surfaces become ready within 8 seconds', async () => {
    // A dense document is substantially more expensive than the 1100-row
    // fixture despite using fewer bytes. Do not add per-node test attributes:
    // keep the production-valid density which exposed quadratic layout work.
    const html = `<div id="dense-surfaces">${'<span class="card">hello</span>'.repeat(7000)}</div><p id="tail">After 7000 cards.</p>`;
    const bytes = Buffer.byteLength(html, 'utf8');
    assert.ok(bytes <= SURFACE_LIMITS.html, `dense fixture remains a supported payload: ${bytes} bytes`);
    const started = Date.now();
    const frame = await show(html, 1100);
    const readyMs = Date.now() - started;
    console.log(`INFO: component stress — 7000 cards / ${bytes} bytes ready in ${readyMs}ms`);
    assert.ok(readyMs < 8000, `dense answers must become ready below the host's 10-second timeout; observed ${readyMs}ms, budget 8000ms`);
    const size = await settle(frame, 'dense/7000');
    const geometry = await frame.evaluate(() => {
      const root = document.getElementById('answer-content').getBoundingClientRect();
      const nodes = [...document.querySelectorAll('#dense-surfaces > .card')];
      const bad = [], samples = [];
      const inside = (outer, inner) => inner.left >= outer.left - 1 && inner.right <= outer.right + 1 && inner.top >= outer.top - 1 && inner.bottom <= outer.bottom + 1;
      let previous = null;
      for (let index = 0; index < nodes.length; index++) {
        const box = nodes[index].getBoundingClientRect();
        const range = document.createRange(); range.selectNodeContents(nodes[index]);
        const reasons = [];
        if (box.width <= 0 || box.height <= 0 || !inside(root, box)) reasons.push('box is empty or escapes root');
        if (![...range.getClientRects()].every(rect => inside(box, rect))) reasons.push('text escapes card');
        if (previous && Math.min(previous.right, box.right) - Math.max(previous.left, box.left) > 1 && Math.min(previous.bottom, box.bottom) - Math.max(previous.top, box.top) > 1) reasons.push('overlaps preceding card');
        if (reasons.length) bad.push({ index, reasons });
        if (index === 0 || index === 3500 || index === 6999) samples.push({ index, text: nodes[index].textContent, top: box.top, bottom: box.bottom });
        previous = box;
      }
      return { count: nodes.length, failures: bad.length, examples: bad.slice(0, 6), samples, tail: document.getElementById('tail').getBoundingClientRect().bottom };
    });
    assert.equal(geometry.count, 7000, 'all 7000 dense cards survive parsing');
    assert.equal(geometry.failures, 0, `dense geometry: ${geometry.failures} invalid cards; ${JSON.stringify(geometry.examples)}`);
    assert.deepEqual(geometry.samples.map(sample => sample.text), ['hello', 'hello', 'hello'], 'first, middle and last card retain their content');
    assert.ok(size.scrollWidth <= size.width + 1 && geometry.tail <= size.height + 1, `dense content must fit horizontally and reach its final line: ${JSON.stringify({ size, samples: geometry.samples, tail: geometry.tail })}`);
    await assertIdle(frame, page, 'dense/7000');
  });

  await run('exact 256 KiB payload and 1100 mixed surfaces', async () => {
    const prefix = `<style>[data-stress-row]{margin:5px 0}</style>${rows(1100)}<p id="payload-tail">`;
    const suffix = '</p><p id="tail">The final line remains visible.</p>';
    const available = SURFACE_LIMITS.html - Buffer.byteLength(prefix + suffix, 'utf8');
    assert.ok(available > 0, 'volume fixture must fit inside the supported HTML limit');
    // Fill with rendered text, not comments: both DOM volume and layout cost
    // are exercised at the exact accepted byte boundary.
    const fill = 'Readable payload text. '.repeat(Math.ceil(available / 23)).slice(0, available);
    const html = prefix + fill + suffix;
    assert.equal(Buffer.byteLength(html, 'utf8'), SURFACE_LIMITS.html);
    const started = Date.now();
    const frame = await show(html, 1100);
    const original = await assertRows(frame, 1100, 'limit/desktop');
    assert.ok(Date.now() - started < 20000, 'maximum supported payload must render and settle within a generous 20-second budget');
    assert.ok(original.height > 20000, 'test must exercise a genuinely long answer, well beyond the former height cap');
    await assertIdle(frame, page, 'limit/desktop');
    await page.setViewportSize({ width: 320, height: 900 });
    await assertRows(frame, 1100, 'limit/mobile');
    await assertIdle(frame, page, 'limit/mobile');
    await page.setViewportSize({ width: 1100, height: 900 });
    const restored = await assertRows(frame, 1100, 'limit/desktop restored');
    assert.ok(Math.abs(restored.height - original.height) <= 1, `large document returns to its original height: ${restored.height}/${original.height}`);
    assert.ok(await frame.locator('#tail').evaluate(node => node.getBoundingClientRect().bottom <= innerHeight + 1), 'final line in maximum-size answer is visible');
  });

  await run('24 nested surfaces survive repeated narrow and wide reflow', async () => {
    let content = '<span id="deep-text">Deep nested content 中英文混排 ' + 'content '.repeat(30) + '</span>';
    for (let level = 23; level >= 0; level--) {
      const tag = level % 2 ? 'em' : 'div';
      content = `<${tag} data-deep="${level}" class="${classes[level % classes.length]}" style="padding:3px;border-width:1px;margin:0;${level % 3 === 0 ? 'display:inline!important;' : ''}">${content}</${tag}>`;
    }
    const frame = await show(content + '<p id="tail">After all nesting.</p>', 1100);
    const original = await settle(frame, 'deep/initial');
    for (const width of [263, 390, 1100, 263, 1100]) {
      await page.setViewportSize({ width, height: 900 });
      await settle(frame, `deep/${width}`);
      const geometry = await frame.evaluate(() => {
        const containers = [...document.querySelectorAll('[data-deep]')];
        const inside = (outer, inner) => inner.left >= outer.left - 1 && inner.right <= outer.right + 1 && inner.top >= outer.top - 1 && inner.bottom <= outer.bottom + 1;
        const escaped = containers.filter(node => !inside(node.getBoundingClientRect(), node.firstElementChild.getBoundingClientRect())).map(node => node.dataset.deep);
        const range = document.createRange(); range.selectNodeContents(document.getElementById('deep-text'));
        const leaf = containers.at(-1).getBoundingClientRect();
        return { count: containers.length, escaped, textFits: [...range.getClientRects()].every(rect => inside(leaf, rect)), scrollWidth: document.documentElement.scrollWidth, width: innerWidth, height: innerHeight, tail: document.getElementById('tail').getBoundingClientRect().bottom };
      });
      assert.equal(geometry.count, 24, 'all nesting levels survive parsing');
      assert.deepEqual(geometry.escaped, [], `nested boxes must contain their children at ${width}px`);
      assert.ok(geometry.textFits, `deepest text remains inside its surface at ${width}px`);
      assert.ok(geometry.scrollWidth <= geometry.width + 1 && geometry.tail <= geometry.height + 1, `deep nesting cannot escape the answer at ${width}px: ${JSON.stringify(geometry)}`);
      await assertIdle(frame, page, `deep/${width}`);
    }
    assert.ok(Math.abs((await dimensions(frame)).height - original.height) <= 1, 'nested layout restores after repeated widening');
  });

  await run('dynamic 1000-node batches preserve editing and saved state', async () => {
    const html = `<label>Draft<textarea id="draft">initial draft</textarea></label><label>Amount<input id="amount" value="7" type="number"></label><div id="batches"></div><p id="tail">End of live content.</p><script>
      window.stressEditor=document.getElementById('draft');
      document.getElementById('amount').onchange=event=>window.answer.setState({amount:Number(event.target.value)});
    </script>`;
    const frame = await show(html, 390);
    await frame.locator('#draft').fill('Edited text must survive every repair. 中英文🙂');
    await frame.locator('#amount').fill('23');
    await frame.locator('#amount').dispatchEvent('change');
    await settle(frame, 'batches/initial');
    const initial = await dimensions(frame);
    let previousCount = 0;
    for (const count of [250, 1000, 125, 1000, 0]) {
      await frame.locator('#draft').focus();
      await frame.locator('#draft').evaluate(node => node.setSelectionRange(3, 12));
      await frame.evaluate(({ target, content }) => {
        const container = document.getElementById('batches');
        while (container.childElementCount > target) container.lastElementChild.remove();
        if (content) {
          const template = document.createElement('template'); template.innerHTML = content;
          container.append(template.content);
        }
      }, { target: count, content: rows(Math.max(0, count - previousCount), `batch-${count}`) });
      previousCount = count;
      await assertRows(frame, count, `batch/${count}`);
      const interaction = await frame.evaluate(() => ({
        sameNode: document.getElementById('draft') === window.stressEditor,
        focused: document.activeElement === window.stressEditor,
        value: window.stressEditor.value,
        selection: [window.stressEditor.selectionStart, window.stressEditor.selectionEnd],
        amount: document.getElementById('amount').value,
        state: window.answer.getState(),
      }));
      assert.equal(interaction.sameNode, true, 'normalization does not replace editable nodes');
      assert.equal(interaction.focused, true, 'batch repair preserves focus');
      assert.equal(interaction.value, 'Edited text must survive every repair. 中英文🙂');
      assert.deepEqual(interaction.selection, [3, 12], 'batch repair preserves selection');
      assert.equal(interaction.amount, '23');
      assert.equal(interaction.state.amount, 23, 'batch repair preserves bridge state');
      await assertIdle(frame, page, `batch/${count}`);
    }
    assert.ok(Math.abs((await dimensions(frame)).height - initial.height) <= 1, 'removing a large batch returns the iframe to its original height');
    assert.equal(await page.evaluate(() => window.layoutSaved.amount), 23, 'host retains the saved interactive value');
  });

  await run('long paragraphs repeatedly expand and return to authored height', async () => {
    const html = '<article class="card" id="long-card" style="height:180px;max-height:240px;overflow:hidden"><p id="long-text">Short content.</p></article><p id="tail">After the long card.</p>';
    const frame = await show(html, 390);
    const original = await settle(frame, 'paragraph/initial');
    for (let iteration = 0; iteration < 3; iteration++) {
      await frame.locator('#long-text').evaluate((node, round) => { node.textContent = (`Long paragraph ${round} 中英文 readable content. `).repeat(450); }, iteration);
      const expanded = await settle(frame, `paragraph/long/${iteration}`);
      assert.ok(expanded.height > 6000, `long paragraph must grow well beyond 2400px: ${expanded.height}`);
      const geometry = await frame.evaluate(() => {
        const card = document.getElementById('long-card').getBoundingClientRect();
        const range = document.createRange(); range.selectNodeContents(document.getElementById('long-text'));
        const text = range.getBoundingClientRect();
        const tail = document.getElementById('tail').getBoundingClientRect();
        return { contained: text.bottom <= card.bottom + 1 && text.right <= card.right + 1 && text.left >= card.left - 1, after: tail.top >= card.bottom - 1, tailVisible: tail.bottom <= innerHeight + 1 };
      });
      assert.deepEqual(geometry, { contained: true, after: true, tailVisible: true }, 'large paragraphs cannot be clipped or cover following content');
      await assertIdle(frame, page, `paragraph/long/${iteration}`);
      await frame.locator('#long-text').evaluate(node => { node.textContent = 'Short content.'; });
      const restored = await settle(frame, `paragraph/short/${iteration}`);
      assert.ok(Math.abs(restored.height - original.height) <= 1, `short content restores authored height after repair: ${restored.height}/${original.height}`);
      assert.equal(await frame.locator('#long-card').evaluate(node => node.getBoundingClientRect().height), 180, 'authored short-card height is restored');
      await assertIdle(frame, page, `paragraph/short/${iteration}`);
    }
  });

  assert.equal(failures.length, 0, `${failures.length} component stress groups failed after ${passed} passed:\n${failures.map(item => `${item.name}: ${item.message}`).join('\n')}`);
  console.log(`PASS: ${passed} component stress groups cover maximum payload, 7000 dense surfaces and readiness budget, deep nesting, dynamic batches, editing/state retention, long text, reversible repair and idle convergence`);
}
