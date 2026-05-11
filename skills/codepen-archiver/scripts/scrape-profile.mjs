#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import puppeteer from 'puppeteer';

function parseArgs(argv) {
  const args = { username: '', output: '' };
  for (let i = 0; i < argv.length; i += 1) {
    const t = argv[i];
    const next = argv[i + 1];
    if ((t === '--username' || t === '-u') && next) {
      args.username = next.trim();
      i += 1;
    } else if ((t === '--output' || t === '-o') && next) {
      args.output = path.resolve(next.trim());
      i += 1;
    }
  }
  if (!args.username) throw new Error('--username is required');
  if (!args.output) {
    args.output = path.join(process.cwd(), 'skills', 'codepen-archiver', 'scraped-pens.txt');
  }
  return args;
}

async function autoScroll(page) {
  await page.evaluate(async () => {
    const distance = 800;
    const delay = (ms) => new Promise((res) => setTimeout(res, ms));
    let total = 0;
    while (true) {
      const prev = document.documentElement.scrollTop || document.body.scrollTop;
      window.scrollBy(0, distance);
      await delay(500);
      const curr = document.documentElement.scrollTop || document.body.scrollTop;
      total += distance;
      if (curr === prev) break;
      if (total > document.body.scrollHeight + 2000) break;
    }
  });
}

