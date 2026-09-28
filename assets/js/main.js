(() => {
  'use strict';

  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const pad = n => String(n).padStart(2, '0');
  const P = window.PROJECTS;
  const statusLabel = p => (p.status === 'active' ? 'Active' : 'Archived');
  const session = {
    get(k) { try { return sessionStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { sessionStorage.setItem(k, v); } catch { /* storage blocked */ } }
  };

  gsap.registerPlugin(ScrollTrigger, SplitText);

  /* ── smooth scroll ─────────────────────────────────────────────── */
  let lenis = null;
  if (!reduce && window.Lenis) {
    lenis = new Lenis({ lerp: 0.1 });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(t => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
  }
  const scroller = {
    top(immediate) {
      // force: Lenis ignores scrollTo while stopped, which it is during page transitions
      if (immediate) window.scrollTo(0, 0);
      if (lenis) lenis.scrollTo(0, { immediate, duration: 1.6, force: true });
      else if (!immediate) window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    stop() { lenis && lenis.stop(); },
    start() { lenis && lenis.start(); }
  };
  const onLenisScroll = fn => {
    if (!lenis) return () => {};
    const off = lenis.on('scroll', fn);
    return typeof off === 'function' ? off : () => lenis.off && lenis.off('scroll', fn);
  };

  /* ── video + sound (persists across page loads) ────────────────── */
  const video = $('#bgVideo');
  const soundBtn = $('[data-sound]');
  const soundLabel = $('.sound-label', soundBtn);
  const soundPref = {
    get() { try { return localStorage.getItem('darg-sound'); } catch { return null; } },
    set(v) { try { localStorage.setItem('darg-sound', v); } catch { /* storage blocked */ } }
  };
  function setSound(on) {
    video.muted = !on;
    if (video.paused) video.play().catch(() => {});
    soundBtn.classList.remove('is-waiting');
    soundBtn.classList.toggle('is-on', on);
    soundBtn.setAttribute('aria-pressed', String(on));
    soundLabel.textContent = on ? 'Sound on' : 'Sound off';
    soundPref.set(on ? '1' : '0');
  }
  soundBtn.addEventListener('click', () => setSound(video.muted));

  // Browsers only allow sound after a click or key press. When the entry screen is skipped
  // (a reload in the same session), turn sound back on at the visitor's first click — unless they muted it.
  function armSoundUnlock() {
    if (soundPref.get() === '0') return;
    soundBtn.classList.add('is-waiting');
    soundLabel.textContent = 'Click for sound';
    const evs = ['click', 'keydown'];
    const off = () => evs.forEach(ev => removeEventListener(ev, unlock, true));
    const unlock = e => {
      off();
      if (e.target.closest && e.target.closest('[data-sound]')) return; // the button's own handler turns it on
      setSound(true);
    };
    evs.forEach(ev => addEventListener(ev, unlock, true));
  }
  video.muted = true;
  // some mobile browsers reject the first muted autoplay; retry once media is ready or the user interacts
  const kick = () => { if (video.paused) video.play().catch(() => {}); };
  kick();
  video.addEventListener('canplay', kick);
  ['pointerdown', 'touchstart', 'scroll', 'keydown'].forEach(ev => addEventListener(ev, kick, { passive: true }));
  // the site has no pause control, so any pause is the browser's (background tab, power saving) — resume when visible
  document.addEventListener('visibilitychange', () => { if (!document.hidden) kick(); });
  video.addEventListener('pause', () => { if (!document.hidden) setTimeout(kick, 400); });

  /* ── toast ─────────────────────────────────────────────────────── */
  const toastEl = $('.toast');
  let toastT;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('is-on');
    clearTimeout(toastT);
    toastT = setTimeout(() => toastEl.classList.remove('is-on'), 1700);
  }

  /* ── header ────────────────────────────────────────────────────── */
  const header = $('.header');
  function setActiveNav() {
    const key = { index: 'index', work: 'work', project: 'work', about: 'about', contact: 'contact' }[document.body.dataset.page];
    const links = $$('.nav a');
    const ind = $('.nav-ind');
    links.forEach(a => a.classList.toggle('is-active', a.dataset.nav === key));
    const act = links.find(a => a.dataset.nav === key);
    if (act) {
      ind.style.opacity = 1;
      ind.style.width = act.offsetWidth + 'px';
      ind.style.transform = `translateX(${act.offsetLeft}px)`;
    } else ind.style.opacity = 0;
  }
  addEventListener('resize', setActiveNav);

  /* ── page lifecycle ────────────────────────────────────────────── */
  let ctx = null;
  let cleanups = [];
  let intro = null;
  const onCleanup = fn => cleanups.push(fn);

  function initPage() {
    const view = $('[data-view]');
    const key = view.dataset.view;
    document.body.dataset.page = key;
    setActiveNav();
    const footerEl = $('[data-footer]', view);
    if (footerEl) footerEl.innerHTML = footerHTML();
    const page = PAGES[key] || {};
    ctx = gsap.context(() => {
      intro = gsap.timeline({ paused: true });
      page.render && page.render(view);
      common(view);
      page.init && page.init(view);
    }, view);
    ScrollTrigger.refresh();
  }
  function destroyPage() {
    cleanups.forEach(fn => fn());
    cleanups = [];
    if (ctx) ctx.revert();
    ctx = null;
    ScrollTrigger.getAll().forEach(t => t.kill());
  }
  const playIntro = () => intro && intro.play();

  /* ── shared behaviour ──────────────────────────────────────────── */
  function common(view) {
    headerTheme(view);
    splitReveals(view);
    scrubWords(view);
    reveals(view);
    tiles(view);
    marquees(view);
    counters(view);
    capsList(view);
    coversInView(view);
    copyables(view);
    nextCta(view);
    footerAnim(view);
    clocks(view);
    $$('[data-top]', view).forEach(b => b.addEventListener('click', e => { e.preventDefault(); scroller.top(false); }));
    $$('[data-year]', view).forEach(el => { el.textContent = new Date().getFullYear(); });
  }

  function headerTheme(view) {
    const secs = $$('[data-theme], [data-header]', view);
    const themeOf = sec => sec.dataset.header || sec.dataset.theme;
    if (secs[0]) header.dataset.theme = themeOf(secs[0]);
    secs.forEach(sec => ScrollTrigger.create({
      trigger: sec, start: 'top 36px', end: 'bottom 36px',
      onToggle: s => { if (s.isActive) header.dataset.theme = themeOf(sec); }
    }));
  }

  function splitReveals(view) {
    $$('[data-split]', view).forEach(el => {
      const isIntro = el.hasAttribute('data-intro');
      let first = true;
      SplitText.create(el, {
        type: 'lines', mask: 'lines', autoSplit: true,
        onSplit(self) {
          if (reduce) return;
          if (isIntro) {
            if (!first) return;
            first = false;
            const tw = gsap.from(self.lines, { yPercent: 110, duration: 1.3, ease: 'expo.out', stagger: 0.09 });
            intro.add(tw, 0.1);
            return tw;
          }
          return gsap.from(self.lines, {
            yPercent: 110, duration: 1.15, ease: 'expo.out', stagger: 0.08,
            scrollTrigger: { trigger: el, start: 'top 88%', once: true }
          });
        }
      });
    });
  }

  function scrubWords(view) {
    $$('[data-scrub-words]', view).forEach(el => {
      const split = SplitText.create(el, { type: 'words' });
      if (reduce) return;
      gsap.fromTo(split.words, { opacity: 0.14 }, {
        opacity: 1, stagger: 0.1, ease: 'none',
        scrollTrigger: { trigger: el, start: 'top 82%', end: 'bottom 48%', scrub: true }
      });
    });
  }

  function reveals(view) {
    if (reduce) return;
    $$('[data-reveal]', view).forEach(el => gsap.from(el, {
      y: 40, opacity: 0, duration: 1.1, ease: 'expo.out',
      scrollTrigger: { trigger: el, start: 'top 90%', once: true }
    }));
    $$('[data-reveal-group]', view).forEach(g => gsap.from(g.children, {
      y: 40, opacity: 0, duration: 1, ease: 'expo.out', stagger: 0.07,
      scrollTrigger: { trigger: g, start: 'top 88%', once: true }
    }));
  }

  function tiles(view) {
    $$('[data-tiles]', view).forEach(band => {
      const cols = innerWidth < 700 ? 5 : 10;
      band.innerHTML = `<div class="tiles-grid">${'<i></i>'.repeat(cols)}</div>`;
      const bars = $$('i', band);
      if (reduce) { gsap.set(bars, { scaleY: 1 }); return; }
      const delays = bars.map(() => Math.random() * 0.6);
      gsap.to(bars, {
        scaleY: 1, ease: 'none', stagger: i => delays[i],
        scrollTrigger: { trigger: band, start: 'top bottom', end: 'top 15%', scrub: true }
      });
    });
  }

  function marquees(view) {
    $$('[data-marquee]', view).forEach(el => {
      const inner = $('.marquee-inner', el);
      inner.innerHTML += inner.innerHTML;
      if (reduce) return;
      const base = 80 * parseFloat(el.dataset.speed || '1');
      let x = 0, dir = -1, boost = 0;
      const tick = (t, dt) => {
        boost *= 0.93;
        const half = inner.scrollWidth / 2;
        x += dir * (base + boost) * (dt / 1000);
        if (x <= -half) x += half;
        if (x > 0) x -= half;
        inner.style.transform = `translate3d(${x}px,0,0)`;
      };
      gsap.ticker.add(tick);
      onCleanup(() => gsap.ticker.remove(tick));
      onCleanup(onLenisScroll(l => {
        if (l.direction) dir = l.direction > 0 ? -1 : 1;
        boost = Math.min(Math.abs(l.velocity) * 45, 1600);
      }));
    });
  }

  function counters(view) {
    $$('[data-count]', view).forEach(el => {
      const val = el.dataset.count;
      const digits = val.replace(/\D/g, '');
      const strip = '0123456789'.repeat(2).split('').map(n => `<span>${n}</span>`).join('');
      el.innerHTML = [...val].map(ch => (/\d/.test(ch)
        ? `<span class="dg"><span class="dg-strip">${strip}</span></span>`
        : `<span>${ch}</span>`)).join('');
      el.setAttribute('aria-label', val);
      const strips = $$('.dg-strip', el);
      const target = i => -(10 + +digits[i]) * 5;
      if (reduce) { strips.forEach((s, i) => gsap.set(s, { yPercent: target(i) })); return; }
      gsap.to(strips, {
        yPercent: i => target(i), duration: 2.2, ease: 'expo.out', stagger: 0.12,
        scrollTrigger: { trigger: el, start: 'top 88%', once: true }
      });
    });
  }

  function capsList(view) {
    $$('.caps-list li', view).forEach(li => ScrollTrigger.create({
      trigger: li, start: 'top 58%', end: 'bottom 58%', toggleClass: 'is-active'
    }));
  }

  function coversInView(view) {
    const io = new IntersectionObserver(es => es.forEach(e => e.target.classList.toggle('is-inview', e.isIntersecting)), { threshold: 0.2 });
    $$('.cv', view).forEach(c => io.observe(c));
    onCleanup(() => io.disconnect());
  }

  function copyables(view) {
    $$('[data-copy]', view).forEach(el => el.addEventListener('click', async e => {
      e.preventDefault();
      try {
        await navigator.clipboard.writeText(el.dataset.copy);
        toast('Copied — ' + el.dataset.copy);
      } catch {
        toast(el.dataset.copy);
      }
    }));
  }

  function nextCta(view) {
    if (reduce) return;
    $$('.next', view).forEach(sec => {
      const l = $('[data-next-l]', sec), r = $('[data-next-r]', sec), title = $('.next-title', sec);
      const st = () => ({ trigger: sec, start: 'top bottom', end: 'center 55%', scrub: true, invalidateOnRefresh: true });
      gsap.fromTo(l, { x: 0 }, { x: () => -innerWidth * 0.28, ease: 'none', scrollTrigger: st() });
      gsap.fromTo(r, { x: 0 }, { x: () => innerWidth * 0.28, ease: 'none', scrollTrigger: st() });
      gsap.fromTo(title, { scale: 0.72, opacity: 0.15 }, {
        scale: 1, opacity: 1, ease: 'none',
        scrollTrigger: { trigger: sec, start: 'top 85%', end: 'center 55%', scrub: true }
      });
    });
  }

  function footerHTML() {
    const word = 'Darg'.split('').map((ch, i) => `<span class="fw-l" style="--i:${i}"><span>${ch}</span><span aria-hidden="true">${ch}</span></span>`).join('');
    return `
      <div class="container">
        <div class="footer-top">
          <a class="footer-word" href="#top" data-top aria-label="Darg — back to top">${word}</a>
          <div class="footer-clock" data-clock><span class="tz">Local time</span><span class="time">--:--</span></div>
        </div>
        <div class="footer-cols">
          <div>
            <h4>Work with me</h4>
            <a href="mailto:dargdargdargdarg@proton.me" data-copy="dargdargdargdarg@proton.me">dargdargdargdarg@proton.me</a>
            <a href="contact.html" data-copy="dargdargdargdarg">Discord — dargdargdargdarg</a>
            <a href="https://github.com/Darguon" target="_blank" rel="noopener">GitHub — Darguon</a>
          </div>
          <div>
            <h4>Sitemap</h4>
            <a href="index.html">Index</a><a href="work.html">Work</a><a href="about.html">About</a><a href="contact.html">Contact</a>
          </div>
          <div>
            <h4>Now playing</h4>
            <p>Hate Bein' Sober</p><p>Chief Keef, 50 Cent &amp; Wiz Khalifa</p>
          </div>
        </div>
        <div class="footer-bottom"><span>© <span data-year></span> Darg</span><button type="button" data-top>Back to top ↑</button></div>
      </div>`;
  }

  function footerAnim(view) {
    const f = $('[data-footer]', view);
    if (!f || reduce) return;
    gsap.from($$('.fw-l > span:first-child', f), {
      yPercent: 105, duration: 1.3, ease: 'expo.out', stagger: 0.07, clearProps: 'transform',
      scrollTrigger: { trigger: f, start: 'top 75%', once: true }
    });
  }

  function clocks(view) {
    const els = $$('[data-clock]', view);
    if (!els.length) return;
    const tf = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Helsinki', hour: '2-digit', minute: '2-digit' });
    let zf = null;
    try { zf = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Helsinki', timeZoneName: 'shortOffset' }); } catch { /* unsupported */ }
    const tick = () => {
      const d = new Date();
      const z = zf ? (zf.formatToParts(d).find(p => p.type === 'timeZoneName') || {}).value : '';
      els.forEach(el => {
        $('.time', el).textContent = tf.format(d);
        $('.tz', el).textContent = z ? `Local time — ${z}` : 'Local time';
      });
    };
    tick();
    const id = setInterval(tick, 10000);
    onCleanup(() => clearInterval(id));
  }

  /* ── home ──────────────────────────────────────────────────────── */
  const Index = {
    render(view) {
      const hero = $('.hero', view);
      const items = P.filter(p => p.hero);
      hero.style.setProperty('--n', items.length);
      $('.hero-slides', hero).innerHTML = items.map((p, i) => `
        <a class="hero-slide${i ? '' : ' is-active'}" href="project.html?p=${p.slug}" draggable="false">
          <h2 class="hero-title">${p.name}</h2>
          <div class="hero-meta"><span>${p.category}</span><span>${statusLabel(p)}</span></div>
        </a>`).join('');
      $('.hero-tabs', hero).innerHTML = items.map((p, i) => `
        <button class="hero-tab${i ? '' : ' is-active'}" type="button" aria-label="Show ${p.name}">
          <span class="hero-tab-num">${pad(i + 1)}.</span><span class="hero-tab-bar"><i></i></span>
        </button>`).join('');

      const feat = P.filter(p => p.grid);
      $('[data-feat-grid]', view).innerHTML = feat.map((p, i) => `
        <a class="feat-item feat-item--${i % 2 ? 'r' : 'l'}" href="project.html?p=${p.slug}">
          <span class="feat-num">${pad(i + 1)}</span>
          <div class="feat-media"><div class="feat-media-inner">${coverHTML(p)}</div></div>
          <div class="feat-info"><span>${p.name}</span><span>${p.category}</span></div>
        </a>`).join('');
      $('[data-total]', view).textContent = `(${pad(P.length)})`;
    },
    init(view) {
      heroSlider(view);
      featured(view);
      const star = $('.see-all-star', view);
      if (star && !reduce) gsap.to(star, { rotate: 360, ease: 'none', scrollTrigger: { trigger: star, start: 'top bottom', end: 'bottom top', scrub: true } });
    }
  };

  function heroSlider(view) {
    const hero = $('.hero', view);
    if (!hero) return;
    const items = P.filter(p => p.hero);
    const slides = $$('.hero-slide', hero);
    const tabs = $$('.hero-tab', hero);
    const titles = slides.map(s => $('.hero-title', s));
    const metas = slides.map(s => $('.hero-meta', s));
    const tint = $('.hero-tint', hero);
    // words wrap the chars so titles can only break between words, never mid-word
    const splits = titles.map(t => SplitText.create(t, { type: 'words,chars', mask: 'chars' }));
    const DUR = 6;
    let cur = 0, prog = null, inView = true;

    splits.forEach(s => gsap.set(s.chars, { yPercent: 110 }));
    gsap.set(metas, { opacity: 0 });
    gsap.set(tint, { backgroundColor: items[0].tint });

    intro
      .from($('.hero-inner', hero), { y: 50, opacity: 0, duration: 1.3, ease: 'expo.out' }, 0.25)
      .to(splits[0].chars, { yPercent: 0, duration: 1.3, ease: 'expo.out', stagger: 0.035 }, 0.1)
      .to(metas[0], { opacity: 1, duration: 0.8 }, 0.7)
      .add(() => startProgress(), 0.5);

    function startProgress() {
      if (prog) prog.kill();
      tabs.forEach((t, i) => {
        t.classList.toggle('is-active', i === cur);
        gsap.set($('i', t), { scaleX: i < cur ? 1 : 0 });
      });
      prog = gsap.fromTo($('i', tabs[cur]), { scaleX: 0 }, { scaleX: 1, duration: DUR, ease: 'none', onComplete: () => go(cur + 1, 1) });
      if (!inView) prog.pause();
    }

    function go(n, dir) {
      const next = (n + slides.length) % slides.length;
      if (next === cur) return;
      const prev = cur;
      cur = next;
      slides[prev].classList.remove('is-active');
      slides[cur].classList.add('is-active');
      if (reduce) {
        gsap.set(splits[prev].chars, { yPercent: 110 });
        gsap.set(splits[cur].chars, { yPercent: 0 });
        gsap.to(metas[prev], { opacity: 0, duration: 0.2 });
        gsap.to(metas[cur], { opacity: 1, duration: 0.3 });
      } else {
        gsap.to(splits[prev].chars, { yPercent: -110 * dir, duration: 0.75, ease: 'power3.inOut', stagger: 0.015, overwrite: true });
        gsap.fromTo(splits[cur].chars, { yPercent: 110 * dir }, { yPercent: 0, duration: 1.15, ease: 'expo.out', stagger: 0.025, delay: 0.35, overwrite: true });
        gsap.to(metas[prev], { opacity: 0, duration: 0.3, overwrite: true });
        gsap.to(metas[cur], { opacity: 1, duration: 0.6, delay: 0.65, overwrite: true });
      }
      gsap.to(tint, { backgroundColor: items[cur].tint, duration: 1.2, ease: 'power2.inOut' });
      startProgress();
    }

    tabs.forEach((t, i) => t.addEventListener('click', () => go(i, i > cur ? 1 : -1)));
    $('[data-hero-prev]', hero).addEventListener('click', () => go(cur - 1, -1));
    $('[data-hero-next]', hero).addEventListener('click', () => go(cur + 1, 1));

    ScrollTrigger.create({
      trigger: hero, start: 'top top', end: 'bottom top',
      onToggle: s => { inView = s.isActive; if (prog) inView ? prog.resume() : prog.pause(); }
    });

    // drag / swipe — feedback starts on pointerdown, commits on release using distance or velocity
    let sx = 0, dx = 0, t0 = 0, down = false, moved = false;
    hero.addEventListener('pointerdown', e => {
      if (e.button !== 0) return;
      down = true; moved = false; sx = e.clientX; dx = 0; t0 = performance.now();
    });
    const onMove = e => {
      if (!down) return;
      dx = e.clientX - sx;
      if (Math.abs(dx) > 8) moved = true;
      if (moved && !reduce) gsap.to(titles[cur], { x: dx * 0.3, duration: 0.4, ease: 'power3.out', overwrite: 'auto' });
    };
    const onUp = () => {
      if (!down) return;
      down = false;
      const v = dx / Math.max(1, performance.now() - t0);
      gsap.to(titles, { x: 0, duration: 0.9, ease: 'expo.out' });
      if (moved) {
        if (dx < -60 || v < -0.45) go(cur + 1, 1);
        else if (dx > 60 || v > 0.45) go(cur - 1, -1);
      }
    };
    addEventListener('pointermove', onMove);
    addEventListener('pointerup', onUp);
    addEventListener('pointercancel', onUp);
    onCleanup(() => {
      removeEventListener('pointermove', onMove);
      removeEventListener('pointerup', onUp);
      removeEventListener('pointercancel', onUp);
      if (prog) prog.kill();
    });
    hero.addEventListener('click', e => { if (moved) { e.preventDefault(); moved = false; } }, true);

    if (!reduce) {
      gsap.to($('.stage-inner'), { scale: 1.18, ease: 'none', scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true } });
      gsap.to($('.hero-content', hero), { yPercent: 22, opacity: 0, ease: 'none', scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true } });
    }

    // cursor label
    const dc = $('.dc', view);
    if (dc && fine && !reduce) {
      const label = $('.dc-in', dc);
      let tx = 0, ty = 0, cx = 0, cy = 0;
      const tick = () => {
        cx += (tx - cx) * 0.2; cy += (ty - cy) * 0.2;
        dc.style.transform = `translate3d(${cx}px,${cy}px,0)`;
        // scrolling moves the hero out from under a still pointer without firing pointerleave
        if (dc.classList.contains('is-on') && ty > hero.getBoundingClientRect().bottom) dc.classList.remove('is-on');
      };
      hero.addEventListener('pointerenter', e => { cx = tx = e.clientX; cy = ty = e.clientY; dc.classList.add('is-on'); });
      hero.addEventListener('pointerleave', () => dc.classList.remove('is-on'));
      hero.addEventListener('pointermove', e => {
        tx = e.clientX; ty = e.clientY;
        const overBtn = !!e.target.closest('button');
        dc.classList.toggle('is-hidden', overBtn);
        label.textContent = e.target.closest('.hero-slide.is-active') ? 'View' : 'Drag';
      });
      gsap.ticker.add(tick);
      onCleanup(() => gsap.ticker.remove(tick));
    }
  }

  function featured(view) {
    if (reduce) return;
    $$('.feat-item', view).forEach(item => {
      const media = $('.feat-media', item), inner = $('.feat-media-inner', item);
      gsap.fromTo(media, { clipPath: 'inset(100% 0% 0% 0%)' }, {
        clipPath: 'inset(0% 0% 0% 0%)', duration: 1.3, ease: 'expo.inOut',
        scrollTrigger: { trigger: item, start: 'top 88%', once: true }
      });
      gsap.fromTo(inner, { yPercent: -7 }, {
        yPercent: 7, ease: 'none',
        scrollTrigger: { trigger: item, start: 'top bottom', end: 'bottom top', scrub: true }
      });
      gsap.from($$('.feat-num, .feat-info', item), {
        opacity: 0, y: 16, duration: 0.9, ease: 'expo.out', stagger: 0.08,
        scrollTrigger: { trigger: item, start: 'top 80%', once: true }
      });
    });
  }

  /* ── work ──────────────────────────────────────────────────────── */
  const Work = {
    render(view) {
      $('[data-work-list]', view).innerHTML = P.map((p, i) => `
        <li class="wr" data-status="${p.status}">
          <a class="wr-link" href="project.html?p=${p.slug}" data-i="${i}">
            <span class="wr-num">${pad(i + 1)}</span>
            <span class="wr-name">${p.name}</span>
            <span class="wr-cat">${p.category}</span>
            <span class="wr-status${p.status === 'active' ? '' : ' is-archived'}">${statusLabel(p)}</span>
          </a>
          <div class="wr-cover">${coverHTML(p)}</div>
        </li>`).join('');
      $('.wp-track', view).innerHTML = P.map(p => `<div class="wp-item">${coverHTML(p)}</div>`).join('');
      $('[data-work-count]', view).textContent = `(${pad(P.length)})`;
    },
    init(view) {
      const list = $('[data-work-list]', view);
      const rows = $$('.wr', list);
      $$('.wp .cv', view).forEach(c => c.classList.add('is-inview'));
      if (!reduce) gsap.from(rows, { y: 60, opacity: 0, duration: 1.1, ease: 'expo.out', stagger: 0.06, scrollTrigger: { trigger: list, start: 'top 88%', once: true } });

      const wp = $('.wp', view), track = $('.wp-track', view);
      if (fine && !reduce) {
        gsap.set(wp, { yPercent: -100, scale: 0.85, transformOrigin: '0% 100%' });
        let tx = innerWidth / 2, ty = innerHeight / 2, cx = tx, cy = ty, shown = false;
        const setX = gsap.quickSetter(wp, 'x', 'px'), setY = gsap.quickSetter(wp, 'y', 'px');
        // sit above-right of the cursor so the hovered row stays readable; clamped to the viewport
        const tick = () => {
          const x = Math.min(tx + 28, innerWidth - wp.offsetWidth - 16);
          const y = Math.max(ty - 28, wp.offsetHeight + 16);
          cx += (x - cx) * 0.14; cy += (y - cy) * 0.14; setX(cx); setY(cy);
        };
        gsap.ticker.add(tick);
        onCleanup(() => gsap.ticker.remove(tick));
        list.addEventListener('pointermove', e => { tx = e.clientX; ty = e.clientY; });
        $$('.wr-link', list).forEach(a => a.addEventListener('pointerenter', () => {
          gsap.to(track, { yPercent: -100 * (+a.dataset.i) / P.length, duration: 0.8, ease: 'expo.out' });
          if (!shown) { shown = true; gsap.to(wp, { opacity: 1, scale: 1, duration: 0.5, ease: 'expo.out' }); }
        }));
        list.addEventListener('pointerleave', () => { shown = false; gsap.to(wp, { opacity: 0, scale: 0.85, duration: 0.4, ease: 'expo.out' }); });
      }

      const btns = $$('[data-filter]', view);
      btns.forEach(b => b.addEventListener('click', () => {
        const f = b.dataset.filter;
        btns.forEach(x => x.classList.toggle('is-active', x === b));
        let n = 0;
        rows.forEach(row => {
          const show = f === 'all' || row.dataset.status === f;
          if (show) n++;
          if (show && row.hidden) {
            row.hidden = false;
            gsap.fromTo(row, { height: 0, opacity: 0 }, { height: 'auto', opacity: 1, duration: 0.6, ease: 'expo.out', clearProps: 'height' });
          } else if (!show && !row.hidden) {
            gsap.to(row, { height: 0, opacity: 0, duration: 0.45, ease: 'expo.out', onComplete: () => { row.hidden = true; gsap.set(row, { clearProps: 'height,opacity' }); } });
          }
        });
        const countEl = $('[data-work-count]', view);
        if (countEl) countEl.textContent = `(${pad(n)})`;
        gsap.delayedCall(0.7, () => ScrollTrigger.refresh());
      }));
    }
  };

  /* ── project ───────────────────────────────────────────────────── */
  const Project = {
    render(view) {
      const slug = new URLSearchParams(location.search).get('p');
      let i = P.findIndex(p => p.slug === slug);
      if (i < 0) i = 0;
      const p = P[i], nx = P[(i + 1) % P.length];
      document.title = `${p.name} — Darg`;
      const set = (k, html) => { const el = $(`[data-proj="${k}"]`, view); if (el) el.innerHTML = html; };
      set('index', `(${pad(i + 1)} / ${pad(P.length)})`);
      set('name', p.name);
      set('category', p.category);
      set('role', p.role);
      set('status', statusLabel(p));
      set('stackline', p.stack.slice(0, 3).join(', '));
      set('cover', coverHTML(p));
      set('summary', p.summary);
      set('points', p.points.map(t => `<li>${t}</li>`).join(''));
      set('stack', p.stack.map(t => `<li>${t}</li>`).join(''));
      set('next-name', nx.name);
      $('[data-proj-next]', view).href = `project.html?p=${nx.slug}`;
      const hex = p.cover.bg.replace('#', '');
      const [r, g, b] = [0, 2, 4].map(o => parseInt(hex.slice(o, o + 2), 16));
      $('.proj-cover', view).dataset.theme = (0.299 * r + 0.587 * g + 0.114 * b) < 140 ? 'dark' : 'light';
    },
    init(view) {
      if (!reduce) intro.from($$('.proj-meta > div', view), { y: 24, opacity: 0, duration: 1, ease: 'expo.out', stagger: 0.07 }, 0.45);
      const sec = $('.proj-cover', view), inner = $('.proj-cover-inner', view);
      if (!sec || reduce) return;
      gsap.fromTo(sec, { clipPath: 'inset(10% 5% 10% 5%)' }, { clipPath: 'inset(0% 0% 0% 0%)', ease: 'none', scrollTrigger: { trigger: sec, start: 'top bottom', end: 'top 15%', scrub: true } });
      gsap.fromTo(inner, { yPercent: -8 }, { yPercent: 8, ease: 'none', scrollTrigger: { trigger: sec, start: 'top bottom', end: 'bottom top', scrub: true } });
    }
  };

  /* ── about ─────────────────────────────────────────────────────── */
  const About = {
    render(view) {
      const el = $('[data-current]', view);
      if (el) el.innerHTML = P.filter(p => p.status === 'active').map((p, i) => `
        <li><a href="project.html?p=${p.slug}">
          <span class="cur-n">${pad(i + 1)}</span><span class="cur-name">${p.name}</span>
          <span class="cur-cat">${p.category}</span><span class="cur-arrow">→</span>
        </a></li>`).join('');
    },
    init(view) {
      const sec = $('.process', view), track = $('.process-track', view);
      if (!sec || reduce || innerWidth <= 760) return;
      gsap.to(track, {
        x: () => -(track.scrollWidth - innerWidth), ease: 'none',
        // refreshPriority: measured before the triggers below it, which were created earlier but must include its pin spacing
        scrollTrigger: { trigger: sec, start: 'top top', end: () => '+=' + (track.scrollWidth - innerWidth), pin: true, scrub: 1, invalidateOnRefresh: true, anticipatePin: 1, refreshPriority: 1 }
      });
    }
  };

  const PAGES = { index: Index, work: Work, project: Project, about: About, contact: {} };

  /* ── page transitions (ajax, so the audio keeps playing) ───────── */
  const pt = $('.pt');
  const ptCols = $$('.pt-col', pt);
  const ptLabel = $('.pt-label', pt);
  let busy = false;

  function labelFor(href) {
    const u = new URL(href, location.href);
    const file = u.pathname.split('/').pop() || 'index.html';
    if (file.startsWith('project')) {
      const p = P.find(x => x.slug === u.searchParams.get('p'));
      return p ? p.name : 'Project';
    }
    return { 'index.html': 'Index', 'work.html': 'Work', 'about.html': 'About', 'contact.html': 'Contact' }[file] || '';
  }
  function coverScreen(label) {
    pt.classList.add('is-active');
    ptLabel.textContent = label;
    scroller.stop();
    const tl = gsap.timeline();
    if (reduce) return tl.set(ptCols, { scaleY: 1 }).fromTo(pt, { opacity: 0 }, { opacity: 1, duration: 0.25 });
    return tl
      .set(ptCols, { transformOrigin: '50% 100%' })
      .to(ptCols, { scaleY: 1, duration: 0.75, ease: 'expo.inOut', stagger: 0.05 })
      .fromTo(ptLabel, { yPercent: 60, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.5, ease: 'expo.out' }, '-=0.3');
  }
  function revealScreen() {
    const done = () => { pt.classList.remove('is-active'); scroller.start(); };
    const tl = gsap.timeline({ onComplete: done });
    if (reduce) return tl.to(pt, { opacity: 0, duration: 0.25 }).set(ptCols, { scaleY: 0 }).set(pt, { opacity: 1 });
    return tl
      .to(ptLabel, { opacity: 0, duration: 0.25 })
      .set(ptCols, { transformOrigin: '50% 0%' })
      .to(ptCols, { scaleY: 0, duration: 0.85, ease: 'expo.inOut', stagger: 0.05 });
  }

  async function navigate(href, push = true) {
    if (busy) return;
    busy = true;
    const req = fetch(href, { credentials: 'same-origin' }).then(r => { if (!r.ok) throw new Error(r.status); return r.text(); });
    await coverScreen(labelFor(href));
    let html;
    try { html = await req; } catch { location.href = href; return; }
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const next = doc.querySelector('[data-view]');
    if (!next) { location.href = href; return; }
    destroyPage();
    $('[data-view]').replaceWith(document.adoptNode(next));
    document.title = doc.title;
    if (push) history.pushState({}, '', href);
    scroller.top(true);
    initPage();
    const reveal = revealScreen();
    gsap.delayedCall(reduce ? 0 : 0.45, playIntro);
    await reveal;
    busy = false;
  }

  document.addEventListener('click', e => {
    const a = e.target.closest('a[href]');
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if ((a.target && a.target !== '_self') || a.hasAttribute('download')) return;
    const url = new URL(a.href, location.href);
    if (url.origin !== location.origin || location.protocol === 'file:') return;
    if (!/(\.html|\/)$/.test(url.pathname)) return;
    e.preventDefault();
    const same = url.pathname === location.pathname && url.search === location.search;
    if (same) { scroller.top(false); return; }
    navigate(url.href);
  });
  addEventListener('popstate', () => navigate(location.href, false));
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

  /* ── first load: preloader + sound gate ────────────────────────── */
  function preloader() {
    const pl = $('.preloader');
    const num = $('.pl-num', pl), label = $('.pl-label', pl);
    scroller.stop();
    const ready = Promise.race([
      new Promise(r => { if (video.readyState >= 3) r(); else video.addEventListener('canplay', r, { once: true }); }),
      new Promise(r => setTimeout(r, 5000))
    ]);
    const c = { v: 0 };
    const render = () => { num.textContent = Math.round(c.v); };
    const climb = gsap.to(c, { v: 88, duration: reduce ? 0.3 : 1.8, ease: 'power2.inOut', onUpdate: render });
    Promise.all([ready, climb.then()]).then(() => {
      gsap.to(c, {
        v: 100, duration: 0.45, ease: 'power2.out', onUpdate: render,
        onComplete: () => {
          label.textContent = 'Click anywhere to enter — sound on';
          pl.classList.add('is-ready');
          const enter = () => {
            pl.removeEventListener('click', enter);
            removeEventListener('keydown', enter);
            session.set('darg-entered', '1');
            setSound(true);
            gsap.to($('.pl-content', pl), { opacity: 0, duration: 0.3 });
            gsap.to($$('.pl-col', pl), { yPercent: -100, duration: reduce ? 0.3 : 1.05, ease: 'expo.inOut', stagger: reduce ? 0 : 0.06 });
            gsap.delayedCall(reduce ? 0.2 : 0.55, () => { document.documentElement.classList.remove('is-loading'); playIntro(); });
            gsap.delayedCall(reduce ? 0.4 : 1.4, () => { pl.remove(); scroller.start(); });
          };
          pl.addEventListener('click', enter);
          addEventListener('keydown', enter);
        }
      });
    });
  }

  async function boot() {
    try { await Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 2500))]); } catch { /* fonts API missing */ }
    initPage();
    if (session.get('darg-entered') === '1') {
      gsap.set(ptCols, { scaleY: 1 });
      pt.classList.add('is-active');
      $('.preloader').remove();
      document.documentElement.classList.remove('is-loading');
      armSoundUnlock();
      await revealScreen();
      playIntro();
    } else {
      preloader();
    }
  }
  boot();
})();
