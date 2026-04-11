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
    navLinks.classList.toggle('active');
  });

  navLinks.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      navLinks.classList.remove('active');
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
let activePlayers = new Map();
let lastLiveUsernames = new Set();
let recentlyRemoved = new Map(); // username -> removal timestamp
const SHEET_ID = "2PACX-1vQR_A_KNK2zWNAYiT-a3baVWUSt8-_SE83gnyt4rOLDRruj0E-SVg4ej8-JnxaMuD0AxIYt6roaKJsg";

// The primary channel that is permanently embedded (24/7).
const ROCKBOUND_CHANNEL = "rockboundgaming";

// Correct display names for creators whose spreadsheet entries have typos.
const NAME_OVERRIDES = {
  'eastcoastflacko': 'Eastcoastflacko',
  'eastcoastflax': 'Eastcoastflacko'
};

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
    // Only trust the file if it was written within LIVE_STATUS_MAX_AGE_MS.
    const serverLiveUsernames = new Set();
    if (liveStatus.lastChecked) {
      const ageMs = Date.now() - new Date(liveStatus.lastChecked).getTime();
      if (ageMs < LIVE_STATUS_MAX_AGE_MS) {
        for (const s of (liveStatus.live || [])) {
          if (s.twitch) serverLiveUsernames.add(s.twitch.toLowerCase());
        }
      }
    }

    // Community live creators: level >= 5, featured, live, excluding the main channel.
    const communityLiveNow = creators.filter(c =>
      c.level >= 5 &&
      c.featured?.toLowerCase() === "yes" &&
      c.twitch !== ROCKBOUND_CHANNEL &&
      (
        serverLiveUsernames.has(c.twitch) ||
        c.status === "live" || c.status === "active"
      )
    );

    // Build unified live list: Rockbound first (if live), then community (up to 4 total).
    const allLive = [];
    if (serverLiveUsernames.has(ROCKBOUND_CHANNEL)) {
      allLive.push({ twitch: ROCKBOUND_CHANNEL, name: 'Rockbound Gaming', level: 0 });
    }
    for (const c of communityLiveNow) {
      if (allLive.length >= 4) break;
      allLive.push(c);
    }

    updateUnifiedHub(allLive, serverLiveUsernames);
  } catch (err) {
    console.error("Error loading creators:", err);
    updateUnifiedHub([], new Set());
  }
}

// ============================================
//   UNIFIED HUB
// ============================================
function updateUnifiedHub(allLive, serverLiveUsernames) {
  const offlineEl = document.getElementById('offline-player');
  const liveGrid = document.getElementById('live-streams-grid');
  const panel = document.getElementById('twitch-panel');
  const titleEl = document.getElementById('panel-stream-title');

  if (allLive.length > 0) {
    if (offlineEl) offlineEl.hidden = true;
    if (liveGrid) liveGrid.hidden = false;
    if (panel) panel.classList.add('is-live');
    if (titleEl) titleEl.textContent = allLive.length === 1 ? allLive[0].name : 'Rock Hub Live';
    updateDisplay(allLive, serverLiveUsernames);
  } else {
    if (offlineEl) offlineEl.hidden = false;
    if (liveGrid) liveGrid.hidden = true;
    if (panel) panel.classList.remove('is-live');
    if (titleEl) titleEl.textContent = 'Rockbound Gaming';
    displayNoCreators();
    initOfflinePlayer();
  }
}

function updateDisplay(liveNow, serverLiveUsernames = new Set()) {
  const container = document.getElementById("live-streams-grid");
  if (!container) return;

  // Update the grid column class based on stream count.
  const count = Math.min(liveNow.length, 4);
  container.className = `live-streams-grid count-${count}`;

  const incomingUsernames = new Set(liveNow.map(c => c.twitch));

  const usernamesChanged = 
    incomingUsernames.size !== lastLiveUsernames.size ||
    ![...incomingUsernames].every(u => lastLiveUsernames.has(u));

  if (!usernamesChanged) return;

  lastLiveUsernames = incomingUsernames;

  activePlayers.forEach((_, username) => {
    if (!incomingUsernames.has(username)) {
      removeStreamer(username);
    }
  });

  // Filter out recently removed channels (within last 60 seconds)
  const now = Date.now();
  const filteredLiveNow = liveNow.filter(c => {
    const removedTime = recentlyRemoved.get(c.twitch);
    return !removedTime || (now - removedTime) >= 60000;
  });

  filteredLiveNow.forEach(c => {
    if (!activePlayers.has(c.twitch)) {
      addStreamer(c, serverLiveUsernames.has(c.twitch));
    }
  });
}

