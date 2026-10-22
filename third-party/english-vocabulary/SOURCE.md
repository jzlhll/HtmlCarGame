# 英语词库来源与许可

## 分级与选编

四阶段按小学日常表达、中学基础与衔接、大学四级、大学六级递进。小学与初中阶段是适合本游戏字母拼写玩法的项目选编，不声明等同某一教材版本或官方完整考试大纲。

分级参考教育部《义务教育英语课程标准（2022年版）》附录3：二级列505个小学基本词汇，三级共1600词（包含二级505词），允许地方按相关主题补充。课标不提供中文释义及例子。本项目以课标日常生活、学校学习、人与社会、人与自然等主题确定补充范围，自行编写小学释义与例子。

- [教育部印发通知](https://www.moe.gov.cn/srcsite/A26/s8001/202204/t20220420_619921.html)。
- [官方课标PDF](https://www.ictr.edu.cn/Uploads/File/2022/04/28/6.%E4%B9%89%E5%8A%A1%E6%95%99%E8%82%B2%E8%8B%B1%E8%AF%AD%E8%AF%BE%E7%A8%8B%E6%A0%87%E5%87%86%EF%BC%882022%E5%B9%B4%E7%89%88%EF%BC%89.20220428160837.pdf)，附录3印刷页87–128；小学词表为87–97页。
- [教育出版社公开镜像](https://www.esph.com.cn/docs/2025-10/705da262a6e74b088ac658bfe2d757ba.pdf)。

### 小六：500词

`src/vocabulary-primary.js` 保留原有191词的词形、ID、释义和分组，按人物家庭、身体家居、学校学习、食物、动物、衣物、出行、自然、时间、日常动作、描述及基础表达等主题增加309词。新增项显式记录在 `src/vocabulary-selections.js`，不按字母截取凑数。原词已包含少量初中拓展，故500是项目练习规模，不冒充课标505词的逐项完整复刻。

500词均有本项目编写的英中例子，优先短语；功能词需要完整语境时使用短句。

### 初中进阶：2200词

完整导入下述开源初中词表的有效独立单词：3223行，不区分大小写去重及清理后1981词。保留字母长度2–24的条目，过滤 `I`、`a`、`Mr.`、`adj.`、`x-ray`，以及另有正确 `Russia` 条目时不适合教学的 `Rusia` 地名记录。

在1981词基础上，补入小学500中该来源未收录的16词，再按学习表达、人际成长、生活出行、自然科技、社会思辨五个主题从同来源高中词表显式选入203个衔接词，合计2200词。选择清单记录在 `src/vocabulary-selections.js`，不按字母顺序截取；所有小学500词均包含在2200词内，但学习记录按词库独立。

初中释义优先初中来源，并清理人名杂义；短语与句子可在初中、高中及大学两份来源中同词补充，适龄搭配以项目覆盖表优先。2200是项目进阶选编规模，不是课标官方初中词数。

## 开源数据

- 来源：[KyleBing/english-vocabulary](https://github.com/KyleBing/english-vocabulary)。
- 固定版本：[`c4c6c80879ff17d7025c28fb853a4991c8e6be6a`](https://github.com/KyleBing/english-vocabulary/tree/c4c6c80879ff17d7025c28fb853a4991c8e6be6a)。
- 输入文件：`full_line_jsonl/sentence/正序/初中.jsonl`、`高中.jsonl`、`四级.jsonl`、`六级.jsonl`。
- 许可：BSD-3-Clause，原始版权和许可全文见同目录 [LICENSE](LICENSE)。分发游戏时须一同保留本目录。

四级、六级从完整来源导入2–24个ASCII英文字母组成的独立单词，同库按不区分大小写的拼写去重。每库保持独立条目ID；不同库的重合词分别保留。

| 词库 | 来源行数 | 游戏词数 | 短语 | 句子 |
| --- | ---: | ---: | ---: | ---: |
| 小六 | 原191＋主题补选309 | 500 | 483 | 17 |
| 初中进阶 | 初中3223＋高中主题衔接 | 2200 | 2006 | 194 |
| 英语四级 | 7508 | 4536 | 3855 | 681 |
| 英语六级 | 5651 | 3990 | 3057 | 933 |

四级过滤 `a`、`I`、`up-to-date`、`well-known`、`so-called`、`X-ray`、`world-wide`；六级过滤 `air-conditioning`。最长单词分别为 `responsibility`（小六与初中进阶，14字母）、`competitiveness`（四级，15字母）、`disproportionately`（六级，18字母）。

例子优先从同词源数据的短语选择；没有可用短语时选句子，优先短小、含目标词或常见屈折词形、中文非空的例子，降低专业术语与过长内容的优先级。缺例和少量过长、错配的内容由本项目补写。全部11226条游戏词目均有英中例子；导入过程检查必填字段、字母范围、例子含词及重复，任一缺失会直接失败。

少量可确认的源错误由 `src/vocabulary-example-overrides.js` 统一修订，包括 `reservior` → `reservoir`（并入原词）、`Automatically` → `automatically`、`FALSE` → `false`；以及 `biography`、`delightful`、`downfall`、`Venus`、`delusion`、`dictate`、`hospitalize`、`showmanship`、`entrepreneurship`、`valuable` 等错义或首义。中学阶段另采用适龄日常词义与搭配，原有191词释义不受这些修订影响。

## 重复导入

在线导入固定版本：

```sh
node scripts/import-vocabulary.mjs
```

离线重建时，将四个原始输入分别保存为 `vocabulary-junior.jsonl`、`vocabulary-senior.jsonl`、`vocabulary-cet4.jsonl` 与 `vocabulary-cet6.jsonl`，通过参数传入所在目录：

```sh
node scripts/import-vocabulary.mjs /path/to/source-directory
```

脚本重写初中进阶和两个大学英语数据模块，保留小学500词及原创例子，校验新增309及衔接203清单。原始大文件和参考PDF无需提交仓库。
