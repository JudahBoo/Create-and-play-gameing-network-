/* ===== GEOMETRY DASH 2.0 — by Judah ===== */
class GeoDash {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx    = canvas.getContext('2d');
    this.W = canvas.width;
    this.H = canvas.height;
    this.raf = null;
    this._handlers = {};
    this.level  = 1;
    this.screen = 'playing';
    this._init();
  }

  start()   { this._bind(); this._loop(); }
  destroy() {
    cancelAnimationFrame(this.raf);
    Object.values(this._handlers).forEach(({ el, ev, fn }) => el.removeEventListener(ev, fn));
  }

  _addEv(el, ev, fn, opts) {
    el.addEventListener(ev, fn, opts);
    this._handlers[el.constructor.name + ev] = { el, ev, fn };
  }

  _bind() {
    // Track whether a touchstart just fired so click doesn't double-fire on mobile
    this._touchJustFired = false;

    this._addEv(window, 'keydown', e => {
      if (e.code === 'Space' || e.key === ' ') { e.preventDefault(); this._onTap(); }
    });
    this._addEv(this.canvas, 'touchstart', e => {
      e.preventDefault();
      this._touchJustFired = true;
      setTimeout(() => { this._touchJustFired = false; }, 500);
      this._onTap();
    }, { passive: false });
    this._addEv(this.canvas, 'click', () => {
      if (this._touchJustFired) return; // already handled by touchstart
      this._onTap();
    });
  }

  _onTap() {
    if (this.screen === 'dead')       { this._init(); return; }
    if (this.screen === 'transition') return;
    if (this.screen === 'win')        return;

    if (this.level === 1 || this.level === 3) {
      const now = Date.now();
      const gap = now - (this._lastTapTime || 0);
      this._lastTapTime = now;

      if (this.player.onGround) {
        // First tap from ground — always a normal jump
        this._jump(1.0);
      } else if (gap < 350 && !this.player._boosted) {
        // Second tap within 350ms while airborne = super boost
        this.player.vy = -this.JUMP_VY * 2.0;
        this.player._boosted = true;   // only one boost per airtime
        this._superFlash = 0.25;       // visual feedback
      }
    } else if (this.level === 2) {
      this.rocketUp = !this.rocketUp;
    }
  }

  _jump(mult) {
    this.player.vy = -this.JUMP_VY * mult;
    this.player.onGround = false;
    this.player._boosted = false;  // reset boost for this jump
  }

  // ─────────────────────────────────────────
  //  INIT
  // ─────────────────────────────────────────
  _init() {
    const BS = Math.max(18, Math.floor(this.W * 0.056));
    this.BS        = BS;
    this.GRAV      = 1350;
    this.JUMP_VY   = 560;
    this.scrollX   = 0;
    this.timer     = 0;
    this.DURATION  = this.level === 3 ? 30 : 15;
    this.SPEED     = this.level === 1 ? 220 : this.level === 2 ? 260 : 190;
    this.screen    = 'playing';
    this.particles = [];
    this.nextLevelReady = false;
    this.lastTime  = Date.now();

    this.groundY = Math.floor(this.H * 0.78);
    this.platY   = Math.floor(this.H * 0.60); // top surface of level-3 platform

    if (this.level === 1) {
      this.player = { y: this.groundY - BS, vy: 0, onGround: true, angle: 0, _boosted: false };
      this.spikes = this._genSpikes1();
    } else if (this.level === 2) {
      this.rocketY  = this.H * 0.5;
      this.rocketVy = 0;
      this.rocketUp = false;
      this.tubeRows = this._genTube();
    } else {
      // level 3 — player drops onto platform from above
      this.player = { y: this.platY - BS * 3, vy: 0, onGround: false, angle: 0, _boosted: false };
      this.onPlatformSince = -1; // timer snapshot when landed
      this.spikes    = this._genSpikes3();
      this.ceilSpikes = this._genCeilSpikes3();
    }
  }

  // ─────────────────────────────────────────
  //  OBSTACLE GENERATION
  // ─────────────────────────────────────────
  _genSpikes1() {
    const { BS, W, SPEED, DURATION } = this;
    const spikes = [];
    // spike at certain seconds into the level (world x = W + t*SPEED)
    const times = [3.0, 5.5, 7.0, 8.5, 10.0, 11.5, 13.0];
    for (const t of times) {
      if (t >= DURATION) continue;
      const wx = W + t * SPEED;
      spikes.push({ wx });
      if (t >= 5.5) spikes.push({ wx: wx + BS * 1.5 }); // double spike on later ones
    }
    return spikes;
  }

  _genTube() {
    const { H, BS, W } = this;
    const rows = [];
    const colW = BS * 1.4;
    let wx = W * 1.6;
    const endWx = W + (this.DURATION + 4) * this.SPEED;
    while (wx < endWx) {
      const gapCentre = H * (0.3 + Math.random() * 0.4);
      const gapHalf   = BS * (1.8 + Math.random() * 1.2);
      rows.push({ wx, w: colW, topY: gapCentre - gapHalf, botY: gapCentre + gapHalf });
      wx += colW + BS * (2.2 + Math.random() * 2);
    }
    return rows;
  }

  _genSpikes3() {
    // 3 spikes every 3 seconds, first at 5s, stop at 27s (leave 3s for portal)
    const { BS, W, SPEED } = this;
    const spikes = [];
    for (let t = 5; t < 27; t += 3) {
      const wx = W + t * SPEED;
      for (let i = 0; i < 3; i++) spikes.push({ wx: wx + i * BS * 1.1, groupT: t });
    }
    return spikes;
  }

  _genCeilSpikes3() {
    // every 5 blocks, but NOT within ±4 blocks of a spike-group
    const { BS, W, SPEED } = this;
    const jumpWxs = [];
    for (let t = 5; t < 27; t += 3) jumpWxs.push(W + t * SPEED);
    const SAFE  = BS * 5;
    const STEP  = BS * 5;
    const cSpikes = [];
    let wx = W * 2.2;
    const endWx = W + 28 * SPEED;
    while (wx < endWx) {
      const near = jumpWxs.some(jx => Math.abs(wx - jx) < SAFE);
      if (!near) cSpikes.push({ wx });
      wx += STEP;
    }
    return cSpikes;
  }

  // ─────────────────────────────────────────
  //  LOOP
  // ─────────────────────────────────────────
  _loop() {
    this.raf = requestAnimationFrame(() => this._loop());
    const now = Date.now();
    const dt  = Math.min((now - this.lastTime) / 1000, 0.05);
    this.lastTime = now;
    this._update(dt);
    this._draw();
  }

  _update(dt) {
    if (this.screen !== 'playing') return;
    this.timer   += dt;
    this.scrollX += this.SPEED * dt;
    if (this.level === 1)      this._updateL1(dt);
    else if (this.level === 2) this._updateL2(dt);
    else                       this._updateL3(dt);
    // particles
    this.particles.forEach(p => {
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vy += 300 * dt; p.age += dt;
    });
    this.particles = this.particles.filter(p => p.age < p.life);
  }

  // ─────────────────────────────────────────
  //  LEVEL 1 UPDATE
  // ─────────────────────────────────────────
  _updateL1(dt) {
    const { BS, groundY, W } = this;
    const p = this.player;
    if (!p.onGround) {
      p.vy += this.GRAV * dt;
      p.y  += p.vy * dt;
      p.angle += 4 * dt;
    }
    if (p.y >= groundY - BS) { p.y = groundY - BS; p.vy = 0; p.onGround = true; p.angle = 0; p._boosted = false; }

    const px = W * 0.22; // player fixed screen x
    for (const s of this.spikes) {
      const sx = s.wx - this.scrollX;
      if (sx > px - BS * 1.1 && sx < px + BS * 1.1 && p.y + BS > groundY - BS + 4) {
        this._die(px, p.y + BS / 2); return;
      }
    }

    if (this.timer >= this.DURATION && !this.nextLevelReady) this._nextLevel();
  }

  // ─────────────────────────────────────────
  //  LEVEL 2 UPDATE
  // ─────────────────────────────────────────
  _updateL2(dt) {
    const { H, W, BS } = this;
    const THRUST = 900, GRAV = 700;
    this.rocketVy += (this.rocketUp ? -THRUST : GRAV) * dt;
    this.rocketVy  = Math.max(-450, Math.min(450, this.rocketVy));
    this.rocketY  += this.rocketVy * dt;
    this.rocketY   = Math.max(BS * 0.8, Math.min(H - BS * 0.8, this.rocketY));

    const rx = W * 0.28;
    for (const row of this.tubeRows) {
      const sx = row.wx - this.scrollX;
      if (sx > rx - BS * 1.2 && sx < rx + BS * 1.2) {
        if (this.rocketY - BS * 0.5 < row.topY || this.rocketY + BS * 0.5 > row.botY) {
          this._die(rx, this.rocketY); return;
        }
      }
    }
    // top / bottom wall
    if (this.rocketY < BS * 0.4 || this.rocketY > H - BS * 0.4) { this._die(rx, this.rocketY); return; }

    if (this.timer >= this.DURATION && !this.nextLevelReady) this._nextLevel();
  }

  // ─────────────────────────────────────────
  //  LEVEL 3 UPDATE
  // ─────────────────────────────────────────
  _updateL3(dt) {
    const { BS, platY, W, H } = this;
    const p = this.player;

    p.vy += this.GRAV * dt;
    p.y  += p.vy * dt;

    const landY = platY - BS; // top surface of platform

    // Landing on platform
    if (!p.onGround && p.vy >= 0 && p.y >= landY) {
      p.y = landY; p.vy = 0; p.onGround = true; p._boosted = false;
      if (this.onPlatformSince < 0) this.onPlatformSince = this.timer;
    }
    // Fell off bottom
    if (p.y > H + BS) { this._die(W * 0.22, H * 0.5); return; }

    if (!p.onGround) p.angle += 3 * dt;
    else p.angle = 0;

    const px = W * 0.22;

    // Ground spikes
    for (const s of this.spikes) {
      const sx = s.wx - this.scrollX;
      if (sx > px - BS && sx < px + BS) {
        if (p.y + BS > platY - BS + 4 && p.y < platY) {
          this._die(px, p.y + BS * 0.5); return;
        }
      }
    }
    // Ceiling spikes (tip is at BS*0.5, pointing down by BS)
    for (const cs of this.ceilSpikes) {
      const sx = cs.wx - this.scrollX;
      if (sx > px - BS && sx < px + BS) {
        if (p.y < BS * 1.6) { this._die(px, p.y); return; }
      }
    }

    if (this.timer >= this.DURATION && !this.nextLevelReady) {
      this.nextLevelReady = true;
      this.screen = 'win';
    }
  }

  // ─────────────────────────────────────────
  //  DEATH / NEXT LEVEL
  // ─────────────────────────────────────────
  _die(px, py) {
    if (this.screen !== 'playing') return;
    this.screen = 'dead';
    for (let i = 0; i < 18; i++) {
      const a = Math.random() * Math.PI * 2, sp = 80 + Math.random() * 180;
      this.particles.push({
        x: px, y: py, vx: Math.cos(a)*sp, vy: Math.sin(a)*sp,
        age: 0, life: 0.9,
        color: ['#f59e0b','#e74c3c','#fff','#a78bfa'][Math.floor(Math.random()*4)]
      });
    }
  }

  _nextLevel() {
    this.nextLevelReady = true;
    this.level++;
    if (this.level > 3) { this.screen = 'win'; return; }
    this.screen = 'transition';
    setTimeout(() => { this._init(); }, 900);
  }

  // ─────────────────────────────────────────
  //  DRAW
  // ─────────────────────────────────────────
  _draw() {
    if      (this.level === 1) this._drawL1();
    else if (this.level === 2) this._drawL2();
    else                       this._drawL3();
    this._drawParticles();
    if (this.screen === 'dead')       this._drawDead();
    if (this.screen === 'win')        this._drawWin();
    if (this.screen === 'transition') this._drawTransition();
  }

  // ─────────────────────────────────────────
  //  LEVEL 1 DRAW
  // ─────────────────────────────────────────
  _drawL1() {
    const { ctx:c, W, H, BS, groundY } = this;
    const bg = c.createLinearGradient(0,0,0,H);
    bg.addColorStop(0,'#1a0533'); bg.addColorStop(1,'#0a0a1a');
    c.fillStyle=bg; c.fillRect(0,0,W,H);

    // scrolling grid
    c.strokeStyle='rgba(124,58,237,0.12)'; c.lineWidth=1;
    const off = this.scrollX % 60;
    for(let x=-off;x<W;x+=60){c.beginPath();c.moveTo(x,0);c.lineTo(x,H);c.stroke();}
    for(let y=0;y<H;y+=60){c.beginPath();c.moveTo(0,y);c.lineTo(W,y);c.stroke();}

    // ground
    c.fillStyle='#5b21b6'; c.fillRect(0,groundY,W,H-groundY);
    c.fillStyle='#7c3aed'; c.fillRect(0,groundY,W,4);
    // ground tile lines
    c.strokeStyle='rgba(167,139,250,0.3)'; c.lineWidth=1;
    const tOff = this.scrollX % (BS*2);
    for(let x=-tOff;x<W;x+=BS*2){c.beginPath();c.moveTo(x,groundY);c.lineTo(x,H);c.stroke();}

    // spikes
    for (const s of this.spikes) {
      const sx = s.wx - this.scrollX;
      if (sx < -BS || sx > W+BS) continue;
      this._spike(sx + BS*0.5, groundY, BS, '#e74c3c', false);
    }

    // portal (2s before end)
    const appear = this.DURATION - 2;
    if (this.timer >= appear) {
      const portalScreenX = W * 0.22 + (this.timer - appear) * this.SPEED + W * 0.35;
      if (portalScreenX < W * 1.1) this._portal(Math.min(portalScreenX, W*0.82), groundY - BS*3);
    }

    // player
    this._block(W*0.22, this.player.y, BS, this.player.angle, '#f59e0b');

    // hud
    this._hud('Level 1', 'Tap / Space to jump  •  Double-tap for double jump');
  }

  // ─────────────────────────────────────────
  //  LEVEL 2 DRAW
  // ─────────────────────────────────────────
  _drawL2() {
    const { ctx:c, W, H, BS } = this;
    const bg = c.createLinearGradient(0,0,0,H);
    bg.addColorStop(0,'#001408'); bg.addColorStop(1,'#002010');
    c.fillStyle=bg; c.fillRect(0,0,W,H);

    // tube walls
    c.fillStyle='#14532d'; c.fillRect(0,0,W,BS*0.6); c.fillRect(0,H-BS*0.6,W,BS*0.6);
    c.fillStyle='#16a34a'; c.fillRect(0,BS*0.6-3,W,3); c.fillRect(0,H-BS*0.6,W,3);

    // tube obstacles
    for (const row of this.tubeRows) {
      const sx = row.wx - this.scrollX;
      if (sx < -row.w || sx > W+row.w) continue;
      // top block + spike tip
      c.fillStyle='#14532d';
      c.fillRect(sx, 0, row.w, row.topY);
      this._spike(sx + row.w*0.5, row.topY, BS, '#22c55e', true);  // pointing down
      // bottom block + spike tip
      c.fillRect(sx, row.botY, row.w, H-row.botY);
      this._spike(sx + row.w*0.5, row.botY, BS, '#22c55e', false); // pointing up
    }

    // portal
    const appear = this.DURATION - 2;
    if (this.timer >= appear) {
      this._portal(W * 0.82, H * 0.45);
    }

    // rocket
    this._rocket(W*0.28, this.rocketY);

    this._hud('Level 2', 'Tap to toggle thrust UP / DOWN');
  }

  // ─────────────────────────────────────────
  //  LEVEL 3 DRAW
  // ─────────────────────────────────────────
  _drawL3() {
    const { ctx:c, W, H, BS, platY } = this;
    const bg = c.createLinearGradient(0,0,0,H);
    bg.addColorStop(0,'#0a001a'); bg.addColorStop(1,'#1a0533');
    c.fillStyle=bg; c.fillRect(0,0,W,H);

    // scrolling grid
    c.strokeStyle='rgba(124,58,237,0.1)'; c.lineWidth=1;
    const off = this.scrollX % 50;
    for(let x=-off;x<W;x+=50){c.beginPath();c.moveTo(x,0);c.lineTo(x,H);c.stroke();}
    for(let y=0;y<H;y+=50){c.beginPath();c.moveTo(0,y);c.lineTo(W,y);c.stroke();}

    // ceiling bar
    c.fillStyle='#4c1d95'; c.fillRect(0,0,W,BS*0.55);
    c.fillStyle='#7c3aed'; c.fillRect(0,BS*0.55-3,W,3);

    // platform
    c.fillStyle='#3730a3'; c.fillRect(0,platY,W,H-platY);
    c.fillStyle='#4f46e5'; c.fillRect(0,platY,W,4);
    // tile lines
    c.strokeStyle='rgba(167,139,250,0.25)'; c.lineWidth=1;
    const tOff = this.scrollX % (BS*2);
    for(let x=-tOff;x<W;x+=BS*2){c.beginPath();c.moveTo(x,platY);c.lineTo(x,H);c.stroke();}

    // ground spikes (on platform surface)
    for (const s of this.spikes) {
      const sx = s.wx - this.scrollX;
      if (sx < -BS || sx > W+BS) continue;
      this._spike(sx + BS*0.5, platY, BS, '#e74c3c', false);
    }

    // ceiling spikes (pointing down from ceiling)
    for (const cs of this.ceilSpikes) {
      const sx = cs.wx - this.scrollX;
      if (sx < -BS || sx > W+BS) continue;
      this._spike(sx + BS*0.5, BS*0.55, BS, '#e74c3c', true);
    }

    // portal (last 3 seconds)
    if (this.timer >= this.DURATION - 3 && !this.nextLevelReady) {
      this._portal(W * 0.82, platY - BS * 3.5);
    }

    // player
    this._block(W*0.22, this.player.y, BS, this.player.angle, '#f59e0b');

    this._hud('Level 3  — FINAL', 'Tap / Space to jump  •  Double-tap = double jump!');
  }

  // ─────────────────────────────────────────
  //  DRAWING HELPERS
  // ─────────────────────────────────────────
  _block(x, y, BS, angle, color) {
    const c = this.ctx;
    // Super-boost flash glow
    if (this._superFlash > 0) {
      this._superFlash -= 1/60;
      const grd = c.createRadialGradient(x+BS/2, y+BS/2, 0, x+BS/2, y+BS/2, BS*2);
      grd.addColorStop(0, `rgba(255,255,100,${this._superFlash * 3})`);
      grd.addColorStop(1, 'rgba(255,200,0,0)');
      c.fillStyle = grd; c.fillRect(x-BS, y-BS, BS*3, BS*3);
    }
    const blockColor = (this._superFlash > 0) ? '#fff' : color;
    c.save(); c.translate(x + BS/2, y + BS/2); c.rotate(angle);
    c.fillStyle=blockColor; c.fillRect(-BS/2,-BS/2,BS,BS);
    c.fillStyle='rgba(0,0,0,0.25)'; c.fillRect(-BS/2+3,-BS/2+3,BS-6,BS-6);
    c.strokeStyle='rgba(255,255,255,0.8)'; c.lineWidth=1.5; c.strokeRect(-BS/2,-BS/2,BS,BS);
    c.strokeStyle='rgba(255,255,255,0.35)'; c.lineWidth=1;
    c.beginPath(); c.moveTo(0,-BS/2); c.lineTo(0,BS/2); c.moveTo(-BS/2,0); c.lineTo(BS/2,0); c.stroke();
    c.restore();
  }

  _spike(cx, baseY, BS, color, pointDown) {
    const c = this.ctx;
    c.fillStyle=color; c.beginPath();
    if (!pointDown) {
      c.moveTo(cx-BS*0.5, baseY); c.lineTo(cx, baseY-BS); c.lineTo(cx+BS*0.5, baseY);
    } else {
      c.moveTo(cx-BS*0.5, baseY); c.lineTo(cx, baseY+BS); c.lineTo(cx+BS*0.5, baseY);
    }
    c.closePath(); c.fill();
    // highlight
    c.fillStyle='rgba(255,255,255,0.15)'; c.beginPath();
    if (!pointDown) {
      c.moveTo(cx-BS*0.5, baseY); c.lineTo(cx, baseY-BS); c.lineTo(cx-BS*0.1, baseY);
    } else {
      c.moveTo(cx-BS*0.5, baseY); c.lineTo(cx, baseY+BS); c.lineTo(cx-BS*0.1, baseY);
    }
    c.closePath(); c.fill();
  }

  _portal(x, y) {
    const { ctx:c, BS } = this;
    const t = Date.now() * 0.004;
    const r = BS * 1.6 + Math.sin(t) * BS * 0.15;
    c.save(); c.translate(x, y + BS * 1.5);
    // outer glow
    const grd = c.createRadialGradient(0,0,0,0,0,r);
    grd.addColorStop(0,'rgba(167,139,250,0.6)'); grd.addColorStop(1,'rgba(124,58,237,0)');
    c.fillStyle=grd; c.beginPath(); c.arc(0,0,r,0,Math.PI*2); c.fill();
    // ring
    c.strokeStyle='#a78bfa'; c.lineWidth=3; c.beginPath(); c.arc(0,0,r,0,Math.PI*2); c.stroke();
    // spinning inner
    c.rotate(t * 2);
    for(let i=0;i<4;i++){
      c.rotate(Math.PI/2);
      c.fillStyle='rgba(245,158,11,0.8)';
      c.fillRect(r*0.3,-3,r*0.35,6);
    }
    c.restore();
    // label
    c.textAlign='center'; c.fillStyle='#fff'; c.font=`bold ${BS*0.6}px sans-serif`;
    c.fillText(this.level<3 ? 'NEXT ►' : 'WIN!', x, y + BS * 1.5 + BS*0.22);
  }

  _rocket(x, y) {
    const { ctx:c, BS } = this;
    const t = Date.now() * 0.015;
    c.save(); c.translate(x, y);
    // flame trail
    const fl = BS*(0.6+0.2*Math.sin(t));
    const flGrd = c.createLinearGradient(-BS*0.5,0,-BS*0.5-fl,0);
    flGrd.addColorStop(0,'rgba(245,158,11,0.9)'); flGrd.addColorStop(1,'rgba(239,68,68,0)');
    c.fillStyle=flGrd;
    c.beginPath(); c.moveTo(-BS*0.5,-BS*0.25); c.lineTo(-BS*0.5-fl,0); c.lineTo(-BS*0.5,BS*0.25); c.closePath(); c.fill();
    // body
    c.fillStyle='#ef4444';
    c.beginPath(); c.moveTo(BS*0.8,0); c.lineTo(-BS*0.5,-BS*0.38); c.lineTo(-BS*0.5,BS*0.38); c.closePath(); c.fill();
    // fin
    c.fillStyle='#991b1b';
    c.beginPath(); c.moveTo(-BS*0.5,BS*0.38); c.lineTo(-BS*0.8,BS*0.6); c.lineTo(-BS*0.2,BS*0.38); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(-BS*0.5,-BS*0.38); c.lineTo(-BS*0.8,-BS*0.6); c.lineTo(-BS*0.2,-BS*0.38); c.closePath(); c.fill();
    // window
    c.fillStyle='rgba(255,255,255,0.7)'; c.beginPath(); c.arc(BS*0.15,0,BS*0.18,0,Math.PI*2); c.fill();
    c.restore();
  }

  _drawParticles() {
    const c = this.ctx;
    this.particles.forEach(p => {
      c.globalAlpha = Math.max(0, 1 - p.age/p.life);
      c.fillStyle=p.color; c.beginPath(); c.arc(p.x,p.y,5*(1-p.age/p.life)+1,0,Math.PI*2); c.fill();
    });
    c.globalAlpha=1;
  }

  _hud(levelLabel, hint) {
    const { ctx:c, W, H, DURATION, timer } = this;
    const remaining = Math.max(0, DURATION - timer);
    c.textAlign='left'; c.fillStyle='rgba(0,0,0,0.45)';
    c.fillRect(8, 8, 200, 32);
    c.fillStyle='#fff'; c.font=`bold ${H*0.038}px sans-serif`;
    c.fillText(levelLabel, 14, 31);
    // timer bar
    c.fillStyle='rgba(0,0,0,0.4)'; c.fillRect(8,44,W-16,10);
    const pct = remaining / DURATION;
    const barGrd = c.createLinearGradient(8,0,W-16,0);
    barGrd.addColorStop(0,'#7c3aed'); barGrd.addColorStop(1,'#f59e0b');
    c.fillStyle=barGrd; c.fillRect(8,44,(W-16)*pct,10);
    c.textAlign='right'; c.fillStyle='#f59e0b'; c.font=`${H*0.038}px sans-serif`;
    c.fillText(remaining.toFixed(1)+'s', W-10, 32);
    // hint
    c.textAlign='center'; c.fillStyle='rgba(255,255,255,0.4)'; c.font=`${H*0.026}px sans-serif`;
    c.fillText(hint, W/2, H-8);
  }

  _drawDead() {
    const { ctx:c, W, H } = this;
    c.fillStyle='rgba(0,0,0,0.7)'; c.fillRect(0,0,W,H);
    c.textAlign='center';
    c.fillStyle='#e74c3c'; c.font=`bold ${H*0.1}px sans-serif`;
    c.fillText('DEAD', W/2, H*0.38);
    c.fillStyle='#fff'; c.font=`${H*0.042}px sans-serif`;
    c.fillText('Tap / Space to retry', W/2, H*0.57);
    c.fillStyle='rgba(255,255,255,0.4)'; c.font=`${H*0.028}px sans-serif`;
    c.fillText('Level ' + this.level, W/2, H*0.68);
  }

  _drawWin() {
    const { ctx:c, W, H } = this;
    c.fillStyle='rgba(0,0,0,0.75)'; c.fillRect(0,0,W,H);
    c.textAlign='center';
    // glow
    c.shadowColor='#f59e0b'; c.shadowBlur=40;
    c.fillStyle='#f59e0b'; c.font=`bold ${H*0.1}px sans-serif`;
    c.fillText('YOU BEAT IT!', W/2, H*0.3);
    c.shadowBlur=0;
    c.fillStyle='#a78bfa'; c.font=`bold ${H*0.055}px sans-serif`;
    c.fillText('🏆 All 3 Levels Complete!', W/2, H*0.47);
    c.fillStyle='rgba(255,255,255,0.75)'; c.font=`${H*0.038}px sans-serif`;
    c.fillText('Geometry Dash 2.0', W/2, H*0.62);
    c.fillStyle='rgba(245,158,11,0.8)'; c.font=`bold ${H*0.034}px sans-serif`;
    c.fillText('by Judah', W/2, H*0.72);
  }

  _drawTransition() {
    const { ctx:c, W, H } = this;
    const grd = c.createLinearGradient(0,0,0,H);
    grd.addColorStop(0,'#4c1d95'); grd.addColorStop(1,'#7c3aed');
    c.fillStyle=grd; c.fillRect(0,0,W,H);
    c.textAlign='center'; c.fillStyle='#fff';
    c.font=`bold ${H*0.09}px sans-serif`;
    c.fillText(`LEVEL ${this.level}`, W/2, H*0.42);
    c.font=`${H*0.04}px sans-serif`; c.fillStyle='rgba(255,255,255,0.7)';
    c.fillText(this.level === 2 ? 'Rocket Mode!' : 'Final Challenge!', W/2, H*0.58);
  }
}
