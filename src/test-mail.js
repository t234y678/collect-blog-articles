import 'dotenv/config';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import Mailer from './mailer.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function testMail() {
  // 最新のニュースレターを取得
  const outputDir = path.join(__dirname, '../output');
  const files = await fs.readdir(outputDir);
  const htmlFiles = files.filter(f => f.endsWith('.html')).sort().reverse();

  if (htmlFiles.length === 0) {
    console.error('No newsletter files found. Run --fetch first.');
    return;
  }

  const latestHtml = htmlFiles[0];
  const latestTxt = latestHtml.replace('.html', '.txt');

  console.log(`Sending: ${latestHtml}`);

  const html = await fs.readFile(path.join(outputDir, latestHtml), 'utf-8');
  const text = await fs.readFile(path.join(outputDir, latestTxt), 'utf-8');

  const mailer = new Mailer({
    user: process.env.GMAIL_USER,
    appPassword: process.env.GMAIL_APP_PASSWORD,
    to: process.env.NEWSLETTER_TO || process.env.GMAIL_USER
  });

  const verified = await mailer.verify();
  if (!verified) {
    console.error('Mail server verification failed');
    return;
  }

  const date = new Date();
  const dateStr = date.toLocaleDateString('ja-JP', {
    month: 'long',
    day: 'numeric'
  });

  await mailer.sendNewsletter(
    `📈 投資ニュースレター - ${dateStr}`,
    html,
    text
  );

  console.log('Test email sent successfully!');
}

testMail().catch(console.error);
