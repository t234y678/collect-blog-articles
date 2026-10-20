import 'dotenv/config';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import RSSManager from './rss-manager.js';
import NewsletterGenerator from './newsletter.js';
import ArticleAnalyzer from './analyzer.js';
import Mailer from './mailer.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ジャンル定義（配信したいジャンル）
const NEWSLETTER_GENRES = [
  {
    id: 'investors',
    name: '個人投資家',
    categories: ['上手い人'],
    description: '実績のある個人投資家ブログ',
    emoji: '👨‍💼'
  },
  {
    id: 'macro',
    name: 'マクロ経済',
    categories: ['真面目なレポート', '日経'],
    description: 'シンクタンクレポート、日経ニュース',
    emoji: '📊'
  },
  {
    id: 'investment',
    name: '投資全般',
    categories: ['投資', '決算サマリー'],
    description: '株式投資関連ブログ、決算情報',
    emoji: '💹'
  },
  {
    id: 'crypto',
    name: '仮想通貨',
    categories: ['仮想通貨'],
    description: '仮想通貨・暗号資産情報',
    emoji: '₿'
  },
  {
    id: 'education',
    name: '中学受験',
    categories: ['中学受験'],
    description: '中学受験関連情報',
    emoji: '📚'
  }
];

async function loadConfig() {
  const configPath = path.join(__dirname, '../config/categories.json');
  const data = await fs.readFile(configPath, 'utf-8');
  return JSON.parse(data);
}

async function saveNewsletterToFile(newsletter, date, genreId) {
  const outputDir = path.join(__dirname, '../output');
  await fs.mkdir(outputDir, { recursive: true });

  const dateStr = date.toISOString().split('T')[0];
  const htmlPath = path.join(outputDir, `newsletter-${dateStr}-${genreId}.html`);
  const textPath = path.join(outputDir, `newsletter-${dateStr}-${genreId}.txt`);

  await fs.writeFile(htmlPath, newsletter.html, 'utf-8');
  await fs.writeFile(textPath, newsletter.text, 'utf-8');

  return { htmlPath, textPath };
}

async function fetchEntriesForGenre(rssManager, genre, hoursBack = 24) {
  console.log(`\n[${ genre.emoji} ${genre.name}] カテゴリでRSS取得中...`);
  const entries = await rssManager.fetchAllFeeds(hoursBack, 10, genre.categories);
  console.log(`[${genre.emoji} ${genre.name}] ${entries.length}件取得`);
  return entries;
}

async function generateNewsletterForGenre(genre, entries, config, useAI = true) {
  console.log(`\n[${genre.emoji} ${genre.name}] ニュースレター生成中...`);

  if (entries.length === 0) {
    console.log(`[${genre.emoji} ${genre.name}] 記事がないためスキップ`);
    return null;
  }

  let dailySummary = null;
  let aiErrors = 0;

  // AI分析（ANTHROPIC_API_KEYがある場合）
  if (useAI && process.env.ANTHROPIC_API_KEY) {
    console.log(`[${genre.emoji} ${genre.name}] AI分析中...`);
    const analyzer = new ArticleAnalyzer(process.env.ANTHROPIC_API_KEY);

    // 記事を分析
    entries = await analyzer.analyzeArticles(entries, config);

    // 重要記事のデイリーサマリー生成
    dailySummary = await analyzer.generateDailySummary(entries, config);
    aiErrors = analyzer.errorCount;

    console.log(`[${genre.emoji} ${genre.name}] AI分析完了`);
  } else {
    // AI分析なしの場合、デフォルトの重要度を設定
    entries = entries.map(e => ({ ...e, importance: 3 }));
  }

  // ニュースレター生成
  const generator = new NewsletterGenerator(config);
  const newsletter = generator.generate(entries, new Date(), dailySummary);

  // ファイルに保存
  await saveNewsletterToFile(newsletter, new Date(), genre.id);

  console.log(`[${genre.emoji} ${genre.name}] ニュースレター生成完了`);

  return {
    genre,
    newsletter,
    entryCount: entries.length,
    aiErrors
  };
}

async function sendNewsletter(genre, newsletter) {
  const resendApiKey = process.env.RESEND_API_KEY;
  const hasGmail = process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD;
  if (!resendApiKey && !hasGmail) {
    console.log(`[${genre.emoji} ${genre.name}] メール送信設定(RESEND_API_KEY / Gmail)が未設定のため送信スキップ`);
    return false;
  }

  const mailer = new Mailer({
    resendApiKey,
    from: resendApiKey
      ? (process.env.RESEND_FROM || 'Newsletter <onboarding@resend.dev>')
      : process.env.GMAIL_USER,
    user: process.env.GMAIL_USER,
    appPassword: process.env.GMAIL_APP_PASSWORD,
    to: process.env.NEWSLETTER_TO || process.env.GMAIL_USER
  });

  const date = new Date();
  const dateStr = date.toLocaleDateString('ja-JP', {
    month: 'long',
    day: 'numeric'
  });

  const subject = `${genre.emoji} ${genre.name}ニュースレター - ${dateStr}`;

  await mailer.sendNewsletter(subject, newsletter.html, newsletter.text);
  console.log(`[${genre.emoji} ${genre.name}] 送信完了`);
  return true;
}

