import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PRIMARY_VOCABULARY } from '../src/vocabulary-primary.js';
import { VOCABULARY } from '../src/vocabulary-data.js';
import { PRIMARY_ADDITIONAL_WORDS, PRIMARY_EXPANSION_GROUPS, INTERMEDIATE_BRIDGE_GROUPS } from '../src/vocabulary-selections.js';
import { VOCABULARY_WORD_CORRECTIONS } from '../src/vocabulary-example-overrides.js';
import { CET_OFFICIAL_SOURCE, CET_OFFICIAL_WORDS, CET_OFFICIAL_EXCLUSIONS } from './data/cet-official-2016.js';
import { CET_CONTENT_SUPPLEMENT } from './data/cet-content-supplement.js';
import { CET_ADDITIONAL_CONTENT } from './data/cet-additional-content.js';
import { CET_REVIEWED_CONTENT } from './data/cet-reviewed-content.js';
import { CET_DERIVED_CONTENT_A } from './data/cet-derived-content-a.js';
import { CET_DERIVED_CONTENT_B } from './data/cet-derived-content-b.js';
import { CET_DERIVED_CONTENT_C } from './data/cet-derived-content-c.js';
import { CET_CANONICAL_CONTENT } from './data/cet-canonical-content.js';
import { SCHOOL_FOUNDATION_CONTENT } from './data/school-foundation-content.js';
import { SCHOOL_REVIEWED_CONTENT } from './data/school-reviewed-content.js';
import { clean,containsWord,createVocabularyEntry } from './vocabulary-content.mjs';

