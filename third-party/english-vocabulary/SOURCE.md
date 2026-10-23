# 英语词库来源与许可

## 分级依据

游戏包含小六500词、初中进阶2200词、四级基础6259词、六级进阶1718词。小学与初中为项目选编，不声明覆盖某版教材；六级仅含新增进阶拼写，不重复四级。

- 小学与初中参考教育部《义务教育英语课程标准（2022年版）》附录3及阶段词表：[教育部通知](https://www.moe.gov.cn/srcsite/A26/s8001/202204/t20220420_619921.html)、[课标公开PDF](https://www.ictr.edu.cn/Uploads/File/2022/04/28/6.%E4%B9%89%E5%8A%A1%E6%95%99%E8%82%B2%E8%AF%AD%E8%AF%BE%E7%A8%8B%E6%A0%87%E5%87%86%EF%BC%882022%E5%B9%B4%E7%89%88%EF%BC%89.20220428160837.pdf)。初中进阶包含小学500词，并从初高中资料按主题补充。
- 大学词形与级别依据[《全国大学英语四、六级考试大纲（2016年修订版）》](https://cet.neea.edu.cn/res/Home/1704/55b02330ac17274664f06d9d3db8249d.pdf)，物理页21–149，★标六级，其余为四级。按主词、派生词及合法英美拼法展开，跨级同形词归四级；游戏独立拼写数不等于官方原始词目数。
- 官方PDF SHA-256：`9166d3c03b7bc43abd9d9df91bd2ef8085b4419286f1e5ca100dea68f3cfd1f1`。分级与筛选依据保存在 `scripts/data/cet-official-2016.js`，小学与中学选词清单见 `src/vocabulary-selections.js`。排除不适合键盘拼写和明确排印错误的词形，官方PDF不随游戏分发。

## 释义、例子与许可

- 社区语料：[KyleBing/english-vocabulary](https://github.com/KyleBing/english-vocabulary)，固定版本 `c4c6c80879ff17d7025c28fb853a4991c8e6be6a`。
- 使用 `full_line_jsonl/sentence/正序/` 中的初中、高中、四级、六级、考研、托福、SAT资料；后三份只补已有词形的语料，不扩展大学大纲范围。
- 语料按 BSD-3-Clause 分发，须保留 [LICENSE](LICENSE)。小学英中例子和项目补写例句为原创。
- 多义词的常用义项参考 Cambridge Dictionary 的 [spring](https://dictionary.cambridge.org/dictionary/english-chinese-simplified/spring)、[bank](https://dictionary.cambridge.org/dictionary/english-chinese-simplified/bank)、[sanction](https://dictionary.cambridge.org/dictionary/english-chinese-simplified/sanction)、[oversight](https://dictionary.cambridge.org/dictionary/english-chinese-simplified/oversight)、[console](https://dictionary.cambridge.org/us/dictionary/english/console)、[vice](https://dictionary.cambridge.org/us/dictionary/english/vice?topic=tools) 等词条，补写例句不复制词典例句。

游戏直接使用 `src/vocabulary-primary.js`、`src/vocabulary-intermediate.js`、`src/vocabulary-cet4.js`、`src/vocabulary-cet6.js` 中的最终释义、词性及例子。修改内容直接更新对应词库，不另存修订表、变更词单或统计报告。同词在不同阶段可采用对应义项，学习记录按词库隔离。

## 导入维护

`scripts/import-vocabulary.mjs` 保留游戏词库中的已有内容，依据选词清单为新增词形补充内容并校验字段；已有释义和逐义例句不会被源语料覆盖。保留同库词条ID，小学旧词沿用 `practice-*`，其他条目采用“词库＋小写拼写”。

```sh
node scripts/import-vocabulary.mjs
node scripts/import-vocabulary.mjs /path/to/source-directory --check
```

离线目录包含 `vocabulary-junior.jsonl`、`vocabulary-senior.jsonl`、`vocabulary-cet4.jsonl`、`vocabulary-cet6.jsonl`、`vocabulary-postgrad.jsonl`、`vocabulary-toefl.jsonl`、`vocabulary-sat.jsonl`。`--check` 只比较、不写出；可用 `--audit=/tmp/vocabulary-audit.json` 临时排查缺项，源JSONL、PDF和审计报告不提交仓库。

官方清单可用 `scripts/extract-cet-wordlist.py` 配合 Python、pypdf 及上述指纹的原PDF提取；生成到临时目录后再核对选词依据。
