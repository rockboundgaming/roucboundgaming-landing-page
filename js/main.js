// ============================================
//   SCROLL ANIMATIONS WITH DEBOUNCE
// ============================================
const reveals = document.querySelectorAll('.reveal');

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

function reveal() {
  reveals.forEach(element => {
    const windowHeight = window.innerHeight;
    const revealTop = element.getBoundingClientRect().top;
    const revealPoint = 150;

    if (revealTop < windowHeight - revealPoint) {
      element.classList.add('visible');
    }
  });
}

window.addEventListener('scroll', debounce(reveal, 100));
reveal();

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

// How long (ms) the server-side status file is considered fresh.
// The GitHub Actions workflow runs every 5 minutes, so 10 minutes gives
// comfortable headroom before we fall back to the spreadsheet status column.
const LIVE_STATUS_MAX_AGE_MS = 10 * 60 * 1000;

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
    const rows = data.split("\n");

    const creators = rows.slice(1).map(row => {
      if (!row.trim()) return null;
      const cols = row.split("\t");
      const twitch = cols[0]?.trim()?.toLowerCase();
      return {
        twitch,
        name: NAME_OVERRIDES[twitch] || cols[1]?.trim(),
        level: parseInt(cols[2]),
        featured: cols[4]?.trim(),
        status: cols[5]?.trim()?.toLowerCase()
      };
    }).filter(c => c && c.twitch && c.name);

    // Build the set of server-confirmed live usernames from live-status.json.
    // Always populate from the file so the rockboundgaming priority check works
    // even when the file is older than LIVE_STATUS_MAX_AGE_MS.  The freshness
    // flag is only used later to decide whether to also trust the spreadsheet
    // status column as a fallback.
    const serverLiveUsernames = new Set();
    let serverDataIsFresh = false;
    if (liveStatus.lastChecked) {
      const ageMs = Date.now() - new Date(liveStatus.lastChecked).getTime();
      serverDataIsFresh = ageMs < LIVE_STATUS_MAX_AGE_MS;
    }
    for (const s of (liveStatus.live || [])) {
      if (s.twitch) serverLiveUsernames.add(s.twitch.toLowerCase());
    }

    // Build ordered list of live streams: rockboundgaming first (if live),
    // then all live L5+ featured creators, up to 4 total.
    const liveStreams = [];

    if (serverLiveUsernames.has(ROCKBOUND_CHANNEL)) {
      liveStreams.push({ twitch: ROCKBOUND_CHANNEL, name: 'Rockbound Gaming', level: null });
    }

    // Collect all live featured creators (excluding rockboundgaming), sorted by level desc.
    const liveCreators = creators.filter(c =>
      c.featured?.toLowerCase() === "yes" &&
      c.twitch !== ROCKBOUND_CHANNEL &&
      (serverLiveUsernames.has(c.twitch) ||
        (!serverDataIsFresh && (c.status === "live" || c.status === "active")))
    );
    liveCreators.sort((a, b) => b.level - a.level);
    liveStreams.push(...liveCreators);

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
    if (liveGrid) liveGrid.hidden = true;
    if (panel) panel.classList.remove('is-live');
    if (titleEl) titleEl.textContent = 'Rockbound Gaming';
    if (offlineContainer) {
      offlineContainer.hidden = false;
      offlineContainer.style.display = '';
    }
    setHubStream(ROCKBOUND_CHANNEL, 'Rockbound Gaming');
    return;
  }

  // Live streams present — hide offline player, show multi-stream grid.
  if (offlineContainer) offlineContainer.hidden = true;
  if (panel) panel.classList.add('is-live');

  const streams = liveStreams.slice(0, 4);
  const count = streams.length;

  if (titleEl) titleEl.textContent = 'Rockbound Gaming';

  // Avoid rebuilding the grid if the same channels are already displayed.
  const channelKey = streams.map(s => s.twitch).join(',');
  if (channelKey === currentGridChannels && liveGrid && !liveGrid.hidden) return;
  currentGridChannels = channelKey;

  if (!liveGrid) return;

  liveGrid.className = `stream-grid grid-${count}`;
  liveGrid.hidden = false;

  const hostname = window.location.hostname || 'localhost';
  const parentDomains = ['rockboundgaming.ca', 'www.rockboundgaming.ca'];
  if (hostname !== 'rockboundgaming.ca' && hostname !== 'www.rockboundgaming.ca') {
    parentDomains.push(hostname);
  }
  const parentParam = parentDomains.map(d => `parent=${encodeURIComponent(d)}`).join('&');

  liveGrid.innerHTML = streams.map(s => {
    const levelText = s.level ? ` - Level ${s.level}` : '';
    const streamUrl = `https://player.twitch.tv/?channel=${encodeURIComponent(s.twitch)}&${parentParam}&autoplay=true&muted=true`;
    return `
      <div class="stream-wrapper">
        <div class="streamer-header">
          <strong>${s.name || s.twitch}</strong>${levelText}
        </div>
        <div class="video-aspect-ratio">
          <iframe
            src="${streamUrl}"
            allowfullscreen
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            title="${s.name || s.twitch} live stream">
          </iframe>
        </div>
      </div>`;
  }).join('');
}

