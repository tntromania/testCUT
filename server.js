const express = require('express');
const cors = require('cors');
const multer = require('multer');
const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Foldere
const uploadDir = 'uploads';
const processedDir = 'processed';
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
if (!fs.existsSync(processedDir)) fs.mkdirSync(processedDir);

const upload = multer({ dest: uploadDir + '/' });

app.post('/api/smart-cut', upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Fisier lipsa' });

    const inputFile = req.file.path;
    const outputFile = path.join(processedDir, `cut_${Date.now()}.mp3`);

    const threshold = req.body.threshold || '-30dB'; 
    const minSilence = req.body.minSilence || '0.3';

    console.log(`[CUT] Procesez: ${req.file.originalname} pe server`);

    ffmpeg(inputFile)
        .audioFilters(`silenceremove=stop_periods=-1:stop_duration=${minSilence}:stop_threshold=${threshold}`)
        .on('end', () => {
            console.log('[CUT] Procesare finalizata cu succes!');
            res.download(outputFile, 'tight_audio.mp3', (err) => {
                try {
                    if (fs.existsSync(inputFile)) fs.unlinkSync(inputFile);
                    // Ștergem fișierul procesat după 10 secunde de la download
                    setTimeout(() => { 
                        if (fs.existsSync(outputFile)) fs.unlinkSync(outputFile); 
                    }, 10000);
                } catch(e) { console.error('Eroare cleanup:', e); }
            });
        })
        .on('error', (err) => {
            console.error('FFmpeg Error:', err.message);
            res.status(500).json({ error: 'Eroare procesare server.' });
        })
        .save(outputFile);
});

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server Audio Slicer pornit pe portul ${PORT}`);
});