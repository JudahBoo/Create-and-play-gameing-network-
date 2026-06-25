/* ===== CONFIG =====
   After deploying your Google Apps Script, paste your Web App URL below.
   It looks like: https://script.google.com/macros/s/YOUR_ID_HERE/exec
   Leave it as '' to fall back to localStorage (offline mode).
===== */
const APPS_SCRIPT_URL = '';   // <-- PASTE YOUR URL HERE

/* ===== STATE ===== */
let currentUser = null;
let avatarState = {
  skinColor: '#FDDBB4',
  skinDark: '#E8B87A',
  hairStyle: 'none',
  hairColor: '#1a0a00',
  shirtColor: '#3498db',
  eyes: 'normal'
};
let designMessageCount = 0;
let gameReady = false;
let currentDesignIdea = '';

/* ===== STORAGE HELPERS ===== */
function getUsers() {
  return JSON.parse(localStorage.getItem('cpg_users') || '{}');
}

function saveUsers(users) {
  localStorage.setItem('cpg_users', JSON.stringify(users));
}

// Fetch all community games from Google Sheets (falls back to localStorage)
async function fetchGames() {
  if (!APPS_SCRIPT_URL) {
    return JSON.parse(localStorage.getItem('cpg_games') || '[]');
  }
  try {
    const res = await fetch(APPS_SCRIPT_URL, { method: 'GET' });
    const data = await res.json();
    return data.games || [];
  } catch (err) {
    console.warn('Could not reach Google Sheets, using local cache:', err);
    return JSON.parse(localStorage.getItem('cpg_games') || '[]');
  }
}

// Save a new game to Google Sheets (falls back to localStorage)
async function postGame(game) {
  if (!APPS_SCRIPT_URL) {
    const games = JSON.parse(localStorage.getItem('cpg_games') || '[]');
    games.unshift(game);
    localStorage.setItem('cpg_games', JSON.stringify(games));
    return;
  }
  try {
    await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify({ action: 'add', game }),
    });
    // Also cache locally so this user sees it immediately
    const cached = JSON.parse(localStorage.getItem('cpg_games') || '[]');
    cached.unshift(game);
    localStorage.setItem('cpg_games', JSON.stringify(cached));
  } catch (err) {
    console.warn('Could not save to Google Sheets, saving locally:', err);
    const games = JSON.parse(localStorage.getItem('cpg_games') || '[]');
    games.unshift(game);
    localStorage.setItem('cpg_games', JSON.stringify(games));
  }
}

/* ===== SCREEN MANAGEMENT ===== */
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => {
    s.classList.remove('active');
    s.style.display = 'none';
  });
  const screen = document.getElementById(id);
  screen.style.display = 'flex';
  screen.classList.add('active');
}

/* ===== AUTH ===== */
function switchAuthTab(tab) {
  document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.auth-form').forEach(f => f.classList.add('hidden'));
  document.getElementById('auth-error').classList.add('hidden');

  if (tab === 'login') {
    document.querySelectorAll('.auth-tab')[0].classList.add('active');
    document.getElementById('login-form').classList.remove('hidden');
  } else {
    document.querySelectorAll('.auth-tab')[1].classList.add('active');
    document.getElementById('register-form').classList.remove('hidden');
  }
}

function showAuthError(msg) {
  const el = document.getElementById('auth-error');
  el.textContent = msg;
  el.classList.remove('hidden');
}

function handleRegister(e) {
  e.preventDefault();
  const username = document.getElementById('reg-username').value.trim();
  const email = document.getElementById('reg-email').value.trim();
  const password = document.getElementById('reg-password').value;
  const confirm = document.getElementById('reg-confirm').value;

  if (password !== confirm) return showAuthError('Passwords do not match.');

  const users = getUsers();
  if (users[username]) return showAuthError('Username already taken.');

  users[username] = { username, email, password, avatar: null, createdAt: Date.now() };
  saveUsers(users);

  currentUser = users[username];
  showScreen('avatar-screen');
}

