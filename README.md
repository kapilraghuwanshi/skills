# Agent skills — [Kapil Raghuwanshi](https://github.com/kapilraghuwanshi)

Public, versioned **Agent Skills** you can browse, clone, zip, and load into Claude or other agents. Layout follows the same ideas as [anthropics/skills](https://github.com/anthropics/skills): one repo, many skills, optional **Claude Code** marketplace metadata.

## Skills in this repo

| Skill | Folder | What it does |
|--------|--------|----------------|
| **Idea → Architecture** | [`skills/idea-to-architecture/`](./skills/idea-to-architecture/) | Turns a one-line product idea into a justified multi-layer architecture (frontend → backend → AI/agents → infra → security), NFR profile, decision log, Excalidraw-style diagram guidance, and cost ballpark. |

*Add new rows here whenever you add a skill.*

## Repository layout

```text
.
├── README.md                 # This file — catalog + install paths
├── LICENSE
├── .gitignore
├── .claude-plugin/
│   ├── marketplace.json      # Claude Code: marketplace manifest (lists plugins + skill paths)
│   └── plugin.json           # Plugin metadata + explicit skill paths 
├── scripts/
│   └── package-skill.sh      # Zips one skill folder for download / Claude upload
└── skills/
    └── <skill-name>/
        ├── SKILL.md          # Required — YAML frontmatter + agent instructions
        ├── README.md         # Optional — human overview (Claude Skills UI often shows this)
        ├── references/       # Optional — extra docs the skill tells the agent to read
        └── scripts/          # Optional — helpers (Python, shell, etc.)
```

### Files that matter

| File | Purpose |
|------|--------|
| **`skills/<name>/SKILL.md`** | **Required.** [Agent Skills](https://github.com/anthropics/skills) convention: YAML frontmatter (`name`, `description`) plus markdown instructions. |
| **`skills/<name>/README.md`** | **Optional.** Short human-facing description; many UIs (e.g. Claude Skills) surface it next to the tree. |
| **`skills/<name>/references/*.md`** | **Optional.** “Progressive disclosure” — keep `SKILL.md` lean; link to deeper notes. |
| **`.claude-plugin/marketplace.json`** | **Optional but recommended** for Claude Code users: register the repo as a marketplace and list which folders are skills. |
| **`.claude-plugin/plugin.json`** | **Optional.** Human-readable plugin name, author, license, and a flat `skills` array |
| **Root `README.md`** | **Strongly recommended.** Discovery, install instructions, and a table of skills. |
| **`LICENSE`** | **Recommended.** Clarifies reuse (this repo uses MIT). |

## Try or install

### Claude Code (plugin marketplace)

In Claude Code, add this repository as a marketplace (same pattern as [anthropics/skills](https://github.com/anthropics/skills)):

```text
/plugin marketplace add kapilraghuwanshi/skills
```

Then install the bundle from the marketplace UI, or use the install flow your Claude Code version documents for this marketplace name: **`kapil-agent-skills`**.

After installation, mention the skill in chat (e.g. “use idea-to-architecture”) or rely on the skill description for matching.

### Claude.ai (upload folder or zip)

1. Use the folder `skills/idea-to-architecture/` **as the skill root** (that folder must contain `SKILL.md`).
2. Or create a zip of **that folder’s contents** (not the whole monorepo):  
   `./scripts/package-skill.sh idea-to-architecture`  
   Then upload the zip if your Claude plan supports skill upload.

### Cursor

Copy or symlink a skill directory into your user or project skills path, for example:

- `~/.cursor/skills/idea-to-architecture/`  
  or  
- `<project>/.cursor/skills/idea-to-architecture/`

Each skill directory should contain `SKILL.md` at its root.

### Browse on GitHub

Open [`skills/`](./skills/) and drill into any skill. The entry point is always `SKILL.md`.

## Packaging a skill as `.zip` (for releases or manual share)

From the repository root:

```bash
./scripts/package-skill.sh idea-to-architecture
```

This writes `dist/idea-to-architecture.zip`. Attach that to a [GitHub Release](https://docs.github.com/en/repositories/releasing-projects-on-github/managing-releases-in-a-repository) if you want a stable download URL.

## Adding another skill later

1. Create `skills/<new-skill-name>/SKILL.md` with valid frontmatter (`name`, `description`). See the [skill template](https://github.com/anthropics/skills/tree/main/template) in Anthropic’s repo.
2. Add optional `references/`, `scripts/`, assets.
3. Register the new path in **both** `.claude-plugin/marketplace.json` (`plugins[].skills`) and `.claude-plugin/plugin.json` (`skills`).
4. Add a row to the table at the top of this README.

## References

- [Agent Skills standard / spec](https://agentskills.io) (linked from [anthropics/skills](https://github.com/anthropics/skills))
- [anthropics/skills](https://github.com/anthropics/skills) — official examples and `marketplace.json` shape

## License

MIT — see [LICENSE](./LICENSE).
