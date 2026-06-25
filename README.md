# IEEE MergeMail 📧

IEEE MergeMail is a premium, high-performance, and responsive mail merge web application designed to help you send personalized bulk emails instantly. It features a sleek dark-theme user interface, live template previewing, dynamic placeholder injection, custom attachments (supporting direct file uploads, remote web URLs, and client-encrypted MEGA.nz links), SMTP custom configuration, and live queue tracking.

---

## ✨ Features

- 📂 **Flexible Data Import**: Drag & drop CSV or Excel (`.xlsx`, `.xls`) files to load recipient lists.
- 🏷️ **Dynamic Placeholders**: Automatically detect columns (e.g., `{{Email}}`, `{{Name}}`, `{{Company}}`) and click to insert them as template tags.
- 📎 **Advanced Attachments**: 
  - Upload local files directly in the browser.
  - Specify file names or web URLs (standard HTTP/HTTPS links) in your spreadsheet columns.
  - **MEGA.nz Integration**: Resolves, decrypts, and downloads files from shared MEGA links automatically before sending.
- 👁️ **Live Interactive Preview**: Step through recipients to preview exactly how each personalized email will render (HTML/Plain Text) in real-time.
- ⚙️ **SMTP Server Customizer**: Connect secure connection profiles (supporting SSL/TLS, custom ports, and App Passwords for Gmail).
- 📊 **Real-time Queue Monitor**: Control bulk sending speed with custom delays, pause/resume/stop execution, and view full success/error logs.
- 🎉 **Celebration Effects**: Built-in animations to celebrate successfully completed bulk campaigns.

---

## 🛠️ Tech Stack

- **Frontend**: HTML5, Vanilla CSS3 (Custom Glassmorphism theme), Javascript (ES6), FontAwesome Icons.
- **Backend API**: Node.js, Express, Nodemailer.
- **Data Parsers**: PapaParse (CSV parser), SheetJS (Excel workbook parser).
- **Network Resolution**: `megajs` (for MEGA.nz shared link resolution and buffer downloads).
- **Platform Deployments**: Pre-configured for deployment on **Vercel** (`vercel.json`).

---

## 🚀 How to Run Locally

### 1. Clone the Project
```bash
git clone https://github.com/Abhijit12322/Mail_merge_web.git
cd Mail_merge_web
```

### 2. Install Dependencies
Ensure you have Node.js installed, then run:
```bash
npm install
```

### 3. Start the Server
```bash
npm start
```
By default, the server will start on port `3000`. Open your browser and navigate to:
```
http://localhost:3000
```

---

## ☁️ Deployment

This project is pre-configured for serverless hosting on **Vercel**.

1. Connect your repository to your **Vercel Dashboard**.
2. Vercel will automatically read the `vercel.json` and deploy:
   - `/api/send-email` as a Serverless API handler.
   - The `/public` directory containing static frontend assets.

---

## 🔒 SMTP Security Reminder

For **Gmail** users, standard login passwords will be blocked. You **must** generate a 16-character **App Password**:
1. Go to your Google Account Settings.
2. Enable **2-Step Verification**.
3. Search for **App Passwords** in your account settings.
4. Generate a password for "Mail" and copy the 16-character code into the SMTP settings.