function handleLogin(e) {
  e.preventDefault();
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value;

  const users = getUsers();
  if (!users[username] || users[username].password !== password) {
    return showAuthError('Invalid username or password.');
  }

  currentUser = users[username];
  goHome();
}

function handleLogout() {
  currentUser = null;
  showScreen('auth-screen');
  switchAuthTab('login');
}

/* ===== AVATAR ===== */
function setSkin(color, dark) {
  avatarState.skinColor = color;
  avatarState.skinDark = dark;
  document.getElementById('avatar-head').style.background = color;
  document.getElementById('avatar-body').style.background = dark;
}

function setHair(style) {
  avatarState.hairStyle = style;
  const hair = document.getElementById('avatar-hair');
  hair.className = 'avatar-hair';
  if (style !== 'none') {
    hair.classList.add(style);
    hair.style.background = avatarState.hairColor;
  }
  document.querySelectorAll('.btn-row .opt-btn').forEach(b => b.classList.remove('active'));
}

function setHairColor(color) {
  avatarState.hairColor = color;
  const hair = document.getElementById('avatar-hair');
  hair.style.background = color;
}

function setShirt(color) {
  avatarState.shirtColor = color;
  document.getElementById('avatar-shirt').style.background = color;
  document.getElementById('avatar-body').style.background = color;
}

function setEyes(type) {
  avatarState.eyes = type;
  const eyes = document.getElementById('avatar-eyes');
  eyes.className = 'avatar-eyes';
  if (type !== 'normal') eyes.classList.add(type);
}

function saveAvatar() {
  if (!currentUser) return;
  currentUser.avatar = { ...avatarState };
  const users = getUsers();
  users[currentUser.username] = currentUser;
  saveUsers(users);
  goHome();
}

function skipAvatar() {
  if (!currentUser) return;
  currentUser.avatar = null;
  const users = getUsers();
  users[currentUser.username] = currentUser;
  saveUsers(users);
  goHome();
}

/* ===== HOME ===== */
function goHome() {
  showScreen('home-screen');
  renderNavAvatar();
  document.getElementById('nav-username').textContent = currentUser.username;
  renderGames();
}

function renderNavAvatar() {
  const el = document.getElementById('nav-avatar');
  if (currentUser.avatar) {
    el.style.background = currentUser.avatar.skinColor;
    el.textContent = '';
  } else {
    el.textContent = currentUser.username[0].toUpperCase();
    el.style.background = 'var(--primary)';
    el.style.color = '#fff';
  }
}

function showProfile() {
  // Could expand this — for now just a visual cue
  alert(`Profile: ${currentUser.username}\nMember since: ${new Date(currentUser.createdAt).toLocaleDateString()}`);
}

/* ===== GAMES ===== */
const DEV_GAMES = [
  {
    id: 'dev-1',
    title: 'Neon Runner',
    description: 'A fast-paced endless runner through glowing cyberpunk streets. Dodge obstacles, collect power-ups, and beat your high score.',
    emoji: '🏃',
    gradient: 'linear-gradient(135deg, #7c3aed, #2563eb)',
    author: 'Developer',
    isDev: true,
    content: generateDevGame('Neon Runner', 'endless runner', 'A cyberpunk city filled with neon lights and hovering drones. You play as a rebel courier dashing through the streets. Dodge barriers, leap over gaps, and collect data chips. Speed increases over time. How far can you run?')
  },
  {
    id: 'dev-2',
    title: 'Pixel Quest',
    description: 'An 8-bit RPG adventure where you explore dungeons, fight monsters, and discover ancient artifacts.',
    emoji: '⚔️',
    gradient: 'linear-gradient(135deg, #d97706, #b45309)',
    author: 'Developer',
    isDev: true,
    content: generateDevGame('Pixel Quest', 'RPG adventure', 'You are a pixel hero venturing into the Dungeon of Echoes. Battle skeletons, slimes, and dark wizards. Collect gold to upgrade your sword and armor. Find the legendary Crystal Blade hidden on Floor 10 to win.')
  },
  {
    id: 'dev-3',
    title: 'Star Defender',
    description: 'Classic space shooter. Waves of alien ships descend — blast them before they reach Earth!',
    emoji: '🚀',
    gradient: 'linear-gradient(135deg, #059669, #065f46)',
    author: 'Developer',
    isDev: true,
    content: generateDevGame('Star Defender', 'space shooter', 'Earth is under attack! Pilot your starfighter through 8 waves of increasingly aggressive alien fleets. Dodge laser beams, collect shield boosts, and unleash your super missile when things get desperate. Save humanity or go down fighting.')
  }
];

