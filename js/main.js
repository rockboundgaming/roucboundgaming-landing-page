// ============================================
//   SCROLL ANIMATIONS — IntersectionObserver
// ============================================
const reveals = document.querySelectorAll('.reveal');

if ('IntersectionObserver' in window) {
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });

  reveals.forEach(el => revealObserver.observe(el));
} else {
  // Fallback for very old browsers
  reveals.forEach(el => el.classList.add('visible'));
}

// ============================================
//   NAV SCROLL EFFECT WITH THROTTLE
// ============================================
const nav = document.querySelector('nav');
let ticking = false;

function updateNav() {
  if (window.scrollY > 100) {
    nav.classList.add('scrolled');
  } else {
    nav.classList.remove('scrolled');
  }
  ticking = false;
}

window.addEventListener('scroll', () => {
  if (!ticking) {
    window.requestAnimationFrame(updateNav);
    ticking = true;
  }
});

// ============================================
//   MOBILE MENU TOGGLE
// ============================================
const menuToggle = document.querySelector('.menu-toggle');
const navLinks = document.querySelector('.nav-links');

if (menuToggle && navLinks) {
  menuToggle.addEventListener('click', () => {
    const isActive = navLinks.classList.toggle('active');
    menuToggle.setAttribute('aria-expanded', String(isActive));
    menuToggle.setAttribute('aria-label', isActive ? 'Close navigation menu' : 'Open navigation menu');
  });

  navLinks.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      navLinks.classList.remove('active');
      menuToggle.setAttribute('aria-expanded', 'false');
      menuToggle.setAttribute('aria-label', 'Open navigation menu');
    });
  });
}

// ============================================
//   SMOOTH SCROLL FOR ANCHOR LINKS
// ============================================
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function (e) {
    const href = this.getAttribute('href');
    if (href === '#') return;
    
    e.preventDefault();
    const target = document.querySelector(href);
    if (target) {
      target.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    }
  });
});

// ============================================
//   TWITCH LIVE STREAMS
// ============================================
const SHEET_ID = "2PACX-1vQR_A_KNK2zWNAYiT-a3baVWUSt8-_SE83gnyt4rOLDRruj0E-SVg4ej8-JnxaMuD0AxIYt6roaKJsg";

// Single-stream hub state (used only for the offline-player)
let hubCurrentChannel = null;  // The channel name currently loaded in the hub player
let hubPlayer = null;          // The active Twitch.Player instance
let currentGridChannels = '';  // Comma-joined channel list of the last grid build

// The primary channel that is permanently embedded (24/7).
const ROCKBOUND_CHANNEL = "rockboundgaming";

// Correct display names for creators whose spreadsheet entries have typos.
const NAME_OVERRIDES = {};

// ============================================
//   DISCORD WIDGET
// ============================================
// To show online Discord members:
//   1. In your Discord server go to Server Settings → Widget → Enable Server Widget.
//   2. Copy the Server ID shown on that same page (or from Server Settings → Overview).
//   3. Paste it below.
const DISCORD_GUILD_ID = "1482393227146559518"; // Rockbound Gaming Discord server

// Fetch the server-generated live-status.json produced by the GitHub Actions
// workflow that calls the Twitch Helix API server-side.
async function fetchLiveStatus() {
  try {
    const response = await fetch(`/live-status.json?cb=${Date.now()}`);
    if (!response.ok) return { live: [], lastChecked: null };
    return await response.json();
  } catch (e) {
    console.warn('Could not fetch live-status.json:', e);
    return { live: [], lastChecked: null };
  }
}

// Load Twitch script once at startup
function initTwitchScript() {
  return new Promise((resolve) => {
    if (window.Twitch && window.Twitch.Player) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://player.twitch.tv/js/embed/v1.js';
    script.async = true;
    script.onload = () => { resolve(); };
    script.onerror = () => {
      console.error('Failed to load Twitch script');
      resolve();
    };
    document.body.appendChild(script);
  });
}

