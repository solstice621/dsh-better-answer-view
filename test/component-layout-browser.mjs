import assert from 'node:assert/strict';

const classes = ['answer-block', 'card', 'answer-note', 'answer-metric', 'answer-decision'];
const inlineTags = ['span', 'small', 'em', 'strong', 'a', 'i', 'mark', 'abbr', 'code', 'output'];
const tags = [...inlineTags, 'label', 'div', 'p', 'section'];
const escape = text => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');

function surfaceCase(className, tag, text = '内容 24.8% / Δ', extra = '') {
  return `<div data-case="${className}/${tag}${extra ? '/override' : ''}" style="margin-bottom:12px"><span data-before>前文 $317.94</span><br><${tag} data-surface class="${className}" ${extra}>${escape(text)}</${tag}><br><span data-after>后文必须可见</span></div>`;
}

async function settle(frame) {
  // Allow normalization, its resulting ResizeObserver and the host's height
  // response to finish. Assertions below examine visible geometry, not CSS.
  let previous = '';
  for (let attempt = 0; attempt < 12; attempt++) {
    await frame.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const current = await frame.evaluate(() => `${innerWidth}:${innerHeight}:${document.body.getBoundingClientRect().height}`);
    if (current === previous) return;
    previous = current;
  }
  throw new Error('The embedded surface did not reach stable dimensions');
}

async function inspectGeometry(frame) {
  return frame.evaluate(() => {
    const rect = node => {
      const box = node.getBoundingClientRect();
      return { left: box.left, right: box.right, top: box.top, bottom: box.bottom, width: box.width, height: box.height };
    };
    const contains = (outer, inner) => inner.left >= outer.left - 1 && inner.right <= outer.right + 1 && inner.top >= outer.top - 1 && inner.bottom <= outer.bottom + 1;
    const root = document.getElementById('answer-content');
    const rootBox = rect(root);
    const cases = Array.from(document.querySelectorAll('[data-case]')).map(group => {
      const surface = group.querySelector('[data-surface]');
      const box = rect(surface);
      const before = group.querySelector('[data-before]');
      const after = group.querySelector('[data-after]');
      const failures = [];
      if (before && rect(before).bottom > box.top + 1) failures.push(`covers previous line by ${(rect(before).bottom - box.top).toFixed(2)}px`);
      if (after && box.bottom > rect(after).top + 1) failures.push(`covers next line by ${(box.bottom - rect(after).top).toFixed(2)}px`);
      if (!contains(rootBox, box)) failures.push('surface escapes visible root');
      const boundary = group.closest('[data-boundary]');
      if (boundary && !contains(rect(boundary), box)) failures.push('surface escapes containing cell/panel');
      const walker = document.createTreeWalker(surface, NodeFilter.SHOW_TEXT);
      let text;
      while ((text = walker.nextNode())) {
        if (!text.textContent.trim()) continue;
        const range = document.createRange();
        range.selectNodeContents(text);
        for (const line of range.getClientRects()) {
          if (!contains(box, line)) { failures.push('rendered text escapes surface'); break; }
          if (!contains(rootBox, line)) { failures.push('rendered text is clipped beyond visible root'); break; }
          if (boundary && !contains(rect(boundary), line)) { failures.push('rendered text escapes containing cell/panel'); break; }
        }
      }
      return { name: group.dataset.case, box, failures };
    });
    return {
      viewport: innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      frameHeight: innerHeight,
      contentBottom: rootBox.bottom,
      cases,
    };
  });
}

async function assertGeometry(frame, label, expectedCases) {
  await settle(frame);
  const geometry = await inspectGeometry(frame);
  if (expectedCases !== undefined) assert.equal(geometry.cases.length, expectedCases, `${label}: fixture survived parsing`);
  const bad = geometry.cases.filter(item => item.failures.length);
  assert.equal(bad.length, 0, `${label}: ${bad.length} invalid surfaces; ${JSON.stringify(bad.slice(0, 8))}`);
  assert.ok(geometry.scrollWidth <= geometry.viewport + 1, `${label}: page overflows ${geometry.scrollWidth}/${geometry.viewport}px`);
  assert.ok(geometry.contentBottom <= geometry.frameHeight + 1, `${label}: content is cut off at iframe bottom`);
  return geometry;
}

