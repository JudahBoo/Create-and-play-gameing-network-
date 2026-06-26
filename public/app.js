'use strict';

// ── State ────────────────────────────────────────────────────────────────────────────────
const state = {
  apiKey: '',
  provider: 'groq',
  library: [],
  currentGame: null
};

// ── DOM refs ─────────────────────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);

const apiKeyInput    = $('apiKeyInput');
const providerSelect = $('providerSelect');
const saveKeyBtn     = $('saveKeyBtn');
const toggleKeyBtn   = $('toggleKey');
const keyStatus      = $('keyStatus');
const descInput      = $('descriptionInput');
const charCount      = $('charCount');
const generateBtn    = $('generateBtn');
const generateText   = $('generateBtnText');
const generateSpinner= $('generateBtnSpinner');
const errorMsg       = $('errorMsg');
const gameCard       = $('gameCard');
const gameFrame      = $('gameFrame');
const gameTitle      = $('gameTitle');
const gameDesc       = $('gameDescription');
const fullscreenBtn  = $('fullscreenBtn');
const downloadBtn    = $('downloadBtn');
const regenerateBtn  = $('regenerateBtn');
const libraryCard    = $('libraryCard');
const libraryGrid    = $('libraryGrid');
const libraryCount   = $('libraryCount');

// ── AI Prompt (same logic that was in server.js, now runs in browser) ──────
const SYSTEM_PROMPT = `You are an expert HTML5 game developer. Your ONLY job is to create a complete, playable browser game that EXACTLY matches what the user describes.

CRITICAL REQUIREMENTS:
1. Read the description carefully. Identify every element: characters, enemies, world/setting, mechanics, theme, story, and win/lose conditions.
2. The game MUST include ALL of those elements. If the user says "a wizard fighting dragons in space", the game must have a wizard player, dragon enemies, and a space background.
3. Return ONLY a complete, self-contained HTML file. No explanations, no markdown, no code fences. Just the HTML.
4. Use HTML5 Canvas for rendering. All CSS and JS must be inline in the single HTML file.
5. Show controls on screen so players know how to play.
6. Include: score display, game over screen, and a way to restart.
7. Make the game visually reflect the description's theme (colors, shapes, style).

The game must start with <!DOCTYPE html> and end with </html>. Return nothing else.`;

function buildUserMessage(description) {
  return `Create a complete HTML5 game based on this description:

"${description}"

Step 1 — Analyze the description and list out:
- Player character (name, appearance, abilities)
- Enemies or obstacles
- World/setting and visual theme
- Core gameplay mechanic (how the player wins)
- Any special items, power-ups, or events mentioned

Step 2 — Build the full game. Every item from Step 1 MUST be present in the game. The characters, enemies, setting, and mechanics must all match the description. Do not replace them with generic placeholders.

Return ONLY the complete HTML code, starting with <!DOCTYPE html>.`;
}

// ── Call AI directly from browser ──────────────────────────────────────────
async function callAI(description, apiKey, provider) {
  const userMessage = buildUserMessage(description);
  let url, headers, body;

  if (provider === 'groq') {
    url = 'https://api.groq.com/openai/v1/chat/completions';
    headers = { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' };
    body = {
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMessage }
      ],
      max_tokens: 8192,
      temperature: 0.8
    };
  } else if (provider === 'huggingface') {
    url = 'https://api-inference.huggingface.co/models/Qwen/Qwen2.5-72B-Instruct/v1/chat/completions';
    headers = { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' };
    body = {
      model: 'Qwen/Qwen2.5-72B-Instruct',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMessage }
      ],
      max_tokens: 4096,
      temperature: 0.8
    };
  } else if (provider === 'gemini') {
    url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    headers = { 'Content-Type': 'application/json' };
    body = {
      contents: [{ parts: [{ text: SYSTEM_PROMPT + '\n\n' + userMessage }] }],
      generationConfig: { maxOutputTokens: 8192, temperature: 0.8 }
    };
  } else {
    throw new Error(`Unknown provider: ${provider}`);
  }

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => response.statusText);
    if (response.status === 401) throw new Error('Invalid API key. Double-check your key and try again.');
    if (response.status === 429) throw new Error('Rate limit hit. Wait a moment and try again.');
    throw new Error(`AI error (${response.status}): ${errText.slice(0, 200)}`);
  }

  const data = await response.json();

  let text = '';
  if (provider === 'gemini') {
    text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  } else {
    text = data?.choices?.[0]?.message?.content || '';
  }

  return extractHTML(text);
}

