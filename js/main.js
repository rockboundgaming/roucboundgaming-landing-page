/ ============================================
//   GLOBAL STATE & CONFIG
// ============================================
let activePlayers = new Map(); // [username -> PlayerObject]
const SHEET_ID = "2PACX-1vQR_A_KNK2zWNAYiT-a3baVWUSt8-_SE83gnyt4rOLDRruj0E-SVg4ej8-JnxaMuD0AxIYt6roaKJsg";

// ============================================
//   LOAD DATA FROM GOOGLE SHEET
// ============================================
async function loadFeaturedCreators() {
  const url = `https://google.com{SHEET_ID}/pub?output=tsv&cb=${Date.now()}`;

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
        status: cols[5]?.trim()
      };
    }).filter(c => c && c.twitch);

    const liveNow = creators.filter(c => 
      c.level >= 5 && 
      c.featured === "Yes" && 
      c.status === "Live"
    );

    updateDisplay(liveNow);

  } catch (err) {
    console.error("Error loading creators:", err);
  }
}

// ============================================
//   CORE DISPLAY LOGIC
// ============================================
function updateDisplay(liveNow) {
  const container = document.getElementById("twitch-embed");
  if (!container) return;

  const incomingUsernames = new Set(liveNow.map(c => c.twitch));

  // 1. Remove streamers who are no longer Live in the spreadsheet
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
  
  loadTwitchScript(() => {
    // Create the HTML structure
    const wrapper = document.createElement('div');
    wrapper.className = 'creator-featured visible'; 
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
      <div id="player-${c.twitch}" class="twitch-embed-container" style="height: 500px; width: 100%; background: #000;"></div>
    `;
    container.appendChild(wrapper);

    // Initialize Twitch API with a small delay to ensure DOM is ready
    setTimeout(() => {
      try {
        const hostname = window.location.hostname === "" ? "localhost" : window.location.hostname;
        
        const player = new Twitch.Player(`player-${c.twitch}`, {
          channel: c.twitch,
          width: "100%",
          height: 500,
          parent: [hostname],
          autoplay: true,
          muted: true
        });

        // The instant removal logic
        player.addEventListener(Twitch.Player.OFFLINE, () => {
          removeStreamer(c.twitch);
        });

        activePlayers.set(c.twitch, player);
      } catch (e) {
        console.error("Player Init Error:", e);
      }
    }, 50);
  });
}

function removeStreamer(username) {
  const el = document.getElementById(`wrapper-${username}`);
  if (el) el.remove();
  activePlayers.delete(username);
  
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
    </div>
  `;
}

function loadTwitchScript(callback) {
  if (window.Twitch && window.Twitch.Player) return callback();
  const script = document.createElement('script');
  script.src = 'https://player.twitch.tv/js/embed/v1.js'; // Use the dedicated player script
  script.onload = callback;
  document.body.appendChild(script);
}

// ============================================
//   INITIALIZE
// ============================================
document.addEventListener('DOMContentLoaded', loadFeaturedCreators);
setInterval(loadFeaturedCreators, 60000); // Check spreadsheet every minute
