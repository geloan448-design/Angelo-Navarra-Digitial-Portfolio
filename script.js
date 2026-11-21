(() => {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const menuBtn = document.querySelector('#menu-toggle');
  const navLinks = document.querySelector('#nav-links');
  const navAnchors = document.querySelectorAll('.nav-link');
  const progress = document.querySelector('#scroll-progress');
  const header = document.querySelector('.site-header');
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
})();
