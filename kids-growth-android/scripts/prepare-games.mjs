import { cp, mkdir, readFile, writeFile, readdir, stat, rm, rename } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { integrateGame } from './integrate-game.mjs';

const androidRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repository = path.resolve(androidRoot, '..');
const projects = ['car-game', 'low-altitude-flight', 'english-air-combat'];
const argumentsList = process.argv.slice(2);
for (const argument of argumentsList) {
  if (!argument.startsWith('--game=') && !argument.startsWith('--output=')) throw new Error('Unknown argument: ' + argument);
}
const requestedGame = argumentsList.find(value => value.startsWith('--game='))?.slice(7);
if (requestedGame && !projects.includes(requestedGame)) throw new Error('Unknown game: ' + requestedGame);
const selected = requestedGame ? [requestedGame] : projects;
const output = path.resolve(argumentsList.find(value => value.startsWith('--output='))?.slice(9) || path.join(androidRoot, 'app/build/generated/gameAssets'));
const buildRoots = [path.join(androidRoot, 'build'), path.join(androidRoot, 'app/build')];
if (!buildRoots.some(directory => output.startsWith(directory + path.sep))) throw new Error('Output must be inside kids-growth-android build directories');
const stage = output + '.preparing-' + process.pid;
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const threeFiles = ['build/three.module.js', 'build/three.core.js', 'LICENSE'];
const addons = {
  'car-game': ['examples/jsm/utils/BufferGeometryUtils.js'],
  'low-altitude-flight': ['examples/jsm/utils/BufferGeometryUtils.js', 'examples/jsm/geometries/RoundedBoxGeometry.js', 'examples/jsm/math/ImprovedNoise.js'],
  'english-air-combat': []
};

function run(command, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, stdio: 'inherit', shell: process.platform === 'win32' && command === npmCommand });
    child.once('error', reject);
    child.once('exit', (code, signal) => code === 0 ? resolve() : reject(new Error('Command failed: ' + command + ' (' + (signal || code) + ')')));
  });
}

async function ensureDependencies(root) {
  const manifest = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
  const lock = JSON.parse(await readFile(path.join(root, 'package-lock.json'), 'utf8'));
  if (lock.version !== manifest.version || lock.packages?.['']?.version !== manifest.version) throw new Error('Package versions differ: ' + root);
  let intact = true;
  try {
    const installedLock = JSON.parse(await readFile(path.join(root, 'node_modules/.package-lock.json'), 'utf8'));
    for (const [name, expected] of Object.entries(lock.packages)) {
      if (!name) continue;
      const actual = installedLock.packages?.[name];
      const installed = JSON.parse(await readFile(path.join(root, name, 'package.json'), 'utf8'));
      if (!actual || actual.version !== expected.version || actual.integrity !== expected.integrity || installed.version !== expected.version) intact = false;
    }
    for (const file of threeFiles) await stat(path.join(root, 'node_modules/three', file));
  } catch { intact = false; }
  if (!intact) {
    console.info('Installing locked game dependencies: ' + path.basename(root));
    await run(npmCommand, ['ci', '--no-audit', '--no-fund', '--prefer-offline'], root);
  }
  const versionSource = await readFile(path.join(root, 'src/version.js'), 'utf8');
  const version = versionSource.match(/export const APP_VERSION\s*=\s*['"]v?(\d+\.\d+\.\d+)['"]/);
  if (!version || version[1] !== manifest.version) throw new Error('Game version differs from package: ' + root);
  return manifest.version;
}

async function rewriteModules(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) await rewriteModules(file);
    else if (entry.name.endsWith('.js')) {
      const original = await readFile(file, 'utf8');
      const updated = original.replaceAll('../node_modules/three/', '../vendor/three/');
      if (updated !== original) await writeFile(file, updated);
    }
  }
}

async function measure(directory) {
  let bytes = 0, files = 0;
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      const child = await measure(file);
      bytes += child.bytes; files += child.files;
    } else { bytes += (await stat(file)).size; files++; }
  }
  return { bytes, files };
}

