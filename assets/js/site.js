(() => {
  if (window.location.protocol === 'file:') {
    document.querySelectorAll('a[href]').forEach((link) => {
      const href = link.getAttribute('href');
      if (!href || href.startsWith('#') || href.startsWith('//') || /^[a-z][a-z0-9+.-]*:/i.test(href)) return;
      const hashAt = href.indexOf('#');
      const hash = hashAt >= 0 ? href.slice(hashAt) : '';
      const beforeHash = hashAt >= 0 ? href.slice(0, hashAt) : href;
      const queryAt = beforeHash.indexOf('?');
      const query = queryAt >= 0 ? beforeHash.slice(queryAt) : '';
      const path = queryAt >= 0 ? beforeHash.slice(0, queryAt) : beforeHash;
      if (path.endsWith('/')) link.setAttribute('href', `${path}index.html${query}${hash}`);
    });
  }

  const header = document.querySelector('[data-header]');
  const toggle = document.querySelector('[data-nav-toggle]');
  const nav = document.querySelector('[data-nav]');

  const closeNav = () => {
    if (!toggle || !nav) return;
    toggle.setAttribute('aria-expanded', 'false');
    nav.classList.remove('is-open');
    document.body.classList.remove('nav-open');
  };

  toggle?.addEventListener('click', () => {
    const open = toggle.getAttribute('aria-expanded') !== 'true';
    toggle.setAttribute('aria-expanded', String(open));
    nav?.classList.toggle('is-open', open);
    document.body.classList.toggle('nav-open', open);
  });
  nav?.addEventListener('click', (event) => {
    if (event.target instanceof HTMLAnchorElement) closeNav();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeNav();
  });
  window.addEventListener('resize', () => {
    if (window.innerWidth > 1040) closeNav();
  });

  const updateHeader = () => header?.classList.toggle('is-scrolled', window.scrollY > 24);
  updateHeader();
  window.addEventListener('scroll', updateHeader, { passive: true });

  document.querySelectorAll('[data-year]').forEach((node) => {
    node.textContent = String(new Date().getFullYear());
  });

  const service = new URLSearchParams(window.location.search).get('service');
  const selector = document.querySelector('[data-service-select]');
  if (service && selector instanceof HTMLSelectElement) {
    const allowed = Array.from(selector.options).some((option) => option.value === service);
    if (allowed) selector.value = service;
  }
})();
