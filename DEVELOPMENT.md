# Zero Dev Development Guide

- Document Version: 2.1
- Date: 2026-10-24
- 対応仕様: SPECIFICATION.md v2.1

## 1. この文書の目的

Zero Dev 本体の開発・更新・公開手順をまとめる。
Zero Dev は「管理ツールを作らず、手動で個別対応する」ことを基本とする。ただし、更新漏れが起きやすい一覧・HOME の総数・sitemap は、スクリプトで一度に更新する。

基本フロー:
```text
編集
  ↓
（ツール追加・変更時）スクリプト実行
  ↓
ローカル確認
  ↓
commit
  ↓
push
  ↓
https://zero-dev.jp/ を確認
```

## 2. リポジトリとフォルダ構成

本サイトは `tk030-lotto.github.io` リポジトリで管理し、`zero-dev.jp` に公開する。
（既存のプロフィール用リポジトリ `tk030-lotto` や、各ツールのリポジトリには触れない）

想定するフォルダ構成:
```text
zero-dev/ (または tk030-lotto.github.io)
├─ index.html          (HOME。総掲載数の部分のみスクリプトが更新)
├─ 404.html            (エラーページ)
├─ CNAME               (カスタムドメイン: zero-dev.jp)
├─ tools/
│  ├─ index.html       (ツール一覧: 自動生成)
│  └─ [name]/
│     └─ index.html    (ツール個別ページ: 手動作成)
├─ consult/
│  └─ index.html       (相談・要望・支援)
├─ privacy/
│  └─ index.html       (プライバシーポリシー)
├─ disclaimer/
│  └─ index.html       (免責事項)
├─ assets/
│  ├─ tools/           (ツールのスクリーンショット)
│  └─ ogp.png          (共通OGP画像)
├─ scripts/
│  └─ generate_list.py (一覧・総数・sitemap の生成スクリプト)
├─ css/
│  └─ style.css
├─ js/
│  └─ (必要に応じて)
├─ favicon.ico
├─ sitemap.xml         (自動生成)
├─ robots.txt          (手動。sitemap の URL を記載)
├─ README.md
├─ SPECIFICATION.md
└─ DEVELOPMENT.md
```

## 3. ツールを追加する手順（手動）

管理ツールや `ZERO-DEV.md` は使用しない。1ツールずつ個別対応する。

1. **掲載前チェック**
   - 9章のチェックを行い、掲載してよい品質かを確認する。
2. **名前を決める**
   - ツールのフォルダ名 `[name]` を決める（英小文字・数字・ハイフン。ツールのリポジトリ名と同じにすることを推奨）。
   - SPECIFICATION.md 8.3 の予約名と重ならないか確認する。
3. **個別ページの作成**
   - `tools/[name]/index.html` を作成する。
   - SPECIFICATION.md の「8. ツール個別ページ」に従い、用途・なぜ作ったか等を記述する。
   - 一覧生成用の `data-*` 属性を付ける（SPECIFICATION.md 8.1）。`data-published` は、掲載する日の日付を入れる。
   - ツール名（メイン）とサブテキストの付け方は、SPECIFICATION.md 8.1 に従う。
4. **画像の配置**
   - スクリーンショットを `assets/tools/[name].png` に配置する（PNG、16:9、1280×720 が標準）。
   - `data-image` には `/assets/tools/[name].png` と書く（ルート相対）。
5. **スクリプトの実行**
   - ターミナルで `python scripts/generate_list.py` を実行する。
   - `python` が使えない Windows 環境では `py scripts/generate_list.py` を試す。
   - エラーが出た場合は、内容を直してから再実行する（4章）。
6. **ローカル確認**
   - 6章の方法で、`tools/` と個別ページ、HOME の総数を確認する。
7. **公開前チェックと commit / push**
   - 10章のチェックを行い、`git add`（追加・変更したファイルのみ）、`commit`、`push` する。
   - 変更されるのは、通常、個別ページ、画像、`tools/index.html`、`index.html`（総数の部分）、`sitemap.xml`。

## 4. 一覧生成スクリプト（generate_list.py）

### 4.1 役割
`tools/[name]/index.html` を走査して `data-*` 属性を読み取り、次の3つを更新する。

| 更新するもの | 内容 |
|---|---|
| `tools/index.html` | ツール一覧。全体を自動生成する（直接手編集しない） |
| `index.html`（HOME） | 目印コメント `<!-- TOOLS_COUNT:START -->` と `<!-- TOOLS_COUNT:END -->` の間（総掲載数）だけを書き換える |
| `sitemap.xml` | 固定ページ（`/`、`/tools/`、`/consult/`、`/privacy/`、`/disclaimer/`）と、すべての個別ページを含めて、全体を自動生成する（`lastmod` は付けない） |