async function loadFeaturedCreators() {
  const url = `https://docs.google.com/spreadsheets/d/e/${SHEET_ID}/pub?output=tsv&cb=${Date.now()}`;

  try {
    // Fetch the spreadsheet and the server-side live-status.json in parallel.
    const [response, liveStatus] = await Promise.all([
      fetch(url),
      fetchLiveStatus()
    ]);

    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

    const data = await response.text();
    const rows = data.split(/\r?\n/);

    const creators = rows.slice(1).map(row => {
      if (!row.trim()) return null;
      const cols = row.split("\t").map(col => col.trim().replace(/\r/g, ''));
      const twitch = cols[0]?.trim()?.toLowerCase();
      const level = parseInt(cols[2], 10);
      return {
        twitch,
        name: NAME_OVERRIDES[twitch] || cols[1]?.trim(),
        level: Number.isFinite(level) ? level : null,
        featured: cols[4]?.trim()
      };
    }).filter(c => c && c.twitch && c.name);

    const serverLive = Array.isArray(liveStatus?.live) ? liveStatus.live : [];
    const activeLiveUsernames = new Set();
    for (const s of serverLive) {
      if (s.twitch) activeLiveUsernames.add(s.twitch.toLowerCase());
    }

    // Collect all live featured creators (excluding rockboundgaming), sorted by level desc.
    const liveCreators = creators.filter(c =>
      c.featured?.toLowerCase() === "yes" &&
      c.level >= 5 &&
      c.twitch !== ROCKBOUND_CHANNEL &&
      activeLiveUsernames.has(c.twitch)
    );
    liveCreators.sort((a, b) => b.level - a.level);

    const rockboundIsLive = activeLiveUsernames.has(ROCKBOUND_CHANNEL);

    // If other creators are live, they replace the offline placeholder.
    // Only prepend rockboundgaming when it is confirmed live.
    const liveStreams = [];
    if (liveCreators.length > 0) {
      // Other creators are live — hide the offline placeholder and show only them.
      // Prepend rockboundgaming if it is also confirmed live.
      if (rockboundIsLive) {
        liveStreams.push({ twitch: ROCKBOUND_CHANNEL, name: 'Rockbound Gaming', level: null });
      }
      liveStreams.push(...liveCreators);
    } else if (rockboundIsLive) {
      // Only rockboundgaming is live.
      liveStreams.push({ twitch: ROCKBOUND_CHANNEL, name: 'Rockbound Gaming', level: null });
    }
    // If liveStreams is empty, updateLiveDisplay shows the offline placeholder.

    updateLiveDisplay(liveStreams);
  } catch (err) {
    console.error("Error loading creators:", err);
    updateLiveDisplay([]);
  }
}

// ============================================
//   SINGLE-STREAM HUB
// ============================================

/**
 * Restores the custom branded offline card inside #offline-player.
 * Called whenever nobody is live; avoids showing a Twitch loading spinner
 * or Twitch's own generic offline screen.
 */
function showOfflineCard() {
  const container = document.getElementById('offline-player');
  const panel = document.getElementById('twitch-panel');
  const titleEl = document.getElementById('panel-stream-title');

  hubPlayer = null;
  hubCurrentChannel = null;

  if (titleEl) titleEl.textContent = 'Rockbound Gaming';
  if (panel) panel.classList.remove('is-live');

  if (!container) return;

  container.style.display = 'flex';
  container.hidden = false;

  // Idempotent: if the offline placeholder is already mounted, leave the
  // existing DOM untouched. Background live-status polls run every few
  // minutes; rewriting innerHTML each cycle would restart the
  // `offlineBadgePulse` animation and cause a visible "hard reset" of the
  // offline logo / badge. Only build the card when it's not already there.
  if (container.querySelector('.offline-placeholder')) {
    requestAnimationFrame(syncDiscordHeight);
    return;
  }

  container.innerHTML =
    '<div class="offline-placeholder">' +
      '<picture>' +
        '<img src="/assets/logos/newlogo.png" alt="Rockbound Gaming" class="offline-logo">' +
      '</picture>' +
      '<div class="offline-text">' +
        '<span class="offline-badge">OFFLINE</span>' +
        '<p>Built on the Rock. Gaming Everywhere.</p>' +
      '</div>' +
      '<a href="https://www.twitch.tv/rockboundgaming" target="_blank" rel="noopener noreferrer" class="btn-primary offline-cta">' +
        '<i class="fab fa-twitch"></i>&nbsp; Follow on Twitch' +
      '</a>' +
    '</div>';
  requestAnimationFrame(syncDiscordHeight);
}

