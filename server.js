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

// Foldere necesare
const uploadDir = path.join(__dirname, 'uploads');
const processedDir = path.join(__dirname, 'processed');

if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
if (!fs.existsSync(processedDir)) fs.mkdirSync(processedDir);

const upload = multer({ dest: 'uploads/' });

// Servim fișierele statice din folderul "public"
// Acum "public/index.html" va fi servit direct la http://audiocut.creatorsmart.ro/
app.use(express.static(path.join(__dirname, 'public')));

// API pentru procesare
app.post('/api/smart-cut', upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Fisier lipsa' });

    const inputFile = req.file.path;
    const outputFile = path.join(processedDir, `cut_${Date.now()}.mp3`);
    const threshold = req.body.threshold || '-30dB'; 
    const minSilence = req.body.minSilence || '0.3';

    console.log(`[CUT] Procesare: ${req.file.originalname}`);

    ffmpeg(inputFile)
        .audioFilters(`silenceremove=stop_periods=-1:stop_duration=${minSilence}:stop_threshold=${threshold}`)
        .on('end', () => {
            res.download(outputFile, 'audio_cut.mp3', (err) => {
                try {
                    if (fs.existsSync(inputFile)) fs.unlinkSync(inputFile);
                    setTimeout(() => { 
                        if (fs.existsSync(outputFile)) fs.unlinkSync(outputFile); 
                    }, 60000); // Ștergem după 1 minut
                } catch(e) { console.error('[CLEANUP]', e); }
            });
        })
        .on('error', (err) => {
            console.error('[FFmpeg Error]:', err);
            res.status(500).json({ error: 'Eroare procesare' });
        })
        .save(outputFile);
});

// Orice altă rută trimite la index.html (pentru a evita 404 la refresh)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`✂️ AudioCut rulând pe portul ${PORT}`);
});