// server/index.js
require('dotenv').config(); // Читаем ключ из .env
const multer = require('multer');
const { GoogleGenerativeAI } = require('@google/generative-ai'); // Подключаем мозги
const express = require('express');
const cheerio = require('cheerio');
const fetch = require('node-fetch');
const http = require('http');
const https = require('https');
const { Server } = require('socket.io');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

// --- Конфигурация ---
const SHOUTCAST_URL = 'http://78.109.52.73:8000';
const SID = 1;
const PORT = process.env.PORT || 3000;
const FRONTEND_URL = process.env.FRONTEND_URL || "https://bakujukebox.com";
const STATE_FILE = path.join(__dirname, 'server_state.json');

// --- Инициализация ---
const app = express();
// --- НАСТРОЙКА ЗАГРУЗКИ ФАЙЛОВ (MULTER) ---
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, path.join(__dirname, '../public_html/cinema'));
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'upload-' + uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// --- Инициализация AI ---
const rawKey = process.env.GEMINI_API_KEY || '';
const apiKey = rawKey.trim();

if (apiKey.length > 10) {
    console.log(`🔑 AI Key detected: ${apiKey.substring(0, 5)}...OK`);
} else {
    console.error('❌ AI Key is MISSING or too short! Check .env file');
}

const genAI = new GoogleGenerativeAI(apiKey);
const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

// Настройка CORS
app.use(cors({ origin: FRONTEND_URL, credentials: true }));
const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: ["https://bakujukebox.com", "https://www.bakujukebox.com", "http://localhost:5173"],
        methods: ["GET", "POST"],
        credentials: true
    },
    allowEIO3: true
});

// НАСТРОЙКА ПЕРСОНЫ ПО УМОЛЧАНИЮ
let customPersona = `Ты Mrs. Lizard — Девушка радио ведущая которая разбирается в кино и музыке любых жанров и времени.
Ты своего рода ГИГ.
Ты анонсируешь новости в стиле радиоведущей 80х годов.`;

// --- STATE MANAGEMENT ---
const defaultState = {
    marqueeTop: { 
        text: ">>> BAKU JUKEBOX ON AIR >>> WELCOME TO THE FUTURE OF RADIO >>>", 
        speed: 30, active: true 
    },
    marqueeBottom: { 
        text: "HISTORY: WAITING FOR DATA...", 
        speed: 45, active: true 
    },
    nanaAutoAnnounce: false,
    theme: {
        global: { headerColor: '#ffff00', headerFont: 'VT323' },
        marquee: {
            topTextColor: '#00ffff', topBgColor: '#000000', topFont: 'VT323',
            bottomTextColor: '#ffff00', bottomBgColor: '#000000', bottomFont: 'VT323'
        },
        chat: { userColor: '#ffff00', msgColor: '#ffffff', font: 'VT323' },
        weather: { tempColor: '#ffff00', font: 'VT323' }
    },
    news: {
        'MUSIC': [], 'BAKU': [], 'TECH': [], 'HOROSCOPE': []
    },
    visualizer: { mode: 'NEON', scene: 'NEURAL' },
    bannedUsers: []
};

let globalState = { ...defaultState };
try {
    if (fs.existsSync(STATE_FILE)) {
        const loaded = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
        const mergedTheme = {
            global: { ...defaultState.theme.global, ...(loaded.theme?.global || {}) },
            marquee: { ...defaultState.theme.marquee, ...(loaded.theme?.marquee || {}) },
            chat: { ...defaultState.theme.chat, ...(loaded.theme?.chat || {}) },
            weather: { ...defaultState.theme.weather, ...(loaded.theme?.weather || {}) }
        };
        globalState = { 
            ...defaultState, ...loaded, theme: mergedTheme,
            news: { ...defaultState.news, ...(loaded.news || {}) },
            visualizer: { ...defaultState.visualizer, ...(loaded.visualizer || {}) }
        };
        console.log('📂 STATE LOADED from disk');
    }
} catch (e) {
    console.error('State load error, using defaults:', e.message);
}

