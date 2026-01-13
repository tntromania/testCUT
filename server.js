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

// Servim fișierele din folderul public
app.use(express.static(path.join(__dirname, 'public')));

const upload = multer({ dest: 'uploads/' });

app.post('/api/smart-cut', upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Fisier lipsa' });

    const inputFile = req.file.path;
    const outputFile = path.join(__dirname, 'processed', `cut_${Date.now()}.mp3`);
    
    // Ne asigurăm că folderul processed există
    if (!fs.existsSync(path.join(__dirname, 'processed'))) fs.mkdirSync(path.join(__dirname, 'processed'));

    ffmpeg(inputFile)
        .audioFilters(`silenceremove=stop_periods=-1:stop_duration=${req.body.minSilence || 0.3}:stop_threshold=${req.body.threshold || '-30dB'}`)
        .on('end', () => {
            res.download(outputFile, 'audio_cut.mp3', () => {
                if (fs.existsSync(inputFile)) fs.unlinkSync(inputFile);
                if (fs.existsSync(outputFile)) fs.unlinkSync(outputFile);
            });
        })
        .on('error', (err) => {
            console.error('FFmpeg error:', err);
            res.status(500).send('Eroare procesare');
        })
        .save(outputFile);
});

// Trimite orice alt request către index.html
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => console.log(`Server pornit pe portul ${PORT}`));