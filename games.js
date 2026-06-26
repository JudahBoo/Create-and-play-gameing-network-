/* ===== GAME ENGINE LAUNCHER ===== */
let _currentGame = null;

function launchGame(canvas, gameId, genre) {
  if (_currentGame) { _currentGame.destroy(); _currentGame = null; }
  const type = getGameType(gameId, genre);
  switch (type) {
    case 'runner':  _currentGame = new NeonRunner(canvas);   break;
    case 'shooter': _currentGame = new StarDefender(canvas); break;
    case 'dungeon': _currentGame = new DungeonQuest(canvas); break;
    case 'racer':   _currentGame = new StreetRacer(canvas);  break;
    case 'jumper':  _currentGame = new SkyJumper(canvas);    break;
    case 'brawler':  _currentGame = new ArenaBrawl(canvas);  break;
    case 'freerace': _currentGame = new FreeRace(canvas);   break;
    case 'bus':      _currentGame = new BusDriver(canvas);   break;
    case 'rivals':   _currentGame = new RivalsGame(canvas);  break;
    case 'geodash':    _currentGame = new GeoDash(canvas);     break;
    case 'taptarget':  _currentGame = new TapTarget(canvas);  break;
    default:           _currentGame = new NeonRunner(canvas);
  }
  _currentGame.start();
  return _currentGame;
}

function stopCurrentGame() {
  if (_currentGame) { _currentGame.destroy(); _currentGame = null; }
}

function getGameType(id, genre) {
  if (id === 'dev-1') return 'runner';
  if (id === 'dev-2') return 'dungeon';
  if (id === 'dev-3') return 'shooter';
  if (id === 'dev-4') return 'racer';
  if (id === 'dev-5') return 'jumper';
  if (id === 'dev-6') return 'brawler';
  if (id === 'dev-7') return 'freerace';
  if (id === 'dev-8') return 'bus';
  if (id === 'dev-9')  return 'rivals';
  if (id === 'dev-10') return 'geodash';
  if (id === 'dev-11') return 'taptarget';
  const g = (genre || '').toLowerCase();
  if (/race|car|driv|drift|speed|track/.test(g)) return 'racer';
  if (/brawl|fight|battl|arena|combat|punch|sword|warrior/.test(g)) return 'brawler';
  if (/climb|sky|bounce|spring|doodle|platform|jump/.test(g)) return 'jumper';
  if (/run|endless|obstacle|dodge/.test(g)) return 'runner';
  if (/shoot|space|gun|laser|bullet|defend/.test(g)) return 'shooter';
  if (/rpg|quest|dungeon|adventure|puzzle|solve/.test(g)) return 'dungeon';
  const types = ['runner', 'shooter', 'dungeon', 'racer', 'jumper', 'brawler'];
  return types[Math.floor(Math.random() * types.length)];
}

/* ============================================================
   GAME 1 — NEON RUNNER
   Tap / Space to jump (double jump allowed)
   ============================================================ */
class NeonRunner {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.W = canvas.width;
    this.H = canvas.height;
    this.raf = null;
    this._handlers = {};
  }

  start() { this.reset(); this._bind(); this._loop(); }

  reset() {
    const groundY = this.H - 70;
    this.groundY = groundY;
    this.p = { x: 80, y: groundY - 44, w: 28, h: 44, vy: 0, jumps: 0 };
    this.obstacles = [];
    this.particles = [];
    this.score = 0;
    this.speed = 4;
    this.frame = 0;
    this.nextOb = 70;
    this.over = false;
    this.started = false;
  }

  _bind() {
    const jump = (e) => { if (e.cancelable) e.preventDefault(); this._jump(); };
    const key  = (e) => { if (e.code === 'Space' || e.key === 'ArrowUp') { e.preventDefault(); this._jump(); } };
    this.canvas.addEventListener('pointerdown', jump);
    document.addEventListener('keydown', key);
    this._handlers = { jump, key };
  }

  _jump() {
    if (this.over) { this.reset(); return; }
    this.started = true;
    if (this.p.jumps < 2) { this.p.vy = -15; this.p.jumps++; }
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    this.canvas.removeEventListener('pointerdown', this._handlers.jump);
    document.removeEventListener('keydown', this._handlers.key);
  }

  _update() {
    if (!this.started || this.over) return;
    const p = this.p;
    this.frame++;
    this.score++;
    this.speed = 4 + Math.min(this.score / 400, 4);

    // Physics
    p.vy += 0.75;
    p.y += p.vy;
    if (p.y >= this.groundY - p.h) { p.y = this.groundY - p.h; p.vy = 0; p.jumps = 0; }

    // Spawn
    this.nextOb--;
    if (this.nextOb <= 0) {
      const tall = 30 + Math.random() * 50;
      const isHigh = Math.random() > 0.65 && this.score > 400;
      this.obstacles.push({
        x: this.W + 10,
        y: isHigh ? this.groundY - 120 - tall : this.groundY - tall,
        w: 22, h: tall,
      });
      this.nextOb = Math.max(45, 90 - this.score / 120);
    }

    // Move & cull obstacles
    this.obstacles.forEach(o => o.x -= this.speed);
    this.obstacles = this.obstacles.filter(o => o.x > -40);

    // Collision
    for (const o of this.obstacles) {
      if (p.x + p.w - 5 > o.x && p.x + 5 < o.x + o.w &&
          p.y + p.h - 4 > o.y && p.y + 4 < o.y + o.h) {
        this.over = true;
        for (let i = 0; i < 24; i++) {
          const a = (i / 24) * Math.PI * 2;
          this.particles.push({ x: p.x + p.w / 2, y: p.y + p.h / 2, vx: Math.cos(a) * 6, vy: Math.sin(a) * 6, life: 35, col: `hsl(${Math.random() * 60 + 200},100%,65%)` });
        }
      }
    }

    // Trail particles
    if (this.frame % 3 === 0) this.particles.push({ x: p.x + 2, y: p.y + p.h - 4, vx: -1.5, vy: -Math.random(), life: 18, col: `hsl(${200 + Math.random() * 60},100%,70%)` });
    this.particles.forEach(pt => { pt.x += pt.vx; pt.y += pt.vy; pt.life--; });
    this.particles = this.particles.filter(pt => pt.life > 0);
  }

  _draw() {
    const { ctx, W, H, groundY } = this;

    // BG
    ctx.fillStyle = '#06000f';
    ctx.fillRect(0, 0, W, H);

    // Stars
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    for (let i = 0; i < 60; i++) {
      ctx.fillRect(((i * 139 + this.frame * 0.25) % W), (i * 71 % (groundY - 10)), 1.5, 1.5);
    }

    // Ground
    const grd = ctx.createLinearGradient(0, groundY, 0, H);
    grd.addColorStop(0, '#4c1d95'); grd.addColorStop(1, '#0a0015');
    ctx.fillStyle = grd;
    ctx.fillRect(0, groundY, W, H - groundY);
    ctx.shadowColor = '#a78bfa'; ctx.shadowBlur = 12;
    ctx.strokeStyle = '#c4b5fd'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, groundY); ctx.lineTo(W, groundY); ctx.stroke();
    ctx.shadowBlur = 0;

    // Obstacles
    this.obstacles.forEach(o => {
      const g = ctx.createLinearGradient(o.x, o.y, o.x + o.w, o.y + o.h);
      g.addColorStop(0, '#7c3aed'); g.addColorStop(1, '#4c1d95');
      ctx.fillStyle = g;
      ctx.shadowColor = '#a78bfa'; ctx.shadowBlur = 10;
      ctx.fillRect(o.x, o.y, o.w, o.h);
      ctx.shadowBlur = 0;
    });

    // Particles
    this.particles.forEach(pt => {
      ctx.globalAlpha = Math.max(0, pt.life / 35);
      ctx.fillStyle = pt.col;
      ctx.fillRect(pt.x, pt.y, 5, 5);
    });
    ctx.globalAlpha = 1;

    // Player
    if (!this.over) {
      const p = this.p;
      ctx.shadowColor = '#38bdf8'; ctx.shadowBlur = 18;
      const pg = ctx.createLinearGradient(p.x, p.y, p.x, p.y + p.h);
      pg.addColorStop(0, '#7dd3fc'); pg.addColorStop(1, '#0369a1');
      ctx.fillStyle = pg;
      ctx.beginPath(); ctx.roundRect(p.x, p.y, p.w, p.h, 6); ctx.fill();
      ctx.shadowBlur = 0;
    }

    // HUD
    ctx.fillStyle = '#e2e8f0';
    ctx.font = 'bold 16px monospace';
    ctx.fillText(`Score: ${this.score}`, 12, 26);
    const lvl = Math.floor(this.score / 400) + 1;
    ctx.fillText(`Level: ${lvl}`, 12, 46);

    // Start hint
    if (!this.started) {
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.font = 'bold 18px sans-serif';
      ctx.fillText('Tap or press SPACE to start!', W / 2, H / 2 - 10);
      ctx.font = '14px sans-serif';
      ctx.fillText('Double-tap for double jump', W / 2, H / 2 + 16);
      ctx.textAlign = 'left';
    }

    // Game over
    if (this.over) {
      ctx.fillStyle = 'rgba(0,0,0,0.65)';
      ctx.fillRect(0, 0, W, H);
      ctx.textAlign = 'center';
      ctx.shadowColor = '#f59e0b'; ctx.shadowBlur = 20;
      ctx.fillStyle = '#f59e0b';
      ctx.font = 'bold 38px sans-serif';
      ctx.fillText('GAME OVER', W / 2, H / 2 - 24);
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#e2e8f0';
      ctx.font = '22px sans-serif';
      ctx.fillText(`Score: ${this.score}`, W / 2, H / 2 + 14);
      ctx.fillStyle = '#a78bfa';
      ctx.font = '15px sans-serif';
      ctx.fillText('Tap / Space to play again', W / 2, H / 2 + 50);
      ctx.textAlign = 'left';
    }
  }

  _loop() { this._update(); this._draw(); this.raf = requestAnimationFrame(() => this._loop()); }
}

