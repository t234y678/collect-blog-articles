import 'dotenv/config';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import FeedlyClient from './feedly.js';
import RSSManager from './rss-manager.js';
import NewsletterGenerator from './newsletter.js';
import ArticleAnalyzer from './analyzer.js';
import Mailer from './mailer.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// カテゴリプリセット
const CATEGORY_PRESETS = {
  'investors': {
    name: '個人投資家',
    categories: ['上手い人'],
    description: '実績のある個人投資家ブログ'
  },
  'macro': {
    name: 'マクロ経済',
    categories: ['真面目なレポート', '日経'],
    description: 'シンクタンクレポート、日経ニュース'
  },
  'stocks': {
    name: '株式投資全般',
    categories: ['投資', '上手い人', '決算サマリー'],
    description: '株式投資関連全般'
  },
  'all-invest': {
    name: '投資全般',
    categories: ['投資', '上手い人', '真面目なレポート', '日経', '決算サマリー', '仮想通貨'],
    description: '投資関連すべて（雑記除く）'
  }
};

async function loadConfig() {
  const configPath = path.join(__dirname, '../config/categories.json');
  const data = await fs.readFile(configPath, 'utf-8');
  return JSON.parse(data);
}

async function saveNewsletterToFile(newsletter, date, suffix = '') {
  const outputDir = path.join(__dirname, '../output');
  await fs.mkdir(outputDir, { recursive: true });

  const dateStr = date.toISOString().split('T')[0];
  const filenameSuffix = suffix ? `-${suffix}` : '';
  const htmlPath = path.join(outputDir, `newsletter-${dateStr}${filenameSuffix}.html`);
  const textPath = path.join(outputDir, `newsletter-${dateStr}${filenameSuffix}.txt`);

  await fs.writeFile(htmlPath, newsletter.html, 'utf-8');
  await fs.writeFile(textPath, newsletter.text, 'utf-8');

  console.log(`Newsletter saved to:`);
  console.log(`  HTML: ${htmlPath}`);
  console.log(`  Text: ${textPath}`);

  return { htmlPath, textPath };
}

async function fetchEntries(options = {}) {
  const hoursBack = options.hoursBack || 24;
  const categories = options.categories || null;
  let entries = [];

  // feeds.json が存在するか確認
  const feedsJsonPath = path.join(__dirname, '../config/feeds.json');
  let feedsJsonExists = false;
  try {
    await fs.access(feedsJsonPath);
    feedsJsonExists = true;
  } catch {}

  // スタンドアローンモードを優先（feeds.jsonが存在する場合）
  if (options.useRss || feedsJsonExists) {
    console.log('Using standalone RSS manager (direct RSS fetch)...');
    const rssManager = new RSSManager('./config/feeds.json');
    await rssManager.loadFeeds();
    console.log(`Found ${rssManager.feeds.length} total feeds`);
    entries = await rssManager.fetchAllFeeds(hoursBack, 10, categories);
  } else if (process.env.FEEDLY_TOKEN) {
    console.log('Using Feedly API...');
    const feedly = new FeedlyClient(process.env.FEEDLY_TOKEN);

    const subscriptions = await feedly.getSubscriptions();
    console.log(`Found ${subscriptions.length} subscriptions`);

    entries = await feedly.getAllUnreadEntries(subscriptions, hoursBack);

    if (options.exportFeeds) {
      const rssManager = new RSSManager('./config/feeds.json');
      await rssManager.loadFeeds();
      await rssManager.importFromFeedly(subscriptions);
      console.log('Feeds exported for standalone use');
    }
  } else {
    console.error('No feeds.json or FEEDLY_TOKEN found');
    return [];
  }

  return entries;
}

async function fetchAndGenerateNewsletter(options = {}) {
  const config = await loadConfig();
  const hoursBack = options.hoursBack || 24;
  const useAI = options.useAI !== false && process.env.ANTHROPIC_API_KEY;
  const categories = options.categories || null;

  console.log('Starting newsletter generation...');
  console.log(`Fetching articles from the last ${hoursBack} hours`);

  if (categories) {
    console.log(`Category filter: ${categories.join(', ')}`);
  }

  let entries = await fetchEntries({ ...options, hoursBack, categories });
  console.log(`Fetched ${entries.length} entries`);

  if (entries.length === 0) {
    console.log('No new entries found');
    return null;
  }

  let dailySummary = null;

  // AI分析（ANTHROPIC_API_KEYがある場合）
  if (useAI) {
    console.log('\nStarting AI analysis...');
    const analyzer = new ArticleAnalyzer(process.env.ANTHROPIC_API_KEY);

    // 記事を分析
    entries = await analyzer.analyzeArticles(entries, config);

    // 重要記事のデイリーサマリー生成
    dailySummary = await analyzer.generateDailySummary(entries, config);

    console.log('AI analysis complete');
  } else {
    console.log('\nSkipping AI analysis (ANTHROPIC_API_KEY not set)');
    // AI分析なしの場合、デフォルトの重要度を設定
    entries = entries.map(e => ({ ...e, importance: 3 }));
  }

  // ニュースレター生成
  const generator = new NewsletterGenerator(config);
  const newsletter = generator.generate(entries, new Date(), dailySummary);

  // ファイルに保存（カテゴリ指定時はサフィックス付き）
  const suffix = options.presetName || (categories ? categories.join('-') : '');
  await saveNewsletterToFile(newsletter, new Date(), suffix);

  return newsletter;
}

