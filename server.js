require('dotenv').config(); // This MUST be the first line
const express = require('express');
const multer = require('multer');
const fs = require('fs').promises;
const path = require('path');
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const { Dropbox } = require('dropbox');
const { randomBytes } = require('crypto');
const { MongoClient } = require('mongodb');
const cron = require('node-cron');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const session = require('express-session');

const app = express();
const port = process.env.PORT || 3000;

// --- 1. CONFIGURATION ---
const { 
    MONGODB_URI, MONGODB_DB_NAME,
    DROPBOX_APP_KEY, DROPBOX_APP_SECRET, DROPBOX_REFRESH_TOKEN,
    DROPBOX_OFFICIAL_FOLDER_PATH, DROPBOX_USER_FOLDER_PATH,
    GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET,
    ADMIN_EMAIL_LIST, BASE_URL, SESSION_SECRET
} = process.env;

// Create the allowed admin email list
const allowedAdmins = ADMIN_EMAIL_LIST ? ADMIN_EMAIL_LIST.split(',') : [];

// Use /tmp for Render's ephemeral filesystem, otherwise use local folder
const TEMP_DOWNLOAD_DIR = path.join(process.env.NODE_ENV === 'production' ? '/tmp' : __dirname, 'temp-downloads');
const FILE_SIZE_LIMIT = 2 * 1024 * 1024; // 2MB

// --- 2. DATABASE CLIENT ---
let db;
async function connectToDB() {
    try {
        const client = new MongoClient(MONGODB_URI);
        await client.connect();
        db = client.db(MONGODB_DB_NAME);
        console.log('Successfully connected to MongoDB Atlas');
    } catch (err) {
        console.error('Failed to connect to MongoDB', err);
        process.exit(1);
    }
}
connectToDB();

// --- 3. DROPBOX CLIENT ---
const dbx = new Dropbox({
    clientId: DROPBOX_APP_KEY,
    clientSecret: DROPBOX_APP_SECRET,
    refreshToken: DROPBOX_REFRESH_TOKEN,
});

// --- 4. MIDDLEWARE & AUTH SETUP ---
app.use(express.static('public')); 
app.use(express.json()); 
app.use(express.urlencoded({ extended: true }));

// Session setup
app.use(session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { 
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        secure: process.env.NODE_ENV === 'production' // Use secure cookies in production
    }
}));

// Passport setup
app.use(passport.initialize());
app.use(passport.session());

passport.use(new GoogleStrategy({
    clientID: GOOGLE_CLIENT_ID,
    clientSecret: GOOGLE_CLIENT_SECRET,
    callbackURL: `${BASE_URL}/auth/google/callback`
  },
  (accessToken, refreshToken, profile, done) => {
    // We only care about the email. Check if it's in our allowed list.
    const email = profile.emails && profile.emails[0].value;
    if (allowedAdmins.includes(email)) {
        return done(null, { email: email, name: profile.displayName });
    } else {
        // Not a valid admin
        return done(null, false, { message: 'User is not an authorized admin.' });
    }
  }
));

passport.serializeUser((user, done) => {
    done(null, user);
});
passport.deserializeUser((user, done) => {
    done(null, user);
});

// Auth middleware to protect admin routes
function isAdmin(req, res, next) {
    if (req.isAuthenticated() && allowedAdmins.includes(req.user.email)) {
        return next();
    }
    res.status(401).json({ success: false, message: 'Unauthorized' });
}

// Multer setup for 2 files + 2MB limit
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: FILE_SIZE_LIMIT }
}).fields([
    { name: 'signature', maxCount: 1 },
    { name: 'paymentScreenshot', maxCount: 1 }
]);

// --- 5. AUTOMATED TASK (FILE CLEANUP) ---
cron.schedule('0 * * * *', async () => {
    console.log('Running hourly cleanup of temp-downloads...');
    try {
        await fs.mkdir(TEMP_DOWNLOAD_DIR, { recursive: true });
        const files = await fs.readdir(TEMP_DOWNLOAD_DIR);
        const now = Date.now();
        const oneHour = 60 * 60 * 1000;

        for (const file of files) {
            const filePath = path.join(TEMP_DOWNLOAD_DIR, file);
            try {
                const stat = await fs.stat(filePath);
                if (now - stat.mtime.getTime() > oneHour) {
                    await fs.unlink(filePath);
                    console.log(`Deleted old temp file: ${file}`);
                }
            } catch (statErr) {} // Ignore error if file was already deleted
        }
    } catch (err) {
        console.error('Error during temp file cleanup:', err);
    }
});

// --- 6. HELPER FUNCTIONS ---

// Dropbox uploader
async function uploadToDropbox(pdfBytes, fileName, folderPath) {
    const fullDropboxPath = `${folderPath}/${fileName}`;
    try {
        const response = await dbx.filesUpload({
            path: fullDropboxPath,
            contents: pdfBytes,
            mode: 'add',
            autorename: true
        });
        console.log(`Successfully uploaded to ${folderPath}: ${response.result.name}`);
    } catch (error) {
        console.error(`Error uploading file to ${folderPath}:`, error.message);
    }
}

