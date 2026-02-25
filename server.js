require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const ffmpeg = require('fluent-ffmpeg'); // Folosim versiunea nativă a serverului tău (stabila!)
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const { OAuth2Client } = require('google-auth-library');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 3000;

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Foldere
const uploadDir = 'uploads';
const processedDir = 'processed';
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
if (!fs.existsSync(processedDir)) fs.mkdirSync(processedDir);
const upload = multer({ dest: uploadDir + '/' });

// CONECTARE BAZA DE DATE CENTRALA
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('✅ Audiocut s-a conectat la MongoDB!'))
    .catch(err => console.error('❌ Eroare MongoDB:', err));

const UserSchema = new mongoose.Schema({
    googleId: String, email: String, name: String, picture: String, credits: { type: Number, default: 5 }
});
const User = mongoose.model('User', UserSchema);

const authenticate = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: "Trebuie să fii logat!" });
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.userId = decoded.userId;
        next();
    } catch (e) { return res.status(401).json({ error: "Sesiune expirată." }); }
};

// RUTE AUTH
app.post('/api/auth/google', async (req, res) => {
    try {
        const ticket = await googleClient.verifyIdToken({ idToken: req.body.credential, audience: process.env.GOOGLE_CLIENT_ID });
        const payload = ticket.getPayload();
        let user = await User.findOne({ googleId: payload.sub });
        if (!user) {
            user = new User({ googleId: payload.sub, email: payload.email, name: payload.name, picture: payload.picture, credits: 5 });
            await user.save();
        }
        const sessionToken = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
        res.json({ token: sessionToken, user: { name: user.name, picture: user.picture, credits: user.credits } });
    } catch (error) { res.status(400).json({ error: "Eroare Google" }); }
});

app.get('/api/auth/me', authenticate, async (req, res) => {
    const user = await User.findById(req.userId);
    res.json({ user: { name: user.name, picture: user.picture, credits: user.credits } });
});

// ==========================================
// RUTA DE PROCESARE AUDIO (GLITCH-FREE & HUMAN CUT)
// ==========================================
app.post('/api/smart-cut', authenticate, upload.single('file'), async (req, res) => {
    try {
        const user = await User.findById(req.userId);
        if (user.credits < 1) {
            if (req.file) fs.unlinkSync(req.file.path);
            return res.status(403).json({ error: "Cost: 1 Credit. Fonduri insuficiente." });
        }
        if (!req.file) return res.status(400).json({ error: 'Fisier lipsa' });

        const inputFile = req.file.path;
        const outputFile = path.join(processedDir, `cut_${Date.now()}.mp3`);
        
        // SECRETUL AUDIO PRO: 
        // Suprascriem pragul la -45dB ca sa nu mai manance din literele de la finalul cuvintelor
        // Si setam minSilence la 0.35 secunde pentru o tranzitie perfecta
        const threshold = '-45dB'; 
        const minSilence = req.body.minSilence || '0.35'; 

        // Algoritm nativ super-stabil (suportat de orice versiune FFmpeg)
        const audioFilter = `silenceremove=start_periods=1:start_duration=0.1:start_threshold=${threshold}:stop_periods=-1:stop_duration=${minSilence}:stop_threshold=${threshold}`;

        ffmpeg(inputFile)
            .audioFilters(audioFilter)
            .on('end', async () => {
                user.credits -= 1;
                await user.save();
                
                res.json({ 
                    status: 'ok', 
                    downloadUrl: `/download/${path.basename(outputFile)}`,
                    creditsLeft: user.credits
                });
                
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