// ============================================
//   DISCORD / TWITCH HEIGHT SYNC
// ============================================
/**
 * Sets the Discord panel height to exactly match the rendered height of the
 * Twitch panel on desktop (> 768 px). On mobile the inline style is cleared so
 * CSS stacking rules take over.
 */
function syncDiscordHeight() {
  const twitchPanel = document.getElementById('twitch-panel');
  const discordPanel = document.querySelector('.discord-panel');
  if (!twitchPanel || !discordPanel) return;
  if (window.innerWidth > 768) {
    discordPanel.style.height = twitchPanel.offsetHeight + 'px';
    discordPanel.style.maxHeight = twitchPanel.offsetHeight + 'px';
  } else {
    discordPanel.style.height = '';
    discordPanel.style.maxHeight = '';
  }
}

/**
 * Shows the multi-stream live grid when one or more creators are live,
 * or falls back to the single-channel offline player when nobody is live.
 *
 * @param {Array<{twitch: string, name: string, level: number|null}>} liveStreams
 *   Ordered list of live streams (rockboundgaming first if live, then L5+ creators).
 *   Only the first 4 are shown.
 */
function updateLiveDisplay(liveStreams) {
  const offlineContainer = document.getElementById('offline-player');
  const liveGrid = document.getElementById('live-streams-grid');
  const panel = document.getElementById('twitch-panel');
  const titleEl = document.getElementById('panel-stream-title');

  if (!liveStreams || liveStreams.length === 0) {
    // Nobody live — show the single offline player for rockboundgaming.
    if (liveGrid) {
      // Use style.display = 'none' so inline style beats any CSS class rule
      // (e.g. `.stream-grid.grid-1 { display: block }` has higher specificity
      // than `.stream-grid { display: none }` and would override [hidden]).
      liveGrid.style.display = 'none';
      liveGrid.hidden = true;
      liveGrid.innerHTML = '';
      currentGridChannels = '';
    }
    if (panel) panel.classList.remove('is-live');
    if (titleEl) titleEl.textContent = 'Rockbound Gaming';
    showOfflineCard();
    return;
  }

  // When rockboundgaming is the sole "live" stream, use setHubStream instead
  // of a raw iframe grid. The Twitch.Player SDK can detect OFFLINE events and
  // gracefully fall back to the custom offline card — raw iframes cannot, which
  // causes a "double player" (our LIVE badge + Twitch's own offline/VOD screen)
  // and MasterPlaylist 404 errors when live-status.json is stale.
  if (liveStreams.length === 1 && liveStreams[0].twitch === ROCKBOUND_CHANNEL) {
    if (liveGrid) {
      liveGrid.style.display = 'none';
      liveGrid.hidden = true;
      liveGrid.innerHTML = '';
      currentGridChannels = '';
    }
    setHubStream(ROCKBOUND_CHANNEL, 'Rockbound Gaming');
    return;
  }

  // Live streams present — force-hide offline player, show multi-stream grid.
  // style.display = 'none' beats any CSS rule (e.g. the `display: flex` on #offline-player).
  if (offlineContainer) offlineContainer.style.display = 'none';
  if (panel) panel.classList.add('is-live');

  // Leaving the single-stream hub: drop the player reference so a future
  // hub-mode transition rebuilds cleanly instead of trusting stale state.
  hubPlayer = null;
  hubCurrentChannel = null;

  // Ensure the section is fully visible so Twitch embeds pass the autoplay
  // "style visibility" check (the .reveal class starts with opacity: 0).
  const liveSection = document.getElementById('live');
  if (liveSection) liveSection.classList.add('visible');

  const streams = liveStreams.slice(0, 4);
  const count = streams.length;

  if (titleEl) titleEl.textContent = 'Rockbound Gaming';

  // Avoid rebuilding the grid if the same channels are already displayed.
  const channelKey = streams.map(s => s.twitch).join(',');
  if (channelKey === currentGridChannels && liveGrid && liveGrid.style.display !== 'none') return;
  currentGridChannels = channelKey;

  if (!liveGrid) return;

  liveGrid.className = `stream-grid grid-${count}`;
  // Remove any leftover inline style so CSS (including mobile media queries) controls display.
  liveGrid.style.display = '';
  liveGrid.hidden = false;

  const hostname = window.location.hostname || 'localhost';
  const parentDomains = ['rockboundgaming.ca', 'www.rockboundgaming.ca'];
  if (hostname !== 'rockboundgaming.ca' && hostname !== 'www.rockboundgaming.ca') {
    parentDomains.push(hostname);
  }
  const parentParam = parentDomains.map(d => `parent=${encodeURIComponent(d)}`).join('&');

  function buildGrid() {
    liveGrid.innerHTML = streams.map(s => {
      const levelText = s.level ? ` - Level ${s.level}` : '';
      const streamUrl = `https://player.twitch.tv/?channel=${encodeURIComponent(s.twitch)}&${parentParam}&autoplay=true&muted=true`;
      return `
        <div class="stream-wrapper">
          <div class="streamer-header">
            <strong>${escapeHtml(s.name || s.twitch)}</strong>${escapeHtml(levelText)}<span class="live-badge" aria-label="LIVE"><span aria-hidden="true">&#x25CF;</span> LIVE</span>
          </div>
          <div class="video-aspect-ratio">
            <iframe
              src="${streamUrl}"
              allowfullscreen
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              title="${escapeHtml(s.name || s.twitch)} live stream">
            </iframe>
          </div>
        </div>`;
    }).join('');
    requestAnimationFrame(syncDiscordHeight);
  }

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const existingWrappers = liveGrid.querySelectorAll('.stream-wrapper');

  if (!prefersReducedMotion && existingWrappers.length > 0) {
    existingWrappers.forEach(el => el.classList.add('stream-exit'));
    setTimeout(buildGrid, 300);
  } else {
    buildGrid();
  }
}

