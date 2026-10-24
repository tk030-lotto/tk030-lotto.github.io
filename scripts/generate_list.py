#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Zero Dev - ツール一覧・HOME総数・サイトマップ自動生成スクリプト
仕様: SPECIFICATION.md v2.1 / DEVELOPMENT.md v2.1
"""

import os
import re
import sys
import struct
from pathlib import Path
from datetime import datetime
from html.parser import HTMLParser

# WindowsコンソールでのUTF-8出力を担保
if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass
if sys.stderr and hasattr(sys.stderr, "reconfigure"):
    try:
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass


RESERVED_NAMES = {
    "tools", "consult", "privacy", "disclaimer",
    "assets", "css", "js", "scripts"
}

CATEGORIES = [
    ("general", "一般向けツール"),
    ("dev", "開発・作業支援ツール"),
    ("ai", "AI開発・研究"),
    ("tech", "技術作品・シミュレーター"),
]
CATEGORY_KEYS = [k for k, _ in CATEGORIES]
CATEGORY_LABELS = dict(CATEGORIES)

STATIC_PAGES = [
    "https://zero-dev.jp/",
    "https://zero-dev.jp/tools/",
    "https://zero-dev.jp/consult/",
    "https://zero-dev.jp/privacy/",
    "https://zero-dev.jp/disclaimer/",
]

BASE_URL = "https://zero-dev.jp"


class ToolDetailParser(HTMLParser):
    """tools/[name]/index.html 内の article.tool-detail を抽出するパーサー"""

    def __init__(self):
        super().__init__()
        self.tool_details = []

    def handle_starttag(self, tag, attrs):
        if tag.lower() == "article":
            attrs_dict = dict(attrs)
            classes = attrs_dict.get("class", "").split()
            if "tool-detail" in classes:
                self.tool_details.append(attrs_dict)


def inspect_png_dimensions(file_path: Path):
    """標準ライブラリのみでPNG画像の幅・高さを取得する"""
    try:
        with open(file_path, "rb") as f:
            header = f.read(24)
            if len(header) >= 24 and header[:8] == b"\x89PNG\r\n\x1a\n":
                # IHDRチャンクの幅と高さ (ビッグエンディアン 4バイト x 2)
                width, height = struct.unpack(">II", header[16:24])
                return width, height
    except Exception:
        pass
    return None, None


def main():
    root_dir = Path(__file__).resolve().parent.parent
    tools_dir = root_dir / "tools"
    home_file = root_dir / "index.html"
    sitemap_file = root_dir / "sitemap.xml"
    assets_tools_dir = root_dir / "assets" / "tools"

    errors = []
    warnings = []
    tools_data = []

    # 1. tools/ ディレクトリの走査
    if not tools_dir.exists():
        tools_dir.mkdir(parents=True, exist_ok=True)

    tool_entries = []
    for item in tools_dir.iterdir():
        if item.is_dir() and not item.name.startswith("."):
            tool_entries.append(item)

    # 参照された画像パスの記録（未使用画像チェック用）
    referenced_images = set()

    for tool_folder in sorted(tool_entries, key=lambda x: x.name):
        folder_name = tool_folder.name

        # フォルダ名検査
        if not re.match(r"^[a-z0-9-]+$", folder_name):
            errors.append(f"[{folder_name}] フォルダ名に英小文字・数字・ハイフン以外の文字が含まれています。")
            continue
        if folder_name in RESERVED_NAMES:
            errors.append(f"[{folder_name}] フォルダ名が予約名（{folder_name}）と衝突しています。")
            continue

        index_file = tool_folder / "index.html"
        if not index_file.is_file():
            errors.append(f"[{folder_name}] 個別ページ（index.html）が存在しません。")
            continue

        try:
            with open(index_file, "r", encoding="utf-8") as f:
                content = f.read()
        except Exception as e:
            errors.append(f"[{folder_name}] index.html の読み込みに失敗しました: {e}")
            continue

        # HTML内の全画像参照を収集（個別ページのデモGIF等も検知するため）
        for img_match in re.findall(r'src=["\'](/assets/tools/[^"\']+)["\']', content):
            referenced_images.add(img_match)

        # article.tool-detail のパース
        parser = ToolDetailParser()
        parser.feed(content)

        if len(parser.tool_details) == 0:
            errors.append(f"[{folder_name}] <article class=\"tool-detail\"> が見つかりません。")
            continue
        elif len(parser.tool_details) > 1:
            errors.append(f"[{folder_name}] <article class=\"tool-detail\"> が複数存在します（1つのみ配置してください）。")
            continue

        meta = parser.tool_details[0]

        # 必須属性チェック
        required_attrs = ["data-title", "data-description", "data-category", "data-image", "data-published"]
        missing_attrs = [attr for attr in required_attrs if not meta.get(attr, "").strip()]
        if missing_attrs:
            errors.append(f"[{folder_name}] 必須属性が不足または空です: {', '.join(missing_attrs)}")
            continue

        title = meta["data-title"].strip()
        subtitle = meta.get("data-subtitle", "").strip()
        description = meta["data-description"].strip()
        category = meta["data-category"].strip()
        image_path = meta["data-image"].strip()
        published = meta["data-published"].strip()

        # カテゴリー妥当性チェック
        if category not in CATEGORY_KEYS:
            errors.append(f"[{folder_name}] 不正なカテゴリーです: '{category}'（有効な値: {', '.join(CATEGORY_KEYS)}）")

        # 掲載日形式および実在日チェック
        try:
            parsed_date = datetime.strptime(published, "%Y-%m-%d")
            if parsed_date.strftime("%Y-%m-%d") != published:
                errors.append(f"[{folder_name}] 掲載日のフォーマットが不正です: '{published}'（YYYY-MM-DD 形式が必要）")
        except ValueError:
            errors.append(f"[{folder_name}] 掲載日の日付が不正または実在しません: '{published}'")

        # 画像パスの検査
        if not image_path.startswith("/"):
            errors.append(f"[{folder_name}] 画像パスはルート相対（/ で始まる形）で指定してください: '{image_path}'")
        else:
            rel_image_path = image_path.lstrip("/")
            full_image_path = root_dir / rel_image_path
            if not full_image_path.is_file():
                errors.append(f"[{folder_name}] 指定された画像ファイルが存在しません: '{image_path}'")
            else:
                # 警告検査: 画像ファイル名とフォルダ名の一致
                img_stem = full_image_path.stem
                if img_stem != folder_name:
                    warnings.append(f"[{folder_name}] 画像ファイル名（{full_image_path.name}）がフォルダ名（{folder_name}）と一致していません。")

                # 警告検査: PNG画像解析
                width, height = inspect_png_dimensions(full_image_path)
                if width is None or height is None:
                    warnings.append(f"[{folder_name}] 画像ファイル（{full_image_path.name}）が正常なPNG形式ではないか解析できませんでした。")
                else:
                    if width < 960 or width > 1920:
                        warnings.append(f"[{folder_name}] 画像の幅が推奨範囲（960px〜1920px）外です: {width}px")
                    ratio = width / height if height > 0 else 0
                    target_ratio = 16.0 / 9.0
                    if abs(ratio - target_ratio) / target_ratio > 0.02:
                        warnings.append(f"[{folder_name}] 画像のアスペクト比が 16:9 から ±2% を外れています: {width}x{height} (比率: {ratio:.3f})")

        # 警告検査: 文字数
        if len(description) > 120:
            warnings.append(f"[{folder_name}] 一言説明（data-description）が120字を超えています（現在: {len(description)}字）。")
        if len(subtitle) > 30:
            warnings.append(f"[{folder_name}] サブテキスト（data-subtitle）が30字を超えています（現在: {len(subtitle)}字）。")

        tools_data.append({
            "folder": folder_name,
            "title": title,
            "subtitle": subtitle,
            "description": description,
            "category": category,
            "image": image_path,
            "published": published,
        })

    # HOME の目印コメントチェック
    if not home_file.is_file():
        errors.append("HOMEファイル（index.html）が存在しません。")
    else:
        try:
            with open(home_file, "r", encoding="utf-8") as f:
                home_content = f.read()
            if "<!-- TOOLS_COUNT:START -->" not in home_content or "<!-- TOOLS_COUNT:END -->" not in home_content:
                errors.append("index.html に目印コメント <!-- TOOLS_COUNT:START -->...<!-- TOOLS_COUNT:END --> が見つかりません。")
        except Exception as e:
            errors.append(f"index.html の読み込みに失敗しました: {e}")

    # 未使用画像チェック（assets/tools/）
    if assets_tools_dir.is_dir():
        for img_file in assets_tools_dir.iterdir():
            if img_file.is_file() and not img_file.name.startswith("."):
                rel_path = f"/assets/tools/{img_file.name}"
                if rel_path not in referenced_images:
                    warnings.append(f"[assets/tools] 未使用の画像ファイルがあります: {img_file.name}")

    # エラーがあれば終了
    if errors:
        print("=" * 60, file=sys.stderr)
        print("【エラー】以下の問題が検知されたため、ファイル更新を中断しました:", file=sys.stderr)
        for err in errors:
            print(f"  - {err}", file=sys.stderr)
        print("=" * 60, file=sys.stderr)
        sys.exit(1)

    # 2. ファイルの生成・更新
    updated_files = []

    # (A) tools/index.html の生成
    # ソート順: カテゴリー順 -> 掲載日降順 -> フォルダ名昇順
    def sort_key(item):
        cat_index = CATEGORY_KEYS.index(item["category"]) if item["category"] in CATEGORY_KEYS else 99
        return (cat_index, -int(item["published"].replace("-", "")), item["folder"])

    sorted_tools = sorted(tools_data, key=sort_key)

    tools_by_cat = {k: [] for k in CATEGORY_KEYS}
    for item in sorted_tools:
        tools_by_cat[item["category"]].append(item)

    tools_html_sections = []
    if not sorted_tools:
        tools_html_sections.append('      <div class="empty-tools"><p>掲載準備中です</p></div>')
    else:
        for cat_key, cat_label in CATEGORIES:
            cat_items = tools_by_cat[cat_key]
            if not cat_items:
                continue

            section_html = [
                f'      <section class="tool-category-section">',
                f'        <h2 class="category-title">{cat_label}</h2>',
                f'        <div class="tools-grid">'
            ]
            for t in cat_items:
                subtitle_html = f'<p class="tool-card-subtitle">{t["subtitle"]}</p>' if t["subtitle"] else ''
                card_html = f'''          <article class="tool-card">
            <div class="tool-card-thumb">
              <img src="{t["image"]}" alt="{t["title"]}" loading="lazy">
            </div>
            <div class="tool-card-content">
              <h3 class="tool-card-title">{t["title"]}</h3>
              {subtitle_html}
              <p class="tool-card-desc">{t["description"]}</p>
              <div class="tool-card-footer">
                <a href="/tools/{t["folder"]}/" class="btn btn-primary">詳細を見る</a>
              </div>
            </div>
          </article>'''
                section_html.append(card_html)
            section_html.append('        </div>')
            section_html.append('      </section>')
            tools_html_sections.append("\n".join(section_html))

    tools_body_content = "\n\n".join(tools_html_sections)

    tools_index_html = f'''<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>ツール | Zero Dev</title>
  <meta name="description" content="Zero Dev で制作・公開している自作ツール・ソフトウェア・技術作品の一覧です。">
  <link rel="canonical" href="https://zero-dev.jp/tools/">
  <link rel="stylesheet" href="/css/style.css">
</head>
<body>
  <header class="site-header">
    <div class="container header-inner">
      <a href="/" class="site-logo">Zero Dev</a>
      <nav class="site-nav">
        <a href="/">HOME</a>
        <a href="/tools/" class="active">ツール</a>
        <a href="/consult/">相談・要望</a>
      </nav>
    </div>
  </header>

  <main class="site-main">
    <div class="container">
      <section class="hero-section">
        <h1 class="hero-title">ツール一覧</h1>
        <p class="hero-description">
          Zero Dev で制作・公開している自作ツールや技術作品の一覧です。ブラウザ上で直接ご利用いただけます。
        </p>
      </section>

{tools_body_content}
    </div>
  </main>

  <footer class="site-footer">
    <div class="container footer-inner">
      <nav class="footer-nav">
        <a href="https://github.com/tk030-lotto">GitHub</a>
        <span class="footer-divider">·</span>
        <a href="https://note.com/tk030_lotto">note</a>
        <span class="footer-divider">·</span>
        <a href="#">My Tools</a>
        <span class="footer-divider">·</span>
        <a href="/privacy/">プライバシーポリシー</a>
        <span class="footer-divider">·</span>
        <a href="/disclaimer/">免責事項</a>
      </nav>
      <p class="footer-copyright">© 2026 Zero Dev</p>
    </div>
  </footer>
</body>
</html>
'''

    tools_index_file = tools_dir / "index.html"
    with open(tools_index_file, "w", encoding="utf-8", newline="\n") as f:
        f.write(tools_index_html)
    updated_files.append("tools/index.html")

    # (B) index.html (HOME) の TOOLS_COUNT 更新
    pattern = r"(<!-- TOOLS_COUNT:START -->)(.*?)(<!-- TOOLS_COUNT:END -->)"
    replacement = rf"\g<1>{len(tools_data)}\g<3>"
    new_home_content = re.sub(pattern, replacement, home_content)

    if new_home_content != home_content:
        with open(home_file, "w", encoding="utf-8", newline="\n") as f:
            f.write(new_home_content)
        updated_files.append(f"index.html (総掲載数: {len(tools_data)})")
    else:
        updated_files.append(f"index.html (掲載数 {len(tools_data)}: 変更なし)")

    # (C) sitemap.xml の生成
    sitemap_urls = list(STATIC_PAGES)
    for t in sorted_tools:
        sitemap_urls.append(f"{BASE_URL}/tools/{t['folder']}/")

    sitemap_entries = [
        "<?xml version=\"1.0\" encoding=\"UTF-8\"?>",
        "<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">"
    ]
    for url in sitemap_urls:
        sitemap_entries.append("  <url>")
        sitemap_entries.append(f"    <loc>{url}</loc>")
        sitemap_entries.append("  </url>")
    sitemap_entries.append("</urlset>\n")

    with open(sitemap_file, "w", encoding="utf-8", newline="\n") as f:
        f.write("\n".join(sitemap_entries))
    updated_files.append(f"sitemap.xml (登録URL: {len(sitemap_urls)} 件)")

    # 3. 実行結果サマリー表示
    print("=" * 60)
    print("Zero Dev - 一覧・総数・サイトマップ生成")
    print("=" * 60)
    print(f"掲載総数: {len(tools_data)} 件")
    for cat_key, cat_label in CATEGORIES:
        count = len(tools_by_cat[cat_key])
        print(f"  - {cat_label} ({cat_key}): {count} 件")

    print("\n更新ファイル:")
    for uf in updated_files:
        print(f"  - {uf}")

    if warnings:
        print("\n【警告】")
        for warn in warnings:
            print(f"  - {warn}")

    print("=" * 60)
    print("処理が正常に完了しました。")


if __name__ == "__main__":
    main()
