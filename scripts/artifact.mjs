// Builds the page that is published as the Claude artifact: the body of dist/index.html (the artifact
// host adds its own <html>/<head>/<body>), pointing at the hashed bundle in ./assets. The touch test
// serves exactly this folder, so what passes the test is what gets published.
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const dist = path.join(root, 'dist');
const out = path.join(root, 'artifact');
const html = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
const js = html.match(/src="\.\/assets\/([^"]+\.js)"/)?.[1];
const css = html.match(/href="\.\/assets\/([^"]+\.css)"/)?.[1];
const body = html.match(/<body>([\s\S]*)<\/body>/)?.[1];
if (!js || !css || !body) throw new Error('dist/index.html is missing the bundle, the stylesheet or the body');

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(path.join(out, 'assets'), { recursive: true });
for (const f of [js, css]) fs.copyFileSync(path.join(dist, 'assets', f), path.join(out, 'assets', f));
const page = `<title>Order Up</title>
<meta name="theme-color" content="#ff8a2b">
<link rel="stylesheet" href="./assets/${css}">
<style>html,body{height:100%;background:#2b1640}</style>
${body.trim()}
<script type="module" src="./assets/${js}"></script>
`;
fs.writeFileSync(path.join(out, 'order-up.html'), page);
console.warn(`artifact/order-up.html -> assets/${js}, assets/${css}`);