/**
 * Sets the active channel in the single-stream hub player (offline-player).
 * Destroys the existing Twitch.Player and creates a fresh one whenever
 * the channel name changes, avoiding 404 MasterPlaylist errors that occur
 * when the channel is swapped by mutating the iframe src directly.
 */
async function setHubStream(channelName, displayName) {
  const container = document.getElementById('offline-player');
  const panel = document.getElementById('twitch-panel');
  const titleEl = document.getElementById('panel-stream-title');

  // Update the panel title and live indicator.
  if (titleEl) titleEl.textContent = displayName || 'Rockbound Gaming';
  if (panel) panel.classList.add('is-live');

  // Hide the live grid when switching to the single-stream hub player so the
  // two display modes don't overlap.
  const liveGrid = document.getElementById('live-streams-grid');
  if (liveGrid) {
    liveGrid.style.display = 'none';
    liveGrid.hidden = true;
    liveGrid.innerHTML = '';
  }

  // No channel change — but verify the player's internal state hasn't drifted.
  if (channelName === hubCurrentChannel) {
    if (hubPlayer) {
      try {
        const actual = hubPlayer.getChannel();
        if (actual && actual.toLowerCase() !== channelName.toLowerCase()) {
          console.log(`Forcing embed swap: ${actual} -> ${channelName}`);
          hubPlayer.setChannel(channelName);
        }
      } catch (e) { /* getChannel() not available on all player versions */ }
    }
    return;
  }
  hubCurrentChannel = channelName;

  if (!container) return;

  // Ensure the section is fully visible before creating the player.
  // The #live section starts with .reveal (opacity: 0) for scroll animation;
  // Twitch's embed SDK blocks autoplay when the element fails its "style
  // visibility" check, cascading into MasterPlaylist 404 errors.
  const liveSection = container.closest('.reveal') || document.getElementById('live');
  if (liveSection) liveSection.classList.add('visible');

  // Ensure the container is visible before initialising the player so the
  // browser does not block autoplay on a hidden element.
  container.hidden = false;
  container.style.display = 'flex';

  // Tear down the previous player and reset the container.
  hubPlayer = null;
  container.innerHTML = '<div class="stream-loading" id="permanent-loading"><i class="fas fa-spinner fa-spin"></i><p>Loading stream...</p></div>';

  // Lazily load the Twitch SDK only when we actually need a player.
  await initTwitchScript();

  if (!window.Twitch || !window.Twitch.Player) {
    console.warn('Twitch.Player not available.');
    return;
  }

  const hostname = window.location.hostname || 'localhost';
  const parentDomains = ['rockboundgaming.ca', 'www.rockboundgaming.ca'];
  if (hostname !== 'rockboundgaming.ca' && hostname !== 'www.rockboundgaming.ca') parentDomains.push(hostname);

  // Create a uniquely-IDed mount point so Twitch.Player never confuses it
  // with a stale element from the previous session.  Use absolute positioning
  // so the div reliably fills the aspect-ratio container (#offline-player)
  // — a flex child with height:100% can resolve to 0 in some browsers when
  // the parent's height comes from aspect-ratio rather than an explicit value.
  const playerDivId = `hub-player-${Date.now()}`;
  const playerDiv = document.createElement('div');
  playerDiv.id = playerDivId;
  playerDiv.style.position = 'absolute';
  playerDiv.style.top = '0';
  playerDiv.style.left = '0';
  playerDiv.style.width = '100%';
  playerDiv.style.height = '100%';
  container.appendChild(playerDiv);

  try {
    hubPlayer = new Twitch.Player(playerDivId, {
      channel: channelName,
      width: '100%',
      height: '100%',
      parent: parentDomains,
      autoplay: true,
      muted: true
    });

    // Inject the permissions policy required by modern browsers so that
    // autoplay and other features are not silently blocked.
    setTimeout(() => {
      const iframe = container.querySelector('iframe');
      if (iframe) {
        iframe.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture');
      }
      const loading = document.getElementById('permanent-loading');
      if (loading) loading.style.display = 'none';
    }, 800);

    if (hubPlayer.addEventListener) {
      hubPlayer.addEventListener(Twitch.Player.ONLINE, () => {
        const loading = document.getElementById('permanent-loading');
        if (loading) loading.style.display = 'none';
      });

      // If the stream ends or was never actually live (stale live-status.json),
      // fall back to the custom offline card. This covers both rockboundgaming
      // and featured creators, preventing the Twitch "double player" offline
      // screen with VOD suggestions.
      hubPlayer.addEventListener(Twitch.Player.OFFLINE, () => {
        showOfflineCard();
      });
    }
  } catch (e) {
    console.error('Hub player init error:', e);
  }
  requestAnimationFrame(syncDiscordHeight);
}

