require('dotenv').config();
const express = require('express');
const path = require('path');

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Carefully engineered prompt — forces the AI to tie every game element to the description
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

app.post('/api/generate-game', async (req, res) => {
  const { description, apiKey, provider } = req.body;

  if (!description || description.trim().length < 5) {
    return res.status(400).json({ error: 'Please describe your game first.' });
  }

  const key = apiKey || process.env.GROQ_API_KEY || process.env.HF_API_KEY || process.env.GEMINI_API_KEY;

  if (!key) {
    return res.status(400).json({
      error: 'No API key provided. Enter your free Groq API key above (get one free at console.groq.com — no credit card needed).'
    });
  }

  try {
    const gameCode = await generateGame(description.trim(), key, provider || 'groq');
    res.json({ gameCode });
  } catch (err) {
    console.error('Generation error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

async function generateGame(description, apiKey, provider) {
  const userMessage = `Create a complete HTML5 game based on this description:

"${description}"

Step 1 — Analyze the description and list out:
- Player character (name, appearance, abilities)
- Enemies or obstacles
- World/setting and visual theme
- Core gameplay mechanic (how the player wins)
- Any special items, power-ups, or events mentioned

Step 2 — Build the full game. Every item from Step 1 MUST be present in the game. The characters, enemies, setting, and mechanics must all match the description. Do not replace them with generic placeholders.

Return ONLY the complete HTML code, starting with <!DOCTYPE html>.`;

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

  return extractHTML(text, description);
}

function extractHTML(text, description) {
  // Match a full HTML document
  let match = text.match(/<!DOCTYPE html[\s\S]*?<\/html>/i);
  if (match) return match[0];

  // Strip markdown code fences if present
  const fenceMatch = text.match(/```(?:html)?\n?([\s\S]*?)\n?```/i);
  if (fenceMatch) {
    const inner = fenceMatch[1];
    const innerDoc = inner.match(/<!DOCTYPE html[\s\S]*?<\/html>/i);
    if (innerDoc) return innerDoc[0];
    if (inner.includes('<canvas') || inner.includes('<script')) return inner;
  }

  // Fallback: look for <html>...</html>
  const htmlTag = text.match(/<html[\s\S]*?<\/html>/i);
  if (htmlTag) return htmlTag[0];

  // If the text itself looks like raw HTML
  if (text.includes('<canvas') || (text.includes('<script') && text.includes('</script>'))) {
    return text;
  }

  throw new Error('The AI did not return valid game code. Try a more detailed description, or try again.');
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🎮  Create & Play Gaming Network → http://localhost:${PORT}`);
});
