#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const CATEGORIES = [
  "html",
  "css",
  "javascript",
  "typescript",
  "react",
  "vue",
  "svelte",
  "animation",
  "svg",
  "webgl",
  "p5",
  "threejs",
  "d3",
  "accessibility",
  "misc",
];
const execFileAsync = promisify(execFile);

function parseArgs(argv) {
  const args = {
    username: "",
    output: "",
    collectionUrls: [],
    penList: "",
    dryRun: false,
    force: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    const next = argv[i + 1];
    if (token === "--username" && next) {
      args.username = next.trim();
      i += 1;
    } else if (token === "--output" && next) {
      args.output = path.resolve(next.trim());
      i += 1;
    } else if (token === "--collection-url" && next) {
      args.collectionUrls.push(next.trim());
      i += 1;
    } else if (token === "--pen-list" && next) {
      args.penList = path.resolve(next.trim());
      i += 1;
    } else if (token === "--dry-run") {
      args.dryRun = true;
    } else if (token === "--force") {
      args.force = true;
    } else if (token === "--help" || token === "-h") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${token}`);
    }
  }

  return args;
}

function printHelp() {
  console.log(`Usage:
  node scripts/codepen-archive.mjs [--output "/abs/path/CodePen Archive"] [options]

Options:
  --username <name>               CodePen username (prompts if missing)
  --collection-url <url>          One or more collection URLs
  --pen-list <file>               File containing pen URLs (one per line)
  --dry-run                       Discover only, no downloads
  --force                         Refresh already archived pens
  --help                          Show this help
`);
}

function sanitizeName(value) {
  return String(value || "untitled")
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120) || "untitled";
}

function unique(values) {
  return [...new Set(values)];
}

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readText(filePath) {
  return fs.readFile(filePath, "utf8");
}

function headersFromEnv() {
  const headers = {
    "user-agent": "codepen-archiver-script/1.0",
    accept: "*/*",
  };
  if (process.env.CODEPEN_COOKIE) {
    headers.cookie = process.env.CODEPEN_COOKIE;
  }
  if (process.env.CODEPEN_TOKEN) {
    headers.authorization = `Bearer ${process.env.CODEPEN_TOKEN}`;
  }
  return headers;
}

async function getDefaultDownloadsDir() {
  // Try XDG user dirs config first (common on Linux)
  try {
    const cfgPath = path.join(os.homedir(), ".config", "user-dirs.dirs");
    const cfg = await fs.readFile(cfgPath, "utf8");
    const m = cfg.match(/XDG_DOWNLOAD_DIR=(.*)/);
    if (m && m[1]) {
      let val = m[1].trim();
      // remove surrounding quotes
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      // expand $HOME
      val = val.replace(/\$HOME|\{HOME\}/g, os.homedir());
      // handle relative paths like "$HOME/Downloads"
      if (!path.isAbsolute(val)) {
        val = path.join(os.homedir(), val);
      }
      return path.join(val, "CodePen Archive");
    }
  } catch {
    // ignore - fall back
  }

  // Windows: use USERPROFILE
  if (process.platform === "win32") {
    const up = process.env.USERPROFILE || os.homedir();
    return path.join(up, "Downloads", "CodePen Archive");
  }

  // macOS / most Linux defaults
  return path.join(os.homedir(), "Downloads", "CodePen Archive");
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: headersFromEnv(),
    redirect: "follow",
  });
  if (!response.ok) {
    if (response.status === 403) {
      throw new Error(
        `GET ${url} failed (403). CodePen returned "Forbidden" — this often means the resource requires authentication or your IP is blocked.\n` +
          `If you need private or authenticated access, start the script with your CodePen session cookie in the environment:\n` +
          `  CODEPEN_COOKIE='session-cookie-from-browser' node ${process.argv[1]} --username USER --output "${path.join(
            os.homedir(),
            "Downloads",
            "CodePen Archive",
          )}" --dry-run\n` +
          `Or provide explicit collection URLs via --collection-url or a pen list file via --pen-list to avoid profile discovery.`,
      );
    }
    throw new Error(`GET ${url} failed (${response.status})`);
  }
  return response.text();
}

function extractCollectionUrlsFromProfile(html, username) {
  const pattern = new RegExp(`https://codepen\\.io/${username}/collection/[A-Za-z0-9]+`, "g");
  const found = html.match(pattern) || [];
  return unique(found);
}

function extractPenUrls(html) {
  const fullPattern = /https:\/\/codepen\.io\/[A-Za-z0-9_-]+\/pen\/[A-Za-z0-9]+/g;
  const relativePattern = /\/[A-Za-z0-9_-]+\/pen\/[A-Za-z0-9]+/g;
  const full = html.match(fullPattern) || [];
  const relative = (html.match(relativePattern) || []).map((x) => `https://codepen.io${x}`);
  return unique([...full, ...relative]).map((url) => url.split("?")[0]);
}