function extractHTML(text) {
  let match = text.match(/<!DOCTYPE html[\s\S]*?<\/html>/i);
  if (match) return match[0];

  const fenceMatch = text.match(/```(?:html)?\n?([\s\S]*?)\n?```/i);
  if (fenceMatch) {
    const inner = fenceMatch[1];
    const innerDoc = inner.match(/<!DOCTYPE html[\s\S]*?<\/html>/i);
    if (innerDoc) return innerDoc[0];
    if (inner.includes('<canvas') || inner.includes('<script')) return inner;
  }

  const htmlTag = text.match(/<html[\s\S]*?<\/html>/i);
  if (htmlTag) return htmlTag[0];

  if (text.includes('<canvas') || (text.includes('<script') && text.includes('</script>'))) return text;

  throw new Error('The AI did not return valid game code. Try a more detailed description, or try again.');
}

// ── Init ────────────────────────────────────────────────────────────────────────────────
function init() {
  const savedKey      = localStorage.getItem('cpgn_api_key') || '';
  const savedProvider = localStorage.getItem('cpgn_provider') || 'groq';

  if (savedKey) {
    state.apiKey = savedKey;
    apiKeyInput.value = savedKey;
    showKeyStatus('Key loaded ✓', 'ok');
  }

  providerSelect.value = savedProvider;
  state.provider = savedProvider;

  try {
    state.library = JSON.parse(localStorage.getItem('cpgn_library') || '[]');
    renderLibrary();
  } catch { /* ignore */ }

  attachListeners();
}

// ── Listeners ───────────────────────────────────────────────────────────────────────────
function attachListeners() {
  saveKeyBtn.addEventListener('click', saveKey);
  apiKeyInput.addEventListener('keydown', e => { if (e.key === 'Enter') saveKey(); });
  toggleKeyBtn.addEventListener('click', () => {
    apiKeyInput.type = apiKeyInput.type === 'password' ? 'text' : 'password';
  });
  providerSelect.addEventListener('change', () => {
    state.provider = providerSelect.value;
    localStorage.setItem('cpgn_provider', state.provider);
  });

  descInput.addEventListener('input', () => {
    charCount.textContent = `${descInput.value.length} / 2000`;
  });

  document.querySelectorAll('.example-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      descInput.value = btn.dataset.desc;
      charCount.textContent = `${descInput.value.length} / 2000`;
      descInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  });

  generateBtn.addEventListener('click', handleGenerate);
  descInput.addEventListener('keydown', e => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleGenerate();
  });

  fullscreenBtn.addEventListener('click', toggleFullscreen);
  downloadBtn.addEventListener('click', downloadGame);
  regenerateBtn.addEventListener('click', () => handleGenerate(true));
}

// ── API Key ────────────────────────────────────────────────────────────────────────────────
function saveKey() {
  const key = apiKeyInput.value.trim();
  if (!key) { showKeyStatus('Please enter an API key.', 'bad'); return; }
  state.apiKey = key;
  localStorage.setItem('cpgn_api_key', key);
  showKeyStatus('Key saved ✓', 'ok');
}

function showKeyStatus(msg, type) {
  keyStatus.textContent = msg;
  keyStatus.className = `key-status ${type}`;
}

// ── Generate ─────────────────────────────────────────────────────────────────────────────
async function handleGenerate() {
  const description = descInput.value.trim();
  if (!description) { showError('Please describe the game you want to create!'); descInput.focus(); return; }
  if (description.length < 10) { showError('Please give a bit more detail about your game.'); return; }

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
    const gameCode = await callAI(description, key, state.provider);
    loadGame(gameCode, description);
    addToLibrary(description, gameCode);
  } catch (err) {
    hideLoadingInFrame();
    showError(err.message);
  } finally {
    setGenerating(false);
  }
}

