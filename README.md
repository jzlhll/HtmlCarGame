# 浏览器游戏合集

三个独立工程统一在 `main` 分支维护，各自保留源码、依赖、设计文档与开发规则。

| 目录 | 工程 | 用途 |
| --- | --- | --- |
| [car-game](car-game/README.md) | 四季车途 | 车辆成长、吞吃升级与四季道路赛车 |
| [low-altitude-flight](low-altitude-flight/README.md) | 低空穿越 | 客机起降、航线飞行与键盘字母位置练习 |
| [english-air-combat](english-air-combat/README.md) | 英语空战 | 拼写空战、释义选择、碎片拼词与错题复习 |

进入对应工程目录后安装依赖并启动，例如：

```bash
cd car-game
npm ci
npm start
```

也可双击各工程内的 `启动游戏.command`。端口、操作方式和资源准备流程见各自 README；同时运行时为赛车和英语空战指定不同的 `PORT`。

各工程的 `assets/`、`.pages-output/` 和生成的资源指纹不提交。低空穿越启动时自动生成必需资源，其他工程由浏览器在准备阶段生成。

GitHub Actions 在 `main` 上按英语空战目录的变更整理静态包。赛车与低空穿越正式 Release 使用 `工程目录/v版本号` 标签（例如 `low-altitude-flight/v1.0.1`），按该工程原有规则校验版本后部署到仓库 Pages；无目录前缀的 `v版本号` 仅在版本唯一匹配一个可部署工程时兼容。一次 Release 部署一个工程，发布地址以该次部署为准。英语空战仍只上传静态包，博客网站接入见其 README。
