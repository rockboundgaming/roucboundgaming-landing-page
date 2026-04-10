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
      return {
        twitch: cols[0]?.trim()?.toLowerCase(), 
        name: cols[1]?.trim(),
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

    // A creator is shown when:
    //   • they qualify (level ≥ 5 + featured) AND
    //   • they are confirmed live by the Helix API (serverLiveUsernames), OR
    //     the spreadsheet still marks them live as a fallback.
    const liveNow = creators.filter(c => 
      c.level >= 5 && 
      c.featured?.toLowerCase() === "yes" &&
      (
        serverLiveUsernames.has(c.twitch) ||
        c.status === "live" || c.status === "active"
      )
    );

    // Update the permanent player's live badge / glow using the server status.
    updatePermanentPlayerStatus(serverLiveUsernames);

    // Exclude the main channel from the community creators section — it is
    // permanently embedded in the Control Center above.
    const communityLiveNow = liveNow.filter(c => c.twitch !== ROCKBOUND_CHANNEL);
    updateDisplay(communityLiveNow, serverLiveUsernames);
  } catch (err) {
    console.error("Error loading creators:", err);
    displayNoCreators();
  }
}

function updateDisplay(liveNow, serverLiveUsernames = new Set()) {
  const container = document.getElementById("twitch-embed");
  if (!container) return;

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

  // Only show "no one is streaming" when there are genuinely no live players.
  // The "no one is streaming" placeholder is removed by the ONLINE event handler
  // inside addStreamer() once the stream is confirmed live, so we must NOT remove
  // it here just because a creator is theoretically live in the spreadsheet.
  if (incomingUsernames.size === 0 && activePlayers.size === 0) {
    const noCard = container.querySelector('.no-featured-creators');
    if (!noCard) displayNoCreators();
  }
}

function addStreamer(c, serverConfirmedLive = false) {
  const container = document.getElementById("twitch-embed");
  
  const wrapper = document.createElement('div');
  wrapper.className = 'creator-featured'; 
  wrapper.id = `wrapper-${c.twitch}`;

  if (serverConfirmedLive) {
    // The Twitch Helix API confirmed this stream is live server-side.
    // Show the player wrapper immediately — no waiting for the ONLINE event —
    // so Android users see the stream straight away with zero flicker.
    wrapper.style.display = '';
    const noCard = container.querySelector('.no-featured-creators');
    if (noCard) noCard.remove();
  } else {
    // Client-side-only path: keep the wrapper hidden until the Twitch SDK
    // fires ONLINE so the "no one is streaming" placeholder stays visible
    // while the player initialises.
    wrapper.style.display = 'none';
  }

  wrapper.innerHTML = `
    <div class="creator-featured-header">
      <div class="creator-avatar"><i class="fas fa-user"></i></div>
      <div class="creator-info">
        <h3 class="creator-name">${c.name}</h3>
        <p class="creator-level">Level ${c.level}</p>
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
          // Client-side path: reveal the player now that we know it's live.
          wrapper.style.display = '';
          const noCard = container.querySelector('.no-featured-creators');
          if (noCard) noCard.remove();
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
  
  const container = document.getElementById("twitch-embed");
  if (container && container.children.length === 0) displayNoCreators();
}

function displayNoCreators() {
  // The permanent RockboundGaming player is always shown in the Control Center.
  // Simply clear the community-creator section so CSS :empty hides it.
  const container = document.getElementById("twitch-embed");
  if (container) container.innerHTML = '';
}

// ============================================
//   INITIALIZE
// ============================================
document.addEventListener('DOMContentLoaded', async () => {
  await initTwitchScript();
  initPermanentPlayer();
  await loadFeaturedCreators();
  fetchDiscordMembers();
});

setInterval(loadFeaturedCreators, 60000);
// Refresh Discord member list every 3 minutes
setInterval(fetchDiscordMembers, 3 * 60 * 1000);

// ============================================
//   PERMANENT TWITCH PLAYER (RockboundGaming)
// ============================================
function initPermanentPlayer() {
  const container = document.getElementById('permanent-twitch-embed');
  if (!container || !window.Twitch || !window.Twitch.Player) return;

  const hostname = window.location.hostname || 'localhost';

  try {
    const player = new Twitch.Player('permanent-twitch-embed', {
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
    }  } catch (e) {
    console.error('Permanent player init error:', e);
  }
}

// ============================================
//   LIVE BADGE / GLOW (driven by live-status.json)
// ============================================
function updatePermanentPlayerStatus(serverLiveUsernames) {
  const panel = document.getElementById('twitch-panel');
  const badge = document.getElementById('live-badge');
  if (!panel || !badge) return;

  const isLive = serverLiveUsernames.has(ROCKBOUND_CHANNEL);

  if (isLive) {
    panel.classList.add('is-live');
    badge.hidden = false;
  } else {
    panel.classList.remove('is-live');
    badge.hidden = true;
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

  if (countEl) {
    countEl.textContent = count > 0 ? `${count} online` : '';
  }

  if (members.length === 0) {
    list.innerHTML = `
      <li class="discord-empty-item">
        <i class="fab fa-discord" style="font-size:1.4rem;color:rgba(230,57,70,0.5);"></i>
        <span>No members visible right now</span>
      </li>`;
    return;
  }

  // Sort: online → idle → dnd
  const order = { online: 0, idle: 1, dnd: 2 };
  members.sort((a, b) => (order[a.status] ?? 3) - (order[b.status] ?? 3));

  list.innerHTML = members.map(m => {
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
