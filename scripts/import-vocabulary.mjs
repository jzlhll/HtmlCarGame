import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PRIMARY_VOCABULARY } from '../src/vocabulary-primary.js';
import { PRIMARY_ADDITIONAL_WORDS, INTERMEDIATE_BRIDGE_GROUPS } from '../src/vocabulary-selections.js';
import {
  VOCABULARY_EXAMPLE_OVERRIDES,
  SCHOOL_EXAMPLE_OVERRIDES,
  SCHOOL_MEANING_CORRECTIONS,
  VOCABULARY_WORD_CORRECTIONS,
  VOCABULARY_MEANING_CORRECTIONS,
} from '../src/vocabulary-example-overrides.js';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const commit = 'c4c6c80879ff17d7025c28fb853a4991c8e6be6a';
const sourceRoot = `https://raw.githubusercontent.com/KyleBing/english-vocabulary/${commit}`;
const sourceDirectory = process.argv[2];
const sources = [{ id: 'cet4', name: '四级' }, { id: 'cet6', name: '六级' }, { id: 'junior', name: '初中' }, { id: 'senior', name: '高中' }];
const clean = value => String(value || '').replace(/\s+/g, ' ').trim();
const normalizeWord = word => VOCABULARY_WORD_CORRECTIONS[word] || word;
const isWord = word => /^[a-z]{2,24}$/i.test(word);

function wordForms(word) {
  const forms = [word, `${word}s`, `${word}es`, `${word}ed`, `${word}ing`];
  if (word.endsWith('e')) forms.push(`${word.slice(0, -1)}ing`, `${word}d`);
  if (word.endsWith('y')) forms.push(`${word.slice(0, -1)}ies`, `${word.slice(0, -1)}ied`);
  if (/[aeiou][bcdfghjklmnpqrstvwxyz]$/.test(word)) forms.push(`${word}${word.at(-1)}ed`, `${word}${word.at(-1)}ing`);
  return forms;
}

function containsWord(text, word) {
  const tokens = text.toLowerCase().match(/[a-z]+/g) || [];
  return wordForms(word).some(form => tokens.includes(form));
}

