/* ===== RIVALS — Roblox-inspired Battle Game ===== */

const GUNS = {
  pistol:  { name: 'Pistol',   cost: 0,    dmg: 25,  rpm: 150, ammo: 8,  reload: 1.2, pellets: 1, splash: 0, color: '#aaa',    emoji: '🔫' },
  shotgun: { name: 'Shotgun',  cost: 200,  dmg: 18,  rpm: 75,  ammo: 6,  reload: 2.0, pellets: 6, splash: 0, color: '#c84',    emoji: '💥' },
  smg:     { name: 'SMG',      cost: 350,  dmg: 12,  rpm: 600, ammo: 30, reload: 1.8, pellets: 1, splash: 0, color: '#4af',    emoji: '⚡' },
  rifle:   { name: 'Rifle',    cost: 500,  dmg: 40,  rpm: 90,  ammo: 20, reload: 2.5, pellets: 1, splash: 0, color: '#4c8',    emoji: '🎯' },
  sniper:  { name: 'Sniper',   cost: 750,  dmg: 95,  rpm: 30,  ammo: 5,  reload: 3.0, pellets: 1, splash: 0, color: '#a4f',    emoji: '🔭' },
  rocket:  { name: 'Rocket',   cost: 1000, dmg: 120, rpm: 20,  ammo: 3,  reload: 3.5, pellets: 1, splash: 80,color: '#f44',    emoji: '🚀' },
};

const MAPS_DEF = {
  arena: {
    name: 'Arena',
    bg: '#1a1a2e',
    floor: '#16213e',
    obstacles: [
      [0.1,0.1,0.12,0.12],[0.78,0.1,0.12,0.12],[0.1,0.78,0.12,0.12],[0.78,0.78,0.12,0.12],
      [0.42,0.42,0.16,0.16],[0.25,0.45,0.08,0.1],[0.67,0.45,0.08,0.1],
      [0.45,0.22,0.1,0.07],[0.45,0.71,0.1,0.07],
    ]
  },
  warehouse: {
    name: 'Warehouse',
    bg: '#1c1408',
    floor: '#2a1f0e',
    obstacles: [
      [0.05,0.05,0.15,0.25],[0.05,0.7,0.15,0.25],[0.8,0.05,0.15,0.25],[0.8,0.7,0.15,0.25],
      [0.3,0.05,0.1,0.08],[0.6,0.87,0.1,0.08],[0.38,0.4,0.24,0.2],
      [0.15,0.45,0.08,0.1],[0.77,0.45,0.08,0.1],
    ]
  },
  rooftop: {
    name: 'Rooftop',
    bg: '#0a0a1a',
    floor: '#111133',
    obstacles: [
      [0.43,0.43,0.14,0.14],
      [0.05,0.43,0.06,0.14],[0.89,0.43,0.06,0.14],
      [0.43,0.05,0.14,0.06],[0.43,0.89,0.14,0.06],
      [0.2,0.2,0.08,0.08],[0.72,0.2,0.08,0.08],[0.2,0.72,0.08,0.08],[0.72,0.72,0.08,0.08],
    ]
  }
};

const BOT_DEFS = {
  easy:   { label: 'Easy Bot',    speed: 1.5, accuracy: 0.35, reaction: 900 },
  medium: { label: 'Medium Bot',  speed: 2.2, accuracy: 0.60, reaction: 500 },
  hard:   { label: 'Hard Bot',    speed: 3.0, accuracy: 0.82, reaction: 200 },
  player2:{ label: 'Player 2',    speed: 2.6, accuracy: 0.70, reaction: 350 },
};

class RivalsGame {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx    = canvas.getContext('2d');
    this.W = canvas.width;
    this.H = canvas.height;
    this.raf  = null;
    this._handlers = {};

    // persistent state
    this.coins   = parseInt(localStorage.getItem('rivals_coins') || '500');
    this.owned   = JSON.parse(localStorage.getItem('rivals_owned') || '["pistol"]');
    this.stats   = JSON.parse(localStorage.getItem('rivals_stats') || '{"wins":0,"losses":0,"kills":0,"deaths":0}');

    // session / duel state
    this.screen = 'hub';     // hub | range | shop | duel_setup | duel | results | stats
    this.duelCfg = { map:'arena', gun:'pistol', opponent:'easy' };

    // range
    this.rangeTargets = [];
    this.rangeScore   = 0;

    // duel entities
    this.player = null;
    this.bot    = null;
    this.bullets = [];
    this.obstacles = [];
    this.particles = [];
    this.killGoal  = 5;
    this.playerKills = 0;
    this.botKills    = 0;
    this.gameOver    = false;

