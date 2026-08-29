# -*- coding: utf-8 -*-
"""卷尺资讯网站重构脚本：
1. 把所有文章 html 移动到 articles/ 文件夹
2. 自动修改文章页内的"返回首页"链接为 ../index.html
3. 自动修改首页卡片链接为 articles/xxx.html
"""
import os
import re
import shutil

ROOT = os.path.dirname(os.path.abspath(__file__))
ARTICLES_DIR = os.path.join(ROOT, "articles")
# 根目录保留文件（不移动）
EXCLUDE = {"index.html", "sitemap.xml", "CNAME", "README.md", "restructure.py"}

os.makedirs(ARTICLES_DIR, exist_ok=True)

# ---------- 1. 处理文章页：修改链接 + 移动到 articles/ ----------
moved = []
for f in os.listdir(ROOT):
    if not f.lower().endswith(".html") or f in EXCLUDE:
        continue
    src = os.path.join(ROOT, f)
    with open(src, "r", encoding="utf-8") as fp:
        content = fp.read()

    # 文章页内所有 index.html 链接（返回按钮+导航栏）改成上级目录
    new_content = re.sub(
        r'href=["\'](?:\./)?index\.html["\']',
        'href="../index.html"',
        content,
    )

    with open(src, "w", encoding="utf-8") as fp:
        fp.write(new_content)

    dst = os.path.join(ARTICLES_DIR, f)
    shutil.move(src, dst)
    moved.append(f)
    print("已移动: articles/%s" % f)

# ---------- 2. 处理首页：文章卡片链接加 articles/ 前缀 ----------
index_path = os.path.join(ROOT, "index.html")
if os.path.exists(index_path):
    with open(index_path, "r", encoding="utf-8") as fp:
        content = fp.read()

    # 只给站内文章链接加前缀（排除 index.html / http外链 / #锚点 / 空）
    new_index = re.sub(
        r'href=["\'](?!index\.html|http|#)([^"\']*?\.html)["\']',
        r'href="articles/\1"',
        content,
    )

    with open(index_path, "w", encoding="utf-8") as fp:
        fp.write(new_index)
    print("已更新: index.html（卡片链接加 articles/ 前缀）")

print("\n完成！共移动 %d 篇文章到 articles/ 文件夹" % len(moved))
