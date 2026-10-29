import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

/** Reproduce the saved matrix: padded inline notes used to paint over prices. */
export async function runNoteLayoutBrowserTests({ page, show }) {
  const html = await readFile(new URL('./fixtures/valuation-matrix.html', import.meta.url), 'utf8');
  for (const colorScheme of ['light', 'dark']) {
    await page.emulateMedia({ colorScheme });
    for (const width of [1100, 390, 320, 263]) {
      const frame = await show(html, width);
      const geometry = await frame.evaluate(() => ({
        viewport: innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
        cells: Array.from(document.querySelectorAll('td')).map(cell => {
          const price = cell.querySelector('strong');
          const note = cell.querySelector('.answer-note');
          const value = price.getBoundingClientRect();
          const detail = note.getBoundingClientRect();
          const box = cell.getBoundingClientRect();
          const range = document.createRange();
          range.selectNodeContents(note);
          return {
            text: cell.textContent,
            gap: detail.top - value.bottom,
            inside: detail.left >= box.left && detail.right <= box.right && detail.top >= box.top && detail.bottom <= box.bottom,
            lines: range.getClientRects().length,
          };
        }),
        blockNotes: Array.from(document.querySelectorAll('p.answer-note')).map(node => ({
          display: getComputedStyle(node).display,
          padding: getComputedStyle(node).paddingTop,
        })),
      }));
      assert.equal(geometry.cells.length, 16);
      assert.ok(geometry.cells.every(cell => cell.gap >= 0), `prices must not be covered (${colorScheme}, ${width}): ${JSON.stringify(geometry.cells)}`);
      assert.ok(geometry.cells.every(cell => cell.inside), `notes must stay within their cells (${colorScheme}, ${width})`);
      assert.ok(geometry.cells.every(cell => cell.lines === 1), `percentages must remain intact (${colorScheme}, ${width})`);
      assert.ok(geometry.scrollWidth <= geometry.viewport, `matrix must fit at ${width}px`);
      assert.deepEqual(geometry.blockNotes, [{ display: 'block', padding: '10px' }, { display: 'block', padding: '10px' }]);
    }
  }
  // Inline notes outside a table retain their callout padding, but that padding
  // must participate in layout instead of painting across adjacent text lines.
  const frame = await show('<p id="inline-notes">说明<br><span class="answer-note">行内提示</span><br><small class="answer-note">补充提示</small><br><strong>后续文字</strong></p>');
  const gaps = await frame.evaluate(() => {
    const nodes = document.querySelectorAll('#inline-notes .answer-note, #inline-notes strong');
    return Array.from(nodes).slice(1).map((node, index) => node.getBoundingClientRect().top - nodes[index].getBoundingClientRect().bottom);
  });
  assert.ok(gaps.every(gap => gap >= 0), 'padded span/small notes must not cover adjacent lines');
  console.log('PASS: saved valuation matrix has readable prices and percentages at four widths in both themes; block and inline notes retain safe spacing');
}
