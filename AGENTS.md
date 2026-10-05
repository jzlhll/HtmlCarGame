# 开发规则

- 游戏中的临时提示内容单次显示不得超过 3 秒，通常使用 2–3 秒；缓行提示使用 2.5 秒。
- 按稳定的事件标识记录提示计时；距离、速度、最近车辆或车道变化不得重置计时，同一次事件不得因持续刷新而反复弹出。

## 开发方式

- 使用原生 JavaScript ES Modules + Three.js，无构建步骤；入口为 `index.html`，代码位于 `src/`。数值集中在 `src/config.js`，游戏逻辑与渲染分离，规则变化同步对应设计文档。
- 缺少依赖时执行 `npm ci`；执行 `npm start` 后打开 `http://localhost:5173`，通过 HTTP 加载，不直接打开 HTML 文件。多工作目录可用 `PORT=5186 npm start` 指定空闲端口。
- 按[常规验证流程](docs/implementation/validation.md)执行验证，范围与本次改动风险相匹配。
- 音效集中在 `src/audio.js`，由 Web Audio 实时合成，不加载音频文件；音量、距离等参数进 `config.js` 的 `AUDIO`，事件触发点跟随对应游戏逻辑，暂停与结算必须静音。

## 文档导航

- `docs/README.md`：总览与渐进式阅读入口，先查这里，再按改动阅读对应专题。
- `docs/design/`：01–03 为玩法、车辆、碰撞；04–06 为四季、道路车流、存档；07 为实施规划；08–11 为射击防御、漂移氮气、成长饥饿、白马事件。
- `docs/implementation/README.md`：本机运行方式、模块职责与实现约定。
