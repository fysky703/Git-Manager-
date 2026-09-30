# Git Manager — Folder & Zip to GitHub (static)

Pick a folder or a `.zip` in the browser → preview code as HTML → build a zip locally → push files to GitHub with a token. No server.

## Structure

- `index.html` — UI only
- `css/app.css` — styles
- `js/app.js` — folder pick, zip extract (JSZip), code preview, Contents-API push
- `vercel.json` — CSP + security headers
- `package.json`, `.gitignore`

## Deploy to Vercel

1. Push this folder to GitHub.
2. Vercel → Import → Framework: **Other**, Build empty, Output `.`

## Push from the web tool

1. Open the deployed page.
2. 📁 Pick folder (or 🤐 Pick zip — extracted in-browser, HTML preview only, nothing uploaded).
3. Fill `owner/repo`, branch, commit message, PAT (`Contents: read/write`).
4. ⬆ Push. Files &lt; ~900KB each go via Contents API. Token stays in page memory only.

## Security

- Token is never stored (no localStorage) and never committed.
- Use a fine-grained token scoped to one repo. Revoke after use on shared devices.
- Never put secrets in pushed files.
