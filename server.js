const express = require('express');
const cors = require('cors');
const multer = require('multer');
const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;

app.use(cors());

// --- MODIFICARE CRITICĂ PENTRU LINUX ---
// Nu mai setăm path manual către .exe, Nixpacks îl instalează global
// ffmpeg.setFfmpegPath(...) <- Șterge sau comentează liniile astea

// Upload & Folders
const upload = multer({ dest: 'uploads/' });
if (!fs.existsSync('uploads')) fs.mkdirSync('uploads');
if (!fs.existsSync('processed')) fs.mkdirSync('processed');

// Servim Frontend-ul Static
app.use(express.static(path.join(__dirname, 'public')));

app.post('/api/smart-cut', upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Fisier lipsa' });

    const inputFile = req.file.path;
    const outputFile = path.join('processed', `cut_${Date.now()}.mp3`);
    const threshold = req.body.threshold || '-30dB'; 
    const minSilence = req.body.minSilence || '0.3';

    console.log(`[CUT] Processing: ${req.file.originalname}`);

    ffmpeg(inputFile)
        .audioFilters(`silenceremove=stop_periods=-1:stop_duration=${minSilence}:stop_threshold=${threshold}`)
        .on('end', () => {
            res.download(outputFile, 'tight_audio.mp3', (err) => {
                try {
                    fs.unlinkSync(inputFile);
                    setTimeout(() => { if(fs.existsSync(outputFile)) fs.unlinkSync(outputFile); }, 10000);
                } catch(e){}
            });
        })
        .on('error', (err) => {
            console.error(err);
            res.status(500).json({ error: 'Eroare procesare.' });
        })
        .save(outputFile);
});

// Fallback pentru SPA
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => console.log(`✂️ AudioCut on port ${PORT}`));