/* ============================================================
   GAME 2 — STAR DEFENDER
   Arrow keys / WASD to move ship
   Touch: drag or tap destination
   Auto-fires bullets
   ============================================================ */
class StarDefender {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.W = canvas.width;
    this.H = canvas.height;
    this.raf = null;
    this._handlers = {};
  }

  start() { this.reset(); this._bind(); this._loop(); }

  reset() {
    this.ship = { x: this.W / 2, y: this.H - 60, w: 36, h: 40, speed: 5, lives: 3, invincible: 0 };
    this.bullets = [];
    this.enemies = [];
    this.stars = Array.from({ length: 80 }, () => ({ x: Math.random() * this.W, y: Math.random() * this.H, speed: 1 + Math.random() * 2, r: Math.random() * 1.5 + 0.5 }));
    this.explosions = [];
    this.score = 0;
    this.wave = 1;
    this.frame = 0;
    this.over = false;
    this.won = false;
    this.fireTimer = 0;
    this.waveTimer = 0;
    this.waveSpawned = false;
    this.keys = {};
    this.touchTarget = null;
    this._spawnWave();
  }

  _spawnWave() {
    const cols = Math.min(3 + this.wave, 8);
    const rows = Math.min(1 + Math.floor(this.wave / 2), 4);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        this.enemies.push({
          x: 60 + c * (this.W - 120) / (cols - 1 || 1),
          y: 40 + r * 55,
          w: 32, h: 28,
          hp: this.wave >= 3 ? 2 : 1,
          dir: 1,
          moveTimer: 0,
          type: r % 3,
        });
      }
    }
    this.waveSpawned = true;
  }

  _bind() {
    const kd = (e) => { this.keys[e.key] = true; };
    const ku = (e) => { this.keys[e.key] = false; };
    const td = (e) => { const r = this.canvas.getBoundingClientRect(); this.touchTarget = { x: e.touches[0].clientX - r.left, y: e.touches[0].clientY - r.top }; };
    const tm = (e) => { const r = this.canvas.getBoundingClientRect(); this.touchTarget = { x: e.touches[0].clientX - r.left, y: e.touches[0].clientY - r.top }; };
    const te = () => { this.touchTarget = null; };
    document.addEventListener('keydown', kd);
    document.addEventListener('keyup', ku);
    this.canvas.addEventListener('touchstart', td, { passive: true });
    this.canvas.addEventListener('touchmove', tm, { passive: true });
    this.canvas.addEventListener('touchend', te);
    this._handlers = { kd, ku, td, tm, te };
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    document.removeEventListener('keydown', this._handlers.kd);
    document.removeEventListener('keyup', this._handlers.ku);
    this.canvas.removeEventListener('touchstart', this._handlers.td);
    this.canvas.removeEventListener('touchmove', this._handlers.tm);
    this.canvas.removeEventListener('touchend', this._handlers.te);
  }

  _update() {
    if (this.over || this.won) return;
    const { ship, keys } = this;
    this.frame++;

    // Move ship
    if (keys['ArrowLeft'] || keys['a'] || keys['A']) ship.x -= ship.speed;
    if (keys['ArrowRight'] || keys['d'] || keys['D']) ship.x += ship.speed;
    if (this.touchTarget) {
      const dx = this.touchTarget.x - ship.x;
      if (Math.abs(dx) > 4) ship.x += Math.sign(dx) * ship.speed;
    }
    ship.x = Math.max(ship.w / 2, Math.min(this.W - ship.w / 2, ship.x));
    if (ship.invincible > 0) ship.invincible--;

    // Auto fire
    this.fireTimer--;
    if (this.fireTimer <= 0) {
      this.bullets.push({ x: ship.x, y: ship.y - 20, vy: -11, player: true });
      this.fireTimer = 18;
    }

    // Enemy fire
    if (this.frame % 60 === 0 && this.enemies.length) {
      const shooter = this.enemies[Math.floor(Math.random() * this.enemies.length)];
      this.bullets.push({ x: shooter.x, y: shooter.y + shooter.h, vy: 5 + this.wave * 0.5, player: false });
    }

    // Move enemies (zigzag)
    this.enemies.forEach(e => {
      e.moveTimer++;
      e.x += e.dir * (1 + this.wave * 0.3);
      if (e.x < 40 || e.x > this.W - 40) { e.dir *= -1; e.y += 18; }
    });

    // Move bullets
    this.bullets.forEach(b => b.y += b.vy);
    this.bullets = this.bullets.filter(b => b.y > -20 && b.y < this.H + 20);

    // Bullet vs enemies
    this.bullets = this.bullets.filter(b => {
      if (!b.player) return true;
      for (let i = this.enemies.length - 1; i >= 0; i--) {
        const e = this.enemies[i];
        if (Math.abs(b.x - e.x) < e.w / 2 && Math.abs(b.y - e.y) < e.h / 2) {
          e.hp--;
          if (e.hp <= 0) {
            this._explode(e.x, e.y, '#f59e0b');
            this.enemies.splice(i, 1);
            this.score += 10 * this.wave;
          }
          return false;
        }
      }
      return true;
    });

    // Enemy bullets vs ship
    if (ship.invincible <= 0) {
      this.bullets = this.bullets.filter(b => {
        if (b.player) return true;
        if (Math.abs(b.x - ship.x) < ship.w / 2 && Math.abs(b.y - ship.y) < ship.h / 2) {
          ship.lives--;
          ship.invincible = 90;
          this._explode(ship.x, ship.y, '#38bdf8');
          if (ship.lives <= 0) this.over = true;
          return false;
        }
        return true;
      });
    }

    // Enemies reached bottom
    if (this.enemies.some(e => e.y > this.H - 80)) this.over = true;

    // Next wave
    if (this.enemies.length === 0) {
      this.wave++;
      if (this.wave > 5) { this.won = true; return; }
      this._spawnWave();
    }

    // Explosions
    this.explosions.forEach(ex => { ex.life--; ex.r += 1.5; });
    this.explosions = this.explosions.filter(ex => ex.life > 0);

    // Stars scroll
    this.stars.forEach(s => { s.y += s.speed; if (s.y > this.H) { s.y = 0; s.x = Math.random() * this.W; } });
  }

  _explode(x, y, col) {
    this.explosions.push({ x, y, r: 6, life: 18, col });
  }

  _draw() {
    const { ctx, W, H } = this;

    // BG
    ctx.fillStyle = '#02000a';
    ctx.fillRect(0, 0, W, H);

    // Stars
    this.stars.forEach(s => {
      ctx.globalAlpha = 0.7;
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
    });
    ctx.globalAlpha = 1;

    // Enemies
    this.enemies.forEach(e => {
      const cols = ['#ef4444', '#f97316', '#eab308'];
      ctx.shadowColor = cols[e.type]; ctx.shadowBlur = 8;
      ctx.fillStyle = cols[e.type];
      ctx.beginPath();
      ctx.moveTo(e.x, e.y + e.h);
      ctx.lineTo(e.x - e.w / 2, e.y);
      ctx.lineTo(e.x - e.w / 4, e.y - 8);
      ctx.lineTo(e.x, e.y + 4);
      ctx.lineTo(e.x + e.w / 4, e.y - 8);
      ctx.lineTo(e.x + e.w / 2, e.y);
      ctx.closePath(); ctx.fill();
      ctx.shadowBlur = 0;
      if (e.hp > 1) {
        ctx.fillStyle = '#22c55e';
        ctx.fillRect(e.x - 12, e.y - 16, 24, 4);
        ctx.fillStyle = '#86efac';
        ctx.fillRect(e.x - 12, e.y - 16, 24 * (e.hp / 2), 4);
      }
    });

    // Player bullets
    this.bullets.forEach(b => {
      ctx.shadowColor = b.player ? '#38bdf8' : '#ef4444';
      ctx.shadowBlur = 8;
      ctx.fillStyle = b.player ? '#7dd3fc' : '#fca5a5';
      ctx.fillRect(b.x - 2, b.y - 8, 4, 16);
      ctx.shadowBlur = 0;
    });

    // Ship
    const s = this.ship;
    ctx.globalAlpha = s.invincible > 0 ? (Math.floor(s.invincible / 6) % 2 === 0 ? 0.3 : 1) : 1;
    ctx.shadowColor = '#38bdf8'; ctx.shadowBlur = 20;
    ctx.fillStyle = '#7dd3fc';
    ctx.beginPath();
    ctx.moveTo(s.x, s.y - s.h / 2);
    ctx.lineTo(s.x - s.w / 2, s.y + s.h / 2);
    ctx.lineTo(s.x - s.w / 4, s.y + s.h / 4);
    ctx.lineTo(s.x + s.w / 4, s.y + s.h / 4);
    ctx.lineTo(s.x + s.w / 2, s.y + s.h / 2);
    ctx.closePath(); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;

    // Explosions
    this.explosions.forEach(ex => {
      ctx.globalAlpha = ex.life / 18;
      ctx.strokeStyle = ex.col;
      ctx.lineWidth = 3;
      ctx.shadowColor = ex.col; ctx.shadowBlur = 12;
      ctx.beginPath(); ctx.arc(ex.x, ex.y, ex.r, 0, Math.PI * 2); ctx.stroke();
      ctx.shadowBlur = 0;
    });
    ctx.globalAlpha = 1;

    // HUD
    ctx.fillStyle = '#e2e8f0';
    ctx.font = 'bold 16px monospace';
    ctx.fillText(`Score: ${this.score}`, 10, 24);
    ctx.fillText(`Wave: ${this.wave}/5`, 10, 44);
    ctx.fillStyle = '#ef4444';
    for (let i = 0; i < s.lives; i++) {
      ctx.fillText('♥', W - 30 - i * 22, 24);
    }

    // Mobile hint
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = '13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Touch to move • Arrow keys on desktop', W / 2, H - 8);
    ctx.textAlign = 'left';

    // Game Over / Win
    if (this.over || this.won) {
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(0, 0, W, H);
      ctx.textAlign = 'center';
      ctx.shadowColor = this.won ? '#22c55e' : '#ef4444';
      ctx.shadowBlur = 24;
      ctx.fillStyle = this.won ? '#86efac' : '#fca5a5';
      ctx.font = 'bold 38px sans-serif';
      ctx.fillText(this.won ? 'YOU WIN! 🏆' : 'GAME OVER', W / 2, H / 2 - 24);
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#e2e8f0';
      ctx.font = '22px sans-serif';
      ctx.fillText(`Score: ${this.score}`, W / 2, H / 2 + 14);
      ctx.fillStyle = '#a78bfa';
      ctx.font = '15px sans-serif';
      ctx.fillText('Refresh to play again', W / 2, H / 2 + 50);
      ctx.textAlign = 'left';
    }
  }

  _loop() { this._update(); this._draw(); this.raf = requestAnimationFrame(() => this._loop()); }
}

