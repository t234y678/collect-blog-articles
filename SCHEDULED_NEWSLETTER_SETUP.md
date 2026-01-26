# ジャンル別ニュースレター定期配信設定ガイド

## 概要

複数ジャンルのニュースレターを同タイミングで自動配信する仕組みです。

## ジャンル設定

現在の配信ジャンル（`src/batch-newsletter.js`で定義）:

- **👨‍💼 個人投資家**: 実績のある個人投資家ブログ
- **📊 マクロ経済**: シンクタンクレポート、日経ニュース
- **💹 投資全般**: 株式投資関連ブログ、決算情報
- **₿ 仮想通貨**: 仮想通貨・暗号資産情報
- **📚 中学受験**: 中学受験関連情報

## 手動実行

### すべてのジャンルを配信

```bash
npm run batch
```

### テスト実行（メール送信なし、ファイル保存のみ）

```bash
npm run batch:test
```

### 特定ジャンルのみ配信

```bash
# 個人投資家のみ
npm run batch:investors

# マクロ経済のみ
npm run batch:macro

# 複数ジャンル指定
node src/batch-newsletter.js --genres investors,macro
```

### オプション

- `--genres <ids>`: 配信するジャンルをカンマ区切りで指定
- `--hours <num>`: 記事取得期間（デフォルト: 24時間）
- `--no-ai`: AI分析をスキップ
- `--no-send`: メール送信せず、ファイル保存のみ

## 定期実行の設定

### Windows タスクスケジューラ

#### 1. タスクスケジューラを開く

- `Win + R` → `taskschd.msc` と入力して実行

#### 2. 基本タスクの作成

1. 右側の「操作」パネルから「基本タスクの作成」をクリック
2. タスク名を入力: `ニュースレター定期配信`
3. 説明: `投資ニュースレターをジャンル別に配信`

#### 3. トリガーの設定

- 「毎日」を選択
- 開始日時を設定（例: 毎朝 8:00）
- 1日ごとに繰り返す

#### 4. 操作の設定

- 「プログラムの開始」を選択
- **プログラム/スクリプト**: `C:\Users\Yuji\dev\collect-blog-articles\run-daily-newsletters.bat`
- **開始オプション**: `C:\Users\Yuji\dev\collect-blog-articles`

#### 5. 完了

- 「完了」をクリックしてタスクを作成

#### 6. 詳細設定（オプション）

タスクを右クリック → プロパティ:

- **全般タブ**:
  - ☑ ユーザーがログオンしているかどうかにかかわらず実行する
  - ☑ 最上位の特権で実行する

- **条件タブ**:
  - ☐ コンピューターをAC電源で使用している場合のみタスクを開始する（ノートPCの場合）

- **設定タブ**:
  - ☑ タスクが失敗した場合の再起動の間隔: 1分
  - ☑ 再起動の試行回数: 3

### 複数の時間帯で配信する場合

#### 朝版（8:00） - 過去24時間の記事

```bat
node src\batch-newsletter.js
```

#### 夕方版（18:00） - 過去12時間の記事

```bat
node src\batch-newsletter.js --hours 12
```

それぞれ別のタスクとして登録してください。

## ログの確認

### ログディレクトリの作成

```bash
mkdir logs
```

バッチファイル（`run-daily-newsletters.bat`）が自動的に `logs/batch-newsletter.log` にログを追記します。

### ログの確認方法

```bash
# 最新のログを表示
type logs\batch-newsletter.log

# 最後の20行を表示
powershell -command "Get-Content logs\batch-newsletter.log -Tail 20"
```

## トラブルシューティング

### メールが送信されない

1. `.env` ファイルの確認:
   ```
   GMAIL_USER=your-email@gmail.com
   GMAIL_APP_PASSWORD=your-app-password
   NEWSLETTER_TO=recipient@example.com
   ANTHROPIC_API_KEY=your-api-key
   ```

2. Gmailアプリパスワードの確認:
   - Googleアカウント → セキュリティ → 2段階認証 → アプリパスワード

### タスクが実行されない

1. タスクスケジューラで実行履歴を確認
2. 手動でバッチファイルを実行してエラーを確認:
   ```bash
   run-daily-newsletters.bat
   ```

### Node.jsのパスが通っていない

バッチファイルの先頭に Node.js のフルパスを指定:

```bat
set PATH=C:\Program Files\nodejs;%PATH%
node src\batch-newsletter.js
```

## ジャンルのカスタマイズ

`src/batch-newsletter.js` の `NEWSLETTER_GENRES` 配列を編集:

```javascript
const NEWSLETTER_GENRES = [
  {
    id: 'your-genre',           // ジャンルID（ファイル名に使用）
    name: 'あなたのジャンル',      // 表示名
    categories: ['カテゴリ1', 'カテゴリ2'],  // feeds.jsonのカテゴリ
    description: '説明文',
    emoji: '📰'                  // アイコン
  },
  // ... 他のジャンル
];
```

## 配信結果の確認

配信後、`output/` ディレクトリに以下のファイルが生成されます:

```
output/
├── newsletter-2026-01-27-investors.html
├── newsletter-2026-01-27-investors.txt
├── newsletter-2026-01-27-macro.html
├── newsletter-2026-01-27-macro.txt
├── newsletter-2026-01-27-investment.html
└── newsletter-2026-01-27-investment.txt
```

## よくある質問

### Q: 特定のジャンルだけ配信したくない

A: `--genres` オプションで配信したいジャンルのみ指定してください:

```bash
node src/batch-newsletter.js --genres investors,macro
```

### Q: 配信時刻を変更したい

A: タスクスケジューラでタスクのトリガー時刻を変更してください。

### Q: AI分析をスキップして高速化したい

A: `--no-ai` オプションを追加:

```bash
node src/batch-newsletter.js --no-ai
```

### Q: 週末は配信したくない

A: タスクスケジューラのトリガー設定で「週単位」を選択し、月〜金のみ実行するよう設定してください。
