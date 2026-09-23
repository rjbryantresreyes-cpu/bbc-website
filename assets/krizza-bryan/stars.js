// Krizza & Bryan RSVP — a soft field of drifting, twinkling gold stars over the
// olive background. Adapted from the same pattern used on Cherry Sage's site
// (starfield.js): full-bleed canvas, gentle drift + twinkle, pauses off-screen,
// respects prefers-reduced-motion. No nebula/constellation lines here, just the
// stars themselves, dialed for a warm wedding-invite feel rather than a cosmic one.
(function () {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const canvas = document.querySelector("canvas.kb-stars");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  let width, height, dpr, stars = [], raf = null, visible = true, t = 0;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth; height = window.innerHeight;
    canvas.width = width * dpr; canvas.height = height * dpr;
    canvas.style.width = width + "px"; canvas.style.height = height + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    seed();
  }

  function seed() {
    const density = Math.max(50, Math.floor((width * height) / 8500));
    stars = Array.from({ length: density }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      r: Math.random() * 1.5 + 0.4,
      baseAlpha: Math.random() * 0.55 + 0.25,
      phase: Math.random() * Math.PI * 2,
      speed: 0.15 + Math.random() * 0.25,
      driftX: (Math.random() - 0.5) * 0.018,
      driftY: (Math.random() - 0.5) * 0.018,
    }));
  }

  function draw() {
    if (!visible) { raf = requestAnimationFrame(draw); return; }
    t += reduced ? 0 : 0.012;
    ctx.clearRect(0, 0, width, height);
    stars.forEach((s) => {
      if (!reduced) {
        s.x += s.driftX; s.y += s.driftY;
        if (s.x < 0) s.x = width; if (s.x > width) s.x = 0;
        if (s.y < 0) s.y = height; if (s.y > height) s.y = 0;
      }
      const twinkle = reduced ? s.baseAlpha : s.baseAlpha + Math.sin(t * s.speed * 4 + s.phase) * 0.2;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(247, 231, 190, ${Math.max(0, twinkle)})`;
      ctx.fill();
    });
    raf = reduced ? null : requestAnimationFrame(draw);
  }

  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => { visible = e.isIntersecting; });
  });
  io.observe(canvas);

  window.addEventListener("resize", resize, { passive: true });
  resize();
  draw();
})();