function addStreamer(c, serverConfirmedLive = false) {
  const container = document.getElementById("live-streams-grid");
  
  const wrapper = document.createElement('div');
  wrapper.className = 'creator-featured'; 
  wrapper.id = `wrapper-${c.twitch}`;

  if (serverConfirmedLive) {
    wrapper.style.display = '';
  } else {
    wrapper.style.display = 'none';
  }

  wrapper.innerHTML = `
    <div class="creator-featured-header">
      <div class="creator-avatar"><i class="fas fa-user"></i></div>
      <div class="creator-info">
        <h3 class="creator-name">${c.name}</h3>
        ${c.level > 0 ? `<p class="creator-level">Level ${c.level}</p>` : ''}
      </div>
      <div class="creator-status-badge">LIVE</div>
    </div>
    <div id="player-${c.twitch}" class="twitch-embed-container">
      <div class="stream-loading">
        <i class="fas fa-spinner fa-spin"></i>
        <p>Loading stream...</p>
      </div>
    </div>
  `;
  container.appendChild(wrapper);

  const hostname = window.location.hostname === "" ? "localhost" : window.location.hostname;

  try {
    if (!window.Twitch || !window.Twitch.Player) {
      console.error("Twitch Player not available");
      removeStreamer(c.twitch);
      return;
    }

    const player = new Twitch.Player(`player-${c.twitch}`, {
      channel: c.twitch,
      width: "100%",
      height: "100%",
      parent: [hostname],
      autoplay: true,
      muted: true
    });

    let hasStartedPlayback = false;
    let offlineTimeout;
    
    if (player.addEventListener) {
      player.addEventListener(Twitch.Player.ONLINE, () => {
        hasStartedPlayback = true;
        clearTimeout(offlineTimeout);

        if (!serverConfirmedLive) {
          wrapper.style.display = '';
        }

        // Hide the loading spinner in both cases
        setTimeout(() => {
          const loading = wrapper.querySelector('.stream-loading');
          if (loading) loading.style.display = 'none';
        }, 1000);
      });

      player.addEventListener(Twitch.Player.OFFLINE, () => {
        removeStreamer(c.twitch);
      });
    }

    if (!serverConfirmedLive) {
      // Auto-remove if the stream doesn't go online within 15 seconds.
      // This guard is only needed for the client-side path where we hide the
      // player until ONLINE fires; for server-confirmed streams we trust the
      // Helix API result and rely on the OFFLINE event to clean up instead.
      offlineTimeout = setTimeout(() => {
        offlineTimeout = null;
        if (!hasStartedPlayback) {
          removeStreamer(c.twitch);
        }
      }, 15000);
    }

    activePlayers.set(c.twitch, player);
  } catch (e) {
    console.error("Player Init Error:", e);
    removeStreamer(c.twitch);
  }
}

function removeStreamer(username) {
  const el = document.getElementById(`wrapper-${username}`);
  if (el) el.remove();
  activePlayers.delete(username);
  lastLiveUsernames.delete(username);
  
  // Record removal to prevent re-adding for 60 seconds
  recentlyRemoved.set(username, Date.now());
  
  const container = document.getElementById("live-streams-grid");
  if (container && container.children.length === 0) {
    // No live streams left — switch back to offline player
    container.hidden = true;
    const offlineEl = document.getElementById('offline-player');
    const panel = document.getElementById('twitch-panel');
    const titleEl = document.getElementById('panel-stream-title');
    if (offlineEl) offlineEl.hidden = false;
    if (panel) panel.classList.remove('is-live');
    if (titleEl) titleEl.textContent = 'Rockbound Gaming';
    initOfflinePlayer();
  }
}

function displayNoCreators() {
  // Clear the live grid; the offline player is shown by updateUnifiedHub / removeStreamer.
  const container = document.getElementById("live-streams-grid");
  if (container) container.innerHTML = '';
}

// ============================================
//   INITIALIZE
// ============================================
document.addEventListener('DOMContentLoaded', async () => {
  await initTwitchScript();
  await loadFeaturedCreators();
  fetchDiscordMembers();
});

setInterval(loadFeaturedCreators, 60000);
// Refresh Discord member list every 3 minutes
setInterval(fetchDiscordMembers, 3 * 60 * 1000);

// ============================================
//   OFFLINE PLAYER (RockboundGaming fallback)
// ============================================
let offlinePlayerInit = false;

function initOfflinePlayer() {
  if (offlinePlayerInit) return;
  const container = document.getElementById('offline-player');
  if (!container || !window.Twitch || !window.Twitch.Player) return;
  offlinePlayerInit = true;

  const hostname = window.location.hostname || 'localhost';

  try {
    const player = new Twitch.Player('offline-player', {
      channel: ROCKBOUND_CHANNEL,
      width: '100%',
      height: '100%',
      parent: [hostname],
      autoplay: true,
      muted: true
    });

    if (player.addEventListener) {
      player.addEventListener(Twitch.Player.READY, () => {
        const loading = document.getElementById('permanent-loading');
        if (loading) loading.style.display = 'none';
      });
    }
  } catch (e) {
    console.error('Offline player init error:', e);
    offlinePlayerInit = false;
  }
}

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
  const KNOWN_BOTS = ['carl-bot', 'mee6', 'dyno', 'groovy', 'rhythm', 'rythm', 'fredboat', 'nightbot', 'streamelements', 'streamlabs'];
  const humanMembers = members.filter(m => {
    if (m.bot === true) return false;
    const nameLower = m.username.toLowerCase();
    if (KNOWN_BOTS.includes(nameLower)) return false;
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