/* ============================================================
   GAME 3 — DUNGEON QUEST
   Arrow keys / WASD or on-screen D-pad to move
   Turn-based roguelike
   ============================================================ */
class DungeonQuest {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.W = canvas.width;
    this.H = canvas.height;
    this.raf = null;
    this._handlers = {};
    this.TILE = 28;
    this.COLS = Math.floor(this.W / this.TILE);
    this.ROWS = Math.floor((this.H - 60) / this.TILE);
  }

  start() { this.reset(); this._bind(); this._loop(); }

  reset() {
    this.floor = 1;
    this.player = { x: 1, y: 1, hp: 10, maxHp: 10, atk: 3 };
    this.enemies = [];
    this.msg = 'Find the exit  [E]';
    this.over = false;
    this.won = false;
    this._generateMap();
  }

  _generateMap() {
    const { COLS, ROWS } = this;
    this.grid = [];
    for (let r = 0; r < ROWS; r++) {
      this.grid[r] = [];
      for (let c = 0; c < COLS; c++) {
        this.grid[r][c] = (r === 0 || r === ROWS - 1 || c === 0 || c === COLS - 1) ? 1 :
                          Math.random() < 0.22 ? 1 : 0;
      }
    }
    // Ensure player start is open
    for (let r = 1; r <= 2; r++) for (let c = 1; c <= 2; c++) this.grid[r][c] = 0;
    // Exit
    this.exit = { x: COLS - 2, y: ROWS - 2 };
    this.grid[this.exit.y][this.exit.x] = 0;
    for (let r = ROWS - 3; r < ROWS - 1; r++) for (let c = COLS - 3; c < COLS - 1; c++) this.grid[r][c] = 0;

    // Enemies
    this.enemies = [];
    const count = 3 + this.floor;
    for (let i = 0; i < count; i++) {
      let ex, ey;
      do { ex = 2 + Math.floor(Math.random() * (COLS - 4)); ey = 2 + Math.floor(Math.random() * (ROWS - 4)); }
      while (this.grid[ey][ex] !== 0 || (Math.abs(ex - 1) < 3 && Math.abs(ey - 1) < 3));
      this.enemies.push({ x: ex, y: ey, hp: 2 + this.floor, maxHp: 2 + this.floor, atk: 1 + Math.floor(this.floor / 2), glyph: ['👾', '💀', '🐉'][i % 3] });
    }
  }

  _bind() {
    const key = (e) => {
      const map = { ArrowUp: [0,-1], ArrowDown: [0,1], ArrowLeft: [-1,0], ArrowRight: [1,0], w: [0,-1], s: [0,1], a: [-1,0], d: [1,0], W: [0,-1], S: [0,1], A: [-1,0], D: [1,0] };
      if (map[e.key]) { e.preventDefault(); this._move(...map[e.key]); }
    };
    document.addEventListener('keydown', key);
    this._handlers.key = key;
  }

  _move(dx, dy) {
    if (this.over || this.won) { this.reset(); return; }
    const p = this.player;
    const nx = p.x + dx, ny = p.y + dy;
    if (nx < 0 || ny < 0 || nx >= this.COLS || ny >= this.ROWS) return;
    if (this.grid[ny][nx] === 1) return;

    // Attack enemy?
    const eIdx = this.enemies.findIndex(e => e.x === nx && e.y === ny);
    if (eIdx >= 0) {
      const en = this.enemies[eIdx];
      en.hp -= p.atk;
      this.msg = `You hit the ${en.glyph} for ${p.atk} damage!`;
      if (en.hp <= 0) { this.enemies.splice(eIdx, 1); this.msg = `You defeated the ${en.glyph}!`; }
    } else {
      p.x = nx; p.y = ny;
    }

    // Exit?
    if (p.x === this.exit.x && p.y === this.exit.y) {
      if (this.floor >= 4) { this.won = true; return; }
      this.floor++;
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + 3);
      this.msg = `Floor ${this.floor}! HP restored slightly.`;
      this._generateMap();
      return;
    }

    // Enemies move toward player
    this.enemies.forEach(en => {
      const dx2 = Math.sign(p.x - en.x), dy2 = Math.sign(p.y - en.y);
      const choices = [[dx2, 0], [0, dy2], [-dx2, 0], [0, -dy2]];
      for (const [ex, ey] of choices) {
        const enx = en.x + ex, eny = en.y + ey;
        if (enx < 0 || eny < 0 || enx >= this.COLS || eny >= this.ROWS) continue;
        if (this.grid[eny][enx] === 1) continue;
        if (this.enemies.some(o => o !== en && o.x === enx && o.y === eny)) continue;
        if (enx === p.x && eny === p.y) {
          p.hp -= en.atk;
          this.msg = `${en.glyph} hits you for ${en.atk}! HP: ${p.hp}`;
          if (p.hp <= 0) { this.over = true; }
        } else {
          en.x = enx; en.y = eny;
        }
        break;
      }
    });
  }

  // Called from on-screen D-pad buttons in HTML
  dpad(dir) {
    const map = { up: [0,-1], down: [0,1], left: [-1,0], right: [1,0] };
    if (map[dir]) this._move(...map[dir]);
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    document.removeEventListener('keydown', this._handlers.key);
  }

  _draw() {
    const { ctx, W, H, TILE, COLS, ROWS } = this;
    const offsetY = 48;

    ctx.fillStyle = '#0a0010';
    ctx.fillRect(0, 0, W, H);

    // HUD
    ctx.fillStyle = '#e2e8f0';
    ctx.font = 'bold 15px monospace';
    ctx.fillText(`Floor: ${this.floor}/4`, 10, 22);
    // HP bar
    ctx.fillStyle = '#374151';
    ctx.fillRect(W / 2 - 60, 8, 120, 14);
    ctx.fillStyle = this.player.hp > 4 ? '#22c55e' : '#ef4444';
    ctx.fillRect(W / 2 - 60, 8, 120 * (this.player.hp / this.player.maxHp), 14);
    ctx.fillStyle = '#fff';
    ctx.font = '11px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`HP ${this.player.hp}/${this.player.maxHp}`, W / 2, 20);
    ctx.textAlign = 'left';

    // Tiles
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const x = c * TILE, y = offsetY + r * TILE;
        if (this.grid[r][c] === 1) {
          ctx.fillStyle = '#1e1b4b';
          ctx.fillRect(x, y, TILE, TILE);
          ctx.strokeStyle = '#312e81';
          ctx.strokeRect(x, y, TILE, TILE);
        } else {
          ctx.fillStyle = '#111827';
          ctx.fillRect(x, y, TILE, TILE);
          ctx.strokeStyle = '#1f2937';
          ctx.strokeRect(x, y, TILE, TILE);
        }
      }
    }

    // Exit
    const ex = this.exit.x * TILE, ey = offsetY + this.exit.y * TILE;
    ctx.shadowColor = '#22c55e'; ctx.shadowBlur = 12;
    ctx.fillStyle = '#052e16';
    ctx.fillRect(ex, ey, TILE, TILE);
    ctx.fillStyle = '#86efac';
    ctx.font = `${TILE - 6}px sans-serif`;
    ctx.fillText('E', ex + 4, ey + TILE - 4);
    ctx.shadowBlur = 0;

    // Enemies
    this.enemies.forEach(en => {
      ctx.shadowColor = '#ef4444'; ctx.shadowBlur = 8;
      ctx.font = `${TILE - 4}px sans-serif`;
      ctx.fillText(en.glyph, en.x * TILE, offsetY + en.y * TILE + TILE - 4);
      // HP pip
      if (en.hp < en.maxHp) {
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(en.x * TILE, offsetY + en.y * TILE, TILE * (en.hp / en.maxHp), 3);
      }
      ctx.shadowBlur = 0;
    });

    // Player
    const px = this.player.x * TILE, py = offsetY + this.player.y * TILE;
    ctx.shadowColor = '#a78bfa'; ctx.shadowBlur = 16;
    ctx.fillStyle = '#a78bfa';
    ctx.font = `${TILE - 2}px sans-serif`;
    ctx.fillText('🧙', px, py + TILE - 2);
    ctx.shadowBlur = 0;

    // Message bar
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, H - 32, W, 32);
    ctx.fillStyle = '#fde68a';
    ctx.font = '13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(this.msg, W / 2, H - 12);
    ctx.textAlign = 'left';

    // Over / Won
    if (this.over || this.won) {
      ctx.fillStyle = 'rgba(0,0,0,0.75)';
      ctx.fillRect(0, 0, W, H);
      ctx.textAlign = 'center';
      ctx.shadowColor = this.won ? '#22c55e' : '#ef4444';
      ctx.shadowBlur = 24;
      ctx.fillStyle = this.won ? '#86efac' : '#fca5a5';
      ctx.font = 'bold 34px sans-serif';
      ctx.fillText(this.won ? '🏆 You Win!' : '💀 You Died', W / 2, H / 2 - 20);
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#a78bfa';
      ctx.font = '16px sans-serif';
      ctx.fillText('Tap any direction to restart', W / 2, H / 2 + 20);
      ctx.textAlign = 'left';
    }
  }

  _loop() { this._draw(); this.raf = requestAnimationFrame(() => this._loop()); }
}

