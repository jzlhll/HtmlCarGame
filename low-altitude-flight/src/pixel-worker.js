// 单请求Worker用对象所有权隔离迟到回调；暂停直接终止，未完成像素下次许可时重算。
export class PixelWorker {
  request(name,width,height,manual = false) {
    if (this.unavailable) return Promise.resolve(null);
    try {
      if (!this.worker) {
        const worker=new Worker(new URL('./surface-worker.js',import.meta.url),{type:'module'});
        this.worker=worker;
        worker.onmessage=({data})=>{
          if (this.worker!==worker || !this.pending) return;
          const pending=this.pending; this.pending=undefined;
          if (data.error) { this.unavailable=true; this.stop(); pending.resolve(null); }
          else pending.resolve(data);
        };
        worker.onerror=event=>{
          event.preventDefault(); if (this.worker!==worker) return;
          const pending=this.pending; this.pending=undefined; this.unavailable=true; this.stop(); pending?.resolve(null);
        };
      }
      return new Promise(resolve=>{
        this.pending={resolve};
        try { this.worker.postMessage({name,width,height,manual}); }
        catch { this.pending=undefined; this.unavailable=true; this.stop(); resolve(null); }
      });
    } catch { this.unavailable=true; this.stop(); return Promise.resolve(null); }
  }

  stop() {
    const pending=this.pending; this.pending=undefined;
    if (this.worker) { this.worker.onmessage=this.worker.onerror=null; this.worker.terminate(); this.worker=undefined; }
    pending?.resolve({cancelled:true});
  }
}
