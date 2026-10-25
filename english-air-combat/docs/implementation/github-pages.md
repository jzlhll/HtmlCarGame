# 静态包与网站接入

[返回实现入口](README.md)

## 整理与发布

本工程位于 `jzlhll/HtmlCarGame` 仓库的 `english-air-combat/` 目录，统一在 `main` 维护。仓库根目录 `.github/workflows/english-air-combat.yml` 在本工程或该工作流变更时整理静态包，也支持手动整理；仅上传 artifact，不部署仓库 Pages，不创建 Release。

在本工程目录运行 `npm run prepare:pages`，输出到已忽略的 `.pages-output/`。脚本按 `src/version.js` 校验包和锁文件版本；日常修改不自动升版本。

英语空战由 `jzlhll/jzlhll.github.io` 的固定版本清单统一打包，访问路径为 `/games/english/`。博客打包入口须使用本仓库的 `english-air-combat/` 子目录，在博客仓库的 `games.json` 更新完整提交号后，按博客正式 Release 流程发布。旧固定提交仍保留其原目录结构。

## 静态包

内容为 `index.html`、`scripts/prepare-pages.mjs` 清单中的运行模块、动态资源指纹清单、一份样式、第三方词库来源与许可，以及 Three.js 引擎模块和许可证。入口 import map 与 `modulepreload` 一并改为同站 `vendor/three/`，游戏模块、Worker 与样式按 `APP_VERSION` 添加查询参数，支持站点子路径，不依赖 CDN。

不包含工程文档、整个 `node_modules`、生成缓存或预制模型纹理。全部发布文件必须小于 10,000,000 字节；后台资源由浏览器在非游玩阶段分批准备、持久缓存并预热，规则见 [版本与资源升级](resource-upgrade.md)。新增运行模块时同步修改整理清单并核对所有静态依赖和预加载地址。

账号、学习、成绩和设置保存在当前站点的浏览器中，本机与线上地址互相独立。赛车源码和发布约定参考同仓库 `car-game/` 目录。
