# Private portfolio (encrypted, GitHub Pages)

A single-page React app. All personal content is AES-256-GCM encrypted into `public/vault.json`.
Visitors type a password and the page decrypts in their browser. Nothing readable is in the repo or the bundle.

## Update content or change the password

1. Edit `private/content.json` (and `private/resume.pdf`). This folder is gitignored and stays on your machine.
2. `npm run encrypt` asks for the password (12+ characters) and rewrites `public/vault.json`.
3. Commit and push `public/vault.json`. GitHub Actions builds and deploys to Pages.

Keep a backup of `private/`. Without it you would have to rebuild the content from scratch.

## Local dev

```bash
npm install
npm run dev
```

## Security notes

- The key comes from the password via PBKDF2-SHA256 with 600k iterations. A long, random password is the only protection, because anyone can download the vault and try to guess it offline.
- To revoke access, re-encrypt with a new password and push. People who saved the old vault can still open that old copy.
- "Keep unlocked in this tab" keeps the derived key in `sessionStorage` until the tab closes.
