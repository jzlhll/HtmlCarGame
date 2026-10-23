#!/usr/bin/env python3
"""从官方 PDF 字符基线恢复词表，展开主词与派生词，生成静态分级清单。"""
import argparse
import hashlib
import json
import logging
import re
import unicodedata
from pathlib import Path

from pypdf import PdfReader

SOURCE_URL = "https://cet.neea.edu.cn/res/Home/1704/55b02330ac17274664f06d9d3db8249d.pdf"
SOURCE_SHA256 = "9166d3c03b7bc43abd9d9df91bd2ef8085b4419286f1e5ca100dea68f3cfd1f1"
# 原 PDF 缺少空格编码；视觉核对后恢复短语，不把连接后的文本当成单词。
PHRASE_FIELDS = {
    "accordingto": "according to",
    "babyboom": "baby boom",
    "babyboomer": "baby boomer",
    "oughtto": "ought to",
    "owingto": "owing to",
}
# 字数不同的缩写尾词不能按相同长度替换。
VARIANT_FIELDS = {"connection/-xion": ["connection", "connexion"]}
# 两处疑点均与 PDF 图像一致；保留标准词形，不为原排印疑点新增错误拼写。
PRINT_EXCLUSIONS = {
    "Celcius": "原表 Celsius/-cius 的缩写变体存在排印疑点，仅保留 Celsius",
    "sobre": "原表 sober/-re 的缩写变体存在排印疑点，仅保留 sober，不擅改为 somber",
    "instalation": "原表 instal(l)ation 的单 l 展开不是标准拼写，归并到 installation",
    "jewelery": "原表 jewel(l)ery 的单 l 展开不是标准拼写，规范为 jewelry，并保留 jewellery",
    "humourous": "原表 humo(u)rous 的带 u 展开不是标准拼写，归并到 humorous",
    "honourary": "原表 hono(u)rary 的带 u 展开不是标准拼写，归并到 honorary",
}
SPELLING_CANONICAL = {
    "instalation": "installation",
    "jewelery": "jewelry",
    "humourous": "humorous",
    "honourary": "honorary",
}


def normalized(text):
    # 必须先处理这个字体的连字符映射，不能让 NFKC 把它变成英文字母 G。
    text = text.replace("Ｇ", "-").replace("\U001001b3", "'")
    text = unicodedata.normalize("NFKC", text)
    return "".join(char for char in unicodedata.normalize("NFKD", text)
                   if not unicodedata.combining(char))


def page_rows(page, number):
    rows = []

    def visitor(text, cm, tm, font, size):
        if not text.strip() or not 9 <= size <= 10:
            return
        # PDF 为每个字符单独设置 CTM；tm 不含全页坐标。星号与字母共用 CTM 基线。
        x, y = cm[4], cm[5]
        row = next((item for item in rows if abs(item["y"] - y) < 2), None)
        if row is None:
            row = {"page": number, "y": y, "chunks": []}
            rows.append(row)
        row["chunks"].append({"x": x, "text": text.strip()})

    page.extract_text(visitor_text=visitor)
    result = []
    for row in sorted(rows, key=lambda item: -item["y"]):
        text, previous = "", None
        for chunk in sorted(row["chunks"], key=lambda item: item["x"]):
            # 10 点超过正文单字母步距，并低于主词/派生词列的分隔间距。
            if previous is not None and chunk["x"] - previous > 10:
                text += " "
            text += chunk["text"]
            previous = chunk["x"]
        if re.search(r"[A-Za-z]", text):
            result.append({"page": number, "raw": text, "text": normalized(text)})
    return result


def optional_forms(text):
    found = re.search(r"\(([A-Za-z]+)\)", text)
    if not found:
        if "(" in text or ")" in text:
            raise ValueError("Unresolved parenthesis: " + text)
        return [text]
    before, inside, after = text[:found.start()], found.group(1), text[found.end():]
    return optional_forms(before + after) + optional_forms(before + inside + after)


def expand_field(field):
    if field in PHRASE_FIELDS:
        return [PHRASE_FIELDS[field]]
    if field in VARIANT_FIELDS:
        return VARIANT_FIELDS[field]
    alternatives = field.split("/")
    base = optional_forms(alternatives[0])
    result = list(base)
    for alternative in alternatives[1:]:
        for variant in optional_forms(alternative):
            if variant.startswith("-"):
                tail = variant[1:]
                result.extend(word[:-len(tail)] + tail for word in base)
            else:
                result.append(variant)
    return list(dict.fromkeys(result))


