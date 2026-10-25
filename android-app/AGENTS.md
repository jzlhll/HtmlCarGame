# Android 工程

- Kotlin + Android WebView，主要面向平板竖屏；网页源码分别维护在同级三个游戏目录，禁止在 Android 内维护源码副本。先阅读 `README.md`。
- Android 编译通过 `prepareGames` 整理离线资源，产物只进入已忽略的 `build/`；Android 专属桥接与触屏适配由 `web/` 和 `scripts/integrate-game.mjs` 注入生成副本，不能改变普通网页的行为。
- 每日管控以原生 `UsageLedger` 为准：英语有效学习满15分钟每天只解锁一次，赛车与低空穿越各有工作日12分钟／周末18分钟，独立消耗、次日重置；普通菜单、后台、暂停不计学习，30秒无新操作强制暂停，按键自动重复与心跳不刷新操作时间。
- `GameHubApplication` 持有唯一账本和串行原子存储；Activity 重建复用已加载状态。原生额度校验、前台状态、独立 origin、主 frame 校验与暂停闸门不可交给网页绕过；原生 TTS 取消及回写按当前请求校验。
- 回复与注释中文，日志英文；修改用脚本，不使用 apply_patch。不主动新增测试文件或运行 Gradle。按改动选择最小语法、引用、纯函数边界或实机验证，未完成的验证不能写成通过。
