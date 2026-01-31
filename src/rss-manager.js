import Parser from 'rss-parser';
import fs from 'fs/promises';
import path from 'path';

/**
 * スタンドアローンRSSマネージャー
 * Feedly契約終了後も独立してRSS巡回が可能
 */
export class RSSManager {
  constructor(configPath = './config/feeds.json') {
    this.parser = new Parser({
      timeout: 10000, // 10秒タイムアウト
      customFields: {
        item: ['media:content', 'content:encoded']
      }
    });
    this.configPath = configPath;
    this.feeds = [];
  }

  async loadFeeds() {
    try {
      const data = await fs.readFile(this.configPath, 'utf-8');
      this.feeds = JSON.parse(data).feeds || [];
      const disabledCount = this.feeds.filter(f => f.disabled).length;
      if (disabledCount > 0) {
        console.log(`Loaded ${this.feeds.length} feeds (${disabledCount} disabled, ${this.feeds.length - disabledCount} active)`);
      }
      return this.feeds;
    } catch (error) {
      if (error.code === 'ENOENT') {
        this.feeds = [];
        return [];
      }
      throw error;
    }
  }

  async saveFeeds() {
    const dir = path.dirname(this.configPath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(
      this.configPath,
      JSON.stringify({ feeds: this.feeds }, null, 2),
      'utf-8'
    );
  }

  async addFeed(url, title, category = 'general') {
    const feed = {
      id: `feed/${url}`,
      url,
      title,
      category,
      addedAt: new Date().toISOString()
    };

    // 重複チェック
    if (this.feeds.some(f => f.url === url)) {
      throw new Error(`Feed already exists: ${url}`);
    }

    this.feeds.push(feed);
    await this.saveFeeds();
    return feed;
  }

  async removeFeed(url) {
    const index = this.feeds.findIndex(f => f.url === url);
    if (index === -1) {
      throw new Error(`Feed not found: ${url}`);
    }
    this.feeds.splice(index, 1);
    await this.saveFeeds();
  }

  async importFromFeedly(feedlySubscriptions) {
    for (const sub of feedlySubscriptions) {
      const url = sub.id.replace('feed/', '');
      const category = sub.categories?.[0]?.label || 'general';

      if (!this.feeds.some(f => f.url === url)) {
        this.feeds.push({
          id: sub.id,
          url,
          title: sub.title,
          category,
          topics: sub.topics || [],
          importedAt: new Date().toISOString()
        });
      }
    }
    await this.saveFeeds();
    console.log(`Imported ${feedlySubscriptions.length} feeds from Feedly`);
  }

  async fetchFeed(feedConfig) {
    try {
      const feed = await this.parser.parseURL(feedConfig.url);
      return {
        ...feedConfig,
        items: feed.items.map(item => ({
          id: item.guid || item.link,
          title: item.title,
          url: item.link,
          summary: item.contentSnippet || item.content || '',
          content: item['content:encoded'] || item.content || '',
          published: new Date(item.pubDate || item.isoDate).getTime(),
          feedTitle: feedConfig.title,
          feedId: feedConfig.id,
          categories: [feedConfig.category]
        }))
      };
    } catch (error) {
      console.error(`Error fetching ${feedConfig.title}:`, error.message);
      return { ...feedConfig, items: [], error: error.message };
    }
  }

  filterByCategories(categories) {
    if (!categories || categories.length === 0) {
      return this.feeds;
    }
    return this.feeds.filter(f => categories.includes(f.category));
  }

  getCategories() {
    const cats = {};
    for (const feed of this.feeds) {
      if (feed.disabled) continue;
      const cat = feed.category || 'unknown';
      if (!cats[cat]) {
        cats[cat] = { count: 0, feeds: [] };
      }
      cats[cat].count++;
      cats[cat].feeds.push(feed.title);
    }
    return cats;
  }

  async fetchAllFeeds(hoursBack = 24, concurrency = 10, categories = null) {
    const newerThan = Date.now() - hoursBack * 60 * 60 * 1000;
    const allEntries = [];
    let completed = 0;
    let errors = 0;

    // カテゴリフィルタリング
    let targetFeeds = categories ? this.filterByCategories(categories) : this.feeds;

    // 無効化されたフィードを除外
    targetFeeds = targetFeeds.filter(f => !f.disabled);

    if (categories && categories.length > 0) {
      console.log(`Filtering by categories: ${categories.join(', ')}`);
    }
    console.log(`Fetching ${targetFeeds.length} feeds (concurrency: ${concurrency})...`);

    // 並列処理（同時接続数制限付き）
    const chunks = [];
    for (let i = 0; i < targetFeeds.length; i += concurrency) {
      chunks.push(targetFeeds.slice(i, i + concurrency));
    }

    for (const chunk of chunks) {
      const results = await Promise.all(
        chunk.map(feedConfig => this.fetchFeed(feedConfig))
      );

      for (const result of results) {
        completed++;
        if (result.error) {
          errors++;
        } else if (result.items) {
          const recentItems = result.items.filter(
            item => item.published > newerThan
          );
          allEntries.push(...recentItems);
        }
      }

      // 進捗表示
      process.stdout.write(`\rProgress: ${completed}/${targetFeeds.length} feeds (${errors} errors)`);
    }

    // URLベースで重複排除（同じ記事が複数のフィードに含まれる場合）
    const seenUrls = new Set();
    const uniqueEntries = [];
    for (const entry of allEntries) {
      if (!seenUrls.has(entry.url)) {
        seenUrls.add(entry.url);
        uniqueEntries.push(entry);
      }
    }

    const duplicateCount = allEntries.length - uniqueEntries.length;
    if (duplicateCount > 0) {
      console.log(`\nRemoved ${duplicateCount} duplicate entries`);
    }

    console.log(`\nFetch complete: ${uniqueEntries.length} entries from ${targetFeeds.length - errors} feeds`);

    return uniqueEntries.sort((a, b) => b.published - a.published);
  }

  listFeeds() {
    return this.feeds
      .filter(f => !f.disabled)
      .map(f => ({
        title: f.title,
        url: f.url,
        category: f.category
      }));
  }

  listFeedsByCategory() {
    const byCategory = {};
    for (const feed of this.feeds) {
      if (feed.disabled) continue;
      const cat = feed.category || 'general';
      if (!byCategory[cat]) {
        byCategory[cat] = [];
      }
      byCategory[cat].push(feed);
    }
    return byCategory;
  }
}

export default RSSManager;
