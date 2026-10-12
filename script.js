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

// Hero flower tiles, drawn on a canvas so the wordmark can be cut out of them the same way in every
// browser (CSS masks misbehave in Safari). The tiles drift sideways and move with the scroll; the
// letter shapes are baked paths in the hero SVG, punched out so the sky shows through.
const heroTiles = document.querySelector('.hero-tiles');
if (heroTiles) {
  const canvas = document.createElement('canvas');
  // Display P3 keeps the flower image's wider colors on screens that can show them; others fall back to sRGB.
  const P3 = { colorSpace: window.matchMedia('(color-gamut: p3)').matches ? 'display-p3' : 'srgb' };
  const ctx = canvas.getContext && canvas.getContext('2d', P3);
  if (ctx) {
    heroTiles.appendChild(canvas);
    heroTiles.closest('.hero').classList.add('is-cut');
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const OVERLAP = 0.1;            // each flower overlaps the previous by this much of its width
    const SKEW = Math.tan(-18 * Math.PI / 180);
    const heroSvg = document.querySelector('.hero-wordmark .wordmark');
    const wmFlower = document.querySelector('#wm-flower'), wmIndustries = document.querySelector('#wm-industries');
    const letters = heroSvg && wmFlower && wmIndustries && typeof Path2D === 'function'
      ? [new Path2D(wmFlower.getAttribute('d')), new Path2D(wmIndustries.getAttribute('d'))] : null;
    const start = performance.now();
    let dpr = 1, size = 0, step = 0, tile = null, flower = null, src = '', loadedAt = 0;
    function makeTile(img) {
      // One faded copy of the flower, so the overlapping edges blend into each other.
      const px = Math.max(1, Math.round(size * dpr));
      tile = document.createElement('canvas');
      tile.width = tile.height = px;
      const t = tile.getContext('2d', P3);
      t.imageSmoothingQuality = 'high';
      t.drawImage(img, 0, 0, px, px);
      const fade = t.createLinearGradient(0, 0, px, 0);
      fade.addColorStop(0, 'rgba(0,0,0,0)'); fade.addColorStop(0.09, '#000'); fade.addColorStop(0.91, '#000'); fade.addColorStop(1, 'rgba(0,0,0,0)');
      t.globalCompositeOperation = 'destination-in';
      t.fillStyle = fade; t.fillRect(0, 0, px, px);
    }
    function build() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(heroTiles.clientWidth * dpr);
      canvas.height = Math.round(heroTiles.clientHeight * dpr);
      size = heroTiles.clientHeight;             // one row: tile height = hero height
      step = size * (1 - OVERLAP);
      const want = size * dpr > 440 ? 'assets/brand/logo-880.webp?v=2' : 'assets/brand/logo-440.webp?v=2';
      if (want === src) { if (flower) makeTile(flower); return; }
      src = want;
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => { if (src !== want) return; flower = img; makeTile(img); if (!loadedAt) loadedAt = performance.now(); draw(performance.now()); };
      img.src = want;
    }
    function draw(now) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = 'source-over';
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (!tile) return;
      ctx.globalAlpha = reduceMotion ? 1 : Math.min(1, (now - loadedAt) / 500);
      const offset = window.scrollY * 0.6 + (reduceMotion ? 0 : (now - start) * 0.018);
      const px = size * dpr;
      for (let x = -(((offset % step) + step) % step) - step; x < heroTiles.clientWidth; x += step) {
        ctx.drawImage(tile, x * dpr, 0, px, px);   // no rounding: whole-pixel steps make the slow drift stutter
      }
      ctx.globalAlpha = 1;
      if (!letters) return;
      const t = heroTiles.getBoundingClientRect(), r = heroSvg.getBoundingClientRect();
      const s = r.width / 400;                 // the hero SVG viewBox is 0 20 400 130
      ctx.globalCompositeOperation = 'destination-out';
      ctx.setTransform(dpr * s, 0, 0, dpr * s, dpr * (r.left - t.left), dpr * (r.top - t.top - 20 * s));
      ctx.fill(letters[0]);
      ctx.transform(1, 0, SKEW, 1, 0, 0);       // matches the INDUSTRIES path's skewX(-18) translate(43 0)
      ctx.translate(43, 0);
      ctx.lineWidth = 2.6; ctx.lineJoin = 'round';
      ctx.fill(letters[1]); ctx.stroke(letters[1]);
    }
    function frame(now) { draw(now); if (!reduceMotion) requestAnimationFrame(frame); }
    build();
    // Rebuild whenever the panel changes size, not just the window: fonts loading late can change its
    // height after the first build, which would leave the drawing stretched and the cut-out misaligned.
    const rebuild = () => { build(); draw(performance.now()); };
    if ('ResizeObserver' in window) new ResizeObserver(rebuild).observe(heroTiles);
    else window.addEventListener('resize', rebuild);
    window.addEventListener('load', () => draw(performance.now()));
    requestAnimationFrame(frame);
    if (reduceMotion) window.addEventListener('scroll', () => draw(performance.now()), { passive: true });
  }
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

// Forest strips: shuffle the trees into new spots on every page load. Each row (back, front) is
// spread evenly across the full width with a small random nudge, so trees never stack up.
// Edge trees are allowed to hang past the sides.
document.querySelectorAll('.strip-trees').forEach(forest => {
  const trees = [...forest.querySelectorAll('img')];
  const rows = [trees.filter(t => !t.classList.contains('front')), trees.filter(t => t.classList.contains('front'))];
  rows.forEach((row, r) => {
    // The darkening filter lives on a row wrapper, not the flipped trees: Firefox clips a filtered,
    // mirrored image on the wrong side when it hangs past the strip edge.
    const wrap = document.createElement('div');
    wrap.className = r ? 'tree-row front' : 'tree-row';
    wrap.append(...row);
    forest.append(wrap);
    const slots = row.map((_, i) => i).sort(() => Math.random() - 0.5);
    row.forEach((tree, i) => {
      tree.dataset.spot = (slots[i] + 0.5 + (Math.random() - 0.5) * 0.4) / row.length;
      tree.style.transform = Math.random() < 0.5 ? 'scaleX(-1)' : '';
    });
  });
  function place() {
    const width = forest.clientWidth;
    trees.forEach(tree => {
      const w = tree.offsetWidth;
      tree.style.left = `${tree.dataset.spot * width - w / 2}px`;
    });
  }
  place();
  trees.forEach(tree => tree.complete || tree.addEventListener('load', place, { once: true }));
  if ('ResizeObserver' in window) new ResizeObserver(place).observe(forest);
  else window.addEventListener('resize', place);
});

// Sprite strips: shuffle the character order on every page load, nudge each one a little
// left or right, and randomly flip some so they face the other way.
document.querySelectorAll('.sprite-strip').forEach(strip => {
  const sprites = [...strip.querySelectorAll(':scope > img')];
  const order = sprites.map((_, i) => i).sort(() => Math.random() - 0.5);
  sprites.forEach((sprite, i) => {
    sprite.style.order = order[i];
    sprite.style.left = `${((Math.random() - 0.5) * 6).toFixed(2)}%`;
    if (Math.random() < 0.5) sprite.style.transform = 'scaleX(-1)';
  });
});
