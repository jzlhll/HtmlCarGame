# GitHub Pages 发布

[返回实现说明](README.md)

游戏仓库为 `jzlhll/HtmlCarGame`，线上地址为 `https://jzlhll.github.io/HtmlCarGame/`。博客使用独立仓库 `jzlhll/jzlhll.github.io`，地址为 `https://jzlhll.github.io/`，从「小游戏 → 四季车途」进入游戏；两者分别发布和更新。

## 启用与更新

1. 将 `.github/workflows/pages.yml`、`scripts/prepare-pages.mjs` 和入口相对路径调整提交到仓库。
2. 在仓库 Settings → Pages → Build and deployment 中将 Source 设置为 **GitHub Actions**，不使用分支自动发布。
3. 如果 `github-pages` 环境设置了分支或 tag 限制，允许用于正式发布的 tag。
4. 以 `src/version.js` 的 `APP_VERSION` 常量创建指向目标提交的同名 tag（当前 `v1.0.9`），并发布正式 Release；不得在发布时另加一个版本。工作流必须包含在该 tag 对应的代码里。

工作流只监听 `release.published`，并排除预发布版本。普通提交、分支推送、仅创建或推送 tag、Release 草稿和预发布版本均不更新网站；发布正式 Release 后，才部署该 Release 的 tag 对应代码。工作流不提供手动发布入口，GitHub 管理员仍可重新运行已有发布任务。删除 Release 不会自动下线网站，修改 Release 说明也不会更新网站。

## 静态文件

GitHub Actions 安装锁定版本的依赖后，执行 `node scripts/prepare-pages.mjs`，将运行代码、后台生成模块和依赖整理到 `.pages-output/`，不分发预制模型或纹理。模型由浏览器在非游玩阶段分批准备并持久缓存，不增加 JavaScript 编译步骤。发布前校验常量、包版本及 Release tag 一致。整理结束按部署目录的实际字节数校验，全部文件必须小于 10,000,000 字节。

发布内容仅包含游戏入口、`src/`（含 Worker 和生成算法）、Three.js 的 `three.module.js` 与 `three.core.js`、当前使用的 `BufferGeometryUtils.js` 和依赖许可证。入口 import map 及生成模块中的相对引擎地址自动改为同站 `vendor/three/` 路径，工具模块同步使用相对引擎导入以支持 Worker，不依赖第三方 CDN，不发布源码仓库文档或整个 `node_modules`。新增 Three.js addons 时，需要同步补充整理脚本中的文件及其依赖。

游戏入口采用相对路径，同时兼容本机根路径和 GitHub Pages 的 `/HtmlCarGame/` 子路径。本机启动方式保持不变；玩家只需打开网站，浏览器会自动加载运行文件。排行榜仍保存在当前浏览器，线上与本机地址的记录相互独立。

Pages 发布整理时将 `src/keyboard-mode.js` 替换为普通流程适配模块，并移除儿童模式专用样式链接、样式文件及配置参数。发布版不显示儿童模式、不读取其本机偏好、不生成找按键任务，空格或原有开始按钮直接开始；本机源码运行时默认启用儿童模式并保存勾选状态。

发布目录的模块、Worker、引擎及样式地址带 `APP_VERSION` 查询参数，避免新版入口沿用旧 HTTP 模块缓存。资源指纹清单在整理时生成，本机服务动态提供；程序 tag 变化不会使兼容的模型数据全部失效，详见[版本与资源升级](resource-upgrade.md)。