/**
 * Sets the active channel in the single-stream hub player (offline-player).
 * Destroys the existing Twitch.Player and creates a fresh one whenever
 * the channel name changes, avoiding 404 MasterPlaylist errors that occur
 * when the channel is swapped by mutating the iframe src directly.
 */
function setHubStream(channelName, displayName) {
  const container = document.getElementById('offline-player');
  const panel = document.getElementById('twitch-panel');
  const titleEl = document.getElementById('panel-stream-title');

  // Update the panel title and live indicator.
  if (titleEl) titleEl.textContent = displayName || 'Rockbound Gaming';
  if (panel) {
    if (channelName !== ROCKBOUND_CHANNEL) {
      panel.classList.add('is-live');
    } else {
      panel.classList.remove('is-live');
    }
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

  // Ensure the container is visible before initialising the player so the
  // browser does not block autoplay on a hidden element.
  container.hidden = false;
  container.style.display = '';

  // Tear down the previous player and reset the container.
  hubPlayer = null;
  container.innerHTML = '<div class="stream-loading" id="permanent-loading"><i class="fas fa-spinner fa-spin"></i><p>Loading stream...</p></div>';

  if (!window.Twitch || !window.Twitch.Player) {
    console.warn('Twitch.Player not yet available — channel queued for when script loads.');
    return;
  }

  const hostname = window.location.hostname || 'localhost';
  const parentDomains = ['rockboundgaming.ca', 'www.rockboundgaming.ca'];
  if (hostname !== 'rockboundgaming.ca' && hostname !== 'www.rockboundgaming.ca') parentDomains.push(hostname);

  // Create a uniquely-IDed mount point so Twitch.Player never confuses it
  // with a stale element from the previous session.
  const playerDivId = `hub-player-${Date.now()}`;
  const playerDiv = document.createElement('div');
  playerDiv.id = playerDivId;
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

      // If a featured creator's stream ends while the user is watching,
      // fall back to the main rockbound channel.
      if (channelName !== ROCKBOUND_CHANNEL) {
        hubPlayer.addEventListener(Twitch.Player.OFFLINE, () => {
          setHubStream(ROCKBOUND_CHANNEL, 'Rockbound Gaming');
        });
      }
    }
  } catch (e) {
    console.error('Hub player init error:', e);
  }
}

// ============================================
//   INITIALIZE
// ============================================
document.addEventListener('DOMContentLoaded', async () => {
  // 2-second fallback: if the hub player hasn't initialised yet, load the
  // default channel so the loading spinner doesn't spin forever.
  setTimeout(() => {
    const offlineEl = document.getElementById('offline-player');
    const loadingEl = document.getElementById('permanent-loading');
    if (loadingEl && offlineEl && !offlineEl.hidden && loadingEl.style.display !== 'none') {
      if (!hubCurrentChannel) updateLiveDisplay([]);
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

  await initTwitchScript();
  updateLiveDisplay([]);
  await loadFeaturedCreators();
  fetchDiscordMembers();
  initApplyButton();
});

// Re-check every 1 minute: preempts any active Level-5 stream back to rockbound
// the moment the main channel goes live, and handles streamers going offline.
setInterval(loadFeaturedCreators, 1 * 60 * 1000);
// Refresh Discord member list every 3 minutes
setInterval(fetchDiscordMembers, 3 * 60 * 1000);

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
    const avatarSrc = m.avatar_url || '/assets/logos/favcon.jpg';
    const game = m.game
      ? `<span class="member-game">${escapeHtml(m.game.name)}</span>`
      : '';
    return `
      <li class="discord-member-item">
        <div class="member-avatar-wrap">
          <img src="${avatarSrc}" alt="${escapeHtml(m.username)}" class="member-avatar" loading="lazy"
               onerror="this.src='/assets/logos/favcon.jpg'">
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
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    modal.hidden = true;
    document.body.style.overflow = '';
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