実行環境は Python 3.x。標準ライブラリのみを使い、追加のインストールは不要。

### 4.2 並び順と表示
- カテゴリーの順: 一般向け（`general`）→ 開発・作業支援（`dev`）→ AI開発・研究（`ai`）→ 技術作品・シミュレーター（`tech`）
- 各カテゴリー内: `data-published` の新しい順。同じ日付はフォルダ名の昇順
- 0件のカテゴリーは、見出しごと出力しない
- 掲載が1件もない場合は、「掲載準備中です」と出力する

### 4.3 検査（エラー・警告）
すべてのツールを検査してから書き込む。エラーが1つでもある場合は、何も書き換えずに終了する。警告は、表示したうえで処理を続ける。

エラー（処理を止める）:

| 検査 | 内容 |
|---|---|
| フォルダ名 | 英小文字・数字・ハイフン以外を含む、または予約名と同じ |
| 個別ページ | `tools/[name]/` に `index.html` がない |
| メタデータの要素 | `article.tool-detail` が、ない、または2つ以上ある |
| 必須属性 | `data-title`、`data-description`、`data-category`、`data-image`、`data-published` のどれかがない、または空 |
| カテゴリー | `data-category` が `general` / `dev` / `ai` / `tech` 以外 |
| 掲載日 | `data-published` が `YYYY-MM-DD` ではない、または存在しない日付 |
| 画像のパス | `data-image` が `/` で始まらない |
| 画像ファイル | `data-image` が指すファイルが存在しない |
| HOME の目印 | `index.html` に目印コメントが見つからない |

警告（処理は続ける）:

| 検査 | 内容 |
|---|---|
| 説明の長さ | `data-description` が120字を超える |
| サブテキストの長さ | `data-subtitle` が30字を超える |
| 画像のファイル名 | ファイル名がフォルダ名と一致しない |
| 画像の形式・サイズ | PNG ではない、縦横比が16:9から ±2% を外れる、幅が960px未満または1920px超（PNG は標準ライブラリで読み取る） |
| 未使用の画像 | `assets/tools/` に、どの個別ページからも参照されていない画像がある |

### 4.4 実行結果の表示
実行の終わりに、次の内容を簡潔に表示する。
- 掲載数（総数とカテゴリー別）
- 更新したファイル
- 警告（あれば）
- エラー（あれば。その場合、ファイルは書き換えない）

### 4.5 失敗したとき
- エラーのメッセージを読み、該当する個別ページを直して再実行する。
- 原因が分からない場合は、エラーメッセージの全文と `scripts/generate_list.py` を AI に渡して相談する。
- スクリプトは検査後にまとめて書き込むため、エラーで止まった場合に、ファイルが中途半端に書き換わることはない。念のため、実行前は未コミットの変更がない状態にしておくと、`git diff` で変更内容を確認しやすい。

## 5. サイト本体（HOME、法務、デザイン等）の修正

管理ツールではなく、Zero Dev 本体のファイルを直接編集する。
対象: HOME、相談・要望、プライバシーポリシー、免責事項、CSS、デザイン、OGP、favicon、フッター、404 等。

手順:
1. ファイルを編集
2. ローカルで確認（6章）
3. 10章のチェック（変更した範囲）
4. commit / push
5. 実サイト（https://zero-dev.jp/）で確認

注意:
- `tools/index.html` と `sitemap.xml` は、スクリプトで生成するため、直接編集しない。
- `index.html`（HOME）は手動で編集してよいが、`TOOLS_COUNT` の目印コメントは消さない。
- フッターは次の内容を基本とする: `© 2026 Zero Dev`、GitHub、note、My Tools、プライバシーポリシー、免責事項。

## 6. ローカル確認方法

ページ内のリンクや画像のパスは、`/` から始まるルート相対で書く。そのため、HTML ファイルをブラウザで直接開く（`file://`）と、画像などが表示されない。確認には、簡易サーバーを使う。

次のどちらかを、リポジトリのルートで実行する。

- Python がある場合:
  ```bash
  python -m http.server 8000
  ```
- Node.js がある場合:
  ```bash
  npx serve .
  ```

起動後、ブラウザで `http://localhost:8000/`（`npx serve` の場合は表示された URL）を開く。確認が終わったら、`Ctrl + C` でサーバーを止める。

## 7. Git運用

- Zero Dev 本体のリポジトリ（`tk030-lotto.github.io`）は `main` ブランチのみ使用する。
- feature ブランチは使用しない。
- commit メッセージは内容を端的に表す（例: `Add tool: PrivacyPhoto`, `Update tool: PrivacyPhoto`, `Remove tool: ○○`, `Update home page`）。
- push は通常の push のみ行う。force push は禁止する。
- commit や push に失敗したときは、自動で元に戻さず、`git status` と `git log --oneline -3` で状態を確認してから対応する。push が拒否された場合は、`git pull` したうえで再度 push する。

