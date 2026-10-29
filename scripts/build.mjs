import { build } from 'esbuild';
import { mkdir } from 'node:fs/promises';
await mkdir(new URL('../dist/', import.meta.url), { recursive: true });
await build({
  entryPoints: ['src/client.jsx'], outfile: 'dist/client.js', bundle: true,
  platform: 'browser', format: 'cjs', target: 'es2022', external: ['react'],
  banner: { js: 'window.__ModuleLoader__.load({id:"dsh-web-answer",factory(require){var module={exports:{}};var exports=module.exports;' },
  footer: { js: 'return module.exports;}});' }
});
await build({ entryPoints: ['src/demo.jsx'], outfile: 'dist/demo.js', bundle: true, platform: 'browser', format: 'esm', target: 'es2022' });
console.log('Built DSH client and local demo.');
