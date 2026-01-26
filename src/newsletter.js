export class NewsletterGenerator {
  constructor(categoryConfig) {
    this.categoryConfig = categoryConfig;
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
      .replace(/\s+/g, ' ')
      .trim();
  }

  truncate(text, maxLength = 200) {
    if (!text || text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  }

  getImportanceLabel(importance) {
    const labels = {
      1: { text: '最重要', color: '#c53030', bg: '#fed7d7' },
      2: { text: '重要', color: '#c05621', bg: '#feebc8' },
      3: { text: '参考', color: '#2b6cb0', bg: '#bee3f8' },
      4: { text: '低', color: '#718096', bg: '#e2e8f0' },
      5: { text: '対象外', color: '#a0aec0', bg: '#f7fafc' }
    };
    return labels[importance] || labels[3];
  }

  groupByImportance(entries) {
    const groups = {
      critical: { name: '最重要（個別銘柄・決算分析）', entries: [], icon: '🔴' },
      important: { name: '重要（マクロ・相場動向）', entries: [], icon: '🟠' },
      reference: { name: '参考情報', entries: [], icon: '🔵' },
      other: { name: 'その他', entries: [], icon: '⚪' }
    };

    for (const entry of entries) {
      const importance = entry.importance || 3;
      if (importance === 1) {
        groups.critical.entries.push(entry);
      } else if (importance === 2) {
        groups.important.entries.push(entry);
      } else if (importance === 3) {
        groups.reference.entries.push(entry);
      } else {
        groups.other.entries.push(entry);
      }
    }

    return groups;
  }

  generateHtml(entries, date, dailySummary = null) {
    const dateStr = date.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long'
    });

    const groups = this.groupByImportance(entries);
    const criticalCount = groups.critical.entries.length;
    const importantCount = groups.important.entries.length;

    let html = `
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>投資ニュースレター - ${dateStr}</title>
  <style>
    body {
      font-family: 'Helvetica Neue', Arial, 'Hiragino Kaku Gothic ProN', 'Hiragino Sans', Meiryo, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 900px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f5f5f5;
    }
    .container {
      background-color: #fff;
      padding: 30px;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    h1 {
      color: #1a365d;
      border-bottom: 3px solid #3182ce;
      padding-bottom: 10px;
      margin-bottom: 20px;
    }
    h2 {
      color: #2c5282;
      margin-top: 30px;
      padding: 12px 15px;
      background-color: #ebf8ff;
      border-left: 4px solid #3182ce;
      border-radius: 0 6px 6px 0;
    }
    h2.critical {
      background-color: #fed7d7;
      border-left-color: #c53030;
    }
    h2.important {
      background-color: #feebc8;
      border-left-color: #c05621;
    }
    .daily-summary {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 25px;
      border-radius: 12px;
      margin-bottom: 30px;
    }
    .daily-summary h3 {
      margin-top: 0;
      font-size: 1.3em;
    }
    .daily-summary ul {
      margin-bottom: 0;
      padding-left: 20px;
    }
    .daily-summary li {
      margin-bottom: 8px;
    }
    .stats-box {
      display: flex;
      gap: 15px;
      margin-bottom: 25px;
      flex-wrap: wrap;
    }
    .stat-card {
      background: #f7fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 15px 20px;
      text-align: center;
      min-width: 120px;
    }
    .stat-card.critical {
      background: #fed7d7;
      border-color: #fc8181;
    }
    .stat-card.important {
      background: #feebc8;
      border-color: #f6ad55;
    }
    .stat-number {
      font-size: 2em;
      font-weight: bold;
      color: #2d3748;
    }
    .stat-label {
      font-size: 0.85em;
      color: #718096;
    }
    .entry {
      margin: 15px 0;
      padding: 18px;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      background-color: #fff;
      transition: box-shadow 0.2s;
    }
    .entry:hover {
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
    }
    .entry.importance-1 {
      border-left: 5px solid #c53030;
      background-color: #fff5f5;
    }
    .entry.importance-2 {
      border-left: 5px solid #dd6b20;
      background-color: #fffaf0;
    }
    .entry-header {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      margin-bottom: 10px;
    }
    .importance-badge {
      padding: 3px 8px;
      border-radius: 4px;
      font-size: 0.75em;
      font-weight: bold;
      white-space: nowrap;
    }
    .entry-title {
      font-weight: bold;
      font-size: 1.1em;
      flex: 1;
    }
    .entry-title a {
      color: #2b6cb0;
      text-decoration: none;
    }
    .entry-title a:hover {
      text-decoration: underline;
    }
    .entry-meta {
      font-size: 0.85em;
      color: #718096;
      margin-bottom: 10px;
    }
    .feed-name {
      background-color: #edf2f7;
      padding: 2px 8px;
      border-radius: 4px;
    }
    .ai-summary {
      background-color: #f0fff4;
      border: 1px solid #9ae6b4;
      border-radius: 6px;
      padding: 12px;
      margin-top: 10px;
    }
    .ai-summary-label {
      font-size: 0.8em;
      color: #276749;
      font-weight: bold;
      margin-bottom: 5px;
    }
    .ai-summary-text {
      color: #22543d;
      font-size: 0.95em;
    }
    .key-points {
      margin-top: 8px;
      padding-left: 15px;
    }
    .key-points li {
      color: #2f855a;
      font-size: 0.9em;
      margin-bottom: 3px;
    }
    .tickers {
      margin-top: 8px;
    }
    .ticker {
      display: inline-block;
      background: #edf2f7;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 0.85em;
      margin-right: 5px;
      color: #4a5568;
    }
    .footer {
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid #e2e8f0;
      text-align: center;
      font-size: 0.85em;
      color: #718096;
    }
    .section-count {
      font-size: 0.85em;
      color: #718096;
      font-weight: normal;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>📈 投資ニュースレター</h1>
    <p style="color: #718096;">${dateStr}</p>

    <div class="stats-box">
      <div class="stat-card critical">
        <div class="stat-number">${criticalCount}</div>
        <div class="stat-label">最重要</div>
      </div>
      <div class="stat-card important">
        <div class="stat-number">${importantCount}</div>
        <div class="stat-label">重要</div>
      </div>
      <div class="stat-card">
        <div class="stat-number">${entries.length}</div>
        <div class="stat-label">総記事数</div>
      </div>
    </div>
`;

    // AI デイリーサマリー
    if (dailySummary) {
      html += `
    <div class="daily-summary">
      <h3>🤖 AI分析: 本日の注目ポイント</h3>
      <div>${dailySummary.replace(/\n/g, '<br>')}</div>
    </div>
`;
    }

    // 重要度別セクション
    for (const [groupId, group] of Object.entries(groups)) {
      if (group.entries.length === 0) continue;
      if (groupId === 'other' && groups.critical.entries.length + groups.important.entries.length > 0) {
        // 重要記事がある場合、その他は省略
        continue;
      }

      const sectionClass = groupId === 'critical' ? 'critical' : (groupId === 'important' ? 'important' : '');

      html += `
    <h2 class="${sectionClass}">${group.icon} ${group.name} <span class="section-count">(${group.entries.length}件)</span></h2>
`;

      const displayEntries = group.entries.slice(0, groupId === 'critical' ? 20 : 10);

      for (const entry of displayEntries) {
        const publishedDate = new Date(entry.published).toLocaleString('ja-JP');
        const importanceStyle = this.getImportanceLabel(entry.importance);

        html += `
    <div class="entry importance-${entry.importance}">
      <div class="entry-header">
        <div class="entry-title">
          <a href="${entry.url}" target="_blank">${entry.title || '(タイトルなし)'}</a>
        </div>
      </div>
      <div class="entry-meta">
        <span class="feed-name">${entry.feedTitle}</span>
        <span style="margin-left: 10px;">${publishedDate}</span>
      </div>
`;

        // AI要約があれば表示
        if (entry.aiSummary) {
          html += `
      <div class="ai-summary">
        <div class="ai-summary-label">🤖 AI要約</div>
        <div class="ai-summary-text">${entry.aiSummary}</div>
`;
          if (entry.keyPoints && entry.keyPoints.length > 0) {
            html += `
        <ul class="key-points">
          ${entry.keyPoints.map(p => `<li>${p}</li>`).join('')}
        </ul>
`;
          }
          if (entry.tickers && entry.tickers.length > 0) {
            html += `
        <div class="tickers">
          ${entry.tickers.map(t => `<span class="ticker">${t}</span>`).join('')}
        </div>
`;
          }
          html += `
      </div>
`;
        }

        html += `
    </div>
`;
      }

      if (group.entries.length > displayEntries.length) {
        html += `<p style="color: #718096; font-size: 0.9em; text-align: center;">他 ${group.entries.length - displayEntries.length}件</p>`;
      }
    }

    html += `
    <div class="footer">
      <p>このニュースレターはAIによって分析・生成されています</p>
      <p>Powered by Claude API</p>
    </div>
  </div>
</body>
</html>
`;

    return html;
  }

  generateText(entries, date, dailySummary = null) {
    const dateStr = date.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long'
    });

    let text = `投資ニュースレター - ${dateStr}\n`;
    text += '='.repeat(50) + '\n\n';

    if (dailySummary) {
      text += '【本日の注目ポイント】\n';
      text += dailySummary + '\n\n';
      text += '='.repeat(50) + '\n';
    }

    const groups = this.groupByImportance(entries);

    for (const [groupId, group] of Object.entries(groups)) {
      if (group.entries.length === 0) continue;
      if (groupId === 'other') continue;

      text += `\n${group.icon} ${group.name} (${group.entries.length}件)\n`;
      text += '-'.repeat(40) + '\n';

      const displayEntries = group.entries.slice(0, 10);
      for (const entry of displayEntries) {
        text += `\n● ${entry.title}\n`;
        text += `  ${entry.feedTitle} | ${new Date(entry.published).toLocaleString('ja-JP')}\n`;
        if (entry.aiSummary) {
          text += `  📝 ${entry.aiSummary}\n`;
        }
        text += `  ${entry.url}\n`;
      }
    }

    return text;
  }

  generate(entries, date = new Date(), dailySummary = null) {
    return {
      html: this.generateHtml(entries, date, dailySummary),
      text: this.generateText(entries, date, dailySummary),
      entries
    };
  }
}

export default NewsletterGenerator;
