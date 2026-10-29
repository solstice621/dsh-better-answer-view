/** Deliberately small, line-based answer references; never interpret code examples. */
const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const OPEN = new RegExp(`^ {0,3}:::web-answer[ \\t]+(${UUID})[ \\t]*$`, 'i');
const CLOSE = /^ {0,3}:::[ \t]*$/;

export function parseInlineReferences(text, {streaming = false} = {}) {
  if (typeof text !== 'string' || text === '') return [];
  const lines = text.match(/[^\n]*\n|[^\n]+$/g) || [];
  const parts = [];
  let buffer = '';
  let fence = null;
  const flush = () => {
    if (buffer !== '') parts.push({kind: 'text', text: buffer});
    buffer = '';
  };
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].replace(/\r?\n$/, '');
    const code = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);
    if (fence !== null) {
      buffer += lines[i];
      if (code && code[1][0] === fence.char && code[1].length >= fence.length && code[2].trim() === '') fence = null;
      continue;
    }
    if (code) {
      fence = {char: code[1][0], length: code[1].length};
      buffer += lines[i];
      continue;
    }
    const open = OPEN.exec(line);
    if (open && i + 1 < lines.length && CLOSE.test(lines[i + 1].replace(/\r?\n$/, ''))) {
      flush();
      parts.push({kind: 'answer', id: open[1].toLowerCase()});
      i += 1;
      continue;
    }
    // While a token stream is writing a reference, show a neutral placeholder.
    // A completed but malformed reference remains ordinary visible text.
    const tail = lines.slice(i).join('');
    if (streaming && /^ {0,3}:::web-answer(?:[ \t]+[0-9a-f-]{0,36})?[ \t]*(?:\r?\n {0,3}:{0,3}[ \t]*)?$/i.test(tail)) {
      flush();
      parts.push({kind: 'pending', text: tail});
      break;
    }
    buffer += lines[i];
  }
  flush();
  return parts;
}

export function inlineAnswerIds(text) {
  return [...new Set(parseInlineReferences(text).filter(part => part.kind === 'answer').map(part => part.id))];
}