function parsePenUrl(penUrl) {
  const match = penUrl.match(/^https:\/\/codepen\.io\/([^/]+)\/pen\/([^/?#]+)/);
  if (!match) {
    return null;
  }
  return { username: match[1], slug: match[2], url: `https://codepen.io/${match[1]}/pen/${match[2]}` };
}

async function readPenList(filePath) {
  const content = await readText(filePath);
  return unique(
    content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .filter((line) => line.startsWith("https://codepen.io/") && line.includes("/pen/")),
  );
}

async function downloadToFile(url, outPath) {
  const response = await fetch(url, {
    headers: headersFromEnv(),
    redirect: "follow",
  });
  if (!response.ok || !response.body) {
    throw new Error(`Download failed (${response.status})`);
  }
  await pipeline(response.body, createWriteStream(outPath));
}

async function tryDownloadPenZip(pen, zipPath) {
  const candidates = [
    `${pen.url}.zip`,
    `${pen.url}/export?format=zip`,
    `${pen.url}/export/zip`,
  ];

  let lastError = null;
  for (const candidate of candidates) {
    try {
      await downloadToFile(candidate, zipPath);
      const stat = await fs.stat(zipPath);
      if (stat.size < 100) {
        throw new Error("Downloaded file too small to be valid zip");
      }
      return candidate;
    } catch (error) {
      lastError = error;
      await fs.rm(zipPath, { force: true });
    }
  }
  throw lastError || new Error("No export URL worked");
}

async function extractZip(zipPath, destinationDir) {
  await ensureDir(destinationDir);
  await execFileAsync("unzip", ["-oq", zipPath, "-d", destinationDir]);
}

async function gatherSourceHints(dirPath) {
  const hints = [];

  async function walk(current) {
    const entries = await fs.readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
      } else {
        const lower = entry.name.toLowerCase();
        hints.push(lower);
        if ([".js", ".jsx", ".ts", ".tsx", ".css", ".scss", ".sass", ".less", ".html"].some((ext) => lower.endsWith(ext))) {
          try {
            const content = (await fs.readFile(full, "utf8")).slice(0, 5000).toLowerCase();
            hints.push(content);
          } catch {
            // Ignore non-text files.
          }
        }
      }
    }
  }

  await walk(dirPath);
  return hints.join(" ");
}

async function copyDirIfExists(srcDir, destDir) {
  if (!(await exists(srcDir))) {
    return false;
  }
  await ensureDir(path.dirname(destDir));
  await fs.cp(srcDir, destDir, { recursive: true, force: true });
  return true;
}

async function writeNormalizedEntry(orgDir) {
  const candidates = [
    { src: path.join(orgDir, "src", "index.jsx"), out: "App.jsx" },
    { src: path.join(orgDir, "src", "index.tsx"), out: "App.tsx" },
    { src: path.join(orgDir, "src", "script.js"), out: "script.js" },
    { src: path.join(orgDir, "src", "script.ts"), out: "script.ts" },
    { src: path.join(orgDir, "src", "index.js"), out: "script.js" },
    { src: path.join(orgDir, "src", "index.ts"), out: "script.ts" },
    { src: path.join(orgDir, "src", "style.css"), out: "style.css" },
  ];

  for (const candidate of candidates) {
    if (await exists(candidate.src)) {
      await fs.copyFile(candidate.src, path.join(orgDir, candidate.out));
      return candidate.out;
    }
  }

  return null;
}

async function findFilesRecursive(dir, exts) {
  const results = [];
  async function walk(current) {
    const entries = await fs.readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
      } else {
        const lower = entry.name.toLowerCase();
        for (const ext of exts) {
          if (lower.endsWith(ext)) {
            results.push(full);
            break;
          }
        }
      }
    }
  }
  try {
    await walk(dir);
  } catch {
    // ignore
  }
  return results;
}

async function createNormalizedFiles(orgDir, rawPenDir) {
  // create index.html: prefer any .html found
  const htmlFiles = await findFilesRecursive(rawPenDir, ['.html', '.htm']);
  if (htmlFiles.length > 0) {
    await fs.copyFile(htmlFiles[0], path.join(orgDir, 'index.html'));
  }

  // create style.css: concatenate all .css files found in src/dist/raw
  const cssFiles = await findFilesRecursive(rawPenDir, ['.css']);
  if (cssFiles.length > 0) {
    let cssContent = '';
    for (const f of cssFiles) {
      try {
        cssContent += (await fs.readFile(f, 'utf8')) + '\n';
      } catch {
        // ignore binary/non-text
      }
    }
    await fs.writeFile(path.join(orgDir, 'style.css'), cssContent, 'utf8');
  }

  // create script.js: concatenate common script files
  const jsFiles = await findFilesRecursive(rawPenDir, ['.js', '.mjs', '.cjs', '.ts']);
  if (jsFiles.length > 0) {
    let jsContent = '';
    for (const f of jsFiles) {
      try {
        jsContent += (await fs.readFile(f, 'utf8')) + '\n';
      } catch {
        // ignore
      }
    }
    await fs.writeFile(path.join(orgDir, 'script.js'), jsContent, 'utf8');
  }
}

