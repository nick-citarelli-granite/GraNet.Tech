(() => {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const saveData = navigator.connection?.saveData === true;
  const lowPower = (navigator.hardwareConcurrency || 4) <= 2;

  const revealNodes = document.querySelectorAll('[data-reveal]');
  if (reduced || !('IntersectionObserver' in window)) {
    revealNodes.forEach((node) => node.classList.add('is-visible'));
  } else {
    const revealObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    revealNodes.forEach((node) => revealObserver.observe(node));
  }

  if (!reduced && !saveData && !lowPower && window.matchMedia('(pointer: fine)').matches) {
    document.querySelectorAll('.tilt').forEach((card) => {
      card.addEventListener('pointermove', (event) => {
        const rect = card.getBoundingClientRect();
        const x = (event.clientX - rect.left) / rect.width;
        const y = (event.clientY - rect.top) / rect.height;
        card.style.setProperty('--mx', `${x * 100}%`);
        card.style.setProperty('--my', `${y * 100}%`);
        card.style.transform = `perspective(900px) rotateX(${(0.5 - y) * 4}deg) rotateY(${(x - 0.5) * 5}deg) translateY(-2px)`;
      });
      card.addEventListener('pointerleave', () => { card.style.transform = ''; });
    });
  }

  const canvas = document.querySelector('[data-network-canvas]');
  if (!(canvas instanceof HTMLCanvasElement) || reduced || saveData || lowPower) return;
  const context = canvas.getContext('2d', { alpha: true });
  if (!context) return;

  let width = 0;
  let height = 0;
  let ratio = 1;
  let nodes = [];
  let active = true;
  let frame = 0;
  const pointer = { x: 0.72, y: 0.4 };

  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    width = rect.width;
    height = rect.height;
    ratio = Math.min(window.devicePixelRatio || 1, 1.6);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    const count = Math.max(28, Math.min(72, Math.round(width / 20)));
    nodes = Array.from({ length: count }, (_, index) => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.16,
      vy: (Math.random() - 0.5) * 0.13,
      red: index % 4 === 0
    }));
  };

  const draw = () => {
    if (!active) { frame = 0; return; }
    context.clearRect(0, 0, width, height);
    nodes.forEach((node) => {
      node.x += node.vx;
      node.y += node.vy;
      if (node.x < 0 || node.x > width) node.vx *= -1;
      if (node.y < 0 || node.y > height) node.vy *= -1;
    });

    for (let i = 0; i < nodes.length; i += 1) {
      const a = nodes[i];
      for (let j = i + 1; j < nodes.length; j += 1) {
        const b = nodes[j];
        const distance = Math.hypot(a.x - b.x, a.y - b.y);
        if (distance > 145) continue;
        const alpha = (1 - distance / 145) * 0.22;
        context.strokeStyle = a.red || b.red ? `rgba(239,41,71,${alpha})` : `rgba(86,216,255,${alpha})`;
        context.lineWidth = 0.75;
        context.beginPath();
        context.moveTo(a.x, a.y);
        context.lineTo(b.x, b.y);
        context.stroke();
      }
      const pointerDistance = Math.hypot(a.x - pointer.x * width, a.y - pointer.y * height);
      const radius = pointerDistance < 180 ? 2.4 : 1.35;
      context.fillStyle = a.red ? 'rgba(255,74,101,.82)' : 'rgba(128,231,255,.72)';
      context.beginPath();
      context.arc(a.x, a.y, radius, 0, Math.PI * 2);
      context.fill();
    }
    frame = requestAnimationFrame(draw);
  };

  canvas.closest('.hero')?.addEventListener('pointermove', (event) => {
    const rect = canvas.getBoundingClientRect();
    pointer.x = (event.clientX - rect.left) / rect.width;
    pointer.y = (event.clientY - rect.top) / rect.height;
  }, { passive: true });
  const visibilityObserver = new IntersectionObserver(([entry]) => {
    active = entry.isIntersecting && !document.hidden;
    if (active && !frame) frame = requestAnimationFrame(draw);
  });
  visibilityObserver.observe(canvas);
  document.addEventListener('visibilitychange', () => {
    active = !document.hidden && canvas.getBoundingClientRect().bottom > 0;
    if (active && !frame) frame = requestAnimationFrame(draw);
  });
  window.addEventListener('resize', resize, { passive: true });
  resize();
  frame = requestAnimationFrame(draw);
})();
