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
  const url = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQR_A_KNK2zWNAYiT-a3baVWUSt8-_SE83gnyt4rOLDRruj0E-SVg4ej8-JnxaMuD0AxIYt6roaKJsg/pub?output=csv";

  try {
    const response = await fetch(url, {
      method: 'GET',
      mode: 'no-cors'
    });
    const data = await response.text();

    console.log("RAW DATA:", data);
    console.log("FIRST 200 CHARS:", data.substring(0, 200));

    const rows = data.split("\n").slice(1);
    console.log("TOTAL ROWS:", rows.length);
    console.log("FIRST ROW:", rows[0]);

    const creators = rows.map(row => {
      const cols = row.split("\t");
      console.log("PARSED ROW:", cols);

      return {
        twitch: cols[0]?.trim(),
        name: cols[1]?.trim(),
        level: parseInt(cols[2]),
        hours: cols[3]?.trim(),
        featured: cols[4]?.trim(),
        status: cols[5]?.trim(),
        eligible: cols[7]?.trim()
      };
    }).filter(c => c.twitch && c.name);

    console.log("CREATORS ARRAY:", creators);

    const seen = new Set();

    const featuredCreators = creators.filter(c => {
      const key = c.twitch.toLowerCase();

      if (seen.has(key)) return false;
      seen.add(key);

      console.log(`Checking: ${c.name} - Level: ${c.level}, Featured: ${c.featured}, Status: ${c.status}`);

      return (
        c.level >= 5 &&
        c.featured === "Yes" &&
        c.status === "Active"
      );
    });

    console.log("Featured Creators:", featuredCreators);
    displayFeaturedCreators(featuredCreators);

  } catch (err) {
    console.error("Error loading creators:", err);
    displayNoCreators();
  }
}

// ============================================
//   DISPLAY CREATORS
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

  container.innerHTML = creators.map(c => {
    const isDevelopment = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    
    let embedHTML = '';
    
    if (isDevelopment) {
      embedHTML = `
        <div class="creator-embed-placeholder">
          <div class="placeholder-content">
            <i class="fas fa-play-circle"></i>
            <h4>Twitch Embed Preview</h4>
            <p>${c.name} - Level ${c.level}</p>
            <p>Active</p>
            <p style="font-size: 0.85rem; opacity: 0.7; margin-top: 1rem;">
              Live embeds work on production domain
            </p>
            <a href="https://twitch.tv/${c.twitch}" target="_blank" rel="noopener noreferrer" class="btn-secondary" style="margin-top: 1rem; display: inline-block;">
              Watch on Twitch
            </a>
          </div>
        </div>
      `;
    } else {
      embedHTML = `
        <iframe
          src="https://twitch.tv/embed/${c.twitch}?parent=${window.location.hostname}"
          height="500"
          width="100%"
          frameborder="0"
          scrolling="no"
          allowfullscreen="true">
        </iframe>
      `;
    }

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
            Active
          </div>
        </div>
        ${embedHTML}
      </div>
    `;
  }).join("");
}

function displayNoCreators() {
  const container = document.getElementById("twitch-embed");

  if (!container) return;

  container.innerHTML = `
    <div class="no-featured-creators">
      <i class="fas fa-video"></i>
      <p>No featured creators streaming right now</p>
      <p style="font-size: 0.9rem; margin-top: 0.5rem;">Reach Level 5 in Discord to get featured!</p>
    </div>
  `;
}

// RUN on page load
document.addEventListener('DOMContentLoaded', loadFeaturedCreators);

// Refresh every 5 minutes
setInterval(loadFeaturedCreators, 300000);
