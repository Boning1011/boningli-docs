# Boning Li Docs - Claude Code Instructions

## Project Overview

This is a technical documentation repository for procedural/Houdini tech notes and longer guides. The site is built with Docusaurus (classic preset), written in Markdown, and published at https://docs.boningli.com.

**Why this repo exists:**
- Keep all Houdini/VFX guides and quick notes in one Git-backed place
- Easy to paste screenshots, attach example files, and keep links stable
- Publish a fast, static site with no CMS lock-in

## Hosting & Domain

- **Static hosting**: GitHub Pages via CI (automated deployment on push)
- **Domain**: `docs.boningli.com` - CNAME from Squarespace DNS → GitHub Pages
- **Main site**: Portfolio stays on Squarespace; this subdomain is docs only

## Tech Stack

**Docusaurus (classic preset)**
- **Docs**: Long-form guides (multi-page)
- **Blog**: Short tricks/notes with card previews on blog index
- **Markdown**: All content with local assets (images/video in `./img` next to each page)

## Content Structure

```
/docs                  # Long-form guides
  /guides
    /render-farm
      index.md
      01-hardware.md
      02-os-config.md
      img/...
/blog                  # Short, single-page notes (cards on blog index)
  2025-10-xx-cops-rasterize-setup.md
/static                # Site-wide static assets if needed
/downloads             # HIP/HDA/ZIP for readers (small files)
                       # For large files → use Releases/Git LFS
```

## Authoring Workflow

### Daily Content Capture

1. **In VS Code**: Use a "paste image" helper so Ctrl/Cmd+V saves to `./img` beside the `.md`
2. **Alternative**: Write in Obsidian pointing at this repo (attachments → `img` under current folder)

### Content Types

**Long guides** → `/docs/guides/<topic>/...`
- Use `index.md` + numbered subpages (e.g., `01-hardware.md`, `02-os-config.md`)
- Include images in `./img` subdirectory

**Short notes** → `/blog/yyyy-mm-dd-title.md`
- Use front-matter with title, tags, and thumbnail image
- Example:
```markdown
---
title: COPS Rasterize Setup
tags: [Houdini, COPS]
image: ./img/thumb.jpg   # Shows on blog card
---
```

### Deployment

- **Commit → push**: CI builds and deploys automatically to GitHub Pages
- No manual deployment steps required

## Commands

```bash
npm i                  # Install dependencies
npm run start          # Local dev server at http://localhost:3000
npm run build          # Build static site to /build
```

## Front-matter Quick Reference

### Docs Pages

Put at the top of each doc page for nice URLs/sidebar:

```yaml
---
id: render-farm-linux
title: Houdini Linux Render Farm Setup
slug: /guides/render-farm-linux
sidebar_label: Render Farm (Linux)
sidebar_position: 1
---
```

### Blog Posts

```yaml
---
title: COPS Rasterize Setup
tags: [Houdini, COPS]
image: ./img/thumb.jpg
---
```

## Media & Downloads

- **Video format**: Prefer MP4/WebM over GIF for loops (smaller, clearer)
- **Page images**: Keep images next to the page in `./img` subdirectory
- **Example files**: Store in `/downloads/<topic>/...`
- **Large files**: If >100 MB or changing often, use Git LFS or link a GitHub Release

## Conventions

- **Filenames**: kebab-case.md, no spaces (e.g., `houdini-linux-render-farm-setup.md`)
- **Content focus**: One main idea per note; first H1 = page title
- **Style**: Use short intros + numbered steps; code fences for snippets
- **Images**: Always use relative paths (e.g., `./img/screenshot.png`)

## Roadmap

- Add Algolia DocSearch (optional search functionality)
- Add tags page for notes
- Consider versioned docs if needed for Houdini/Karma versions

## Current Configuration

- **URL**: Currently set to `https://your-docusaurus-site.example.com` (needs update to `https://docs.boningli.com`)
- **GitHub info**: Currently placeholder (needs update to actual repo)
- **Title**: "Boning Li Docs"
- **Tagline**: "Technical Documentation & Guides"

## When Assisting with This Repo

1. **New docs**: Always ask whether content should go in `/docs` (long guide) or `/blog` (short note)
2. **Images**: Assume images are in `./img` relative to the markdown file
3. **Front-matter**: Always include appropriate front-matter for docs or blog posts
4. **File naming**: Use kebab-case, include date prefix for blog posts (yyyy-mm-dd-title.md)
5. **Links**: Use relative paths for internal links; absolute paths for external
6. **Code blocks**: Always specify language for syntax highlighting