function classifyPen(penMeta) {
  const collectionName = (penMeta.collectionName || "").toLowerCase();
  const source = (penMeta.sourceHints || "").toLowerCase();

  const CATEGORY_KEYWORDS = [
    { cat: "react", kws: ["react", "reactdom", "createroot", "jsx"] },
    { cat: "vue", kws: ["vue", "v-model", "vue.js"] },
    { cat: "svelte", kws: ["svelte"] },
    { cat: "typescript", kws: [".ts", "typescript"] },
    { cat: "javascript", kws: [".js", "babel", "coffeescript"] },
    { cat: "css", kws: ["scss", "sass", "less", "css"] },
    { cat: "animation", kws: ["animation", "keyframes"] },
    { cat: "svg", kws: ["<svg", "svg"] },
    { cat: "webgl", kws: ["webgl", "three.js", "threejs", "three"] },
    { cat: "p5", kws: ["p5.", "p5js", "p5.js"] },
    { cat: "d3", kws: ["d3.", "d3.js"] },
    { cat: "html", kws: [".html", "doctype", "<html"] },
    { cat: "accessibility", kws: ["aria-", "accessibility"] },
  ];

  // prefer explicit collection name if it directly mentions a known category
  for (const c of CATEGORY_KEYWORDS) {
    if (collectionName.includes(c.cat)) return c.cat;
  }

  // then inspect source hints
  for (const c of CATEGORY_KEYWORDS) {
    if (c.kws.some((k) => source.includes(k))) return c.cat;
  }

  // if collection name exists, use a sanitized version as the category
  if (collectionName) {
    return collectionName.replace(/\s+/g, "-").replace(/[^a-z0-9-_]/g, "").slice(0, 60) || "misc";
  }

  return "misc";
}

async function seedFolderLayout(outputDir) {
  await ensureDir(outputDir);
  await ensureDir(path.join(outputDir, "raw"));
  await ensureDir(path.join(outputDir, "_downloads"));
  await ensureDir(path.join(outputDir, "organized"));
  await Promise.all(CATEGORIES.map((cat) => ensureDir(path.join(outputDir, "organized", cat))));
}

async function promptForUsernameIfMissing(args) {
  if (args.username) {
    return args.username;
  }
  const rl = readline.createInterface({ input, output });
  const value = (await rl.question("Enter CodePen username: ")).trim();
  rl.close();
  if (!value) {
    throw new Error("Username is required");
  }
  return value;
}

async function discoverCollections(username, explicitCollectionUrls) {
  if (explicitCollectionUrls.length > 0) {
    return unique(explicitCollectionUrls);
  }
  const profileUrl = `https://codepen.io/${username}/collections`;
  const html = await fetchText(profileUrl);
  return extractCollectionUrlsFromProfile(html, username);
}

async function discoverPensFromCollections(collectionUrls) {
  const mapping = new Map();
  for (const collectionUrl of collectionUrls) {
    const html = await fetchText(collectionUrl);
    const penUrls = extractPenUrls(html);
    const collectionName = sanitizeName(collectionUrl.split("/").pop() || "collection");
    for (const penUrl of penUrls) {
      if (!mapping.has(penUrl)) {
        mapping.set(penUrl, new Set());
      }
      mapping.get(penUrl).add(collectionName);
    }
  }
  return mapping;
}

