# Git Manager — Folder & Zip to GitHub (static)

Mobile-style UI (form pattern from `webUi.html`): login page, bottom tabs,
cards, toast. Pick a folder or a `.zip` → preview code → zip → push to GitHub.
Firebase Auth keeps you logged in. Repo settings are remembered on-device.
Token stays in page memory only.

> `webUi.html` in this folder is a local UI reference only — it is not deployed.

## Structure

- `index.html` — auth page + Files / Push / Manage views
- `css/app.css` — webUi-style forms
- `js/app.js` — Firebase auth, JSZip extract, Contents-API push, repo admin
- `vercel.json` — CSP + security headers
- `package.json`, `.gitignore`

## Deploy to Vercel

1. Push this folder to GitHub.
2. Vercel → Import → Framework: **Other**, Build empty, Output `.`

## Use

1. Log in / Sign up (Firebase) or Continue as guest.
2. **Files**: 📁 Pick folder or 🤐 Pick zip (extracted in-browser) → preview code → ⬇ Build zip.
3. **Push**: fill `owner/repo`, branch, message, PAT (`Contents: read/write`) → Push.
4. **Manage**: ✨ Create repo · 🗑 Delete file (path + sha lookup) · ☠ Delete repo
   (type name to confirm; token needs `delete_repo` scope).

## Memory

- Firebase persistence `LOCAL` — login survives reload.
- `localStorage` remembers repo / branch / message (never the token or password).

## Security

- Token is memory-only, cleared on logout. Never commit it.
- Fine-grained PAT scoped to needed repos. Revoke after use on shared devices.
- Never put secrets in pushed files.
