# Dashboard Runner App (Mac + Windows)

This app lets a user run your dashboard locally with a simple UI.

## What it does
- User selects your dashboard project folder.
- Runner validates that `package.json` exists.
- Runner runs `npm install`.
- Runner starts the app on chosen port (default `3000`).
- Runner provides/open the localhost URL.

## 1) Build the Runner app (you do this once)

In terminal:

```bash
cd "/Users/zachwaits/Documents/Runner App"
npm install
```

For Mac installer:

```bash
npm run build:mac
```

For Windows installer (run this on a Windows machine):

```bash
npm run build:win
```

Optional portable Windows `.exe`:

```bash
npm run build:win:portable
```

Installers will be in `dist/`.

## Build Windows installer from GitHub (no local Windows needed)

This repo includes GitHub Actions workflows:

- `.github/workflows/build-windows.yml`
- `.github/workflows/build-macos.yml`

After you push to GitHub:

1. Open your repo on GitHub.
2. Go to **Actions**.
3. Run **Build Windows Installer**.
4. Download artifact `dashboard-runner-windows` from the run.

## 2) What you send to another user
- The Runner installer (`.dmg` for Mac, `.exe` for Windows).
- Your dashboard app folder (zip of your app, e.g. `Lawyer.com Database App`).

## 3) What the other user does
1. Install Runner app.
2. Open Runner app.
3. In **Quick Setup**, click **Install Node.js** (only if System Check says missing), then finish Node install.
4. Click **Choose Folder** and pick your dashboard app folder.
5. Keep Port = `3000` (or pick another).
6. Click **Quick Start** (recommended) or **Install + Start**.
7. Runner auto-opens the dashboard URL.

## Requirements on the user's machine
- Node.js 20+ installed (includes npm).
- The dashboard folder must include its `.env` and required data/files.
- If Node/npm is missing, Runner shows it in **System Check**.

## Notes
- If `3000` is busy, choose another port (e.g. `3001`).
- Runner stores last used folder/port.
- Stop app with **Stop** button.
- Runner uses `npm run dev` when available, otherwise `npm run start`.
