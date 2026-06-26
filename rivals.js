/* ===== RIVALS 3D — First-Person Roblox-inspired Battle ===== */

const GUNS = {
  pistol:  { name:'Pistol',  cost:0,    dmg:25,  rpm:150, ammo:8,  reload:1.2, pellets:1, color:'#aaa', emoji:'🔫' },
  shotgun: { name:'Shotgun', cost:200,  dmg:18,  rpm:75,  ammo:6,  reload:2.0, pellets:6, color:'#c84', emoji:'💥' },
  smg:     { name:'SMG',     cost:350,  dmg:12,  rpm:600, ammo:30, reload:1.8, pellets:1, color:'#4af', emoji:'⚡' },
  rifle:   { name:'Rifle',   cost:500,  dmg:40,  rpm:90,  ammo:20, reload:2.5, pellets:1, color:'#4c8', emoji:'🎯' },
  sniper:  { name:'Sniper',  cost:750,  dmg:95,  rpm:30,  ammo:5,  reload:3.0, pellets:1, color:'#a4f', emoji:'🔭' },
  rocket:  { name:'Rocket',  cost:1000, dmg:120, rpm:20,  ammo:3,  reload:3.5, pellets:1, color:'#f44', emoji:'🚀' },
};

const MAPS_DEF = {
  arena: {
    name:'Arena', wallR:60,wallG:60,wallB:180,
    obstacles:[
      [0.1,0.1,0.12,0.12],[0.78,0.1,0.12,0.12],[0.1,0.78,0.12,0.12],[0.78,0.78,0.12,0.12],
      [0.42,0.42,0.16,0.16],[0.25,0.45,0.08,0.1],[0.67,0.45,0.08,0.1],
      [0.45,0.22,0.1,0.07],[0.45,0.71,0.1,0.07],
    ]
  },
  warehouse: {
    name:'Warehouse', wallR:120,wallG:80,wallB:40,
    obstacles:[
      [0.05,0.05,0.15,0.25],[0.05,0.7,0.15,0.25],[0.8,0.05,0.15,0.25],[0.8,0.7,0.15,0.25],
      [0.3,0.05,0.1,0.08],[0.6,0.87,0.1,0.08],[0.38,0.4,0.24,0.2],
      [0.15,0.45,0.08,0.1],[0.77,0.45,0.08,0.1],
    ]
  },
  rooftop: {
    name:'Rooftop', wallR:30,wallG:30,wallB:80,
    obstacles:[
      [0.43,0.43,0.14,0.14],
      [0.05,0.43,0.06,0.14],[0.89,0.43,0.06,0.14],
      [0.43,0.05,0.14,0.06],[0.43,0.89,0.14,0.06],
      [0.2,0.2,0.08,0.08],[0.72,0.2,0.08,0.08],[0.2,0.72,0.08,0.08],[0.72,0.72,0.08,0.08],
    ]
  }
};

const BOT_DEFS = {
  easy:    { label:'Easy Bot',   speed:1.8, accuracy:0.30, reaction:950 },
  medium:  { label:'Medium Bot', speed:2.5, accuracy:0.58, reaction:520 },
  hard:    { label:'Hard Bot',   speed:3.4, accuracy:0.80, reaction:210 },
  player2: { label:'Player 2',   speed:2.8, accuracy:0.68, reaction:370 },
};

const MC = 20; // map cell count

function _buildGrid(mapKey) {
  const grid = Array.from({length:MC}, () => new Uint8Array(MC));
  for (let i=0;i<MC;i++) { grid[0][i]=grid[MC-1][i]=grid[i][0]=grid[i][MC-1]=1; }
  for (const [fx,fy,fw,fh] of MAPS_DEF[mapKey].obstacles) {
    const x0=Math.max(0,Math.floor(fx*MC)), y0=Math.max(0,Math.floor(fy*MC));
    const x1=Math.min(MC,Math.ceil((fx+fw)*MC)), y1=Math.min(MC,Math.ceil((fy+fh)*MC));
    for (let y=y0;y<y1;y++) for (let x=x0;x<x1;x++) grid[y][x]=1;
  }
  return grid;
}

/* ── Wall strip lookup table for performance ── */
const _wallCache = new Map();
function getGrid(mapKey) {
  if (!_wallCache.has(mapKey)) _wallCache.set(mapKey, _buildGrid(mapKey));
  return _wallCache.get(mapKey);
}

class RivalsGame {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx    = canvas.getContext('2d');
    this.W = canvas.width;
    this.H = canvas.height;
    this.raf  = null;
    this._handlers = [];

    this.coins = parseInt(localStorage.getItem('rivals_coins') || '500');
    this.owned = JSON.parse(localStorage.getItem('rivals_owned') || '["pistol"]');
    this.stats = JSON.parse(localStorage.getItem('rivals_stats') || '{"wins":0,"losses":0,"kills":0,"deaths":0}');

    this.screen   = 'hub';
    this.duelCfg  = { map:'arena', gun:'pistol', opponent:'easy' };

    // range state
    this.rangeTargets = [];
    this.rangeScore   = 0;

    // duel state
    this.player3d = null; this.bot3d = null;
    this.playerKills=0; this.botKills=0; this.killGoal=5;
    this.gameOver = false;
    this.particles = [];
    this._zBuf = null;

