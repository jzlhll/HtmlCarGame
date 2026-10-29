import { cp, mkdir, readFile, writeFile, readdir, stat, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { APP_VERSION } from '../src/config.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, '.pages-output');
const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const lock = JSON.parse(await readFile(path.join(root, 'package-lock.json'), 'utf8'));
if (pkg.version !== APP_VERSION || lock.version !== pkg.version || lock.packages[''].version !== pkg.version) throw new Error('Release versions differ');
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await cp(path.join(root, 'src'), path.join(output, 'src'), { recursive: true });
const html = (await readFile(path.join(root, 'index.html'), 'utf8')).replaceAll('./node_modules/three/', './vendor/three/');
await writeFile(path.join(output, 'index.html'), html);
for (const file of ['build/three.module.js', 'build/three.core.js', 'LICENSE']) {
  const target = path.join(output, 'vendor/three', file);
  await mkdir(path.dirname(target), { recursive: true });
  await cp(path.join(root, 'node_modules/three', file), target);
}
await writeFile(path.join(output, '.nojekyll'), '');
async function size(directory) {
  let bytes = 0, gzipBytes = 0;
  for (const name of await readdir(directory)) {
    const file = path.join(directory, name);
    if ((await stat(file)).isDirectory()) {
      const child = await size(file); bytes += child.bytes; gzipBytes += child.gzipBytes;
    } else {
      const data = await readFile(file); bytes += data.length; gzipBytes += gzipSync(data).length;
    }
  }
  return { bytes, gzipBytes };
}
const result = await size(output);
if (result.bytes > 10000000) throw new Error('Deployment exceeds 10 MB');
console.info('Brick Time static package prepared', { ...result, output });
