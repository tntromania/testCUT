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

// Multer cu limită de 200 MB pentru a preveni abuzul
const upload = multer({
    dest: uploadDir + '/',
    limits: { fileSize: 200 * 1024 * 1024 } // 200 MB
});

// ══════════════════════════════════════════════════════════════
// ██ HELPERS
// ══════════════════════════════════════════════════════════════

// Șterge fișier fără să arunce dacă nu există
const safeUnlink = (file) => {
    try {
        if (file && fs.existsSync(file)) fs.unlinkSync(file);
    } catch (e) {
        console.error('Eroare la ștergere fișier:', e.message);
    }
};

// Verifică dacă fișierul e audio valid și returnează durata
const validateAudio = (filePath) => {
    return new Promise((resolve, reject) => {
        ffmpeg.ffprobe(filePath, (err, metadata) => {
            if (err) return reject(new Error('Fișier audio invalid sau corupt.'));
            const hasAudio = metadata.streams?.some(s => s.codec_type === 'audio');
            if (!hasAudio) return reject(new Error('Fișierul nu conține pistă audio.'));
            resolve(metadata.format.duration || 0);
        });
    });
};

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
    const startTime = Date.now();
    const userLabel = `${req.user?.name || 'Unknown'} (${req.user?.email || req.userId})`;
    const inputFile = req.file?.path;
    const fileSizeMB = req.file ? (req.file.size / 1024 / 1024).toFixed(2) : 0;

    console.log(`📥 [${new Date().toISOString()}] ${userLabel} — început procesare (${req.file?.originalname || 'no-file'}, ${fileSizeMB} MB)`);

    try {
        if (!req.file) return res.status(400).json({ error: 'Fișier lipsă.' });

        // 1. Verificăm creditele prin HUB
        const balance = await hubAPI.checkCredits(req.userId);
        if (balance.credits < 0.5) {
            safeUnlink(inputFile);
            console.warn(`⚠️  [${userLabel}] Fonduri insuficiente (${balance.credits} credite)`);
            return res.status(403).json({ error: "Cost: 0.5 Credite. Fonduri insuficiente." });
        }

        // 2. Validăm fișierul ÎNAINTE de a porni FFmpeg pe el
        let durationSec = 0;
        try {
            durationSec = await validateAudio(inputFile);
        } catch (validationErr) {
            console.warn(`⚠️  [${userLabel}] Fișier invalid: ${req.file.originalname} (${req.file.size} bytes) — ${validationErr.message}`);
            safeUnlink(inputFile);
            return res.status(400).json({
                error: 'Fișierul audio pare corupt sau incomplet. Te rog reîncarcă-l.'
            });
        }

        // 3. Procesăm
        const outputFile = path.join(processedDir, `cut_${Date.now()}.mp3`);
        const threshold = '-45dB';
        const minSilence = req.body.minSilence || '0.35';

        const audioFilter = `silenceremove=start_periods=1:start_duration=0.1:start_threshold=${threshold}:stop_periods=-1:stop_duration=${minSilence}:stop_threshold=${threshold}`;

        ffmpeg(inputFile)
            .audioFilters(audioFilter)
            .on('end', async () => {
                const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
                let creditsLeft = 0;

                // Scădem creditele prin HUB (atomic)
                try {
                    const result = await hubAPI.useCredits(req.userId, 0.5);
                    creditsLeft = result.credits;
                } catch (e) {
                    console.error(`❌ [${userLabel}] Eroare scădere credite:`, e.message);
                }

                console.log(`✅ [${userLabel}] Procesare OK în ${elapsed}s (input: ${durationSec.toFixed(1)}s audio, ${fileSizeMB} MB) — credite rămase: ${creditsLeft}`);

                if (!res.headersSent) {
                    res.json({
                        status: 'ok',
                        downloadUrl: `/download/${path.basename(outputFile)}`,
                        creditsLeft
                    });
                }

                safeUnlink(inputFile);
            })
            .on('error', (err) => {
                const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
                console.error(`❌ [${userLabel}] FFmpeg eroare după ${elapsed}s:`, err.message);
                safeUnlink(inputFile);
                safeUnlink(outputFile);
                if (!res.headersSent) {
                    res.status(500).json({ error: 'Eroare la procesarea audio.' });
                }
            })
            .save(outputFile);

    } catch (e) {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
        console.error(`❌ [${userLabel}] Eroare după ${elapsed}s:`, e.message);
        safeUnlink(inputFile);
        if (!res.headersSent) {
            res.status(500).json({ error: e.message });
        }
    }
});

// ══════════════════════════════════════════════════════════════
// ██ DOWNLOAD
// ══════════════════════════════════════════════════════════════
app.get('/download/:filename', (req, res) => {
    const file = path.join(processedDir, req.params.filename);
    if (fs.existsSync(file)) res.download(file); else res.status(404).send('Expirat.');
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server Audio Slicer pornit stabil pe portul ${PORT}`);
});
