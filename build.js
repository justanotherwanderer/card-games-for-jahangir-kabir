// Assembles src/* into one self-contained page.
// dist/index.html  -> artifact body (the host adds doctype/head/body)
// dist/test.html   -> full standalone document for local testing / self-hosting
const fs = require('fs');
const path = require('path');
const src = (f) => fs.readFileSync(path.join(__dirname, 'src', f), 'utf8');

const css = src('style.css');
const js = ['core.js', 'solitaire.js', 'tricks.js', 'canasta.js', 'others.js'].map(src).join('\n');

const sprite = `<svg width="0" height="0" style="position:absolute;width:0;height:0;overflow:hidden" aria-hidden="true" focusable="false"><defs>
<symbol id="s-h" viewBox="0 0 100 100"><path d="M50 92C22 68 3 51 3 30 3 14 15 5 28 5c11 0 18 7 22 15 4-8 11-15 22-15 13 0 25 9 25 25 0 21-19 38-47 62z"/></symbol>
<symbol id="s-d" viewBox="0 0 100 100"><path d="M50 3l36 47-36 47-36-47z"/></symbol>
<symbol id="s-s" viewBox="0 0 100 100"><path d="M50 3c8 16 46 36 46 59 0 15-11 24-24 24-9 0-16-5-19-11 1 11 5 18 13 23H34c8-5 12-12 13-23-3 6-10 11-19 11C15 86 4 77 4 62 4 39 42 19 50 3z"/></symbol>
<symbol id="s-c" viewBox="0 0 100 100"><circle cx="50" cy="28" r="22"/><circle cx="26" cy="59" r="22"/><circle cx="74" cy="59" r="22"/><path d="M45 48h10c1 26 5 40 14 49H31c9-9 13-23 14-49z"/></symbol>
<symbol id="s-j" viewBox="0 0 100 100"><path d="M50 4l11 33 35 1-28 21 10 34-28-20-28 20 10-34L4 38l35-1z"/></symbol>
</defs></svg>`;

const body = `<div id="app">
  <div id="menu" class="screen" hidden></div>
  <div id="game" class="screen" hidden>
    <div id="hdr"><button class="hbtn" id="hmenu" data-act="menu">Menu</button><div id="htitle"></div><div id="hbtns"></div></div>
    <div id="status"><div id="stl"></div><div id="str"></div></div>
    <div id="board"><div id="stage"></div></div>
  </div>
  <div id="dlg" hidden></div>
  <div id="toast" hidden></div>
</div>`;

const head = `<title>Card Games for Jahangir Kabir</title>
<meta name="claude:viewport-fit-sides" content="cover">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="Card Games">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:wght@400;700&display=swap">
<style>
${css}
</style>`;

const script = `<script>
${js}
(function () {
  function go() { window.CG.init(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go);
  else go();
})();
</script>`;

fs.mkdirSync(path.join(__dirname, 'dist'), { recursive: true });
const page = `${head}\n${sprite}\n${body}\n${script}\n`;
fs.writeFileSync(path.join(__dirname, 'dist', 'index.html'), page);
const full = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
${head}
</head>
<body>
${sprite}
${body}
${script}
</body>
</html>
`;
fs.writeFileSync(path.join(__dirname, 'dist', 'card-room.html'), full);
fs.mkdirSync(path.join(__dirname, 'docs'), { recursive: true });
fs.writeFileSync(path.join(__dirname, 'docs', 'index.html'), full);
fs.writeFileSync(path.join(__dirname, 'dist', 'all.js'), js);
console.log('built', (page.length / 1024).toFixed(1) + ' KB');
