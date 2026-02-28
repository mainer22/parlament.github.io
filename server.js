// server.js
import express from 'express';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

dotenv.config();

const APP_ACCESS_TOKEN = process.env.APP_ACCESS_TOKEN;
const USER_ACCESS_TOKEN = process.env.USER_ACCESS_TOKEN;
const CLAN_ID = process.env.CLAN_ID || 'YOUR_CLAN_ID_HERE';

const app = express();
const PORT = process.env.PORT || 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataDir = path.join(__dirname, 'data');
const playersFile = path.join(dataDir, 'players.json');

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// временный /api/me
app.get('/api/me', (req, res) => {
  return res.json({
    nickname: 'DemoUser',
    rank: 'OFFICER',
    canEdit: true
  });
});

// API клан-участников (пока заглушка, надо будет подогнать под реальный эндпоинт)
app.get('/api/clan-members', async (req, res) => {
  try {
    if (!APP_ACCESS_TOKEN) {
      return res.status(500).json({ error: 'APP_ACCESS_TOKEN is missing' });
    }

    const region = 'ru';
    const url = `https://eapi.stalcraft.net/${region}/clans/${CLAN_ID}/members`;

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${APP_ACCESS_TOKEN}`
      }
    });

    if (!response.ok) {
      const text = await response.text();
      console.error('Clan members error:', response.status, text);
      return res.status(response.status).json({
        error: 'Failed to fetch clan members',
        details: text
      });
    }

    const data = await response.json();
    const members = data.members || data || [];

    const normalized = members.map((m, idx) => ({
      id: idx + 1,
      name: m.name || m.nickname || 'Unknown',
      rank: m.rank || 'MEMBER'
    }));

    res.json(normalized);
  } catch (e) {
    console.error('api/clan-members error', e);
    res.status(500).json({ error: 'Internal error' });
  }
});

// ===== API сохранения игроков в JSON =====

// GET /api/players — прочитать игроков из data/players.json
app.get('/api/players', (req, res) => {
  try {
    if (!fs.existsSync(playersFile)) {
      return res.json([]);
    }
    const raw = fs.readFileSync(playersFile, 'utf-8');
    if (!raw.trim()) {
      return res.json([]);
    }
    const players = JSON.parse(raw);
    if (!Array.isArray(players)) {
      return res.json([]);
    }
    res.json(players);
  } catch (e) {
    console.error('GET /api/players error', e);
    res.status(500).json({ error: 'Failed to read players.json' });
  }
});

// POST /api/players — сохранить игроков в data/players.json
app.post('/api/players', (req, res) => {
  try {
    const players = req.body;
    if (!Array.isArray(players)) {
      return res.status(400).json({ error: 'Body must be array' });
    }

    for (const p of players) {
      if (typeof p.id !== 'number' || typeof p.name !== 'string') {
        return res.status(400).json({ error: 'Invalid player format' });
      }
    }

    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    fs.writeFileSync(playersFile, JSON.stringify(players, null, 2), 'utf-8');
    res.json({ ok: true });
  } catch (e) {
    console.error('POST /api/players error', e);
    res.status(500).json({ error: 'Failed to write players.json' });
  }
});

// Все не-API запросы отдаем на index.html (SPA)
app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) {
    return next();
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
