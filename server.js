require('dotenv').config(); 
const express = require('express');
const multer = require('multer');
const fs = require('fs').promises;
const path = require('path');
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const { Dropbox } = require('dropbox'); // Using Dropbox
const { randomBytes } = require('crypto');

const app = express();
const port = 3000;

// --- 1. DROPBOX SETUP (CHANGE THIS) ---
const DROPBOX_ACCESS_TOKEN = process.env.DROPBOX_ACCESS_TOKEN; // <-- CHANGE THIS LINE
const DROPBOX_FOLDER_PATH = '/Sponsor Submissions'; // <-- The exact name of your Dropbox folder
// ---------------------------------------------

// Path for temporary user downloads
const TEMP_DOWNLOAD_DIR = path.join(__dirname, 'temp-downloads');

// Initialize Dropbox
const dbx = new Dropbox({ accessToken: DROPBOX_ACCESS_TOKEN });

const upload = multer({ storage: multer.memoryStorage() });
app.use(express.static('public')); // Serve files from the 'public' folder

/**
 * Uploads the generated PDF to Dropbox (Official Copy)
 */
async function uploadToDropbox(pdfBytes, fileName) {
    const fullDropboxPath = `${DROPBOX_FOLDER_PATH}/${fileName}`;
    try {
        const response = await dbx.filesUpload({
            path: fullDropboxPath,
            contents: pdfBytes,
            mode: 'add',
            autorename: true
        });
        console.log(`Successfully uploaded OFFICIAL copy to Dropbox: ${response.result.name}`);
    } catch (error) {
        console.error('Error uploading file to Dropbox:', error);
    }
}

/**
 * --- SUBMIT FORM ENDPOINT ---
 * Generates TWO PDFs: one for the user, one for Dropbox
 */