    // input
    this.keys   = {};
    this.mouse  = { x: this.W/2, y: this.H/2, down: false };
    this.touch  = { active: false, id: null, startX:0, startY:0 };
  }

  start() {
    this.screen = 'hub';
    this._bind();
    this._loop();
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    for (const [ev, fn] of Object.entries(this._handlers)) {
      this.canvas.removeEventListener(ev, fn);
      window.removeEventListener(ev, fn);
    }
  }

  _save() {
    localStorage.setItem('rivals_coins', this.coins);
    localStorage.setItem('rivals_owned',  JSON.stringify(this.owned));
    localStorage.setItem('rivals_stats',  JSON.stringify(this.stats));
  }

  /* ---- INPUT BINDING ---- */
  _bind() {
    const add = (el, ev, fn) => { this._handlers[ev+el] = fn; el.addEventListener(ev, fn); };

    add(window, 'keydown', e => { this.keys[e.key.toLowerCase()] = true; });
    add(window, 'keyup',   e => { this.keys[e.key.toLowerCase()] = false; });

    const rect = () => this.canvas.getBoundingClientRect();
    add(this.canvas, 'mousemove', e => {
      const r = rect();
      this.mouse.x = (e.clientX - r.left) * (this.W / r.width);
      this.mouse.y = (e.clientY - r.top)  * (this.H / r.height);
    });
    add(this.canvas, 'mousedown', e => {
      const r = rect();
      this.mouse.x = (e.clientX - r.left) * (this.W / r.width);
      this.mouse.y = (e.clientY - r.top)  * (this.H / r.height);
      this.mouse.down = true;
      this._handleClick(this.mouse.x, this.mouse.y);
    });
    add(this.canvas, 'mouseup', () => { this.mouse.down = false; });

    add(this.canvas, 'touchstart', e => {
      e.preventDefault();
      const t = e.changedTouches[0];
      const r = rect();
      const tx = (t.clientX - r.left) * (this.W / r.width);
      const ty = (t.clientY - r.top)  * (this.H / r.height);
      this.touch.active = true; this.touch.id = t.identifier;
      this.touch.startX = tx;   this.touch.startY = ty;
      this._handleClick(tx, ty);
    }, { passive: false });

    add(this.canvas, 'touchmove', e => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        if (t.identifier === this.touch.id) {
          const r = rect();
          this.touch.dx = (t.clientX - r.left) * (this.W / r.width) - this.touch.startX;
          this.touch.dy = (t.clientY - r.top)  * (this.H / r.height) - this.touch.startY;
        }
      }
    }, { passive: false });

    add(this.canvas, 'touchend', e => {
      for (const t of e.changedTouches) {
        if (t.identifier === this.touch.id) { this.touch.active = false; }
      }
    });
  }

  _handleClick(x, y) {
    if (this.screen === 'hub')        this._hubClick(x, y);
    else if (this.screen === 'range') this._rangeShoot(x, y);
    else if (this.screen === 'shop')  this._shopClick(x, y);
    else if (this.screen === 'duel_setup') this._setupClick(x, y);
    else if (this.screen === 'duel' && !this.gameOver) this._playerShoot();
    else if (this.screen === 'results') this._goHub();
    else if (this.screen === 'stats')   this._goHub();
  }

  /* ---- LOOP ---- */
  _loop() {
    this.raf = requestAnimationFrame(() => this._loop());
    this._update();
    this._draw();
  }

  _update() {
    if (this.screen === 'range') this._updateRange();
    if (this.screen === 'duel' && !this.gameOver) this._updateDuel();
  }

  /* ==============================
     HUB SCREEN
  ============================== */
  _goHub() { this.screen = 'hub'; }

  _hubClick(x, y) {
    const zones = this._hubZones();
    for (const z of zones) {
      if (x >= z.x && x <= z.x+z.w && y >= z.y && y <= z.y+z.h) {
        if (z.action === 'range')      this._startRange();
        else if (z.action === 'shop')  this.screen = 'shop';
        else if (z.action === 'duel')  this.screen = 'duel_setup';
        else if (z.action === 'stats') this.screen = 'stats';
      }
    }
  }

  _hubZones() {
    const pad = 0.04, tw = 0.44, th = 0.36;
    return [
      { x: this.W*pad,        y: this.H*0.28, w: this.W*tw, h: this.H*th, action:'range', label:'🎯 Shooting Range',  sub:'Practice & earn coins' },
      { x: this.W*(0.52+pad), y: this.H*0.28, w: this.W*tw, h: this.H*th, action:'shop',  label:'🛒 Gun Shop',         sub:'Buy weapons' },
      { x: this.W*pad,        y: this.H*0.70, w: this.W*tw, h: this.H*th, action:'duel',  label:'⚔️ Duel Arena',       sub:'Fight to 5 kills' },
      { x: this.W*(0.52+pad), y: this.H*0.70, w: this.W*tw, h: this.H*th, action:'stats', label:'📊 Stats',            sub:'Your record' },
    ];
  }

  _drawHub() {
    const { ctx: c, W, H } = this;
    c.fillStyle = '#0a0a1a';
    c.fillRect(0, 0, W, H);

    // stars
    if (!this._stars) {
      this._stars = Array.from({length:60}, () => ({
        x: Math.random()*W, y: Math.random()*H,
        r: Math.random()*1.5+0.3, a: Math.random()
      }));
    }
    this._stars.forEach(s => {
      s.a += 0.02; c.globalAlpha = 0.3+0.3*Math.abs(Math.sin(s.a));
      c.fillStyle = '#fff'; c.beginPath(); c.arc(s.x,s.y,s.r,0,Math.PI*2); c.fill();
    });
    c.globalAlpha = 1;

    // title
    c.textAlign = 'center';
    c.fillStyle = '#f59e0b';
    c.font = `bold ${H*0.065}px sans-serif`;
    c.fillText('⚔️  RIVALS', W/2, H*0.13);
    c.fillStyle = '#aaa'; c.font = `${H*0.033}px sans-serif`;
    c.fillText('Hub — Pick your destiny', W/2, H*0.20);

    // coins
    c.fillStyle = '#f59e0b'; c.font = `bold ${H*0.035}px sans-serif`;
    c.textAlign = 'right';
    c.fillText(`🪙 ${this.coins}`, W*0.97, H*0.07);

    // zones
    for (const z of this._hubZones()) {
      const hover = this.mouse.x>=z.x && this.mouse.x<=z.x+z.w && this.mouse.y>=z.y && this.mouse.y<=z.y+z.h;
      c.fillStyle = hover ? '#1e1e3a' : '#12122a';
      this._roundRect(z.x, z.y, z.w, z.h, 10);
      c.strokeStyle = hover ? '#7c3aed' : '#2a2a5a';
      c.lineWidth = 2;
      this._roundRect(z.x, z.y, z.w, z.h, 10, true);
      c.textAlign = 'center';
      c.fillStyle = '#fff'; c.font = `bold ${H*0.04}px sans-serif`;
      c.fillText(z.label, z.x+z.w/2, z.y+z.h*0.45);
      c.fillStyle = '#aaa'; c.font = `${H*0.028}px sans-serif`;
      c.fillText(z.sub, z.x+z.w/2, z.y+z.h*0.72);
    }
  }

  /* ==============================
     SHOOTING RANGE
  ============================== */
  _startRange() {
    this.screen = 'range';
    this.rangeScore = 0;
    this.rangeTargets = [];
    this._rangeTimer = 30;
    this._rangeLastSpawn = 0;
    this._rangeLastTick = Date.now();
  }

  _updateRange() {
    const now = Date.now();
    const dt = (now - this._rangeLastTick) / 1000;
    this._rangeLastTick = now;
    this._rangeTimer -= dt;
    if (this._rangeTimer <= 0) {
      // range done — award coins
      const earned = Math.floor(this.rangeScore * 2);
      this.coins += earned;
      this._rangeEarned = earned;
      this._save();
      this.screen = 'range_result';
      return;
    }
    this._rangeLastSpawn += dt;
    const interval = Math.max(0.4, 1.2 - (30 - this._rangeTimer) * 0.025);
    if (this._rangeLastSpawn >= interval) {
      this._rangeLastSpawn = 0;
      const margin = 0.08;
      this.rangeTargets.push({
        x: this.W * (margin + Math.random()*(1-2*margin)),
        y: this.H * (0.15 + Math.random()*0.65),
        r: this.W * (0.04 + Math.random()*0.03),
        life: 1.5 + Math.random(),
        age:  0,
        hit:  false,
      });
    }
    this.rangeTargets.forEach(t => { t.age += dt; });
    this.rangeTargets = this.rangeTargets.filter(t => t.age < t.life && !t.hit);
  }

  _rangeShoot(x, y) {
    if (this.screen !== 'range') return;
    let hit = false;
    this.rangeTargets.forEach(t => {
      const d = Math.hypot(x-t.x, y-t.y);
      if (d < t.r+8 && !t.hit) { t.hit = true; this.rangeScore += Math.ceil(10 * (1 - t.age/t.life)); hit = true; }
    });
    // bullet flash
    this.particles.push({ x, y, vx:(Math.random()-0.5)*4, vy:(Math.random()-0.5)*4, r:6, life:0.3, age:0, color: hit?'#4f4':'#f44' });
  }

  _drawRange() {
    const { ctx: c, W, H } = this;
    c.fillStyle = '#0d1117'; c.fillRect(0,0,W,H);
    // grid
    c.strokeStyle = '#1a2030'; c.lineWidth=1;
    for (let i=0;i<W;i+=40){ c.beginPath();c.moveTo(i,0);c.lineTo(i,H);c.stroke(); }
    for (let j=0;j<H;j+=40){ c.beginPath();c.moveTo(0,j);c.lineTo(W,j);c.stroke(); }

    c.textAlign='center';
    c.fillStyle='#fff'; c.font=`bold ${H*0.05}px sans-serif`;
    c.fillText('🎯  Shooting Range', W/2, H*0.1);
    c.fillStyle='#f59e0b'; c.font=`${H*0.035}px sans-serif`;
    c.fillText(`Score: ${this.rangeScore}   Time: ${Math.ceil(this._rangeTimer)}s`, W/2, H*0.175);

    // targets
    this.rangeTargets.forEach(t => {
      const fade = 1 - t.age/t.life;
      c.globalAlpha = fade;
      const pulse = 0.9 + 0.1*Math.sin(t.age*8);
      c.fillStyle = '#e74c3c';
      c.beginPath(); c.arc(t.x, t.y, t.r*pulse, 0, Math.PI*2); c.fill();
      c.fillStyle = '#fff';
      c.beginPath(); c.arc(t.x, t.y, t.r*pulse*0.4, 0, Math.PI*2); c.fill();
      c.globalAlpha=1;
    });

    // particles
    this._drawParticles(1/60);

    c.fillStyle='#888'; c.font=`${H*0.03}px sans-serif`;
    c.fillText('Tap / click to shoot targets  •  Earn 2 coins per point', W/2, H*0.95);
  }

  _drawRangeResult() {
    const { ctx: c, W, H } = this;
    c.fillStyle='#0a0a1a'; c.fillRect(0,0,W,H);
    c.textAlign='center';
    c.fillStyle='#f59e0b'; c.font=`bold ${H*0.07}px sans-serif`;
    c.fillText('Range Complete!', W/2, H*0.3);
    c.fillStyle='#fff'; c.font=`${H*0.04}px sans-serif`;
    c.fillText(`Score: ${this.rangeScore}`, W/2, H*0.45);
    c.fillStyle='#4f4'; c.font=`bold ${H*0.05}px sans-serif`;
    c.fillText(`+🪙 ${this._rangeEarned} coins earned!`, W/2, H*0.57);
    c.fillStyle='#aaa'; c.font=`${H*0.032}px sans-serif`;
    c.fillText('Total coins: 🪙 ' + this.coins, W/2, H*0.68);
    this._drawBtn(W/2-W*0.15, H*0.78, W*0.3, H*0.1, 'Back to Hub', '#7c3aed');
    if (this.mouse.x >= W/2-W*0.15 && this.mouse.x <= W/2+W*0.15 && this.mouse.y >= H*0.78 && this.mouse.y <= H*0.88) {
      if (this.mouse.down || this.touch.active) this._goHub();
    }
  }

  /* ==============================
     GUN SHOP
  ============================== */
  _shopClick(x, y) {
    const btnH = this.H*0.1, btnW = this.W*0.3;
    const startY = this.H*0.22;
    let i = 0;
    for (const [key, g] of Object.entries(GUNS)) {
      const col = i % 2, row = Math.floor(i/2);
      const bx = this.W*(col === 0 ? 0.05 : 0.55);
      const by = startY + row*(btnH+this.H*0.035);
      if (x>=bx && x<=bx+btnW && y>=by && y<=by+btnH) {
        if (!this.owned.includes(key) && this.coins >= g.cost) {
          this.owned.push(key);
          this.coins -= g.cost;
          this._save();
        }
      }
      i++;
    }
    // back button
    if (x>=this.W*0.35 && x<=this.W*0.65 && y>=this.H*0.88) this._goHub();
  }

  _drawShop() {
    const { ctx: c, W, H } = this;
    c.fillStyle='#0a0a1a'; c.fillRect(0,0,W,H);
    c.textAlign='center';
    c.fillStyle='#f59e0b'; c.font=`bold ${H*0.055}px sans-serif`;
    c.fillText('🛒  Gun Shop', W/2, H*0.1);
    c.fillStyle='#fff'; c.font=`${H*0.032}px sans-serif`;
    c.fillText('Coins: 🪙 '+this.coins, W/2, H*0.165);

    const btnH = H*0.1, btnW = W*0.38;
    const startY = H*0.22;
    let i=0;
    for (const [key, g] of Object.entries(GUNS)) {
      const col = i%2, row = Math.floor(i/2);
      const bx = W*(col===0 ? 0.04 : 0.54);
      const by = startY + row*(btnH+H*0.025);
      const owned = this.owned.includes(key);
      c.fillStyle = owned ? '#1a3a1a' : (this.coins>=g.cost ? '#1a1a3a' : '#2a1a1a');
      this._roundRect(bx, by, btnW, btnH, 8);
      c.strokeStyle = owned ? '#4f4' : (this.coins>=g.cost ? '#7c3aed' : '#555');
      c.lineWidth=2; this._roundRect(bx, by, btnW, btnH, 8, true);
      c.textAlign='left'; c.fillStyle='#fff'; c.font=`bold ${H*0.032}px sans-serif`;
      c.fillText(`${g.emoji} ${g.name}`, bx+8, by+btnH*0.42);
      c.fillStyle='#aaa'; c.font=`${H*0.024}px sans-serif`;
      c.fillText(`${g.dmg}dmg  ${g.rpm}rpm  ${g.ammo}ammo`, bx+8, by+btnH*0.78);
      c.textAlign='right';
      if (owned) { c.fillStyle='#4f4'; c.font=`bold ${H*0.028}px sans-serif`; c.fillText('Owned ✓', bx+btnW-8, by+btnH*0.42); }
      else { c.fillStyle='#f59e0b'; c.font=`bold ${H*0.028}px sans-serif`; c.fillText('🪙 '+g.cost, bx+btnW-8, by+btnH*0.42); }
      i++;
    }
    c.textAlign='center';
    this._drawBtn(W*0.35, H*0.88, W*0.3, H*0.08, '← Back', '#555');
    if (this.mouse.x>=W*0.35&&this.mouse.x<=W*0.65&&this.mouse.y>=H*0.88) {
      if (this.mouse.down||this.touch.active) { this.mouse.down=false; this._goHub(); }
    }
  }

  /* ==============================
     DUEL SETUP
  ============================== */
  _setupClick(x, y) {
    const { W, H } = this;
    // opponent
    const opps = Object.keys(BOT_DEFS);
    opps.forEach((k, i) => {
      const bx = W*(0.05+i*0.235), by=H*0.25, bw=W*0.21, bh=H*0.09;
      if (x>=bx&&x<=bx+bw&&y>=by&&y<=by+bh) this.duelCfg.opponent=k;
    });
    // map
    const maps = Object.keys(MAPS_DEF);
    maps.forEach((k, i) => {
      const bx=W*(0.05+i*0.31), by=H*0.46, bw=W*0.27, bh=H*0.09;
      if (x>=bx&&x<=bx+bw&&y>=by&&y<=by+bh) this.duelCfg.map=k;
    });
    // weapon
    this.owned.forEach((k, i) => {
      const bx=W*(0.04+i*0.19), by=H*0.66, bw=W*0.16, bh=H*0.09;
      if (x>=bx&&x<=bx+bw&&y>=by&&y<=by+bh) this.duelCfg.gun=k;
    });
    // start btn
    if (x>=W*0.3&&x<=W*0.7&&y>=H*0.82&&y<=H*0.92) this._startDuel();
    // back
    if (x>=W*0.01&&x<=W*0.15&&y>=H*0.02&&y<=H*0.1) this._goHub();
  }

  _drawSetup() {
    const { ctx: c, W, H } = this;
    c.fillStyle='#0a0a1a'; c.fillRect(0,0,W,H);
    c.textAlign='center';
    c.fillStyle='#fff'; c.font=`bold ${H*0.055}px sans-serif`;
    c.fillText('⚔️  Duel Setup', W/2, H*0.1);

    // opponent
    c.fillStyle='#aaa'; c.font=`${H*0.032}px sans-serif`;
    c.fillText('Opponent', W/2, H*0.21);
    const opps = Object.keys(BOT_DEFS);
    opps.forEach((k,i) => {
      const bx=W*(0.05+i*0.235), by=H*0.25, bw=W*0.21, bh=H*0.09;
      const sel=this.duelCfg.opponent===k;
      c.fillStyle=sel?'#2a1a4a':'#12122a';
      this._roundRect(bx,by,bw,bh,7);
      c.strokeStyle=sel?'#7c3aed':'#333'; c.lineWidth=2;
      this._roundRect(bx,by,bw,bh,7,true);
      c.textAlign='center'; c.fillStyle=sel?'#fff':'#aaa';
      c.font=`${H*0.03}px sans-serif`;
      c.fillText(BOT_DEFS[k].label, bx+bw/2, by+bh*0.62);
    });

    // map
    c.textAlign='center'; c.fillStyle='#aaa'; c.font=`${H*0.032}px sans-serif`;
    c.fillText('Map', W/2, H*0.42);
    const maps = Object.keys(MAPS_DEF);
    maps.forEach((k,i) => {
      const bx=W*(0.05+i*0.31), by=H*0.46, bw=W*0.27, bh=H*0.09;
      const sel=this.duelCfg.map===k;
      c.fillStyle=sel?'#1a2a4a':'#12122a';
      this._roundRect(bx,by,bw,bh,7);
      c.strokeStyle=sel?'#2563eb':'#333'; c.lineWidth=2;
      this._roundRect(bx,by,bw,bh,7,true);
      c.textAlign='center'; c.fillStyle=sel?'#fff':'#aaa';
      c.font=`${H*0.032}px sans-serif`;
      c.fillText(MAPS_DEF[k].name, bx+bw/2, by+bh*0.62);
    });

    // weapon
    c.textAlign='center'; c.fillStyle='#aaa'; c.font=`${H*0.032}px sans-serif`;
    c.fillText('Weapon (owned)', W/2, H*0.62);
    this.owned.forEach((k,i) => {
      const g=GUNS[k];
      const bx=W*(0.04+i*0.19), by=H*0.66, bw=W*0.16, bh=H*0.09;
      const sel=this.duelCfg.gun===k;
      c.fillStyle=sel?'#1a3a2a':'#12122a';
      this._roundRect(bx,by,bw,bh,7);
      c.strokeStyle=sel?'#22c55e':'#333'; c.lineWidth=2;
      this._roundRect(bx,by,bw,bh,7,true);
      c.textAlign='center'; c.fillStyle=sel?'#fff':'#aaa';
      c.font=`${H*0.028}px sans-serif`;
      c.fillText(g.emoji, bx+bw/2, by+bh*0.45);
      c.font=`${H*0.022}px sans-serif`;
      c.fillText(g.name, bx+bw/2, by+bh*0.78);
    });

    // start
    this._drawBtn(W*0.3, H*0.82, W*0.4, H*0.1, '🎮 Start Duel!', '#7c3aed');
    // back
    c.textAlign='left'; c.fillStyle='#888'; c.font=`${H*0.03}px sans-serif`;
    c.fillText('← Hub', W*0.03, H*0.07);
  }

  /* ==============================
     DUEL
  ============================== */
  _startDuel() {
    this.screen = 'duel';
    this.gameOver = false;
    this.playerKills = 0;
    this.botKills    = 0;
    this.bullets  = [];
    this.particles = [];

    const mapDef = MAPS_DEF[this.duelCfg.map];
    const gunKey  = this.duelCfg.gun;
    const gunDef  = GUNS[gunKey];
    const botDef  = BOT_DEFS[this.duelCfg.opponent];

    // Build obstacle list in pixel coords
    this.obstacles = mapDef.obstacles.map(([fx,fy,fw,fh]) => ({
      x: fx*this.W, y: fy*this.H, w: fw*this.W, h: fh*this.H
    }));

    const makeGun = (def) => ({
      def, ammo: def.ammo, reloading: false,
      reloadTimer: 0, fireTimer: 0
    });

    this.player = {
      x: this.W*0.15, y: this.H*0.5,
      vx:0, vy:0, r:12, hp:100, maxHp:100,
      color: '#7c3aed', gun: makeGun(gunDef), label:'You',
      fireDir: { x:1, y:0 },
      hits: 0,
    };

    const botGunKey = this._pickBotGun();
    this.bot = {
      x: this.W*0.85, y: this.H*0.5,
      vx:0, vy:0, r:12, hp:100, maxHp:100,
      color: '#e74c3c', gun: makeGun(GUNS[botGunKey]), label: botDef.label,
      speed: botDef.speed, accuracy: botDef.accuracy, reaction: botDef.reaction,
      reactionTimer: 0, targetX:this.player.x, targetY:this.player.y,
      strafeAngle: Math.random()*Math.PI*2, strafeTimer:0,
    };

    this._duelLastTime = Date.now();
  }

  _pickBotGun() {
    const botGuns = ['pistol','shotgun','smg','rifle'];
    return botGuns[Math.floor(Math.random()*botGuns.length)];
  }

  _updateDuel() {
    const now = Date.now();
    const dt  = Math.min((now - this._duelLastTime)/1000, 0.05);
    this._duelLastTime = now;

    this._movePlayer(dt);
    this._moveBot(dt);
    this._updateBullets(dt);
    this._updateParticles(dt);
    this._updateGun(this.player.gun, dt);
    this._updateGun(this.bot.gun, dt);

    // player auto-aim direction (toward mouse)
    const dx = this.mouse.x - this.player.x;
    const dy = this.mouse.y - this.player.y;
    const len = Math.hypot(dx,dy)||1;
    this.player.fireDir = { x:dx/len, y:dy/len };

    // player shooting (mouse held)
    if (this.mouse.down && !this.player.gun.reloading && this.player.gun.fireTimer<=0) {
      this._fireGun(this.player);
    }

    // bot AI
    this._botAI(dt);
  }

  _movePlayer(dt) {
    const sp = 160;
    let vx=0, vy=0;
    if (this.keys['a']||this.keys['arrowleft'])  vx-=sp;
    if (this.keys['d']||this.keys['arrowright']) vx+=sp;
    if (this.keys['w']||this.keys['arrowup'])    vy-=sp;
    if (this.keys['s']||this.keys['arrowdown'])  vy+=sp;

    // touch joystick
    if (this.touch.active && this.touch.dx!=null) {
      const mag = Math.hypot(this.touch.dx, this.touch.dy);
      if (mag > 10) {
        vx = (this.touch.dx/mag)*sp;
        vy = (this.touch.dy/mag)*sp;
      }
    }

    this._tryMove(this.player, vx*dt, vy*dt);
  }

  _moveBot(dt) {
    const b=this.bot, p=this.player;
    b.strafeTimer += dt;
    if (b.strafeTimer > 1.2+Math.random()*0.8) {
      b.strafeAngle += (Math.random()-0.5)*Math.PI*1.5;
      b.strafeTimer=0;
    }

    const tdx=p.x-b.x, tdy=p.y-b.y, dist=Math.hypot(tdx,tdy)||1;
    const ideal = this.W*0.35;
    let vx=0, vy=0;
    if (dist > ideal+30) { vx=tdx/dist; vy=tdy/dist; }
    else if (dist < ideal-30) { vx=-tdx/dist; vy=-tdy/dist; }
    // strafe perpendicular
    vx += Math.cos(b.strafeAngle)*0.7;
    vy += Math.sin(b.strafeAngle)*0.7;
    const mag = Math.hypot(vx,vy)||1;
    this._tryMove(b, (vx/mag)*b.speed*dt*60, (vy/mag)*b.speed*dt*60);
  }

  _tryMove(entity, dx, dy) {
    const nx = Math.max(entity.r, Math.min(this.W-entity.r, entity.x+dx));
    const ny = Math.max(entity.r, Math.min(this.H-entity.r, entity.y+dy));
    if (!this._collidesObstacles(nx, entity.y, entity.r)) entity.x=nx;
    if (!this._collidesObstacles(entity.x, ny, entity.r)) entity.y=ny;
  }

  _collidesObstacles(x, y, r) {
    return this.obstacles.some(o =>
      x+r>o.x && x-r<o.x+o.w && y+r>o.y && y-r<o.y+o.h
    );
  }

  _botAI(dt) {
    const b=this.bot, p=this.player;
    b.reactionTimer -= dt*1000;
    if (b.reactionTimer <= 0) {
      b.reactionTimer = b.reaction + (Math.random()-0.5)*100;
      b.targetX=p.x; b.targetY=p.y;
    }
    const dx=b.targetX-b.x, dy=b.targetY-b.y;
    const len=Math.hypot(dx,dy)||1;
    // add inaccuracy
    const scatter = (1-b.accuracy)*Math.PI*0.5;
    const angle = Math.atan2(dy,dx) + (Math.random()-0.5)*scatter;
    b.gun.fireDir = { x: Math.cos(angle), y: Math.sin(angle) };
    // fire
    if (!b.gun.reloading && b.gun.fireTimer<=0) this._fireGun(b);
  }

  _updateGun(gun, dt) {
    if (gun.fireTimer > 0) gun.fireTimer -= dt;
    if (gun.reloading) {
      gun.reloadTimer -= dt;
      if (gun.reloadTimer <= 0) {
        gun.reloading=false; gun.ammo=gun.def.ammo;
      }
    }
  }

  _fireGun(entity) {
    const gun=entity.gun, def=gun.def;
    if (gun.ammo<=0) { this._startReload(gun); return; }
    gun.ammo--;
    gun.fireTimer = 60/def.rpm;
    const dir = entity.fireDir || { x:1, y:0 };

    for (let p=0; p<def.pellets; p++) {
      const spread = (def.pellets>1 ? (p/(def.pellets-1)-0.5)*0.4 : 0);
      const angle  = Math.atan2(dir.y,dir.x)+spread;
      const spd    = 350+Math.random()*50;
      this.bullets.push({
        x: entity.x+dir.x*entity.r,
        y: entity.y+dir.y*entity.r,
        vx: Math.cos(angle)*spd,
        vy: Math.sin(angle)*spd,
        owner: entity===this.player ? 'player':'bot',
        dmg: def.dmg, splash: def.splash,
        color: def.color, r:3, life:0.8, age:0,
      });
    }
    if (gun.ammo===0) this._startReload(gun);

    // muzzle flash
    this.particles.push({
      x:entity.x+dir.x*entity.r*2, y:entity.y+dir.y*entity.r*2,
      vx:0,vy:0, r:8, life:0.08, age:0, color:'#ff0'
    });
  }

  _startReload(gun) {
    if (!gun.reloading) { gun.reloading=true; gun.reloadTimer=gun.def.reload; }
  }

  _playerShoot() {
    // trigger on tap (touch)
    if (!this.player.gun.reloading && this.player.gun.fireTimer<=0) {
      this._fireGun(this.player);
    }
  }

  _updateBullets(dt) {
    const toRemove=[];
    this.bullets.forEach((b,bi) => {
      b.x+=b.vx*dt; b.y+=b.vy*dt; b.age+=dt;
      if (b.age>b.life || b.x<0||b.x>this.W||b.y<0||b.y>this.H) { toRemove.push(bi); return; }
      // obstacle collision
      if (this.obstacles.some(o=>b.x>o.x&&b.x<o.x+o.w&&b.y>o.y&&b.y<o.y+o.h)) {
        this._hitEffect(b.x, b.y, '#aaa');
        toRemove.push(bi); return;
      }
      // hit player or bot
      const target = b.owner==='bot' ? this.player : this.bot;
      const d=Math.hypot(b.x-target.x, b.y-target.y);
      if (d<target.r+b.r) {
        const dmg = b.splash>0 ? b.dmg : b.dmg;
        target.hp = Math.max(0, target.hp-dmg);
        this._hitEffect(target.x, target.y, b.owner==='bot'?'#f44':'#4af');
        toRemove.push(bi);
        if (target.hp<=0) this._handleKill(b.owner);
      }
    });
    for (let i=toRemove.length-1; i>=0; i--) this.bullets.splice(toRemove[i],1);
  }

  _handleKill(killerOwner) {
    if (killerOwner==='player') {
      this.playerKills++;
      this.stats.kills++;
      this._hitEffect(this.bot.x, this.bot.y, '#f59e0b', 20);
      setTimeout(() => { this.bot.hp=100; this.bot.x=this.W*0.85; this.bot.y=this.H*0.5; }, 800);
    } else {
      this.botKills++;
      this.stats.deaths++;
      this._hitEffect(this.player.x, this.player.y, '#f59e0b', 20);
      setTimeout(() => { this.player.hp=100; this.player.x=this.W*0.15; this.player.y=this.H*0.5; }, 800);
    }
    if (this.playerKills>=this.killGoal || this.botKills>=this.killGoal) {
      const won = this.playerKills>=this.killGoal;
      if (won) { this.stats.wins++; this.coins+=150; }
      else      { this.stats.losses++; this.coins+=25; }
      this._save();
      setTimeout(() => {
        this._duelResult = { won, pkills: this.playerKills, bkills: this.botKills };
        this.screen='results';
      }, 1200);
      this.gameOver=true;
    }
  }

  _hitEffect(x, y, color, count=8) {
    for (let i=0; i<count; i++) {
      const a=Math.random()*Math.PI*2, sp=60+Math.random()*80;
      this.particles.push({ x, y, vx:Math.cos(a)*sp, vy:Math.sin(a)*sp, r:4, life:0.4+Math.random()*0.3, age:0, color });
    }
  }

  _updateParticles(dt) {
    this.particles.forEach(p => { p.x+=p.vx*dt; p.y+=p.vy*dt; p.age+=dt; p.vx*=0.92; p.vy*=0.92; p.r*=0.97; });
    this.particles=this.particles.filter(p=>p.age<p.life);
  }

  _drawParticles(dt) {
    this.particles.forEach(p => {
      const a=1-p.age/p.life;
      this.ctx.globalAlpha=a; this.ctx.fillStyle=p.color;
      this.ctx.beginPath(); this.ctx.arc(p.x,p.y,p.r,0,Math.PI*2); this.ctx.fill();
    });
    this.ctx.globalAlpha=1;
  }

  _drawDuel() {
    const { ctx: c, W, H } = this;
    const mapDef = MAPS_DEF[this.duelCfg.map];

    // floor
    c.fillStyle=mapDef.floor; c.fillRect(0,0,W,H);

    // subtle grid
    c.strokeStyle='rgba(255,255,255,0.04)'; c.lineWidth=1;
    for(let i=0;i<W;i+=32){c.beginPath();c.moveTo(i,0);c.lineTo(i,H);c.stroke();}
    for(let j=0;j<H;j+=32){c.beginPath();c.moveTo(0,j);c.lineTo(W,j);c.stroke();}

    // obstacles
    this.obstacles.forEach(o => {
      c.fillStyle='#333'; c.fillRect(o.x,o.y,o.w,o.h);
      c.strokeStyle='#555'; c.lineWidth=2; c.strokeRect(o.x,o.y,o.w,o.h);
    });

    // bullets
    this.bullets.forEach(b => {
      c.fillStyle=b.color;
      c.beginPath(); c.arc(b.x,b.y,b.r,0,Math.PI*2); c.fill();
    });

    // particles
    this._drawParticles(0);

    // draw entity
    const drawEnt = (e, label) => {
      if (e.hp<=0) return;
      // shadow
      c.fillStyle='rgba(0,0,0,0.3)';
      c.beginPath(); c.ellipse(e.x,e.y+e.r-2, e.r*0.8,e.r*0.35, 0,0,Math.PI*2); c.fill();
      // body
      c.fillStyle=e.color;
      c.beginPath(); c.arc(e.x,e.y,e.r,0,Math.PI*2); c.fill();
      // direction indicator
      const dir=e.fireDir||{x:1,y:0};
      c.strokeStyle='rgba(255,255,255,0.7)'; c.lineWidth=2;
      c.beginPath(); c.moveTo(e.x,e.y); c.lineTo(e.x+dir.x*e.r*1.4,e.y+dir.y*e.r*1.4); c.stroke();
      // HP bar
      const bw=e.r*2.5, bh=4, bx=e.x-bw/2, by=e.y-e.r-8;
      c.fillStyle='#333'; c.fillRect(bx,by,bw,bh);
      c.fillStyle=e.hp>50?'#4f4':'#f84'; c.fillRect(bx,by,bw*(e.hp/e.maxHp),bh);
      // label
      c.textAlign='center'; c.fillStyle='#fff'; c.font=`${H*0.025}px sans-serif`;
      c.fillText(label, e.x, e.y-e.r-12);
    };

    drawEnt(this.player,'You');
    drawEnt(this.bot, this.bot.label||'Bot');

    // HUD
    // score
    c.textAlign='center'; c.fillStyle='#fff'; c.font=`bold ${H*0.045}px sans-serif`;
    c.fillText(`${this.playerKills}  —  ${this.botKills}`, W/2, H*0.07);
    c.fillStyle='#aaa'; c.font=`${H*0.025}px sans-serif`;
    c.fillText(`First to ${this.killGoal} wins`, W/2, H*0.115);

    // ammo / reload
    const g=this.player.gun;
    c.textAlign='left'; c.fillStyle='#fff'; c.font=`${H*0.03}px sans-serif`;
    c.fillText(g.def.emoji+' '+g.def.name, W*0.02, H*0.95);
    if (g.reloading) {
      c.fillStyle='#f59e0b';
      c.fillText(`Reloading… ${g.reloadTimer.toFixed(1)}s`, W*0.02, H*0.985);
    } else {
      c.fillStyle='#4af';
      for(let i=0;i<g.def.ammo;i++){
        c.fillStyle=i<g.ammo?'#4af':'#333';
        c.fillRect(W*0.02+i*9, H*0.975, 7, 12);
      }
    }

    // controls hint
    c.textAlign='right'; c.fillStyle='rgba(255,255,255,0.4)'; c.font=`${H*0.024}px sans-serif`;
    c.fillText('WASD/drag to move  •  Aim & click/tap to shoot', W*0.98, H*0.985);
  }

  /* ==============================
     RESULTS
  ============================== */
  _drawResults() {
    const { ctx: c, W, H } = this;
    const r = this._duelResult || { won:false, pkills:0, bkills:0 };
    c.fillStyle='#0a0a1a'; c.fillRect(0,0,W,H);
    c.textAlign='center';
    c.fillStyle= r.won?'#f59e0b':'#e74c3c';
    c.font=`bold ${H*0.1}px sans-serif`;
    c.fillText(r.won?'Victory!':'Defeat', W/2, H*0.25);
    c.fillStyle='#fff'; c.font=`${H*0.045}px sans-serif`;
    c.fillText(`${r.pkills}  —  ${r.bkills}`, W/2, H*0.42);
    c.fillStyle='#aaa'; c.font=`${H*0.032}px sans-serif`;
    c.fillText('Your kills — Bot kills', W/2, H*0.5);
    c.fillStyle='#4f4'; c.font=`bold ${H*0.04}px sans-serif`;
    c.fillText(`+🪙 ${r.won?'150':'25'} coins  (Total: ${this.coins})`, W/2, H*0.63);
    this._drawBtn(W*0.3, H*0.76, W*0.4, H*0.11, '🏠 Back to Hub', '#7c3aed');
  }

  /* ==============================
     STATS
  ============================== */
  _drawStats() {
    const { ctx: c, W, H } = this;
    const s=this.stats;
    c.fillStyle='#0a0a1a'; c.fillRect(0,0,W,H);
    c.textAlign='center';
    c.fillStyle='#f59e0b'; c.font=`bold ${H*0.06}px sans-serif`;
    c.fillText('📊 Your Stats', W/2, H*0.12);
    const rows=[
      ['Wins',s.wins],['Losses',s.losses],
      ['Kills',s.kills],['Deaths',s.deaths],
      ['K/D', s.deaths>0?(s.kills/s.deaths).toFixed(2):s.kills],
      ['Coins','🪙 '+this.coins],
    ];
    rows.forEach(([k,v],i) => {
      const y=H*(0.23+i*0.1);
      c.fillStyle='#aaa'; c.font=`${H*0.034}px sans-serif`; c.textAlign='right';
      c.fillText(k, W*0.42, y);
      c.fillStyle='#fff'; c.textAlign='left';
      c.fillText(v, W*0.47, y);
    });
    this._drawBtn(W*0.3, H*0.86, W*0.4, H*0.1, '← Back to Hub', '#555');
    if (this.mouse.x>=W*0.3&&this.mouse.x<=W*0.7&&this.mouse.y>=H*0.86) {
      if (this.mouse.down||this.touch.active) { this.mouse.down=false; this._goHub(); }
    }
  }

  /* ==============================
     MAIN DRAW DISPATCH
  ============================== */
  _draw() {
    switch (this.screen) {
      case 'hub':          this._drawHub();         break;
      case 'range':        this._drawRange();        break;
      case 'range_result': this._drawRangeResult();  break;
      case 'shop':         this._drawShop();         break;
      case 'duel_setup':   this._drawSetup();        break;
      case 'duel':         this._drawDuel();         break;
      case 'results':      this._drawResults();      break;
      case 'stats':        this._drawStats();        break;
    }
  }

  /* ==============================
     HELPERS
  ============================== */
  _roundRect(x, y, w, h, r, stroke=false) {
    const c=this.ctx;
    c.beginPath();
    c.moveTo(x+r,y); c.lineTo(x+w-r,y); c.arcTo(x+w,y,x+w,y+r,r);
    c.lineTo(x+w,y+h-r); c.arcTo(x+w,y+h,x+w-r,y+h,r);
    c.lineTo(x+r,y+h); c.arcTo(x,y+h,x,y+h-r,r);
    c.lineTo(x,y+r); c.arcTo(x,y,x+r,y,r);
    c.closePath();
    if (stroke) c.stroke(); else c.fill();
  }

  _drawBtn(x, y, w, h, label, color) {
    const c=this.ctx;
    const hover=this.mouse.x>=x&&this.mouse.x<=x+w&&this.mouse.y>=y&&this.mouse.y<=y+h;
    c.fillStyle=hover?color+'dd':color+'99';
    this._roundRect(x,y,w,h,8);
    c.strokeStyle=color; c.lineWidth=2; this._roundRect(x,y,w,h,8,true);
    c.textAlign='center'; c.fillStyle='#fff';
    c.font=`bold ${this.H*0.035}px sans-serif`;
    c.fillText(label, x+w/2, y+h*0.63);
  }
}
