# Rockbound Gaming — Landing Page

## Overview
Static GitHub Pages landing page for the Rockbound Gaming community. Stream live-status is provided by a scheduled GitHub Actions workflow that polls the Twitch Helix API every 2 minutes and writes `live-status.json`.

## Directory Structure

```
rockboundgaming-landing-page/
├── .github/
│   └── workflows/
│       └── update-live-status.yml   # Scheduled workflow: writes live-status.json
├── assets/                          # Images and logos
│   ├── images/
│   └── logos/
├── css/
│   ├── style.css                    # Main stylesheet
│   └── style.min.css                # Minified stylesheet (production)
├── js/
│   ├── main.js                      # Application logic (scroll, Twitch, Discord)
│   └── main.min.js                  # Minified JS (production)
├── index.html                       # Main landing page
├── live-status.json                 # Auto-updated by GitHub Actions workflow
├── manifest.json                    # PWA web-app manifest
├── sw.js                            # Service worker — offline / PWA support
├── sitemap.xml
└── README.md
```

## File Descriptions
- **assets/**: Static files (images, logos) used by the landing page.
- **css/style.css**: Main stylesheet controlling the appearance of the landing page.
- **css/style.min.css**: Minified version of `style.css` for production use.
- **js/main.js**: Application JavaScript — scroll animations, Twitch live-stream embeds, Discord online-member widget.
- **js/main.min.js**: Minified version of `main.js` for production use.
- **index.html**: Main HTML file for the landing page.
- **live-status.json**: Written every 2 minutes by the GitHub Actions workflow; consumed by `main.js` to display live stream badges without requiring client-side Twitch API credentials.
- **manifest.json**: PWA web-app manifest — enables "Add to Home Screen" / app install on supporting browsers and sets the theme colour.
- **sw.js**: Service worker — caches all static assets and CDN fonts on first visit so the page loads instantly and remains usable offline. `live-status.json` is fetched from the network first (falls back to the cached copy when offline).
- **README.md**: This file — project structure and setup documentation.

## Live Status
- The **Update Live Status** GitHub Actions workflow runs every **2 minutes** (`*/2`) and can also be run manually.
- Manual trigger path: **Actions → Update Live Status → Run workflow**.
- Workflow diagnostics now print:
  - `=== Channels queried ===` (full channel list sent to Helix)
  - `Helix returned N live streams: [...]` (raw `user_login` values from Twitch API)
- Client resilience: if `live-status.json` is unavailable or older than **30 minutes**, the page falls back to spreadsheet **Status (Live/Inactive)** for Featured Level 5+ creators and marks them as **`LIVE (unverified)`**.

## Offline / PWA Support
The site registers a service worker (`sw.js`) on first load. After that initial visit:
- All pages, styles, scripts, images, and CDN fonts are served from the browser cache, making repeat visits instant even without an internet connection.
- Live stream data (`live-status.json`) is always fetched from the network when available, and falls back to the last-known cached copy when offline.
- The `manifest.json` allows the page to be installed as a Progressive Web App (PWA) on desktop or mobile — look for the "Install" prompt in the browser address bar.

## Credentials & Secrets
All sensitive credentials are stored as **GitHub Actions Secrets** and are never committed to the repository. See [SECURITY.md](./SECURITY.md) for the full credential inventory and update instructions.
