// 程序发布版本；生成算法和缓存格式另行管理，不因程序升级清空兼容资源。
export const APP_VERSION = '1.0.1';

export class VersionUpgrade {
  constructor(cache, ui) {
    this.cache = cache; this.ui = ui;
  }

  async check() {
    this.startedAt = performance.now();
    await this.cache.ready;
    this.previous = await this.cache.readVersion();
    this.required = this.previous?.version !== APP_VERSION;
    if (this.required) this.ui.setUpgrade({title: this.previous ? '版本升级' : '首次准备', progress: 0,
      message: this.previous ? `从 ${this.previous.version} 更新至 ${APP_VERSION}，正在检查可复用的资源。` : `正在准备 ${APP_VERSION}，完成后即可开始。`});
    else this.ui.setUpgrade(null);
    return this.required;
  }

  progress(progress, message) {
    if (this.required) this.ui.setUpgrade({title: this.previous ? '版本升级' : '首次准备', progress, message});
  }

  async complete() {
    this.progress(97, '资源已就绪，正在确认保存并整理过时缓存。');
    // 必需数据及增强队列已经完成且写入成功，才清理当前关卡未再引用的记录。
    if (this.cache.available) await this.cache.prune();
    let persistent = false;
    if (this.cache.available) {
      const saved = await this.cache.writeVersion({version: APP_VERSION});
      const confirmed = saved && await this.cache.readVersion();
      persistent = confirmed?.version === APP_VERSION;
    }
    this.ui.setUpgrade(null);
    this.ui.setSessionNotice(persistent ? '' : '本次会话已准备 · 浏览器未保存更新，下次打开会重新检查');
    console.info('Version preparation completed ' + JSON.stringify({version: APP_VERSION, previous: this.previous?.version ?? null,
      upgradeMs: Math.round(performance.now() - this.startedAt), persistent}));
  }

  fail(error) {
    console.error('Version preparation failed', error);
    this.ui.setUpgrade({title: this.previous ? '版本升级' : '首次准备',
      message: '准备未完成，已保存的资源会保留。请重试；仍失败时可刷新页面继续。', failed: true});
  }
}