function generateDevGame(title, genre, story) {
  return `🎮 GAME: ${title}
Genre: ${genre.toUpperCase()}

📖 STORY
${story}

🕹️ HOW TO PLAY
• Use Arrow Keys or WASD to move
• Spacebar or Click to interact / shoot
• Collect power-ups to gain advantages
• Reach the goal to win!

⚡ FEATURES
• Multiple levels with increasing difficulty
• Score tracking and leaderboard
• Special power-ups and abilities
• Boss encounters at key stages

🏆 WIN CONDITION
Complete all stages and defeat the final boss to claim victory and unlock the secret ending.

💡 TIP
Stay focused and keep moving — hesitation is your worst enemy!`;
}

async function renderGames() {
  const grid = document.getElementById('games-grid');
  grid.innerHTML = '<p style="color:var(--text-muted);padding:20px">Loading games...</p>';
  const userGames = await fetchGames();
  const allGames = [...DEV_GAMES, ...userGames];

  grid.innerHTML = allGames.map(game => `
    <div class="game-card" onclick="openGame('${game.id}')">
      <div class="game-card-thumb" style="background: ${game.gradient || 'linear-gradient(135deg,#7c3aed,#2563eb)'}">
        <span>${game.emoji || '🎮'}</span>
      </div>
      <div class="game-card-body">
        <div class="game-card-title">${escHtml(game.title)}</div>
        <div class="game-card-desc">${escHtml(game.description)}</div>
      </div>
      <div class="game-card-footer">
        <span>by ${escHtml(game.author)}</span>
        <span class="game-badge ${game.isDev ? 'dev' : ''}">${game.isDev ? 'Developer Pick' : 'Community'}</span>
      </div>
    </div>
  `).join('');
}

async function openGame(id) {
  const communityGames = await fetchGames();
  const all = [...DEV_GAMES, ...communityGames];
  const game = all.find(g => g.id === id);
  if (!game) return;

  document.getElementById('play-game-title').textContent = game.title;
  document.getElementById('play-game-content').innerHTML = formatGameContent(game.content);
  document.getElementById('game-play-modal').classList.remove('hidden');
}

function formatGameContent(text) {
  if (!text) return '<p>No content available.</p>';
  return text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\n/g, '<br/>')
    .replace(/(🎮 GAME:.*?)(<br\/>)/g, '<strong style="font-size:1.15rem;color:#a78bfa">$1</strong>$2')
    .replace(/(📖 STORY|🕹️ HOW TO PLAY|⚡ FEATURES|🏆 WIN CONDITION|💡 TIP|🎯 MECHANICS|🌍 SETTING|👥 CHARACTERS)/g,
      '<br/><strong style="color:#f59e0b;font-size:1rem">$1</strong>');
}

function closeGamePlay() {
  document.getElementById('game-play-modal').classList.add('hidden');
}

/* ===== GAME DESIGNER ===== */
function openGameDesigner() {
  designMessageCount = 0;
  gameReady = false;
  currentDesignIdea = '';
  document.getElementById('chat-window').innerHTML = `
    <div class="chat-msg ai">
      <span class="chat-avatar-icon">🤖</span>
      <div class="chat-bubble">
        Hey! I'm your Game Design AI. Describe your game idea in as much detail as possible — genre, gameplay mechanics, story, characters, setting, win/lose conditions, special features. The richer your description, the better your game will be!
      </div>
    </div>`;
  document.getElementById('publish-bar').classList.add('hidden');
  document.getElementById('chat-input').value = '';
  document.getElementById('game-designer-modal').classList.remove('hidden');
}

function closeGameDesigner() {
  document.getElementById('game-designer-modal').classList.add('hidden');
}