/* ============================================================
   GAME 4 — STREET RACER
   Lane-switching top-down racer. Dodge traffic, collect coins.
   Arrow keys / A/D — Tap left or right half of screen on mobile.
   ============================================================ */
class StreetRacer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.W = canvas.width;
    this.H = canvas.height;
    this.raf = null;
    this._handlers = {};
    this.LANES = 3;
    this.laneW = this.W / this.LANES;
  }

  start() { this.reset(); this._bind(); this._loop(); }

  reset() {
    this.playerLane = 1;
    this.playerY = this.H - 90;
    this.enemies = [];
    this.coins = [];
    this.particles = [];
    this.score = 0;
    this.speed = 4;
    this.frame = 0;
    this.over = false;
    this.roadOffset = 0;
    this.spawnTimer = 60;
    this.coinTimer = 50;
    this._cooldown = 0;
  }

  _laneX(lane) { return this.laneW * lane + this.laneW / 2; }

  _bind() {
    const go = (dir) => {
      if (this.over) { this.reset(); return; }
      if (this._cooldown > 0) return;
      this.playerLane = Math.max(0, Math.min(this.LANES - 1, this.playerLane + dir));
      this._cooldown = 14;
    };
    const kd = (e) => {
      if (e.key === 'ArrowLeft'  || e.key === 'a' || e.key === 'A') { e.preventDefault(); go(-1); }
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') { e.preventDefault(); go(1); }
    };
    const td = (e) => {
      const r = this.canvas.getBoundingClientRect();
      const tx = e.touches[0].clientX - r.left;
      go(tx < this.W / 2 ? -1 : 1);
    };
    document.addEventListener('keydown', kd);
    this.canvas.addEventListener('touchstart', td, { passive: true });
    this._handlers = { kd, td };
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    document.removeEventListener('keydown', this._handlers.kd);
    this.canvas.removeEventListener('touchstart', this._handlers.td);
  }

  _update() {
    if (this.over) return;
    this.frame++;
    this.score++;
    this.speed = 4 + Math.min(this.score / 500, 7);
    this.roadOffset = (this.roadOffset + this.speed) % 80;
    if (this._cooldown > 0) this._cooldown--;

    this.spawnTimer--;
    if (this.spawnTimer <= 0) {
      const lane = Math.floor(Math.random() * this.LANES);
      this.enemies.push({ lane, y: -80, w: 38, h: 62 });
      this.spawnTimer = Math.max(28, 90 - this.score / 200);
    }

    this.coinTimer--;
    if (this.coinTimer <= 0) {
      this.coins.push({ lane: Math.floor(Math.random() * this.LANES), y: -16 });
      this.coinTimer = 40 + Math.floor(Math.random() * 30);
    }

    this.enemies.forEach(e => e.y += this.speed);
    this.enemies = this.enemies.filter(e => e.y < this.H + 100);
    this.coins.forEach(c => c.y += this.speed * 0.85);
    this.coins = this.coins.filter(c => c.y < this.H + 30);

    const px = this._laneX(this.playerLane);
    for (const e of this.enemies) {
      if (Math.abs(px - this._laneX(e.lane)) < 34 && Math.abs(this.playerY - e.y) < 55) {
        this.over = true;
        for (let i = 0; i < 22; i++) {
          const a = Math.random() * Math.PI * 2;
          this.particles.push({ x: px, y: this.playerY, vx: Math.cos(a) * 7, vy: Math.sin(a) * 7, life: 35, col: `hsl(${Math.random() * 40},100%,60%)` });
        }
      }
    }
    this.coins = this.coins.filter(c => {
      if (c.lane === this.playerLane && Math.abs(this.playerY - c.y) < 38) { this.score += 50; return false; }
      return true;
    });
    this.particles.forEach(pt => { pt.x += pt.vx; pt.y += pt.vy; pt.vx *= 0.92; pt.vy *= 0.92; pt.life--; });
    this.particles = this.particles.filter(pt => pt.life > 0);
  }

  _drawCar(x, y, top, body) {
    const ctx = this.ctx, w = 38, h = 64;
    ctx.shadowColor = top; ctx.shadowBlur = 12;
    ctx.fillStyle = body;
    ctx.beginPath(); ctx.roundRect(x - w/2, y - h/2, w, h, 6); ctx.fill();
    ctx.fillStyle = top;
    ctx.beginPath(); ctx.roundRect(x - w/2 + 4, y - h/2 + 12, w - 8, 18, 3); ctx.fill();
    ctx.fillStyle = 'rgba(0,200,255,0.25)';
    ctx.fillRect(x - w/2 + 6, y - h/2 + 14, w - 12, 14);
    ctx.fillStyle = '#111';
    [[-w/2, -h/2 - 5], [w/2 - 8, -h/2 - 5], [-w/2, h/2 - 4], [w/2 - 8, h/2 - 4]].forEach(([ox, oy]) => {
      ctx.fillRect(x + ox, y + oy, 8, 9);
    });
    ctx.shadowBlur = 0;
  }

  _draw() {
    const { ctx, W, H } = this;
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, W, H);

    // Road markings
    ctx.strokeStyle = '#f59e0b'; ctx.lineWidth = 2;
    ctx.setLineDash([40, 40]); ctx.lineDashOffset = -this.roadOffset;
    for (let i = 1; i < this.LANES; i++) {
      const x = this.laneW * i;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(2, 0); ctx.lineTo(2, H); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(W - 2, 0); ctx.lineTo(W - 2, H); ctx.stroke();

    // Coins
    this.coins.forEach(c => {
      const cx = this._laneX(c.lane);
      ctx.shadowColor = '#f59e0b'; ctx.shadowBlur = 12;
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath(); ctx.arc(cx, c.y, 11, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fde68a';
      ctx.beginPath(); ctx.arc(cx - 2, c.y - 2, 5, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
    });

    this.enemies.forEach(e => this._drawCar(this._laneX(e.lane), e.y, '#ef4444', '#7f1d1d'));
    if (!this.over) this._drawCar(this._laneX(this.playerLane), this.playerY, '#38bdf8', '#0369a1');

    this.particles.forEach(pt => {
      ctx.globalAlpha = pt.life / 35;
      ctx.fillStyle = pt.col;
      ctx.fillRect(pt.x - 3, pt.y - 3, 6, 6);
    });
    ctx.globalAlpha = 1;

    ctx.fillStyle = '#fff'; ctx.font = 'bold 16px monospace';
    ctx.fillText(`Score: ${this.score}`, 10, 24);
    ctx.fillText(`${Math.round(60 + this.speed * 20)} mph`, W - 100, 24);
    ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.font = '13px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('Tap left/right · Arrow keys to switch lanes', W/2, H - 8);
    ctx.textAlign = 'left';

    if (this.over) {
      ctx.fillStyle = 'rgba(0,0,0,0.68)'; ctx.fillRect(0, 0, W, H);
      ctx.textAlign = 'center';
      ctx.shadowColor = '#ef4444'; ctx.shadowBlur = 22;
      ctx.fillStyle = '#fca5a5'; ctx.font = 'bold 38px sans-serif'; ctx.fillText('CRASHED! 💥', W/2, H/2 - 22);
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#fff'; ctx.font = '22px sans-serif'; ctx.fillText(`Score: ${this.score}`, W/2, H/2 + 14);
      ctx.fillStyle = '#a78bfa'; ctx.font = '15px sans-serif'; ctx.fillText('Tap to race again', W/2, H/2 + 50);
      ctx.textAlign = 'left';
    }
  }

  _loop() { this._update(); this._draw(); this.raf = requestAnimationFrame(() => this._loop()); }
}

/* ============================================================
   GAME 5 — SKY JUMPER
   Doodle-Jump style platform climber.
   Arrow keys / A/D or tap left/right half of screen to steer.
   ============================================================ */
class SkyJumper {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.W = canvas.width;
    this.H = canvas.height;
    this.raf = null;
    this._handlers = {};
  }

  start() { this.reset(); this._bind(); this._loop(); }

  reset() {
    this.p = { x: this.W / 2, y: this.H - 100, w: 28, h: 32, vx: 0, vy: -13 };
    this.platforms = [];
    this.springs = [];
    this.score = 0;
    this.camY = 0;
    this.over = false;
    this.frame = 0;
    this.keys = {};

    for (let i = 0; i < 14; i++) {
      this.platforms.push(this._makePlat(this.H - i * 75));
    }
    // Safe start platform
    this.platforms[0] = { x: this.W / 2 - 45, y: this.H - 60, w: 90, h: 14, type: 'solid', dir: 1, spd: 0 };
  }

  _makePlat(y) {
    const w = 55 + Math.random() * 35;
    const x = Math.random() * (this.W - w);
    const moving = this.score > 800 && Math.random() > 0.55;
    return { x, y, w, h: 14, type: moving ? 'moving' : 'solid', spd: moving ? 1.4 + Math.random() : 0, dir: 1 };
  }

  _bind() {
    const kd = (e) => { this.keys[e.key] = true; if (this.over && e.key === ' ') this.reset(); };
    const ku = (e) => { this.keys[e.key] = false; };
    const td = (e) => {
      if (this.over) { this.reset(); return; }
      const r = this.canvas.getBoundingClientRect();
      this._touchDir = e.touches[0].clientX - r.left < this.W / 2 ? -1 : 1;
    };
    const te = () => { this._touchDir = 0; };
    document.addEventListener('keydown', kd);
    document.addEventListener('keyup', ku);
    this.canvas.addEventListener('touchstart', td, { passive: true });
    this.canvas.addEventListener('touchend', te);
    this._touchDir = 0;
    this._handlers = { kd, ku, td, te };
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    document.removeEventListener('keydown', this._handlers.kd);
    document.removeEventListener('keyup', this._handlers.ku);
    this.canvas.removeEventListener('touchstart', this._handlers.td);
    this.canvas.removeEventListener('touchend', this._handlers.te);
  }

  _update() {
    if (this.over) return;
    const p = this.p; const { keys } = this;
    this.frame++;

    let dx = 0;
    if (keys['ArrowLeft'] || keys['a'] || keys['A']) dx = -1;
    if (keys['ArrowRight'] || keys['d'] || keys['D']) dx = 1;
    if (this._touchDir) dx = this._touchDir;
    p.vx = dx * 4.5;

    p.vy += 0.55;
    p.x += p.vx; p.y += p.vy;
    if (p.x + p.w < 0) p.x = this.W;
    if (p.x > this.W) p.x = -p.w;

    // Camera scroll
    if (p.y < this.H * 0.45) {
      const shift = this.H * 0.45 - p.y;
      p.y = this.H * 0.45;
      this.camY += shift;
      this.score = Math.max(this.score, Math.round(this.camY / 2));
      this.platforms.forEach(pl => pl.y += shift);
    }

    // Land on platform (only when falling)
    if (p.vy > 0) {
      for (const pl of this.platforms) {
        if (p.x + p.w - 5 > pl.x && p.x + 5 < pl.x + pl.w &&
            p.y + p.h >= pl.y && p.y + p.h <= pl.y + pl.h + p.vy + 4) {
          p.y = pl.y - p.h; p.vy = -14;
          break;
        }
      }
    }

    // Move platforms
    this.platforms.forEach(pl => {
      if (pl.type === 'moving') {
        pl.x += pl.spd * pl.dir;
        if (pl.x < 0 || pl.x + pl.w > this.W) pl.dir *= -1;
      }
    });

    // Cull and spawn
    this.platforms = this.platforms.filter(pl => pl.y < this.H + 30);
    while (this.platforms.length < 15) {
      const top = Math.min(...this.platforms.map(pl => pl.y));
      this.platforms.push(this._makePlat(top - 68 - Math.random() * 25));
    }

    if (p.y > this.H + 60) this.over = true;
  }

  _draw() {
    const { ctx, W, H } = this;
    const prog = Math.min(this.score / 4000, 1);
    ctx.fillStyle = `rgb(${Math.round(10 - prog * 10)},${Math.round(5)},${Math.round(30 + prog * 70)})`;
    ctx.fillRect(0, 0, W, H);

    // Stars
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    for (let i = 0; i < 50; i++) ctx.fillRect((i * 139 + this.camY * 0.08) % W, (i * 89 + this.camY * 0.04) % H, 2, 2);

    // Platforms
    this.platforms.forEach(pl => {
      const c = pl.type === 'moving' ? '#f59e0b' : '#22c55e';
      ctx.shadowColor = c; ctx.shadowBlur = 8;
      ctx.fillStyle = c;
      ctx.beginPath(); ctx.roundRect(pl.x, pl.y, pl.w, pl.h, 5); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.fillRect(pl.x + 6, pl.y + 3, pl.w - 12, 4);
      ctx.shadowBlur = 0;
    });

    // Player
    if (!this.over) {
      const p = this.p;
      ctx.shadowColor = '#c4b5fd'; ctx.shadowBlur = 18;
      ctx.fillStyle = '#7c3aed';
      ctx.beginPath(); ctx.roundRect(p.x, p.y, p.w, p.h, 8); ctx.fill();
      ctx.fillStyle = '#c4b5fd';
      ctx.beginPath(); ctx.roundRect(p.x + 4, p.y + 4, p.w - 8, p.h - 12, 4); ctx.fill();
      ctx.fillStyle = '#1a0040';
      ctx.fillRect(p.x + 7, p.y + 8, 5, 5);
      ctx.fillRect(p.x + 16, p.y + 8, 5, 5);
      ctx.shadowBlur = 0;
    }

    // HUD
    ctx.fillStyle = '#fff'; ctx.font = 'bold 16px monospace';
    ctx.fillText(`Height: ${this.score}m`, 10, 24);
    ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.font = '13px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('Tap left/right · Arrow keys to steer', W/2, H - 8);
    ctx.textAlign = 'left';

    if (this.over) {
      ctx.fillStyle = 'rgba(0,0,0,0.72)'; ctx.fillRect(0, 0, W, H);
      ctx.textAlign = 'center';
      ctx.shadowColor = '#a78bfa'; ctx.shadowBlur = 22;
      ctx.fillStyle = '#c4b5fd'; ctx.font = 'bold 36px sans-serif'; ctx.fillText('YOU FELL! 😱', W/2, H/2 - 22);
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#fff'; ctx.font = '22px sans-serif'; ctx.fillText(`Height: ${this.score}m`, W/2, H/2 + 14);
      ctx.fillStyle = '#86efac'; ctx.font = '15px sans-serif'; ctx.fillText('Tap to jump again', W/2, H/2 + 50);
      ctx.textAlign = 'left';
    }
  }

  _loop() { this._update(); this._draw(); this.raf = requestAnimationFrame(() => this._loop()); }
}