function tableFixture(columns) {
  const heading = Array.from({ length: columns }, (_, index) => `<th scope="col">${index + 1}</th>`).join('');
  const rows = classes.map((className, index) => `<tr>${Array.from({ length: columns }, (_, column) => `<td data-boundary>${surfaceCase(className, inlineTags[(index + column) % inlineTags.length], `${column % 2 ? '−' : '+'}${11 + column}%`)}</td>`).join('')}</tr>`).join('');
  return `<table><thead><tr>${heading}</tr></thead><tbody>${rows}</tbody></table>`;
}

/** Adversarial geometry tests through the real AnswerView and opaque iframe. */
export async function runComponentLayoutBrowserTests({ page, show }) {
  const failures = [];
  let passed = 0;
  const run = async (name, check) => {
    if (process.env.COMPONENT_LAYOUT_CASE && !name.includes(process.env.COMPONENT_LAYOUT_CASE)) return;
    try { await check(); passed++; console.log(`PASS: component layout — ${name}`); }
    catch (error) { failures.push({ name, message: error.message }); console.error(`FAIL: component layout — ${name}: ${error.message}`); }
  };
  const ordinary = classes.flatMap(className => tags.map(tag => surfaceCase(className, tag))).join('');
  for (const theme of ['light', 'dark']) {
    for (const width of [1100, 390, 320, 263]) {
      await run(`tag matrix ${theme} ${width}px`, async () => {
        await page.emulateMedia({ colorScheme: theme });
        const frame = await show(ordinary, width);
        await assertGeometry(frame, `${theme}/${width}`, classes.length * tags.length);
      });
    }
  }

  await run('standalone capped preview also reserves inline surface space', async () => {
    const html = surfaceCase('card', 'em', '独立预览中的卡片', 'style="display:inline!important"') + surfaceCase('answer-note', 'strong', '−13%');
    const frame = await show(html, 390, { embedded: false });
    await settle(frame);
    assert.notEqual(await frame.locator('html').getAttribute('data-answer-layout'), 'inline', 'fixture must exercise the standalone rendering path');
    const geometry = await inspectGeometry(frame);
    assert.equal(geometry.cases.length, 2);
    assert.deepEqual(geometry.cases.filter(item => item.failures.length), [], 'standalone surfaces must not cover neighboring text or escape their visible root');
    assert.ok(geometry.scrollWidth <= geometry.viewport + 1, 'standalone preview content fits its width');
    // Standalone previews intentionally cap their height and can scroll. The
    // embedded-only full-document-height invariant does not apply here.
  });

  await run('authored inline override and compressed line height', async () => {
    const html = `<style>.compressed{line-height:1}</style><div class="compressed">${classes.flatMap(className => ['em', 'div'].map(tag => surfaceCase(className, tag, '占据自己的空间', 'style="display:inline!important"'))).join('')}</div>`;
    const frame = await show(html, 390);
    await assertGeometry(frame, 'authored display:inline!important', 10);
  });

  await run('ordinary fixed-height and max-height surfaces reveal all flow content', async () => {
    const variants = [
      ['div', 'height:20px;overflow:visible'],
      ['section', 'max-height:20px;overflow:hidden'],
      ['span', 'display:inline-block;height:20px;overflow:visible'],
      ['em', 'display:inline-flex;max-height:20px;overflow:clip'],
    ];
    const html = variants.map(([tag, style], index) => surfaceCase(classes[index], tag, '普通卡片中的长文字必须完整显示，不能遮住后续正文。'.repeat(8), `style="${style}"`)).join('');
    const frame = await show(html, 320);
    await assertGeometry(frame, 'constrained surfaces expand to visible flow content', variants.length);
    assert.ok(await frame.locator('[data-surface]').evaluateAll(nodes => nodes.every(node => node.scrollHeight <= node.clientHeight + 1)), 'reading surfaces must expand, not silently clip overflow');
  });

  await run('deep constrained wrappers expand to their descendant text', async () => {
    const longText = '深层正文需要从祖先卡片一直到最后一行都完整可见，避免固定高度的中间容器把文字推到下一张卡片。'.repeat(8);
    const variants = [
      ['percent-child', 'height:40px', 'height:100%'],
      ['fixed-visible-child', 'height:40px', 'height:20px;overflow:visible'],
      ['max-visible-child', 'max-height:40px', 'max-height:20px;overflow:visible'],
      ['fixed-hidden-child', 'height:40px', 'height:20px;overflow:hidden'],
      ['max-hidden-child', 'max-height:40px', 'max-height:20px;overflow:hidden'],
    ];
    const html = variants.map(([name, outerStyle, childStyle]) => `<div data-case="${name}"><span data-before>卡片前文</span><br><div class="card" data-surface style="${outerStyle}"><div data-flow-box style="${childStyle}"><div data-flow-box><p style="margin:0">${longText}</p></div></div></div><br><span data-after>卡片后文</span></div>`).join('');
    const frame = await show(html, 320);
    for (const width of [320, 263]) {
      await page.setViewportSize({ width, height: 900 });
      await assertGeometry(frame, `deep constrained wrappers/${width}`, variants.length);
      const clipped = await frame.locator('[data-flow-box]').evaluateAll(nodes => nodes.filter(node => node.scrollHeight > node.clientHeight + 1).map(node => ({ height: node.clientHeight, contents: node.scrollHeight, style: node.getAttribute('style') })));
      assert.deepEqual(clipped, [], 'each intermediate reading wrapper must contain its full flow content');
    }
  });

  await run('flow expansion preserves positioned graphics and restores authored height on removal', async () => {
    const longText = '正文应撑开卡片，右上角图形保持原来的定位。'.repeat(16);
    const html = `<div data-case="mixed-flow-and-graphic"><span data-before>前文</span><br><div id="mixed-card" class="card" data-surface style="height:40px;position:relative"><span id="decorative-mark" aria-hidden="true" style="position:absolute;right:8px;top:8px;width:18px;height:18px;background:#3456b8;border-radius:50%"></span><div id="mixed-flow" data-flow-box style="height:100%"><p id="mixed-paragraph" style="margin:0;padding-right:28px">${longText}</p></div></div><br><span data-after>后文</span></div>`;
    const frame = await show(html, 320);
    await assertGeometry(frame, 'mixed positioned and ordinary flow', 1);
    const expandedHeight = await frame.locator('#mixed-card').evaluate(node => node.getBoundingClientRect().height);
    assert.ok(expandedHeight > 100, 'ordinary descendant text must expand the constrained card');
    const graphicGeometry = () => frame.evaluate(() => {
      const card = document.getElementById('mixed-card');
      const mark = document.getElementById('decorative-mark');
      const parent = card.getBoundingClientRect(), graphic = mark.getBoundingClientRect();
      return { position: getComputedStyle(mark).position, top: graphic.top - parent.top - card.clientTop, right: parent.left + card.clientLeft + card.clientWidth - graphic.right, width: graphic.width, height: graphic.height };
    });
    const originalGraphic = await graphicGeometry();
    assert.deepEqual(originalGraphic, { position: 'absolute', top: 8, right: 8, width: 18, height: 18 }, 'the graphic retains its authored position and dimensions');
    await frame.locator('#mixed-paragraph').evaluate(node => node.remove());
    await settle(frame);
    assert.equal(await frame.locator('#mixed-card').evaluate(node => node.getBoundingClientRect().height), 40, 'removing long text restores the authored fixed height');
    assert.deepEqual(await graphicGeometry(), originalGraphic, 'restoring card height must not move the positioned graphic');
    await assertGeometry(frame, 'mixed surface after removal', 1);
    await frame.locator('#mixed-flow').evaluate((node, text) => { const paragraph = document.createElement('p'); paragraph.style.cssText = 'margin:0;padding-right:28px'; paragraph.textContent = text; node.append(paragraph); }, longText);
    await assertGeometry(frame, 'mixed surface after reinsertion', 1);
    assert.ok(Math.abs(await frame.locator('#mixed-card').evaluate(node => node.getBoundingClientRect().height) - expandedHeight) <= 1, 'repeated insertion returns to the same natural height');
    assert.deepEqual(await graphicGeometry(), originalGraphic, 'reinsertion keeps graphic geometry stable');
  });

  await run('float-only and taller floated children remain inside their card', async () => {
    const html = `<div data-case="float-only"><span data-before>前文</span><br><div class="card" data-surface><div data-float style="float:left;width:72px;height:140px;background:var(--answer-soft)">浮动内容</div></div><br><span data-after>后文</span></div><div data-case="taller-float"><span data-before>前文</span><br><div class="card" data-surface style="height:40px"><div data-float style="float:right;width:80px;height:180px;background:var(--answer-soft)">较高的浮动内容</div><p style="margin:0">普通短段落</p></div><br><span data-after>后文</span></div>`;
    const frame = await show(html, 320);
    await assertGeometry(frame, 'cards contain floated flow children', 2);
    const floats = await frame.locator('[data-float]').evaluateAll(nodes => nodes.map(node => {
      const box = node.getBoundingClientRect(), card = node.parentElement.getBoundingClientRect();
      return { float: getComputedStyle(node).float, contained: box.left >= card.left - 1 && box.right <= card.right + 1 && box.top >= card.top - 1 && box.bottom <= card.bottom + 1 };
    }));
    assert.deepEqual(floats, [{ float: 'left', contained: true }, { float: 'right', contained: true }], 'clearing card overflow must retain float positioning and contain the entire float');
  });

  await run('replacing inline styles preserves new font and layout intent after an earlier repair', async () => {
    const html = surfaceCase('card', 'em', '字体修改后仍占据完整空间', 'id="font-change" style="display:inline!important;font:400 12px/1.6 sans-serif"');
    const frame = await show(html, 320);
    const before = await assertGeometry(frame, 'before inline style replacement', 1);
    await frame.locator('#font-change').evaluate(node => { node.style.cssText = 'display:inline!important;font:700 32px/1.8 serif;letter-spacing:1px'; });
    const after = await assertGeometry(frame, 'after inline style replacement', 1);
    const font = await frame.locator('#font-change').evaluate(node => { const style = getComputedStyle(node); return { size: style.fontSize, weight: style.fontWeight, family: style.fontFamily, lineHeight: parseFloat(style.lineHeight), spacing: style.letterSpacing }; });
    assert.deepEqual({ size: font.size, weight: font.weight, family: font.family, spacing: font.spacing }, { size: '32px', weight: '700', family: 'serif', spacing: '1px' });
    assert.ok(Math.abs(font.lineHeight - 57.6) < .1, 'the replacement line height remains in effect');
    assert.ok(after.cases[0].box.height > before.cases[0].box.height, 'the new font participates in layout');
    await page.setViewportSize({ width: 1100, height: 900 });
    await assertGeometry(frame, 'replacement font after widening', 1);
    assert.equal(await frame.locator('#font-change').evaluate(node => getComputedStyle(node).fontSize), '32px', 'later normalization never restores the stale font');
  });

  await run('explicit inline-note and cell-detail vocabulary has safe geometry', async () => {
    const html = ['span', 'em', 'strong'].map(tag => surfaceCase('answer-inline-note', tag, '正文中的说明')).join('') + `<table><tbody><tr>${['span', 'small', 'em', 'strong'].map(tag => `<td data-boundary>${surfaceCase('answer-cell-detail', tag, '+18%')}</td>`).join('')}</tr></tbody></table>`;
    for (const width of [1100, 263]) {
      const frame = await show(html, width);
      await assertGeometry(frame, `explicit vocabulary/${width}`, 7);
    }
  });

  for (const [width, scale] of [[1100, 1], [390, 2], [263, 3], [160, 2]]) {
    await run(`multilingual and long tokens ${width}px ${scale}x root font`, async () => {
      const texts = ['连续的中文与日本語한국어。🙂👨‍👩‍👧‍👦e\u0301 '.repeat(4), 'https://example.test/' + 'unbroken-token_'.repeat(18), 'المحتوى العربي الطويل مع أرقام 123.45% '.repeat(4), 'ภาษาไทยไม่มีช่องว่างระหว่างคำ'.repeat(5), 'A'.repeat(240)];
      const html = `<style>html{font-size:${16 * scale}px}[data-surface]{font-size:1rem;line-height:1.6}</style>${classes.map((className, index) => surfaceCase(className, inlineTags[index], texts[index])).join('')}`;
      const frame = await show(html, width);
      await assertGeometry(frame, `long text/${width}/${scale}`, 5);
    });
  }

  for (const [width, columns] of [[1100, 12], [390, 6], [263, 4], [160, 2], [263, 8], [160, 4]]) {
    await run(`table ${columns} columns at ${width}px`, async () => {
      const frame = await show(tableFixture(columns), width);
      await assertGeometry(frame, `table/${width}/${columns}`, classes.length * columns);
    });
  }

  await run('nested surfaces and grid/flex restore after repeated resize', async () => {
    const children = classes.map((className, index) => `<section data-boundary>${surfaceCase(className, 'em', `Multilingual多语内容${index} ${'W'.repeat(28)}`)}</section>`).join('');
    const html = `<style>.fixed-grid{display:grid;grid-template-columns:repeat(5,150px);gap:12px}.fixed-flex{display:flex;flex-wrap:nowrap;gap:12px}.fixed-flex>section{flex:1 0 150px}</style><div class="card"><div class="answer-block"><div class="answer-decision"><div class="fixed-grid" id="grid">${children}</div></div></div></div><div class="fixed-flex" id="flex">${children}</div>`;
    const frame = await show(html, 1100);
    const original = await assertGeometry(frame, 'nested/original', 10);
    for (const width of [390, 263, 320, 1100, 263, 1100]) {
      await page.setViewportSize({ width, height: 900 });
      await assertGeometry(frame, `nested/resize/${width}`, 10);
    }
    const restored = await inspectGeometry(frame);
    assert.ok(Math.abs(original.contentBottom - restored.contentBottom) < 2, 'widening must restore the original height instead of preserving a narrow-layout mutation');
    for (let index = 0; index < original.cases.length; index++) {
      assert.ok(Math.abs(original.cases[index].box.width - restored.cases[index].box.width) < 2, `surface ${index} width must restore after widening`);
    }
  });

  await run('dynamic insertion, replacement, class change, and removal', async () => {
    const frame = await show(`<button id="insert">插入</button><button id="remove">移除</button><div id="live"></div><p id="tail">底部保持可见</p><script>document.getElementById('insert').onclick=()=>{document.getElementById('live').innerHTML=${JSON.stringify(classes.map(className => surfaceCase(className, 'em', '动态内容')).join(''))};};document.getElementById('remove').onclick=()=>document.getElementById('live').replaceChildren();</script>`, 390);
    await settle(frame);
    const initial = await frame.evaluate(() => innerHeight);
    await frame.locator('#insert').click();
    await assertGeometry(frame, 'inserted', 5);
    const inserted = await frame.evaluate(() => innerHeight);
    assert.ok(inserted > initial + 100, 'inserting surfaces must grow the frame');
    await frame.evaluate(() => {
      const surfaces = document.querySelectorAll('[data-surface]');
      surfaces[0].className = 'answer-note';
      surfaces[1].textContent = '异步替换为非常长的正文🙂 '.repeat(40);
      surfaces[2].style.display = 'inline';
      surfaces[3].outerHTML = '<strong class="card" data-surface>替换节点仍可见</strong>';
    });
    await assertGeometry(frame, 'mutated', 5);
    await frame.locator('#remove').click();
    await settle(frame);
    const removed = await frame.evaluate(() => innerHeight);
    assert.ok(Math.abs(removed - initial) <= 1, `removal must shrink the iframe: ${removed}/${initial}`);
  });

  await run('corrected inline surfaces can become hidden, flex, contents, and inline again', async () => {
    const html = `<style>.vanished{display:none}.flex-mode{display:flex;gap:8px}.contents-mode{display:contents}</style>${surfaceCase('card', 'em', '动态显示语义', 'id="changing"')}`;
    const frame = await show(html, 390);
    await assertGeometry(frame, 'initial corrected inline', 1);
    await frame.locator('#changing').evaluate(node => node.classList.add('vanished'));
    await settle(frame);
    assert.equal(await frame.locator('#changing').isVisible(), false, 'correcting an earlier inline display must not pin the component open');
    await frame.locator('#changing').evaluate(node => { node.classList.remove('vanished'); node.classList.add('flex-mode'); node.innerHTML = '<span>左</span><span>右</span>'; });
    await settle(frame);
    const flex = await frame.locator('#changing').evaluate(node => {
      const [a, b] = Array.from(node.children).map(child => child.getBoundingClientRect());
      return { display: getComputedStyle(node).display, sameLine: Math.abs(a.top - b.top) < 1, gap: b.left - a.right };
    });
    assert.equal(flex.display, 'flex', 'authored flex must replace the earlier correction');
    assert.ok(flex.sameLine && flex.gap >= 7, 'flex children retain their intended grouping and gap');
    await frame.locator('#changing').evaluate(node => { node.classList.remove('flex-mode'); node.classList.add('contents-mode'); });
    await settle(frame);
    assert.equal(await frame.locator('#changing').evaluate(node => getComputedStyle(node).display), 'contents', 'display:contents has no surface box to repair');
    await frame.locator('#changing').evaluate(node => { node.classList.remove('contents-mode'); node.textContent = '恢复到安全行内表面'; });
    await assertGeometry(frame, 'restored corrected inline', 1);
  });

  await run('table cells, list markers, grid, flex and contents keep structural semantics', async () => {
    const html = `<table id="semantic-table"><tbody><tr class="answer-note"><th class="card" scope="row">行标题</th><td class="answer-block">单元格 A</td><td class="answer-decision">单元格 B</td></tr><tr><th>第二行</th><td>内容 C</td><td>内容 D</td></tr></tbody></table><ul><li class="card" id="list-item">有序的可见条目</li></ul><details><summary class="answer-decision" id="summary">原生展开标题</summary><p>说明正文</p></details><div class="answer-block" id="grid-surface" style="display:grid;grid-template-columns:1fr 1fr;gap:10px"><span>A</span><span>B</span></div><div class="card" id="flex-surface" style="display:flex;gap:10px"><span>C</span><span>D</span></div><span class="card" id="contents-surface" style="display:contents">透明结构容器</span>`;
    const frame = await show(html, 320);
    await settle(frame);
    const geometry = await frame.evaluate(() => {
      const table = document.getElementById('semantic-table');
      const rows = Array.from(table.rows).map(row => Array.from(row.cells).map(cell => { const box = cell.getBoundingClientRect(); return { top: box.top, left: box.left, right: box.right }; }));
      const displays = Object.fromEntries(['list-item', 'summary', 'grid-surface', 'flex-surface', 'contents-surface'].map(id => [id, getComputedStyle(document.getElementById(id)).display]));
      return { rows, displays };
    });
    for (const cells of geometry.rows) {
      assert.equal(cells.length, 3);
      assert.ok(cells.every(cell => Math.abs(cell.top - cells[0].top) < 1), 'cells remain in a common table row');
      assert.ok(cells[1].left >= cells[0].right - 1 && cells[2].left >= cells[1].right - 1, 'table columns remain distinct and ordered');
    }
    assert.deepEqual(geometry.displays, { 'list-item': 'list-item', summary: 'list-item', 'grid-surface': 'grid', 'flex-surface': 'flex', 'contents-surface': 'contents' });
  });

  await run('large numeric tokens wrap only when necessary and restore', async () => {
    const value = '1234567890'.repeat(8);
    const html = `<div data-boundary>${surfaceCase('card', 'span', value, 'id="number-token"')}</div><div class="answer-metric" data-case="large-metric"><span data-before>指标</span><strong class="answer-metric-value" data-surface>${value}</strong><span data-after>单位说明</span></div>`;
    const frame = await show(html, 263);
    await assertGeometry(frame, 'large numeric text/narrow', 2);
    await page.setViewportSize({ width: 1100, height: 900 });
    await assertGeometry(frame, 'large numeric text/wide', 2);
  });

  await run('hidden and disclosure surfaces retain visibility semantics', async () => {
    const html = `<style>#accordion{height:0;overflow:hidden;padding:0;border:0}#accordion.open{height:180px}#hidden-css{display:none!important}.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap}</style><span class="card" id="hidden-attribute" hidden>隐藏内容</span><em class="answer-note" id="hidden-css">CSS 隐藏内容</em><div class="card" id="invisible" style="visibility:hidden">不可见内容</div><div class="card sr-only" id="accessible">${'辅助文字'.repeat(100)}</div><button aria-controls="accordion" aria-expanded="false" id="toggle">切换</button><div class="answer-decision" id="accordion"><div style="height:180px">折叠正文</div></div><details class="card" id="details"><summary>原生展开</summary><div id="details-body" style="height:220px">详情正文</div></details><p>可见结尾</p><script>document.getElementById('toggle').onclick=event=>{const open=document.getElementById('accordion').classList.toggle('open');event.currentTarget.setAttribute('aria-expanded',String(open));}</script>`;
    const frame = await show(html, 320);
    await settle(frame);
    const closed = await frame.evaluate(() => innerHeight);
    assert.equal(await frame.locator('#hidden-attribute').isVisible(), false, '[hidden] must win over component display defaults');
    assert.equal(await frame.locator('#hidden-css').isVisible(), false, 'authored display:none must remain hidden');
    assert.equal(await frame.locator('#invisible').isVisible(), false, 'visibility:hidden must remain hidden');
    assert.equal(await frame.locator('#accordion').evaluate(node => node.clientHeight), 0, 'collapsed panel stays collapsed');
    assert.equal(await frame.locator('#details-body').isVisible(), false, 'closed details descendants stay hidden');
    assert.equal(await frame.locator('#accessible').evaluate(node => getComputedStyle(node).clip), 'rect(0px, 0px, 0px, 0px)', 'accessible clipped alternative must keep its clip');
    await frame.locator('#toggle').click(); await settle(frame);
    assert.ok(await frame.evaluate(() => innerHeight) > closed + 170, 'controlled disclosure opens');
    await frame.locator('#toggle').click(); await settle(frame);
    assert.ok(Math.abs(await frame.evaluate(() => innerHeight) - closed) <= 1, 'controlled disclosure re-closes');
    await frame.locator('#details summary').click(); await settle(frame);
    assert.equal(await frame.locator('#details-body').isVisible(), true);
    assert.ok(await frame.evaluate(() => innerHeight) > closed + 210, 'native details opens');
    await frame.locator('#details summary').click(); await settle(frame);
    assert.ok(Math.abs(await frame.evaluate(() => innerHeight) - closed) <= 1, 'native details re-closes');
  });

  await run('controlled, scrolling and SVG subtrees keep their authored layout', async () => {
    const pane = id => `<div id="${id}" class="card" style="height:20px;max-height:20px;padding:0;border:0;overflow:auto"><div style="height:100px">控件内部的滚动内容</div></div>`;
    const html = `<button id="control" aria-controls="controlled-panel" aria-expanded="false">控制</button><div id="controlled-panel" style="height:40px;overflow:hidden">${pane('controlled-child')}</div><div role="listbox" aria-label="列表">${pane('listbox-child')}</div><div data-answer-scroll>${pane('scroll-child')}</div><svg viewBox="0 0 200 100" width="200"><foreignObject width="200" height="100"><div xmlns="http://www.w3.org/1999/xhtml">${pane('svg-child')}</div></foreignObject></svg>`;
    const frame = await show(html + '<button aria-controls="  " aria-expanded="false">Empty reference</button>' + surfaceCase('card', 'em', 'An empty control reference must not disable ordinary card protection'), 320);
    await assertGeometry(frame, 'empty control reference', 1);
    for (const expanded of [false, true, false]) {
      await frame.locator('#control').evaluate((node, value) => node.setAttribute('aria-expanded', String(value)), expanded);
      await settle(frame);
      const sizes = await frame.evaluate(() => ['controlled-child', 'listbox-child', 'scroll-child', 'svg-child'].map(id => {
        const node = document.getElementById(id);
        return { id, height: node.clientHeight, scroll: node.scrollHeight, overflow: getComputedStyle(node).overflowY };
      }));
      assert.ok(sizes.every(size => size.height === 20 && size.scroll >= 100 && size.overflow === 'auto'), `control/graphics subtree must not be expanded: ${JSON.stringify(sizes)}`);
    }
  });

  await run('native controls and absolute chart geometry are preserved', async () => {
    const html = `<div class="card"><label>文本<textarea class="answer-note" id="edit" style="height:80px;max-height:80px">${'可编辑内容\n'.repeat(40)}</textarea></label><label><input type="checkbox" class="card" id="check">开关</label><label>数值<input class="answer-metric" id="number" type="number" value="7"></label><label>选择<select class="answer-note" id="choice"><option value="one">一</option><option value="two">二</option></select></label><button class="answer-decision" id="button">操作</button><output id="result">0</output></div><div id="chart" class="card" style="position:relative;height:120px"><div id="bar" class="answer-note" style="position:absolute;left:10%;top:25%;width:65%;height:24px;padding:0;margin:0"></div><span style="position:absolute;left:20%;top:55%">定位标签</span></div><script>document.getElementById('button').onclick=()=>document.getElementById('result').textContent=Number(document.getElementById('result').textContent)+1;</script>`;
    const frame = await show(html, 390);
    await settle(frame);
    assert.ok(await frame.locator('#edit').evaluate(node => node.scrollHeight > node.clientHeight + 100), 'textarea retains its internal scrolling');
    await frame.locator('#edit').fill('修改保持有效');
    assert.equal(await frame.locator('#edit').inputValue(), '修改保持有效');
    await frame.locator('#check').check();
    assert.equal(await frame.locator('#check').isChecked(), true);
    await frame.locator('#number').fill('23');
    assert.equal(await frame.locator('#number').inputValue(), '23');
    await frame.locator('#choice').selectOption('two');
    assert.equal(await frame.locator('#choice').inputValue(), 'two');
    await frame.locator('#button').click();
    assert.equal(await frame.locator('#result').textContent(), '1');
    for (const width of [263, 1100, 390]) {
      await page.setViewportSize({ width, height: 900 }); await settle(frame);
      const chart = await frame.evaluate(() => {
        const parent = document.getElementById('chart');
        const bar = document.getElementById('bar');
        const p = parent.getBoundingClientRect(), b = bar.getBoundingClientRect();
        return { position: getComputedStyle(bar).position, ratio: b.width / parent.clientWidth, left: (b.left - p.left - parent.clientLeft) / parent.clientWidth, height: b.height };
      });
      assert.equal(chart.position, 'absolute', 'surface hardening must not flatten authored charts');
      assert.ok(Math.abs(chart.ratio - .65) < .01, `bar keeps its data width: ${JSON.stringify(chart)}`);
      assert.ok(Math.abs(chart.left - .1) < .01, `bar keeps its data anchor: ${JSON.stringify(chart)}`);
      assert.equal(chart.height, 24, 'bar height stays intentional');
    }
  });

  await page.emulateMedia({ colorScheme: 'light' });
  assert.equal(failures.length, 0, `${failures.length} component layout groups failed after ${passed} passed:\n${failures.map(item => `${item.name}: ${item.message}`).join('\n')}`);
  console.log(`PASS: ${passed} component layout groups cover tags, custom CSS, typography, tables, reflow, dynamic content, controls, disclosures, and charts`);
}
