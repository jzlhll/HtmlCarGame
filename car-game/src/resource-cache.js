import { APP_VERSION, CACHE_FORMAT_VERSION } from './version.js';
const DATABASE='htmlCarGame.models.v1';
const generatedName=name=>/^htmlcargame[.\-_](?:models?|assets?|generated|cache)(?:[.\-_]|$)/i.test(name);
const transactionDone=transaction=>new Promise((resolve,reject)=>{transaction.oncomplete=()=>resolve();transaction.onerror=()=>reject(transaction.error??new Error('Cache transaction failed'));transaction.onabort=()=>reject(transaction.error??new Error('Cache transaction aborted'));});
const requestValue=(request,optional=false)=>new Promise((resolve,reject)=>{
  request.onsuccess=()=>resolve(request.result);
  request.onerror=event=>{
    if(!optional){reject(request.error);return;}
    // 单项读取失败只视为未命中，阻止错误冒泡和默认的整笔事务中止。
    event.preventDefault();event.stopPropagation();console.warn('Cached model resource read failed, rebuilding',request.error);resolve(null);
  };
});
const versionNumber=version=>/^v\d+\.\d+\.\d+$/.test(version??'')?version.slice(1).split('.').map(Number):null;
export function newerVersion(left,right){const a=versionNumber(left),b=versionNumber(right);if(!a||!b)return false;for(let i=0;i<3;i++)if(a[i]!==b[i])return a[i]>b[i];return false;}
export class ResourceCache {
  constructor(){this.db=null;this.persistent=false;this.warning='';this.previous=null;this.cleaned={resources:0,databases:0,caches:0,keys:0};}
  unavailable(error){
    console.warn('Persistent model cache unavailable',error);this.persistent=false;this.warning='浏览器无法保存模型资源，本次仅在当前页面准备，刷新后可能重新准备。';
  }
  async open(){
    try{
      if(!globalThis.indexedDB)throw new Error('IndexedDB is unavailable');
      this.db=await new Promise((resolve,reject)=>{
        const request=indexedDB.open(DATABASE,1);let blocked=false;
        request.onupgradeneeded=()=>{for(const name of ['resources','meta'])if(!request.result.objectStoreNames.contains(name))request.result.createObjectStore(name);};
        request.onerror=()=>reject(request.error);
        request.onblocked=()=>{blocked=true;reject(new Error('Model database upgrade is blocked'));};
        request.onsuccess=()=>{if(blocked)request.result.close();else resolve(request.result);};
      });
      this.db.onversionchange=()=>{this.db.close();this.unavailable(new Error('Model cache changed in another page'));};
      this.persistent=true;
      const tx=this.db.transaction('meta','readonly'),done=transactionDone(tx);[this.previous]=await Promise.all([requestValue(tx.objectStore('meta').get('successful-version')),done]);
    }catch(error){this.unavailable(error);}
    return this;
  }
  async read(key){
    if(!this.persistent)return null;
    try{
      const tx=this.db.transaction('resources','readonly'),done=transactionDone(tx);
      const [value]=await Promise.all([requestValue(tx.objectStore('resources').get(key),true),done]);
      return value??null;
    }catch(error){this.unavailable(error);return null;}
  }
  async write(resource,data){
    if(!this.persistent)return false;
    try{const tx=this.db.transaction('resources','readwrite'),done=transactionDone(tx);tx.objectStore('resources').put({key:resource.key,id:resource.id,format:CACHE_FORMAT_VERSION,data},resource.key);await done;return true;}
    catch(error){this.unavailable(error);return false;}
  }
  async finish(resources){
    if(!this.persistent)return false;
    const latest=this.db.transaction('meta','readonly'),readDone=transactionDone(latest);
    const [current]=await Promise.all([requestValue(latest.objectStore('meta').get('successful-version')),readDone]);
    if(newerVersion(current?.appVersion,APP_VERSION)){
      this.warning='已保留较新版本的资源记录；当前页面按自己的版本运行。';return false;
    }
    const keys=resources.map(resource=>resource.key),keep=new Set(keys);
    // 新资源全部确认写入后才删除旧结果；存档、颜色与儿童模式键不在清理范围内。
    const tx=this.db.transaction('resources','readwrite'),done=transactionDone(tx),cursor=tx.objectStore('resources').openCursor();
    cursor.onsuccess=()=>{const entry=cursor.result;if(!entry)return;if(!keep.has(entry.key)){entry.delete();this.cleaned.resources++;}entry.continue();};await done;
    if(indexedDB.databases){
      for(const info of await indexedDB.databases())if(info.name!==DATABASE&&generatedName(info.name)){
        await new Promise((resolve,reject)=>{const request=indexedDB.deleteDatabase(info.name);request.onsuccess=()=>resolve();request.onerror=()=>reject(request.error);request.onblocked=()=>reject(new Error('Close other game pages before clearing legacy models'));});this.cleaned.databases++;
      }
    }
    if(globalThis.caches)for(const name of await caches.keys())if(generatedName(name)){if(await caches.delete(name))this.cleaned.caches++;}
    try{for(const key of Object.keys(localStorage))if(generatedName(key)){localStorage.removeItem(key);this.cleaned.keys++;}}
    catch(error){console.warn('Legacy model preferences inaccessible',error);}
    const meta=this.db.transaction('meta','readwrite'),committed=transactionDone(meta);
    meta.objectStore('meta').put({appVersion:APP_VERSION,format:CACHE_FORMAT_VERSION,keys,completedAt:new Date().toISOString()},'successful-version');await committed;
    return true;
  }
  close(){this.db?.close();}
}
