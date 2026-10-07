import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, '.pages-output');
await mkdir(output, { recursive: true });
await cp(path.join(root, 'src'), path.join(output, 'src'), { recursive: true });
const html = (await readFile(path.join(root, 'index.html'), 'utf8')).replaceAll('./node_modules/three/', './vendor/three/');
await writeFile(path.join(output, 'index.html'), html);
for (const file of ['build/three.module.js', 'build/three.core.js', 'examples/jsm/utils/BufferGeometryUtils.js', 'LICENSE']) {
  const destination = path.join(output, 'vendor/three', file);
  await mkdir(path.dirname(destination), { recursive: true });
  await cp(path.join(root, 'node_modules/three', file), destination);
}
await writeFile(path.join(output, '.nojekyll'), '');
console.log('Static game files prepared in .pages-output');
