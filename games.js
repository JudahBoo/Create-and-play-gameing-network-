/* ===== GAME ENGINE LAUNCHER ===== */
let _currentGame = null;

function launchGame(canvas, gameId, genre) {
  if (_currentGame) { _currentGame.destroy(); _currentGame = null; }
  const type = getGameType(gameId, genre);
  switch (type) {
    case 'runner':  _currentGame = new NeonRunner(canvas);   break;
    case 'shooter': _currentGame = new StarDefender(canvas); break;
    case 'dungeon': _currentGame = new DungeonQuest(canvas); break;
    default:        _currentGame = new NeonRunner(canvas);
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
  const g = (genre || '').toLowerCase();
  if (/run|platform|jump|endless|race/.test(g)) return 'runner';
  if (/shoot|space|gun|laser|bullet|defend/.test(g)) return 'shooter';
  if (/rpg|quest|dungeon|adventure|role|puzzle|solve/.test(g)) return 'dungeon';
  const rand = Math.floor(Math.random() * 3);
  return ['runner', 'shooter', 'dungeon'][rand];
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
