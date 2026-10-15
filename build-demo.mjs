// Builds the clickable prototype: the real app with an in-browser stand-in backend,
// as one self-contained HTML file.
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const icon = 'data:image/png;base64,' + readFileSync('icons/icon-192.png').toString('base64');
const out = await build({
  entryPoints: ['src/main.js'],
  bundle: true, minify: true, format: 'esm', target: 'safari16', write: false,
  alias: { '@supabase/supabase-js': './src/fake-supabase.js' },
  define: { __DEMO__: 'true', __ICON__: JSON.stringify(icon) },
});
const js = out.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const css = readFileSync('styles.css', 'utf8');
const frame = `
:root { --frame-bg: #d8dde5; --frame-edge: #14161b; --frame-ink: #4a5160; }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --frame-bg: #101114; --frame-edge: #2a2b30; --frame-ink: #9aa0ab; } }
:root[data-theme="dark"] { --frame-bg: #101114; --frame-edge: #2a2b30; --frame-ink: #9aa0ab; }
#device { position: fixed; inset: 0; background: var(--bg); }
.statusbar { display: none; }
.frame-note { display: none; }
@media (min-width: 760px) and (min-height: 780px) {
  body { background: var(--frame-bg); display: grid; place-items: center; min-height: 100%; padding-block: 20px; }
  #device {
    position: relative; inset: auto; width: 390px; height: 844px; max-height: calc(100vh - 80px);
    border-radius: 54px; overflow: hidden; transform: translateZ(0);
    box-shadow: 0 0 0 11px var(--frame-edge), 0 40px 90px rgba(0, 0, 0, 0.28);
    --safe-t: 46px; --safe-b: 22px;
  }
  .statusbar {
    position: absolute; top: 0; left: 0; right: 0; height: 46px; z-index: 200; pointer-events: none;
    display: flex; align-items: center; justify-content: space-between; padding: 6px 34px 0 40px;
    font: 600 16px/1 var(--font); color: var(--ink);
  }
  .statusbar .isle { position: absolute; left: 50%; top: 11px; width: 122px; height: 35px; margin-left: -61px; border-radius: 20px; background: #000000; }
  .frame-note { display: block; position: fixed; left: 0; right: 0; bottom: 14px; text-align: center; font: 500 13px/1.4 var(--font); color: var(--frame-ink); }
}`;
const html = `<title>Namučiai Prototype</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Nunito:wght@700;800&display=swap">
<style>${css}
${frame}</style>
<div id="device">
  <div class="statusbar" aria-hidden="true"><span>9:41</span><span class="isle"></span><span>
    <svg width="64" height="14" viewBox="0 0 64 14" fill="currentColor"><rect x="0" y="9" width="3" height="5" rx="1"/><rect x="5" y="6" width="3" height="8" rx="1"/><rect x="10" y="3" width="3" height="11" rx="1"/><rect x="15" y="0" width="3" height="14" rx="1"/><rect x="35" y="1" width="24" height="12" rx="3.5" fill="none" stroke="currentColor" stroke-width="1.2" opacity=".5"/><rect x="37" y="3" width="17" height="8" rx="2"/><rect x="60.5" y="5" width="1.8" height="4" rx=".9" opacity=".5"/></svg></span></div>
  <div id="root"></div>
  <div id="layer"></div>
  <div id="toast" role="status" aria-live="polite"></div>
</div>
<p class="frame-note">Prototype with sample data. Drag cards and rows with the mouse, or use the arrow keys in a deck.</p>
<script type="module">${js}</script>
`;
mkdirSync('dist-demo', { recursive: true });
writeFileSync('dist-demo/namuciai-prototype.html', html);
console.log('prototype', (html.length / 1024).toFixed(0) + 'kb');
