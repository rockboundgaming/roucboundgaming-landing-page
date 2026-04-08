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
//   GLOBAL STATE & CONFIG
// ============================================
let activePlayers = new Map();
let lastLiveUsernames = new Set();
const SHEET_ID = "2PACX-1vQR_A_KNK2zWNAYiT-a3baVWUSt8-_SE83gnyt4rOLDRruj0E-SVg4ej8-JnxaMuD0AxIYt6roaKJsg";

// ============================================
//   TWITCH SCRIPT LOADING
// ============================================
let twitchScriptLoading = false;
let twitchScriptReady = false;

function loadTwitchScript() {
  if (twitchScriptReady) return;
  if (twitchScriptLoading) return;
  
  twitchScriptLoading = true;
  const script = document.createElement('script');
  script.src = 'https://player.twitch.tv/js/embed/v1.js';
  script.async = true;
  script.onload = () => {
    twitchScriptReady = true;
    console.log("Twitch script loaded successfully");
  };
  script.onerror = () => console.error('Failed to load Twitch script');
  document.body.appendChild(script);
}

// ============================================
//   LOAD DATA FROM GOOGLE SHEET (OPTIMIZED)
// ============================================
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

// ============================================
//   CORE DISPLAY LOGIC (ONLY UPDATE IF CHANGED)
// ============================================
function updateDisplay(liveNow) {
  const container = document.getElementById("twitch-embed");
  if (!container) return;

  const incomingUsernames = new Set(liveNow.map(c => c.twitch));

  // Only update if the set of live users has CHANGED
  const usernamesChanged = 
    incomingUsernames.size !== lastLiveUsernames.size ||
    ![...incomingUsernames].every(u => lastLiveUsernames.has(u));

  if (!usernamesChanged) {
    // No changes - don't touch the players!
    return;
  }

  lastLiveUsernames = incomingUsernames;

  // 1. Remove streamers who are no longer Live
  activePlayers.forEach((player, username) => {
    if (!incomingUsernames.has(username)) {
      removeStreamer(username);
    }
  });

  // 2. Add streamers who aren't on screen yet
  liveNow.forEach(c => {
    if (!activePlayers.has(c.twitch)) {
      addStreamer(c);
    }
  });

  // 3. Toggle the "No one is live" card
  const noCard = container.querySelector('.no-featured-creators');
  if (incomingUsernames.size === 0 && activePlayers.size === 0) {
    if (!noCard) displayNoCreators();
  } else if (noCard) {
    noCard.remove();
  }
}

function addStreamer(c) {
  const container = document.getElementById("twitch-embed");
  
  // Load Twitch script immediately
  loadTwitchScript();
  
  // Create HTML structure IMMEDIATELY
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
    <div id="player-${c.twitch}" class="twitch-embed-container"></div>
  `;
  container.appendChild(wrapper);

  // Wait for Twitch to be ready
  let retries = 0;
  const initPlayer = () => {
    try {
      if (!window.Twitch || !window.Twitch.Player) {
        retries++;
        if (retries < 50) { // Retry up to 50 times (5 seconds)
          setTimeout(initPlayer, 100);
          return;
        }
        console.error("Twitch Player failed to load after retries");
        removeStreamer(c.twitch);
        return;
      }

      const hostname = window.location.hostname === "" ? "localhost" : window.location.hostname;
      
      const player = new Twitch.Player(`player-${c.twitch}`, {
        channel: c.twitch,
        width: "100%",
        height: 350,
        parent: [hostname],
        autoplay: true,
        muted: true
      });

      let hasStartedPlayback = false;
      
      if (player.addEventListener) {
        player.addEventListener(Twitch.Player.ONLINE, () => {
          hasStartedPlayback = true;
        });

        player.addEventListener(Twitch.Player.OFFLINE, () => {
          if (hasStartedPlayback) {
            removeStreamer(c.twitch);
          }
        });
      }

      activePlayers.set(c.twitch, player);
      console.log(`Player initialized for ${c.twitch}`);
    } catch (e) {
      console.error("Player Init Error:", e);
      removeStreamer(c.twitch);
    }
  };

  initPlayer();
}

function removeStreamer(username) {
  const el = document.getElementById(`wrapper-${username}`);
  if (el) el.remove();
  activePlayers.delete(username);
  lastLiveUsernames.delete(username);
  
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
document.addEventListener('DOMContentLoaded', loadFeaturedCreators);
setInterval(loadFeaturedCreators, 60000);