async function sendNewsletter(newsletter, subjectSuffix = '') {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    console.log('Gmail credentials not configured. Skipping email send.');
    console.log('Please set GMAIL_USER and GMAIL_APP_PASSWORD in .env');
    return false;
  }

  const mailer = new Mailer({
    user: process.env.GMAIL_USER,
    appPassword: process.env.GMAIL_APP_PASSWORD,
    to: process.env.NEWSLETTER_TO || process.env.GMAIL_USER
  });

  const verified = await mailer.verify();
  if (!verified) {
    console.error('Could not verify mail server connection');
    return false;
  }

  const date = new Date();
  const dateStr = date.toLocaleDateString('ja-JP', {
    month: 'long',
    day: 'numeric'
  });

  const suffix = subjectSuffix ? ` [${subjectSuffix}]` : '';
  const subject = `📈 投資ニュースレター${suffix} - ${dateStr}`;

  await mailer.sendNewsletter(subject, newsletter.html, newsletter.text);
  console.log('Newsletter sent successfully!');
  return true;
}

async function showSubscriptions() {
  const rssManager = new RSSManager('./config/feeds.json');
  await rssManager.loadFeeds();

  const categories = rssManager.getCategories();

  console.log('\n=== カテゴリ一覧 ===\n');

  for (const [category, info] of Object.entries(categories)) {
    console.log(`【${category}】${info.count}件`);
  }

  console.log(`\n合計: ${rssManager.feeds.length} フィード`);

  console.log('\n=== プリセット一覧 ===\n');
  for (const [key, preset] of Object.entries(CATEGORY_PRESETS)) {
    console.log(`  --${key.padEnd(15)} ${preset.name} (${preset.description})`);
  }
}

async function showCategoryFeeds(categoryName) {
  const rssManager = new RSSManager('./config/feeds.json');
  await rssManager.loadFeeds();

  const byCategory = rssManager.listFeedsByCategory();

  if (byCategory[categoryName]) {
    console.log(`\n【${categoryName}】(${byCategory[categoryName].length}件)`);
    console.log('-'.repeat(40));
    for (const feed of byCategory[categoryName]) {
      console.log(`  - ${feed.title}`);
    }
  } else {
    console.log(`Category not found: ${categoryName}`);
    console.log('Available categories:');
    for (const cat of Object.keys(byCategory)) {
      console.log(`  - ${cat}`);
    }
  }
}

function parseArgs(args) {
  const options = {
    useAI: true,
    categories: null,
    presetName: null,
    subjectSuffix: ''
  };

  // プリセットチェック
  for (const [key, preset] of Object.entries(CATEGORY_PRESETS)) {
    if (args.includes(`--${key}`)) {
      options.categories = preset.categories;
      options.presetName = key;
      options.subjectSuffix = preset.name;
      break;
    }
  }

  // 個別カテゴリ指定
  const catIndex = args.indexOf('--category');
  if (catIndex !== -1 && args[catIndex + 1]) {
    options.categories = args[catIndex + 1].split(',');
    options.subjectSuffix = options.categories.join(', ');
  }

  // AI無効化
  if (args.includes('--no-ai')) {
    options.useAI = false;
  }

  return options;
}

async function main() {
  const args = process.argv.slice(2);

  try {
    if (args.includes('--list')) {
      await showSubscriptions();
    } else if (args.includes('--show')) {
      const catIndex = args.indexOf('--show');
      const categoryName = args[catIndex + 1];
      if (categoryName) {
        await showCategoryFeeds(categoryName);
      } else {
        console.log('Usage: --show <category_name>');
      }
    } else if (args.includes('--fetch')) {
      const options = parseArgs(args);
      const newsletter = await fetchAndGenerateNewsletter(options);
      if (newsletter) {
        console.log('\nNewsletter generated (not sent)');
      }
    } else if (args.includes('--daily') || args.includes('--newsletter')) {
      const options = parseArgs(args);
      const newsletter = await fetchAndGenerateNewsletter(options);
      if (newsletter) {
        await sendNewsletter(newsletter, options.subjectSuffix);
      }
    } else {
      console.log(`
投資ニュースレター生成システム（AI分析対応）

使い方:
  npm run start -- --list                    カテゴリ・プリセット一覧を表示
  npm run start -- --show <カテゴリ名>        カテゴリ内のフィード一覧を表示
  npm run start -- --fetch                   全記事を取得してニュースレター生成
  npm run start -- --daily                   全記事を取得してメール送信

カテゴリ指定:
  --investors       個人投資家ブログのみ（上手い人カテゴリ）
  --macro           マクロ経済のみ（シンクタンク、日経）
  --stocks          株式投資全般
  --all-invest      投資関連すべて（雑記除く）
  --category <名前>  カテゴリ名を直接指定（カンマ区切りで複数可）

例:
  npm run start -- --fetch --investors       個人投資家ブログのニュースレター
  npm run start -- --daily --macro           マクロ経済ニュースレターを送信
  npm run start -- --fetch --category 上手い人,投資

オプション:
  --no-ai           AI分析をスキップ（高速）

環境変数:
  ANTHROPIC_API_KEY     Claude API キー（AI分析用）
  GMAIL_USER            Gmail アドレス
  GMAIL_APP_PASSWORD    Gmail アプリパスワード
  NEWSLETTER_TO         送信先メールアドレス
      `);
    }
  } catch (error) {
    console.error('Error:', error.message);
    if (process.env.DEBUG) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

main();
