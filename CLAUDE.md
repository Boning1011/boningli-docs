# CLAUDE.md — Instructions for Claude Code

## Project Overview

This is a Docusaurus v3 documentation/blog site deployed to GitHub Pages via GitHub Actions.
Build command: `npm run build`. The CI workflow runs this on every push to `main`.

## CRITICAL: Always Build Before Committing

Before creating any git commit, you MUST run:

```bash
npm run build
```

If the build fails, fix ALL errors before committing. Common failure causes:

1. **Broken links** — `onBrokenLinks` is set to `'throw'` in `docusaurus.config.js`, so any dead internal link will fail the build.
2. **Invalid frontmatter** — Malformed YAML in markdown file headers (missing quotes, bad dates, duplicate keys).
3. **Missing files** — Referencing images or pages that don't exist.
4. **MDX syntax errors** — Unescaped `<`, `{`, `}` characters in markdown content, or invalid JSX.
5. **Sidebar config mismatch** — `sidebars.js` referencing doc IDs that don't exist.

## Blog Posts (Quick Notes)

- Located in `blog/`
- Tags must be defined in `blog/tags.yml` before use
- Authors must be defined in `blog/authors.yml`
- Use `<!-- truncate -->` marker for post previews

## Docs (Longform)

- Located in `docs/`
- Served at site root (`routeBasePath: '/'`)
- Sidebar defined in `sidebars.js`

## Build Warnings

Treat warnings seriously — they may become errors in future Docusaurus versions. Fix them when practical.