## 8. 掲載済みツールの変更・掲載終了・名前変更

### 8.1 内容の変更
個別ページを編集し、スクリプトを実行して、commit / push する。`data-published` は変更しない。

### 8.2 掲載終了
1. `tools/[name]/` を削除する。
2. `assets/tools/[name].png` を削除する。
3. `python scripts/generate_list.py` を実行する（一覧・総数・sitemap が更新される）。
4. commit / push する。
5. note 等から個別ページへリンクしている場合は、削除する代わりに、「公開を終了しました」という案内のページに差し替える選択肢もある。

### 8.3 ツールのリポジトリ名を変更した場合
- 個別ページのデモ URL・GitHub URL を新しい URL に直す。
- フォルダ名は変えなくてもよい。変える場合は、画像のファイル名と `data-image` も合わせ、旧 URL のページを残すかどうかを決める。
- GitHub Pages のデモ URL（`https://zero-dev.jp/リポジトリ名/`）も変わるため、リンク切れがないか確認する。

## 9. 掲載前チェック（ツールの品質）

掲載する前に、ツールごとに次を確認する。基準はツールごとに決めてよく、AI による確認を併用してよい。

- 主な機能が、実際に操作して意図どおりに動く
- スマートフォンでも使える（または、対応していない旨を個別ページに書く）
- 入力が不正なときなどに、分かりにくい挙動になっていない
- 個別ページの説明が、実際の動作と一致している（「外部に送信しない」などの主張は、実際に確認する）
- ライセンスの記載が、ツールのリポジトリの `LICENSE` と一致している
- 個人情報、認証情報、機密情報が、コードや画像に含まれていない
- 権利上公開できない素材（画像、フォント、コード等）を使っていない
- スクリーンショットが用意できている（PNG、16:9、1280×720）

掲載しないもの: 個人用 / 非公開、権利上または機密上公開できないもの、その他の理由で公開できないもの。

## 10. 公開前チェック（サイト）

push する前に、変更した範囲に応じて確認する。初回公開時は、すべて確認する。

- PC / スマートフォン表示
- 主要ページ（`/`, `/tools/`, `/consult/`, `/privacy/`, `/disclaimer/`）
- 追加・更新したツールのカードと個別ページ
- HOME の総掲載数が、実際の掲載数と一致している
- リンク切れ（デモ URL、GitHub URL、note・支援記事の URL 等）
- title、meta description、canonical（各ページ）
- favicon、OGP
- 404 ページ
- sitemap（新しい個別ページが入っている）、robots
- `/consult/` の注意書き（契約の成立ではないこと、返信を保証しないこと、要望がすべて開発されるとは限らないこと）
- `/consult/` に、個別の開発の料金・条件・申込みを載せていない
- プライバシーポリシー・免責事項の記載（アクセス解析を追加した場合は、その記載）

## 11. 公開後確認

push 後、実サイト（https://zero-dev.jp/）をブラウザで確認する。

- HOME、ツール一覧、追加・更新したカード、個別ページ
- 主要なリンク
- HTTPS で表示される（`www` なしの URL が正式）
- 掲載終了した場合は、旧 URL の表示（案内ページ、または 404）

## 12. 初回公開の流れ

初回公開では、次を順に行う。

1. `tk030-lotto.github.io` リポジトリを作成し、骨組み（HOME、一覧、相談、法務、404、CSS）を置く。
2. 公開の設定を行う。`CNAME` ファイル、GitHub Pages の公開元（`main` のルート）、HTTPS の有効化。ドメインの DNS 設定は、GitHub の公式手順に従う。
3. 最初のツール（PrivacyPhoto）の個別ページを作り、スクリプトを実行する（3章）。
4. 10章のチェックをすべて行う。
5. 公開後、`zero-dev.jp` が表示されることを確認する。
6. 既存のツールの URL が `zero-dev.jp/リポジトリ名/` に変わるため、旧 URL（`tk030-lotto.github.io/リポジトリ名/`）から新 URL へ転送されるかを、実際に開いて確認する。
7. Search Console にドメインを登録する。sitemap の送信は、必要になってから行ってよい。
8. note の支援記事、GitHub Sponsors（登録後）へのリンクを、サイトに反映する。

公開前に、プライバシーポリシーの運営者名・連絡先の扱いを、専門家等に確認する（SPECIFICATION.md 14.5）。

## 13. 仕様変更

大きな仕様変更を行う場合:
1. 仕様を確定
2. `SPECIFICATION.md` 更新（バージョン番号を上げ、変更履歴に追記）
3. 必要なら `DEVELOPMENT.md` と `README.md` を更新
4. 実装
5. 確認
6. commit / push

サイトを複雑化させるためだけの機能追加は行わず、必要になったものだけ追加する。
