# 📧 ジャンル別投資ニュースレター自動配信システム

投資関連ブログのRSSフィードを巡回し、AI分析でジャンル別にニュースレターを自動配信するシステムです。

## ✨ 主な機能

- **📰 RSSフィード管理**: 91個のアクティブな投資関連ブログを自動巡回
- **🤖 AI分析**: Claude APIで記事の重要度を自動判定・要約生成
- **📊 ジャンル別配信**: 5つのジャンルに分けて配信
- **⏰ 定期配信**: 毎朝7時・毎晩20時の自動配信（Windows タスクスケジューラ）
- **📱 メール配信**: HTML形式の美しいニュースレター

## 🎯 配信ジャンル

1. **👨‍💼 個人投資家** - 実績のある個人投資家ブログ（11フィード）
2. **📊 マクロ経済** - シンクタンクレポート、日経ニュース（9フィード）
3. **💹 投資全般** - 株式投資関連ブログ、決算情報（47フィード）
4. **₿ 仮想通貨** - 仮想通貨・暗号資産情報（1フィード）
5. **📚 中学受験** - 中学受験関連情報（1フィード）

## 🚀 クイックスタート

### 1. インストール

```bash
npm install
```

### 2. 環境変数の設定

`.env` ファイルを作成：

```env
GMAIL_USER=your-email@gmail.com
GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx
NEWSLETTER_TO=recipient@example.com
ANTHROPIC_API_KEY=sk-ant-xxxxx
```

### 3. 手動実行（テスト）

```bash
# 全ジャンル配信（メールなし、ファイル保存のみ）
npm run batch:test

# 実際にメール送信
npm run batch

# 特定ジャンルのみ
npm run batch:investors  # 個人投資家のみ
npm run batch:macro      # マクロ経済のみ
```

### 4. 定期配信の設定

詳しくは [QUICK_START.md](./QUICK_START.md) を参照してください。

Windows タスクスケジューラに以下のバッチファイルを登録：
- **朝7時**: `run-daily-newsletters.bat` - 過去24時間の記事
- **夜20時**: `run-evening-newsletters.bat` - 過去12時間の記事

## 📖 ドキュメント

- **[QUICK_START.md](./QUICK_START.md)** - 5分でできる設定ガイド
- **[TASK_SCHEDULER_SETUP.md](./TASK_SCHEDULER_SETUP.md)** - タスクスケジューラ詳細設定
- **[SCHEDULED_NEWSLETTER_SETUP.md](./SCHEDULED_NEWSLETTER_SETUP.md)** - ジャンル設定・カスタマイズ

## 💻 技術スタック

- **Node.js** (ES Modules)
- **rss-parser** - RSSフィード解析
- **@anthropic-ai/sdk** - Claude API（AI分析）
- **nodemailer** - メール送信（Gmail経由）

## 📂 プロジェクト構成

```
collect-blog-articles/
├── src/
│   ├── batch-newsletter.js      # ジャンル別バッチ配信
│   ├── rss-manager.js            # RSSフィード管理
│   ├── analyzer.js               # AI分析
│   ├── newsletter.js             # ニュースレター生成
│   ├── mailer.js                 # メール送信
│   └── index.js                  # メインエントリーポイント
├── config/
│   ├── feeds.json                # RSSフィード設定（131件）
│   └── categories.json           # カテゴリ設定
├── output/                       # 生成されたニュースレター
├── logs/                         # 実行ログ
├── run-daily-newsletters.bat     # 朝版バッチ
├── run-evening-newsletters.bat   # 夜版バッチ
└── package.json
```

## 🔧 カスタマイズ

### ジャンルの追加・変更

`src/batch-newsletter.js` の `NEWSLETTER_GENRES` を編集：

```javascript
{
  id: 'your-genre',
  name: 'あなたのジャンル',
  categories: ['カテゴリ1', 'カテゴリ2'],
  description: '説明文',
  emoji: '📰'
}
```

### RSSフィードの追加

`config/feeds.json` に追加：

```json
{
  "id": "feed/https://example.com/feed",
  "url": "https://example.com/feed",
  "title": "サイト名",
  "category": "投資",
  "topics": []
}
```

## 📊 統計

- **総フィード数**: 131件
- **アクティブ**: 91件
- **無効化**: 40件（エラーサイト）
- **配信ジャンル**: 5種類

## 🛠️ 利用可能なコマンド

```bash
# カテゴリ一覧を表示
npm run start -- --list

# 特定カテゴリのフィード一覧
npm run start -- --show 投資

# 記事取得のみ（メール送信なし）
npm run fetch

# ニュースレター生成＆送信
npm run daily

# バッチ配信（全ジャンル）
npm run batch

# バッチ配信（テスト、メール送信なし）
npm run batch:test

# 特定ジャンルのみ配信
npm run batch:investors
npm run batch:macro
```

## 📝 ログの確認

```bash
# ログを表示
type logs\batch-newsletter.log

# 最新20行を表示
powershell -command "Get-Content logs\batch-newsletter.log -Tail 20"
```

## 🔒 セキュリティ

- `.env` ファイルは `.gitignore` に含まれています
- Gmail アプリパスワードを使用（通常のパスワードは使わない）
- API キーは環境変数で管理

## 📄 ライセンス

MIT

## 🤝 貢献

このプロジェクトは個人用途で作成されていますが、改善提案は歓迎します。

## 📧 お問い合わせ

問題が発生した場合は、ログファイルとエラーメッセージを確認してください。

---

**Powered by:**
- [Anthropic Claude](https://www.anthropic.com/) - AI分析
- [Node.js](https://nodejs.org/) - ランタイム
- [Gmail](https://gmail.com/) - メール配信