const saveState = () => {
    try { fs.writeFileSync(STATE_FILE, JSON.stringify(globalState, null, 2)); } 
    catch (e) { console.error('Save error:', e.message); }
};

const httpAgent = new http.Agent({ keepAlive: false });
let cachedHistory = [];
let cachedCurrentTrack = { artist: 'Baku Jukebox', title: 'Connecting...' };
let cachedStats = { currentlisteners: 0 };
// Очищаем чат при старте сервера, чтобы убрать старую Нану
let chatMessages = [{ id: Date.now(), sender: 'SYSTEM', text: 'SYSTEM REBOOTED. CHAT CLEARED.', isSystem: true }];
const MAX_CHAT_MESSAGES = 100;
let trackOverride = { isActive: false, artist: '', title: '' };
let hiddenTracks = new Set();
let audioStreams = [{ id: 'main', name: 'Main Stream', url: `${SHOUTCAST_URL}/bkjbox`, isActive: true }];

app.use(express.json());

// --- Логика Shoutcast ---
async function updateShoutcastData() {
    try {
        let tempHistory = [];
        let tempCurrent = { artist: '', title: '' };

        const jsonStatsResponse = await fetch(`${SHOUTCAST_URL}/stats?sid=${SID}&json=1`, {
            headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 4000, agent: httpAgent
        });

        if (jsonStatsResponse.ok) {
            const statsData = await jsonStatsResponse.json();
            cachedStats = { currentlisteners: statsData.currentlisteners || 0 };
            
            if (!trackOverride.isActive) {
                const songTitle = statsData.songtitle || 'Live Stream';
                const parts = songTitle.split(' - ');
                tempCurrent = parts.length >= 2
                    ? { artist: parts[0].trim(), title: parts.slice(1).join(' - ').trim() }
                    : { artist: songTitle, title: '' };
            } else {
                tempCurrent = { artist: trackOverride.artist, title: trackOverride.title };
            }

            const newTrackString = `${tempCurrent.artist} - ${tempCurrent.title}`;
            const oldTrackString = `${cachedCurrentTrack.artist} - ${cachedCurrentTrack.title}`;

            if (newTrackString !== oldTrackString && newTrackString.length > 5 && newTrackString !== ' - ') {
                console.log(`🎵 Track Changed: ${newTrackString}`);
                if (globalState.nanaAutoAnnounce) {
                    generateNanaIntro(tempCurrent.artist, tempCurrent.title);
                }
                if (!trackOverride.isActive) cachedCurrentTrack = tempCurrent;
            } else if (!trackOverride.isActive) {
                 cachedCurrentTrack = tempCurrent;
            }
        }

        const historyResponse = await fetch(`${SHOUTCAST_URL}/played.html?sid=${SID}`, {
            headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 4000, agent: httpAgent
        });

        if (historyResponse.ok) {
            const html = await historyResponse.text();
            const $ = cheerio.load(html);
            const uniqueCheck = new Set();
            $('body > table').eq(1).find('tr').slice(1).each((i, row) => {
                const rawTime = $(row).find('td').eq(0).text().trim();
                const rawTitle = $(row).find('td').eq(1).text().trim();
                if (rawTitle && !['stream title', 'current song'].includes(rawTitle.toLowerCase())) {
                    const parts = rawTitle.split(' - ');
                    const artist = parts[0] ? parts[0].trim() : 'Unknown';
                    const title = parts.slice(1).join(' - ').trim() || parts[0];
                    const historyStr = `${artist} - ${title}`.toLowerCase().trim();
                    const currentStr = `${tempCurrent.artist} - ${tempCurrent.title}`.toLowerCase().trim();
                    if (historyStr !== currentStr) {
                        const uniqueKey = `${rawTime}-${artist}-${title}`;
                        if (!uniqueCheck.has(uniqueKey)) {
                            uniqueCheck.add(uniqueKey);
                            tempHistory.push({ artist, title, time: rawTime });
                        }
                    }
                }
            });
            cachedHistory = tempHistory;
        }
    } catch (error) { console.error(`Shoutcast Error: ${error.message}`); }
}

