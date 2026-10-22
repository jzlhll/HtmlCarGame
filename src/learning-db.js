const NAME='english-air-combat-learning';
function requestValue(request){return new Promise((resolve,reject)=>{request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});}
function completed(tx){return new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error('Learning transaction aborted'));});}
export class LearningDB {
  constructor(accountId){if(!/^pilot-[a-z0-9-]+$|^test0[1-9]$/.test(accountId))throw new Error('Learning account required');this.name=NAME+'-'+accountId;this.db=null;this.pending=Promise.resolve();}
  static discardLegacy(){
    if(typeof indexedDB==='undefined')return Promise.resolve(true);
    return new Promise(resolve=>{
      let request;const timer=setTimeout(()=>resolve(false),1800),finish=ok=>{clearTimeout(timer);resolve(ok);};
      try{request=indexedDB.deleteDatabase(NAME);}catch(error){console.warn('Legacy learning database cleanup failed',error);finish(false);return;}
      request.onsuccess=()=>finish(true);request.onerror=()=>{console.warn('Legacy learning database cleanup failed',request.error);finish(false);};request.onblocked=()=>finish(false);
    });
  }
  async open(){
    const request=indexedDB.open(this.name,2);request.onupgradeneeded=()=>{const db=request.result;if(!db.objectStoreNames.contains('words'))db.createObjectStore('words',{keyPath:'id'});const attempts=db.objectStoreNames.contains('attempts')?request.transaction.objectStore('attempts'):db.createObjectStore('attempts',{keyPath:'id'});if(!attempts.indexNames.contains('wordId'))attempts.createIndex('wordId','wordId');if(!attempts.indexNames.contains('wordTime'))attempts.createIndex('wordTime',['wordId','time']);if(!db.objectStoreNames.contains('runs'))db.createObjectStore('runs',{keyPath:'id'});};
    this.db=await new Promise((resolve,reject)=>{let settled=false;const fail=error=>{if(settled)return;settled=true;clearTimeout(timer);reject(error);},timer=setTimeout(()=>fail(new Error('Learning database open timed out')),1800);request.onsuccess=()=>{if(settled){request.result.close();return;}settled=true;clearTimeout(timer);resolve(request.result);};request.onerror=()=>fail(request.error);request.onblocked=()=>fail(new Error('Learning database blocked'));});
    this.db.onversionchange=()=>{this.db?.close();this.db=null;};return this.words();
  }
  async words(){const tx=this.db.transaction('words','readonly'),done=completed(tx),rows=await requestValue(tx.objectStore('words').getAll());await done;return rows;}
  save(result,rows){
    this.pending=this.pending.catch(()=>{}).then(async()=>{
      if(!this.db)throw new Error('Learning database unavailable');
      const tx=this.db.transaction(['words','attempts','runs'],'readwrite'),done=completed(tx),runs=tx.objectStore('runs'),existing=runs.get(result.id),saved=[];
      existing.onsuccess=()=>{
        if(existing.result)return;
        for(const row of rows){const store=tx.objectStore('words'),current=store.get(row.id);current.onsuccess=()=>{let value=row;if(current.result){const delta={correct:0,wrong:0,incomplete:0};for(const record of result.records)if(record.wordId===row.id)delta[record.kind]++;value={...row,correct:current.result.correct+delta.correct,wrong:current.result.wrong+delta.wrong,incomplete:(current.result.incomplete||0)+delta.incomplete,last:Math.max(current.result.last||0,row.last||0)};}store.put(value);saved.push(value);};}
        for(const record of result.records)tx.objectStore('attempts').put(record);runs.put({id:result.id,level:result.level,time:result.time});
      };
      await done;return saved;
    });return this.pending;
  }
  clear(){
    this.pending=this.pending.catch(()=>{}).then(async()=>{
      if(!this.db)throw new Error('Learning database unavailable');
      const stores=['words','attempts','runs'],tx=this.db.transaction(stores,'readwrite'),done=completed(tx);
      for(const name of stores)tx.objectStore(name).clear();await done;
    });return this.pending;
  }
  async attemptPage(wordId,page,pageSize){
    await this.pending.catch(()=>{});if(!this.db)throw new Error('Learning database unavailable');
    const tx=this.db.transaction('attempts','readonly'),done=completed(tx),store=tx.objectStore('attempts'),range=IDBKeyRange.bound([wordId,0],[wordId,Number.MAX_VALUE]);
    const result=await new Promise((resolve,reject)=>{const count=store.index('wordTime').count(range);count.onerror=()=>reject(count.error);count.onsuccess=()=>{
      const total=count.result,current=Math.max(0,Math.min(Math.max(0,Math.ceil(total/pageSize)-1),page)),rows=[],request=store.index('wordTime').openCursor(range,'prev');let skip=current*pageSize;
      request.onerror=()=>reject(request.error);request.onsuccess=()=>{const cursor=request.result;if(!cursor){resolve({rows,total,page:current});return;}if(skip){cursor.advance(skip);skip=0;return;}rows.push(cursor.value);if(rows.length===pageSize)resolve({rows,total,page:current});else cursor.continue();};
    };});await done;return result;
  }
  async attempts(wordId){await this.pending.catch(()=>{});if(!this.db)return [];const tx=this.db.transaction('attempts','readonly'),done=completed(tx),rows=await requestValue(tx.objectStore('attempts').index('wordId').getAll(wordId));await done;return rows.sort((a,b)=>b.time-a.time);}
}
