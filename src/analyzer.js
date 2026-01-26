import Anthropic from '@anthropic-ai/sdk';

export class ArticleAnalyzer {
  constructor(apiKey) {
    this.client = new Anthropic({ apiKey });
    this.model = 'claude-sonnet-4-20250514';
  }

  async analyzeArticles(entries, categoryConfig) {
    console.log(`\nAnalyzing ${entries.length} articles with Claude...`);

    // 記事をバッチ処理（APIコスト削減）
    const batchSize = 20;
    const analyzedEntries = [];

    for (let i = 0; i < entries.length; i += batchSize) {
      const batch = entries.slice(i, i + batchSize);
      const batchNum = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(entries.length / batchSize);

      console.log(`Processing batch ${batchNum}/${totalBatches}...`);

      try {
        const analyzed = await this.analyzeBatch(batch, categoryConfig);
        analyzedEntries.push(...analyzed);
      } catch (error) {
        console.error(`Error analyzing batch ${batchNum}:`, error.message);
        // エラー時は元の記事をそのまま追加（分析なし）
        analyzedEntries.push(...batch.map(e => ({
          ...e,
          aiSummary: null,
          importance: 3,
          investmentRelevance: 'unknown'
        })));
      }
    }

    // 重要度でソート（高い順）
    analyzedEntries.sort((a, b) => {
      if (a.importance !== b.importance) {
        return a.importance - b.importance;
      }
      return b.published - a.published;
    });

    return analyzedEntries;
  }

  async analyzeBatch(entries, categoryConfig) {
    const articlesText = entries.map((entry, idx) => {
      const content = this.stripHtml(entry.summary || entry.content || '');
      const truncatedContent = content.substring(0, 2000);
      return `
【記事${idx + 1}】
タイトル: ${entry.title}
ソース: ${entry.feedTitle}
内容: ${truncatedContent}
`;
    }).join('\n---\n');

    const prompt = `あなたは投資アナリストです。以下の記事を分析し、バリュー株投資家にとっての重要度を評価してください。

## 評価基準
- 重要度1（最重要）: 個別銘柄の具体的な分析、決算情報、バリュエーション分析、成長株・割安株の発掘情報
- 重要度2（重要）: マクロ経済動向、金利・為替の重要な変化、セクター分析、市場全体の見通し
- 重要度3（参考）: 一般的な投資ニュース、不動産情報、仮想通貨
- 重要度4（低）: 投資と直接関係ない記事、エンタメ、雑記
- 重要度5（無関係）: 投資に全く関係ない記事

## 記事一覧
${articlesText}

## 出力形式
以下のJSON形式で出力してください。必ず有効なJSONのみを出力し、他の説明は不要です。

[
  {
    "index": 1,
    "importance": 1,
    "category": "value_stock|macro|think_tank|real_estate|crypto|general",
    "summary": "50文字以内の日本語要約。投資家視点で重要なポイントを簡潔に。",
    "keyPoints": ["重要ポイント1", "重要ポイント2"],
    "tickers": ["関連銘柄コードがあれば"]
  }
]`;

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }]
    });

    const responseText = response.content[0].text;

    // JSONを抽出
    let analysisResults;
    try {
      // JSON部分を抽出
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        analysisResults = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError.message);
      return entries.map(e => ({
        ...e,
        aiSummary: null,
        importance: 3,
        investmentRelevance: 'unknown'
      }));
    }

    // 分析結果を記事にマージ
    return entries.map((entry, idx) => {
      const analysis = analysisResults.find(a => a.index === idx + 1) || {};
      return {
        ...entry,
        aiSummary: analysis.summary || null,
        importance: analysis.importance || 3,
        aiCategory: analysis.category || null,
        keyPoints: analysis.keyPoints || [],
        tickers: analysis.tickers || []
      };
    });
  }

  stripHtml(html) {
    if (!html) return '';
    return html
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#\d+;/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  async generateDailySummary(analyzedEntries, categoryConfig) {
    // 重要度1-2の記事を抽出
    const importantArticles = analyzedEntries.filter(e => e.importance <= 2);

    if (importantArticles.length === 0) {
      return null;
    }

    const articlesText = importantArticles.slice(0, 15).map((entry, idx) => {
      return `${idx + 1}. 【${entry.feedTitle}】${entry.title}
   要約: ${entry.aiSummary || 'なし'}
   キーポイント: ${entry.keyPoints?.join(', ') || 'なし'}`;
    }).join('\n\n');

    const prompt = `以下は本日の重要な投資関連記事です。バリュー株投資家向けに、今日のマーケットで注目すべきポイントを3-5個の箇条書きでまとめてください。

## 重要記事一覧
${articlesText}

## 出力形式
- 具体的な銘柄名や数字があれば含める
- 投資判断に役立つ視点で
- 200文字以内で簡潔に`;

    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }]
      });

      return response.content[0].text;
    } catch (error) {
      console.error('Failed to generate daily summary:', error.message);
      return null;
    }
  }
}

export default ArticleAnalyzer;
