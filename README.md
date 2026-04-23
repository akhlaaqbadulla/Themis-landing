# Themis Landing

Static landing site for Themis (AI legal research for Mauritius), served as a minimal container behind the shared Traefik proxy.

## Run

```bash
docker compose up -d --build
```

The image is built from `lipanski/docker-static-website` (BusyBox httpd, ~150 KB base) and listens on port 3000 inside the container. Traefik terminates TLS, applies the `secHeaders@file` and `gzip_compress@file` middlewares, and routes `Host(the-company.ai)` to it.

## Continuous deployment

Every push to `main` triggers `.github/workflows/deploy.yml` on the self-hosted runner on this server (`actions.runner.akhlaaqbadulla-Themis-landing.themis-landing-deploy.service`). The workflow: `git reset --hard $SHA` → `docker compose build` → `docker compose up -d --remove-orphans` → polls `https://the-company.ai` for a 200. End-to-end runtime ~20 s.

To (re)install the runner:

```bash
./scripts/setup-runner.sh
```

Idempotent — safe to re-run after a runner unregister, a repo rename, or a server reinstall. Needs `gh` authenticated as someone with admin on the repo.

To trigger a deploy without pushing:

```bash
gh workflow run deploy.yml
```

## Prerequisites (one-time)

The container joins the external Docker network `project-themis_themis_net` created by the Traefik compose at `/home/ubuntu/opt/traefik/`. Before `docker compose up`:

1. Stop the legacy standalone Caddy so it frees ports 80/443:
   ```bash
   cd /home/ubuntu/opt/caddy && docker compose down
   ```
2. Remove the duplicate inline `static-site` Caddy block in `/home/ubuntu/opt/traefik/docker-compose.yml` (it claims `Host(the-company.ai)` and would collide with this router), then:
   ```bash
   cd /home/ubuntu/opt/traefik && docker compose up -d
   ```
3. From this directory:
   ```bash
   docker compose up -d --build
   ```

Verify: `curl -I https://the-company.ai` returns `200` with HSTS and `Content-Encoding: gzip` from Traefik.

## Local preview (no Docker)

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

The script stages the output in `GatesWebP.new/`, verifies all 192 frames were produced, then swaps it in atomically (preserving the old frames at `GatesWebP.old-<timestamp>/` for rollback). After re-export:

```bash
docker compose build && docker compose up -d
```

## Pages

- `/` — main landing (`index.html`)
- `/about.html` — company
- `/workflows.html` — use cases
- `/why-themis.html` — value prop
- `/contact.html` — early access form

All pages share `style.css` and the glass-nav markup.
