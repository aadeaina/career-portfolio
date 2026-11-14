// Sets the owner (maintenance) password. Only a scrypt hash is stored, in Vercel env vars.
//   npm run owner-password
import crypto from "node:crypto";
import readline from "node:readline";
import { spawnSync } from "node:child_process";

function promptHidden(q) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl._writeToOutput = (s) => { if (s.includes(q)) rl.output.write(s); };
    rl.question(q, (a) => { rl.close(); process.stdout.write("\n"); resolve(a); });
  });
}

const a = await promptHidden("Owner password: ");
const b = await promptHidden("Confirm owner password: ");
if (a !== b) { console.error("Passwords do not match."); process.exit(1); }
if (a.length < 12) { console.error("Use at least 12 characters."); process.exit(1); }

const salt = crypto.randomBytes(16);
const hash = `scrypt$${salt.toString("base64")}$${crypto.scryptSync(a, salt, 64).toString("base64")}`;

for (const env of ["production", "development"]) {
  spawnSync("npx", ["vercel@latest", "env", "rm", "OWNER_PASSWORD_HASH", env, "--yes"], { stdio: "ignore" });
  const r = spawnSync("npx", ["vercel@latest", "env", "add", "OWNER_PASSWORD_HASH", env], { input: hash, stdio: ["pipe", "ignore", "inherit"] });
  if (r.status !== 0) { console.error(`Failed to save for ${env}.`); process.exit(1); }
}
console.log("Owner password saved. Redeploy for it to take effect (npm run ship).");
