// Uploads private/content.json (and private/resume.pdf on first run) to Redis,
// encrypted with CONTENT_KEY. Run after `vercel env pull .env.local`.
//   npm run seed            -> content only (keeps the resume managed in the admin panel)
//   npm run seed -- --resume -> also replace the resume with private/resume.pdf
import { readFile } from "node:fs/promises";
import crypto from "node:crypto";
import { Redis } from "@upstash/redis";

const env = Object.fromEntries(
  (await readFile(".env.local", "utf8")).split("\n").filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, "")]; }),
);
const url = env.UPSTASH_REDIS_REST_URL || env.KV_REST_API_URL;
const token = env.UPSTASH_REDIS_REST_TOKEN || env.KV_REST_API_TOKEN;
if (!url || !token || !env.CONTENT_KEY) { console.error("Missing Redis or CONTENT_KEY in .env.local — run `npx vercel env pull .env.local` first."); process.exit(1); }

const key = Buffer.from(env.CONTENT_KEY, "base64");
const seal = (obj) => {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([c.update(JSON.stringify(obj)), c.final()]);
  return `${iv.toString("base64")}.${ct.toString("base64")}.${c.getAuthTag().toString("base64")}`;
};

const redis = new Redis({ url, token });
const content = JSON.parse(await readFile("private/content.json", "utf8"));
await redis.set("content", seal(content));
console.log("Content uploaded.");

const hasResume = await redis.exists("resume");
if (!hasResume || process.argv.includes("--resume")) {
  const pdf = await readFile("private/resume.pdf");
  await redis.set("resume", seal({ name: "resume.pdf", data: pdf.toString("base64"), updated: Date.now() }));
  console.log(`Resume uploaded (${Math.round(pdf.length / 1024)} KB).`);
}
if (!(await redis.exists("settings"))) await redis.set("settings", { resumeDownload: true });
console.log("Done.");
