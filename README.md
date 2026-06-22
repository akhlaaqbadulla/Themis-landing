# Themis Landing

Static landing site for Themis (AI legal research for Mauritius), deployed to GitHub Pages and served at [https://the-company.ai](https://the-company.ai).

## Continuous deployment

Every push to `main` triggers `.github/workflows/deploy.yml` on a GitHub-hosted runner. The workflow assembles a clean `dist/` (the HTML pages, `style.css`, images, and `GatesWebP/` frames — internal docs, scripts, and tooling are excluded) and publishes it to GitHub Pages via `actions/deploy-pages`. The site is served at the apex `the-company.ai` (custom domain pinned by the `CNAME` file).

To redeploy without pushing:

```bash
gh workflow run deploy.yml
```

Pages configuration (one-time, in repo **Settings → Pages**): Source = **GitHub Actions**, Custom domain = `the-company.ai`, **Enforce HTTPS** enabled. DNS for the apex points at GitHub Pages' IPs (`185.199.108–111.153`) via the registrar.

## Local preview

```bash
python3 -m http.server 8080
```

## Known follow-up: hero image sharpness on Retina

The `GatesWebP/` scrollytelling frames are currently 1280×720 (720p). On hi-DPI displays (MacBook Air 16", iPad Pro, etc.) the browser upscales them ~2× which softens the image. Code-side mitigations are already in place (16:9 aspect clamp on the canvas, `imageSmoothingQuality: 'high'`, no DPR cap on desktop), but the real fix is to re-export the 192 frames at **2560×1440 (preferred) or 3840×2160**, WebP quality ~82.

### Re-render script

Use the dockerised helper — it needs no host install of ffmpeg or cwebp:

```bash
# From an MP4 master:
./scripts/rerender-frames.sh /path/to/gates-olympus-master.mp4 1440

# Or from a folder of hi-res PNG frames (lexicographic order):
./scripts/rerender-frames.sh /path/to/source-frames/ 1440

# For 4K:
./scripts/rerender-frames.sh /path/to/source.mp4 2160
```

The script stages the output in `GatesWebP.new/`, verifies all 192 frames were produced, then swaps it in atomically (preserving the old frames at `GatesWebP.old-<timestamp>/` for rollback). After re-export, commit the new frames and push to `main` — the deploy workflow republishes them automatically.

## Pages

- `/` — main landing (`index.html`)
- `/about.html` — company
- `/workflows.html` — use cases
- `/why-themis.html` — value prop
- `/contact.html` — early access form

All pages share `style.css` and the glass-nav markup.