// --- API ---
app.get('/api/stream', (req, res) => {
    const activeStream = audioStreams.find(s => s.isActive);
    if (!activeStream) return res.status(503).send('No active stream');
    const client = activeStream.url.startsWith('https') ? https : http;
    const proxyReq = client.get(activeStream.url, (upstreamRes) => {
        res.writeHead(upstreamRes.statusCode, upstreamRes.headers);
        upstreamRes.pipe(res);
    });
    proxyReq.on('error', (err) => res.status(502).end());
    req.on('close', () => proxyReq.destroy());
});

app.get('/api/current', (req, res) => {
    if (trackOverride.isActive) return res.json({ artist: trackOverride.artist, title: trackOverride.title });
    res.json(cachedCurrentTrack);
});
app.get('/api/history', (req, res) => res.json(cachedHistory));
app.get('/api/stats', (req, res) => res.json(cachedStats));
app.post('/api/upload', upload.single('image'), (req, res) => {
    if (!req.file) return res.status(400).send('No file uploaded.');
    res.json({ url: `/cinema/${req.file.filename}` });
});

// --- SOCKET.IO (ИСПРАВЛЕННАЯ ЛОГИКА) ---
io.on('connection', (socket) => {
    // При подключении шлем данные
    socket.emit('sys_config', globalState);
    socket.emit('chat history', chatMessages);

    // ЧАТ
    socket.on('chat message', (msg) => {
        const clientIp = socket.handshake.address; 
        if (globalState.bannedUsers.includes(clientIp)) {
            socket.emit('chat message', { id: Date.now(), sender: 'SYSTEM', text: 'YOU ARE BANNED', isSystem: true });
            return;
        }
        if (!msg || !msg.text || !msg.text.trim()) return;
        
        const newMessage = {
            id: Date.now(),
            sender: msg.sender || 'ANONYMOUS',
            text: msg.text.trim(),
            timestamp: new Date(),
            isSystem: false,
            ip: clientIp 
        };
        chatMessages.push(newMessage);
        if (chatMessages.length > MAX_CHAT_MESSAGES) chatMessages.shift();
        
        const { ip, ...publicMsg } = newMessage; 
        io.emit('chat message', publicMsg);
        io.emit('admin_audit_update', chatMessages); 
    });

    // ОБНОВЛЕНИЕ НАСТРОЕК (ПЕРСОНА)
    socket.on('update_sys_config', (data) => {
        if (data.nanaPersona) {
            customPersona = data.nanaPersona;
            console.log('AI Persona updated:', customPersona);
        }
        io.emit('sys_config', data);
    });

    // --- SECURITY ---
    socket.on('admin_get_security_data', () => {
        socket.emit('admin_security_data', { history: chatMessages, banned: globalState.bannedUsers });
    });

    socket.on('admin_ban_ip', (ipToBan) => {
        if (!ipToBan) return;
        if (!globalState.bannedUsers.includes(ipToBan)) {
            globalState.bannedUsers.push(ipToBan);
            saveState();
        }
        io.emit('admin_security_data', { history: chatMessages, banned: globalState.bannedUsers });
    });

    socket.on('admin_unban_ip', (ipToUnban) => {
        globalState.bannedUsers = globalState.bannedUsers.filter(ip => ip !== ipToUnban);
        saveState();
        io.emit('admin_security_data', { history: chatMessages, banned: globalState.bannedUsers });
    });

    // --- АДМИН ФУНКЦИИ ---
    socket.on('admin_broadcast_msg', (text) => {
        const sysMsg = { id: Date.now(), sender: 'SYSTEM', text: text.toUpperCase(), isSystem: true };
        chatMessages.push(sysMsg);
        io.emit('chat message', sysMsg);
    });

    socket.on('admin_send_alert', (text) => io.emit('show_alert', text));

    socket.on('admin_toggle_announce', (state) => {
        globalState.nanaAutoAnnounce = state;
        saveState();
        io.emit('sys_config', globalState);
    });

    socket.on('admin_update_news', (d) => { globalState.news = d; saveState(); io.emit('sys_config', globalState); });
    socket.on('admin_update_marquee', (d) => { globalState.marqueeTop = d.top; globalState.marqueeBottom = d.bottom; saveState(); io.emit('sys_config', globalState); });
    socket.on('admin_update_theme', (d) => { globalState.theme = d; saveState(); io.emit('sys_config', globalState); });
    socket.on('admin_update_scene', (d) => { globalState.visualizer.scene = d; saveState(); io.emit('sys_config', globalState); });

    socket.on('admin_clear_chat', () => {
        chatMessages = [{ id: Date.now(), sender: 'SYSTEM', text: 'CHAT CLEARED BY ADMIN', isSystem: true }];
        io.emit('chat history', chatMessages);
    });

    socket.on('admin_delete_msg', (msgId) => {
        chatMessages = chatMessages.filter(msg => msg.id !== msgId);
        io.emit('chat history', chatMessages);
        io.emit('admin_audit_update', chatMessages);
    });

    // --- MRS. LIZARD GENERATION ---
    socket.on('admin_ask_nana', async (data) => {
        const topic = data.topic || data;
        const persona = data.persona || customPersona;
        const imageStyle = data.imageStyle || 'photorealistic, 4k';

        try {
            const prompt = `${persona}\nТема: "${topic}".\nЗадача:\n1. Заголовок.\n2. Текст (макс 300).\n3. Описание картинки (англ).\nОТВЕТЬ JSON: { "title": "...", "text": "...", "image_prompt": "..." }`;
            const result = await model.generateContent(prompt);
            let textRaw = result.response.text().replace(/```json|```/g, '').trim();
            const jsonResponse = JSON.parse(textRaw);

            const finalPrompt = `${jsonResponse.image_prompt}, ${imageStyle}`;
            const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(finalPrompt)}?width=1280&height=720&model=flux&nologo=true&seed=${Math.floor(Math.random()*1000)}`;
            
            const imageRes = await fetch(imageUrl);
            const buffer = Buffer.from(await imageRes.arrayBuffer());
            const filename = `lizard_${Date.now()}.jpg`;
            fs.writeFileSync(path.join(__dirname, '../public_html/cinema', filename), buffer);

            socket.emit('nana_response', {
                title: jsonResponse.title,
                text: jsonResponse.text,
                image: `/cinema/${filename}`
            });
        } catch (error) {
            console.error('Lizard Error:', error);
            socket.emit('nana_error', 'System overload.');
        }
    });

    socket.on('admin_override_track', (data) => {
        trackOverride = data.active ? { isActive: true, artist: data.artist, title: data.title } : { isActive: false };
        io.emit('force_refresh_metadata'); 
    });

}); // <--- ВОТ ЭТА СКОБКА БЫЛА НЕ В ТОМ МЕСТЕ, ТЕПЕРЬ ОНА В КОНЦЕ ВСЕХ СОКЕТОВ

// Функция авто-анонса (Mrs. Lizard)
async function generateNanaIntro(artist, title) {
    try {
        const prompt = `
            ${customPersona}
            Сейчас заиграл трек: "${artist} - ${title}".
            Напиши ОДНО короткое сообщение (макс 100 символов).
            Ответь только текстом. Без кавычек.
        `;
        const result = await model.generateContent(prompt);
        const text = result.response.text().trim();
        const msg = {
            id: Date.now(), sender: 'MRS. LIZARD 🦎', text: text,
            timestamp: new Date(), isSystem: false, isNana: true
        };
        chatMessages.push(msg);
        if (chatMessages.length > MAX_CHAT_MESSAGES) chatMessages.shift();
        io.emit('chat message', msg);
    } catch (e) { console.error('AI Gen Error:', e); }
}

server.listen(PORT, () => {
    console.log(`✅ RADIO SERVER started on port ${PORT}`);
    setInterval(updateShoutcastData, 5000); 
    updateShoutcastData(); 
});