const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const commit='c4c6c80879ff17d7025c28fb853a4991c8e6be6a',sourceRoot=`https://raw.githubusercontent.com/KyleBing/english-vocabulary/${commit}`;
const args=process.argv.slice(2),sourceDirectory=args.find(arg=>!arg.startsWith('--')),checkOnly=args.includes('--check'),auditFile=args.find(arg=>arg.startsWith('--audit='))?.slice(8);
const primaryExpansionWords=PRIMARY_EXPANSION_GROUPS.flatMap(group=>group.words),expansionSet=new Set(primaryExpansionWords);
const primaryByWord=new Map(PRIMARY_VOCABULARY.map(entry=>[entry.word.toLowerCase(),entry])),primaryBase=PRIMARY_VOCABULARY.filter(entry=>!expansionSet.has(entry.word.toLowerCase()));
if(primaryByWord.size!==1000||PRIMARY_VOCABULARY.length!==1000||new Set(PRIMARY_VOCABULARY.map(entry=>entry.id)).size!==1000||primaryBase.length!==500||primaryExpansionWords.length!==500||expansionSet.size!==500||PRIMARY_ADDITIONAL_WORDS.length!==309||PRIMARY_ADDITIONAL_WORDS.some(word=>!primaryByWord.has(word)))throw new Error('Invalid primary selection');
const intermediateByWord=new Map(VOCABULARY.filter(entry=>entry.libraryId==='intermediate').map(entry=>[entry.word.toLowerCase(),entry]));
for(const entry of PRIMARY_VOCABULARY){
  if(entry.libraryId!=='primary'||!/^[a-z]{2,24}$/i.test(entry.word)||!entry.meaning||!/[\u3400-\u9fff]/.test(entry.meaning)||![0,1,2].includes(entry.group))throw new Error('Invalid primary entry: '+entry.id);
  for(const example of [entry.example,...(entry.example?.additional||[])])if(!example?.text||!example.meaning||!/[\u3400-\u9fff]/.test(example.meaning)||!['phrase','sentence'].includes(example.kind))throw new Error('Invalid primary example: '+entry.id);
}
for(const key of primaryExpansionWords){
  const entry=primaryByWord.get(key),source=intermediateByWord.get(key);
  if(!entry||!source||entry.id!=='primary-'+key||entry.group!==0||entry.word!==source.word||!entry.partOfSpeech||[entry.example,...(entry.example.additional||[])].some(example=>(!containsWord(example.text,entry.word)||example.sense&&!entry.meaning.split('；').includes(example.sense))))throw new Error('Primary expansion differs from intermediate source: '+key);
}
if(args.includes('--check-primary')){console.info('Primary vocabulary verified',JSON.stringify({words:primaryByWord.size,base:primaryBase.length,expansion:primaryExpansionWords.length,themes:PRIMARY_EXPANSION_GROUPS.length}));process.exit(0);}
const sources=[{id:'cet4',name:'四级'},{id:'cet6',name:'六级'},{id:'junior',name:'初中'},{id:'senior',name:'高中'},{id:'postgrad',name:'考研'},{id:'toefl',name:'托福'},{id:'sat',name:'SAT'}];
const normalizeWord=word=>VOCABULARY_WORD_CORRECTIONS[word]||word,isWord=word=>/^[a-z]{2,24}$/i.test(word);
const sourceRows=new Map(),allRecords=new Map(),schoolRecords=new Map();
for(const source of sources){
  const sourcePath=`full_line_jsonl/sentence/正序/${source.name}.jsonl`;
  const content=sourceDirectory?await fs.readFile(path.join(sourceDirectory,`vocabulary-${source.id}.jsonl`),'utf8'):await (async()=>{const response=await fetch(`${sourceRoot}/${sourcePath.split('/').map(encodeURIComponent).join('/')}`);if(!response.ok)throw new Error(`Vocabulary download failed: ${response.status} ${source.id}`);return response.text();})();
  const rows=content.trim().split('\n').map(line=>JSON.parse(line));sourceRows.set(source.id,rows);
  for(const row of rows){const word=normalizeWord(row.word);if(!isWord(word))continue;const key=word.toLowerCase(),records=allRecords.get(key)||[];records.push({...row,word,sourceId:source.id});allRecords.set(key,records);}
}
for(const id of ['junior','senior','cet4','cet6'])for(const row of sourceRows.get(id)){const word=normalizeWord(row.word);if(!isWord(word))continue;const key=word.toLowerCase(),records=schoolRecords.get(key)||[];records.push({...row,word});schoolRecords.set(key,records);}
for(const entry of [...PRIMARY_VOCABULARY,...SCHOOL_FOUNDATION_CONTENT]){const key=entry.word.toLowerCase(),records=allRecords.get(key)||[];records.push({word:entry.word,translations:[{translation:entry.meaning,type:entry.partOfSpeech||''}],[entry.example.kind==='phrase'?'phrases':'sentences']:[entry.example.kind==='phrase'?{phrase:entry.example.text,translation:entry.example.meaning}:{sentence:entry.example.text,translation:entry.example.meaning}],sourceId:'project-school'});allRecords.set(key,records);}
const curated=new Map([...CET_CONTENT_SUPPLEMENT,...CET_ADDITIONAL_CONTENT,...CET_REVIEWED_CONTENT].map(entry=>[entry.word.toLowerCase(),entry]));
const collegeCurated=new Map([...CET_DERIVED_CONTENT_A,...CET_DERIVED_CONTENT_B,...CET_DERIVED_CONTENT_C,...CET_CANONICAL_CONTENT].map(entry=>[entry.word.toLowerCase(),entry]));
for(const entries of [SCHOOL_FOUNDATION_CONTENT,SCHOOL_REVIEWED_CONTENT]){const keys=entries.map(entry=>entry.word.toLowerCase());if(new Set(keys).size!==keys.length)throw new Error('Duplicate school content');}
const schoolCurated=new Map([...SCHOOL_FOUNDATION_CONTENT,...SCHOOL_REVIEWED_CONTENT].map(entry=>[entry.word.toLowerCase(),entry]));
const currentEntries=new Map(VOCABULARY.map(entry=>[entry.id,entry]));
const unresolved=[],review=[],outputs=[],seen=new Set();
function createEntry(libraryId,key,word,pool,originalEntry){
  const result=createVocabularyEntry(libraryId,key,word,pool.get(key)||[],currentEntries.get(`${libraryId}-${key}`)||originalEntry||(libraryId==='intermediate'&&schoolCurated.get(key))||(libraryId.startsWith('cet')&&collegeCurated.get(key))||curated.get(key));
  if(result.error){unresolved.push({...result,sourceRows:(pool.get(key)||[]).map(row=>({sourceId:row.sourceId,translations:row.translations}))});return null;}
  const entry=result.entry,examples=[entry.example,...(entry.example?.additional||[])];if(!isWord(entry.word)||!entry.partOfSpeech||!entry.meaning||!/[\u3400-\u9fff]/.test(entry.meaning)||examples.some(example=>!example?.text||!example.meaning||!/[\u3400-\u9fff]/.test(example.meaning)||!['phrase','sentence'].includes(example.kind)||!containsWord(example.text,entry.word)||example.sense&&!entry.meaning.split('；').includes(example.sense))){unresolved.push({error:'Invalid vocabulary fields',libraryId,word,entry});return null;}
  if(result.needsReview)review.push(entry);return entry;
}
for(const level of [4,6]){
  const id=`cet${level}`,entries=[];
  for(const item of CET_OFFICIAL_WORDS.filter(item=>item.level===level)){
    const key=item.word.toLowerCase();if(!isWord(item.word)||seen.has(key))throw new Error(`Invalid official vocabulary word: ${key}`);seen.add(key);
    const entry=createEntry(id,key,item.word,allRecords);if(entry)entries.push(entry);
  }
  outputs.push({id,entries});
}
const intermediateWords=new Map(primaryBase.map(entry=>[entry.word.toLowerCase(),entry.word])),juniorWords=new Set();
for(const row of sourceRows.get('junior')){const word=normalizeWord(row.word);if(!isWord(word)||word==='Rusia')continue;const key=word.toLowerCase();juniorWords.add(key);if(!intermediateWords.has(key))intermediateWords.set(key,word);}
for(const entry of SCHOOL_FOUNDATION_CONTENT){const key=entry.word.toLowerCase();if(!intermediateWords.has(key))intermediateWords.set(key,entry.word);}
const bridgeWords=INTERMEDIATE_BRIDGE_GROUPS.flatMap(group=>group.words);
if(bridgeWords.length!==203||new Set(bridgeWords).size!==203)throw new Error('Invalid intermediate bridge selection');
for(const word of bridgeWords){if(!isWord(word)||intermediateWords.has(word)||!schoolRecords.has(word))throw new Error(`Invalid bridge word: ${word}`);intermediateWords.set(word,word);}
for(const key of schoolCurated.keys())if(!intermediateWords.has(key))throw new Error(`School correction has no selected word: ${key}`);
if(intermediateWords.size!==2200)throw new Error(`Invalid intermediate size: ${intermediateWords.size}`);
outputs.push({id:'intermediate',entries:[...intermediateWords].map(([key,word])=>createEntry('intermediate',key,primaryByWord.get(key)?.word||schoolCurated.get(key)?.word||word,schoolRecords,primaryByWord.get(key))).filter(Boolean)});
const report={commit,official:CET_OFFICIAL_SOURCE,excluded:CET_OFFICIAL_EXCLUSIONS.length,unresolved,review};
for(const {id,entries}of [{id:'primary',entries:PRIMARY_VOCABULARY},...outputs])report[id]={entries:entries.length,phrase:entries.filter(entry=>entry.example.kind==='phrase').length,sentence:entries.filter(entry=>entry.example.kind==='sentence').length,additionalExamples:entries.reduce((total,entry)=>total+(entry.example.additional?.length||0),0),longestWord:entries.reduce((longest,entry)=>entry.word.length>longest.length?entry.word:longest,'')};
if(auditFile)await fs.writeFile(auditFile,JSON.stringify(report,null,2));
if(unresolved.length)throw new Error(`Missing vocabulary content: ${unresolved.length}; use --audit to inspect`);
for(const {id,entries}of outputs){
  const file=path.join(root,`src/vocabulary-${id}.js`),content=`// 来源与许可见 third-party/english-vocabulary；由 scripts/import-vocabulary.mjs 生成。\nexport const ${id.toUpperCase()}_VOCABULARY = ${JSON.stringify(entries,null,2)};\n`;
  if(checkOnly){if(content!==await fs.readFile(file,'utf8'))throw new Error(`Vocabulary regeneration differs: ${id}`);}else await fs.writeFile(file,content);
}
console.log(JSON.stringify({...report,unresolved:unresolved.length,review:review.length},null,2));
