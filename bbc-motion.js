/* ════════════════════════════════════════════════════════════
   BBC MOTION STACK v6.0 — SHARED
   GSAP + ScrollTrigger + Lenis + native fallback
   bbc-motion.js

   Load AFTER:
   <script src="https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js"></script>
   <script src="https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/ScrollTrigger.min.js"></script>
   <script src="https://cdn.jsdelivr.net/npm/lenis@1.0.42/dist/lenis.min.js"></script>

   Then:
   <script src="bbc-motion.js"></script>

   Handles:
   - Header scrolled state + scroll progress bar
   - Mobile menu toggle (with aria + auto-close on link click)
   - prefers-reduced-motion respect (everything visible, no animation)
   - GSAP reveals: .reveal, .reveal-soft, .reveal-fade, .reveal-scale
   - .stagger-group > .stagger-item
   - [data-parallax="0.10"] for ambient orb parallax
   - [data-count][data-suffix] for stat count-up
   - [data-journey-fill] for scroll-tied timeline progress
   - Magnetic-lite .btn behavior on desktop with fine pointer
   - Intersection Observer fallback if GSAP fails
════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Header scroll state + scroll progress bar (supports both ID conventions)
  const header = document.getElementById('siteHeader') || document.getElementById('site-header');
  const progress = document.getElementById('scrollProgress');
  const updateScrollUI = () => {
    const y = window.scrollY || document.documentElement.scrollTop;
    if (header) header.classList.toggle('scrolled', y > 12);
    if (progress) {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const pct = max > 0 ? (y / max) * 100 : 0;
      progress.style.width = pct + '%';
    }
  };
  window.addEventListener('scroll', updateScrollUI, { passive: true });
  updateScrollUI();

  // Mobile menu toggle
  const hamburger = document.getElementById('hamburger');
  const mobileMenu = document.getElementById('mobileMenu');
  if (hamburger && mobileMenu) {
    hamburger.addEventListener('click', () => {
      const isOpen = mobileMenu.classList.toggle('open');
      hamburger.classList.toggle('open', isOpen);
      hamburger.setAttribute('aria-expanded', String(isOpen));
    });
    mobileMenu.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        mobileMenu.classList.remove('open');
        hamburger.classList.remove('open');
        hamburger.setAttribute('aria-expanded', 'false');
      });
    });
  }

  // Reduced motion: force everything visible, exit
  if (prefersReducedMotion) {
    document.querySelectorAll('.reveal, .reveal-soft, .reveal-fade, .reveal-scale, .stagger-group > .stagger-item').forEach(el => {
      el.style.opacity = '1';
      el.style.transform = 'none';
    });
    document.querySelectorAll('[data-count]').forEach(el => {
      el.textContent = el.dataset.count + (el.dataset.suffix || '');
    });
    return;
  }

  // GSAP / ScrollTrigger path
  if (typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined') {
    gsap.registerPlugin(ScrollTrigger);

    // Lenis smooth scroll (desktop only)
    if (typeof Lenis !== 'undefined' && window.innerWidth > 768) {
      try {
        const lenis = new Lenis({
          duration: 1.15,
          easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
          smoothWheel: true,
          smoothTouch: false,
        });
        lenis.on('scroll', ScrollTrigger.update);
        gsap.ticker.add((time) => { lenis.raf(time * 1000); });
        gsap.ticker.lagSmoothing(0);
      } catch (e) { /* Lenis init failed, page still works */ }
    }

    // Hero entrance — anything inside .hero animates immediately on load
    const heroEls = document.querySelectorAll('.hero .reveal, .hero .reveal-soft, .hero .reveal-scale');
    if (heroEls.length) {
      gsap.timeline({ delay: 0.1 }).to(heroEls, {
        opacity: 1, y: 0, scale: 1,
        duration: 0.95, ease: 'power3.out', stagger: 0.11,
      });
    }

    // Scroll-triggered reveals
    gsap.utils.toArray('.reveal:not(.hero *)').forEach(el => {
      gsap.to(el, {
        opacity: 1, y: 0, duration: 0.95, ease: 'power3.out',
        scrollTrigger: { trigger: el, start: 'top 86%', once: true },
      });
    });
    gsap.utils.toArray('.reveal-soft:not(.hero *)').forEach(el => {
      gsap.to(el, {
        opacity: 1, y: 0, duration: 0.75, ease: 'power2.out',
        scrollTrigger: { trigger: el, start: 'top 88%', once: true },
      });
    });
    gsap.utils.toArray('.reveal-scale:not(.hero *)').forEach(el => {
      gsap.to(el, {
        opacity: 1, scale: 1, duration: 0.9, ease: 'power3.out',
        scrollTrigger: { trigger: el, start: 'top 86%', once: true },
      });
    });
    gsap.utils.toArray('.reveal-fade:not(.hero *)').forEach(el => {
      gsap.to(el, {
        opacity: 1, duration: 0.85, ease: 'power2.out',
        scrollTrigger: { trigger: el, start: 'top 88%', once: true },
      });
    });

    // Stagger groups
    gsap.utils.toArray('.stagger-group').forEach(group => {
      const items = group.querySelectorAll('.stagger-item');
      gsap.to(items, {
        opacity: 1, y: 0, duration: 0.75, ease: 'power3.out', stagger: 0.09,
        scrollTrigger: { trigger: group, start: 'top 84%', once: true },
      });
    });

    // Parallax on ambient orbs
    gsap.utils.toArray('[data-parallax]').forEach(el => {
      const amount = parseFloat(el.dataset.parallax) || 0.1;
      gsap.to(el, {
        y: () => window.innerHeight * amount * 1.2,
        ease: 'none',
        scrollTrigger: {
          trigger: el.closest('section, .stats-bar') || el,
          start: 'top bottom', end: 'bottom top', scrub: 1.2,
        },
      });
    });

    // Stat count-up
    gsap.utils.toArray('[data-count]').forEach(el => {
      const target = parseInt(el.dataset.count, 10);
      const suffix = el.dataset.suffix || '';
      const obj = { val: 0 };
      gsap.to(obj, {
        val: target, duration: 1.6, ease: 'power2.out',
        scrollTrigger: { trigger: el, start: 'top 85%', once: true },
        onUpdate: () => { el.textContent = Math.round(obj.val) + suffix; },
      });
    });

    // Journey timeline fill (any element with data-journey-fill)
    gsap.utils.toArray('[data-journey-fill]').forEach(fill => {
      const trigger = fill.parentElement || fill;
      if (window.innerWidth > 700) {
        gsap.to(fill, {
          width: '80%', ease: 'none',
          scrollTrigger: { trigger, start: 'top 75%', end: 'bottom 65%', scrub: 0.8 },
        });
      }
    });

    // Optional float on the hero studio panel
    const heroStudio = document.getElementById('heroStudio');
    if (heroStudio && window.innerWidth > 920) {
      gsap.to(heroStudio, {
        y: -10, duration: 4.5, ease: 'sine.inOut', yoyo: true, repeat: -1,
      });
    }

    // Magnetic-lite buttons on desktop with fine pointer
    const isFinePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    if (isFinePointer && window.innerWidth > 1024) {
      document.querySelectorAll('.btn').forEach(btn => {
        btn.addEventListener('mousemove', (e) => {
          const rect = btn.getBoundingClientRect();
          const x = e.clientX - rect.left - rect.width / 2;
          const y = e.clientY - rect.top - rect.height / 2;
          gsap.to(btn, { x: x * 0.15, y: y * 0.18, duration: 0.35, ease: 'power2.out' });
        });
        btn.addEventListener('mouseleave', () => {
          gsap.to(btn, { x: 0, y: 0, duration: 0.45, ease: 'elastic.out(1, 0.55)' });
        });
      });
    }
  } else {
    // Fallback: IntersectionObserver
    const observer = new IntersectionObserver(
      entries => entries.forEach(el => {
        if (el.isIntersecting) {
          el.target.style.opacity = '1';
          el.target.style.transform = 'none';
          observer.unobserve(el.target);
        }
      }),
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    );
    document.querySelectorAll('.reveal, .reveal-soft, .reveal-fade, .reveal-scale, .stagger-group > .stagger-item').forEach(el => observer.observe(el));
    document.querySelectorAll('[data-count]').forEach(el => {
      el.textContent = el.dataset.count + (el.dataset.suffix || '');
    });
  }
})();