/* ============================================================
   GAME 6 — ARENA BRAWL
   Top-down wave fighter. Defeat all enemies to win.
   WASD / Arrow keys to move · Space to attack.
   Mobile: drag to move · tap with 2nd finger to attack.
   ============================================================ */
class ArenaBrawl {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.W = canvas.width;
    this.H = canvas.height;
    this.raf = null;
    this._handlers = {};
  }

  start() { this.reset(); this._bind(); this._loop(); }

  reset() {
    this.p = { x: this.W/2, y: this.H/2, r: 16, hp: 8, maxHp: 8, spd: 3.2, atkTimer: 0, atkR: 0, atking: false, inv: 0 };
    this.enemies = [];
    this.particles = [];
    this.score = 0;
    this.wave = 1;
    this.frame = 0;
    this.over = false;
    this.won = false;
    this.keys = {};
    this._touch = { active: false, x: 0, y: 0 };
    this._spawnWave();
  }

  _spawnWave() {
    const count = 3 + this.wave * 2;
    for (let i = 0; i < count; i++) {
      const side = Math.floor(Math.random() * 4);
      const big = this.wave >= 3 && Math.random() > 0.6;
      let x, y;
      if (side === 0) { x = Math.random() * this.W; y = -25; }
      else if (side === 1) { x = this.W + 25; y = Math.random() * this.H; }
      else if (side === 2) { x = Math.random() * this.W; y = this.H + 25; }
      else { x = -25; y = Math.random() * this.H; }
      this.enemies.push({ x, y, r: big ? 22 : 14, hp: big ? 5 : 2, maxHp: big ? 5 : 2, spd: big ? 1.1 : 1.7 + Math.random() * 0.6, col: big ? '#dc2626' : '#f97316' });
    }
  }

  _bind() {
    const atk = () => this._attack();
    const kd = (e) => { this.keys[e.key] = true; if (e.key === ' ') { e.preventDefault(); atk(); } };
    const ku = (e) => { this.keys[e.key] = false; };
    const td = (e) => {
      e.preventDefault();
      if ((this.over || this.won) && e.touches.length === 1) { this.reset(); return; }
      const r = this.canvas.getBoundingClientRect();
      this._touch = { active: true, x: e.touches[0].clientX - r.left, y: e.touches[0].clientY - r.top };
      if (e.touches.length >= 2) atk();
    };
    const tm = (e) => { if (!this._touch.active) return; const r = this.canvas.getBoundingClientRect(); this._touch.x = e.touches[0].clientX - r.left; this._touch.y = e.touches[0].clientY - r.top; };
    const te = () => { this._touch.active = false; };
    document.addEventListener('keydown', kd);
    document.addEventListener('keyup', ku);
    this.canvas.addEventListener('touchstart', td, { passive: false });
    this.canvas.addEventListener('touchmove', tm, { passive: false });
    this.canvas.addEventListener('touchend', te);
    this._handlers = { kd, ku, td, tm, te };
  }

  _attack() {
    const p = this.p;
    if (p.atkTimer > 0) return;
    p.atking = true; p.atkR = 62; p.atkTimer = 26;
    this.enemies = this.enemies.filter(e => {
      if (Math.hypot(e.x - p.x, e.y - p.y) < p.atkR + e.r) {
        e.hp--;
        this._spark(e.x, e.y, '#fde68a');
        if (e.hp <= 0) { this.score += 100 * this.wave; this._spark(e.x, e.y, '#ef4444'); return false; }
      }
      return true;
    });
  }

  _spark(x, y, col) {
    for (let i = 0; i < 10; i++) {
      const a = Math.random() * Math.PI * 2;
      this.particles.push({ x, y, vx: Math.cos(a) * 5, vy: Math.sin(a) * 5, life: 22, col });
    }
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    document.removeEventListener('keydown', this._handlers.kd);
    document.removeEventListener('keyup', this._handlers.ku);
    this.canvas.removeEventListener('touchstart', this._handlers.td);
    this.canvas.removeEventListener('touchmove', this._handlers.tm);
    this.canvas.removeEventListener('touchend', this._handlers.te);
  }

  _update() {
    if (this.over || this.won) return;
    const p = this.p; const { keys } = this;
    this.frame++;
    let dx = 0, dy = 0;
    if (keys['ArrowLeft']  || keys['a'] || keys['A']) dx -= 1;
    if (keys['ArrowRight'] || keys['d'] || keys['D']) dx += 1;
    if (keys['ArrowUp']    || keys['w'] || keys['W']) dy -= 1;
    if (keys['ArrowDown']  || keys['s'] || keys['S']) dy += 1;
    if (this._touch.active) {
      const jdx = this._touch.x - p.x, jdy = this._touch.y - p.y;
      const jd = Math.hypot(jdx, jdy);
      if (jd > 12) { dx = jdx / jd; dy = jdy / jd; }
    }
    if (dx && dy) { dx *= 0.707; dy *= 0.707; }
    p.x = Math.max(p.r, Math.min(this.W - p.r, p.x + dx * p.spd));
    p.y = Math.max(p.r, Math.min(this.H - p.r, p.y + dy * p.spd));
    if (p.atkTimer > 0) p.atkTimer--; else p.atking = false;
    if (p.inv > 0) p.inv--;

    this.enemies.forEach(e => {
      const ex = p.x - e.x, ey = p.y - e.y, ed = Math.hypot(ex, ey);
      if (ed > 1) { e.x += (ex/ed)*e.spd; e.y += (ey/ed)*e.spd; }
      if (p.inv <= 0 && Math.hypot(e.x - p.x, e.y - p.y) < p.r + e.r) {
        p.hp--; p.inv = 60; this._spark(p.x, p.y, '#38bdf8');
        if (p.hp <= 0) this.over = true;
      }
    });

    if (this.enemies.length === 0) {
      this.wave++;
      if (this.wave > 5) { this.won = true; return; }
      this._spawnWave();
    }
    this.particles.forEach(pt => { pt.x += pt.vx; pt.y += pt.vy; pt.vx *= 0.88; pt.vy *= 0.88; pt.life--; });
    this.particles = this.particles.filter(pt => pt.life > 0);
  }

  _draw() {
    const { ctx, W, H } = this; const p = this.p;
    ctx.fillStyle = '#0c0818'; ctx.fillRect(0, 0, W, H);
    ctx.shadowColor = '#7c3aed'; ctx.shadowBlur = 22;
    ctx.strokeStyle = '#7c3aed'; ctx.lineWidth = 4;
    ctx.strokeRect(4, 4, W - 8, H - 8);
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(124,58,237,0.08)'; ctx.lineWidth = 1;
    for (let x = 40; x < W; x += 40) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); }
    for (let y = 40; y < H; y += 40) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }

    if (p.atking) {
      const f = p.atkTimer / 26;
      ctx.globalAlpha = f * 0.28; ctx.fillStyle = '#f59e0b';
      ctx.beginPath(); ctx.arc(p.x, p.y, p.atkR, 0, Math.PI*2); ctx.fill();
      ctx.globalAlpha = f * 0.7; ctx.strokeStyle = '#fde68a'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.atkR, 0, Math.PI*2); ctx.stroke();
      ctx.globalAlpha = 1;
    }

    this.enemies.forEach(e => {
      ctx.shadowColor = e.col; ctx.shadowBlur = 14; ctx.fillStyle = e.col;
      ctx.beginPath(); ctx.arc(e.x, e.y, e.r, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(e.x-4, e.y-4, 4, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(e.x+4, e.y-4, 4, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#111';
      ctx.beginPath(); ctx.arc(e.x-4, e.y-4, 2, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(e.x+4, e.y-4, 2, 0, Math.PI*2); ctx.fill();
      ctx.shadowBlur = 0;
      if (e.hp < e.maxHp) {
        ctx.fillStyle = '#374151'; ctx.fillRect(e.x - e.r, e.y - e.r - 8, e.r*2, 5);
        ctx.fillStyle = '#22c55e'; ctx.fillRect(e.x - e.r, e.y - e.r - 8, e.r*2*(e.hp/e.maxHp), 5);
      }
    });

    ctx.globalAlpha = p.inv > 0 ? (Math.floor(p.inv/6)%2===0 ? 0.3 : 1) : 1;
    ctx.shadowColor = '#a78bfa'; ctx.shadowBlur = 22; ctx.fillStyle = '#7c3aed';
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI*2); ctx.fill();
    ctx.strokeStyle = '#fde68a'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + p.r + 12, p.y - 12); ctx.stroke();
    ctx.shadowBlur = 0; ctx.globalAlpha = 1;

    this.particles.forEach(pt => {
      ctx.globalAlpha = pt.life / 22; ctx.fillStyle = pt.col;
      ctx.beginPath(); ctx.arc(pt.x, pt.y, 4, 0, Math.PI*2); ctx.fill();
    });
    ctx.globalAlpha = 1;

    ctx.fillStyle = '#fff'; ctx.font = 'bold 16px monospace';
    ctx.fillText(`Score: ${this.score}`, 10, 24);
    ctx.fillText(`Wave: ${this.wave}/5`, 10, 44);
    ctx.fillStyle = '#374151'; ctx.fillRect(W-134, 8, 120, 16);
    ctx.fillStyle = p.hp > 3 ? '#22c55e' : '#ef4444'; ctx.fillRect(W-134, 8, 120*(p.hp/p.maxHp), 16);
    ctx.fillStyle = '#fff'; ctx.font = '12px monospace'; ctx.textAlign='center';
    ctx.fillText(`HP ${p.hp}/${p.maxHp}`, W-74, 21); ctx.textAlign='left';
    ctx.fillStyle = p.atkTimer===0 ? '#fde68a' : '#64748b'; ctx.font='bold 13px monospace';
    ctx.fillText(p.atkTimer===0 ? '⚔ READY' : `⚔ ${p.atkTimer}`, W-90, 44);
    ctx.fillStyle='rgba(255,255,255,0.35)'; ctx.font='12px sans-serif'; ctx.textAlign='center';
    ctx.fillText('WASD/drag to move · SPACE/2-finger tap to attack', W/2, H-8);
    ctx.textAlign='left';

    if (this.over || this.won) {
      ctx.fillStyle = 'rgba(0,0,0,0.72)'; ctx.fillRect(0,0,W,H);
      ctx.textAlign='center';
      ctx.shadowColor = this.won?'#22c55e':'#ef4444'; ctx.shadowBlur=24;
      ctx.fillStyle = this.won?'#86efac':'#fca5a5'; ctx.font='bold 36px sans-serif';
      ctx.fillText(this.won?'⚔ CHAMPION! ⚔':'💀 DEFEATED', W/2, H/2-22);
      ctx.shadowBlur=0; ctx.fillStyle='#fff'; ctx.font='22px sans-serif';
      ctx.fillText(`Score: ${this.score}`, W/2, H/2+14);
      ctx.fillStyle='#a78bfa'; ctx.font='15px sans-serif';
      ctx.fillText('Tap to fight again', W/2, H/2+50);
      ctx.textAlign='left';
    }
  }

  _loop() { this._update(); this._draw(); this.raf = requestAnimationFrame(() => this._loop()); }
}