function sendDesignMessage() {
  const input = document.getElementById('chat-input');
  const text = input.value.trim();
  if (!text) return;

  if (text.length < 80) {
    appendAIMessage("That's a start, but I need much more detail! Describe the genre, gameplay mechanics, characters, setting, story, win/lose conditions, and any special features. Really paint a picture — the more you tell me, the better your game will be!");
    input.value = '';
    return;
  }

  appendUserMessage(text);
  currentDesignIdea = text;
  input.value = '';
  designMessageCount++;

  const typingId = appendTypingIndicator();

  setTimeout(() => {
    removeTypingIndicator(typingId);
    processDesignMessage(text);
  }, 1500 + Math.random() * 1000);
}

function appendUserMessage(text) {
  const window = document.getElementById('chat-window');
  const msg = document.createElement('div');
  msg.className = 'chat-msg user';
  msg.innerHTML = `
    <span class="chat-avatar-icon">${currentUser.username[0].toUpperCase()}</span>
    <div class="chat-bubble">${escHtml(text)}</div>`;
  window.appendChild(msg);
  window.scrollTop = window.scrollHeight;
}

function appendAIMessage(text) {
  const window = document.getElementById('chat-window');
  const msg = document.createElement('div');
  msg.className = 'chat-msg ai';
  msg.innerHTML = `
    <span class="chat-avatar-icon">🤖</span>
    <div class="chat-bubble">${text}</div>`;
  window.appendChild(msg);
  window.scrollTop = window.scrollHeight;
}

function appendTypingIndicator() {
  const id = 'typing-' + Date.now();
  const window = document.getElementById('chat-window');
  const msg = document.createElement('div');
  msg.className = 'chat-msg ai chat-typing';
  msg.id = id;
  msg.innerHTML = `
    <span class="chat-avatar-icon">🤖</span>
    <div class="chat-bubble">AI is designing your game...</div>`;
  window.appendChild(msg);
  window.scrollTop = window.scrollHeight;
  return id;
}

function removeTypingIndicator(id) {
  const el = document.getElementById(id);
  if (el) el.remove();
}

function processDesignMessage(idea) {
  const wordCount = idea.split(/\s+/).length;

  if (wordCount < 30 && designMessageCount <= 2) {
    const prompts = [
      "Good start! But I need a lot more detail. What's the genre? Who is the main character? What does the player actually DO? What's the win condition? Tell me everything!",
      "Getting there! Now add more: What obstacles or enemies will there be? Any power-ups or special moves? What's the setting — a city, a forest, a space station? Give me the full picture!",
      "Almost enough! One more thing — what makes your game unique? Is there a twist, a special mechanic, or an unexpected story beat? Flesh it out completely!"
    ];
    appendAIMessage(prompts[Math.min(designMessageCount - 1, prompts.length - 1)]);
    return;
  }

  if (wordCount >= 30 || designMessageCount >= 2) {
    buildGame(idea);
  }
}

function buildGame(idea) {
  appendAIMessage("🎉 Excellent description! I have everything I need. Let me build your game now...");

  const buildTyping = appendTypingIndicator();
  setTimeout(() => {
    removeTypingIndicator(buildTyping);

    const gameContent = generateGameFromIdea(idea);
    appendAIMessage(`✅ Your game is ready! Here's a preview of what I built:<br/><br/><em style="color:#94a3b8">${escHtml(idea.substring(0, 120))}...</em><br/><br/>Give it a title and post it to the homepage for everyone to play!`);
    gameReady = true;
    currentDesignIdea = idea;
    window._pendingGameContent = gameContent;
    document.getElementById('publish-bar').classList.remove('hidden');
  }, 2500);
}

