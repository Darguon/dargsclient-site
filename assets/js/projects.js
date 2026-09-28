/* Project data + generated cover art. Content is sourced from the repos themselves. */
(function () {
  window.PROJECTS = [
    {
      slug: 'dargsclient', name: 'Dargsclient', category: 'Fabric mod', status: 'active', role: 'Owner',
      hero: true, tint: '#2c46ff',
      summary: 'A client-side Fabric mod. Most of the rest of this site exists to build it, license it and get it to people.',
      points: [
        'Client-side Fabric mod on Java 21, built with the Gradle wrapper',
        'Built on demand — DargBackend pulls the latest source every time it starts',
        'Builds and license keys go out through the Discord bot'
      ],
      stack: ['Java 21', 'Fabric', 'Gradle'],
      cover: { type: 'pixels', bg: '#2c46ff', fg: '#ffffff', tl: 'client', bl: 'fabric / java 21' }
    },
    {
      slug: 'dargbackend', name: 'DargBackend', category: 'Build service', status: 'active', role: 'Owner',
      hero: true, tint: '#b48cff',
      summary: 'Build-as-a-service for Dargsclient. Ask for a build, get a signed, licensed jar back.',
      points: [
        'Pulls the latest Dargsclient source on startup and builds it on request',
        'Issues licenses as Ed25519-signed payloads',
        'Moved from Redis to Postgres, with a file-based HWID store on a Railway volume',
        'Native C++ auth staged alongside the service',
        '41 production deploys on Railway'
      ],
      stack: ['Node.js', 'Postgres', 'C++', 'Railway'],
      cover: { type: 'pipe', bg: '#111111', fg: '#ece8df', tl: 'build-as-a-service', br: '41 deploys' }
    },
    {
      slug: 'clientauth', name: 'ClientAuth', category: 'Auth system', status: 'active', role: 'Owner',
      hero: true, tint: '#ff5b36',
      summary: 'Licensing and authentication built from scratch — native module, Rust server, heartbeat.',
      points: [
        'Auth server rewritten in Rust with Axum, sqlx and Redis',
        'Native DLL built straight out of the Gradle build',
        'Heartbeat and network layers keep sessions honest',
        'In-game HUD overlay shows auth status'
      ],
      stack: ['Rust', 'Axum', 'sqlx', 'Redis', 'Java', 'Native DLL'],
      cover: { type: 'pulse', bg: '#ebe6dc', fg: '#0c0c0c', tl: 'rust · axum · sqlx', bl: 'heartbeat', br: '200 OK' }
    },
    {
      slug: 'darg-decompiler', name: 'Darg Decompiler', category: 'Deobfuscator', status: 'active', role: 'Owner',
      grid: true,
      summary: 'A Java deobfuscation workspace. Obfuscated jar in, readable code out.',
      points: [
        'JavaFX workspace for working through a jar',
        'Deep string analysis to recover what the obfuscator hid',
        'Pattern scanner that pulls out actual evidence, not just matches'
      ],
      stack: ['Java', 'JavaFX', 'Maven'],
      cover: { type: 'deobf', bg: '#ff5b36', fg: '#0c0c0c', tl: 'deobfuscate', br: '.jar' }
    },
    {
      slug: 'discord-build-bot', name: 'Build Bot', category: 'Discord bot', status: 'active', role: 'Owner',
      grid: true,
      summary: 'The front door to DargBackend. Builds and license keys, straight from Discord.',
      points: [
        'Slash commands for builds, keys and announcements — /mykey, /broadcast',
        'Talks to DargBackend, so nobody needs a dashboard',
        '9 production deploys on Railway'
      ],
      stack: ['JavaScript', 'Discord API', 'Railway'],
      cover: { type: 'chat', bg: '#b9a4ff', fg: '#0c0c0c', tl: '#builds' }
    },
    {
      slug: 'ai-slop-destroyer', name: 'AI Slop Destroyer', category: 'Text tool', status: 'active', role: 'Developer',
      grid: true,
      summary: 'Finds the tells in AI-written text and strips them out.',
      points: [
        'Flags the phrases and patterns that give AI writing away',
        'Cuts the filler and keeps the point'
      ],
      stack: ['Detection', 'Rewriting'],
      cover: { type: 'slop', bg: '#f2d14b', fg: '#0c0c0c', tl: 'before' }
    },
    {
      slug: 'huhtalahook', name: 'HuhtalaHook', category: 'Game internals', status: 'archived', role: 'Developer',
      grid: true,
      summary: 'A kernel-level internal for Counter-Strike 2. Driver work and anti-cheat internals, end to end.',
      points: [
        'Kernel driver written from scratch',
        'Discontinued'
      ],
      stack: ['Windows kernel', 'Game internals'],
      cover: { type: 'hex', bg: '#0e0e0e', fg: '#8e8e8a', tl: 'kernel', br: 'archived' }
    },
    {
      slug: 'sothook', name: 'SotHook', category: 'Game internals', status: 'archived', role: 'Developer',
      summary: 'An internal for Sea of Thieves — reading and changing game state from the inside.',
      points: [
        'Maps live game state from inside the process',
        'Discontinued'
      ],
      stack: ['Game internals'],
      cover: { type: 'radar', bg: '#10313c', fg: '#e9e4d6', tl: 'game state', bl: 'x 1204.6  y 88.2  z −14.0', br: 'archived' }
    }
  ];

  const ART = {
    pixels() {
      const map = ['1111100', '1100110', '1100011', '1100011', '1100011', '1100011', '1100011', '1100110', '1111100'];
      let cells = '', k = 0;
      map.forEach(row => [...row].forEach(b => {
        cells += `<i class="${b === '1' ? 'on' : ''}" style="--d:${((k * 37) % 29) / 10}s"></i>`;
        k++;
      }));
      return `<div class="px-grid">${cells}</div>`;
    },
    pipe() {
      const nodes = ['discord', 'backend', 'gradle'].map(n => `<span class="pipe-node">${n}</span><span class="pipe-line"></span>`).join('');
      return `<div class="pipe">${nodes}<span class="pipe-node is-done">jar ✓</span></div>`;
    },
    chat() {
      const msgs = [['me', '/build'], ['', 'queued · #0412'], ['', 'ready — dargsclient.jar'], ['me', '/mykey'], ['', 'sent to your DMs']];
      return `<div class="chat">${msgs.map(([who, t], i) => `<p class="msg ${who}" style="--i:${i}">${t}</p>`).join('')}</div>`;
    },
    pulse() {
      return '<svg class="pulse" viewBox="0 0 400 120" preserveAspectRatio="none"><path pathLength="1" d="M0 60H120L140 60L152 18L168 102L182 38L194 60H262L282 34L294 86L304 60H400"/></svg>';
    },
    deobf() {
      return `<div class="deobf"><pre class="deobf-in">a.b(c.d("\\u0068\\u0069"));
if (lI1l.Il1I(0x1f)) I1l();
return O0o.o0O;</pre><span class="deobf-arrow">↓</span><pre class="deobf-out">print(greeting());
if (isLicensed()) start();
return config;</pre></div>`;
    },
    slop() {
      return `<p class="slop">In today's fast-paced world, let's <s>delve</s> into the rich <s>tapestry</s> of <s>seamless</s>, <s>cutting-edge</s> ideas that <s>leverage</s> real <s>synergy</s>.</p><p class="slop-after">→ Just say it.</p>`;
    },
    hex() {
      let seed = 7;
      const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
      let rows = '';
      for (let r = 0; r < 9; r++) {
        const addr = (0x7FF6A1C0 + r * 8).toString(16).toUpperCase();
        const bytes = Array.from({ length: 8 }, () => Math.floor(rnd() * 256).toString(16).toUpperCase().padStart(2, '0')).join(' ');
        rows += `<span class="hex-row" style="--i:${r}">${addr}  ${bytes}</span>`;
      }
      return `<div class="hex">${rows}</div>`;
    },
    radar() {
      return '<div class="radar"><i class="ring"></i><i class="ring r2"></i><i class="ring r3"></i><i class="sweep"></i><i class="blip" style="--x:32%;--y:36%"></i><i class="blip" style="--x:66%;--y:62%"></i></div>';
    }
  };

  window.coverHTML = function (p) {
    const c = p.cover;
    const tags = ['tl', 'tr', 'bl', 'br'].filter(k => c[k]).map(k => `<span class="cv-tag cv-${k}">${c[k]}</span>`).join('');
    return `<div class="cv cv-${c.type}" style="--cbg:${c.bg};--cfg:${c.fg}" aria-hidden="true">${ART[c.type]()}${tags}</div>`;
  };
})();
