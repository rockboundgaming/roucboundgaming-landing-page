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
- **README.md**: This file — project structure and setup documentation.

## Credentials & Secrets
All sensitive credentials are stored as **GitHub Actions Secrets** and are never committed to the repository. See [SECURITY.md](./SECURITY.md) for the full credential inventory and update instructions.