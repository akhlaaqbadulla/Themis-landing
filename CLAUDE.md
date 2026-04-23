# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Themis is a static HTML/CSS/JS marketing site for an AI-powered legal research assistant targeting Mauritius law. No build tools, no package manager, no compilation step — edit files and open in a browser.

## Development

To preview locally, serve the directory with any static file server:
```bash
python3 -m http.server 8080
# or
npx serve .
```

There are no build, lint, or test commands.

## Architecture

**Multi-page static site** — each page is a self-contained HTML file sharing `style.css`.

| File | Purpose |
|------|---------|
| `index.html` | Main landing page (~1,500 lines): hero, scrollytelling, demo, workflows, pricing, FAQ |
| `why-themis.html` | ROI/value proposition and comparison vs generic AI |
| `workflows.html` | Use-case walkthroughs |
| `about.html` | Company story |
| `contact.html` | Early access / contact form |
| `style.css` | All shared styles (~540 lines) — single stylesheet for the whole site |

**GatesWebP/** — 192 sequenced WebP frames (`00001.webp`–`00192.webp`) driven by scroll position to create a 3D "Gates of Olympus" scrollytelling animation in `index.html`.

## Key Design Tokens (CSS variables)

- Primary dark: `#0d3d36` (teal green)
- Gold accent: `#D4AF37`
- Glass-morphism pattern: `backdrop-filter: blur(...)` with semi-transparent backgrounds
- Fonts: Inter (body), Outfit (headings) — loaded from Google Fonts CDN

## JavaScript / Animation

- **GSAP** (+ ScrollTrigger plugin) loaded via CDN — used for the loading screen fade and scroll-driven animations
- The scrollytelling sequence in `index.html` advances the WebP frame index as the user scrolls through a sticky section
- No other JS frameworks or libraries

## Content Reference

The `Prompts/` directory contains the original requirements documents used to build each section — useful context when modifying content or adding new sections.
