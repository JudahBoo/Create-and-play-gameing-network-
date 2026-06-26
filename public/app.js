'use strict';

// ── State ──────────────────────────────────────────────────────────────────
const state = {
  apiKey: '',
  provider: 'groq',
  library: [],   // { id, description, code, icon, createdAt }
  currentGame: null
};

// ── DOM refs ───────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);

const apiKeyInput   = $('apiKeyInput');
const providerSelect= $('providerSelect');
const saveKeyBtn    = $('saveKeyBtn');
const toggleKeyBtn  = $('toggleKey');
const keyStatus     = $('keyStatus');
const descInput     = $('descriptionInput');
const charCount     = $('charCount');
const generateBtn   = $('generateBtn');
const generateText  = $('generateBtnText');
const generateSpinner=$('generateBtnSpinner');
const errorMsg      = $('errorMsg');
const gameCard      = $('gameCard');
const gameFrame     = $('gameFrame');
const gameTitle     = $('gameTitle');
const gameDesc      = $('gameDescription');
const fullscreenBtn = $('fullscreenBtn');
const downloadBtn   = $('downloadBtn');
const regenerateBtn = $('regenerateBtn');
const libraryCard   = $('libraryCard');
const libraryGrid   = $('libraryGrid');
const libraryCount  = $('libraryCount');

// ── Init ───────────────────────────────────────────────────────────────────
function init() {
  // Restore saved key and provider
  const savedKey = localStorage.getItem('cpgn_api_key') || '';
  const savedProvider = localStorage.getItem('cpgn_provider') || 'groq';

  if (savedKey) {
    state.apiKey = savedKey;
    apiKeyInput.value = savedKey;
    showKeyStatus('Key loaded ✓', 'ok');
  }

  providerSelect.value = savedProvider;
  state.provider = savedProvider;

  // Restore library
  try {
    const lib = JSON.parse(localStorage.getItem('cpgn_library') || '[]');
    state.library = lib;
    renderLibrary();
  } catch { /* ignore */ }

  attachListeners();
}

// ── Listeners ──────────────────────────────────────────────────────────────
function attachListeners() {
  // API key
  saveKeyBtn.addEventListener('click', saveKey);
  apiKeyInput.addEventListener('keydown', e => { if (e.key === 'Enter') saveKey(); });
  toggleKeyBtn.addEventListener('click', () => {
    apiKeyInput.type = apiKeyInput.type === 'password' ? 'text' : 'password';
  });
  providerSelect.addEventListener('change', () => {
    state.provider = providerSelect.value;
    localStorage.setItem('cpgn_provider', state.provider);
  });

  // Textarea counter
  descInput.addEventListener('input', () => {
    charCount.textContent = `${descInput.value.length} / 2000`;
  });

  // Example chips
  document.querySelectorAll('.example-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      descInput.value = btn.dataset.desc;
      charCount.textContent = `${descInput.value.length} / 2000`;
      descInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  });

  // Generate
  generateBtn.addEventListener('click', handleGenerate);
  descInput.addEventListener('keydown', e => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleGenerate();
  });

  // Game actions
  fullscreenBtn.addEventListener('click', toggleFullscreen);
  downloadBtn.addEventListener('click', downloadGame);
  regenerateBtn.addEventListener('click', () => handleGenerate(true));
}

// ── API Key ────────────────────────────────────────────────────────────────
function saveKey() {
  const key = apiKeyInput.value.trim();
  if (!key) {
    showKeyStatus('Please enter an API key.', 'bad');
    return;
  }
  state.apiKey = key;
  localStorage.setItem('cpgn_api_key', key);
  showKeyStatus('Key saved ✓', 'ok');
}

function showKeyStatus(msg, type) {
  keyStatus.textContent = msg;
  keyStatus.className = `key-status ${type}`;
}

// ── Generate ───────────────────────────────────────────────────────────────
async function handleGenerate(force = false) {
  const description = descInput.value.trim();
  if (!description) {
    showError('Please describe the game you want to create!');
    descInput.focus();
    return;
  }
  if (description.length < 10) {
    showError('Please give a bit more detail about your game.');
    return;
  }

  // Use saved key or prompt
  const key = state.apiKey || apiKeyInput.value.trim();
  if (!key) {
    showError('Please enter and save your free API key first (see the setup section above).');
    apiKeyInput.focus();
    return;
  }
  state.apiKey = key;

  setGenerating(true);
  hideError();
  showLoadingInFrame();

  try {
    const res = await fetch('/api/generate-game', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        description,
        apiKey: key,
        provider: state.provider
      })
    });

    const data = await res.json();

    if (!res.ok) throw new Error(data.error || 'Generation failed.');
    if (!data.gameCode) throw new Error('AI returned empty code. Please try again.');

    loadGame(data.gameCode, description);
    addToLibrary(description, data.gameCode);

  } catch (err) {
    hideLoadingInFrame();
    showError(err.message);
  } finally {
    setGenerating(false);
  }
}