/* ============================================================
   GAME 7 — FREE RACE  (JudahBoo's personal game)
   Open-road top-down racer with drifting and nitro boosts.
   Arrow keys / WASD · Tap to steer on mobile.
   ============================================================ */
class FreeRace {
  constructor(canvas) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d');
    this.W = canvas.width; this.H = canvas.height;
    this.raf = null; this._handlers = {};
  }
  start() { this.reset(); this._bind(); this._loop(); }
  reset() {
    this.p = { x: this.W/2, y: this.H-100, w:36, h:60, angle:0, spd:0, drift:0, nitro:3, nitroTimer:0 };
    this.obstacles=[]; this.nitros=[]; this.particles=[];
    this.score=0; this.frame=0; this.over=false;
    this.road=[]; this.roadX=this.W/2; this.roadCurve=0; this.curveCd=0;
    this.spawnTimer=80; this.nitroSpawn=150; this.keys={}; this._touchX=null;
    for(let i=0;i<20;i++) this._addSeg(i*this.H/20);
  }
  _addSeg(y){
    this.roadX+=this.roadCurve*3;
    this.roadX=Math.max(100,Math.min(this.W-100,this.roadX));
    this.road.push({x:this.roadX,y,w:200});
  }
  _bind(){
    const kd=(e)=>{this.keys[e.key]=true;if(['ArrowUp','ArrowDown',' '].includes(e.key))e.preventDefault();};
    const ku=(e)=>{this.keys[e.key]=false;};
    const td=(e)=>{const r=this.canvas.getBoundingClientRect();this._touchX=e.touches[0].clientX-r.left;};
    const tm=(e)=>{const r=this.canvas.getBoundingClientRect();this._touchX=e.touches[0].clientX-r.left;};
    const te=()=>{this._touchX=null;};
    document.addEventListener('keydown',kd); document.addEventListener('keyup',ku);
    this.canvas.addEventListener('touchstart',td,{passive:true});
    this.canvas.addEventListener('touchmove',tm,{passive:true});
    this.canvas.addEventListener('touchend',te);
    this._handlers={kd,ku,td,tm,te};
  }
  destroy(){
    cancelAnimationFrame(this.raf);
    document.removeEventListener('keydown',this._handlers.kd);
    document.removeEventListener('keyup',this._handlers.ku);
    this.canvas.removeEventListener('touchstart',this._handlers.td);
    this.canvas.removeEventListener('touchmove',this._handlers.tm);
    this.canvas.removeEventListener('touchend',this._handlers.te);
  }
  _update(){
    if(this.over)return;
    const p=this.p; const {keys}=this;
    this.frame++; this.score++;
    this.curveCd--;
    if(this.curveCd<=0){this.roadCurve=(Math.random()-.5)*0.8;this.curveCd=80+Math.floor(Math.random()*120);}
    let accel=0,steer=0;
    if(keys['ArrowUp']||keys['w']||keys['W'])accel=1;
    if(keys['ArrowDown']||keys['s']||keys['S'])accel=-1;
    if(keys['ArrowLeft']||keys['a']||keys['A'])steer=-1;
    if(keys['ArrowRight']||keys['d']||keys['D'])steer=1;
    if(keys[' ']&&p.nitro>0&&p.nitroTimer<=0){p.nitro--;p.nitroTimer=60;}
    if(this._touchX!==null)steer=this._touchX<this.W/2?-1:1;
    const boost=p.nitroTimer>0?1.6:1;
    p.spd=Math.max(0,Math.min(9*boost,p.spd+accel*0.25-(accel===0?0.12:0)));
    p.drift=p.drift*0.85+steer*0.15;
    p.angle+=p.drift*(p.spd/9)*0.08;
    p.x+=Math.sin(p.angle)*p.spd+p.drift*p.spd*0.4;
    p.y-=Math.cos(p.angle)*p.spd*0.15;
    p.y=Math.max(80,Math.min(this.H-80,p.y));
    p.x=Math.max(20,Math.min(this.W-20,p.x));
    if(p.nitroTimer>0){p.nitroTimer--;this.particles.push({x:p.x,y:p.y+30,vx:(Math.random()-.5)*3,vy:2+Math.random()*2,life:20,col:'#f59e0b'});}
    const scrollSpd=p.spd*4;
    this.road.forEach(r=>r.y+=scrollSpd);
    while(this.road[this.road.length-1].y>0)this._addSeg(this.road[this.road.length-1].y-this.H/20);
    this.road=this.road.filter(r=>r.y<this.H+40);
    this.spawnTimer--;
    if(this.spawnTimer<=0){const rx=this.road[Math.floor(this.road.length/2)];this.obstacles.push({x:rx?rx.x+(Math.random()-.5)*120:this.W/2,y:-50,w:36,h:58});this.spawnTimer=Math.max(40,90-this.score/300);}
    this.obstacles.forEach(o=>o.y+=scrollSpd);
    this.obstacles=this.obstacles.filter(o=>o.y<this.H+60);
    this.nitroSpawn--;
    if(this.nitroSpawn<=0){const rx=this.road[5];this.nitros.push({x:rx?rx.x:this.W/2,y:-20});this.nitroSpawn=200;}
    this.nitros.forEach(n=>n.y+=scrollSpd);
    this.nitros=this.nitros.filter(n=>{if(Math.abs(n.x-p.x)<30&&Math.abs(n.y-p.y)<30){p.nitro=Math.min(p.nitro+1,5);return false;}return n.y<this.H+30;});
    for(const o of this.obstacles){if(Math.abs(p.x-o.x)<32&&Math.abs(p.y-o.y)<44){this.over=true;for(let i=0;i<20;i++){const a=Math.random()*Math.PI*2;this.particles.push({x:p.x,y:p.y,vx:Math.cos(a)*7,vy:Math.sin(a)*7,life:35,col:'#ef4444'});}}}
    this.particles.forEach(pt=>{pt.x+=pt.vx;pt.y+=pt.vy;pt.vy+=0.2;pt.life--;});
    this.particles=this.particles.filter(pt=>pt.life>0);
  }
  _draw(){
    const{ctx,W,H}=this;const p=this.p;
    ctx.fillStyle='#166534';ctx.fillRect(0,0,W,H);
    for(let i=0;i<this.road.length-1;i++){const a=this.road[i],b=this.road[i+1];ctx.fillStyle=i%2===0?'#374151':'#4b5563';ctx.beginPath();ctx.moveTo(a.x-a.w/2,a.y);ctx.lineTo(a.x+a.w/2,a.y);ctx.lineTo(b.x+b.w/2,b.y);ctx.lineTo(b.x-b.w/2,b.y);ctx.closePath();ctx.fill();if(i%2===0){ctx.strokeStyle='#fde68a';ctx.lineWidth=2;ctx.setLineDash([20,20]);ctx.lineDashOffset=this.frame*p.spd*2;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();ctx.setLineDash([]);}}
    this.nitros.forEach(n=>{ctx.shadowColor='#f59e0b';ctx.shadowBlur=14;ctx.fillStyle='#f59e0b';ctx.beginPath();ctx.arc(n.x,n.y,12,0,Math.PI*2);ctx.fill();ctx.fillStyle='#fff';ctx.font='bold 11px sans-serif';ctx.textAlign='center';ctx.fillText('N',n.x,n.y+4);ctx.textAlign='left';ctx.shadowBlur=0;});
    this.obstacles.forEach(o=>{ctx.shadowColor='#ef4444';ctx.shadowBlur=8;ctx.fillStyle='#b91c1c';ctx.beginPath();ctx.roundRect(o.x-o.w/2,o.y-o.h/2,o.w,o.h,5);ctx.fill();ctx.fillStyle='#ef4444';ctx.fillRect(o.x-o.w/2+4,o.y-o.h/2+10,o.w-8,14);ctx.shadowBlur=0;});
    this.particles.forEach(pt=>{ctx.globalAlpha=pt.life/35;ctx.fillStyle=pt.col;ctx.fillRect(pt.x-3,pt.y-3,6,6);});ctx.globalAlpha=1;
    if(!this.over){ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.angle);ctx.shadowColor=p.nitroTimer>0?'#f59e0b':'#38bdf8';ctx.shadowBlur=16;ctx.fillStyle=p.nitroTimer>0?'#f59e0b':'#38bdf8';ctx.beginPath();ctx.roundRect(-p.w/2,-p.h/2,p.w,p.h,6);ctx.fill();ctx.fillStyle='#0369a1';ctx.fillRect(-p.w/2+4,-p.h/2+10,p.w-8,18);ctx.shadowBlur=0;ctx.restore();}
    ctx.fillStyle='#fff';ctx.font='bold 16px monospace';ctx.fillText(`Score: ${this.score}`,10,24);ctx.fillText(`${Math.round(p.spd*22)} mph`,10,44);
    for(let i=0;i<p.nitro;i++){ctx.fillStyle='#f59e0b';ctx.shadowColor='#f59e0b';ctx.shadowBlur=8;ctx.fillRect(W-20-i*18,10,14,22);ctx.shadowBlur=0;}
    ctx.fillStyle='rgba(255,255,255,0.4)';ctx.font='13px sans-serif';ctx.textAlign='center';ctx.fillText('↑↓ Accel · ←→ Steer · SPACE Nitro · Tap sides to steer',W/2,H-8);ctx.textAlign='left';
    if(this.over){ctx.fillStyle='rgba(0,0,0,0.7)';ctx.fillRect(0,0,W,H);ctx.textAlign='center';ctx.shadowColor='#ef4444';ctx.shadowBlur=22;ctx.fillStyle='#fca5a5';ctx.font='bold 36px sans-serif';ctx.fillText('CRASHED! 💥',W/2,H/2-22);ctx.shadowBlur=0;ctx.fillStyle='#fff';ctx.font='22px sans-serif';ctx.fillText(`Score: ${this.score}`,W/2,H/2+14);ctx.fillStyle='#a78bfa';ctx.font='15px sans-serif';ctx.fillText('Tap to race again',W/2,H/2+50);ctx.textAlign='left';}
  }
  _loop(){if(this.over&&this._touchX!==null){this.reset();}this._update();this._draw();this.raf=requestAnimationFrame(()=>this._loop());}
}

