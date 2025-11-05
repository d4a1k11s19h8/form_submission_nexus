# Dreamz Nexus 2K25 - Secure Sponsorship Portal

This is a full-stack web application built to securely manage sponsor registrations for the Dreamz Nexus 2K25 college fest.

It features a secure admin panel for generating one-time-use links, which are given to authorized sponsors. Sponsors use their unique link to access a form where they can submit their details, payment screenshot, and signature.

The server then automatically generates two separate, stamped PDF receipts, securely uploads all files to a private Dropbox, and provides the sponsor with a temporary download of their copy.

---

## ✨ Key Features

- **Secure Admin Panel:** A private `/admin` route protected by Google OAuth 2.0, allowing only authorized admin emails (defined in an `ADMIN_EMAIL_LIST`) to log in.  
- **One-Time-Use Link Generator:** Admins can generate unique, single-use registration links tied to a sponsor's brand name.  
- **MongoDB Token Database:** Uses MongoDB Atlas to store and validate all one-time-use tokens, preventing multiple submissions and solving race conditions.  
- **Dynamic PDF Generation:** Reads two different PDF templates (`user_copy.pdf` and `official.pdf`) and stamps the sponsor’s data using `pdf-lib`.  
- **Secure File Uploads:** Accepts both signature and payment screenshot uploads with file type validation and a 2MB size limit.  
- **Automated Cloud Storage:** Uses the Dropbox API to upload official PDFs, user copies, and screenshots to secure cloud folders.  
- **Sponsor-Side Download:** Provides a temporary download link for the user copy, cleaned up automatically after one hour using a `node-cron` task.  
- **Full Server-Side Validation:** Verifies all form data to prevent invalid or malicious submissions.  
- **Anti-Sleep Mechanism:** Designed for Render hosting, kept alive via an external ping service.  

---

## 🧠 Tech Stack

- **Backend:** Node.js, Express.js  
- **Database:** MongoDB Atlas  
- **File Storage:** Dropbox API  
- **Authentication:** Passport.js (Google OAuth 2.0)  
- **Session Management:** `express-session` with `connect-mongo`  
- **PDF Manipulation:** `pdf-lib`  
- **File Uploads:** `multer`  
- **Scheduling:** `node-cron`  
- **Hosting:** Render  


## 📁 Project Structure
```
/
├── public/
│   ├── index.html           # Sponsor Form
│   ├── admin.html           # Admin Panel
│   ├── form-logic.js
│   ├── admin-logic.js
│   ├── logo.png
│   ├── sponsor1.png
│   ├── user_copy.pdf        # Template
│   └── official.pdf         # Template
│
├── temp-downloads/          # Temporary storage (auto-cleared hourly)
│
├── .env                     # Secret keys (DO NOT COMMIT)
├── .gitignore               # Hides .env and node_modules
├── package.json             # Dependencies
└── server.js                # Main Express server

```

## 🚀 Setup and Installation

### 1. External Services Setup

#### 🧩 MongoDB Atlas
1. Create a free M0 cluster.  
2. Create a database user with a secure password.  
3. Allow access from anywhere (`0.0.0.0/0`).  
4. Copy your connection string.

#### 📦 Dropbox
1. Create a new Dropbox App with **Full Dropbox** access.  
2. Enable `files.content.write` in **Permissions**.  
3. Copy your **App Key** and **App Secret**.  
4. Generate a **Permanent Refresh Token** (via OAuth guide).  
5. Create folders:  
   - `/Sponsor Submissions/Official-Copies`  
   - `/Sponsor Submissions/User-Copies`

#### 🔑 Google Cloud Platform
1. Create a new **OAuth 2.0 Client ID**.  
2. Add redirect URIs:  
   - `http://localhost:3000/auth/google/callback`  
   - `https://your-app-name.onrender.com/auth/google/callback`  
3. Copy your **Client ID** and **Client Secret**.

---

### 2. Environment Variables (.env)

Create a `.env` file in the project root and add:

# MongoDB
MONGODB_URI=mongodb+srv://YOUR_MONGO_USERNAME:YOUR_MONGO_PASSWORD@...
MONGODB_DB_NAME=dreamz_sponsors

# Dropbox
DROPBOX_APP_KEY=YOUR_APP_KEY_HERE
DROPBOX_APP_SECRET=YOUR_APP_SECRET_HERE
DROPBOX_REFRESH_TOKEN=YOUR_PERMANENT_REFRESH_TOKEN_HERE

# Dropbox Folder Paths
DROPBOX_OFFICIAL_FOLDER_PATH=/Sponsor Submissions/Official-Copies
DROPBOX_USER_FOLDER_PATH=/Sponsor Submissions/User-Copies

# Google OAuth
GOOGLE_CLIENT_ID=YOUR_GOOGLE_CLIENT_ID_HERE
GOOGLE_CLIENT_SECRET=YOUR_GOOGLE_CLIENT_SECRET_HERE

# Admin & Session
ADMIN_EMAIL_LIST=your-email@gmail.com,other-admin@gmail.com
SESSION_SECRET=a-very-long-random-string-for-security
BASE_URL=http://localhost:3000

---

### 3. Run Locally

git clone https://github.com/d4a1k11s19h8/form_submission_nexus.git
cd form_submission_nexus

npm install
node server.js

Access:
- Sponsor Form → http://localhost:3000
- Admin Panel → http://localhost:3000/admin

---

## ☁️ Deployment (Render)

1. Push to GitHub (ensure `.gitignore` hides `.env` and `node_modules`).  
2. Create a new Render **Web Service** and connect your repo.  
3. Set:  
   - Runtime: Node  
   - Build Command: npm install  
   - Start Command: npm start  
   - Region: Singapore (Southeast Asia)  
   - Plan: Free  
4. Add all 11 environment variables from `.env`.  
5. Update `BASE_URL` to your live site (e.g., `https://dreamz-form.onrender.com`).  
6. Keep the site awake using [UptimeRobot](https://uptimerobot.com/).

---

## 🛡️ License

Licensed under the MIT License for educational and non-commercial use.

---

## 💡 Author

Developed by: Daksh Rathore  
Year: 2025  
Project: Dreamz Nexus 2K25 – Secure Sponsorship Portal
