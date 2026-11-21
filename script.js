(() => {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const menuBtn = document.querySelector('#menu-toggle');
  const navLinks = document.querySelector('#nav-links');
  const navAnchors = document.querySelectorAll('.nav-link');
  const progress = document.querySelector('#scroll-progress');
  const header = document.querySelector('.site-header');

  // ── Certificates: built from certificates.js before the observers below run ──
  const certs = Array.isArray(window.CERTIFICATES) ? window.CERTIFICATES.filter(c => c && c.title) : [];
  const certSection = document.querySelector('#certificates');
  const certGrid = document.querySelector('#cert-grid');
  const make = (tag, cls, text) => { const el = document.createElement(tag); if (cls) el.className = cls; if (text) el.textContent = text; return el; };
  const icon = (id) => { const ns = 'http://www.w3.org/2000/svg', svg = document.createElementNS(ns, 'svg'), use = document.createElementNS(ns, 'use'); svg.setAttribute('class', 'icon'); svg.setAttribute('aria-hidden', 'true'); use.setAttribute('href', `#${id}`); svg.append(use); return svg; };
  certs.forEach((c, i) => {
    const card = make('article', 'cert-card panel');
    card.dataset.reveal = '';
    const top = make('div', 'cert-top');
    const badge = make('span', 'cert-icon'); badge.append(icon('i-award'));
    top.append(badge, make('span', 'cert-index', String(i + 1).padStart(2, '0')));
    const meta = make('p', 'cert-meta');
    if (c.issued) meta.append(make('span', '', `Issued ${c.issued}`));
    if (c.detail) meta.append(make('span', '', c.detail));
    const actions = make('div', 'cert-actions');
    if (c.image) {
      const view = make('button', 'cert-view', 'View certificate');
      view.type = 'button';
      view.setAttribute('aria-haspopup', 'dialog');
      view.dataset.cert = String(i);
      view.setAttribute('aria-label', `View certificate: ${c.title}`);
      view.append(icon('i-eye'));
      actions.append(view);
    }
    if (c.link) {
      const verify = make('a', 'cert-verify', 'Verify');
      verify.href = c.link; verify.target = '_blank'; verify.rel = 'noreferrer';
      verify.setAttribute('aria-label', `Verify ${c.title} (opens in a new tab)`);
      verify.append(icon('i-external'));
      actions.append(verify);
    }
    card.append(top, make('div', 'cert-issuer', c.issuer || ''), make('h3', '', c.title), meta);
    if (actions.children.length) card.append(actions);
    certGrid.append(card);
  });
  if (certs.length) {
    certSection.hidden = false;
    document.querySelector('.nav-link[href="#certificates"]').hidden = false;
  }

  const setMenu = (open) => {
    menuBtn.setAttribute('aria-expanded', String(open));
    menuBtn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    navLinks.classList.toggle('open', open);
    document.body.classList.toggle('menu-open', open);
  };
  menuBtn.addEventListener('click', () => setMenu(menuBtn.getAttribute('aria-expanded') !== 'true'));
  navLinks.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => setMenu(false)));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setMenu(false); });
  document.addEventListener('click', (e) => { if (!e.target.closest('.nav') && menuBtn.getAttribute('aria-expanded') === 'true') setMenu(false); });
  function onScroll() {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    progress.style.width = `${max > 0 ? (window.scrollY / max) * 100 : 0}%`;
    header.classList.toggle('scrolled', window.scrollY > 30);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
  const sections = document.querySelectorAll('main section[id]');
  if ('IntersectionObserver' in window) {
    const navObserver = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) navAnchors.forEach(a => { const active = a.getAttribute('href') === `#${e.target.id}`; a.classList.toggle('active', active); if (active) a.setAttribute('aria-current', 'location'); else a.removeAttribute('aria-current'); });
      });
    }, { rootMargin: '-34% 0px -55% 0px' });
    sections.forEach(section => navObserver.observe(section));
    const revealObserver = new IntersectionObserver((entries, obs) => {
      entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); obs.unobserve(e.target); } });
    }, { threshold: .08, rootMargin: '0px 0px -30px 0px' });
    document.querySelectorAll('[data-reveal]').forEach(el => { if (reduced) el.classList.add('visible'); else revealObserver.observe(el); });
  } else document.querySelectorAll('[data-reveal]').forEach(el => el.classList.add('visible'));
  const tabs = document.querySelectorAll('.skill-tab');
  tabs.forEach(tab => tab.addEventListener('click', () => {
    tabs.forEach(t => {const active=t===tab;t.classList.toggle('active',active);t.setAttribute('aria-pressed',String(active));});
    document.querySelectorAll('.skill-card').forEach(card => {
      const show=tab.dataset.filter==='all'||card.dataset.category===tab.dataset.filter;
      card.hidden=!show;
    });
  }));
  const projectButton=document.querySelector('#project-details-btn');
  const projectDetails=document.querySelector('#project-details');
  projectButton.addEventListener('click', () => {
    const open=projectButton.getAttribute('aria-expanded')!=='true';
    projectButton.setAttribute('aria-expanded',String(open));projectDetails.hidden=!open;
    projectButton.querySelector('.detail-chevron').textContent=open?'↑':'↓';
  });
  if (!reduced && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    const stage=document.querySelector('#portrait-stage');
    stage.addEventListener('pointermove', (e) => {
      const b=stage.getBoundingClientRect(),x=(e.clientX-b.left)/b.width-.5,y=(e.clientY-b.top)/b.height-.5;
      stage.style.setProperty('--mouse-x',`${x*15}px`);stage.style.setProperty('--mouse-y',`${y*10}px`);
    });
    stage.addEventListener('pointerleave',()=>{stage.style.setProperty('--mouse-x','0px');stage.style.setProperty('--mouse-y','0px');});
  }

  // ── Certificate preview (native <dialog>: traps focus, Esc closes, background inert) ──
  const dialog = document.querySelector('#cert-dialog');
  if (certs.length && dialog && typeof dialog.showModal === 'function') {
    // The <img> is created on first open so no empty image exists on the page before that.
    let dImg = null;
    let opener = null;
    certGrid.addEventListener('click', (e) => {
      const btn = e.target.closest('.cert-view');
      if (!btn) return;
      const c = certs[Number(btn.dataset.cert)];
      opener = btn;
      dialog.querySelector('#cert-dialog-issuer').textContent = c.issuer || '';
      dialog.querySelector('#cert-dialog-title').textContent = c.title;
      dialog.querySelector('#cert-dialog-meta').textContent = [c.issued && `Issued ${c.issued}`, c.detail].filter(Boolean).join(' · ');
      if (!dImg) {
        dImg = make('img');
        dImg.id = 'cert-dialog-img';
        dImg.decoding = 'async';
        dialog.querySelector('#cert-dialog-frame').append(dImg);
      }
      dImg.src = c.image;
      dImg.alt = `Certificate: ${c.title}, issued by ${c.issuer || 'unknown issuer'}`;
      dialog.showModal();
    });
    dialog.querySelector('.cert-dialog-close').addEventListener('click', () => dialog.close());
    // Click on the dimmed backdrop (outside the dialog box) closes it.
    dialog.addEventListener('click', (e) => {
      const r = dialog.getBoundingClientRect();
      if (e.target === dialog && (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom)) dialog.close();
    });
    dialog.addEventListener('close', () => { if (opener) opener.focus(); });
  }
})();
