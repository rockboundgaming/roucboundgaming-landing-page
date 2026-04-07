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
//   LOAD FEATURED CREATORS FROM GOOGLE SHEET
// ============================================

async function loadFeaturedCreators() {
  const sheetId = "2PACX-1vQR_A_KNK2zWNAYiT-a3baVWUSt8-_SE83gnyt4rOLDRruj0E-SVg4ej8-JnxaMuD0AxIYt6roaKJsg";
  const url = `https://docs.google.com/spreadsheets/d/e/${sheetId}/pub?output=tsv`;

  try {
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.text();
    const rows = data.split("\n");

    const creators = rows
      .slice(1)
      .map(row => {
        if (!row.trim()) return null;
        
        const cols = row.split("\t");

        return {
          twitch: cols[0]?.trim(),
          name: cols[1]?.trim(),
          level: parseInt(cols[2]),
          hours: cols[3]?.trim(),
          featured: cols[4]?.trim(),
          status: cols[5]?.trim(),
          eligible: cols[7]?.trim()
        };
      })
      .filter(c => c && c.twitch && c.name);

    const seen = new Set();

    const featuredCreators = creators.filter(c => {
      const key = c.twitch.toLowerCase();

      if (seen.has(key)) return false;
      seen.add(key);

      return c.level >= 5 && c.featured === "Yes";
    });

    displayFeaturedCreators(featuredCreators);

  } catch (err) {
    console.error("Error loading creators:", err);
    displayNoCreators();
  }
}

// ============================================
//   DISPLAY CREATORS WITH TWITCH EMBED
// ============================================

function displayFeaturedCreators(creators) {
  const container = document.getElementById("twitch-embed");

  if (!container) {
    console.error("twitch-embed container not found");
    return;
  }

  if (creators.length === 0) {
    displayNoCreators();
    return;
  }

  // Build HTML for all featured creators with VIDEO PLAYER (not chat)
  container.innerHTML = creators.map(c => {
    return `
      <div class="creator-featured">
        <div class="creator-featured-header">
          <div class="creator-avatar">
            <i class="fas fa-user"></i>
          </div>
          <div class="creator-info">
            <h3 class="creator-name">${c.name}</h3>
            <p class="creator-level">Level ${c.level}</p>
          </div>
          <div class="creator-status-badge">
            LIVE
          </div>
        </div>
        <div class="twitch-embed-container">
          <iframe
            src="https://player.twitch.tv/?channel=${c.twitch}&parent=${window.location.hostname}&muted=false"
            allowfullscreen="allowfullscreen"
            scrolling="no"
            style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: none;">
          </iframe>
        </div>
      </div>
    `;
  }).join("");

  // Load Twitch embed script
  loadTwitchScript();
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

function loadTwitchScript() {
  // Only load the script once
  if (window.twitchEmbedLoaded) return;
  
  const script = document.createElement('script');
  script.src = 'https://embed.twitch.tv/embed/v1.js';
  script.async = true;
  document.body.appendChild(script);
  window.twitchEmbedLoaded = true;
}

// ============================================
//   REFRESH HANDLERS
// ============================================

// RUN on page load
document.addEventListener('DOMContentLoaded', loadFeaturedCreators);

// Refresh every 30 seconds for fast updates when stream ends
setInterval(loadFeaturedCreators, 30000);

// Also refresh when user comes back to tab
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    loadFeaturedCreators();
  }
});

// Refresh when window regains focus
window.addEventListener('focus', () => {
  loadFeaturedCreators();
});
