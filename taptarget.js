/* ===== TAP HUNT ===== */
class TapTarget {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this._listeners = [];
    this._resize();
    this.screen = 'idle';
    this.score = 0;
    this.timeLeft = 60;
    this.targets = [];
    this._pops = [];
    this._elapsed = 0;
    this._spawnTimer = 0;
    this._lastT = null;
    this.raf = null;
    this._superFlash = 0;
    this._combo = 0;
    this._comboTimer = 0;
    this._missed = 0;
  }

  start() {
    this._resizeBound = () => this._resize();
    window.addEventListener('resize', this._resizeBound);
    this._bind();
    this._loop();
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this._resizeBound);
    this._listeners.forEach(([el, ev, fn, opts]) => el.removeEventListener(ev, fn, opts));
    this._listeners = [];
  }

  _resize() {
    this.W = this.canvas.width  = this.canvas.offsetWidth  || 480;
    this.H = this.canvas.height = this.canvas.offsetHeight || 640;
  }

  _addEv(el, ev, fn, opts) {
    el.addEventListener(ev, fn, opts);
    this._listeners.push([el, ev, fn, opts]);
  }

  _bind() {
    this._touchFired = false;
    this._addEv(this.canvas, 'touchstart', e => {
      e.preventDefault();
      this._touchFired = true;
      setTimeout(() => { this._touchFired = false; }, 400);
      const rect = this.canvas.getBoundingClientRect();
      const sx = this.W / rect.width, sy = this.H / rect.height;
      for (const t of e.changedTouches) {
        this._onTap((t.clientX - rect.left) * sx, (t.clientY - rect.top) * sy);
      }
    }, { passive: false });
    this._addEv(this.canvas, 'click', e => {
      if (this._touchFired) return;
      const rect = this.canvas.getBoundingClientRect();
      const sx = this.W / rect.width, sy = this.H / rect.height;
      this._onTap((e.clientX - rect.left) * sx, (e.clientY - rect.top) * sy);
    });
  }

  _onTap(x, y) {
    if (this.screen === 'idle') { this._startGame(); return; }
    if (this.screen === 'end')  { this.screen = 'idle'; return; }

    let hit = false;
    // check from top (last-spawned) to bottom
    for (let i = this.targets.length - 1; i >= 0; i--) {
      const t = this.targets[i];
      const dx = x - t.x, dy = y - t.y;
      if (dx * dx + dy * dy <= t.r * t.r) {
        this.targets.splice(i, 1);
        this.score++;
        this._combo++;
        this._comboTimer = 1.2;
        this._pops.push({ x: t.x, y: t.y, r: t.r, life: 0.35, combo: this._combo });
        hit = true;
        break;
      }
    }
    if (!hit && this.screen === 'playing') {
      this._combo = 0;
      this._comboTimer = 0;
      // Small miss flash
      this._pops.push({ x, y, r: 18, life: 0.2, miss: true });
    }
  }

  _startGame() {
    this.screen = 'playing';
    this.score = 0;
    this._missed = 0;
    this._combo = 0;
    this._comboTimer = 0;
    this.timeLeft = 60;
    this.targets = [];
    this._pops = [];
    this._elapsed = 0;
    this._spawnTimer = 0;
    this._lastT = null;
  }

  _loop(ts) {
    this.raf = requestAnimationFrame(t => this._loop(t));
    const dt = Math.min(((ts || 0) - (this._lastT || ts || 0)) / 1000, 0.1);
    this._lastT = ts || 0;
    if (this.screen === 'playing') this._update(dt);
    this._draw();
  }

  _spawnInterval() {
    // 1600ms → 220ms over 60 seconds
    return Math.max(220, 1600 - (1380 * this._elapsed / 60));
  }

  _targetLife() {
    // 2.2s → 0.75s over 60 seconds
    return Math.max(0.75, 2.2 - 1.45 * (this._elapsed / 60));
  }

  _targetRadius() {
    // 44px → 22px over 60 seconds
    return Math.max(22, 44 - 22 * (this._elapsed / 60));
  }

  _update(dt) {
    this._elapsed += dt;
    this.timeLeft = Math.max(0, this.timeLeft - dt);
    if (this._comboTimer > 0) this._comboTimer -= dt;
    else this._combo = 0;

    if (this.timeLeft <= 0) { this.screen = 'end'; return; }

    this._spawnTimer += dt * 1000;
    if (this._spawnTimer >= this._spawnInterval()) {
      this._spawnTimer = 0;
      this._spawnTarget();
    }

    const tLife = this._targetLife();
    for (let i = this.targets.length - 1; i >= 0; i--) {
      this.targets[i].age += dt;
      if (this.targets[i].age >= tLife) {
        this.targets.splice(i, 1);
        this._missed++;
        this._combo = 0;
        this._comboTimer = 0;
      }
    }

    for (let i = this._pops.length - 1; i >= 0; i--) {
      this._pops[i].life -= dt;
      if (this._pops[i].life <= 0) this._pops.splice(i, 1);
    }
  }

  _spawnTarget() {
    const r = this._targetRadius();
    const margin = r + 8;
    const x = margin + Math.random() * (this.W - margin * 2);
    // avoid top HUD area
    const hudH = this.H * 0.14;
    const y = hudH + margin + Math.random() * (this.H - hudH - margin * 2);
    this.targets.push({ x, y, r, age: 0 });
  }

  /* ---- DRAW ---- */
  _draw() {
    const { ctx: c, W, H } = this;
    // Background
    const bg = c.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#0a0a1a');
    bg.addColorStop(1, '#150a2e');
    c.fillStyle = bg;
    c.fillRect(0, 0, W, H);

    if (this.screen === 'idle')    this._drawIdle();
    else if (this.screen === 'playing') this._drawGame();
    else if (this.screen === 'end')     this._drawEnd();
  }

  _drawTarget(x, y, r, agePct) {
    const c = this.ctx;
    const alpha = Math.max(0, 1 - agePct * 0.4);

    // Countdown arc (shrinks clockwise)
    c.beginPath();
    c.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + (1 - agePct) * Math.PI * 2);
    c.strokeStyle = `rgba(255,255,255,${alpha * 0.55})`;
    c.lineWidth = 2.5;
    c.stroke();

    // Outer ring
    c.beginPath();
    c.arc(x, y, r, 0, Math.PI * 2);
    c.strokeStyle = `rgba(255, 55, 55, ${alpha})`;
    c.lineWidth = 3;
    c.stroke();

    // Middle ring
    c.beginPath();
    c.arc(x, y, r * 0.62, 0, Math.PI * 2);
    c.strokeStyle = `rgba(255, 160, 40, ${alpha * 0.85})`;
    c.lineWidth = 2;
    c.stroke();

    // Bullseye
    const grad = c.createRadialGradient(x, y, 0, x, y, r * 0.28);
    grad.addColorStop(0, `rgba(255,80,80,${alpha})`);
    grad.addColorStop(1, `rgba(200,30,30,${alpha})`);
    c.beginPath();
    c.arc(x, y, r * 0.28, 0, Math.PI * 2);
    c.fillStyle = grad;
    c.fill();
  }

  _drawIdle() {
    const { ctx: c, W, H } = this;
    // Decorative background targets
    const deco = [
      { x: W * 0.12, y: H * 0.18, r: 38 },
      { x: W * 0.88, y: H * 0.13, r: 28 },
      { x: W * 0.08, y: H * 0.72, r: 32 },
      { x: W * 0.92, y: H * 0.68, r: 42 },
      { x: W * 0.5,  y: H * 0.87, r: 24 },
      { x: W * 0.3,  y: H * 0.55, r: 20 },
      { x: W * 0.75, y: H * 0.42, r: 26 },
    ];
    const pulse = (Date.now() % 2000) / 2000;
    for (const d of deco) this._drawTarget(d.x, d.y, d.r, pulse);

    // Title
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.font = `bold ${Math.floor(W * 0.115)}px sans-serif`;
    c.fillStyle = '#fff';
    c.shadowColor = '#a855f7';
    c.shadowBlur = 20;
    c.fillText('TAP HUNT', W / 2, H * 0.31);
    c.shadowBlur = 0;

    c.font = `${Math.floor(W * 0.046)}px sans-serif`;
    c.fillStyle = '#c4b5fd';
    c.fillText('Tap targets before they vanish!', W / 2, H * 0.405);
    c.fillStyle = '#9ca3af';
    c.font = `${Math.floor(W * 0.04)}px sans-serif`;
    c.fillText('60 seconds — go as fast as you can', W / 2, H * 0.46);

    // Start button
    const bw = W * 0.55, bh = H * 0.085;
    const bx = W / 2 - bw / 2, by = H * 0.58;
    const bg = c.createLinearGradient(bx, by, bx + bw, by + bh);
    bg.addColorStop(0, '#7c3aed');
    bg.addColorStop(1, '#a855f7');
    c.fillStyle = bg;
    c.beginPath();
    c.roundRect(bx, by, bw, bh, 14);
    c.fill();
    c.fillStyle = '#fff';
    c.font = `bold ${Math.floor(W * 0.058)}px sans-serif`;
    c.fillText('TAP TO START', W / 2, by + bh / 2);
  }

  _drawGame() {
    const { ctx: c, W, H } = this;
    const tLife = this._targetLife();

    // Targets
    for (const t of this.targets) {
      this._drawTarget(t.x, t.y, t.r, t.age / tLife);
    }

    // Pop / miss effects
    for (const p of this._pops) {
      const frac = 1 - p.life / (p.miss ? 0.2 : 0.35);
      const alpha = 1 - frac;
      if (p.miss) {
        c.beginPath();
        c.arc(p.x, p.y, p.r * (1 + frac), 0, Math.PI * 2);
        c.strokeStyle = `rgba(255,80,80,${alpha * 0.6})`;
        c.lineWidth = 2;
        c.stroke();
      } else {
        // Hit burst
        const r = p.r * (1 + frac * 1.2);
        c.beginPath();
        c.arc(p.x, p.y, r, 0, Math.PI * 2);
        c.strokeStyle = `rgba(255,220,50,${alpha})`;
        c.lineWidth = 3;
        c.stroke();
        // Combo label
        if (p.combo >= 3) {
          c.fillStyle = `rgba(255,220,50,${alpha})`;
          c.font = `bold ${Math.floor(W * 0.05)}px sans-serif`;
          c.textAlign = 'center';
          c.textBaseline = 'middle';
          c.fillText(`x${p.combo}!`, p.x, p.y - p.r - 12 * (1 - frac * 0.5));
        }
      }
    }

    // ---- HUD ----
    // Timer bar background
    const barX = W * 0.04, barY = H * 0.035, barW = W * 0.92, barH = 10;
    c.fillStyle = 'rgba(255,255,255,0.12)';
    c.beginPath();
    c.roundRect(barX, barY, barW, barH, 5);
    c.fill();

    const ratio = this.timeLeft / 60;
    const barColor = ratio > 0.5 ? '#22c55e' : ratio > 0.25 ? '#f59e0b' : '#ef4444';
    c.fillStyle = barColor;
    c.beginPath();
    c.roundRect(barX, barY, barW * ratio, barH, 5);
    c.fill();

    // Score
    c.textAlign = 'left';
    c.textBaseline = 'top';
    c.font = `bold ${Math.floor(W * 0.1)}px sans-serif`;
    c.fillStyle = '#fff';
    c.fillText(`${this.score}`, W * 0.04, H * 0.055);

    // Timer
    c.textAlign = 'right';
    c.font = `bold ${Math.floor(W * 0.055)}px sans-serif`;
    c.fillStyle = barColor;
    c.fillText(`${Math.ceil(this.timeLeft)}s`, W * 0.96, H * 0.058);

    // Speed label
    const speed = Math.min(8, 1 + Math.floor((this._elapsed / 60) * 8));
    c.textAlign = 'center';
    c.font = `${Math.floor(W * 0.036)}px sans-serif`;
    c.fillStyle = '#a78bfa';
    c.fillText(`Speed ×${speed}`, W / 2, H * 0.063);

    // Combo streak
    if (this._combo >= 3 && this._comboTimer > 0) {
      c.textAlign = 'center';
      c.font = `bold ${Math.floor(W * 0.048)}px sans-serif`;
      c.fillStyle = '#fbbf24';
      c.shadowColor = '#fbbf24';
      c.shadowBlur = 10;
      c.fillText(`${this._combo} COMBO!`, W / 2, H * 0.115);
      c.shadowBlur = 0;
    }
  }

  _drawEnd() {
    const { ctx: c, W, H } = this;

    // Dim overlay
    c.fillStyle = 'rgba(0,0,0,0.72)';
    c.fillRect(0, 0, W, H);

    c.textAlign = 'center';
    c.textBaseline = 'middle';

    // Heading
    c.font = `bold ${Math.floor(W * 0.1)}px sans-serif`;
    c.fillStyle = '#fff';
    c.shadowColor = '#a855f7';
    c.shadowBlur = 18;
    c.fillText("TIME'S UP!", W / 2, H * 0.25);
    c.shadowBlur = 0;

    // Score label
    c.font = `${Math.floor(W * 0.05)}px sans-serif`;
    c.fillStyle = '#c4b5fd';
    c.fillText('Targets Hit', W / 2, H * 0.38);

    // Big score
    c.font = `bold ${Math.floor(W * 0.22)}px sans-serif`;
    c.fillStyle = '#fff';
    c.fillText(`${this.score}`, W / 2, H * 0.52);

    // Rating
    let rating, rcolor;
    if      (this.score >= 60) { rating = '🏆 Target Master!';    rcolor = '#fbbf24'; }
    else if (this.score >= 40) { rating = '🎯 Sharp Shooter!';    rcolor = '#34d399'; }
    else if (this.score >= 22) { rating = '👍 Good Reflexes!';    rcolor = '#60a5fa'; }
    else                       { rating = '💪 Keep Practicing!';  rcolor = '#f87171'; }
    c.font = `bold ${Math.floor(W * 0.052)}px sans-serif`;
    c.fillStyle = rcolor;
    c.fillText(rating, W / 2, H * 0.655);

    // Missed label
    c.font = `${Math.floor(W * 0.038)}px sans-serif`;
    c.fillStyle = '#9ca3af';
    c.fillText(`Missed: ${this._missed}`, W / 2, H * 0.715);

    // Play again button
    const bw = W * 0.55, bh = H * 0.085;
    const bx = W / 2 - bw / 2, by = H * 0.77;
    const bg = c.createLinearGradient(bx, by, bx + bw, by + bh);
    bg.addColorStop(0, '#7c3aed');
    bg.addColorStop(1, '#a855f7');
    c.fillStyle = bg;
    c.beginPath();
    c.roundRect(bx, by, bw, bh, 14);
    c.fill();
    c.fillStyle = '#fff';
    c.font = `bold ${Math.floor(W * 0.055)}px sans-serif`;
    c.fillText('PLAY AGAIN', W / 2, by + bh / 2);
  }
}
