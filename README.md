# Private portfolio (Vercel)

A single-page React app that visitors can open only with a one-time QR invite. It also has an owner-only admin panel.

- **Visitors** scan a QR code, which opens `/#/invite/<code>`, then click **Open portfolio**. The first device gets access for the time you chose. Anyone who reuses the link is blocked and logged.
- **Owner** goes to `/#/admin` and signs in with the owner password to manage invites, visitor insights (IP address, approximate location, device, pages viewed, downloads) and settings (turn the resume download on or off, upload a new PDF).

## How it's built

- `api/index.js` is a single Vercel function that handles all `/api/*` routes. It stores invites, the visit log and settings in Upstash Redis (free plan).
- Content and the resume are AES-256-GCM encrypted at rest with `CONTENT_KEY`. Sessions are signed HttpOnly cookies (`SESSION_SECRET`).
- Plaintext content stays in `private/`, which is gitignored and never committed.

## Maintenance

```bash
npm run owner-password     # change the owner password (stores only a scrypt hash)
npx vercel env pull .env.local
npm run seed               # upload private/content.json after editing it
npm run seed -- --resume   # also replace the resume with private/resume.pdf
```

A push to `main` redeploys automatically. `npm run ship` deploys from your machine.