// ============================================
//   INITIALIZE
// ============================================
document.addEventListener('DOMContentLoaded', async () => {
  // 2-second fallback: ensure the offline card is shown if loadFeaturedCreators
  // hasn't resolved yet and nothing else is already displaying.
  setTimeout(() => {
    const liveGrid = document.getElementById('live-streams-grid');
    // Only trigger if the live grid is NOT already showing
    const liveGridIsVisible = liveGrid && liveGrid.childElementCount > 0 && liveGrid.style.display !== 'none' && !liveGrid.hidden;
    if (!liveGridIsVisible && !hubCurrentChannel) {
      updateLiveDisplay([]);
    }
    const discordList = document.getElementById('discord-members-list');
    if (discordList && discordList.querySelector('.discord-loading-item')) {
      discordList.innerHTML = `
        <li class="discord-fallback-item">
          <a href="https://discord.gg/SsrHttHX8n" target="_blank" rel="noopener noreferrer" class="btn-primary">
            <i class="fab fa-discord"></i>&nbsp; Join our Discord
          </a>
        </li>`;
    }
  }, 2000);

  // Load dynamic stats from site-data.json
  fetch('/site-data.json')
    .then(r => r.json())
    .then(data => {
      if (data && data.stats) {
        const membersEl = document.getElementById('stat-members');
        const followersEl = document.getElementById('stat-followers');
        if (membersEl && data.stats.members) membersEl.textContent = data.stats.members;
        if (followersEl && data.stats.followers) followersEl.textContent = data.stats.followers;
      }
    })
    .catch(e => console.warn('Could not load site-data.json:', e));

  updateLiveDisplay([]);
  await loadFeaturedCreators();
  fetchDiscordMembers();
  initApplyButton();
});

// Re-check every 3 minutes: matches the GitHub Actions live-status.json refresh cadence
// and reduces unnecessary mobile data usage vs the previous 60-second interval.
setInterval(loadFeaturedCreators, 3 * 60 * 1000);
// Refresh Discord member list every 3 minutes
setInterval(fetchDiscordMembers, 3 * 60 * 1000);

// Sync Discord panel height to Twitch panel on resize (debounced)
let _discordSyncTimer;
window.addEventListener('resize', function() {
  clearTimeout(_discordSyncTimer);
  _discordSyncTimer = setTimeout(syncDiscordHeight, 150);
});