// Server-side validation
function validateForm(data, files) {
    const { name, company, amount, collectedBy, collectedOn } = data;
    if (!name || !company || !amount || !collectedBy || !collectedOn) {
        return { valid: false, message: 'Please fill out all required fields.' };
    }
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(collectedOn)) {
        return { valid: false, message: 'Invalid date format. Please use YYYY-MM-DD.' };
    }
    if (!files || !files.paymentScreenshot || files.paymentScreenshot.length === 0) {
        return { valid: false, message: 'Payment screenshot is required.' };
    }
    return { valid: true };
}

// --- 7. API ENDPOINTS ---

// === GOOGLE AUTH ENDPOINTS ===
app.get('/auth/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

app.get('/auth/google/callback', 
  passport.authenticate('google', { failureRedirect: '/admin' }),
  (req, res) => {
    // Successful authentication, redirect to admin panel.
    res.redirect('/admin');
  }
);

app.get('/auth/logout', (req, res) => {
    req.logout((err) => {
        if (err) { return next(err); }
        res.redirect('/admin');
    });
});

// === ADMIN ENDPOINTS ===
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Check if user is logged in
app.get('/admin/auth-status', (req, res) => {
    if (req.isAuthenticated() && allowedAdmins.includes(req.user.email)) {
        res.json({ authenticated: true, user: req.user });
    } else {
        res.json({ authenticated: false });
    }
});

// Generate a new one-time-use token (protected by 'isAdmin' middleware)
app.post('/admin-generate-token', isAdmin, async (req, res) => {
    const { brandName } = req.body;
    if (!brandName) {
        return res.status(400).json({ success: false, message: 'Brand name is required.' });
    }

    try {
        const token = `${brandName.replace(/[^a-z0-9]/gi, '_')}_${randomBytes(4).toString('hex')}`;
        const tokenDocument = {
            token: token,
            status: 'not_used',
            createdAt: new Date(),
            generatedBy: req.user.email // Log who made the token
        };
        
        await db.collection('tokens').insertOne(tokenDocument);
        
        const fullUrl = BASE_URL; // Use the BASE_URL from .env
        const link = `${fullUrl}/?token=${token}`;

        res.json({ success: true, link: link });

    } catch (err) {
        console.error("Token generation error:", err);
        res.status(500).json({ success: false, message: 'Database error.' });
    }
});


// === SPONSOR (USER) ENDPOINTS ===
app.get('/', async (req, res) => {
    const { token } = req.query;
    if (!token) {
        return res.status(401).send('<h1>401: Unauthorized</h1><p>No access token provided.</p>');
    }
    try {
        const tokenDoc = await db.collection('tokens').findOne({ token: token });
        
        if (!tokenDoc) {
            return res.status(403).send('<h1>403: Invalid Link</h1><p>This access link is not valid.</p>');
        }
        if (tokenDoc.status === 'used') {
            return res.status(403).send('<h1>403: Link Expired</h1><p>This access link has already been used.</p>');
        }
        
        res.sendFile(path.join(__dirname, 'public', 'index.html'));

    } catch (err) {
        console.error("Token check error:", err);
        res.status(500).send('<h1>500: Server Error</h1><p>Could not validate token.</p>');
    }
});

app.post('/submit-form', (req, res) => {
    upload(req, res, async (err) => {
        if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ success: false, message: 'File is too large (Max 2MB).' });
        } else if (err) {
            return res.status(500).json({ success: false, message: 'An error occurred during file upload.' });
        }

        try {
            const { token, name, company, designation, amount, paymentMethod, collectedBy, collectedOn } = req.body;
            
            const validation = validateForm(req.body, req.files);
            if (!validation.valid) {
                return res.status(400).json({ success: false, message: validation.message });
            }

            const tokenUpdate = await db.collection('tokens').findOneAndUpdate(
                { token: token, status: 'not_used' },
                { $set: { status: 'used', submittedBy: name, submittedAt: new Date() } }
            );
            
            if (!tokenUpdate) {
                return res.status(403).json({ success: false, message: 'This link has expired or was already used.' });
            }

            const submissionID = `SPONSOR-${randomBytes(4).toString('hex').toUpperCase()}`;
            const safeUsername = name.replace(/[^a-z0-9]/gi, '_') || 'Sponsor';
            const filename = `${safeUsername}_${submissionID}.pdf`;
            
            const screenshotFile = req.files.paymentScreenshot[0];
            const signatureFile = req.files.signature ? req.files.signature[0] : null;

            const screenshotExt = path.extname(screenshotFile.originalname);
            const screenshotFilename = `${safeUsername}_${submissionID}_screenshot${screenshotExt}`;
            
            let signatureImageBytes = null;
            if (signatureFile) {
                signatureImageBytes = signatureFile.buffer;
            }

            const FONT_SIZE = 10;
            const FONT_COLOR = rgb(0, 0, 0);

            // --- 3. Create USER COPY ---
            const userTemplateBytes = await fs.readFile(path.join(__dirname, 'public', 'user_copy.pdf'));
            const userPdfDoc = await PDFDocument.load(userTemplateBytes);
            const userPage = userPdfDoc.getPages()[0];
            const userFont = await userPdfDoc.embedFont(StandardFonts.Helvetica);
            
            // Stamp USER copy (using your "perfect" coordinates)
            userPage.drawText(name, { x: 150, y: 445, size: FONT_SIZE, font: userFont, color: FONT_COLOR });
            userPage.drawText(company, { x: 230, y: 425, size: FONT_SIZE, font: userFont, color: FONT_COLOR });
            userPage.drawText(designation, { x: 290, y: 405, size: FONT_SIZE, font: userFont, color: FONT_COLOR });
            userPage.drawText(`${amount} (${paymentMethod})`, { x: 280, y: 385, size: FONT_SIZE, font: userFont, color: FONT_COLOR });
            userPage.drawText(collectedBy, { x: 250, y: 365, size: FONT_SIZE, font: userFont, color: FONT_COLOR });
            userPage.drawText(collectedOn, { x: 250, y: 345, size: FONT_SIZE, font: userFont, color: FONT_COLOR });

            if (signatureImageBytes) {
                const signatureImage = await (signatureFile.mimetype === 'image/png' ? userPdfDoc.embedPng(signatureImageBytes) : userPdfDoc.embedJpg(signatureImageBytes));
                userPage.drawImage(signatureImage, { x: 50, y: 300, width: 100, height: 40 });
            }
            
            const userPdfBytes = await userPdfDoc.save();
            await fs.mkdir(TEMP_DOWNLOAD_DIR, { recursive: true });
            const tempFilePath = path.join(TEMP_DOWNLOAD_DIR, filename);
            await fs.writeFile(tempFilePath, userPdfBytes);
            console.log(`Successfully generated USER copy: ${filename}`);
            
            uploadToDropbox(userPdfBytes, filename, DROPBOX_USER_FOLDER_PATH).catch(console.error);
            
            // --- 4. Create OFFICIAL COPY ---
            const officialTemplateBytes = await fs.readFile(path.join(__dirname, 'public', 'official.pdf'));
            const officialPdfDoc = await PDFDocument.load(officialTemplateBytes);
            const officialPage = officialPdfDoc.getPages()[0];
            const officialFont = await officialPdfDoc.embedFont(StandardFonts.Helvetica);
            
            // Stamp OFFICIAL copy (using your "perfect" coordinates)
            officialPage.drawText(name, { x: 150, y: 503, size: FONT_SIZE, font: officialFont, color: FONT_COLOR });
            officialPage.drawText(company, { x: 230, y: 483, size: FONT_SIZE, font: officialFont, color: FONT_COLOR });
            officialPage.drawText(designation, { x: 290, y: 463, size: FONT_SIZE, font: officialFont, color: FONT_COLOR });
            officialPage.drawText(`${amount} (${paymentMethod})`, { x: 280, y: 443, size: FONT_SIZE, font: officialFont, color: FONT_COLOR });
            officialPage.drawText(collectedBy, { x: 250, y: 423, size: FONT_SIZE, font: officialFont, color: FONT_COLOR });
            officialPage.drawText(collectedOn, { x: 250, y: 403, size: FONT_SIZE, font: officialFont, color: FONT_COLOR });

            if (signatureImageBytes) {
                const signatureImage = await (signatureFile.mimetype === 'image/png' ? officialPdfDoc.embedPng(signatureImageBytes) : officialPdfDoc.embedJpg(signatureImageBytes));
                officialPage.drawImage(signatureImage, { x: 50, y: 373, width: 100, height: 40 });
            }
            
            const officialPdfBytes = await officialPdfDoc.save();
            uploadToDropbox(officialPdfBytes, filename, DROPBOX_OFFICIAL_FOLDER_PATH).catch(console.error);

            // --- 5. Upload SCREENSHOT ---
            uploadToDropbox(screenshotFile.buffer, screenshotFilename, DROPBOX_OFFICIAL_FOLDER_PATH).catch(console.error);

            // --- 6. Respond to User ---
            res.status(200).json({
                success: true,
                submissionID: submissionID,
                filename: filename
            });

        } catch (error) {
            console.error('Error processing PDF:', error);
            res.status(500).json({ success: false, message: 'Error processing form.' });
        }
    });
});

// 3. The Download Link
app.get('/download-user-copy/:filename', async (req, res) => {
    try {
        const filename = req.params.filename;
        if (filename.includes('..') || filename.includes('/')) {
            return res.status(400).send('Invalid filename.');
        }

        const filePath = path.join(TEMP_DOWNLOAD_DIR, filename);
        await fs.access(filePath); 

        res.download(filePath, filename, (err) => {
            if (err) {
                console.error('Error sending file to user:', err);
            }
            // Cron job handles deletion
        });
    } catch (error) {
        console.error('File download error:', error);
        res.status(404).send('File not found or has expired. Please contact the event organizers for your copy.');
    }
});

// --- 8. START SERVER ---
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
    console.log(`Admin panel is at http://localhost:${port}/admin`);
});
