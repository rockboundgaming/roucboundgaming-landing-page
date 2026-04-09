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
let mobileTimeouts = new Map(); // username -> mobile-fallback timeout ID
let lastLiveUsernames = new Set();
let recentlyRemoved = new Map(); // username -> removal timestamp
const SHEET_ID = "2PACX-1vQR_A_KNK2zWNAYiT-a3baVWUSt8-_SE83gnyt4rOLDRruj0E-SVg4ej8-JnxaMuD0AxIYt6roaKJsg";
// How long to wait on mobile before assuming the stream is live when SDK events
// don't fire (common on Android Chrome).
const MOBILE_SDK_FALLBACK_MS = 5000;

function isMobile() {
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

// Load Twitch script once at startup
function initTwitchScript() {
  return new Promise((resolve) => {
    if (window.Twitch && window.Twitch.Player) {
      console.log("Twitch script already loaded");
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://player.twitch.tv/js/embed/v1.js';
    script.async = true;
    script.onload = () => {
      console.log("Twitch script loaded successfully");
      resolve();
    };
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
    const response = await fetch(url);
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

    const liveNow = creators.filter(c => 
      c.level >= 5 && 
      c.featured?.toLowerCase() === "yes" &&
      (c.status === "live" || c.status === "active")
    );

    updateDisplay(liveNow);
  } catch (err) {
    console.error("Error loading creators:", err);
    displayNoCreators();
  }
}

function updateDisplay(liveNow) {
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
      addStreamer(c);
    }
  });

  const noCard = container.querySelector('.no-featured-creators');
  if (incomingUsernames.size === 0 && activePlayers.size === 0) {
    if (!noCard) displayNoCreators();
  } else if (noCard) {
    noCard.remove();
  }
}

function addStreamer(c) {
  const container = document.getElementById("twitch-embed");
  
  const wrapper = document.createElement('div');
  wrapper.className = 'creator-featured'; 
  wrapper.id = `wrapper-${c.twitch}`;
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

  // Use the Twitch JS SDK on all platforms for a consistent look and behavior.
  // The wrapper is visible immediately so that Android Chrome (which doesn't fire
  // ONLINE reliably) still shows the player card without needing the event.
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
      player.addEventListener(Twitch.Player.READY, () => {
        console.log(`${c.twitch} player ready`);
      });

      player.addEventListener(Twitch.Player.ONLINE, () => {
        console.log(`${c.twitch} came ONLINE`);
        hasStartedPlayback = true;
        clearTimeout(offlineTimeout);
        clearTimeout(mobileTimeouts.get(c.twitch));
        mobileTimeouts.delete(c.twitch);
        // Hide loading after a short delay to ensure stream starts
        setTimeout(() => {
          const loading = wrapper.querySelector('.stream-loading');
          if (loading) loading.style.display = 'none';
        }, 1000);
      });

      player.addEventListener(Twitch.Player.OFFLINE, () => {
        console.log(`${c.twitch} went OFFLINE`);
        clearTimeout(mobileTimeouts.get(c.twitch));
        mobileTimeouts.delete(c.twitch);
        removeStreamer(c.twitch);
      });
    }

    // On mobile, SDK events (ONLINE/OFFLINE) may not fire reliably on some
    // Android browsers. After a short fallback delay, hide the loading spinner
    // and mark playback as started so the player is not torn down by the
    // offline timeout. We trust the spreadsheet data that the stream is live.
    if (isMobile()) {
      const mobileFallback = setTimeout(() => {
        mobileTimeouts.delete(c.twitch);
        if (!hasStartedPlayback) {
          console.log(`${c.twitch} mobile fallback — assuming live, hiding spinner`);
          hasStartedPlayback = true;
          clearTimeout(offlineTimeout);
          const loading = wrapper.querySelector('.stream-loading');
          if (loading) loading.style.display = 'none';
        }
      }, MOBILE_SDK_FALLBACK_MS);
      mobileTimeouts.set(c.twitch, mobileFallback);
    }

    // Auto-remove if stream doesn't go online within 10 seconds
    offlineTimeout = setTimeout(() => {
      offlineTimeout = null;
      if (!hasStartedPlayback) {
        console.log(`${c.twitch} timeout - removing player`);
        removeStreamer(c.twitch);
      }
    }, 10000);

    activePlayers.set(c.twitch, player);
    console.log(`Player initialized for ${c.twitch}`);
  } catch (e) {
    console.error("Player Init Error:", e);
    removeStreamer(c.twitch);
  }
}

function removeStreamer(username) {
  clearTimeout(mobileTimeouts.get(username));
  mobileTimeouts.delete(username);
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
  const container = document.getElementById("twitch-embed");
  if (!container) return;
  container.innerHTML = `
    <div class="no-featured-creators">
      <i class="fas fa-video"></i>
      <p>No one is live right now</p>
      <p style="font-size: 0.9rem; margin-top: 0.5rem;">Check back soon for featured creators!</p>
    </div>
  `;
}

// ============================================
//   INITIALIZE
// ============================================
document.addEventListener('DOMContentLoaded', async () => {
  await initTwitchScript();
  await loadFeaturedCreators();
});

setInterval(loadFeaturedCreators, 60000);
