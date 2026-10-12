const menuToggle = document.querySelector('.menu-toggle');
const navigation = document.querySelector('#primary-nav');
function closeMenu() {
  menuToggle.setAttribute('aria-expanded', 'false');
  navigation.classList.remove('is-open');
}
menuToggle.addEventListener('click', () => {
  const isOpen = menuToggle.getAttribute('aria-expanded') === 'true';
  menuToggle.setAttribute('aria-expanded', String(!isOpen));
  navigation.classList.toggle('is-open', !isOpen);
});
navigation.querySelectorAll('a').forEach(link => link.addEventListener('click', closeMenu));
document.addEventListener('click', event => {
  if (!event.target.closest('.site-header')) closeMenu();
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && menuToggle.getAttribute('aria-expanded') === 'true') {
    closeMenu();
    menuToggle.focus();
  }
});
window.matchMedia('(min-width: 561px)').addEventListener('change', closeMenu);
const yearEl = document.querySelector('#year');
if (yearEl) yearEl.textContent = new Date().getFullYear();

const lightbox = document.querySelector('.lightbox');
if (lightbox) {
const screenshotLinks = [...document.querySelectorAll('[data-lightbox]')];
const lightboxImage = document.querySelector('#lightbox-image');
let currentImage = 0;
let returnFocus;
// Warm the browser cache with the full-size lightbox images once the page is
// idle, so the first click opens instantly. Skipped on data-saver / slow links.
const conn = navigator.connection;
if (!(conn && (conn.saveData || /2g/.test(conn.effectiveType || '')))) {
  const warm = () => screenshotLinks.forEach(link => { const i = new Image(); i.fetchPriority = 'low'; i.src = link.href; });
  const idle = () => ('requestIdleCallback' in window ? requestIdleCallback(warm, { timeout: 4000 }) : setTimeout(warm, 1500));
  document.readyState === 'complete' ? idle() : addEventListener('load', idle, { once: true });
}
function showImage(index) {
  currentImage = (index + screenshotLinks.length) % screenshotLinks.length;
  const link = screenshotLinks[currentImage];
  lightboxImage.src = link.href;
  lightboxImage.alt = link.querySelector('img').alt;
  document.querySelector('#lightbox-caption').textContent = link.dataset.caption;
  document.querySelector('#image-count').textContent = `${currentImage + 1} / ${screenshotLinks.length}`;
}
screenshotLinks.forEach((link, index) => {
  link.addEventListener('click', event => {
    if (typeof lightbox.showModal !== 'function') return;
    event.preventDefault();
    returnFocus = link;
    showImage(index);
    lightbox.showModal();
    document.body.classList.add('modal-open');
  });
});
document.querySelector('.lightbox-close').addEventListener('click', () => lightbox.close());
lightbox.addEventListener('close', () => {
  document.body.classList.remove('modal-open');
  returnFocus?.focus({ preventScroll: true });
});
lightbox.addEventListener('click', event => {
  if (event.target !== lightbox) return;
  const box = lightbox.getBoundingClientRect();
  if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) lightbox.close();
});
lightbox.addEventListener('keydown', event => {
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
    event.preventDefault();
    showImage(currentImage + (event.key === 'ArrowRight' ? 1 : -1));
  }
});
document.querySelector('#previous-image').addEventListener('click', () => showImage(currentImage - 1));
document.querySelector('#next-image').addEventListener('click', () => showImage(currentImage + 1));

}

let toastTimer;
function notify(message) {
  const toast = document.querySelector('.toast');
  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.add('is-visible');
  toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 4500);
}
document.querySelector('.copy-email')?.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText('socials@flowerindustries.xyz');
    notify('Email address copied. Say hello!');
  } catch {
    const address = document.querySelector('.email-row > a');
    const range = document.createRange();
    range.selectNodeContents(address);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    notify('Email selected. Press Ctrl+C or ⌘C to copy.');
  }
});