/* ============================================================
   GAME 8 — BUS DRIVER
   Drive a city bus through traffic. Pick up and drop off passengers.
   Arrow keys / tap left-right to switch lanes.
   ============================================================ */
class BusDriver {
  constructor(canvas) {
    this.canvas=canvas;this.ctx=canvas.getContext('2d');
    this.W=canvas.width;this.H=canvas.height;
    this.raf=null;this._handlers={};
    this.LANES=4;this.laneW=this.W/this.LANES;
  }
  start(){this.reset();this._bind();this._loop();}
  reset(){
    this.busLane=1;this.busY=this.H-110;
    this.passengers=0;this.capacity=6;this.delivered=0;
    this.traffic=[];this.stops=[];this.dropZones=[];
    this.score=0;this.speed=3;this.frame=0;this.over=false;
    this.roadOffset=0;this.cooldown=0;
    this.spawnTimer=55;this.stopTimer=180;
    this.msg='';this.msgTimer=0;
  }
  _laneX(l){return this.laneW*l+this.laneW/2;}
  _bind(){
    const go=(dir)=>{if(this.over){this.reset();return;}if(this.cooldown>0)return;this.busLane=Math.max(0,Math.min(this.LANES-1,this.busLane+dir));this.cooldown=16;};
    const kd=(e)=>{if(e.key==='ArrowLeft'||e.key==='a'||e.key==='A'){e.preventDefault();go(-1);}if(e.key==='ArrowRight'||e.key==='d'||e.key==='D'){e.preventDefault();go(1);}};
    const td=(e)=>{const r=this.canvas.getBoundingClientRect();go(e.touches[0].clientX-r.left<this.W/2?-1:1);};
    document.addEventListener('keydown',kd);
    this.canvas.addEventListener('touchstart',td,{passive:true});
    this._handlers={kd,td};
  }
  destroy(){cancelAnimationFrame(this.raf);document.removeEventListener('keydown',this._handlers.kd);this.canvas.removeEventListener('touchstart',this._handlers.td);}
  _update(){
    if(this.over)return;
    this.frame++;this.score++;if(this.cooldown>0)this.cooldown--;
    this.speed=3+Math.min(this.score/1000,3);
    this.roadOffset=(this.roadOffset+this.speed)%80;
    if(this.msgTimer>0)this.msgTimer--;
    this.stopTimer--;
    if(this.stopTimer<=0&&this.stops.length<3){const lane=Math.floor(Math.random()*this.LANES);this.stops.push({lane,y:-60,count:1+Math.floor(Math.random()*3)});this.stopTimer=200+Math.floor(Math.random()*100);}
    this.stops.forEach(s=>s.y+=this.speed);
    this.stops=this.stops.filter(s=>{if(s.lane===this.busLane&&Math.abs(this.busY-s.y)<55){const pick=Math.min(s.count,this.capacity-this.passengers);this.passengers+=pick;this.score+=pick*20;this.msg=`+${pick} passenger${pick>1?'s':''}! 🧑`;this.msgTimer=90;return false;}return s.y<this.H+80;});
    if(this.passengers>0&&this.dropZones.length<2&&Math.random()<0.004){this.dropZones.push({lane:Math.floor(Math.random()*this.LANES),y:-60});}
    this.dropZones.forEach(d=>d.y+=this.speed);
    this.dropZones=this.dropZones.filter(d=>{if(d.lane===this.busLane&&Math.abs(this.busY-d.y)<55&&this.passengers>0){this.score+=this.passengers*50;this.delivered+=this.passengers;this.msg=`Dropped off ${this.passengers}! 🏁 +${this.passengers*50}pts`;this.msgTimer=100;this.passengers=0;return false;}return d.y<this.H+80;});
    this.spawnTimer--;
    if(this.spawnTimer<=0){this.traffic.push({lane:Math.floor(Math.random()*this.LANES),y:-80});this.spawnTimer=Math.max(28,70-this.score/400);}
    this.traffic.forEach(t=>t.y+=this.speed*0.65);
    this.traffic=this.traffic.filter(t=>t.y<this.H+100);
    for(const t of this.traffic){if(t.lane===this.busLane&&Math.abs(this.busY-t.y)<60){this.over=true;}}
  }
  _draw(){
    const{ctx,W,H}=this;
    ctx.fillStyle='#1f2937';ctx.fillRect(0,0,W,H);
    ctx.strokeStyle='#6b7280';ctx.lineWidth=2;ctx.setLineDash([40,40]);ctx.lineDashOffset=-this.roadOffset;
    for(let i=1;i<this.LANES;i++){const x=this.laneW*i;ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();}
    ctx.setLineDash([]);ctx.strokeStyle='#fff';ctx.lineWidth=3;
    ctx.beginPath();ctx.moveTo(2,0);ctx.lineTo(2,H);ctx.stroke();
    ctx.beginPath();ctx.moveTo(W-2,0);ctx.lineTo(W-2,H);ctx.stroke();
    this.stops.forEach(s=>{const sx=this._laneX(s.lane);ctx.fillStyle='#fde68a';ctx.shadowColor='#f59e0b';ctx.shadowBlur=10;ctx.beginPath();ctx.roundRect(sx-24,s.y-16,48,32,4);ctx.fill();ctx.fillStyle='#92400e';ctx.font='11px sans-serif';ctx.textAlign='center';ctx.fillText(`🧑x${s.count}`,sx,s.y+5);ctx.textAlign='left';ctx.shadowBlur=0;});
    this.dropZones.forEach(d=>{const dx=this._laneX(d.lane);ctx.fillStyle='rgba(34,197,94,0.3)';ctx.strokeStyle='#22c55e';ctx.lineWidth=2;ctx.shadowColor='#22c55e';ctx.shadowBlur=10;ctx.beginPath();ctx.roundRect(dx-28,d.y-20,56,40,6);ctx.fill();ctx.stroke();ctx.fillStyle='#86efac';ctx.font='bold 12px sans-serif';ctx.textAlign='center';ctx.fillText('DROP 🏁',dx,d.y+5);ctx.textAlign='left';ctx.shadowBlur=0;});
    this.traffic.forEach(t=>{const tx=this._laneX(t.lane);ctx.shadowColor='#6b7280';ctx.shadowBlur=6;ctx.fillStyle='#374151';ctx.beginPath();ctx.roundRect(tx-17,t.y-30,34,60,5);ctx.fill();ctx.fillStyle='#6b7280';ctx.fillRect(tx-13,t.y-20,26,16);ctx.shadowBlur=0;});
    const bx=this._laneX(this.busLane);
    ctx.shadowColor='#f59e0b';ctx.shadowBlur=18;ctx.fillStyle='#d97706';
    ctx.beginPath();ctx.roundRect(bx-22,this.busY-48,44,96,5);ctx.fill();
    ctx.fillStyle='#fbbf24';for(let i=0;i<3;i++)ctx.fillRect(bx-18,this.busY-40+i*26,36,18);
    ctx.fillStyle='rgba(0,200,255,0.2)';for(let i=0;i<3;i++)ctx.fillRect(bx-14,this.busY-38+i*26,28,14);
    ctx.shadowBlur=0;
    ctx.fillStyle='#fff';ctx.font='bold 15px monospace';ctx.fillText(`Score: ${this.score}`,10,24);ctx.fillText(`Delivered: ${this.delivered}`,10,44);
    ctx.fillStyle=this.passengers>=this.capacity?'#ef4444':'#22c55e';ctx.fillText(`🧑 ${this.passengers}/${this.capacity}`,W-110,24);
    ctx.fillStyle='rgba(255,255,255,0.35)';ctx.font='13px sans-serif';ctx.textAlign='center';ctx.fillText('Switch lanes to pick up 🧑 riders · reach 🏁 drop-offs',W/2,H-8);ctx.textAlign='left';
    if(this.msgTimer>0){ctx.globalAlpha=Math.min(1,this.msgTimer/20);ctx.fillStyle='#fde68a';ctx.font='bold 17px sans-serif';ctx.textAlign='center';ctx.fillText(this.msg,W/2,H/2-20);ctx.textAlign='left';ctx.globalAlpha=1;}
    if(this.over){ctx.fillStyle='rgba(0,0,0,0.7)';ctx.fillRect(0,0,W,H);ctx.textAlign='center';ctx.shadowColor='#ef4444';ctx.shadowBlur=20;ctx.fillStyle='#fca5a5';ctx.font='bold 36px sans-serif';ctx.fillText('CRASHED! 🚌',W/2,H/2-22);ctx.shadowBlur=0;ctx.fillStyle='#fff';ctx.font='22px sans-serif';ctx.fillText(`Score: ${this.score}  |  Delivered: ${this.delivered}`,W/2,H/2+14);ctx.fillStyle='#a78bfa';ctx.font='15px sans-serif';ctx.fillText('Tap to drive again',W/2,H/2+50);ctx.textAlign='left';}
  }
  _loop(){this._update();this._draw();this.raf=requestAnimationFrame(()=>this._loop());}
}
