import { SURFACE_APPEARANCE } from './config.js';

// 队列只在许可窗口推进；异步读取完成后重新校验，不直接创建资源。
export class GenerationQueue {
  constructor(iterator, {allowed = () => true, urgent = false, name = 'surface', report = true} = {}) {
    this.iterator = iterator; this.allowed = allowed; this.urgent = urgent; this.name = name; this.report = report;
    this.state = 'paused'; this.waiting = false; this.nextValue = undefined; this.nextStepMs = 0.5;
    this.stats = {batches: 0, steps: 0, cpuMs: 0, maxBatchMs: 0, maxStepMs: 0, hits: 0, misses: 0, uploads: 0};
    this.done = new Promise((resolve, reject) => { this.resolve = resolve; this.reject = reject; });
  }

  resume() {
    if (['complete', 'failed'].includes(this.state) || !this.allowed()) return;
    this.state = 'running';
    if (!this.waiting && !this.scheduled) this.schedule();
  }

  pause() {
    if (['complete', 'failed', 'paused'].includes(this.state)) return;
    this.state = 'paused'; this.onPause?.();
    if (this.idleId !== undefined) cancelIdleCallback(this.idleId);
    if (this.timerId !== undefined) clearTimeout(this.timerId);
    this.taskController?.abort();
    this.idleId = this.timerId = undefined; this.scheduled = false;
  }

  setUrgent(urgent) {
    if (this.urgent === urgent) return;
    const running = this.state === 'running'; this.pause(); this.urgent = urgent;
    if (running) this.resume();
  }

  schedule() {
    if (this.state !== 'running' || !this.allowed()) { this.pause(); return; }
    this.scheduled = true;
    if (!this.urgent && typeof requestIdleCallback === 'function') {
      this.idleId = requestIdleCallback(deadline => {
        this.idleId = undefined; this.scheduled = false;
        if (this.work(deadline)) this.resume();
      }, {timeout: SURFACE_APPEARANCE.idleTimeoutMs});
    } else if (typeof globalThis.scheduler?.postTask === 'function') {
      const controller = new AbortController(); this.taskController = controller;
      globalThis.scheduler.postTask(async () => {
        while (!controller.signal.aborted && this.state === 'running') {
          this.scheduled = false;
          if (!this.work(null)) return;
          this.scheduled = true;
          if (typeof globalThis.scheduler.yield === 'function') await globalThis.scheduler.yield();
          else { this.scheduled = false; this.resume(); return; }
        }
      }, {priority: 'background', signal: controller.signal}).catch(error => {
        if (!controller.signal.aborted) this.fail(error);
      });
    } else {
      this.timerId = setTimeout(() => {
        this.timerId = undefined; this.scheduled = false;
        if (this.work(null)) this.resume();
      }, 0);
    }
  }

  work(deadline) {
    if (this.state !== 'running' || !this.allowed()) { this.pause(); return false; }
    const settings = SURFACE_APPEARANCE, target = this.sliceMs || settings.generationSliceMs, startedAt = performance.now();
    const budget = deadline && !deadline.didTimeout ? Math.min(target, deadline.timeRemaining()) : target;
    let steps = 0;
    try {
      while (this.allowed() && (performance.now() - startedAt + this.nextStepMs < budget || (!steps && deadline?.didTimeout))) {
        const stepStartedAt = performance.now(), result = this.iterator.next(this.nextValue);
        this.nextValue = undefined; steps++; this.stats.steps++;
        const elapsed = performance.now() - stepStartedAt;
        if (elapsed > this.stats.maxStepMs) { this.stats.maxStepMs = elapsed; this.stats.slowestTask = this.task; }
        this.nextStepMs = Math.max(0.5, Math.min(target / 2, elapsed * 1.5));
        if (result.done) {
          this.state = 'complete'; this.recordBatch(startedAt, steps);
          if (this.report) console.info('Generation completed ' + JSON.stringify({name: this.name, ...this.snapshot()}));
          this.resolve(this.snapshot()); return false;
        }
        if (result.value?.task) this.task = result.value.task;
        if (result.value?.wait) {
          this.waiting = true;
          result.value.wait.then(value => {
            this.waiting = false; this.nextValue = value;
            // 暂停或加速后的异步回写只保存返回值，下一次许可窗口才解码、生成或上传。
            if (this.state === 'running') this.resume();
          }, error => this.fail(error));
          this.recordBatch(startedAt, steps); return false;
        }
        if (deadline?.didTimeout || (result.value === 'boundary' && steps > 1)) break;
      }
      this.recordBatch(startedAt, steps);
      return true;
    } catch (error) { this.recordBatch(startedAt, steps); this.fail(error); return false; }
  }

  recordBatch(startedAt, steps) {
    if (!steps) return;
    const elapsed = performance.now() - startedAt;
    this.stats.batches++; this.stats.cpuMs += elapsed; this.stats.maxBatchMs = Math.max(this.stats.maxBatchMs, elapsed);
    this.onProgress?.(this.snapshot());
  }

  snapshot() {
    const stats = {...this.stats, state: this.state};
    for (const key of ['cpuMs', 'maxBatchMs', 'maxStepMs', 'uploadCpuMs', 'maxUploadMs', 'workerCpuMs', 'maxWorkerBatchMs']) if (stats[key]!==undefined) stats[key] = Number(stats[key].toFixed(2));
    return stats;
  }

  fail(error) {
    this.pause(); this.state = 'failed'; this.reject(error);
  }
}
