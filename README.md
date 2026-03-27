# Dashboard Runner App (Mac + Windows)

This app lets a user run your dashboard locally with a simple UI.

## What it does
- User selects your dashboard project folder.
- Runner validates that `package.json` exists.
- Runner runs `npm install`.
- Runner starts the app on chosen port (default `3000`).
- Runner provides/open the localhost URL.
- Runner can check/download app updates from GitHub Releases.

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

## Build installers from GitHub (no local Windows needed)

This repo includes workflows:

- `.github/workflows/build-windows.yml`
- `.github/workflows/build-macos.yml`

### Quick build artifacts (no auto-update publish)
- Push to `main` (Windows workflow runs).
- Or run workflow manually in **Actions**.
- Download artifacts from the run.

### Publish a release for auto-updates
1. Create and push a version tag (example):
   ```bash
   git tag v1.0.1
   git push origin v1.0.1
   ```
2. GitHub Actions builds installers and publishes release assets automatically.
3. Installed Runner apps can then receive updates via **Check for Updates**.

## 2) What you send to another user
- The Runner installer (`.dmg` for Mac, `.exe` for Windows).
- Your dashboard app folder (zip of your app, e.g. `Lawyer.com Database App`).

## 3) What the other user does
1. Install Runner app.
2. Open Runner app.
3. In **Quick Setup**, click **Install Node.js** (only if System Check says missing). Runner asks permission, then launches the installer.
4. Click **Choose Folder** and pick your dashboard app folder.
5. Keep Port = `3000` (or pick another).
6. Click **Quick Start** (recommended) or **Install + Start**.
7. Runner auto-opens the dashboard URL.
8. If needed, use **Copy URL** and paste into browser.

## Auto-update behavior
- In packaged app mode, Runner checks for updates on launch and every 6 hours.
- User can also click **Check for Updates** in the Status panel.
- When an update is downloaded, Runner prompts user to restart and install.

## Free distribution mode (no paid certificates)

This project currently builds unsigned installers by default.

- macOS users may see an Apple verification warning on first open.
  - Open with right-click > **Open** once.
- Windows users may see SmartScreen warnings.
  - Click **More info** > **Run anyway** if needed.

Tag builds (`v*`) still publish release assets for auto-update feeds.

## Requirements on the user's machine
- Node.js 20+ installed (includes npm).
- The dashboard folder must include its `.env` and required data/files.
- If Node/npm is missing, Runner shows it in **System Check**.

## Notes
- If `3000` is busy, choose another port (e.g. `3001`).
- Runner stores last used folder/port.
- Stop app with **Stop** button.
- Runner uses `npm run dev` when available, otherwise `npm run start`.
- If macOS warns the app is from an unidentified developer, right-click app > **Open**.
