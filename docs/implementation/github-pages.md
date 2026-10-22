# GitHub Pages 发布

[返回实现入口](README.md)

## 发布条件

仓库为 `jzlhll/HtmlCarGame`，目标路径为 `https://jzlhll.github.io/HtmlCarGame/`。`.github/workflows/pages.yml` 仅响应正式 Release 的 `published` 事件，检出该 Release 的 tag；普通提交、分支推送、单独 tag、草稿和预发布均不触发部署。工作流没有手动发布入口，已存在的发布任务可按 GitHub 权限重新运行。

实际发布前确认 Pages 使用 GitHub Actions，环境允许对应 tag，并以 `src/version.js` 的 `APP_VERSION` 创建同名 tag 和正式 Release。包、锁文件与 tag 必须一致；日常修改不自动升版本或创建 Release。独立博客入口由其所属仓库维护。

## 静态包

`npm run prepare:pages` 只整理文件到忽略目录 `.pages-output/`，不会发布。内容为 `index.html`、24 个英语空战运行模块、动态资源指纹清单、一份样式、Three.js 两个引擎模块及许可证。入口 import map 与 `modulepreload` 一并改为同站 `vendor/three/`，游戏模块、Worker 与样式按 `APP_VERSION` 添加查询参数，支持 `/HtmlCarGame/` 子路径，不依赖 CDN。

不包含文档、整个 `node_modules`、生成缓存或预制模型纹理。全部发布文件必须小于 10,000,000 字节；后台资源由浏览器在非游玩阶段并行准备、持久缓存并预热，规则见 [版本与资源升级](resource-upgrade.md)。新增运行模块时同步修改整理清单并核对所有静态依赖和预加载地址。

账号、学习、成绩和设置保存在当前站点的浏览器中，本机与线上地址互相独立。赛车源码和发布约定参考 `main` 分支，本分支只发布英语空战。