app.post('/submit-form', upload.single('signature'), async (req, res) => {
    try {
        const { 
            name = '', company = '', designation = '', amount = '0',
            paymentMethod = '', collectedBy = '', collectedOn = ''
        } = req.body;
        
        // 1. Generate the unique "key" (Submission ID) and filename
        const submissionID = `SPONSOR-${randomBytes(4).toString('hex').toUpperCase()}`;
        const safeUsername = name.replace(/[^a-z0-9]/gi, '_') || 'Sponsor';
        const filename = `${safeUsername}_${submissionID}.pdf`;

        const signatureFile = req.file;
        let signatureImageBytes = null;
        
        // Load signature image bytes once
        if (signatureFile) {
            if (signatureFile.mimetype === 'image/png') {
                signatureImageBytes = signatureFile.buffer;
            } else if (signatureFile.mimetype === 'image/jpeg') {
                signatureImageBytes = signatureFile.buffer;
            }
        }

        const FONT_SIZE = 10;
        const FONT_COLOR = rgb(0, 0, 0);

        // --- NEW COORDINATES ---
        // These are new Y-coordinates, estimated from your new PDFs.
        // They are applied to BOTH templates.
        const Y_NAME = 450;
        const Y_COMPANY = 430;
        const Y_DESIGNATION = 410;
        const Y_AMOUNT = 390;
        const Y_COLLECTED_BY = 370;
        const Y_COLLECTED_ON = 350;
        const Y_SIGNATURE = 300; // Guessing this is lower

        // --- 2. CREATE USER COPY ---
        const userTemplateBytes = await fs.readFile(path.join(__dirname, 'user_copy.pdf'));
        const userPdfDoc = await PDFDocument.load(userTemplateBytes);
        const userPage = userPdfDoc.getPages()[0];
        const userFont = await userPdfDoc.embedFont(StandardFonts.Helvetica);

        // Stamp data onto USER copy
        userPage.drawText(name, { x: 150, y: Y_NAME, size: FONT_SIZE, font: userFont, color: FONT_COLOR });
        userPage.drawText(company, { x: 230, y: Y_COMPANY, size: FONT_SIZE, font: userFont, color: FONT_COLOR });
        userPage.drawText(designation, { x: 290, y: Y_DESIGNATION, size: FONT_SIZE, font: userFont, color: FONT_COLOR });
        userPage.drawText(`${amount} (${paymentMethod})`, { x: 280, y: Y_AMOUNT, size: FONT_SIZE, font: userFont, color: FONT_COLOR });
        userPage.drawText(collectedBy, { x: 250, y: Y_COLLECTED_BY, size: FONT_SIZE, font: userFont, color: FONT_COLOR });
        userPage.drawText(collectedOn, { x: 250, y: Y_COLLECTED_ON, size: FONT_SIZE, font: userFont, color: FONT_COLOR });

        if (signatureImageBytes) {
            const signatureImage = await (signatureFile.mimetype === 'image/png' 
                ? userPdfDoc.embedPng(signatureImageBytes) 
                : userPdfDoc.embedJpg(signatureImageBytes));
            userPage.drawImage(signatureImage, { x: 50, y: Y_SIGNATURE, width: 100, height: 40 });
        }
        
        // Save the USER COPY
        const userPdfBytes = await userPdfDoc.save();
        await fs.mkdir(TEMP_DOWNLOAD_DIR, { recursive: true });
        const tempFilePath = path.join(TEMP_DOWNLOAD_DIR, filename);
        await fs.writeFile(tempFilePath, userPdfBytes);
        console.log(`Successfully generated USER copy: ${filename}`);

        
        // --- 3. CREATE OFFICIAL COPY ---
        const officialTemplateBytes = await fs.readFile(path.join(__dirname, 'official.pdf'));
        const officialPdfDoc = await PDFDocument.load(officialTemplateBytes);
        const officialPage = officialPdfDoc.getPages()[0];
        const officialFont = await officialPdfDoc.embedFont(StandardFonts.Helvetica);

        // Stamp data onto OFFICIAL copy (using the same coordinates)
        const y_diff=Y_COMPANY-Y_COLLECTED_ON-9;
        officialPage.drawText(name, { x: 150, y: Y_NAME + y_diff, size: FONT_SIZE, font: officialFont, color: FONT_COLOR });
        officialPage.drawText(company, { x: 230, y: Y_COMPANY + y_diff, size: FONT_SIZE, font: officialFont, color: FONT_COLOR });
        officialPage.drawText(designation, { x: 290, y: Y_DESIGNATION + y_diff, size: FONT_SIZE, font: officialFont, color: FONT_COLOR });
        officialPage.drawText(`${amount} (${paymentMethod})`, { x: 280, y: Y_AMOUNT + y_diff, size: FONT_SIZE, font: officialFont, color: FONT_COLOR });
        officialPage.drawText(collectedBy, { x: 250, y: Y_COLLECTED_BY + y_diff, size: FONT_SIZE, font: officialFont, color: FONT_COLOR });
        officialPage.drawText(collectedOn, { x: 250, y: Y_COLLECTED_ON + y_diff, size: FONT_SIZE, font: officialFont, color: FONT_COLOR });

        if (signatureImageBytes) {
            const signatureImage = await (signatureFile.mimetype === 'image/png' 
                ? officialPdfDoc.embedPng(signatureImageBytes) 
                : officialPdfDoc.embedJpg(signatureImageBytes));
            officialPage.drawImage(signatureImage, { x: 50, y: Y_SIGNATURE+ y_diff, width: 100, height: 40 });
        }

        // Save and Upload the OFFICIAL COPY to Dropbox
        const officialPdfBytes = await officialPdfDoc.save();
        uploadToDropbox(officialPdfBytes, filename).catch(console.error);
        
        
        // 4. Respond to the user
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

/**
 * --- DOWNLOAD THE USER'S COPY ---
 * Finds the temp file, sends it, then deletes it.
 */
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
            fs.unlink(filePath, (unlinkErr) => {
                if (unlinkErr) console.error('Error deleting temp file:', unlinkErr);
                else console.log(`Successfully deleted temp file: ${filename}`);
            });
        });

    } catch (error) {
        console.error('File download error:', error);
        res.status(404).send('File not found or has expired.');
    }
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
    console.log('Place user_copy.pdf and official.pdf in this folder.');
    console.log('Make sure the temp-downloads folder exists.');
});