import {readFile,writeFile,mkdir,readdir,rm,mkdtemp} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {AUDIO} from '../src/config.js';

// 固定英文女声源素材；发布时直接携带，不要求部署机器安装macOS语音。
if(process.platform!=='darwin')throw new Error('Voice source regeneration requires macOS Samantha');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const directory=path.join(root,'src/voice'),temporary=await mkdtemp(path.join(tmpdir(),'flight-voice-'));
const rate=16000,padding=Buffer.alloc(rate/10*2),parts=[],clips={};let frames=0;
const words=[...new Set([AUDIO.voice.welcome,...Object.values(AUDIO.voice.prepared),...Object.values(AUDIO.voice.unprepared),...Object.values(AUDIO.voice.events)])];
try{
 for(const [index,text]of words.entries()){
  const file=path.join(temporary,index+'.wav');
  const result=spawnSync('/usr/bin/say',['-v','Samantha','-r','185','-o',file,'--file-format=WAVE','--data-format=LEI16@16000',text],{encoding:'utf8'});
  if(result.status!==0)throw new Error('Voice synthesis failed: '+text+' '+result.stderr);
  const wav=await readFile(file);let pcm,format;
  if(wav.toString('ascii',0,4)!=='RIFF'||wav.toString('ascii',8,12)!=='WAVE')throw new Error('Invalid voice WAV');
  for(let at=12;at+8<=wav.length;){const type=wav.toString('ascii',at,at+4),size=wav.readUInt32LE(at+4),start=at+8;if(type==='fmt ')format=wav.subarray(start,start+size);if(type==='data')pcm=wav.subarray(start,start+size);at=start+size+(size%2);}
  if(!format||format.readUInt16LE(0)!==1||format.readUInt16LE(2)!==1||format.readUInt32LE(4)!==rate||format.readUInt16LE(14)!==16||!pcm?.length)throw new Error('Voice contains no supported PCM data: '+text);
  let peak=0;for(let i=0;i<pcm.length;i+=2)peak=Math.max(peak,Math.abs(pcm.readInt16LE(i)));if(peak<100)throw new Error('Voice is silent: '+text);
  parts.push(padding,pcm,padding);frames+=padding.length/2;
  clips[text]={offset:frames/rate,duration:pcm.length/2/rate};frames+=pcm.length/2+padding.length/2;
  console.info('Voice clip prepared '+JSON.stringify({index:index+1,total:words.length,text,seconds:clips[text].duration}));
 }
 const pcm=Buffer.concat(parts),header=Buffer.alloc(44);header.write('RIFF');header.writeUInt32LE(36+pcm.length,4);header.write('WAVEfmt ',8);header.writeUInt32LE(16,16);header.writeUInt16LE(1,20);header.writeUInt16LE(1,22);header.writeUInt32LE(rate,24);header.writeUInt32LE(rate*2,28);header.writeUInt16LE(2,32);header.writeUInt16LE(16,34);header.write('data',36);header.writeUInt32LE(pcm.length,40);
 const bank=Buffer.concat([header,pcm]),digest=createHash('sha256').update(bank).digest('hex').slice(0,12),name='english-female-'+digest+'.wav';
 await mkdir(directory,{recursive:true});await writeFile(path.join(directory,name),bank);
 await writeFile(path.join(root,'src/voice-clips.js'),'// 同一Samantha女声的固定短句；时间单位为秒，由generate-voice.mjs生成。\nexport const VOICE_BANK_URL = new URL('+JSON.stringify('./voice/'+name)+', import.meta.url);\nexport const VOICE_CLIPS = '+JSON.stringify(clips,null,2)+';\n');
 for(const old of await readdir(directory))if(/^english-female-[a-f0-9]+\.wav$/.test(old)&&old!==name)await rm(path.join(directory,old));
 console.info('Female voice bank prepared '+JSON.stringify({clips:words.length,bytes:bank.length,seconds:frames/rate,file:name}));
}finally{await rm(temporary,{recursive:true,force:true});}