// ── Game loading ───────────────────────────────────────────────────────────
function loadGame(code, description) {
  state.currentGame = { code, description };

  // Set iframe content
  const blob = new Blob([code], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  gameFrame.src = url;

  // Update header
  const titleWords = description.split(' ').slice(0, 6).join(' ');
  gameTitle.textContent = `🎮 ${titleWords}${description.split(' ').length > 6 ? '…' : ''}`;
  gameDesc.textContent = description;

  // Show game section
  gameCard.classList.remove('hidden');
  gameCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function showLoadingInFrame() {
  gameCard.classList.remove('hidden');

  const loadingHTML = `<!DOCTYPE html><html><head><style>
    body{margin:0;background:#07080f;display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;color:#64748b;}
    .wrap{text-align:center;display:flex;flex-direction:column;align-items:center;gap:20px;}
    .sp{width:52px;height:52px;border:3px solid #1e2340;border-top-color:#7c3aed;border-radius:50%;animation:s 0.9s linear infinite;}
    @keyframes s{to{transform:rotate(360deg)}}
    h2{color:#e2e8f0;font-size:1.1rem;margin:0;}
    .steps{display:flex;flex-direction:column;gap:6px;font-size:0.85rem;}
    .step{opacity:0;animation:fade 0.5s forwards;}
    .step:nth-child(1){animation-delay:0.3s}
    .step:nth-child(2){animation-delay:1.5s}
    .step:nth-child(3){animation-delay:3s}
    .step:nth-child(4){animation-delay:5s}
    @keyframes fade{to{opacity:1}}
  </style></head><body>
  <div class="wrap">
    <div class="sp"></div>
    <h2>Building your game with AI...</h2>
    <div class="steps">
      <div class="step">📖 Reading your description...</div>
      <div class="step">🎨 Designing characters &amp; world...</div>
      <div class="step">⚙️ Writing game mechanics...</div>
      <div class="step">🕹️ Almost ready to play!</div>
    </div>
  </div>
  </body></html>`;

  const blob = new Blob([loadingHTML], { type: 'text/html' });
  gameFrame.src = URL.createObjectURL(blob);
}

function hideLoadingInFrame() {
  gameCard.classList.add('hidden');
}

// ── UI helpers ─────────────────────────────────────────────────────────────
function setGenerating(on) {
  generateBtn.disabled = on;
  generateText.classList.toggle('hidden', on);
  generateSpinner.classList.toggle('hidden', !on);
}

function showError(msg) {
  errorMsg.textContent = msg;
  errorMsg.classList.remove('hidden');
  errorMsg.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function hideError() {
  errorMsg.classList.add('hidden');
}

// ── Game actions ───────────────────────────────────────────────────────────
function toggleFullscreen() {
  if (!state.currentGame) return;
  const win = window.open('', '_blank', 'width=900,height=620,menubar=no,toolbar=no');
  win.document.write(state.currentGame.code);
  win.document.close();
}

function downloadGame() {
  if (!state.currentGame) return;
  const blob = new Blob([state.currentGame.code], { type: 'text/html' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  const safeName = state.currentGame.description.slice(0, 30).replace(/[^a-z0-9]/gi, '-').toLowerCase();
  a.download = `${safeName}-game.html`;
  a.click();
}

// ── Library ────────────────────────────────────────────────────────────────
const GAME_ICONS = ['🎮','🕹️','🚀','🐉','⚔️','🧙','🏆','🌟','🎯','💥','🦸','🤖','🧟','🦕','🐱','🏰'];

function addToLibrary(description, code) {
  const icon = GAME_ICONS[state.library.length % GAME_ICONS.length];
  const entry = { id: Date.now(), description, code, icon, createdAt: new Date().toISOString() };
  state.library.unshift(entry);
  if (state.library.length > 20) state.library.pop(); // keep max 20
  try { localStorage.setItem('cpgn_library', JSON.stringify(state.library)); } catch { /* storage full */ }
  renderLibrary();
}

function renderLibrary() {
  if (state.library.length === 0) {
    libraryCard.classList.add('hidden');
    return;
  }

  libraryCard.classList.remove('hidden');
  libraryCount.textContent = state.library.length;

  libraryGrid.innerHTML = state.library.map(g => `
    <div class="library-item" data-id="${g.id}" title="${escapeHtml(g.description)}">
      <div class="library-item-icon">${g.icon}</div>
      <div class="library-item-desc">${escapeHtml(g.description)}</div>
      <div class="library-item-play">▶ Play again</div>
    </div>
  `).join('');

  libraryGrid.querySelectorAll('.library-item').forEach(el => {
    el.addEventListener('click', () => {
      const id = Number(el.dataset.id);
      const game = state.library.find(g => g.id === id);
      if (game) loadGame(game.code, game.description);
    });
  });
}

function escapeHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Featured games ─────────────────────────────────────────────────────────
const featuredCard     = $('featuredGameCard');
const featuredFrame    = $('featuredGameFrame');
const featuredTitle    = $('featuredGameTitle');
const featuredFSBtn    = $('featuredFullscreenBtn');
const featuredCloseBtn = $('featuredCloseBtn');

const TILE_NAMES = {
  'games/floppy-wing.html':   '🐦 Floppy Wing',
  'games/neon-snake.html':    '🐍 Neon Snake',
  'games/galaxy-raiders.html':'👾 Galaxy Raiders',
  'games/block-drop.html':    '🟦 Block Drop',
  'games/road-dash.html':     '🏃 Road Dash',
};

document.querySelectorAll('.featured-tile').forEach(tile => {
  tile.addEventListener('click', () => {
    const src = tile.dataset.src;
    openFeaturedGame(src, tile);
  });
});

function openFeaturedGame(src, activeTile) {
  // Highlight selected tile
  document.querySelectorAll('.featured-tile').forEach(t => t.classList.remove('active'));
  if (activeTile) activeTile.classList.add('active');

  featuredFrame.src = src;
  featuredTitle.textContent = TILE_NAMES[src] || 'Game';
  featuredCard.classList.remove('hidden');
  featuredCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

featuredFSBtn.addEventListener('click', () => {
  const src = featuredFrame.src;
  if (src) window.open(src, '_blank', 'width=700,height=620,menubar=no,toolbar=no');
});

featuredCloseBtn.addEventListener('click', () => {
  featuredCard.classList.add('hidden');
  featuredFrame.src = '';
  document.querySelectorAll('.featured-tile').forEach(t => t.classList.remove('active'));
});

// ── Boot ───────────────────────────────────────────────────────────────────
init();