def exclusion_reason(word):
    if word in PRINT_EXCLUSIONS:
        return PRINT_EXCLUSIONS[word]
    if " " in word:
        return "多词短语，不适用于独立单词拼写"
    if "-" in word:
        return "含连字符，不适用于本游戏字母拼写"
    if len(word) == 1:
        return "单字母，不符合 2–24 字母范围"
    if len(word) > 24:
        return "超过 24 字母"
    if not re.fullmatch(r"[A-Za-z]{2,24}", word):
        return "含撇号、句点或其他非 ASCII 字母字符"
    return None


def extract(pdf):
    digest = hashlib.sha256(pdf.read_bytes()).hexdigest()
    if digest != SOURCE_SHA256:
        raise ValueError("Unexpected PDF checksum; use the declared official edition")
    reader = PdfReader(pdf)
    words, exclusions, all_rows = {}, [], []
    for number in range(21, 150):
        all_rows.extend(page_rows(reader.pages[number - 1], number))
    for row in all_rows:
        level = 6 if "★" in row["text"] else 4
        fields = row["text"].replace("★", "").strip().split()
        # coup 的可选外语短语放在派生词列；不把括号内容当成可选字母拼接。
        if fields == ["coup", "(d'etat)"]:
            fields = ["coup", "coup d'etat"]
        headword = PHRASE_FIELDS.get(fields[0], fields[0])
        for field in fields:
            expanded = [field] if " " in field else expand_field(field)
            for word in expanded:
                record = {"word": word, "level": level, "page": row["page"],
                          "headword": headword, "sourceToken": field}
                reason = exclusion_reason(word)
                if reason:
                    exclusions.append({**record, "reason": reason})
                    if word not in SPELLING_CANONICAL:
                        continue
                    record = {**record, "word": SPELLING_CANONICAL[word], "normalizedFrom": word}
                    word = record["word"]
                key = word.lower()
                if key not in words or level < words[key]["level"]:
                    words[key] = record
    source = {
        "url": SOURCE_URL,
        "title": "全国大学英语四、六级考试大纲（2016年修订版）词表",
        "revision": "2016",
        "sha256": digest,
        "physicalPages": [21, 149],
        "officialHeadwordCount": 5418,
        "extractedRows": len(all_rows),
        "starredRows": sum("★" in row["text"] for row in all_rows),
        "policy": "主词和同行派生词均收录；星号整行六级，未星四级；同形跨级优先四级；括号与英美异拼展开；重音字母转为 ASCII；短语、连字符、单字母及明确排印疑点排除。5418为原文词目计数，不等于展开去重后的拼写数量。",
        "spellingReferences": [
            "https://www.merriam-webster.com/dictionary/installation",
            "https://www.merriam-webster.com/dictionary/jewelry",
            "https://www.merriam-webster.com/dictionary/humorous",
            "https://www.merriam-webster.com/dictionary/honorary",
            "https://www.merriam-webster.com/dictionary/glamorous",
        ],
        "spellingPolicy": "规范 instalation/jewelery/humourous/honourary 的非标准展开，原形列排除并保留标准拼写；glamourous 为词典承认的较少用变体，保留。",
        "extraction": "按正文 9–10pt 字符 CTM 基线重组整行，按列间距拆分主词与派生词，修复缺编码空格；不使用 OCR 或首词抽取。",
    }
    return source, sorted(words.values(), key=lambda item: item["word"].lower()), exclusions


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("pdf", type=Path)
    parser.add_argument("--output", type=Path,
                        default=Path(__file__).resolve().parent / "data/cet-official-2016.js")
    parser.add_argument("--report", type=Path)
    args = parser.parse_args()
    logging.getLogger("pypdf").setLevel(logging.ERROR)
    source, words, exclusions = extract(args.pdf)
    text = "// 官方分级清单，由 scripts/extract-cet-wordlist.py 提取；来源与词形策略见 CET_OFFICIAL_SOURCE。\n"
    for name, value in [("CET_OFFICIAL_SOURCE", source), ("CET_OFFICIAL_WORDS", words),
                        ("CET_OFFICIAL_EXCLUSIONS", exclusions)]:
        text += "export const " + name + " = " + json.dumps(value, ensure_ascii=False, indent=2) + ";\n"
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(text, encoding="utf-8")
    report = {"rows": source["extractedRows"], "words": len(words),
              "level4": sum(item["level"] == 4 for item in words),
              "level6Additional": sum(item["level"] == 6 for item in words),
              "exclusions": exclusions}
    if args.report:
        args.report.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({key: value if key != "exclusions" else len(value)
                      for key, value in report.items()}, ensure_ascii=False))


if __name__ == "__main__":
    main()
