import 'dotenv/config';
import RSSManager from './rss-manager.js';

async function analyzeBlogArticles() {
  const rssManager = new RSSManager('./config/feeds.json');
  await rssManager.loadFeeds();

  // 全フィードの一覧を出力
  console.log('=== 全フィードのカテゴリ分布 ===');
  const categories = {};
  rssManager.feeds.forEach(f => {
    if (!categories[f.category]) categories[f.category] = [];
    categories[f.category].push(f.title);
  });

  for (const [cat, feeds] of Object.entries(categories)) {
    console.log(`\n【${cat}】(${feeds.length}件)`);
    feeds.forEach(f => console.log(`  - ${f}`));
  }

  // 直近48時間の記事を取得
  console.log('\n\n=== 直近48時間の記事取得中... ===');
  const entries = await rssManager.fetchAllFeeds(48);

  // 全エントリのカテゴリとソースを表示
  console.log('\n=== 取得エントリのカテゴリ分布 ===');
  const entryCats = {};
  entries.forEach(e => {
    const key = e.category || 'unknown';
    if (!entryCats[key]) entryCats[key] = [];
    entryCats[key].push(e);
  });

  for (const [cat, ents] of Object.entries(entryCats)) {
    console.log(`${cat}: ${ents.length}件`);
  }

  // 投資系個人ブログ（日経等を除く）をフィルタリング
  const personalBlogs = [
    '株主優待と高配当株を買い続ける株式投資ブログ',
    'みきまるの優待バリュー株日誌',
    '炭鉱のカナリア、炭鉱の龍',
    'Value Investment since 2004',
    '駄犬の株ログ',
    '塩漬けマンの株奮闘記',
    'かぶ１０００投資日記',
    'FIRE: 投資でセミリタイアする九条日記',
    '村越誠の投資資本主義',
    'グローバルマクロ・リサーチ・インスティテュート',
    '市況かぶ全力２階建',
    '豊健活人生：春山昇華',
    '浜町SCIインサイト',
    'サラリーマンが株式投資でセミリタイアを目指してみました。',
    '小型株投資の日記',
    'AIを使った株取引',
    '犬次郎株日誌',
    '成長株投資とロシア妻との日々',
    'マンションの間取りや価格を言いたい放題!',
    'マンションマニアの住まいカウンター'
  ];

  const blogEntries = entries.filter(e =>
    personalBlogs.some(b => e.feedTitle && e.feedTitle.includes(b.substring(0, 10)))
  );

  console.log(`\n\n=== 個人ブログ記事 (${blogEntries.length}件) ===`);

  blogEntries.forEach(e => {
    console.log('\n' + '='.repeat(60));
    console.log(`【${e.feedTitle}】`);
    console.log(`タイトル: ${e.title}`);
    console.log(`日時: ${new Date(e.published).toLocaleString('ja-JP')}`);
    console.log(`URL: ${e.url}`);
    const content = (e.summary || e.content || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').substring(0, 800);
    console.log(`内容: ${content}`);
  });
}

analyzeBlogArticles().catch(console.error);