function generateGameFromIdea(idea) {
  const words = idea.toLowerCase();

  let genre = 'Adventure';
  if (words.includes('platformer') || words.includes('jump') || words.includes('platform')) genre = 'Platformer';
  else if (words.includes('rpg') || words.includes('quest') || words.includes('role')) genre = 'RPG';
  else if (words.includes('shooter') || words.includes('shoot') || words.includes('gun')) genre = 'Shooter';
  else if (words.includes('puzzle') || words.includes('solve')) genre = 'Puzzle';
  else if (words.includes('horror') || words.includes('scary') || words.includes('survive')) genre = 'Survival Horror';
  else if (words.includes('racing') || words.includes('race') || words.includes('car')) genre = 'Racing';
  else if (words.includes('strategy') || words.includes('build') || words.includes('tower')) genre = 'Strategy';
  else if (words.includes('space') || words.includes('spaceship')) genre = 'Space Adventure';

  const emojis = { 'Platformer': '🦘', 'RPG': '⚔️', 'Shooter': '🔫', 'Puzzle': '🧩', 'Survival Horror': '👻', 'Racing': '🏎️', 'Strategy': '🏰', 'Space Adventure': '🚀', 'Adventure': '🗺️' };

  const firstSentence = idea.split(/[.!?]/)[0] || idea.substring(0, 80);

  const mechanics = extractMechanics(idea);
  const setting = extractSetting(idea);
  const characters = extractCharacters(idea);

  return `🎮 GAME: Custom Game by ${currentUser.username}
Genre: ${genre.toUpperCase()}

📖 STORY
${firstSentence}. ${idea.length > 100 ? idea.substring(0, 250) + '...' : idea}

🌍 SETTING
${setting}

👥 CHARACTERS
${characters}

🎯 MECHANICS
${mechanics}

🕹️ HOW TO PLAY
• Use Arrow Keys / WASD to move your character
• Spacebar or Left Click to perform the main action
• Collect items and power-ups scattered through each level
• Defeat enemies to progress and earn score multipliers

⚡ FEATURES
• Hand-crafted levels based on your unique concept
• Progressive difficulty system
• Score tracking and high score board
• Special power-up system
• Cinematic intro and outro sequences

🏆 WIN CONDITION
Complete all objectives described in your design. Reach the final stage, defeat the boss, and claim your victory!

💡 DESIGNER'S NOTE (by ${currentUser.username})
"${idea.substring(0, 100)}${idea.length > 100 ? '...' : ''}"`;
}

function extractMechanics(idea) {
  const w = idea.toLowerCase();
  const found = [];
  if (w.includes('jump') || w.includes('double jump')) found.push('Precision jumping with double-jump ability');
  if (w.includes('shoot') || w.includes('gun') || w.includes('laser')) found.push('Projectile shooting system');
  if (w.includes('craft') || w.includes('build')) found.push('Crafting and building system');
  if (w.includes('stealth') || w.includes('sneak') || w.includes('hide')) found.push('Stealth mechanics');
  if (w.includes('fly') || w.includes('flight')) found.push('Flight / aerial movement');
  if (w.includes('puzzle') || w.includes('solve')) found.push('Logic puzzle solving');
  if (w.includes('collect') || w.includes('gather')) found.push('Item collection system');
  if (w.includes('upgrade') || w.includes('level up')) found.push('Progression and upgrade trees');
  if (found.length === 0) found.push('Unique action-based gameplay', 'Progressive challenge system', 'Reward loop with unlockables');
  return found.map(m => `• ${m}`).join('\n');
}

function extractSetting(idea) {
  const w = idea.toLowerCase();
  if (w.includes('cyber') || w.includes('neon') || w.includes('futurist')) return 'A vibrant cyberpunk metropolis glowing with neon signs and towering skyscrapers.';
  if (w.includes('space') || w.includes('galaxy') || w.includes('planet')) return 'The vast expanse of deep space, dotted with asteroid fields and alien worlds.';
  if (w.includes('dungeon') || w.includes('cave') || w.includes('underground')) return 'Dark, labyrinthine dungeons filled with traps, treasure, and lurking monsters.';
  if (w.includes('forest') || w.includes('jungle') || w.includes('nature')) return 'A lush, mysterious forest teeming with magical creatures and ancient secrets.';
  if (w.includes('ocean') || w.includes('underwater') || w.includes('sea')) return 'The mysterious deep sea, with bioluminescent creatures and sunken ruins.';
  if (w.includes('desert') || w.includes('sand')) return 'A vast, scorching desert with towering dunes and hidden oases.';
  if (w.includes('city') || w.includes('urban') || w.includes('street')) return 'A bustling modern city with skyscrapers, back alleys, and hidden dangers.';
  return 'A richly crafted world built from your imagination, with unique environments and atmosphere.';
}

