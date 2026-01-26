import axios from 'axios';

const FEEDLY_API_BASE = 'https://cloud.feedly.com/v3';

export class FeedlyClient {
  constructor(token) {
    this.token = token;
    this.client = axios.create({
      baseURL: FEEDLY_API_BASE,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
  }

  async getSubscriptions() {
    const response = await this.client.get('/subscriptions');
    return response.data;
  }

  async getCategories() {
    const response = await this.client.get('/categories');
    return response.data;
  }

  async getStreamContents(streamId, options = {}) {
    const params = {
      count: options.count || 20,
      ranked: options.ranked || 'newest',
      unreadOnly: options.unreadOnly !== false,
      newerThan: options.newerThan || Date.now() - 24 * 60 * 60 * 1000 // 過去24時間
    };

    const response = await this.client.get('/streams/contents', {
      params: {
        streamId,
        ...params
      }
    });
    return response.data;
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async getAllUnreadEntries(subscriptions, hoursBack = 24) {
    const newerThan = Date.now() - hoursBack * 60 * 60 * 1000;
    const allEntries = [];

    // サブスクリプションをフィードIDでマップ化
    const subMap = new Map();
    for (const sub of subscriptions) {
      subMap.set(sub.id, sub);
    }

    // まずユーザーの全記事ストリームを一括取得
    try {
      const profileResponse = await this.client.get('/profile');
      const userId = profileResponse.data.id;
      const allStreamId = `user/${userId}/category/global.all`;

      console.log('Fetching all entries from global stream...');
      const stream = await this.getStreamContents(allStreamId, {
        count: 500,
        newerThan,
        unreadOnly: false
      });

      if (stream.items && stream.items.length > 0) {
        for (const item of stream.items) {
          const feedId = item.origin?.streamId;
          const sub = subMap.get(feedId);

          allEntries.push({
            id: item.id,
            title: item.title,
            url: item.alternate?.[0]?.href || item.canonicalUrl,
            summary: item.summary?.content || item.content?.content || '',
            published: item.published,
            feedTitle: item.origin?.title || sub?.title || 'Unknown',
            feedId: feedId,
            categories: sub?.categories?.map(c => c.label) || [],
            topics: sub?.topics || [],
            engagement: item.engagement || 0,
            engagementRate: item.engagementRate || 0
          });
        }
        console.log(`Got ${allEntries.length} entries from global stream`);
      }
    } catch (error) {
      console.error('Error fetching global stream:', error.message);
      console.log('Falling back to per-feed fetching...');

      // フォールバック: 個別フィード取得（レート制限対策でディレイ付き）
      for (let i = 0; i < subscriptions.length; i++) {
        const sub = subscriptions[i];
        try {
          if (i > 0 && i % 10 === 0) {
            console.log(`Progress: ${i}/${subscriptions.length} feeds...`);
            await this.sleep(1000); // 10フィードごとに1秒待機
          }

          const stream = await this.getStreamContents(sub.id, {
            count: 50,
            newerThan,
            unreadOnly: false
          });

          if (stream.items && stream.items.length > 0) {
            const entries = stream.items.map(item => ({
              id: item.id,
              title: item.title,
              url: item.alternate?.[0]?.href || item.canonicalUrl,
              summary: item.summary?.content || item.content?.content || '',
              published: item.published,
              feedTitle: sub.title,
              feedId: sub.id,
              categories: sub.categories?.map(c => c.label) || [],
              topics: sub.topics || [],
              engagement: item.engagement || 0,
              engagementRate: item.engagementRate || 0
            }));
            allEntries.push(...entries);
          }
        } catch (error) {
          if (error.response?.status === 429) {
            console.log('Rate limited, waiting 5 seconds...');
            await this.sleep(5000);
          }
          console.error(`Error fetching ${sub.title}:`, error.message);
        }
      }
    }

    return allEntries.sort((a, b) => b.published - a.published);
  }

  categorizeSubscriptions(subscriptions, categoryConfig) {
    const categorized = {};

    for (const cat of categoryConfig.categories) {
      categorized[cat.id] = {
        ...cat,
        feeds: []
      };
    }

    for (const sub of subscriptions) {
      const subCategories = sub.categories?.map(c => c.label) || [];
      let assigned = false;

      for (const cat of categoryConfig.categories) {
        const matchesLabel = cat.feedlyLabels.some(label =>
          subCategories.includes(label)
        );

        if (matchesLabel && cat.id !== 'general') {
          categorized[cat.id].feeds.push(sub);
          assigned = true;
          break;
        }
      }

      if (!assigned) {
        categorized['general'].feeds.push(sub);
      }
    }

    return categorized;
  }
}

export default FeedlyClient;
