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
//   FEATURED CREATORS FROM GOOGLE SHEET
// ============================================
const sheetURL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQR_A_KNK2zWNAYiT-a3baVWUSt8-_SE83gnyt4rOLDRruj0E-SVg4ej8-JnxaMuD0AxIYt6roaKJsg/pub?output=csv";

async function fetchFeaturedCreators() {
  try {
    const response = await fetch(sheetURL);
    const csv = await response.text();
    
    const lines = csv.trim().split('\n');
    let allCreators = [];
    
    // Skip header row and parse data
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map(col => col.trim());
      
      // Only process rows with enough columns
      if (cols.length >= 6) {
        allCreators.push({
          twitch: cols[0],
          name: cols[1],
          level: parseInt(cols[2]),
          hours: cols[3],
          featured: cols[4],
          status: cols[5]
        });
      }
    }
    
    // Remove duplicates and filter by requirements
    const seen = new Set();
    const featuredCreators = allCreators.filter(c => {
      const key = c.twitch.toLowerCase();
      
      // Skip if duplicate
      if (seen.has(key)) return false;
      seen.add(key);
      
      // Only show if: Level >= 5 AND Featured = "yes" AND Status = "active"
      return (
        c.level >= 5 &&
        c.featured.toLowerCase() === "yes" &&
        c.status.toLowerCase() === "active"
      );
    });
    
    displayFeaturedCreators(featuredCreators);
    
  } catch (error) {
    console.error('Error loading creators:', error);
    displayNoCreators();
  }
}

function displayFeaturedCreators(creators) {
  const container = document.getElementById('creator-list');
  
  if (!container) {
    console.error('creator-list container not found');
    return;
  }
  
  if (creators.length === 0) {
    displayNoCreators();
    return;
  }
  
  container.innerHTML = '';
  
  creators.forEach(creator => {
    // Determine if we're on localhost or live domain
    const isDevelopment = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    
    let embedHTML = '';
    
    if (isDevelopment) {
      // Show placeholder during development
      embedHTML = `
        <div class="creator-embed-placeholder">
          <div class="placeholder-content">
            <i class="fas fa-play-circle"></i>
            <h4>Twitch Embed Preview</h4>
            <p>${creator.name} is ${creator.status}</p>
            <p style="font-size: 0.85rem; opacity: 0.7; margin-top: 1rem;">
              Live embeds work on production domain
            </p>
            <a href="https://twitch.tv/${creator.twitch}" target="_blank" rel="noopener noreferrer" class="btn-secondary" style="margin-top: 1rem; display: inline-block;">
              Watch on Twitch
            </a>
          </div>
        </div>
      `;
    } else {
      // Live embed for production
      embedHTML = `
        <div class="creator-embed-wrapper">
          <iframe
            src="https://twitch.tv/embed/${creator.twitch}?parent=${window.location.hostname}"
            height="500"
            width="100%"
            frameborder="0"
            scrolling="no"
            allowfullscreen="true">
          </iframe>
        </div>
      `;
    }
    
    const creatorHTML = `
      <div class="creator-featured">
        <div class="creator-featured-header">
          <div class="creator-avatar">
            <i class="fas fa-user"></i>
          </div>
          <div class="creator-info">
            <h3 class="creator-name">${creator.name}</h3>
            <p class="creator-level">Level ${creator.level}</p>
          </div>
          <div class="creator-status-badge">
            ${creator.status}
          </div>
        </div>
        ${embedHTML}
      </div>
    `;
    
    container.innerHTML += creatorHTML;
  });
}

function displayNoCreators() {
  const container = document.getElementById('creator-list');
  
  if (!container) return;
  
  container.innerHTML = `
    <div class="no-featured-creators">
      <i class="fas fa-video"></i>
      <p>No featured creators streaming right now</p>
      <p style="font-size: 0.9rem; margin-top: 0.5rem;">Check back soon or join our Discord!</p>
    </div>
  `;
}

// Fetch creators when page loads
document.addEventListener('DOMContentLoaded', fetchFeaturedCreators);

// Refresh every 5 minutes
setInterval(fetchFeaturedCreators, 300000);
