---
name: codepen-archiver
description: Archive, sync, and organize a user's CodePen pens and collections into a local folder. Use when the user wants to scrape/download/export CodePen pens, back up CodePen collections, re-run a CodePen archive sync, classify pens by collection and pen name, preserve raw CodePen exports, or create a resumable local CodePen backup from profile, collection, or pen URLs.
---

# CodePen Archiver

## Overview

Use this skill to create or update a local archive of CodePen pens. The agent should run the bundled `scripts/codepen-archive.mjs` script on the user's behalf so users do not need to manually run CLI commands.

CodePen does not provide a traditional public REST or GraphQL API. Treat CodePen pages and export URLs as web surfaces that may change. Preserve raw exports first, then organize derived copies.

## Triggering and Activation

This skill should activate when users say phrases like:

- "archive my CodePen"
- "backup all my pens"
- "download all my CodePens"
- "sync my CodePen collections"
- "clone my CodePen profile locally"

When triggered, start a short intake and then execute the workflow directly.

## Intake Questions (Ask First)

Ask exactly these:

Ask exactly these:

1. CodePen username
2. Whether private pens/collections are needed
3. Whether this is a first run, dry-run only, or refresh (`--force`)

If profile discovery fails or is blocked, ask for either:
- one or more collection URLs, or
- a text file of pen URLs

Do not ask the user for an output path; the script defaults to the user's system Downloads folder in a `CodePen Archive` subfolder when `--output` is not provided.

## Cookie Guidance (When Auth Is Needed)

If private content or 403 responses appear, guide the user:

1. Open CodePen in browser and log in.
2. Open DevTools -> Network.
3. Refresh page and click any request to `codepen.io`.
4. Copy the `cookie` request header value.
5. Provide it only for this session as `CODEPEN_COOKIE`.

Never ask for password. Never store the cookie in source files.

## Agent Execution

The agent should run the script itself. Use this command pattern:

```bash
node skills/codepen-archiver/scripts/codepen-archive.mjs --username CODEPEN_USERNAME --output "/absolute/path/CodePen Archive"
```

If private access is needed, set env in the same command/session:

```bash
CODEPEN_COOKIE='session-cookie-from-browser' node skills/codepen-archiver/scripts/codepen-archive.mjs --username CODEPEN_USERNAME --output "/absolute/path/CodePen Archive"
```

### Automated skill workflow (scrape → archive)

For a fully automated agent-driven run (recommended when Cloudflare blocks direct discovery), use the bundled Puppeteer scraper to collect all pen URLs from a signed-in browser context and then archive them.

1. Install dependencies (once):

```bash
cd skills/codepen-archiver
npm ci
```

2. Run the full workflow (collector + archiver). Provide `CODEPEN_COOKIE` if required for private pens.

```bash
# with cookie in env
CODEPEN_COOKIE='PASTE_FULL_COOKIE_HERE' npm run run-full -- --username CODEPEN_USERNAME

# or without cookie for public profiles (may still be blocked by anti-bot protections)
npm run run-full -- --username CODEPEN_USERNAME
```

The runner writes a pen list to `skills/codepen-archiver/scraped-pens.txt` and then runs the archiver against that list.

If the user omits `--output`, the script will default to the current user's system Downloads folder inside a `CodePen Archive` subfolder. On Linux it attempts to respect the XDG `XDG_DOWNLOAD_DIR` setting when present.

If the user has collection URLs, prefer explicit URLs because they are more reliable than profile discovery:

```bash
node scripts/codepen-archive.mjs \
  --collection-url "https://codepen.io/USER/collection/ABCxyz" \
  --collection-url "https://codepen.io/USER/collection/DEFuvw" \
  --output "/absolute/path/CodePen Archive"
```

If the user has a file of pen URLs:

```bash
node skills/codepen-archiver/scripts/codepen-archive.mjs --pen-list "/absolute/path/pens.txt" --output "/absolute/path/CodePen Archive"
```

## Workflow

1. Ask intake questions and confirm target output path.
2. Run a dry-run first for large archives or first-time runs.
3. If discovery returns 403, request `CODEPEN_COOKIE` and re-run.
4. Run full archive after dry-run confirmation.
5. Read `manifest.json` and summarize:
   - discovered pens
   - downloaded, skipped, failed
   - categories
6. Offer optional re-run with `--force` only if user asks to refresh existing exports.

Dry-run command:

```bash
node skills/codepen-archiver/scripts/codepen-archive.mjs --username CODEPEN_USERNAME --output "/absolute/path/CodePen Archive" --dry-run
```

## Output Layout

The script writes:

```text
CodePen Archive/
  manifest.json
  raw/
    Collection Name/
      Pen Title/
        src/
        dist/
        metadata.json
  organized/
    html/
    css/
    javascript/
    typescript/
    react/
    vue/
    svelte/
    animation/
    svg/
    webgl/
    p5/
    threejs/
    d3/
    accessibility/
    misc/
  _downloads/
```

`raw/` is the source of truth. Do not refactor files in `raw/`.

`organized/` is a derived view. It copies each pen's `src/` folder and creates a normalized entry file when possible, such as `App.jsx`, `script.js`, or `index.html`.

## Classification Rules

Classification tries to preserve the user's intent by preferring explicit collection names first (if a collection name clearly matches a known category). If a collection name is not mappable, the script inspects the exported source files and metadata for framework, language, or tooling hints.

Primary categories detected (in order of preference): `react`, `vue`, `svelte`, `typescript`, `javascript`, `css`, `html`, `animation`, `svg`, `webgl`, `p5`, `threejs`, `d3`, `accessibility`, `misc`.

Heuristics used:
- If the collection name contains a known category token (for example `react` or `threejs`), that category is used.
- Otherwise the script scans source hints for keywords or file extensions (e.g. `.tsx`, `ReactDOM`, `createRoot` → `react`; `.ts` → `typescript`; `.js`/`babel` → `javascript`; `scss`/`sass` → `css`; `<svg` → `svg`; `three.js`/`webgl` → `webgl`).
- If none of the detectors match, a sanitized collection name is used as the category when available.
- Fallback is `misc`.

## Safety

- Never hardcode the user's CodePen cookie, token, or password.
- Prefer environment variables like `CODEPEN_COOKIE` and `CODEPEN_TOKEN`.
- Keep `manifest.json` so syncs can resume and skip already archived pens.
- Use `--dry-run` before downloading hundreds of pens.
- Use `--force` only with user approval because it replaces archived pen folders inside the output folder.

## References

Read `references/codepen-export-notes.md` when you need CodePen-specific constraints, export behavior, or current source links.
