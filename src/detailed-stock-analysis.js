import 'dotenv/config';
import RSSManager from './rss-manager.js';

async function detailedStockAnalysis() {
  const rssManager = new RSSManager('./config/feeds.json');
  await rssManager.loadFeeds();

  // 直近48時間の記事を取得
  console.log('=== 記事取得中... ===');
  const entries = await rssManager.fetchAllFeeds(72); // 72時間に拡大

  // 投資系個人ブログのみフィルタ
  const personalBlogKeywords = [
    'サラリーマンが株式投資',
    '塩漬けマン',
    '村越誠',
    '市況かぶ全力',
    'グローバルマクロ',
    'FIRE',
    '九条',
    'みきまる',
    '優待バリュー',
    '株主優待と高配当',
    'きびなご',
    '炭鉱のカナリア',
    'Value Investment',
    '駄犬',
    'かぶ１０００',
    '小型株投資',
    'AIを使った株取引',
    '犬次郎',
    '成長株投資とロシア妻',
    '豊健活人生',
    '春山昇華',
    '浜町SCI'
  ];

  const blogEntries = entries.filter(e =>
    personalBlogKeywords.some(k => e.feedTitle && e.feedTitle.includes(k))
  );

  console.log(`\n取得した個人ブログ記事: ${blogEntries.length}件\n`);

  // 各記事の全文を出力
  blogEntries.forEach(e => {
    console.log('\n' + '='.repeat(80));
    console.log(`【${e.feedTitle}】`);
    console.log(`タイトル: ${e.title}`);
    console.log(`日時: ${new Date(e.published).toLocaleString('ja-JP')}`);
    console.log(`URL: ${e.url}`);
    console.log('-'.repeat(80));
    // 全文を取得（HTMLタグ除去、改行保持）
    const content = (e.summary || e.content || '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#\d+;/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    console.log(content);
  });
}

detailedStockAnalysis().catch(console.error);