async function batchGenerateAndSend(options = {}) {
  const {
    hoursBack = 24,
    useAI = true,
    sendEmail = true,
    genreIds = null // 指定がなければ全ジャンル
  } = options;

  console.log('='.repeat(60));
  console.log('📧 ジャンル別ニュースレター一括配信');
  console.log('='.repeat(60));

  const config = await loadConfig();

  // RSS Manager初期化
  const rssManager = new RSSManager('./config/feeds.json');
  await rssManager.loadFeeds();

  // 対象ジャンルをフィルタ
  const targetGenres = genreIds
    ? NEWSLETTER_GENRES.filter(g => genreIds.includes(g.id))
    : NEWSLETTER_GENRES;

  console.log(`\n対象ジャンル: ${targetGenres.map(g => g.name).join(', ')}\n`);

  const results = [];
  const failures = [];

  // 各ジャンルごとに処理
  for (const genre of targetGenres) {
    try {
      // RSS取得
      const entries = await fetchEntriesForGenre(rssManager, genre, hoursBack);

      if (entries.length === 0) {
        console.log(`[${genre.emoji} ${genre.name}] 新着記事なし - スキップ`);
        continue;
      }

      // ニュースレター生成
      const result = await generateNewsletterForGenre(genre, entries, config, useAI);

      if (!result) {
        continue;
      }

      results.push(result);
      if (result.aiErrors > 0) {
        failures.push(`${genre.name}: AI分析エラー ${result.aiErrors}件`);
      }

      // メール送信
      if (sendEmail) {
        if (!await sendNewsletter(genre, result.newsletter)) {
          failures.push(`${genre.name}: 送信設定なし`);
        }
        // レート制限回避のため少し待機
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

    } catch (error) {
      console.error(`[${genre.emoji} ${genre.name}] エラー:`, error.message);
      failures.push(`${genre.name}: ${error.message.split('\n')[0]}`);
      if (process.env.DEBUG) {
        console.error(error.stack);
      }
    }
  }

  // サマリー表示
  console.log('\n' + '='.repeat(60));
  console.log('📊 実行結果サマリー');
  console.log('='.repeat(60));
  console.log(`処理ジャンル数: ${results.length}/${targetGenres.length}`);
  for (const result of results) {
    console.log(`  ${result.genre.emoji} ${result.genre.name}: ${result.entryCount}記事`);
  }
  if (failures.length > 0) {
    console.error(`失敗 ${failures.length}件:`);
    for (const failure of failures) {
      console.error(`  ✗ ${failure}`);
    }
  }
  console.log('='.repeat(60));

  return { results, failures };
}

// CLI実行
const isMainModule = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMainModule) {
  const args = process.argv.slice(2);

  const options = {
    hoursBack: 24,
    useAI: !args.includes('--no-ai'),
    sendEmail: !args.includes('--no-send'),
    genreIds: null
  };

  // ジャンル指定
  const genreIndex = args.indexOf('--genres');
  if (genreIndex !== -1 && args[genreIndex + 1]) {
    options.genreIds = args[genreIndex + 1].split(',');
  }

  // 期間指定
  const hoursIndex = args.indexOf('--hours');
  if (hoursIndex !== -1 && args[hoursIndex + 1]) {
    options.hoursBack = parseInt(args[hoursIndex + 1], 10);
  }

  if (args.includes('--help')) {
    console.log(`
ジャンル別ニュースレター一括配信

使い方:
  node src/batch-newsletter.js [オプション]

オプション:
  --genres <ids>    配信するジャンルをカンマ区切りで指定
                    指定なし: 全ジャンル配信
  --hours <num>     記事取得期間（デフォルト: 24時間）
  --no-ai           AI分析をスキップ
  --no-send         メール送信せず、ファイル保存のみ
  --help            このヘルプを表示

利用可能なジャンル:
${NEWSLETTER_GENRES.map(g => `  ${g.id.padEnd(15)} ${g.emoji} ${g.name} (${g.description})`).join('\n')}

例:
  # 全ジャンル配信
  node src/batch-newsletter.js

  # 個人投資家とマクロ経済のみ配信
  node src/batch-newsletter.js --genres investors,macro

  # 48時間分の記事を取得して配信
  node src/batch-newsletter.js --hours 48

  # メール送信せず、ファイル保存のみ
  node src/batch-newsletter.js --no-send
    `);
    process.exit(0);
  }

  batchGenerateAndSend(options).then(({ failures }) => {
    // 失敗があればタスクスケジューラ/バッチ側で検知できるよう非0で終了
    if (failures.length > 0) {
      process.exitCode = 1;
    }
  }).catch(error => {
    console.error('Fatal error:', error.message);
    if (process.env.DEBUG) {
      console.error(error.stack);
    }
    process.exit(1);
  });
}

export { batchGenerateAndSend, NEWSLETTER_GENRES };
