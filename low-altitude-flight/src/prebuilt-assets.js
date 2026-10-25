import { decodeAssetPack } from './asset-pack.js';

// 按内容去重的资源并行恢复；全部异步任务结束后才向生成队列开放数值记录。
export async function loadPrebuiltAssets(resources,{read,write,onManifest}={}){
  if(typeof window==='undefined'||typeof DecompressionStream!=='function')return new Map();
  const started=performance.now(),records=new Map();let bytes=0,groups=0;
  try{
    const url=new URL('../assets/generated/manifest.json',import.meta.url),response=await fetch(url);
    if(!response.ok)return records;
    const manifest=await response.json();if(manifest.format!==1||!manifest.resources)return records;
    const allPacks=Object.values(manifest.resources).flatMap(entry=>entry.packs);
    if(!allPacks.every(pack=>pack&&/^[a-f0-9]{24}\.bin\.gz$/.test(pack.file)&&Number.isSafeInteger(pack.bytes)&&pack.bytes>0&&Number.isSafeInteger(pack.decodedBytes)&&pack.decodedBytes>0))throw new Error('Invalid asset manifest');
    onManifest?.(new Set(allPacks.map(pack=>pack.file)));
    const pending=new Map(),bindings=[];
    for(const prefix of resources.values()){
      const signature=prefix.replace('cloud-cockpit/','').replace('/resource/','/'),entry=manifest.resources[signature];if(!entry)continue;
      for(const pack of entry.packs){
        if(!pending.has(pack.file))pending.set(pack.file,loadPack(pack));
        bindings.push({prefix,file:pack.file});
      }
    }
    const settled=await Promise.allSettled(pending.values()),files=new Map();
    [...pending.keys()].forEach((file,i)=>{
      const result=settled[i];if(result.status==='fulfilled')files.set(file,result.value);
      else console.warn('Prebuilt resource fallback '+file,result.reason);
    });
    for(const {prefix,file}of bindings){const group=files.get(file);if(group)for(const [suffix,value]of Object.entries(group))records.set(prefix+suffix,value);}
    console.info('Prebuilt assets loaded '+JSON.stringify({groups,records:records.size,bytes,ms:Math.round(performance.now()-started)}));

    async function loadPack(pack){
      const key='prebuilt/'+pack.file,cached=await read?.(key);
      if(cached instanceof ArrayBuffer)try{return await unpack(cached,pack);}catch{}
      const response=await fetch(new URL(pack.file,url));if(!response.ok)throw new Error('Asset pack response '+response.status);
      const compressed=await response.arrayBuffer(),group=await unpack(compressed,pack);
      // 校验通过再写入；持久失败仍可复用当前会话，不将坏缓存变成永久回退。
      await write?.(key,compressed);return group;
    }
    async function unpack(compressed,pack){
      if(compressed.byteLength!==pack.bytes)throw new Error('Asset pack size mismatch');
      const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',compressed)),value=>value.toString(16).padStart(2,'0')).join('').slice(0,24);
      if(hash+'.bin.gz'!==pack.file)throw new Error('Asset pack hash mismatch');
      const data=await new Response(new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
      if(data.byteLength!==pack.decodedBytes)throw new Error('Decoded asset size mismatch');
      const group=decodeAssetPack(data);bytes+=compressed.byteLength;groups++;return group;
    }
  }catch(error){console.warn('Prebuilt assets unavailable',error);}
  return records;
}