async function writeJson(filePath, data) {
  await fs.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

async function run(cliArgs) {
  const args = cliArgs || parseArgs(process.argv.slice(2));
  if (!args.output) {
    args.output = await getDefaultDownloadsDir();
    console.log(`No --output provided; using default downloads folder: ${args.output}`);
  }
  let username = args.username || null;
  if (!username && !args.penList && args.collectionUrls.length === 0) {
    username = await promptForUsernameIfMissing(args);
  }
  await seedFolderLayout(args.output);

  const manifestPath = path.join(args.output, "manifest.json");
  const previousManifest = (await exists(manifestPath)) ? JSON.parse(await readText(manifestPath)) : null;

  let collectionPens = new Map();
  let collectionUrls = [];
  if (args.penList) {
    // will populate from pen-list below
    collectionPens = new Map();
  } else {
    try {
      collectionUrls = await discoverCollections(username, args.collectionUrls);
      collectionPens = await discoverPensFromCollections(collectionUrls);
    } catch (err) {
      console.warn(`Collection discovery failed: ${String(err.message || err)} - falling back to scraping profile page for pens.`);
      if (!username) {
        throw err;
      }
      // Fallback: scrape the user's profile page for pen URLs
      const profileUrl = `https://codepen.io/${username}`;
      const html = await fetchText(profileUrl);
      const penUrls = extractPenUrls(html);
      for (const penUrl of penUrls) {
        collectionPens.set(penUrl, new Set(["profile"]));
      }
    }
  }
  const penListPens = args.penList ? await readPenList(args.penList) : [];
  for (const penUrl of penListPens) {
    if (!collectionPens.has(penUrl)) {
      collectionPens.set(penUrl, new Set(["manual-list"]));
    }
  }

  const discoveredPenUrls = [...collectionPens.keys()];
  if (discoveredPenUrls.length === 0) {
    throw new Error("No pens found. Provide --collection-url or --pen-list, or verify username/auth.");
  }

  const stats = {
    discoveredPens: discoveredPenUrls.length,
    downloaded: 0,
    skipped: 0,
    failed: 0,
  };

  const entries = [];
  for (const penUrl of discoveredPenUrls) {
    const pen = parsePenUrl(penUrl);
    if (!pen) {
      stats.failed += 1;
      entries.push({ penUrl, status: "failed", reason: "Invalid pen URL format" });
      continue;
    }

    const collectionName = sanitizeName([...collectionPens.get(penUrl)][0] || "uncategorized");
    const penDirName = sanitizeName(`${pen.username}-${pen.slug}`);
    const rawPenDir = path.join(args.output, "raw", collectionName, penDirName);
    const downloadZipPath = path.join(args.output, "_downloads", `${pen.username}-${pen.slug}.zip`);
    const metadataPath = path.join(rawPenDir, "metadata.json");

    if (!args.force && (await exists(metadataPath))) {
      stats.skipped += 1;
      entries.push({ penUrl: pen.url, status: "skipped", reason: "Already archived", collectionName });
      continue;
    }

    if (args.dryRun) {
      entries.push({ penUrl: pen.url, status: "dry-run", collectionName });
      continue;
    }

    await ensureDir(rawPenDir);
    try {
      const sourceUrl = await tryDownloadPenZip(pen, downloadZipPath);
      await fs.copyFile(downloadZipPath, path.join(rawPenDir, "export.zip"));
      await extractZip(downloadZipPath, rawPenDir);

      const sourceHints = await gatherSourceHints(rawPenDir);
      const category = classifyPen({ collectionName, sourceHints });
      const orgDir = path.join(args.output, "organized", category, penDirName);

      await ensureDir(orgDir);
      await copyDirIfExists(path.join(rawPenDir, "src"), path.join(orgDir, "src"));
      await copyDirIfExists(path.join(rawPenDir, "dist"), path.join(orgDir, "dist"));
      const normalizedEntry = await writeNormalizedEntry(orgDir);
      await createNormalizedFiles(orgDir, rawPenDir);

      const metadata = {
        penUrl: pen.url,
        username: pen.username,
        slug: pen.slug,
        sourceUrl,
        collectionName,
        category,
        normalizedEntry,
        downloadedAt: new Date().toISOString(),
      };
      await writeJson(metadataPath, metadata);
      await writeJson(path.join(orgDir, "metadata.json"), metadata);

      stats.downloaded += 1;
      entries.push({ penUrl: pen.url, status: "downloaded", collectionName, category });
    } catch (error) {
      stats.failed += 1;
      entries.push({ penUrl: pen.url, status: "failed", reason: String(error.message || error), collectionName });
    }
  }

  const manifest = {
    archiveVersion: "1.0",
    generatedAt: new Date().toISOString(),
    username,
    output: args.output,
    dryRun: args.dryRun,
    force: args.force,
    collections: collectionUrls,
    stats,
    entries,
    previousRunAt: previousManifest?.generatedAt || null,
  };

  await writeJson(manifestPath, manifest);

  console.log(`Archive complete.
  Username: ${username}
  Output: ${args.output}
  Discovered pens: ${stats.discoveredPens}
  Downloaded: ${stats.downloaded}
  Skipped: ${stats.skipped}
  Failed: ${stats.failed}
  Manifest: ${manifestPath}`);
}

if (process.argv[1].endsWith('codepen-archive.mjs')) {
  run().catch((error) => {
    console.error(`Error: ${error.message || error}`);
    process.exit(1);
  });
}

export { run };