// ── Game loading ───────────────────────────────────────────────────────────────────────
function loadGame(code, description) {
  state.currentGame = { code, description };
  const blob = new Blob([code], { type: 'text/html' });
  gameFrame.src = URL.createObjectURL(blob);

  const titleWords = description.split(' ').slice(0, 6).join(' ');
  gameTitle.textContent = `🎮 ${titleWords}${description.split(' ').length > 6 ? '…' : ''}`;
  gameDesc.textContent = description;

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
    .step{opacity:0;animation:fade 0.5s forwards;}
    .step:nth-child(1){animation-delay:0.3s}.step:nth-child(2){animation-delay:1.5s}
    .step:nth-child(3){animation-delay:3s}.step:nth-child(4){animation-delay:5s}
    @keyframes fade{to{opacity:1}}
  </style></head><body>
  <div class="wrap">
    <div class="sp"></div>
    <h2>Building your game with AI...</h2>
    <div>
      <div class="step">📖 Reading your description...</div>
      <div class="step">🎨 Designing characters &amp; world...</div>
      <div class="step">⚙️ Writing game mechanics...</div>
      <div class="step">🕹️ Almost ready to play!</div>
    </div>
  </div></body></html>`;
  const blob = new Blob([loadingHTML], { type: 'text/html' });
  gameFrame.src = URL.createObjectURL(blob);
}

function hideLoadingInFrame() { gameCard.classList.add('hidden'); }

// ── UI helpers ───────────────────────────────────────────────────────────────────────────
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
function hideError() { errorMsg.classList.add('hidden'); }

// ── Game actions ───────────────────────────────────────────────────────────────────────
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
  a.download = `${state.currentGame.description.slice(0, 30).replace(/[^a-z0-9]/gi, '-').toLowerCase()}-game.html`;
  a.click();
}

// ── Library ────────────────────────────────────────────────────────────────────────────────
const GAME_ICONS = ['🎮','🕹️','🚀','🐉','⚔️','🧙','🏆','🌟','🎯','💥','🦸','🤖','🧟','🦕','🐱','🏰'];

function addToLibrary(description, code) {
  const icon = GAME_ICONS[state.library.length % GAME_ICONS.length];
  state.library.unshift({ id: Date.now(), description, code, icon });
  if (state.library.length > 20) state.library.pop();
  try { localStorage.setItem('cpgn_library', JSON.stringify(state.library)); } catch { /* full */ }
  renderLibrary();
}

function renderLibrary() {
  if (!state.library.length) { libraryCard.classList.add('hidden'); return; }
  libraryCard.classList.remove('hidden');
  libraryCount.textContent = state.library.length;
  libraryGrid.innerHTML = state.library.map(g => `
    <div class="library-item" data-id="${g.id}" title="${escapeHtml(g.description)}">
      <div class="library-item-icon">${g.icon}</div>
      <div class="library-item-desc">${escapeHtml(g.description)}</div>
      <div class="library-item-play">▶ Play again</div>
    </div>`).join('');
  libraryGrid.querySelectorAll('.library-item').forEach(el => {
    el.addEventListener('click', () => {
      const game = state.library.find(g => g.id === Number(el.dataset.id));
      if (game) loadGame(game.code, game.description);
    });
  });
}

function escapeHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Featured games ──────────────────────────────────────────────────────────────────────────
const featuredCard    = $('featuredGameCard');
const featuredFrame   = $('featuredGameFrame');
const featuredTitle   = $('featuredGameTitle');
const featuredFSBtn   = $('featuredFullscreenBtn');
const featuredCloseBtn= $('featuredCloseBtn');

const TILE_NAMES = {
  'games/floppy-wing.html':    '🐦 Floppy Wing',
  'games/neon-snake.html':     '🐍 Neon Snake',
  'games/galaxy-raiders.html': '👾 Galaxy Raiders',
  'games/block-drop.html':     '🟦 Block Drop',
  'games/road-dash.html':      '🏃 Road Dash',
  'games/tap-hunt.html':       '🎯 Tap Hunt',
  'games/brick-blaster.html':  '🧱 Brick Blaster',
  'games/hop-dash.html':       '🐸 Hop Dash',
  'games/fruit-slash.html':    '🍉 Fruit Slash',
  'games/maze-munch.html':     '👻 Maze Munch',
  'games/mole-madness.html':   '🔨 Mole Madness',
  'games/slide-2048.html':     '🔢 Slide 2048',
  'games/word-quest.html':     '🔤 Word Quest',
};

document.querySelectorAll('.featured-tile').forEach(tile => {
  tile.addEventListener('click', () => openFeaturedGame(tile.dataset.src, tile));
});

function openFeaturedGame(src, activeTile) {
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

// ── Boot ────────────────────────────────────────────────────────────────────────────────
init();