function exampleScore(example, word) {
  const tokens = example.text.split(/\s+/).length;
  const target = example.kind === 'phrase' ? 2 : 10;
  const domainTerms = /\b(adsorption|chromatography|polymer|semiconductor|hydraulic|turbine|electrode|coefficient|sulfate|voltage|welding|tensile|stator|rotor|crusher|spectrometry|spectroscopy|elimination|concrete|convection|chromium|carbide|chloride|sodium|hydrogen|molecular|catalyst|thermal|isotope|impedance|silicon|condenser|junction|gram stain)\b/i;
  return Math.abs(tokens - target) + (example.text.length > 100 ? 8 : 0)
    + (domainTerms.test(example.text) ? 6 : 0)
    + (/[,;；，]/.test(example.meaning) ? .3 : 0)
    + (/[\[（(]/.test(example.meaning) ? 2 : 0)
    + (/\b(for|on|from|with|into|of|at|in)$/i.test(example.text) ? 1 : 0)
    + (!example.text.toLowerCase().split(/[^a-z]+/).includes(word) ? 2 : 0);
}

const collegeRecords = new Map();
const schoolRecords = new Map();
const sourceRows = new Map();
for (const source of sources) {
  const sourcePath = `full_line_jsonl/sentence/正序/${source.name}.jsonl`;
  const content = sourceDirectory
    ? await fs.readFile(path.join(sourceDirectory, `vocabulary-${source.id}.jsonl`), 'utf8')
    : await (async () => {
      const response = await fetch(`${sourceRoot}/${sourcePath.split('/').map(encodeURIComponent).join('/')}`);
      if (!response.ok) throw new Error(`Vocabulary download failed: ${response.status} ${source.id}`);
      return response.text();
    })();
  const rows = content.trim().split('\n').map(line => JSON.parse(line));
  sourceRows.set(source.id, rows);
  for (const row of rows) {
    const word = normalizeWord(row.word);
    if (!isWord(word)) continue;
    const key = word.toLowerCase();
    for (const pool of ['cet4', 'cet6'].includes(source.id) ? [collegeRecords] : []) {
      const records = pool.get(key) || [];
      records.push({ ...row, word });
      pool.set(key, records);
    }
  }
}

for (const id of ['junior', 'senior', 'cet4', 'cet6']) {
  for (const row of sourceRows.get(id)) {
    const word = normalizeWord(row.word);
    if (!isWord(word)) continue;
    const key = word.toLowerCase();
    const records = schoolRecords.get(key) || [];
    records.push({ ...row, word });
    schoolRecords.set(key, records);
  }
}

const missing = [];
function createEntry(libraryId, key, word, pool, originalEntry) {
  const rows = pool.get(key) || [];
  const candidates = rows.flatMap(row => [
    ...(row.phrases || []).map(item => ({ text: clean(item.phrase), meaning: clean(item.translation), kind: 'phrase' })),
    ...(row.sentences || []).map(item => ({ text: clean(item.sentence), meaning: clean(item.translation), kind: 'sentence' })),
  ]).filter(item => item.text && item.meaning && /[\u3400-\u9fff]/.test(item.meaning)
    && !/[\uFFFD\u0000-\u001F]/.test(item.text + item.meaning)
    && !/美国著名影星|人名|姓氏/.test(item.meaning)
    && containsWord(item.text, key));
  const phrases = candidates.filter(item => item.kind === 'phrase');
  const selected = (phrases.length ? phrases : candidates).sort((a, b) => exampleScore(a, key) - exampleScore(b, key))[0];
  let example = originalEntry?.example || (libraryId === 'intermediate' && SCHOOL_EXAMPLE_OVERRIDES[key]) || VOCABULARY_EXAMPLE_OVERRIDES[key] || selected;
  if (!example) { missing.push({ libraryId, word, translations: rows[0]?.translations }); return null; }
  if (!containsWord(example.text, key)) throw new Error(`Example does not contain word: ${libraryId}/${key}`);
  example = { ...example, text: example.text[0].toUpperCase() + example.text.slice(1) };
  const meanings = [...new Set(rows.flatMap(row => row.translations || [])
    .filter(item => libraryId !== 'intermediate' || !/人名/.test(item.translation))
    .map(item => clean(item.translation)).filter(text => /[\u3400-\u9fff]/.test(text)))];
  const senses = [...new Set(meanings.flatMap(meaning => meaning.split(/[，,；;]/)).map(clean).filter(Boolean))];
  const meaning = originalEntry?.meaning || (libraryId === 'intermediate' && SCHOOL_MEANING_CORRECTIONS[key]) || VOCABULARY_MEANING_CORRECTIONS[key] || senses.slice(0, 4).join('；');
  if (!meaning) throw new Error(`Missing vocabulary meaning: ${libraryId}/${key}`);
  return { id: `${libraryId}-${key}`, libraryId, word, meaning, group: 0, example };
}

const report = {};
const outputs = [];
for (const source of sources.slice(0, 2)) {
  const words = new Map();
  const excluded = [];
  for (const row of sourceRows.get(source.id)) {
    const word = normalizeWord(row.word);
    if (!isWord(word)) { excluded.push(row.word); continue; }
    if (!words.has(word.toLowerCase())) words.set(word.toLowerCase(), word);
  }
  const entries = [...words].map(([key, word]) => createEntry(source.id, key, word, collegeRecords));
  outputs.push({ id: source.id, entries });
  report[source.id] = { sourceRows: sourceRows.get(source.id).length, entries: entries.length, excluded };
}

const primaryByWord = new Map(PRIMARY_VOCABULARY.map(entry => [entry.word.toLowerCase(), entry]));
if (primaryByWord.size !== 500 || PRIMARY_ADDITIONAL_WORDS.length !== 309
  || PRIMARY_ADDITIONAL_WORDS.some(word => !primaryByWord.has(word))) throw new Error('Invalid primary selection');
const intermediateWords = new Map(PRIMARY_VOCABULARY.map(entry => [entry.word.toLowerCase(), entry.word]));
const juniorWords = new Set();
for (const row of sourceRows.get('junior')) {
  const word = normalizeWord(row.word);
  if (!isWord(word) || word === 'Rusia') continue;
  const key = word.toLowerCase();
  juniorWords.add(key);
  if (!intermediateWords.has(key)) intermediateWords.set(key, word);
}
const primaryBeyondJunior = [...primaryByWord.keys()].filter(word => !juniorWords.has(word));
const bridgeWords = INTERMEDIATE_BRIDGE_GROUPS.flatMap(group => group.words);
if (bridgeWords.length !== 203 || new Set(bridgeWords).size !== 203) throw new Error('Invalid intermediate bridge selection');
for (const word of bridgeWords) {
  if (!isWord(word) || intermediateWords.has(word) || !schoolRecords.has(word)) throw new Error(`Invalid bridge word: ${word}`);
  intermediateWords.set(word, word);
}
if (intermediateWords.size !== 2200) throw new Error(`Invalid intermediate size: ${intermediateWords.size}`);
const intermediate = [...intermediateWords].map(([key, word]) => createEntry('intermediate', key, word, schoolRecords, primaryByWord.get(key)));
outputs.push({ id: 'intermediate', entries: intermediate });
report.intermediate = { entries: intermediate.length, junior: juniorWords.size, primaryBeyondJunior, bridge: bridgeWords.length };
if (missing.length) throw new Error(`Missing vocabulary examples: ${JSON.stringify(missing)}`);

for (const { id, entries } of outputs) {
  const phrases = entries.filter(entry => entry.example.kind === 'phrase').length;
  report[id].phrase = phrases;
  report[id].sentence = entries.length - phrases;
  report[id].longestWord = entries.reduce((longest, entry) => entry.word.length > longest.length ? entry.word : longest, '');
  const header = '// 来源与许可见 third-party/english-vocabulary；由 scripts/import-vocabulary.mjs 生成。\n';
  await fs.writeFile(path.join(root, `src/vocabulary-${id}.js`), `${header}export const ${id.toUpperCase()}_VOCABULARY = ${JSON.stringify(entries, null, 2)};\n`);
}
console.log(JSON.stringify({ commit, ...report }, null, 2));