const heroTiles = document.querySelector('.hero-tiles');
if (heroTiles) {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const OVERLAP = 0.1;            // each flower overlaps the previous by this much of its width
  const start = performance.now();
  let tiles = [], step = 0, size = 0;
  function build() {
    size = heroTiles.clientHeight;             // one row: tile height = hero height
    step = size * (1 - OVERLAP);
    const count = Math.ceil(heroTiles.clientWidth / step) + 3;
    heroTiles.innerHTML = '';
    tiles = [];
    for (let n = 0; n < count; n++) {
      const img = document.createElement('img');
      img.src = size > 440 ? 'assets/brand/logo-880.webp' : 'assets/brand/logo-440.webp'; img.alt = ''; img.width = 880; img.height = 880; img.decoding = 'async';
      img.addEventListener('load', () => img.classList.add('is-loaded'), { once: true }); if (img.complete) img.classList.add('is-loaded');
      img.style.width = size + 'px'; img.style.height = size + 'px';
      heroTiles.appendChild(img); tiles.push(img);
    }
  }
  function place(offset) {
    const span = tiles.length * step;
    const base = ((-offset % span) + span) % span;
    for (let n = 0; n < tiles.length; n++) {
      let x = base + n * step - span;         // start one span to the left
      while (x < -size) x += span;
      tiles[n].style.transform = `translateX(${Math.round(x)}px)`;
    }
  }
  function moveTiles(now) {
    const drift = reduceMotion ? 0 : (now - start) * 0.018;
    place(window.scrollY * 0.6 + drift);
    if (!reduceMotion) requestAnimationFrame(moveTiles);
  }
  build(); place(0);
  window.addEventListener('resize', () => { build(); place(0); });
  requestAnimationFrame(moveTiles);
  if (reduceMotion) window.addEventListener('scroll', () => moveTiles(performance.now()), { passive: true });
}

const castDetail = document.querySelector('#cast-detail');
if (castDetail) {
  const body = castDetail.querySelector('.cast-detail-body');
  const toggles = [...document.querySelectorAll('.cast-toggle')];
  const cards = toggles.map(t => t.closest('.cast-card'));
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let openKey = null, swapTimer;
  function setCards(key) {
    toggles.forEach((t, i) => {
      const on = t.dataset.cast === key;
      t.setAttribute('aria-expanded', String(on));
      cards[i].classList.toggle('is-open', on);
      cards[i].classList.toggle('is-dim', key !== null && !on);
    });
  }
  function fill(t) { body.innerHTML = ''; body.appendChild(t.parentElement.querySelector('template').content.cloneNode(true)); }
  function closeCast() { openKey = null; setCards(null); castDetail.classList.remove('is-open', 'is-swapping'); }
  toggles.forEach(t => t.addEventListener('click', () => {
    const key = t.dataset.cast;
    if (openKey === key) { closeCast(); return; }
    clearTimeout(swapTimer);
    if (openKey && !reduce) {
      castDetail.classList.add('is-swapping');
      swapTimer = setTimeout(() => { fill(t); castDetail.classList.remove('is-swapping'); }, 180);
    } else { fill(t); }
    openKey = key; setCards(key); castDetail.classList.add('is-open');
  }));
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && openKey) closeCast(); });
}

// Hero wordmark cut-out: keep the SVG mask's text aligned with the visible wordmark so the sky shows through the letters.
const cutout = document.querySelector('#cutout-text');
const heroSvg = document.querySelector('.hero-wordmark .wordmark');
if (cutout && heroSvg && heroTiles) {
  function alignCutout() {
    const t = heroTiles.getBoundingClientRect(), r = heroSvg.getBoundingClientRect();
    const s = r.width / 400;
    cutout.setAttribute('transform', `translate(${r.left - t.left} ${r.top - t.top}) scale(${s}) translate(0 -20)`);
    const c2 = document.querySelector('#cutout-text-2'); if (c2) c2.setAttribute('transform', `scale(${s}) translate(0 -20)`);
    const bg = document.querySelector('#cutout-bg'); bg.setAttribute('width', t.width); bg.setAttribute('height', t.height);
  }
  alignCutout();
  window.addEventListener('resize', alignCutout);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(alignCutout);
  window.addEventListener('load', alignCutout);
}
