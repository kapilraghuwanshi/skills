# codepen-archiver

Archive a CodePen account into a local folder with resumable runs.

This skill is designed for agent-driven execution inside Claude/Cursor/Codex-style coding assistants: user gives username/output/auth context, and the agent runs the script.

## Run

```bash
node skills/codepen-archiver/scripts/codepen-archive.mjs [--output "/absolute/path/CodePen Archive"]
```

## Common usage

```bash
node skills/codepen-archiver/scripts/codepen-archive.mjs --username YOUR_USER --output "/absolute/path/CodePen Archive" --dry-run
node skills/codepen-archiver/scripts/codepen-archive.mjs --username YOUR_USER --output "/absolute/path/CodePen Archive"
```

Use `CODEPEN_COOKIE` in your shell for authenticated access when needed.

If `--output` is omitted, the script defaults to the current user's system Downloads folder inside a `CodePen Archive` directory (on Linux it will attempt to use the XDG `XDG_DOWNLOAD_DIR` setting when available). The script will not prompt the user for an output path.

The script classifies pens into these `organized/` categories by default:

`html`, `css`, `javascript`, `typescript`, `react`, `vue`, `svelte`, `animation`, `svg`, `webgl`, `p5`, `threejs`, `d3`, `accessibility`, `misc`

To package this skill for distribution (creates `dist/<skill>.zip`), run:

```bash
./scripts/package-skill.sh codepen-archiver
```

## Authentication (copy `CODEPEN_COOKIE` from your browser)

Some pens or collections require an authenticated session. To run the script with access to private or otherwise gated pens, copy your CodePen session cookie from your browser and provide it to the script via the `CODEPEN_COOKIE` environment variable for that single command only.

Steps to copy the cookie (Chrome / Firefox / Edge):

1. Open https://codepen.io and sign in.
2. Open Developer Tools (mac: `Cmd+Opt+I`, Windows: `F12`).
3. Switch to the `Network` tab and reload the page.
4. Click any network request to `codepen.io` in the list (/graphQL)
5. In the request details, open `Headers` -> `Request Headers`.
6. Find the `cookie` header and copy its full value (the entire header string).

Example runs (replace placeholders):

Bash / Zsh (macOS, Linux):
```bash
CODEPEN_COOKIE='PASTE_FULL_COOKIE_HERE' node skills/codepen-archiver/scripts/codepen-archive.mjs --username YOUR_USER --dry-run
```

PowerShell (Windows):
```powershell
$env:CODEPEN_COOKIE = 'PASTE_FULL_COOKIE_HERE'
node skills/codepen-archiver/scripts/codepen-archive.mjs --username YOUR_USER --dry-run
Remove-Item Env:CODEPEN_COOKIE
```

Notes and safety:

- Do not paste your cookie into public places or commit it to source control. Treat it like a password.
- The cookie should only be used for the single command/session; clear the env variable afterwards (`unset CODEPEN_COOKIE` or `Remove-Item Env:CODEPEN_COOKIE`).
- If you prefer not to use cookies, supply explicit `--collection-url` values or a `--pen-list` file to avoid profile discovery.
- The script defaults to your system Downloads folder (no `--output` required).