function extractCharacters(idea) {
  const w = idea.toLowerCase();
  const chars = [];
  if (w.includes('robot') || w.includes('android') || w.includes('mech')) chars.push('• Hero: A powerful robot/android with unique abilities');
  if (w.includes('wizard') || w.includes('mage') || w.includes('magic')) chars.push('• Hero: A skilled wizard wielding elemental magic');
  if (w.includes('ninja') || w.includes('samurai') || w.includes('warrior')) chars.push('• Hero: A deadly warrior with lightning-fast attacks');
  if (w.includes('alien') || w.includes('extraterrestrial')) chars.push('• Enemies: Waves of alien invaders');
  if (w.includes('zombie') || w.includes('undead')) chars.push('• Enemies: Hordes of undead creatures');
  if (w.includes('dragon') || w.includes('beast') || w.includes('monster')) chars.push('• Boss: A fearsome dragon/beast guarding the final stage');
  if (chars.length === 0) {
    chars.push('• Hero: The player character — customizable and upgradeable');
    chars.push('• Allies: NPCs who provide quests and support');
    chars.push('• Enemies: Diverse roster of foes growing in power');
    chars.push('• Final Boss: The ultimate challenge at the end');
  }
  return chars.join('\n');
}

async function publishGame() {
  const titleInput = document.getElementById('game-title-input');
  const title = titleInput.value.trim();
  if (!title) {
    titleInput.style.borderColor = '#ef4444';
    titleInput.placeholder = 'Please enter a title!';
    return;
  }

  const gradients = [
    'linear-gradient(135deg, #7c3aed, #2563eb)',
    'linear-gradient(135deg, #d97706, #b45309)',
    'linear-gradient(135deg, #059669, #065f46)',
    'linear-gradient(135deg, #dc2626, #9b1c1c)',
    'linear-gradient(135deg, #0891b2, #0e7490)',
    'linear-gradient(135deg, #7c3aed, #db2777)',
  ];

  const emojis = ['🎮', '⚔️', '🚀', '🧩', '🏆', '🌟', '🎯', '🔥', '💥', '🌊'];

  const newGame = {
    id: 'game-' + Date.now(),
    title,
    description: currentDesignIdea.substring(0, 140) + (currentDesignIdea.length > 140 ? '...' : ''),
    emoji: emojis[Math.floor(Math.random() * emojis.length)],
    gradient: gradients[Math.floor(Math.random() * gradients.length)],
    author: currentUser.username,
    isDev: false,
    content: window._pendingGameContent || generateGameFromIdea(currentDesignIdea)
  };

  closeGameDesigner();
  showToast('Saving your game...');
  await postGame(newGame);
  renderGames();

  setTimeout(() => {
    appendAIMessage = () => {};
  }, 100);

  showToast(`🎮 "${title}" has been posted to the homepage!`);
}

/* ===== TOAST ===== */
function showToast(msg) {
  const toast = document.createElement('div');
  toast.style.cssText = `
    position: fixed; bottom: 32px; left: 50%; transform: translateX(-50%);
    background: linear-gradient(135deg, #059669, #065f46);
    color: #fff; padding: 14px 28px; border-radius: 12px;
    font-weight: 600; font-size: 0.95rem; z-index: 9999;
    box-shadow: 0 8px 24px rgba(0,0,0,0.4);
    animation: slideUp 0.3s ease; white-space: nowrap;
  `;
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => { toast.style.opacity = '0'; toast.style.transition = 'opacity 0.3s'; }, 2500);
  setTimeout(() => toast.remove(), 2900);
}

/* ===== UTILS ===== */
function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ===== INIT ===== */
window.addEventListener('load', () => {
  // Seed dev games if needed (they're static, no seeding required)
  showScreen('auth-screen');
});
