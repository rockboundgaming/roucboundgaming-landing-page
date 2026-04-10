# Security — Credential Inventory

This document lists every credential used by the Rockbound Gaming landing page, confirms its current storage method, and explains how to rotate it.

## Status Summary

| Credential | Service | Storage | Status |
|---|---|---|---|
| `TWITCH_CLIENT_ID` | Twitch Helix API | GitHub Actions Secret | ✅ Resolved — stored as secret, never hardcoded |
| `TWITCH_CLIENT_SECRET` | Twitch Helix API | GitHub Actions Secret | ✅ Resolved — stored as secret, never hardcoded |
| `DISCORD_GUILD_ID` | Discord Widget | Hardcoded (public ID) | ✅ Not sensitive — server IDs are public |
| Google Sheets `SHEET_ID` | Creator roster | Hardcoded (public URL) | ✅ Not sensitive — sheet is publicly published |

All passwords and secrets have been reviewed and are properly resolved.

---

## Credential Details

### Twitch API (`TWITCH_CLIENT_ID` / `TWITCH_CLIENT_SECRET`)

**Purpose:** The `.github/workflows/update-live-status.yml` workflow uses these credentials to obtain a short-lived OAuth token via the [Twitch Client Credentials flow](https://dev.twitch.tv/docs/authentication/getting-tokens-oauth/#client-credentials-grant-flow) and then queries the Helix Streams endpoint to determine which creators are live. The result is written to `live-status.json` every 2 minutes.

**Storage:** GitHub Actions repository secrets (`Settings → Secrets and variables → Actions`). They are never committed to the repository.

**How to rotate:**
1. Log in to the [Twitch Developer Console](https://dev.twitch.tv/console/apps) and regenerate the client secret for the `rockboundgaming` application.
2. In the GitHub repository go to **Settings → Secrets and variables → Actions**.
3. Update `TWITCH_CLIENT_ID` and/or `TWITCH_CLIENT_SECRET` with the new values.
4. Trigger the workflow manually (`Actions → Update Live Status → Run workflow`) to confirm it succeeds with the new credentials.

---

### Discord Guild ID (`DISCORD_GUILD_ID`)

**Purpose:** Populates the Discord online-members widget in the Community Hub section of the landing page. The value is the public server ID for the Rockbound Gaming Discord server.

**Storage:** Hardcoded in `js/main.js` as `const DISCORD_GUILD_ID`. This is **not** sensitive — Discord server IDs are publicly visible and the Widget API is a read-only, unauthenticated endpoint.

**How to update:** Edit the `DISCORD_GUILD_ID` constant in `js/main.js` (and `js/main.min.js`) with the new server ID. Ensure the Discord Server Widget is enabled under **Server Settings → Widget → Enable Server Widget**.

---

### Google Sheets ID (`SHEET_ID`)

**Purpose:** Fetches the creator roster (Twitch usernames, names, levels, featured flag, live status) from a publicly published Google Sheet.

**Storage:** Hardcoded in `js/main.js` as `const SHEET_ID`. This is **not** sensitive — the sheet is intentionally published for public read access via `docs.google.com/spreadsheets/d/e/…/pub`.

**How to update:** If the sheet URL changes, update the `SHEET_ID` constant in `js/main.js` (and `js/main.min.js`) with the new published-sheet ID segment.

---

## No Hardcoded Passwords

A full search of the repository confirms there are **no hardcoded passwords, API tokens, or private keys** in any committed file. All sensitive credentials are stored exclusively as GitHub Actions Secrets and injected at workflow runtime.