async function fingerprint(directory) {
  const hash = createHash('sha256');
  async function visit(root, prefix = '') {
    const entries = await readdir(root, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name, 'en'));
    for (const entry of entries) {
      const file = path.join(root, entry.name), relative = prefix + entry.name;
      if (entry.isDirectory()) await visit(file, relative + '/');
      else { hash.update(relative); hash.update(await readFile(file)); }
    }
  }
  await visit(directory);
  return hash.digest('hex');
}

async function prepare(project) {
  const root = path.join(repository, project), target = path.join(stage, 'games', project);
  const version = await ensureDependencies(root);
  if (project === 'low-altitude-flight') await run(process.execPath, ['scripts/generate-assets.mjs'], root);
  await mkdir(target, { recursive: true });
  await cp(path.join(root, 'src'), path.join(target, 'src'), { recursive: true });
  await rewriteModules(path.join(target, 'src'));
  if (project === 'low-altitude-flight') {
    await cp(path.join(root, 'assets/generated'), path.join(target, 'assets/generated'), { recursive: true });
  } else {
    const { resourceSourcesModule } = await import(pathToFileURL(path.join(root, 'scripts/resource-sources.mjs')).href);
    await writeFile(path.join(target, 'src/resource-sources.js'), await resourceSourcesModule(root));
  }
  if (project === 'english-air-combat') await cp(path.join(root, 'third-party'), path.join(target, 'third-party'), { recursive: true });
  // Android 包保留赛车本机功能，不使用 Pages 中专门移除键盘学习的裁剪逻辑。
  const html = (await readFile(path.join(root, 'index.html'), 'utf8')).replaceAll('./node_modules/three/', './vendor/three/');
  await writeFile(path.join(target, 'index.html'), html);
  for (const file of [...threeFiles, ...addons[project]]) {
    const destination = path.join(target, 'vendor/three', file);
    await mkdir(path.dirname(destination), { recursive: true });
    if (file.endsWith('.js')) {
      // 模块 Worker 无 import map，把 addon 对引擎的引用改成同包相对路径。
      const engine = path.relative(path.dirname(file), 'build/three.module.js').split(path.sep).join('/');
      const relative = engine.startsWith('.') ? engine : './' + engine;
      const source = (await readFile(path.join(root, 'node_modules/three', file), 'utf8')).replace(/from (['"])three\1/g, "from '" + relative + "'");
      await writeFile(destination, source);
    } else await cp(path.join(root, 'node_modules/three', file), destination);
  }
  await integrateGame(project, target);
  await writeFile(path.join(target, 'version.json'), JSON.stringify({ version }) + '\n');
  const size = await measure(target);
  const limit = project === 'low-altitude-flight' ? 50000000 : 10000000;
  if (size.bytes >= limit) throw new Error('Android game assets exceed budget: ' + project + ' (' + size.bytes + ')');
  const item = { id: project, version, entry: 'games/' + project + '/index.html', fingerprint: await fingerprint(target), ...size };
  console.info('Android game assets prepared ' + JSON.stringify(item));
  return item;
}

await rm(stage, { recursive: true, force: true });
try {
  await mkdir(stage, { recursive: true });
  const games = [];
  for (const project of selected) games.push(await prepare(project));
  if (requestedGame) {
    await mkdir(path.join(output, 'games'), { recursive: true });
    for (const item of games) {
      const destination = path.join(output, 'games', item.id);
      await rm(destination, { recursive: true, force: true });
      await rename(path.join(stage, 'games', item.id), destination);
    }
    let previous = [];
    try { previous = JSON.parse(await readFile(path.join(output, 'games.json'), 'utf8')).games; } catch {}
    const combined = [...previous.filter(item => !selected.includes(item.id)), ...games];
    await writeFile(path.join(output, 'games.json'), JSON.stringify({ format: 1, games: combined }, null, 2) + '\n');
  } else {
    await writeFile(path.join(stage, 'games.json'), JSON.stringify({ format: 1, games }, null, 2) + '\n');
    await rm(output, { recursive: true, force: true });
    await mkdir(path.dirname(output), { recursive: true });
    await rename(stage, output);
  }
  console.info('Android offline assets ready: ' + output);
} finally {
  await rm(stage, { recursive: true, force: true });
}