async function scrape({ username, output }) {
    const urlCandidates = [
      'https://codepen.io/your-work',
      'https://codepen.io/your-work?item_type=PEN',
      `https://codepen.io/${username}/pens/public`,
      `https://codepen.io/${username}/pens`,
      `https://codepen.io/${username}`,
    ];
  const cookieHeader = process.env.CODEPEN_COOKIE || '';
  
  // First attempt: Try GraphQL API directly to fetch pens
  console.log('Attempting direct GraphQL API call to fetch pens...');
  let penUrls = [];
  try {
    const graphqlUrl = 'https://codepen.io/graphql';
    const headers = {
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    };
    if (cookieHeader) {
      headers['Cookie'] = cookieHeader;
    }

    const query = `query {
      user(username: "${username}") {
        allPens(limit: 100, sort: RECENT) {
          edges {
            node {
              id
              slug
              title
            }
          }
        }
      }
    }`;

    const res = await fetch(graphqlUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({ query }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.data?.user?.allPens?.edges) {
        data.data.user.allPens.edges.forEach((edge) => {
          const slug = edge.node.slug;
          if (slug) {
            const url = `https://codepen.io/${username}/pen/${slug}`;
            penUrls.push(url);
          }
        });
        console.log(`GraphQL API returned ${penUrls.length} pens`);
      }
    } else {
      console.warn(`GraphQL API responded with status ${res.status}`);
    }
  } catch (e) {
    console.warn('GraphQL API call failed:', e.message || e);
  }

  // If GraphQL worked, write and return now
  if (penUrls.length > 0) {
    await fs.mkdir(path.dirname(output), { recursive: true });
    await fs.writeFile(output, penUrls.join('\n') + '\n', 'utf8');
    console.log(`Wrote ${penUrls.length} pen URLs to ${output}`);
    return penUrls;
  }

  // Second attempt: Use Puppeteer if GraphQL didn't return pens
  console.log('GraphQL failed or returned no pens; attempting Puppeteer-based scraping...');
  const headlessConfig = process.env.PUPPETEER_HEADLESS ?? 'true';
  const launchOpts = { headless: headlessConfig === 'true' ? true : headlessConfig };
  if (process.env.PUPPETEER_NO_SANDBOX === '1') {
    launchOpts.args = [...(launchOpts.args || []), '--no-sandbox', '--disable-setuid-sandbox'];
  }
  // Prefer a user-installed Chrome if available to avoid Chromium binary incompatibilities
  const possibleChromePaths = [];
  if (process.env.CHROME_PATH) possibleChromePaths.push(process.env.CHROME_PATH);
  possibleChromePaths.push('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome');
  possibleChromePaths.push('/Applications/Chromium.app/Contents/MacOS/Chromium');
  for (const p of possibleChromePaths) {
    try {
      await fs.access(p);
      launchOpts.executablePath = p;
      console.log('Using browser executable:', p);
      break;
    } catch {
      // not present
    }
  }
  console.log('Launching Puppeteer with options:', launchOpts);
  const browser = await puppeteer.launch(launchOpts);
  try {
    const page = await browser.newPage();
    await page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36',
    );
    
    // Parse and set cookies properly
    if (cookieHeader) {
      const cookies = cookieHeader.split(';').map((c) => {
        const [name, value] = c.trim().split('=');
        if (!name || !value) return null;
        return {
          name: name.trim(),
          value: decodeURIComponent(value.trim()),
          url: 'https://codepen.io',
        };
      }).filter(Boolean);
      if (cookies.length > 0) {
        await page.setCookie(...cookies);
        console.log(`Set ${cookies.length} cookies`);
      }
    }
    
    // Collect pen URLs from multiple sources: network responses and DOM anchors
    const penSet = new Set();
    const pattern = /https:\/\/codepen\.io\/[A-Za-z0-9_-]+\/pen\/[A-Za-z0-9_-]+/;

    // helper to extract pen URLs from arbitrary JSON/text
    function extractPenUrlsFromValue(val) {
      try {
        if (!val) return;
        if (typeof val === 'string') {
          const matches = val.match(/https:\/\/codepen\.io\/[A-Za-z0-9_-]+\/pen\/[A-Za-z0-9_-]+/g);
          if (matches) matches.forEach((m) => penSet.add(m.split('?')[0]));
        } else if (Array.isArray(val)) {
          val.forEach(extractPenUrlsFromValue);
        } else if (typeof val === 'object') {
          for (const k of Object.keys(val)) extractPenUrlsFromValue(val[k]);
        }
      } catch (e) {
        // ignore
      }
    }

    page.on('response', async (res) => {
      try {
        const rurl = res.url();
        if (/graphql|api|pens|items/.test(rurl)) {
          const headers = res.headers();
          const ct = (headers['content-type'] || headers['Content-Type'] || '') + '';
          if (ct.includes('application/json') || ct.includes('application/hal+json') || ct === '') {
            let json;
            try {
              json = await res.json();
            } catch (e) {
              return;
            }
            extractPenUrlsFromValue(json);
          }
        }
      } catch (e) {
        // ignore response parsing errors
      }
    });

    // Try multiple entry points: public pens, user page and the logged-in "your-work" dashboard
    let lastErr;
    let foundAny = false;
    for (const tryUrl of urlCandidates) {
      try {
        console.log('Visiting', tryUrl);
        // Wait for full network load and give Cloudflare time to complete its challenge
        await page.goto(tryUrl, { waitUntil: 'networkidle0', timeout: 60000 });
        await page.waitForTimeout(2000); // Extra time for JS to render content
        
        // Check if we're still on a Cloudflare challenge page
        const pageTitle = await page.title();
        if (pageTitle.includes('Just a moment') || pageTitle.includes('Cloudflare')) {
          console.warn('Cloudflare challenge page detected; waiting longer...');
          await page.waitForTimeout(3000);
        }

        // attempt to paginate / load more if available
        for (let i = 0; i < 8; i += 1) {
          await autoScroll(page);
          const more = await page.$x("//button[contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'load') or contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'show more') or contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'more')]");
          if (more && more.length > 0) {
            try {
              await more[0].click();
              await page.waitForTimeout(1000);
              continue;
            } catch (e) {
              // ignore click failures
            }
          }
          await page.waitForTimeout(500);
          break;
        }

        // extract anchors from DOM
        const anchorsOnThis = await page.evaluate(() => {
          const urls = [];
          // Look for pen links in various places
          document.querySelectorAll('a[href*="/pen/"], [data-href*="/pen/"], [data-url*="/pen/"]').forEach((el) => {
            const href = el.href || el.getAttribute('data-href') || el.getAttribute('data-url');
            if (href && href.includes('/pen/')) {
              urls.push(href.split('?')[0]);
            }
          });
          // Also look in text content for embedded URLs
          const allText = document.body.innerText || '';
          const matches = allText.match(/https:\/\/codepen\.io\/[A-Za-z0-9_-]+\/pen\/[A-Za-z0-9_-]+/g);
          if (matches) {
            matches.forEach((m) => urls.push(m.split('?')[0]));
          }
          return Array.from(new Set(urls)); // dedupe
        });
        anchorsOnThis.forEach((u) => { if (pattern.test(u)) penSet.add(u); });

        // search inline scripts for embedded JSON/state
        try {
          const scriptMatches = await page.evaluate(() => {
            const out = [];
            const scripts = Array.from(document.querySelectorAll('script'));
            for (const s of scripts) {
              try {
                if (!s.innerText) continue;
                out.push(s.innerText);
              } catch (e) {
                // ignore
              }
            }
            return out.join('\n');
          });
          extractPenUrlsFromValue(scriptMatches);
        } catch (e) {
          // ignore
        }

        if (penSet.size > 0) {
          foundAny = true;
          break;
        }
      } catch (e) {
        lastErr = e;
        console.warn('Failed to open or extract from', tryUrl, e.message || e);
      }
    }
    if (!foundAny && penSet.size === 0) {
      const dumpPath = output + '.profile.html';
      try {
        const content = await page.content();
        await fs.writeFile(dumpPath, content, 'utf8');
        console.error(`No pens found on profile page — saved page HTML to ${dumpPath}`);
      } catch (e) {
        console.error('No pens found on profile page and failed to save HTML dump:', e.message || e);
      }
      throw lastErr || new Error('No pens found on profile page');
    }

    // attempt to paginate / load more if available
    for (let i = 0; i < 30; i += 1) {
      await autoScroll(page);
      // click any visible "Load more" or "Show more" buttons
      const more = await page.$x("//button[contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'load') or contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'show more') or contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'more')]");
      if (more && more.length > 0) {
        try {
          await more[0].click();
          await page.waitForTimeout(1000);
          continue;
        } catch (e) {
          // ignore click failures
        }
      }
      // small delay to allow network responses to arrive
      await page.waitForTimeout(500);
      break;
    }

    // extract anchors from DOM
    const anchors = await page.evaluate(() => Array.from(document.querySelectorAll('a[href*="/pen/"]')).map((a) => a.href.split('?')[0]));
    anchors.forEach((u) => { if (pattern.test(u)) penSet.add(u); });

    // Additionally, search inline <script> tags for embedded JSON or preloaded state containing pen URLs
    try {
      const scriptMatches = await page.evaluate(() => {
        const out = [];
        const scripts = Array.from(document.querySelectorAll('script'));
        for (const s of scripts) {
          try {
            if (!s.innerText) continue;
            out.push(s.innerText);
          } catch (e) {
            // ignore
          }
        }
        return out.join('\n');
      });
      // run the same pen URL extractor on the combined script content
      extractPenUrlsFromValue(scriptMatches);
    } catch (e) {
      // ignore script extraction failures
    }

    const penUrls = Array.from(penSet);

    if (!penUrls || penUrls.length === 0) {
      const dumpPath = output + '.profile.html';
      try {
        const content = await page.content();
        await fs.writeFile(dumpPath, content, 'utf8');
        console.error(`No pens found on profile page — saved page HTML to ${dumpPath}`);
      } catch (e) {
        console.error('No pens found on profile page and failed to save HTML dump:', e.message || e);
      }
      throw new Error('No pens found on profile page');
    }

    await fs.mkdir(path.dirname(output), { recursive: true });
    await fs.writeFile(output, penUrls.join('\n') + '\n', 'utf8');
    console.log(`Wrote ${penUrls.length} pen URLs to ${output}`);
    return penUrls;
  } finally {
    await browser.close();
  }
}

async function main() {
  try {
    const args = parseArgs(process.argv.slice(2));
    await scrape(args);
  } catch (err) {
    console.error(String(err.message || err));
    process.exit(1);
  }
}

if (process.argv[1].endsWith('scrape-profile.mjs')) {
  main();
}

export { scrape };
