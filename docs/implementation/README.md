# 英语空战运行与实现

[返回设计入口](../README.md)

## 本机运行

`npm ci` 安装锁定依赖，`npm start` 启动仅监听本机回环地址的 HTTP 服务，默认 `http://localhost:5173`；多个工作目录用独立 `PORT`，不停止已有服务。macOS 可使用根目录 `启动游戏.command`。JavaScript 无需编译，不直接打开 HTML 文件。

服务仅提供 `index.html`、`src/` 和依赖文件，不开放文档或隐藏目录。Three.js 使用页面 import map，本机入口提前预加载引擎两个模块；发布整理将相对路径改为同站 `vendor/three/`，支持 `/HtmlCarGame/` 子路径。

## 工程入口

| 入口 | 用途 |
| --- | --- |
| [实现结构](english-air-combat.md) | 当前模块职责、学习闭环、缓存、渲染与兼容性 |
| [验证流程](validation.md) | 服务检查、受影响验证与交付范围 |
| [英语空战验收](english-air-combat-validation.md) | 玩法边界、准备路径和性能测量 |
| [开发原则](development-workflow.md) | 风险、性能证据与资源复用 |
| [版本与资源升级](resource-upgrade.md) | 程序版本、资源指纹和失败降级 |
| [GitHub Pages 发布](github-pages.md) | 静态包及正式 Release 发布条件 |

`src/` 仅保留英语空战的 24 个 JavaScript 模块和一份样式。以 `bootstrap.js` 的依赖图及 `scripts/prepare-pages.mjs` 的模块清单核对运行范围。赛车源码与设计参考 `main` 分支。
