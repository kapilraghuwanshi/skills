#!/usr/bin/env node
import path from 'node:path';
import { scrape } from './scrape-profile.mjs';
import { run as archiveRun } from './codepen-archive.mjs';

function parseArgs(argv) {
  const args = { username: '', cookie: '', output: '' };
  for (let i = 0; i < argv.length; i += 1) {
    const t = argv[i];
    const next = argv[i + 1];
    if ((t === '--username' || t === '-u') && next) {
      args.username = next.trim();
      i += 1;
    } else if ((t === '--cookie' || t === '-c') && next) {
      args.cookie = next.trim();
      i += 1;
    } else if ((t === '--output' || t === '-o') && next) {
      args.output = next.trim();
      i += 1;
    }
  }
  if (!args.username) throw new Error('--username is required');
  return args;
}

async function main() {
  try {
    const args = parseArgs(process.argv.slice(2));
    const penListPath = path.join(process.cwd(), 'skills', 'codepen-archiver', 'scraped-pens.txt');

    const env = { ...process.env };
    if (args.cookie) env.CODEPEN_COOKIE = args.cookie;
    console.log('Running scraper...');
    await scrape({ username: args.username, output: penListPath, env });

    console.log('Running archiver...');
    await archiveRun({ penList: penListPath, username: args.username });

    console.log('Full archive run completed.');
  } catch (err) {
    console.error(String(err.message || err));
    process.exit(1);
  }
}

if (process.argv[1].endsWith('run-full-archive.mjs')) {
  main();
}
