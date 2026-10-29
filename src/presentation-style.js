/** Shared compact visual vocabulary for generated inline answers. */
export const DEFAULT_STYLE = `
:root {
  color-scheme:light;
  --answer-bg:#ffffff; --answer-fg:#202a38; --answer-muted:#5e6b7d;
  --answer-border:#e1e6ed; --answer-soft:#f5f7fa; --answer-accent:#3456b8;
  --answer-accent-soft:#edf2ff; --answer-on-accent:#ffffff;
  --answer-positive:#236b50; --answer-positive-soft:#edf7f1;
  --answer-warning:#8b6018; --answer-warning-soft:#fbf4e6;
  --answer-radius:12px;
  --answer-font:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;
}
:root[data-theme="dark"] {
  color-scheme:dark;
  --answer-bg:#17202f; --answer-fg:#edf1f7; --answer-muted:#b0bdcf;
  --answer-border:#374357; --answer-soft:#222e40; --answer-accent:#aac0ff;
  --answer-accent-soft:#2b3a59; --answer-on-accent:#152139;
  --answer-positive:#9ad5b3; --answer-positive-soft:#243d34;
  --answer-warning:#edca87; --answer-warning-soft:#433b2c;
}
* { box-sizing:border-box; }
html,body { margin:0; padding:0; width:100%; background:var(--answer-bg); color:var(--answer-fg); }
body { font:15px/1.6 var(--answer-font); -webkit-font-smoothing:antialiased; }
#answer-content { display:flow-root; padding:clamp(12px,2.3vw,20px); overflow-wrap:anywhere; }
main,article,section,figure,fieldset { min-width:0; max-width:100%; }
figure { margin:0; } fieldset { margin:0; padding:0; border:0; }
h1,h2,h3,h4 { line-height:1.35; letter-spacing:-.02em; margin:1.25em 0 .5em; font-weight:650; }
h1 { font-size:23px; } h2 { font-size:20px; } h3 { font-size:17px; } h4 { font-size:15px; }
#answer-content> :first-child,main> :first-child,article> :first-child,.answer-block> :first-child,.card> :first-child { margin-top:0; }
#answer-content> :last-child,.answer-block> :last-child,.card> :last-child { margin-bottom:0; }
p { margin:.65em 0 .9em; } ul,ol { margin:.7em 0; padding-left:1.4em; } li+li { margin-top:.3em; }
small,.muted,.answer-caption,.answer-source { color:var(--answer-muted); }
small,.answer-caption,.answer-source { font-size:12px; line-height:1.55; }
a { color:var(--answer-accent); text-underline-offset:3px; } strong { font-weight:650; }
button,input,select,textarea { font:inherit; }
button { min-height:38px; max-width:100%; border:1px solid var(--answer-border); border-radius:8px; padding:7px 12px; background:var(--answer-soft); color:var(--answer-fg); cursor:pointer; }
button:hover { border-color:var(--answer-accent); } button:disabled { opacity:.5; cursor:default; }
button.primary,[data-primary] { background:var(--answer-accent); color:var(--answer-on-accent); border-color:transparent; }
button[aria-pressed="true"] { border-color:var(--answer-accent); background:var(--answer-accent-soft); color:var(--answer-accent); }
:focus-visible { outline:3px solid var(--answer-accent); outline-offset:3px; }
input:not([type="range"]):not([type="checkbox"]):not([type="radio"]),select,textarea { width:100%; min-width:0; max-width:100%; padding:8px 10px; border:1px solid var(--answer-border); border-radius:8px; background:var(--answer-bg); color:var(--answer-fg); }
input[type="range"] { width:100%; min-height:32px; margin:0; accent-color:var(--answer-accent); }
input[type="checkbox"],input[type="radio"] { accent-color:var(--answer-accent); }
label { display:block; margin:.6em 0 .3em; } textarea { resize:vertical; min-height:80px; }
.answer-block,.card { padding:16px; border:1px solid var(--answer-border); border-radius:var(--answer-radius); background:var(--answer-bg); }
.grid,.answer-metric-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(min(160px,100%),1fr)); gap:12px; }
.grid>*,.answer-metric-grid>* { min-width:0; }
.row,.answer-block-heading,.answer-control-heading { display:flex; gap:10px; align-items:center; flex-wrap:wrap; }
.answer-block-heading,.answer-control-heading { justify-content:space-between; }
.answer-block-heading { margin-bottom:12px; } .answer-block-heading h2,.answer-block-heading h3 { margin:0; }
.badge { display:inline-block; padding:2px 7px; border-radius:5px; background:var(--answer-accent-soft); color:var(--answer-accent); font-size:12px; line-height:1.5; }
.answer-metric { padding:14px; border-radius:10px; background:var(--answer-soft); }
.answer-metric-label { color:var(--answer-muted); font-size:12px; line-height:1.5; }
.answer-metric-value { display:block; margin:5px 0 2px; font-size:clamp(23px,5vw,30px); line-height:1.2; font-weight:650; font-variant-numeric:tabular-nums; letter-spacing:-.035em; }
.answer-metric-unit { margin-left:4px; color:var(--answer-muted); font-size:13px; font-weight:400; letter-spacing:0; }
.answer-metric-detail { margin:6px 0 0; font-size:12px; color:var(--answer-muted); }
.answer-positive { color:var(--answer-positive); } .answer-warning { color:var(--answer-warning); }
.answer-bar-list { display:grid; gap:14px; margin:14px 0; }
.answer-bar-row { display:grid; grid-template-columns:minmax(0,1fr) auto; gap:5px 12px; align-items:baseline; font-size:13px; }
.answer-bar-label { min-width:0; } .answer-bar-value { font-variant-numeric:tabular-nums; font-weight:600; }
.answer-bar-track { grid-column:1/-1; height:8px; border-radius:4px; background:var(--answer-soft); }
.answer-bar-fill { display:block; width:var(--value,0%); max-width:100%; height:100%; border-radius:4px; background:var(--answer-accent); }
.answer-bar-fill.answer-secondary { background:var(--answer-muted); }
.answer-legend { display:flex; flex-wrap:wrap; gap:6px 16px; margin:10px 0; color:var(--answer-muted); font-size:12px; }
.answer-legend-item { display:inline-flex; align-items:center; gap:6px; }
.answer-swatch { display:inline-block; width:10px; height:10px; flex:0 0 10px; border-radius:2px; background:var(--answer-accent); }
.answer-timeline { list-style:none; margin:12px 0; padding:0; }
.answer-timeline-item { position:relative; margin:0; padding:0 0 18px 21px; border-left:1px solid var(--answer-border); }
.answer-timeline-item::before { content:""; position:absolute; left:-4px; top:7px; width:7px; height:7px; border-radius:50%; background:var(--answer-accent); }
.answer-timeline-item:last-child { padding-bottom:0; border-color:transparent; }
.answer-timeline-item h3,.answer-timeline-item h4 { margin:0 0 3px; } .answer-timeline-item p { margin:4px 0 0; }
.answer-timeline-date { display:block; color:var(--answer-muted); font-size:12px; margin-bottom:3px; }
.answer-decision { padding:14px 16px; border-left:3px solid var(--answer-accent); border-radius:0 9px 9px 0; background:var(--answer-accent-soft); }
.answer-decision> :first-child { margin-top:0; } .answer-decision> :last-child { margin-bottom:0; }
.answer-evidence { display:grid; gap:10px; margin:12px 0; }
.answer-evidence>div { padding-bottom:10px; border-bottom:1px solid var(--answer-border); }
.answer-evidence>div:last-child { padding-bottom:0; border-bottom:0; }
.answer-note { margin:12px 0 0; padding:10px 12px; border-radius:8px; background:var(--answer-soft); color:var(--answer-muted); font-size:13px; }
.answer-source { display:block; margin-top:10px; }
.answer-control { margin:14px 0; } .answer-control-heading label { margin:0; } .answer-control-heading output { color:var(--answer-accent); font-variant-numeric:tabular-nums; font-weight:600; }
table { border-collapse:collapse; table-layout:fixed; width:100%; max-width:100%; font-size:13px; margin:14px 0; }
th,td { min-width:0; padding:10px 9px; text-align:left; border-bottom:1px solid var(--answer-border); vertical-align:top; overflow-wrap:anywhere; }
th { color:var(--answer-muted); font-size:12px; font-weight:600; background:var(--answer-soft); }
.answer-numeric { text-align:right; font-variant-numeric:tabular-nums; }
blockquote { margin:16px 0; padding:8px 14px; border-left:3px solid var(--answer-accent); background:var(--answer-soft); }
pre { max-width:100%; padding:12px; border-radius:8px; background:var(--answer-soft); white-space:pre-wrap; overflow-wrap:anywhere; }
code { font-family:ui-monospace,SFMono-Regular,Consolas,monospace; font-size:.9em; }
:not(pre)>code { padding:2px 4px; border-radius:4px; background:var(--answer-soft); }
hr { border:0; border-top:1px solid var(--answer-border); margin:18px 0; }
svg,img,canvas { max-width:100%; } svg,img { height:auto; } svg text { font-family:var(--answer-font); } svg text:not([fill]) { fill:var(--answer-fg); }
figcaption { margin-top:8px; color:var(--answer-muted); font-size:12px; }
details { padding:10px 12px; border:1px solid var(--answer-border); border-radius:8px; margin:10px 0; }
summary { cursor:pointer; font-weight:600; }
@media(max-width:420px) {
  body { font-size:14px; } h1 { font-size:21px; } h2 { font-size:18px; }
  .answer-block,.card { padding:12px; } .answer-metric { padding:11px; }
  .grid,.answer-metric-grid { grid-template-columns:repeat(auto-fit,minmax(min(126px,100%),1fr)); gap:10px; }
  th,td { padding:8px 5px; font-size:12px; }
}
`;
