(() => {
  'use strict';

  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const pad = n => String(n).padStart(2, '0');
  const P = window.PROJECTS;
  const statusLabel = p => (p.status === 'active' ? 'Active' : 'Discontinued');
  const esc = s => String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
  const store = area => ({
    get(k) { try { return window[area].getItem(k); } catch { return null; } },
    set(k, v) { try { window[area].setItem(k, v); } catch { /* storage blocked */ } }
  });
  const session = store('sessionStorage');
  const local = store('localStorage');

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
      // force: Lenis ignores scrollTo while stopped, which it is during scene changes
      if (immediate) window.scrollTo(0, 0);
      if (lenis) lenis.scrollTo(0, { immediate, duration: 1.6, force: true });
      else if (!immediate) window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    stop() { lenis && lenis.stop(); },
    start() { lenis && lenis.start(); }
  };

  /* ── the film + soundtrack (one element, persists across scenes) ── */
  const video = $('#bgVideo');
  const playBtn = $('[data-play]');
  const soundBtn = $('[data-sound]');
  const fill = $('[data-fill]');
  const seek = $('[data-seek]');
  const timeEl = $('[data-time]');
  const tcEl = $('[data-tc]');
  const vignette = $('.vignette');
  const vuBars = $$('[data-vu] i');
  let userPaused = false;

  let audioCtx = null, analyser = null, freq = null;
  function initAnalyser() {
    if (audioCtx) { audioCtx.resume(); return; }
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const src = audioCtx.createMediaElementSource(video);
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      freq = new Uint8Array(analyser.frequencyBinCount);
      src.connect(analyser);
      analyser.connect(audioCtx.destination);
    } catch { analyser = null; }
  }

  function setSound(on) {
    if (on) initAnalyser();
    video.muted = !on;
    if (on) userPaused = false;
    if (video.paused && !userPaused) video.play().catch(() => {});
    soundBtn.classList.remove('is-waiting');
    soundBtn.setAttribute('aria-pressed', String(on));
    soundBtn.textContent = on ? 'Mute' : 'Unmute';
    local.set('darg-sound', on ? '1' : '0');
  }
  soundBtn.addEventListener('click', () => setSound(video.muted));

  // Browsers only allow sound after a click or key press. When the leader is skipped (a reload in the
  // same session), turn sound back on at the visitor's first click — unless they muted it last time.
  function armSoundUnlock() {
    if (local.get('darg-sound') === '0') { soundBtn.textContent = 'Unmute'; return; }
    soundBtn.classList.add('is-waiting');
    soundBtn.textContent = 'Click for sound';
    const evs = ['click', 'keydown'];
    const off = () => evs.forEach(ev => removeEventListener(ev, unlock, true));
    const unlock = e => {
      off();
      if (e.target.closest && e.target.closest('[data-sound],[data-play]')) return; // those buttons handle it
      setSound(true);
    };
    evs.forEach(ev => addEventListener(ev, unlock, true));
  }

  const setPlayIcon = () => {
    playBtn.textContent = video.paused ? '▶' : '❚❚';
    playBtn.setAttribute('aria-label', video.paused ? 'Play' : 'Pause');
  };
  playBtn.addEventListener('click', () => {
    if (video.paused) { userPaused = false; if (!video.muted) initAnalyser(); video.play().catch(() => {}); }
    else { userPaused = true; video.pause(); }
  });
  ['play', 'playing', 'pause'].forEach(ev => video.addEventListener(ev, setPlayIcon));
  setPlayIcon();

  // some mobile browsers reject the first muted autoplay, and background tabs get paused — retry unless the visitor paused it
  const kick = () => { if (video.paused && !userPaused) video.play().catch(() => {}); };
  video.muted = true;
  kick();
  video.addEventListener('canplay', kick);
  ['pointerdown', 'touchstart', 'scroll', 'keydown'].forEach(ev => addEventListener(ev, kick, { passive: true }));
  document.addEventListener('visibilitychange', () => { if (!document.hidden) kick(); });
  video.addEventListener('pause', () => { if (!document.hidden && !userPaused) setTimeout(kick, 400); });

  const fmt = s => { s = Math.max(0, s | 0); return ((s / 60) | 0) + ':' + pad(s % 60); };
  const frameTC = t => { t = Math.max(0, t); return `${pad(t / 3600 | 0)}:${pad(t % 3600 / 60 | 0)}:${pad(t % 60 | 0)}:${pad((t % 1) * 24 | 0)}`; };
  video.addEventListener('timeupdate', () => {
    if (!video.duration) return;
    const p = video.currentTime / video.duration;
    fill.style.width = (p * 100) + '%';
    seek.value = (p * 1000) | 0;
    timeEl.textContent = `${fmt(video.currentTime)} / ${fmt(video.duration)}`;
  });
  seek.addEventListener('input', () => { if (video.duration) video.currentTime = (seek.value / 1000) * video.duration; });

  // per frame: timecode, VU meter, and the bass gently breathing through the vignette and the title
  let bassSmooth = 0, heroTitle = null;
  gsap.ticker.add(time => {
    tcEl.textContent = frameTC(video.currentTime || 0);
    const playing = !video.paused && !video.muted;
    let bass = 0;
    if (analyser && playing) {
      analyser.getByteFrequencyData(freq);
      bass = Math.min(1, (freq[0] * 1.2 + freq[1] + freq[2] * 0.8) / (3 * 255));
      vuBars.forEach((b, i) => {
        const v = freq[Math.floor(i * freq.length / vuBars.length)] / 255;
        b.style.transform = `scaleY(${0.08 + v * 0.92})`;
        b.classList.toggle('hi', v > 0.5);
        b.classList.toggle('peak', v > 0.85);
      });
    } else {
      vuBars.forEach((b, i) => {
        const v = playing
          ? Math.abs(Math.sin(time * 2.4 + i * 0.42) * Math.cos(time * 3.1 + i * 0.28)) * 0.8 + Math.random() * 0.15
          : (Math.sin(time * 1.1 + i * 0.35) + 1) * 0.05;
        b.style.transform = `scaleY(${playing ? 0.08 + v * 0.92 : 0.06 + v})`;
        b.classList.toggle('hi', v > 0.5);
        b.classList.toggle('peak', v > 0.85);
      });
    }
    if (reduce) return;
    bassSmooth += (bass - bassSmooth) * 0.35;
    vignette.style.boxShadow = `inset 0 0 ${240 + bassSmooth * 60 | 0}px 70px rgba(0,0,0,${(0.78 - bassSmooth * 0.34).toFixed(3)})`;
    if (heroTitle) heroTitle.style.transform = playing ? `scale(${(1 + bassSmooth * 0.014).toFixed(5)})` : '';
  });

  /* ── dossier date ──────────────────────────────────────────────── */
  const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const dateEl = $('[data-date]');
  const tickDate = () => { const d = new Date(); if (dateEl) dateEl.textContent = `${pad(d.getDate())} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`; };
  tickDate();
  setInterval(tickDate, 60000);

  /* ── toast + copy (delegated: works in the bars and in every scene) ─ */
  const toastEl = $('.toast');
  let toastT;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('is-on');
    clearTimeout(toastT);
    toastT = setTimeout(() => toastEl.classList.remove('is-on'), 1600);
  }
  document.addEventListener('click', async e => {
    const el = e.target.closest('[data-copy]');
    if (!el) return;
    e.preventDefault();
    try { await navigator.clipboard.writeText(el.dataset.copy); toast('Copied · ' + el.dataset.copy); }
    catch { toast(el.dataset.copy); }
  });

  /* ── camera focus reticle ──────────────────────────────────────── */
  if (fine) {
    const rt = $('.reticle'), lbl = $('.rt-lbl', rt);
    let tx = innerWidth / 2, ty = innerHeight / 2, cx = tx, cy = ty;
    addEventListener('pointermove', e => { tx = e.clientX; ty = e.clientY; }, { passive: true });
    gsap.ticker.add(() => { cx += (tx - cx) * 0.5; cy += (ty - cy) * 0.5; rt.style.transform = `translate3d(${cx}px,${cy}px,0)`; });
    const hotOf = t => t.closest('a,button,input,[data-copy]');
    addEventListener('pointerover', e => {
      const t = hotOf(e.target);
      rt.classList.toggle('hot', !!t);
      if (!t) return lbl.textContent = 'FOCUS';
      lbl.textContent = t.dataset.copy ? 'CLICK · COPY' : t.matches('[data-play]') ? 'PLAY / PAUSE' : t.matches('.frame,.wr-link,.c-item') ? 'VIEW' : t.matches('input') ? 'SCRUB' : 'CLICK';
    });
    document.documentElement.addEventListener('pointerleave', () => { rt.style.opacity = '0'; });
    document.documentElement.addEventListener('pointerenter', () => { rt.style.opacity = '1'; });
  }

  /* ── konami → 16mm archive print ───────────────────────────────── */
  const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
  let ki = 0;
  addEventListener('keydown', e => {
    if (e.key === KONAMI[ki]) {
      if (++ki === KONAMI.length) {
        ki = 0;
        document.body.classList.toggle('archival');
        toast(document.body.classList.contains('archival') ? 'Reel · 16mm archive print' : 'Reel · restored');
      }
    } else ki = e.key === KONAMI[0] ? 1 : 0;
  });

  /* ── page lifecycle ────────────────────────────────────────────── */
  let ctx = null, cleanups = [], intro = null;
  const onCleanup = fn => cleanups.push(fn);
  const NAV_KEY = { index: 'index', work: 'work', project: 'work', about: 'about', contact: 'contact' };

  function initPage() {
    const view = $('[data-view]');
    const key = view.dataset.view;
    document.body.dataset.page = key;
    $$('.nav a').forEach(a => a.classList.toggle('is-active', a.dataset.nav === NAV_KEY[key]));
    const footerEl = $('[data-footer]', view);
    if (footerEl) footerEl.innerHTML = footerHTML();
    const page = PAGES[key] || {};
    heroTitle = null;
    ctx = gsap.context(() => {
      intro = gsap.timeline({ paused: true });
      page.render && page.render(view);
      $('[data-slug]').textContent = view.dataset.slug || '';
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

  function common(view) {
    splitReveals(view);
    scrubWords(view);
    reveals(view);
    scrollFX(view);
    counters(view);
    shotList(view);
    coversInView(view);
    nextReel(view);
    endCredits(view);
    clocks(view);
    $$('[data-top]', view).forEach(b => b.addEventListener('click', e => { e.preventDefault(); scroller.top(false); }));
    $$('[data-year]', view).forEach(el => { el.textContent = new Date().getFullYear(); });
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
          return gsap.from(self.lines, { yPercent: 110, duration: 1.15, ease: 'expo.out', stagger: 0.08, scrollTrigger: { trigger: el, start: 'top 88%', once: true } });
        }
      });
    });
  }

  // words light up one by one as the passage scrolls through the frame
  function scrubWords(view) {
    $$('[data-scrub-words]', view).forEach(el => {
      const words = SplitText.create(el, { type: 'words' }).words;
      if (reduce) return;
      gsap.fromTo(words, { opacity: 0.12 }, { opacity: 1, stagger: 0.1, ease: 'none', scrollTrigger: { trigger: el, start: 'top 82%', end: 'bottom 45%', scrub: true } });
    });
  }

  function scrollFX(view) {
    if (reduce) return;
    // a cut line draws across the top of each scene as it arrives
    $$('.scene, .strip-sec, .next, .acts, .work-sec', view).forEach(sec => {
      const line = document.createElement('i');
      line.className = 'cut-line';
      sec.prepend(line);
      gsap.fromTo(line, { scaleX: 0 }, { scaleX: 1, ease: 'none', scrollTrigger: { trigger: sec, start: 'top 95%', end: 'top 30%', scrub: true } });
    });
    // big titles drift slower than the page
    $$('.scene-title, .page-title, .synopsis-text', view).forEach(t => gsap.to(t, {
      yPercent: -16, ease: 'none', scrollTrigger: { trigger: t, start: 'top 55%', end: 'bottom top', scrub: true }
    }));
    // credits: roles slide in from the left, names from the right
    $$('.cr-row, .ec-line', view).forEach(r => {
      const st = { trigger: r, start: 'top 94%', once: true };
      gsap.from($('.cr-role', r), { x: -70, opacity: 0, duration: 1.2, ease: 'expo.out', scrollTrigger: st });
      gsap.from($('.cr-names', r), { x: 70, opacity: 0, duration: 1.2, ease: 'expo.out', scrollTrigger: { ...st } });
    });
    // the end credits roll upward as the footer comes in
    const lines = $('.ec-lines', view);
    if (lines) gsap.fromTo(lines, { y: 140 }, { y: -30, ease: 'none', scrollTrigger: { trigger: lines, start: 'top bottom', end: 'bottom 40%', scrub: true } });
    // film runs through the gate: frames skew with scroll speed, lists lean a little
    const film = $$('.frame, .act', view), rows = $$('.shot-list li, .wr, .now-list li', view);
    if (lenis && (film.length || rows.length)) {
      const skewX = film.length ? gsap.quickTo(film, 'skewX', { duration: 0.6, ease: 'power3' }) : null;
      const skewY = rows.length ? gsap.quickTo(rows, 'skewY', { duration: 0.6, ease: 'power3' }) : null;
      onCleanup(onLenis(l => {
        const v = gsap.utils.clamp(-7, 7, l.velocity * 0.14);
        if (skewX) skewX(-v);
        if (skewY) skewY(v * 0.35);
      }));
    }
  }

  function onLenis(fn) {
    const off = lenis.on('scroll', fn);
    return typeof off === 'function' ? off : () => lenis.off && lenis.off('scroll', fn);
  }

  function reveals(view) {
    if (reduce) return;
    $$('[data-reveal]', view).forEach(el => gsap.from(el, { y: 36, opacity: 0, duration: 1.1, ease: 'expo.out', scrollTrigger: { trigger: el, start: 'top 90%', once: true } }));
    $$('[data-reveal-group]', view).forEach(g => gsap.from(g.children, { y: 36, opacity: 0, duration: 1, ease: 'expo.out', stagger: 0.07, scrollTrigger: { trigger: g, start: 'top 88%', once: true } }));
  }

  function counters(view) {
    $$('[data-count]', view).forEach(el => {
      const val = el.dataset.count;
      const digits = val.replace(/\D/g, '');
      const strip = '0123456789'.repeat(2).split('').map(n => `<span>${n}</span>`).join('');
      el.innerHTML = [...val].map(ch => (/\d/.test(ch) ? `<span class="dg"><span class="dg-strip">${strip}</span></span>` : `<span>${ch}</span>`)).join('');
      el.setAttribute('aria-label', val);
      const strips = $$('.dg-strip', el);
      const target = i => -(10 + +digits[i]) * 5;
      if (reduce) { strips.forEach((s, i) => gsap.set(s, { yPercent: target(i) })); return; }
      gsap.to(strips, { yPercent: i => target(i), duration: 2.2, ease: 'expo.out', stagger: 0.12, scrollTrigger: { trigger: el, start: 'top 88%', once: true } });
    });
  }

  function shotList(view) {
    $$('.shot-list li', view).forEach((li, i) => {
      li.insertAdjacentHTML('afterbegin', `<span class="shot-n">SHOT ${pad(i + 1)}</span>`);
      ScrollTrigger.create({ trigger: li, start: 'top 55%', end: 'bottom 55%', toggleClass: 'is-active' });
    });
  }

  function coversInView(view) {
    const io = new IntersectionObserver(es => es.forEach(e => e.target.classList.toggle('is-inview', e.isIntersecting)), { threshold: 0.2 });
    $$('.cv', view).forEach(c => io.observe(c));
    onCleanup(() => io.disconnect());
  }

  function nextReel(view) {
    if (reduce) return;
    $$('.next', view).forEach(sec => {
      const title = $('.next-title', sec);
      if (!title.textContent.trim()) return;
      // letters slot in one by one, like a title card being set
      const chars = SplitText.create(title, { type: 'chars', mask: 'chars' }).chars;
      gsap.from(chars, { yPercent: 110, ease: 'none', stagger: 0.05, scrollTrigger: { trigger: sec, start: 'top 85%', end: 'center 60%', scrub: true } });
      gsap.fromTo(title, { scale: 0.86 }, { scale: 1, ease: 'none', scrollTrigger: { trigger: sec, start: 'top 85%', end: 'center 55%', scrub: true } });
    });
  }

  function footerHTML() {
    const letters = [...'Darg'].map(ch => ['', ch]).concat([['amp', '&'], ['', 'c'], ['', 'o'], ['', '.']]);
    const word = letters.map(([cls, ch], i) => `<span class="fw-l ${cls}" style="--i:${i}"><span>${esc(ch)}</span><span aria-hidden="true">${esc(ch)}</span></span>`).join('');
    return `
      <div class="container">
        <a class="ec-word" href="#top" data-top aria-label="Darg&amp;co. — back to the top">${word}</a>
        <div class="ec-lines">
          <div class="ec-line"><span class="cr-role">Written, directed &amp; reverse engineered by</span><span class="cr-names">Darg</span></div>
          <div class="ec-line"><span class="cr-role">Soundtrack</span><span class="cr-names">Hate Bein' Sober — Chief Keef, 50 Cent &amp; Wiz Khalifa</span></div>
          <div class="ec-line"><span class="cr-role">Correspondence</span><span class="cr-names"><a href="mailto:dargdargdargdarg@proton.me" data-copy="dargdargdargdarg@proton.me">dargdargdargdarg@proton.me</a></span></div>
          <div class="ec-line"><span class="cr-role">Discord</span><span class="cr-names"><a href="contact.html" data-copy="dargdargdargdarg">dargdargdargdarg</a></span></div>
          <div class="ec-line"><span class="cr-role">Source</span><span class="cr-names"><a href="https://github.com/Darguon" target="_blank" rel="noopener">github.com/Darguon</a></span></div>
          <div class="ec-line"><span class="cr-role">Reels</span><span class="cr-names"><a href="index.html">Opening</a> · <a href="work.html">Selected works</a> · <a href="about.html">Director's notes</a> · <a href="contact.html">Casting</a></span></div>
        </div>
        <p class="ec-fin">fin.</p>
        <p class="ec-small">© <span data-year></span> Darg&amp;co. — no binaries were harmed in the making of this reel <button type="button" data-top>Rewind ↑</button></p>
      </div>`;
  }

  function endCredits(view) {
    const f = $('[data-footer]', view);
    if (!f || reduce) return;
    gsap.from($$('.fw-l > span:first-child', f), { yPercent: 105, duration: 1.3, ease: 'expo.out', stagger: 0.06, clearProps: 'transform', scrollTrigger: { trigger: f, start: 'top 75%', once: true } });
    gsap.from($$('.ec-fin, .ec-small', f), { y: 30, opacity: 0, duration: 1, ease: 'expo.out', stagger: 0.08, scrollTrigger: { trigger: $('.ec-fin', f), start: 'top 95%', once: true } });
  }

  function clocks(view) {
    const els = $$('[data-clock]', view);
    if (!els.length) return;
    const tf = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Helsinki', hour: '2-digit', minute: '2-digit', second: '2-digit' });
    let zf = null;
    try { zf = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Helsinki', timeZoneName: 'shortOffset' }); } catch { /* unsupported */ }
    const tick = () => {
      const d = new Date();
      const z = zf ? (zf.formatToParts(d).find(x => x.type === 'timeZoneName') || {}).value : '';
      els.forEach(el => { $('.time', el).textContent = tf.format(d) + ':00'; $('.tz', el).textContent = z ? `Local time — ${z}` : 'Local time'; });
    };
    tick();
    const id = setInterval(tick, 1000);
    onCleanup(() => clearInterval(id));
  }

  // pinned horizontal travel; refreshPriority so triggers below account for its pin spacing
  function pinTrack(sec, track) {
    if (!sec || !track || reduce || innerWidth <= 820) return null;
    return gsap.to(track, {
      x: () => -(track.scrollWidth - innerWidth), ease: 'none',
      scrollTrigger: { trigger: sec, start: 'top top', end: () => '+=' + (track.scrollWidth - innerWidth), pin: true, scrub: 1, invalidateOnRefresh: true, anticipatePin: 1, refreshPriority: 1 }
    });
  }

  /* ── home: the opening ─────────────────────────────────────────── */
  const CAPTIONS = [
    [1.5, '[ projector starts ]'], [6, 'Reel 01 — selected works.'], [12, ''],
    [16, 'Everything here got taken apart first.'], [23, ''],
    [27, '[ a debugger attaches ]'], [33, ''],
    [38, 'Quiet hands, loud findings.'], [45, ''],
    [52, 'Dargsclient. Built on demand, licensed per user.'], [60, ''],
    [66, '[ forty-one deploys later ]'], [73, ''],
    [80, 'Open the binary before the docs.'], [87, 'Map what is really there.'], [94, 'Ship the boring fix.'], [101, ''],
    [110, '[ the room goes quiet ]'], [118, ''],
    [130, 'Darg&co. — no binaries were harmed.'], [138, '']
  ];
  const GLYPHS = '!@#$%^&*<>{}[]|/—+=?~★◆▲■';

  function subtitles(view) {
    const out = $('.subs-text', view);
    if (!out) return;
    let raf = null, current = -2;
    const stop = () => { if (raf) cancelAnimationFrame(raf); raf = null; };
    const show = text => {
      stop();
      if (!text) { out.innerHTML = ''; return; }
      if (reduce) { out.textContent = text; return; }
      const chars = [...text];
      const stagger = Math.min(36, 460 / chars.length), dur = 190;
      out.innerHTML = chars.map(c => c === ' ' ? '<span class="lc"> </span>' : `<span class="lc scr" data-c="${esc(c)}">${GLYPHS[Math.random() * GLYPHS.length | 0]}</span>`).join('');
      const spans = $$('.lc[data-c]', out);
      const t0 = performance.now();
      (function tick(now) {
        let done = true;
        spans.forEach((sp, i) => {
          const s = i * stagger, e = s + dur, el = now - t0;
          if (el < s) { sp.className = 'lc pre'; done = false; }
          else if (el >= e) { sp.className = 'lc done'; sp.textContent = sp.dataset.c; }
          else { sp.className = 'lc scr'; sp.textContent = GLYPHS[Math.random() * GLYPHS.length | 0]; done = false; }
        });
        raf = done ? null : requestAnimationFrame(tick);
      })(t0);
    };
    const onTime = () => {
      const t = video.currentTime;
      let idx = -1;
      for (let i = 0; i < CAPTIONS.length; i++) { if (t >= CAPTIONS[i][0]) idx = i; else break; }
      if (idx !== current) { current = idx; show(idx >= 0 ? CAPTIONS[idx][1] : ''); }
    };
    video.addEventListener('timeupdate', onTime);
    onCleanup(() => { video.removeEventListener('timeupdate', onTime); stop(); });
  }

  const Index = {
    render(view) {
      $('[data-credits]', view).innerHTML = P.slice(0, 4).map((p, i) => `
        <a class="c-item" href="project.html?p=${p.slug}">
          <span class="c-num">${String(i + 1).padStart(3, '0')}</span>
          <span><span class="c-name">${p.name}</span><span class="c-role" style="display:block">${p.role} · ${p.category.toLowerCase()}</span>
          <span class="c-tag ${p.status === 'active' ? 'on' : 'off'}">${statusLabel(p)}</span></span>
        </a>`).join('') + `<a class="c-all" href="work.html">All ${pad(P.length)} works →</a>`;
      $('[data-strip]', view).innerHTML = P.map((p, i) => `
        <a class="frame" href="project.html?p=${p.slug}">
          <div class="sprockets"></div>
          <div class="still">${coverHTML(p)}</div>
          <div class="sprockets bottom"></div>
          <div class="frame-cap"><span class="frame-n">${String(i + 1).padStart(3, '0')}</span><span class="frame-name">${p.name}</span><span class="frame-meta">${p.category}<br>${statusLabel(p)}</span></div>
        </a>`).join('');
    },
    init(view) {
      heroTitle = $('.title', view);
      if (!reduce) {
        intro
          .from($$('.titlecard > *', view), { y: 30, opacity: 0, duration: 1.2, ease: 'expo.out', stagger: 0.1 }, 0.15)
          .from($$('.c-head, .c-item, .c-all', view), { y: 18, opacity: 0, duration: 0.9, ease: 'expo.out', stagger: 0.06 }, 0.4);
        const opening = $('.opening', view);
        gsap.to($('.opening-inner', view), { yPercent: 12, opacity: 0, ease: 'none', scrollTrigger: { trigger: opening, start: 'top top', end: 'bottom top', scrub: true } });
        // leaving the title card: the letters scatter and go out of focus
        const chars = SplitText.create($('.title', view), { type: 'chars' }).chars;
        gsap.to(chars, {
          yPercent: i => -60 - (i % 3) * 45, rotate: i => (i % 2 ? 8 : -8), opacity: 0, filter: 'blur(8px)',
          stagger: 0.03, ease: 'none', scrollTrigger: { trigger: opening, start: 'top top', end: '70% top', scrub: true }
        });
      }
      subtitles(view);
      const reel = pinTrack($('.strip-sec', view), $('[data-strip]', view));
      // each still pans inside its frame as the strip runs past
      if (reel) $$('.frame', view).forEach(frame => gsap.fromTo($('.cv', frame), { xPercent: -3.5, scale: 1.08 }, {
        xPercent: 3.5, scale: 1.08, ease: 'none',
        scrollTrigger: { trigger: frame, containerAnimation: reel, start: 'left right', end: 'right left', scrub: true }
      }));
    }
  };

  /* ── work: the full credits ────────────────────────────────────── */
  const Work = {
    render(view) {
      $('[data-work-list]', view).innerHTML = P.map((p, i) => `
        <li class="wr" data-status="${p.status}">
          <a class="wr-link" href="project.html?p=${p.slug}" data-i="${i}">
            <span class="wr-num">${String(i + 1).padStart(3, '0')}</span>
            <span class="wr-name">${p.name}</span>
            <span class="wr-cat">${p.role} · ${p.category}</span>
            <span class="wr-status${p.status === 'active' ? '' : ' is-archived'}">${statusLabel(p)}</span>
          </a>
          <div class="wr-cover still">${coverHTML(p)}</div>
        </li>`).join('');
      $('.wp-track', view).innerHTML = P.map(p => `<div class="wp-item">${coverHTML(p)}</div>`).join('');
      $('[data-work-count]', view).textContent = `${pad(P.length)} works`;
    },
    init(view) {
      const list = $('[data-work-list]', view);
      const rows = $$('.wr', list);
      $$('.wp .cv', view).forEach(c => c.classList.add('is-inview'));
      // each credit arrives as it reaches the frame; clearProps hands opacity back to the hover/filter styles
      if (!reduce) rows.forEach(row => gsap.from(row, {
        y: 70, opacity: 0, duration: 1.2, ease: 'expo.out', clearProps: 'opacity',
        scrollTrigger: { trigger: row, start: 'top 94%', once: true }
      }));

      const wp = $('.wp', view), track = $('.wp-track', view);
      if (fine && !reduce) {
        gsap.set(wp, { yPercent: -100, scale: 0.88, transformOrigin: '0% 100%' });
        let tx = innerWidth / 2, ty = innerHeight / 2, cx = tx, cy = ty, shown = false;
        const setX = gsap.quickSetter(wp, 'x', 'px'), setY = gsap.quickSetter(wp, 'y', 'px');
        // sits above-right of the cursor so the hovered row stays readable; clamped to the frame
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
        list.addEventListener('pointerleave', () => { shown = false; gsap.to(wp, { opacity: 0, scale: 0.88, duration: 0.4, ease: 'expo.out' }); });
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
        if (countEl) countEl.textContent = `${pad(n)} works`;
        gsap.delayedCall(0.7, () => ScrollTrigger.refresh());
      }));
    }
  };

  /* ── a single scene (project) ──────────────────────────────────── */
  const Project = {
    render(view) {
      const slug = new URLSearchParams(location.search).get('p');
      let i = P.findIndex(p => p.slug === slug);
      if (i < 0) i = 0;
      const p = P[i], nx = P[(i + 1) % P.length];
      document.title = `${p.name} — Darg&co.`;
      view.dataset.slug = `Scene ${pad(i + 1)} — ${p.name}`;
      const set = (k, html) => { const el = $(`[data-proj="${k}"]`, view); if (el) el.innerHTML = html; };
      set('index', `Scene ${pad(i + 1)} of ${pad(P.length)}`);
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
    },
    init(view) {
      if (!reduce) intro.from($$('.proj-credits > div', view), { y: 24, opacity: 0, duration: 1, ease: 'expo.out', stagger: 0.07 }, 0.45);
      const still = $('.proj-still .still', view), inner = $('.proj-cover-inner', view);
      if (!still || reduce) return;
      gsap.fromTo(inner, { yPercent: -7 }, { yPercent: 7, ease: 'none', scrollTrigger: { trigger: still, start: 'top bottom', end: 'bottom top', scrub: true } });
    }
  };

  /* ── director's notes (about) ──────────────────────────────────── */
  const About = {
    render(view) {
      const el = $('[data-now]', view);
      if (el) el.innerHTML = P.filter(p => p.status === 'active').map((p, i) => `
        <li><a href="project.html?p=${p.slug}">
          <span class="now-n">${String(i + 1).padStart(3, '0')}</span><span class="now-name">${p.name}</span>
          <span class="now-cat">${p.category}</span><span class="now-arrow">→</span>
        </a></li>`).join('');
    },
    init(view) { pinTrack($('.acts', view), $('.acts-track', view)); }
  };

  const PAGES = { index: Index, work: Work, project: Project, about: About, contact: {} };

  /* ── scene changes: the letterbox shutters close on a slate ────── */
  const pt = $('.pt');
  const ptTop = $('.pt-top', pt), ptBot = $('.pt-bot', pt), slate = $('.pt-slate', pt);
  const SCENES = { 'index.html': ['01', 'Opening'], 'work.html': ['02', 'Selected works'], 'about.html': ['03', "Director's notes"], 'contact.html': ['04', 'Casting'] };
  let take = +(session.get('darg-take') || 0);
  let busy = false;
  gsap.set(ptTop, { yPercent: -100 });
  gsap.set(ptBot, { yPercent: 100 });

  function slateFor(href) {
    const u = new URL(href, location.href);
    const file = u.pathname.split('/').pop() || 'index.html';
    let [n, name] = SCENES[file] || ['00', ''];
    if (file.startsWith('project')) {
      const i = P.findIndex(x => x.slug === u.searchParams.get('p'));
      n = `02.${pad(Math.max(i, 0) + 1)}`;
      name = i >= 0 ? P[i].name : 'Project';
    }
    take++;
    session.set('darg-take', String(take));
    $('.pt-scene', slate).textContent = `Scene ${n}`;
    $('.pt-take', slate).textContent = `Take ${pad(take)}`;
    $('.pt-name', slate).textContent = name;
  }
  function closeShutters() {
    pt.classList.add('is-active');
    scroller.stop();
    const tl = gsap.timeline();
    const d = reduce ? 0.2 : 0.6;
    return tl
      .to(ptTop, { yPercent: 0, duration: d, ease: 'expo.inOut' }, 0)
      .to(ptBot, { yPercent: 0, duration: d, ease: 'expo.inOut' }, 0)
      .fromTo(slate, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.35, ease: 'expo.out' }, d - 0.1);
  }
  function openShutters() {
    const tl = gsap.timeline({ onComplete: () => { pt.classList.remove('is-active'); scroller.start(); } });
    const d = reduce ? 0.2 : 0.75;
    return tl
      .to(slate, { opacity: 0, duration: 0.2 }, reduce ? 0 : 0.25)
      .to(ptTop, { yPercent: -100, duration: d, ease: 'expo.inOut' }, '>-0.05')
      .to(ptBot, { yPercent: 100, duration: d, ease: 'expo.inOut' }, '<');
  }

  async function navigate(href, push = true) {
    if (busy) return;
    busy = true;
    const req = fetch(href, { credentials: 'same-origin' }).then(r => { if (!r.ok) throw new Error(r.status); return r.text(); });
    slateFor(href);
    await closeShutters();
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
    const opening = openShutters();
    gsap.delayedCall(reduce ? 0 : 0.5, playIntro);
    await opening;
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
    if (url.pathname === location.pathname && url.search === location.search) { scroller.top(false); return; }
    navigate(url.href);
  });
  addEventListener('popstate', () => navigate(location.href, false));
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

  /* ── first load: an academy leader counts down while the film buffers ── */
  function preloader() {
    const pl = $('.preloader');
    const leader = $('.leader', pl), num = $('.leader-num', pl), sweep = $('.leader-sweep', pl), plIntro = $('.pl-intro', pl);
    scroller.stop();
    const ready = Promise.race([
      new Promise(r => { if (video.readyState >= 3) r(); else video.addEventListener('canplay', r, { once: true }); }),
      new Promise(r => setTimeout(r, 5000))
    ]);
    const beat = n => new Promise(res => {
      num.textContent = n;
      gsap.fromTo(sweep, { '--a': '0deg' }, { '--a': '360deg', duration: reduce ? 0.05 : 0.38, ease: 'none', onComplete: res });
    });
    (async () => {
      for (let n = 8; n >= 2; n--) {
        await beat(n);
        if (n === 3) await ready; // hold on the last beats until the film can play
      }
      gsap.to(leader, { opacity: 0, scale: 1.06, duration: 0.35, ease: 'power2.out' });
      gsap.to(plIntro, { opacity: 1, duration: 0.7, delay: 0.15 });
      pl.classList.add('is-ready');
      const enter = () => {
        pl.removeEventListener('click', enter);
        removeEventListener('keydown', enter);
        session.set('darg-entered', '1');
        setSound(true);
        gsap.to(pl, { opacity: 0, duration: reduce ? 0.2 : 0.9, ease: 'power2.inOut', onComplete: () => { pl.remove(); scroller.start(); } });
        gsap.delayedCall(reduce ? 0.1 : 0.35, () => { document.documentElement.classList.remove('is-loading'); playIntro(); });
      };
      pl.addEventListener('click', enter);
      addEventListener('keydown', enter);
    })();
  }

  async function boot() {
    try { await Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 2500))]); } catch { /* fonts API missing */ }
    initPage();
    if (session.get('darg-entered') === '1') {
      gsap.set([ptTop, ptBot], { yPercent: 0 });
      pt.classList.add('is-active');
      $('.preloader').remove();
      document.documentElement.classList.remove('is-loading');
      armSoundUnlock();
      await openShutters();
      playIntro();
    } else {
      preloader();
    }
  }
  boot();
})();
