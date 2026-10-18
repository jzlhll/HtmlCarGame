import { cp, mkdir, readFile, writeFile, readdir, stat, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { GAME, AUDIO } from '../src/config.js';
import { VOICE_BANK_URL, VOICE_CLIPS } from '../src/voice-clips.js';
import { APP_VERSION } from '../src/version.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, '.pages-output');
const voiceBank = await readFile(VOICE_BANK_URL);
if (voiceBank.toString('ascii', 0, 4) !== 'RIFF' || voiceBank.toString('ascii', 8, 12) !== 'WAVE') throw new Error('Female voice bank is not a WAV file');
const voiceDuration = voiceBank.readUInt32LE(40) / voiceBank.readUInt32LE(28);
const spokenWords = new Set([AUDIO.voice.welcome, ...Object.values(AUDIO.voice.prepared), ...Object.values(AUDIO.voice.unprepared), ...Object.values(AUDIO.voice.events)]);
for (const words of spokenWords) {
  const clip = VOICE_CLIPS[words];
  if (!clip || !Number.isFinite(clip.offset) || !Number.isFinite(clip.duration) || clip.offset < 0 || clip.duration <= 0 || clip.offset + clip.duration > voiceDuration + 1e-6) {
    throw new Error('Regenerate female voice source for: ' + words);
  }
}

if (!/^\d+\.\d+\.\d+$/.test(APP_VERSION)) throw new Error('Application version must use major.minor.patch');
const manifest = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const lock = JSON.parse(await readFile(path.join(root, 'package-lock.json'), 'utf8'));
if ([manifest.version, lock.version, lock.packages[''].version].some(version => version !== APP_VERSION)) {
  throw new Error('Package versions must match APP_VERSION');
}
const releaseTag = process.env.RELEASE_TAG;
if (releaseTag && releaseTag.replace(/^v/, '') !== APP_VERSION) throw new Error(`Release tag ${releaseTag} does not match application version ${APP_VERSION}`);
await rm(output, {recursive: true, force: true});
await mkdir(output, { recursive: true });
await cp(path.join(root, 'src'), path.join(output, 'src'), { recursive: true });
const html = (await readFile(path.join(root, 'index.html'), 'utf8')).replaceAll('./node_modules/three/', './vendor/three/');
await writeFile(path.join(output, 'index.html'), html);
for (const file of ['build/three.module.js', 'build/three.core.js', 'examples/jsm/utils/BufferGeometryUtils.js', 'examples/jsm/geometries/RoundedBoxGeometry.js', 'LICENSE']) {
  const destination = path.join(output, 'vendor/three', file);
  await mkdir(path.dirname(destination), { recursive: true });
  await cp(path.join(root, 'node_modules/three', file), destination);
}
await writeFile(path.join(output, '.nojekyll'), '');
await writeFile(path.join(output, 'version.json'), JSON.stringify({version: APP_VERSION}) + '\n');
async function measure(directory) {
  const result = {files: 0, bytes: 0, gzipBytes: 0};
  for (const entry of await readdir(directory, {withFileTypes: true})) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      const child = await measure(file); result.files += child.files; result.bytes += child.bytes; result.gzipBytes += child.gzipBytes;
    } else {
      result.files++; result.bytes += (await stat(file)).size; result.gzipBytes += gzipSync(await readFile(file)).length;
    }
  }
  return result;
}
const size = await measure(output);
console.info('Static game files prepared ' + JSON.stringify({version:APP_VERSION,...size}));
if (size.bytes >= GAME.packageLimitMb * 1000000) throw new Error('Published files exceed configured package budget');
