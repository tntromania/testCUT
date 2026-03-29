require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs');

// ✅ Auth centralizat prin HUB
const { authenticate, hubAPI } = require('./hub-auth');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Foldere
const uploadDir = 'uploads';
const processedDir = 'processed';
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
if (!fs.existsSync(processedDir)) fs.mkdirSync(processedDir);
const upload = multer({ dest: uploadDir + '/' });

// ══════════════════════════════════════════════════════════════
// ██ AUTH ROUTES — proxy către HUB
// ══════════════════════════════════════════════════════════════
app.post('/api/auth/google', async (req, res) => {
    try {
        const response = await fetch(`${process.env.HUB_URL}/api/auth/google`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(req.body),
        });
        const data = await response.json();
        res.status(response.status).json(data);
    } catch (e) {
        res.status(500).json({ error: 'Nu pot comunica cu serverul principal.' });
    }
});

app.get('/api/auth/me', authenticate, async (req, res) => {
    res.json({ user: req.user });
});

// ══════════════════════════════════════════════════════════════
// ██ PROCESARE AUDIO (SMART CUT)
// ══════════════════════════════════════════════════════════════
app.post('/api/smart-cut', authenticate, upload.single('file'), async (req, res) => {
    try {
        // Verificăm creditele prin HUB
        const balance = await hubAPI.checkCredits(req.userId);
        if (balance.credits < 0.5) {
            if (req.file) fs.unlinkSync(req.file.path);
            return res.status(403).json({ error: "Cost: 0.5 Credite. Fonduri insuficiente." });
        }
        if (!req.file) return res.status(400).json({ error: 'Fisier lipsa' });

        const inputFile = req.file.path;
        const outputFile = path.join(processedDir, `cut_${Date.now()}.mp3`);

        const threshold = '-45dB';
        const minSilence = req.body.minSilence || '0.35';

        const audioFilter = `silenceremove=start_periods=1:start_duration=0.1:start_threshold=${threshold}:stop_periods=-1:stop_duration=${minSilence}:stop_threshold=${threshold}`;

        ffmpeg(inputFile)
            .audioFilters(audioFilter)
            .on('end', async () => {
                // Scădem creditele prin HUB (atomic)
                try {
                    const result = await hubAPI.useCredits(req.userId, 0.5);
                    res.json({
                        status: 'ok',
                        downloadUrl: `/download/${path.basename(outputFile)}`,
                        creditsLeft: result.credits
                    });
                } catch (e) {
                    res.json({
                        status: 'ok',
                        downloadUrl: `/download/${path.basename(outputFile)}`,
                        creditsLeft: 0
                    });
                }

                if (fs.existsSync(inputFile)) fs.unlinkSync(inputFile);
            })
            .on('error', (err) => {
                console.error("Eroare FFmpeg Audio:", err);
                res.status(500).json({ error: 'Eroare la procesarea audio.' });
                if (fs.existsSync(inputFile)) fs.unlinkSync(inputFile);
            })
            .save(outputFile);
    } catch (e) {
        if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        res.status(500).json({ error: e.message });
    }
});

// Endpoint Download
app.get('/download/:filename', (req, res) => {
    const file = path.join(processedDir, req.params.filename);
    if (fs.existsSync(file)) res.download(file); else res.status(404).send('Expirat.');
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server Audio Slicer pornit stabil pe portul ${PORT}`);
});