// Initial height sync after the player has had a chance to render
requestAnimationFrame(function() {
  setTimeout(syncDiscordHeight, 300);
});

// ============================================
//   DISCORD ONLINE MEMBERS
// ============================================
async function fetchDiscordMembers() {
  const list = document.getElementById('discord-members-list');
  if (!list) return;

  if (!DISCORD_GUILD_ID) {
    list.innerHTML = `
      <li class="discord-empty-item">
        <i class="fab fa-discord" style="font-size:1.4rem;color:rgba(230,57,70,0.5);"></i>
        <span>Add your Discord Server ID to show online members.</span>
      </li>`;
    return;
  }

  try {
    const res = await fetch(`https://discord.com/api/guilds/${DISCORD_GUILD_ID}/widget.json`);
    if (!res.ok) {
      list.innerHTML = `
        <li class="discord-empty-item">
          <i class="fab fa-discord" style="font-size:1.4rem;color:rgba(230,57,70,0.5);"></i>
          <span>Enable the Server Widget in Discord settings to show members here.</span>
        </li>`;
      return;
    }
    const data = await res.json();
    renderDiscordMembers(data.members || [], data.presence_count || 0);
  } catch (e) {
    console.warn('Discord widget fetch failed:', e);
  }
}

function renderDiscordMembers(members, count) {
  const list = document.getElementById('discord-members-list');
  const countEl = document.getElementById('discord-online-count');
  if (!list) return;

  // Filter out bots: explicit bot flag, known bot usernames, or "bot" in name.
  const KNOWN_BOTS = ['carl-bot', 'mee6', 'dyno', 'groovy', 'rhythm', 'rythm', 'fredboat', 'nightbot', 'streamelements', 'streamlabs', 'appy', 'arcane', 'jockie music'];
  const humanMembers = members.filter(m => {
    if (m.bot === true) return false;
    const nameLower = m.username.toLowerCase();
    if (KNOWN_BOTS.some(bot => nameLower.includes(bot))) return false;
    if (/\bbot\b/.test(nameLower)) return false;
    return true;
  });

  if (countEl) {
    countEl.textContent = humanMembers.length > 0 ? `${humanMembers.length} online` : '';
  }

  if (humanMembers.length === 0) {
    list.innerHTML = `
      <li class="discord-empty-item">
        <i class="fab fa-discord" style="font-size:1.4rem;color:rgba(230,57,70,0.5);"></i>
        <span>No members visible right now</span>
      </li>`;
    return;
  }

  // Sort: online → idle → dnd
  const order = { online: 0, idle: 1, dnd: 2 };
  humanMembers.sort((a, b) => (order[a.status] ?? 3) - (order[b.status] ?? 3));

  list.innerHTML = humanMembers.map(m => {
    const avatarSrc = m.avatar_url || '/assets/logos/favicon.jpg';
    const game = m.game
      ? `<span class="member-game">${escapeHtml(m.game.name)}</span>`
      : '';
    return `
      <li class="discord-member-item">
        <div class="member-avatar-wrap">
          <img src="${avatarSrc}" alt="${escapeHtml(m.username)}" class="member-avatar" loading="lazy"
               onerror="this.src='/assets/logos/favicon.jpg'">
          <span class="member-status-dot status-${m.status}" title="${m.status}"></span>
        </div>
        <div class="member-info">
          <span class="member-name">${escapeHtml(m.username)}</span>
          ${game}
        </div>
      </li>`;
  }).join('');
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ============================================
//   CREATOR NETWORK APPLICATION FORM
// ============================================
// Discord webhook URL (obfuscated to reduce casual exposure in page source).
const _wParts = [
  'aHR0cHM6Ly9kaXNjb3JkLmNvbS9hcGkvd2ViaG9va3MvMTQ5MzI5NDM3NjA4MjczNTE4',
  'NQ==',
  '/8HBvNdge7aGej7rsfSsTfnK5kOh1YLCX7eNVE3NGfSpjhzdtklqARqdIhSxjj5UYBcK4'
];
const CREATOR_APPLICATION_WEBHOOK = atob(_wParts[0] + _wParts[1]) + _wParts[2];

(function initCreatorForm() {
  const form = document.getElementById('creator-application-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const statusEl = document.getElementById('creator-form-status');
    const submitBtn = form.querySelector('button[type="submit"]');

    // Honeypot check — bots fill this hidden field; real users don't.
    const honeypot = form.elements['website'] ? form.elements['website'].value : '';
    if (honeypot) return; // silently drop the submission

    const gamertag = form.elements['gamertag'].value.trim();
    const platform = form.elements['platform'].value;
    const games    = form.elements['games'].value.trim();

    if (!gamertag || !platform || !games) {
      showFormStatus(statusEl, 'error', 'Please fill in all fields.');
      return;
    }

    // Checkbox CAPTCHA verification
    const captchaCheck = document.getElementById('creator-captcha-check');
    if (!captchaCheck || !captchaCheck.checked) {
      showFormStatus(statusEl, 'error', 'Please confirm you are not a robot.');
      return;
    }

    if (!CREATOR_APPLICATION_WEBHOOK) {
      showFormStatus(statusEl, 'error', 'Applications not yet configured. Join our Discord to apply directly!');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending…';

    try {
      const payload = {
        thread_name: `Application: ${gamertag}`,
        content: `**New Creator Application**\n**Gamer tag/Discord name:** ${gamertag}\n**Platform:** ${platform}\n**Games:** ${games}`
      };

      const res = await fetch(CREATOR_APPLICATION_WEBHOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      // Discord returns 204 No Content on success
      if (res.ok || res.status === 204) {
        const successScreen = document.getElementById('creator-apply-success');
        form.style.display = 'none';
        if (successScreen) successScreen.hidden = false;
      } else {
        const errBody = await res.text().catch(() => '');
        console.error('Discord webhook error:', res.status, errBody);
        throw new Error(`HTTP ${res.status}`);
      }
    } catch (err) {
      console.error('Creator form error:', err);
      showFormStatus(statusEl, 'error', 'Something went wrong — please try again or join our Discord directly.');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Send';
    }
  });
}());

function showFormStatus(el, type, message) {
  if (!el) return;
  if (type === 'success') {
    el.innerHTML = message;
  } else {
    el.textContent = message;
  }
  el.className = `creator-form-status ${type}`;
  el.hidden = false;
  setTimeout(() => { el.hidden = true; }, 8000);
}

// ============================================
//   APPLY TO BE A CREATOR — MODAL
// ============================================
function initApplyButton() {
  const modal = document.getElementById('creator-modal');
  const closeBtn = document.getElementById('creator-modal-close');
  if (!modal) return;

  function openModal() {
    modal.hidden = false;
    document.body.classList.add('modal-open');
  }

  function closeModal() {
    modal.hidden = true;
    document.body.classList.remove('modal-open');
    // Reset form / success-screen state for next open
    const form = document.getElementById('creator-application-form');
    const successScreen = document.getElementById('creator-apply-success');
    const captchaCheck = document.getElementById('creator-captcha-check');
    const successCheck = document.getElementById('success-confirm-check');
    const closeSuccessBtn = document.getElementById('success-close-btn');
    if (form) { form.style.display = ''; form.reset(); }
    if (captchaCheck) captchaCheck.checked = false;
    if (successCheck) successCheck.checked = false;
    if (closeSuccessBtn) closeSuccessBtn.disabled = true;
    if (successScreen) successScreen.hidden = true;
    const statusEl = document.getElementById('creator-form-status');
    if (statusEl) statusEl.hidden = true;
  }

  // Wire up the success-screen confirm checkbox and close button.
  const successCheck = document.getElementById('success-confirm-check');
  const closeSuccessBtn = document.getElementById('success-close-btn');
  if (successCheck && closeSuccessBtn) {
    successCheck.addEventListener('change', () => {
      closeSuccessBtn.disabled = !successCheck.checked;
    });
    closeSuccessBtn.addEventListener('click', closeModal);
  }

  // "Apply To Be A Creator" button in the live section opens the modal.
  const liveCtaBtn = document.getElementById('live-cta-apply-btn');
  if (liveCtaBtn) {
    liveCtaBtn.addEventListener('click', openModal);
  }

  // Close on X button click.
  if (closeBtn) {
    closeBtn.addEventListener('click', closeModal);
  }

  // Close on overlay (backdrop) click.
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  // Close on Escape key.
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modal.hidden) closeModal();
  });
}
