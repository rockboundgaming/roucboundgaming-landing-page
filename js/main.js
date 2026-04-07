/* ============================================
   ROCKBOUND GAMING — main.js (UPDATED)
   ============================================ */

// =============================
// SCROLL REVEAL (SAFE VERSION)
// =============================
const reveals = document.querySelectorAll('.reveal');

if (reveals.length) {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
      }
    });
  }, { threshold: 0.1 });

  reveals.forEach(el => observer.observe(el));
}

// =============================
// NAV SCROLL EFFECT
// =============================
const nav = document.querySelector('nav');

if (nav) {
  window.addEventListener('scroll', () => {
    if (window.scrollY > 50) {
      nav.style.background = 'rgba(6, 8, 16, 0.98)';
    } else {
      nav.style.background = 'rgba(6, 8, 16, 0.85)';
    }
  });
}

// =============================
// SMOOTH SCROLL (SAFE)
// =============================
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function(e) {
    const targetId = this.getAttribute('href');

    // Ignore empty links
    if (targetId === "#") return;

    const target = document.querySelector(targetId);

    if (target) {
      e.preventDefault();
      target.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    }
  });
});

// =============================
// MOBILE MENU TOGGLE (YOU WERE MISSING THIS)
// =============================
const toggle = document.querySelector('.menu-toggle');
const navLinks = document.querySelector('.nav-links');

if (toggle && navLinks) {
  toggle.addEventListener('click', () => {
    navLinks.classList.toggle('active');
  });

  // Close menu when clicking a link (mobile UX fix)
  document.querySelectorAll('.nav-links a').forEach(link => {
    link.addEventListener('click', () => {
      navLinks.classList.remove('active');
    });
  });
}

// =============================
// SCROLL PROGRESS BAR (NEW)
// =============================
const scrollBar = document.querySelector('.scroll-bar');

if (scrollBar) {
  window.addEventListener('scroll', () => {
    const scrollTop = window.scrollY;
    const docHeight = document.body.scrollHeight - window.innerHeight;
    const scrollPercent = (scrollTop / docHeight) * 100;

    scrollBar.style.width = scrollPercent + '%';
  });
}