    // input
    this.keys  = {};
    this.mouse = { x:this.W/2, y:this.H/2, down:false, dx:0, lastX:this.W/2 };
    this.touch = { active:false, id:null, sx:0, sy:0, dx:0, dy:0 };
    this.joy   = { active:false, ox:0, oy:0, jx:0, jy:0 }; // virtual joystick
  }

  start()   { this._bind(); this._loop(); }

  destroy() {
    cancelAnimationFrame(this.raf);
    this._handlers.forEach(({el,ev,fn,opts}) => el.removeEventListener(ev,fn,opts));
  }

  _save() {
    localStorage.setItem('rivals_coins', this.coins);
    localStorage.setItem('rivals_owned',  JSON.stringify(this.owned));
    localStorage.setItem('rivals_stats',  JSON.stringify(this.stats));
  }

  /* ═══════════════════════════════════════════════════
     INPUT
  ═══════════════════════════════════════════════════ */
  _on(el, ev, fn, opts) {
    el.addEventListener(ev, fn, opts);
    this._handlers.push({el,ev,fn,opts});
  }

  _bind() {
    const R = () => this.canvas.getBoundingClientRect();
    const toC = (cx, cy) => {
      const r = R();
      return [(cx-r.left)*(this.W/r.width), (cy-r.top)*(this.H/r.height)];
    };

    this._on(window, 'keydown', e => { this.keys[e.key.toLowerCase()]=true; });
    this._on(window, 'keyup',   e => { this.keys[e.key.toLowerCase()]=false; });

    this._on(this.canvas, 'mousemove', e => {
      const [x, y] = toC(e.clientX, e.clientY);
      this.mouse.dx = x - this.mouse.lastX;
      this.mouse.lastX = x;
      this.mouse.x = x; this.mouse.y = y;
    });
    this._on(this.canvas, 'mousedown', e => {
      const [x, y] = toC(e.clientX, e.clientY);
      this.mouse.x=x; this.mouse.y=y; this.mouse.down=true;
      this._handleClick(x, y);
    });
    this._on(this.canvas, 'mouseup', () => { this.mouse.down=false; });

    this._on(this.canvas, 'touchstart', e => {
      e.preventDefault();
      // first touch = look/action, second touch = optional
      const t = e.changedTouches[0];
      const [x,y] = toC(t.clientX, t.clientY);
      if (this.screen === 'duel' && x < this.W*0.4) {
        // left side → joystick
        this.joy.active=true; this.joy.ox=x; this.joy.oy=y; this.joy.jx=0; this.joy.jy=0;
      } else {
        this.touch.active=true; this.touch.id=t.identifier;
        this.touch.sx=x; this.touch.sy=y; this.touch.dx=0; this.touch.dy=0;
        this._handleClick(x, y);
      }
    }, {passive:false});

    this._on(this.canvas, 'touchmove', e => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        const [x,y] = toC(t.clientX, t.clientY);
        if (this.joy.active && x < this.W*0.4) {
          this.joy.jx=x-this.joy.ox; this.joy.jy=y-this.joy.oy;
        } else if (t.identifier === this.touch.id) {
          this.touch.dx=x-this.touch.sx; this.touch.dy=y-this.touch.sy;
          this.touch.sx=x; this.touch.sy=y; // delta per frame
        }
      }
    }, {passive:false});

    this._on(this.canvas, 'touchend', e => {
      for (const t of e.changedTouches) {
        const [x] = toC(t.clientX, t.clientY);
        if (x < this.W*0.4) { this.joy.active=false; this.joy.jx=0; this.joy.jy=0; }
        else if (t.identifier===this.touch.id) { this.touch.active=false; this.touch.dx=0; this.touch.dy=0; }
      }
    });
  }

  _handleClick(x, y) {
    switch(this.screen) {
      case 'hub':         this._hubClick(x,y); break;
      case 'range':       this._rangeShoot(x,y); break;
      case 'range_result':if(true) this._goHub(); break;
      case 'shop':        this._shopClick(x,y); break;
      case 'duel_setup':  this._setupClick(x,y); break;
      case 'duel':        if(!this.gameOver) this._playerShoot3D(); break;
      case 'results':     this._goHub(); break;
      case 'stats':       this._goHub(); break;
    }
  }

  /* ═══════════════════════════════════════════════════
     LOOP
  ═══════════════════════════════════════════════════ */
  _loop() {
    this.raf = requestAnimationFrame(() => this._loop());
    const now = Date.now();
    if (!this._lastT) this._lastT = now;
    const dt = Math.min((now - this._lastT)/1000, 0.05);
    this._lastT = now;
    this._update(dt);
    this._draw();
    this.mouse.dx = 0; // reset delta after each frame
    this.touch.dx = 0; this.touch.dy = 0;
  }

  _update(dt) {
    if (this.screen==='range') this._updateRange(dt);
    if (this.screen==='duel' && !this.gameOver) this._updateDuel(dt);
    this._updateParticles(dt);
  }

  /* ═══════════════════════════════════════════════════
     HUB
  ═══════════════════════════════════════════════════ */
  _goHub() { this.screen='hub'; }

  _hubZones() {
    const {W,H} = this;
    return [
      {x:W*0.04, y:H*0.28, w:W*0.44, h:H*0.36, action:'range', label:'🎯 Shooting Range', sub:'Practice & earn coins'},
      {x:W*0.52, y:H*0.28, w:W*0.44, h:H*0.36, action:'shop',  label:'🛒 Gun Shop',        sub:'Buy weapons'},
      {x:W*0.04, y:H*0.70, w:W*0.44, h:H*0.36, action:'duel',  label:'⚔️ Duel Arena',      sub:'3D First-Person Duel'},
      {x:W*0.52, y:H*0.70, w:W*0.44, h:H*0.36, action:'stats', label:'📊 Stats',           sub:'Your record'},
    ];
  }

  _hubClick(x,y) {
    for (const z of this._hubZones()) {
      if (x>=z.x&&x<=z.x+z.w&&y>=z.y&&y<=z.y+z.h) {
        if (z.action==='range') this._startRange();
        else this.screen=z.action==='duel'?'duel_setup':z.action;
      }
    }
  }

  _drawHub() {
    const {ctx:c,W,H} = this;
    c.fillStyle='#0a0a1a'; c.fillRect(0,0,W,H);
    if (!this._stars) this._stars=Array.from({length:60},()=>({x:Math.random()*W,y:Math.random()*H,r:Math.random()*1.5+0.3,a:Math.random()}));
    this._stars.forEach(s=>{s.a+=0.02;c.globalAlpha=0.3+0.3*Math.abs(Math.sin(s.a));c.fillStyle='#fff';c.beginPath();c.arc(s.x,s.y,s.r,0,Math.PI*2);c.fill();});
    c.globalAlpha=1;
    c.textAlign='center'; c.fillStyle='#f59e0b'; c.font=`bold ${H*0.065}px sans-serif`;
    c.fillText('⚔️  RIVALS 3D', W/2, H*0.13);
    c.fillStyle='#aaa'; c.font=`${H*0.032}px sans-serif`;
    c.fillText('First-Person PvP • Hub', W/2, H*0.20);
    c.textAlign='right'; c.fillStyle='#f59e0b'; c.font=`bold ${H*0.035}px sans-serif`;
    c.fillText(`🪙 ${this.coins}`, W*0.97, H*0.07);
    for (const z of this._hubZones()) {
      const hov = this.mouse.x>=z.x&&this.mouse.x<=z.x+z.w&&this.mouse.y>=z.y&&this.mouse.y<=z.y+z.h;
      c.fillStyle=hov?'#1e1e3a':'#12122a'; this._rr(z.x,z.y,z.w,z.h,10);
      c.strokeStyle=hov?'#7c3aed':'#2a2a5a'; c.lineWidth=2; this._rr(z.x,z.y,z.w,z.h,10,true);
      c.textAlign='center'; c.fillStyle='#fff'; c.font=`bold ${H*0.04}px sans-serif`;
      c.fillText(z.label, z.x+z.w/2, z.y+z.h*0.45);
      c.fillStyle='#aaa'; c.font=`${H*0.028}px sans-serif`;
      c.fillText(z.sub, z.x+z.w/2, z.y+z.h*0.72);
    }
  }

  /* ═══════════════════════════════════════════════════
     SHOOTING RANGE
  ═══════════════════════════════════════════════════ */
  _startRange() {
    this.screen='range'; this.rangeScore=0; this.rangeTargets=[];
    this._rTimer=30; this._rSpawn=0; this._rTick=Date.now();
  }

  _updateRange(dt) {
    const now=Date.now(), elapsed=(now-this._rTick)/1000; this._rTick=now;
    this._rTimer-=elapsed;
    if (this._rTimer<=0) { const e=Math.floor(this.rangeScore*2); this.coins+=e; this._rEarned=e; this._save(); this.screen='range_result'; return; }
    this._rSpawn+=elapsed;
    const iv=Math.max(0.4,1.2-(30-this._rTimer)*0.025);
    if (this._rSpawn>=iv) { this._rSpawn=0; this.rangeTargets.push({x:this.W*(0.08+Math.random()*0.84),y:this.H*(0.15+Math.random()*0.65),r:this.W*(0.04+Math.random()*0.03),life:1.5+Math.random(),age:0,hit:false}); }
    this.rangeTargets.forEach(t=>t.age+=elapsed);
    this.rangeTargets=this.rangeTargets.filter(t=>t.age<t.life&&!t.hit);
  }

  _rangeShoot(x,y) {
    this.rangeTargets.forEach(t=>{if(Math.hypot(x-t.x,y-t.y)<t.r+8&&!t.hit){t.hit=true;this.rangeScore+=Math.ceil(10*(1-t.age/t.life));this.particles.push({x,y,vx:(Math.random()-0.5)*5,vy:(Math.random()-0.5)*5,r:7,life:0.3,age:0,color:'#4f4'});}});
  }

  _drawRange() {
    const {ctx:c,W,H}=this;
    c.fillStyle='#0d1117';c.fillRect(0,0,W,H);
    c.strokeStyle='#1a2030';c.lineWidth=1;
    for(let i=0;i<W;i+=40){c.beginPath();c.moveTo(i,0);c.lineTo(i,H);c.stroke();}
    for(let j=0;j<H;j+=40){c.beginPath();c.moveTo(0,j);c.lineTo(W,j);c.stroke();}
    c.textAlign='center'; c.fillStyle='#fff'; c.font=`bold ${H*0.05}px sans-serif`;
    c.fillText('🎯  Shooting Range', W/2, H*0.1);
    c.fillStyle='#f59e0b'; c.font=`${H*0.035}px sans-serif`;
    c.fillText(`Score: ${this.rangeScore}   Time: ${Math.ceil(this._rTimer)}s`, W/2, H*0.175);
    this.rangeTargets.forEach(t=>{
      const fa=1-t.age/t.life; c.globalAlpha=fa;
      const p=0.9+0.1*Math.sin(t.age*8);
      c.fillStyle='#e74c3c'; c.beginPath(); c.arc(t.x,t.y,t.r*p,0,Math.PI*2); c.fill();
      c.fillStyle='#fff'; c.beginPath(); c.arc(t.x,t.y,t.r*p*0.4,0,Math.PI*2); c.fill();
      c.globalAlpha=1;
    });
    this._drawParticles();
    c.fillStyle='#888'; c.font=`${H*0.028}px sans-serif`;
    c.fillText('Tap / click targets  •  Earn 2 coins per point', W/2, H*0.95);
  }

  _drawRangeResult() {
    const {ctx:c,W,H}=this;
    c.fillStyle='#0a0a1a'; c.fillRect(0,0,W,H);
    c.textAlign='center';
    c.fillStyle='#f59e0b'; c.font=`bold ${H*0.07}px sans-serif`; c.fillText('Range Done!',W/2,H*0.3);
    c.fillStyle='#fff'; c.font=`${H*0.04}px sans-serif`; c.fillText(`Score: ${this.rangeScore}`,W/2,H*0.45);
    c.fillStyle='#4f4'; c.font=`bold ${H*0.05}px sans-serif`; c.fillText(`+🪙 ${this._rEarned} coins!`,W/2,H*0.57);
    c.fillStyle='#aaa'; c.font=`${H*0.032}px sans-serif`; c.fillText('Total: 🪙 '+this.coins,W/2,H*0.68);
    this._btn(W/2-W*0.15,H*0.78,W*0.3,H*0.1,'Back to Hub','#7c3aed');
  }

  /* ═══════════════════════════════════════════════════
     SHOP
  ═══════════════════════════════════════════════════ */
  _shopClick(x,y) {
    const {W,H}=this; const s=H*0.1,bw=W*0.38,sy=H*0.22;
    let i=0;
    for (const [key,g] of Object.entries(GUNS)) {
      const col=i%2,row=Math.floor(i/2), bx=W*(col===0?0.04:0.54), by=sy+row*(s+H*0.025);
      if(x>=bx&&x<=bx+bw&&y>=by&&y<=by+s&&!this.owned.includes(key)&&this.coins>=g.cost){this.owned.push(key);this.coins-=g.cost;this._save();}
      i++;
    }
    if(x>=W*0.35&&x<=W*0.65&&y>=H*0.88) this._goHub();
  }

  _drawShop() {
    const {ctx:c,W,H}=this; const bw=W*0.38,bh=H*0.1,sy=H*0.22;
    c.fillStyle='#0a0a1a';c.fillRect(0,0,W,H);
    c.textAlign='center'; c.fillStyle='#f59e0b'; c.font=`bold ${H*0.055}px sans-serif`; c.fillText('🛒  Gun Shop',W/2,H*0.1);
    c.fillStyle='#fff'; c.font=`${H*0.032}px sans-serif`; c.fillText('Coins: 🪙 '+this.coins,W/2,H*0.165);
    let i=0;
    for(const [key,g] of Object.entries(GUNS)){
      const col=i%2,row=Math.floor(i/2),bx=W*(col===0?0.04:0.54),by=sy+row*(bh+H*0.025);
      const own=this.owned.includes(key);
      c.fillStyle=own?'#1a3a1a':(this.coins>=g.cost?'#1a1a3a':'#2a1a1a'); this._rr(bx,by,bw,bh,8);
      c.strokeStyle=own?'#4f4':(this.coins>=g.cost?'#7c3aed':'#555');c.lineWidth=2;this._rr(bx,by,bw,bh,8,true);
      c.textAlign='left';c.fillStyle='#fff';c.font=`bold ${H*0.032}px sans-serif`;c.fillText(`${g.emoji} ${g.name}`,bx+8,by+bh*0.42);
      c.fillStyle='#aaa';c.font=`${H*0.024}px sans-serif`;c.fillText(`${g.dmg}dmg  ${g.rpm}rpm  ${g.ammo}ammo`,bx+8,by+bh*0.78);
      c.textAlign='right';
      if(own){c.fillStyle='#4f4';c.font=`bold ${H*0.028}px sans-serif`;c.fillText('Owned ✓',bx+bw-8,by+bh*0.42);}
      else{c.fillStyle='#f59e0b';c.font=`bold ${H*0.028}px sans-serif`;c.fillText('🪙 '+g.cost,bx+bw-8,by+bh*0.42);}
      i++;
    }
    c.textAlign='center'; this._btn(W*0.35,H*0.88,W*0.3,H*0.08,'← Back','#555');
  }

  /* ═══════════════════════════════════════════════════
     DUEL SETUP
  ═══════════════════════════════════════════════════ */
  _setupClick(x,y) {
    const {W,H}=this;
    Object.keys(BOT_DEFS).forEach((k,i)=>{const bx=W*(0.05+i*0.235),by=H*0.25,bw=W*0.21,bh=H*0.09;if(x>=bx&&x<=bx+bw&&y>=by&&y<=by+bh)this.duelCfg.opponent=k;});
    Object.keys(MAPS_DEF).forEach((k,i)=>{const bx=W*(0.05+i*0.31),by=H*0.46,bw=W*0.27,bh=H*0.09;if(x>=bx&&x<=bx+bw&&y>=by&&y<=by+bh)this.duelCfg.map=k;});
    this.owned.forEach((k,i)=>{const bx=W*(0.04+i*0.19),by=H*0.66,bw=W*0.16,bh=H*0.09;if(x>=bx&&x<=bx+bw&&y>=by&&y<=by+bh)this.duelCfg.gun=k;});
    if(x>=W*0.3&&x<=W*0.7&&y>=H*0.82&&y<=H*0.92) this._startDuel();
    if(x<=W*0.15&&y<=H*0.1) this._goHub();
  }

  _drawSetup() {
    const {ctx:c,W,H}=this;
    c.fillStyle='#0a0a1a';c.fillRect(0,0,W,H);
    c.textAlign='center'; c.fillStyle='#fff'; c.font=`bold ${H*0.055}px sans-serif`; c.fillText('⚔️  Duel Setup',W/2,H*0.1);
    c.fillStyle='#aaa';c.font=`${H*0.032}px sans-serif`;c.fillText('Opponent',W/2,H*0.21);
    Object.keys(BOT_DEFS).forEach((k,i)=>{const bx=W*(0.05+i*0.235),by=H*0.25,bw=W*0.21,bh=H*0.09,sel=this.duelCfg.opponent===k;c.fillStyle=sel?'#2a1a4a':'#12122a';this._rr(bx,by,bw,bh,7);c.strokeStyle=sel?'#7c3aed':'#333';c.lineWidth=2;this._rr(bx,by,bw,bh,7,true);c.textAlign='center';c.fillStyle=sel?'#fff':'#aaa';c.font=`${H*0.028}px sans-serif`;c.fillText(BOT_DEFS[k].label,bx+bw/2,by+bh*0.62);});
    c.textAlign='center';c.fillStyle='#aaa';c.font=`${H*0.032}px sans-serif`;c.fillText('Map',W/2,H*0.42);
    Object.keys(MAPS_DEF).forEach((k,i)=>{const bx=W*(0.05+i*0.31),by=H*0.46,bw=W*0.27,bh=H*0.09,sel=this.duelCfg.map===k;c.fillStyle=sel?'#1a2a4a':'#12122a';this._rr(bx,by,bw,bh,7);c.strokeStyle=sel?'#2563eb':'#333';c.lineWidth=2;this._rr(bx,by,bw,bh,7,true);c.textAlign='center';c.fillStyle=sel?'#fff':'#aaa';c.font=`${H*0.032}px sans-serif`;c.fillText(MAPS_DEF[k].name,bx+bw/2,by+bh*0.62);});
    c.textAlign='center';c.fillStyle='#aaa';c.font=`${H*0.032}px sans-serif`;c.fillText('Your Weapon',W/2,H*0.62);
    this.owned.forEach((k,i)=>{const g=GUNS[k],bx=W*(0.04+i*0.19),by=H*0.66,bw=W*0.16,bh=H*0.09,sel=this.duelCfg.gun===k;c.fillStyle=sel?'#1a3a2a':'#12122a';this._rr(bx,by,bw,bh,7);c.strokeStyle=sel?'#22c55e':'#333';c.lineWidth=2;this._rr(bx,by,bw,bh,7,true);c.textAlign='center';c.fillStyle=sel?'#fff':'#aaa';c.font=`${H*0.028}px sans-serif`;c.fillText(g.emoji,bx+bw/2,by+bh*0.45);c.font=`${H*0.022}px sans-serif`;c.fillText(g.name,bx+bw/2,by+bh*0.78);});
    this._btn(W*0.3,H*0.82,W*0.4,H*0.1,'🎮 Start Duel!','#7c3aed');
    c.textAlign='left';c.fillStyle='#888';c.font=`${H*0.03}px sans-serif`;c.fillText('← Hub',W*0.03,H*0.07);
  }

  /* ═══════════════════════════════════════════════════
     DUEL 3D — INIT
  ═══════════════════════════════════════════════════ */
  _startDuel() {
    this.screen='duel'; this.gameOver=false;
    this.playerKills=0; this.botKills=0;
    this.particles=[]; this._zBuf=new Float32Array(this.W).fill(Infinity);

    this._mapGrid = getGrid(this.duelCfg.map);

    const gKey=this.duelCfg.gun, gDef=GUNS[gKey];
    const bDef=BOT_DEFS[this.duelCfg.opponent];
    const bGunKey=this._pickBotGun();

    this.player3d = {
      x:2.5, y:MC/2, angle:0,
      hp:100, maxHp:100,
      gun:this._mkGun(gDef),
      speed:4.2, turnSpd:2.5,
    };
    this.bot3d = {
      x:MC-2.5, y:MC/2, angle:Math.PI,
      hp:100, maxHp:100,
      gun:this._mkGun(GUNS[bGunKey]),
      speed:bDef.speed*1.6,
      accuracy:bDef.accuracy, reaction:bDef.reaction,
      label:bDef.label,
      reactionTimer:0, strafeDir:1, strafeTimer:0,
    };

    this._dmgFlash=0; this._muzzleFlash=0; this._hitMark=0;
    this._duelStartTime=Date.now();
  }

  _mkGun(def) { return {def, ammo:def.ammo, reloading:false, reloadTimer:0, fireTimer:0}; }
  _pickBotGun() { return ['pistol','shotgun','smg','rifle'][Math.floor(Math.random()*4)]; }

  /* ═══════════════════════════════════════════════════
     DUEL 3D — UPDATE
  ═══════════════════════════════════════════════════ */
  _updateDuel(dt) {
    this._movePlayer3D(dt);
    this._moveBot3D(dt);
    this._botAI3D(dt);
    this._gunTick(this.player3d.gun, dt);
    this._gunTick(this.bot3d.gun,    dt);
    if (this.mouse.down && !this.player3d.gun.reloading && this.player3d.gun.fireTimer<=0)
      this._playerShoot3D();
  }

  _isWall(gx, gy) {
    if (gx<0||gy<0||gx>=MC||gy>=MC) return true;
    return this._mapGrid[gy][gx]===1;
  }

  _movePlayer3D(dt) {
    const p=this.player3d;
    // Look with mouse delta or touch swipe
    p.angle += (this.mouse.dx + this.touch.dx) * 0.004;

    const sin=Math.sin(p.angle), cos=Math.cos(p.angle);
    const sp=p.speed;
    let mx=0, my=0;

    if (this.keys['w']||this.keys['arrowup'])    { mx+=cos; my+=sin; }
    if (this.keys['s']||this.keys['arrowdown'])  { mx-=cos; my-=sin; }
    if (this.keys['a']||this.keys['arrowleft'])  { mx+=sin; my-=cos; }
    if (this.keys['d']||this.keys['arrowright']) { mx-=sin; my+=cos; }

    // Virtual joystick (touch)
    if (this.joy.active) {
      const mag=Math.hypot(this.joy.jx,this.joy.jy)||1;
      const jn={ x:this.joy.jx/mag, y:this.joy.jy/mag };
      mx += jn.x*cos + jn.y*sin;
      my += jn.x*sin - jn.y*cos;
    }

    const len=Math.hypot(mx,my)||1;
    const nx=p.x+(mx/len)*sp*dt, ny=p.y+(my/len)*sp*dt;
    const pad=0.35;
    if (mx!==0&&!this._isWall(Math.floor(nx),Math.floor(p.y))&&nx>pad&&nx<MC-pad) p.x=nx;
    if (my!==0&&!this._isWall(Math.floor(p.x),Math.floor(ny))&&ny>pad&&ny<MC-pad) p.y=ny;
  }

  _moveBot3D(dt) {
    const b=this.bot3d, p=this.player3d;
    const dx=p.x-b.x, dy=p.y-b.y, dist=Math.hypot(dx,dy)||1;
    b.angle=Math.atan2(dy,dx);

    b.strafeTimer+=dt;
    if(b.strafeTimer>1.8){b.strafeDir*=-1;b.strafeTimer=0;}

    const ideal=5;
    let mx=0,my=0;
    if(dist>ideal+1){mx=dx/dist;my=dy/dist;}
    else if(dist<ideal-1){mx=-dx/dist;my=-dy/dist;}
    mx+=(-dy/dist)*b.strafeDir*0.5;
    my+=(dx/dist)*b.strafeDir*0.5;
    const len=Math.hypot(mx,my)||1;
    const nx=b.x+(mx/len)*b.speed*dt, ny=b.y+(my/len)*b.speed*dt;
    const pad=0.35;
    if(!this._isWall(Math.floor(nx),Math.floor(b.y))&&nx>pad&&nx<MC-pad) b.x=nx;
    if(!this._isWall(Math.floor(b.x),Math.floor(ny))&&ny>pad&&ny<MC-pad) b.y=ny;
  }

  _botAI3D(dt) {
    const b=this.bot3d, p=this.player3d;
    b.reactionTimer-=dt*1000;
    if(b.reactionTimer<=0&&!b.gun.reloading&&b.gun.fireTimer<=0){
      b.reactionTimer=b.reaction+(Math.random()-0.5)*100;
      if(this._hasLOS(b.x,b.y,p.x,p.y)&&Math.random()<b.accuracy) this._botShoot3D();
    }
  }

  _hasLOS(x0,y0,x1,y1) {
    const dx=x1-x0,dy=y1-y0,steps=Math.ceil(Math.hypot(dx,dy)*5);
    for(let i=1;i<steps;i++){if(this._isWall(Math.floor(x0+dx*i/steps),Math.floor(y0+dy*i/steps)))return false;}
    return true;
  }

  /* ═══════════════════════════════════════════════════
     SHOOTING
  ═══════════════════════════════════════════════════ */
  _gunTick(gun, dt) {
    if(gun.fireTimer>0) gun.fireTimer-=dt;
    if(gun.reloading){ gun.reloadTimer-=dt; if(gun.reloadTimer<=0){gun.reloading=false;gun.ammo=gun.def.ammo;} }
  }

  _reload(gun) { if(!gun.reloading){gun.reloading=true;gun.reloadTimer=gun.def.reload;} }

  _playerShoot3D() {
    const p=this.player3d, gun=p.gun;
    if(gun.ammo<=0){this._reload(gun);return;}
    gun.ammo--; gun.fireTimer=60/gun.def.rpm;
    this._muzzleFlash=0.1;

    // Hit check: is bot in crosshair?
    const b=this.bot3d;
    const dx=b.x-p.x,dy=b.y-p.y,dist=Math.hypot(dx,dy)||1;
    let rel=Math.atan2(dy,dx)-p.angle;
    while(rel>Math.PI)rel-=Math.PI*2; while(rel<-Math.PI)rel+=Math.PI*2;
    const FOV=Math.PI/3;
    const sX=(0.5+rel/FOV)*this.W;
    const hitZone=this.W*(0.1+0.08/dist);
    const hasLOS=this._hasLOS(p.x,p.y,b.x,b.y);

    if(Math.abs(sX-this.W/2)<hitZone&&hasLOS&&b.hp>0){
      let dmg=gun.def.dmg;
      if(gun.def.pellets>1){let h=0;for(let i=0;i<gun.def.pellets;i++)if(Math.random()<0.65)h++;dmg=gun.def.dmg*h;}
      b.hp=Math.max(0,b.hp-dmg);
      this._hitMark=0.35;
      this._spawnHit(b.x*this.W/MC, b.y*this.H/MC);
      if(b.hp<=0) this._kill('player');
    }
    if(gun.ammo===0) this._reload(gun);
  }

  _botShoot3D() {
    const b=this.bot3d,gun=b.gun;
    if(gun.ammo<=0){this._reload(gun);return;}
    gun.ammo--; gun.fireTimer=60/gun.def.rpm;
    const p=this.player3d;
    p.hp=Math.max(0,p.hp-gun.def.dmg);
    this._dmgFlash=0.5;
    if(p.hp<=0) this._kill('bot');
    if(gun.ammo===0) this._reload(gun);
  }

  _spawnHit(x,y) {
    for(let i=0;i<10;i++){const a=Math.random()*Math.PI*2,sp=60+Math.random()*100;this.particles.push({x,y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,r:4,life:0.4+Math.random()*0.2,age:0,color:'#f59e0b'});}
  }

  _kill(who) {
    if(who==='player'){
      this.playerKills++;this.stats.kills++;
      setTimeout(()=>{this.bot3d.hp=100;this.bot3d.x=MC-2.5;this.bot3d.y=MC/2;},1000);
    } else {
      this.botKills++;this.stats.deaths++;
      setTimeout(()=>{this.player3d.hp=100;this.player3d.x=2.5;this.player3d.y=MC/2;},1000);
    }
    if(this.playerKills>=this.killGoal||this.botKills>=this.killGoal){
      const won=this.playerKills>=this.killGoal;
      if(won){this.stats.wins++;this.coins+=150;}else{this.stats.losses++;this.coins+=25;}
      this._save();
      this._duelResult={won,pkills:this.playerKills,bkills:this.botKills};
      setTimeout(()=>{this.screen='results';},1500);
      this.gameOver=true;
    }
  }

  /* ═══════════════════════════════════════════════════
     RAYCASTER
  ═══════════════════════════════════════════════════ */
  _castRay(px,py,angle) {
    const rdx=Math.cos(angle), rdy=Math.sin(angle);
    let mx=Math.floor(px), my=Math.floor(py);
    const ddx=Math.abs(rdx)<1e-10?1e30:Math.abs(1/rdx);
    const ddy=Math.abs(rdy)<1e-10?1e30:Math.abs(1/rdy);
    let sx,sy,stepx,stepy,side=0;
    if(rdx<0){stepx=-1;sx=(px-mx)*ddx;}else{stepx=1;sx=(mx+1-px)*ddx;}
    if(rdy<0){stepy=-1;sy=(py-my)*ddy;}else{stepy=1;sy=(my+1-py)*ddy;}
    for(let i=0;i<40;i++){
      if(sx<sy){sx+=ddx;mx+=stepx;side=0;}else{sy+=ddy;my+=stepy;side=1;}
      if(mx<0||my<0||mx>=MC||my>=MC||this._mapGrid[my][mx]) break;
    }
    const dist=side===0?(mx-px+(1-stepx)/2)/rdx:(my-py+(1-stepy)/2)/rdy;
    return {dist:Math.max(0.05,dist),side};
  }

  /* ═══════════════════════════════════════════════════
     DUEL 3D — DRAW
  ═══════════════════════════════════════════════════ */
  _drawDuel3D() {
    const {ctx:c,W,H}=this;
    const p=this.player3d, b=this.bot3d;
    const FOV=Math.PI/3, halfFOV=FOV/2;
    const HALF=H/2;

    // Sky
    const sky=c.createLinearGradient(0,0,0,HALF);
    sky.addColorStop(0,'#060610'); sky.addColorStop(1,'#111133');
    c.fillStyle=sky; c.fillRect(0,0,W,HALF);

    // Floor with perspective grid
    const fl=c.createLinearGradient(0,HALF,0,H);
    fl.addColorStop(0,'#1c1c1c'); fl.addColorStop(1,'#080808');
    c.fillStyle=fl; c.fillRect(0,HALF,W,HALF);

    // Floor grid lines
    c.strokeStyle='rgba(100,100,100,0.25)'; c.lineWidth=0.5;
    for(let row=1;row<=12;row++){const t=row/12;const y=HALF+(HALF)*t;c.beginPath();c.moveTo(0,y);c.lineTo(W,y);c.stroke();}
    for(let col=0;col<=8;col++){const t=col/8;const vanX=W/2;const y1=HALF,y2=H;const x1=vanX+(t-0.5)*W*0.4;const x2=vanX+(t-0.5)*W*4;c.beginPath();c.moveTo(x1,y1);c.lineTo(x2,y2);c.stroke();}

    // Wall columns (raycasting)
    const mapDef=MAPS_DEF[this.duelCfg.map];
    const wR=mapDef.wallR,wG=mapDef.wallG,wB=mapDef.wallB;
    this._zBuf.fill(Infinity);

    for(let col=0;col<W;col++){
      const ray=p.angle-halfFOV+(col/W)*FOV;
      const {dist,side}=this._castRay(p.x,p.y,ray);
      const perp=Math.max(0.05,dist*Math.cos(ray-p.angle));
      this._zBuf[col]=perp;
      const lineH=Math.min(H*4, H/perp);
      const top=(H-lineH)/2;
      const sh=(side===0?1.0:0.6)*Math.max(0.07,1-perp/16);
      c.fillStyle=`rgb(${Math.floor(wR*sh)},${Math.floor(wG*sh)},${Math.floor(wB*sh)})`;
      c.fillRect(col,top,1,lineH);
      // floor/ceiling tint at wall base for depth
      c.fillStyle=`rgba(0,0,0,${Math.min(0.7,perp/15)})`;
      c.fillRect(col,top+lineH,1,H-top-lineH);
    }

    // Bot sprite (billboard)
    if(b.hp>0) this._drawBotSprite3D();

    // Damage flash
    if(this._dmgFlash>0){
      this._dmgFlash-=1/60;
      c.fillStyle=`rgba(220,0,0,${Math.min(0.45,this._dmgFlash)})`;
      c.fillRect(0,0,W,H);
      // Vignette
      const vg=c.createRadialGradient(W/2,H/2,H*0.3,W/2,H/2,H*0.8);
      vg.addColorStop(0,'rgba(0,0,0,0)'); vg.addColorStop(1,`rgba(200,0,0,${this._dmgFlash*0.6})`);
      c.fillStyle=vg; c.fillRect(0,0,W,H);
    }

    // Muzzle flash
    if(this._muzzleFlash>0){
      this._muzzleFlash-=1/60;
      const mf=c.createRadialGradient(W/2,H*0.7,0,W/2,H*0.7,W*0.2);
      mf.addColorStop(0,`rgba(255,220,80,${this._muzzleFlash*5})`);
      mf.addColorStop(1,'rgba(255,180,0,0)');
      c.fillStyle=mf; c.fillRect(W/2-W*0.2,H*0.5,W*0.4,H*0.4);
    }

    // Weapon model (bottom right)
    this._drawWeaponModel();

    // Crosshair
    const cx=W/2,cy=H/2;
    const hcol=this._hitMark>0?'#ff4444':'rgba(255,255,255,0.9)';
    if(this._hitMark>0)this._hitMark-=1/60;
    c.strokeStyle=hcol; c.lineWidth=1.5;
    c.beginPath();c.moveTo(cx-14,cy);c.lineTo(cx-5,cy);c.moveTo(cx+5,cy);c.lineTo(cx+14,cy);
    c.moveTo(cx,cy-14);c.lineTo(cx,cy-5);c.moveTo(cx,cy+5);c.lineTo(cx,cy+14);c.stroke();
    c.strokeStyle=hcol; c.lineWidth=1; c.beginPath();c.arc(cx,cy,3,0,Math.PI*2);c.stroke();

    this._drawDuelHUD3D();
    this._drawMinimap();

    // virtual joystick visual on mobile
    if(this.joy.active){
      c.fillStyle='rgba(255,255,255,0.12)';
      c.beginPath();c.arc(this.joy.ox,this.joy.oy,50,0,Math.PI*2);c.fill();
      c.fillStyle='rgba(255,255,255,0.3)';
      c.beginPath();c.arc(this.joy.ox+this.joy.jx,this.joy.oy+this.joy.jy,24,0,Math.PI*2);c.fill();
    }

    if(this.gameOver){c.fillStyle='rgba(0,0,0,0.45)';c.fillRect(0,0,W,H);}
  }

  _drawWeaponModel() {
    const {ctx:c,W,H}=this;
    const gun=this.player3d.gun.def;
    const t=Date.now()*0.003;
    const bob=Math.sin(t)*3;
    const ox=W*0.72, oy=H*0.62+bob;
    const s=H*0.25;
    c.save(); c.translate(ox,oy);
    // simple gun silhouette
    c.fillStyle='#555';
    c.fillRect(0,s*0.1,s*0.7,s*0.22);      // barrel
    c.fillRect(s*0.05,s*0.28,s*0.4,s*0.5); // body
    c.fillRect(s*0.15,s*0.73,s*0.2,s*0.35);// grip
    c.fillStyle='#777';
    c.fillRect(0,s*0.15,s*0.72,s*0.06);    // barrel top
    c.fillStyle=gun.color||'#aaa';
    c.fillRect(s*0.05,s*0.3,s*0.38,s*0.08);// color accent
    c.restore();
    // ammo
    c.textAlign='right'; c.fillStyle='#fff'; c.font=`bold ${H*0.038}px sans-serif`;
    const g=this.player3d.gun;
    c.fillText(g.reloading?`↺ ${g.reloadTimer.toFixed(1)}s`:`${g.ammo}/${g.def.ammo}`,W-14,H-14);
  }

  _drawBotSprite3D() {
    const {ctx:c,W,H}=this;
    const p=this.player3d,b=this.bot3d;
    const FOV=Math.PI/3;
    const dx=b.x-p.x,dy=b.y-p.y,dist=Math.hypot(dx,dy)||0.01;

    let rel=Math.atan2(dy,dx)-p.angle;
    while(rel>Math.PI)rel-=Math.PI*2;while(rel<-Math.PI)rel+=Math.PI*2;
    if(Math.abs(rel)>FOV*0.65)return;

    const sX=(0.5+rel/FOV)*W;
    const sH=Math.min(H*3,H*2.4/dist);
    const sW=sH*0.55;
    const top=(H-sH)/2;

    const sc=Math.max(0,Math.floor(sX-sW/2)), ec=Math.min(W-1,Math.floor(sX+sW/2));
    for(let col=sc;col<=ec;col++){
      if(dist<this._zBuf[col]) {
        const tx=(col-(sX-sW/2))/sW;
        this._avatarCol(col,top,sH,tx,b.hp<=0);
      }
    }

    // HP bar over bot
    if(dist<14){
      const bw=sW*0.85,bx=sX-bw/2,by=top-12;
      c.fillStyle='#333';c.fillRect(bx,by,bw,6);
      c.fillStyle=b.hp>50?'#22c55e':'#ef4444';c.fillRect(bx,by,bw*(b.hp/100),6);
    }
    // label
    if(dist<10){
      c.textAlign='center';c.fillStyle='#fff';c.font=`${H*0.025}px sans-serif`;
      c.fillText(b.label,sX,top-16);
    }
  }

  _avatarCol(screenX, top, sH, tx, dead) {
    const c=this.ctx;
    const hairEnd=top+sH*0.14;
    const headEnd=top+sH*0.36;
    const bodyEnd=top+sH*0.70;
    const legEnd =top+sH;

    if(tx<0.12||tx>0.88)return;

    if(dead){ c.fillStyle='rgba(80,80,80,0.8)'; c.fillRect(screenX,top,1,sH); return; }

    // Hair zone
    c.fillStyle='#1a0a00'; c.fillRect(screenX,top,1,hairEnd-top);
    // Head
    c.fillStyle='#C68642'; c.fillRect(screenX,hairEnd,1,headEnd-hairEnd);
    // Eyes
    if(tx>0.25&&tx<0.43){ c.fillStyle='#111'; c.fillRect(screenX,top+sH*0.2,1,sH*0.06); }
    if(tx>0.57&&tx<0.75){ c.fillStyle='#111'; c.fillRect(screenX,top+sH*0.2,1,sH*0.06); }
    // Body / shirt (enemy red)
    c.fillStyle='#c0392b'; c.fillRect(screenX,headEnd,1,bodyEnd-headEnd);
    // Neck detail
    if(tx>0.35&&tx<0.65){ c.fillStyle='#a0522d'; c.fillRect(screenX,headEnd,1,sH*0.04); }
    // Legs
    const legCol=tx<0.5?'#1a237e':'#283593';
    c.fillStyle=legCol; c.fillRect(screenX,bodyEnd,1,legEnd-bodyEnd);
    // Boots
    c.fillStyle='#111'; c.fillRect(screenX,bodyEnd+sH*0.22,1,sH*0.08);
  }

  _drawDuelHUD3D() {
    const {ctx:c,W,H}=this;
    const p=this.player3d;

    // Score bar top
    c.fillStyle='rgba(0,0,0,0.55)'; c.fillRect(W/2-70,6,140,40);
    c.textAlign='center'; c.fillStyle='#fff'; c.font=`bold ${H*0.047}px sans-serif`;
    c.fillText(`${this.playerKills}  —  ${this.botKills}`,W/2,36);
    c.fillStyle='#aaa'; c.font=`${H*0.022}px sans-serif`;
    c.fillText(`First to ${this.killGoal}`,W/2,52);

    // HP bar bottom left
    const bw=W*0.22,bx=12,by=H-26;
    c.fillStyle='rgba(0,0,0,0.55)'; c.fillRect(bx-2,H-42,bw+4,38);
    c.fillStyle='#333'; c.fillRect(bx,by,bw,10);
    c.fillStyle=p.hp>50?'#22c55e':p.hp>25?'#f59e0b':'#ef4444';
    c.fillRect(bx,by,bw*(p.hp/p.maxHp),10);
    c.fillStyle='#fff'; c.font=`${H*0.028}px sans-serif`; c.textAlign='left';
    c.fillText(`❤️ ${p.hp}`,bx,H-30);

    // Controls (first 7s)
    const elapsed=(Date.now()-this._duelStartTime)/1000;
    if(elapsed<8){
      const al=Math.max(0,1-(elapsed-6)/2);
      c.fillStyle=`rgba(255,255,255,${al*0.75})`;
      c.textAlign='center'; c.font=`${H*0.026}px sans-serif`;
      c.fillText('WASD / D-pad to move  •  Mouse/drag to look  •  Click/Tap to shoot',W/2,H*0.88);
    }
  }

  _drawMinimap() {
    const {ctx:c,W,H}=this;
    const SZ=Math.floor(W*0.14), CELL=SZ/MC, ox=W-SZ-10,oy=10;
    c.fillStyle='rgba(0,0,0,0.65)'; c.fillRect(ox,oy,SZ,SZ);
    for(let row=0;row<MC;row++) for(let col=0;col<MC;col++){
      if(this._mapGrid[row][col]){
        const m=MAPS_DEF[this.duelCfg.map];
        c.fillStyle=`rgba(${m.wallR},${m.wallG},${m.wallB},0.65)`;
        c.fillRect(ox+col*CELL,oy+row*CELL,CELL,CELL);
      }
    }
    const p=this.player3d,b=this.bot3d;
    c.fillStyle='#7c3aed'; c.beginPath(); c.arc(ox+p.x*CELL,oy+p.y*CELL,CELL*0.8,0,Math.PI*2); c.fill();
    c.strokeStyle='#a78bfa'; c.lineWidth=1; c.beginPath();
    c.moveTo(ox+p.x*CELL,oy+p.y*CELL);
    c.lineTo(ox+(p.x+Math.cos(p.angle)*2.5)*CELL,oy+(p.y+Math.sin(p.angle)*2.5)*CELL); c.stroke();
    if(b.hp>0){c.fillStyle='#e74c3c'; c.beginPath(); c.arc(ox+b.x*CELL,oy+b.y*CELL,CELL*0.8,0,Math.PI*2); c.fill();}
  }

  /* ═══════════════════════════════════════════════════
     RESULTS / STATS
  ═══════════════════════════════════════════════════ */
  _drawResults() {
    const {ctx:c,W,H}=this; const r=this._duelResult||{won:false,pkills:0,bkills:0};
    c.fillStyle='#0a0a1a';c.fillRect(0,0,W,H);
    c.textAlign='center';
    c.shadowColor=r.won?'#f59e0b':'#e74c3c'; c.shadowBlur=30;
    c.fillStyle=r.won?'#f59e0b':'#e74c3c'; c.font=`bold ${H*0.1}px sans-serif`;
    c.fillText(r.won?'Victory!':'Defeat',W/2,H*0.28); c.shadowBlur=0;
    c.fillStyle='#fff'; c.font=`${H*0.045}px sans-serif`;
    c.fillText(`${r.pkills}  —  ${r.bkills}`,W/2,H*0.43);
    c.fillStyle='#aaa'; c.font=`${H*0.03}px sans-serif`;
    c.fillText('Your kills — Bot kills',W/2,H*0.51);
    c.fillStyle='#4f4'; c.font=`bold ${H*0.04}px sans-serif`;
    c.fillText(`+🪙 ${r.won?150:25} coins  (Total: ${this.coins})`,W/2,H*0.63);
    this._btn(W*0.3,H*0.76,W*0.4,H*0.11,'🏠 Back to Hub','#7c3aed');
  }

  _drawStats() {
    const {ctx:c,W,H}=this; const s=this.stats;
    c.fillStyle='#0a0a1a';c.fillRect(0,0,W,H);
    c.textAlign='center'; c.fillStyle='#f59e0b'; c.font=`bold ${H*0.06}px sans-serif`;
    c.fillText('📊 Your Stats',W/2,H*0.12);
    [['Wins',s.wins],['Losses',s.losses],['Kills',s.kills],['Deaths',s.deaths],['K/D',s.deaths>0?(s.kills/s.deaths).toFixed(2):s.kills],['Coins','🪙 '+this.coins]].forEach(([k,v],i)=>{
      const y=H*(0.23+i*0.1); c.fillStyle='#aaa'; c.font=`${H*0.034}px sans-serif`; c.textAlign='right';
      c.fillText(k,W*0.42,y); c.fillStyle='#fff'; c.textAlign='left'; c.fillText(v,W*0.47,y);
    });
    this._btn(W*0.3,H*0.86,W*0.4,H*0.1,'← Back','#555');
  }

  /* ═══════════════════════════════════════════════════
     PARTICLES
  ═══════════════════════════════════════════════════ */
  _updateParticles(dt) {
    this.particles.forEach(p=>{p.x+=p.vx*dt;p.y+=p.vy*dt;p.age+=dt;p.vx*=0.94;p.vy*=0.94;});
    this.particles=this.particles.filter(p=>p.age<p.life);
  }

  _drawParticles() {
    const c=this.ctx;
    this.particles.forEach(p=>{const a=1-p.age/p.life;c.globalAlpha=a;c.fillStyle=p.color;c.beginPath();c.arc(p.x,p.y,p.r*a,0,Math.PI*2);c.fill();});
    c.globalAlpha=1;
  }

  /* ═══════════════════════════════════════════════════
     MAIN DRAW DISPATCH
  ═══════════════════════════════════════════════════ */
  _draw() {
    switch(this.screen){
      case 'hub':          this._drawHub();         break;
      case 'range':        this._drawRange();        break;
      case 'range_result': this._drawRangeResult();  break;
      case 'shop':         this._drawShop();         break;
      case 'duel_setup':   this._drawSetup();        break;
      case 'duel':         this._drawDuel3D();       break;
      case 'results':      this._drawResults();      break;
      case 'stats':        this._drawStats();        break;
    }
  }

  /* ═══════════════════════════════════════════════════
     HELPERS
  ═══════════════════════════════════════════════════ */
  _rr(x,y,w,h,r,stroke=false) {
    const c=this.ctx; c.beginPath();
    c.moveTo(x+r,y);c.lineTo(x+w-r,y);c.arcTo(x+w,y,x+w,y+r,r);
    c.lineTo(x+w,y+h-r);c.arcTo(x+w,y+h,x+w-r,y+h,r);
    c.lineTo(x+r,y+h);c.arcTo(x,y+h,x,y+h-r,r);
    c.lineTo(x,y+r);c.arcTo(x,y,x+r,y,r);c.closePath();
    if(stroke)c.stroke();else c.fill();
  }

  _btn(x,y,w,h,label,color) {
    const c=this.ctx;
    const hov=this.mouse.x>=x&&this.mouse.x<=x+w&&this.mouse.y>=y&&this.mouse.y<=y+h;
    c.fillStyle=hov?color+'dd':color+'88'; this._rr(x,y,w,h,8);
    c.strokeStyle=color;c.lineWidth=2;this._rr(x,y,w,h,8,true);
    c.textAlign='center';c.fillStyle='#fff';c.font=`bold ${this.H*0.035}px sans-serif`;
    c.fillText(label,x+w/2,y+h*0.63);
  }
}
