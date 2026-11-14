// Thin client for the Vercel function at /api/*. Sessions are HttpOnly cookies.
async function call(path, { method = "GET", body } = {}) {
  const r = await fetch(`/api/${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    credentials: "same-origin",
    cache: "no-store",
  });
  if (r.status === 204) return null;
  const data = r.headers.get("content-type")?.includes("json") ? await r.json() : null;
  if (!r.ok) {
    const err = new Error(data?.error || `Request failed (${r.status})`);
    err.status = r.status;
    throw err;
  }
  return data;
}

export const api = {
  content: () => call("content"),
  redeem: (code) => call("redeem", { method: "POST", body: { code } }),
  track: (page) => call("track", { method: "POST", body: { page } }).catch(() => {}),
  logout: () => call("logout", { method: "POST" }),
  login: (password) => call("admin/login", { method: "POST", body: { password } }),
  invites: () => call("admin/invites"),
  createInvite: (label, ttlHours) => call("admin/invites", { method: "POST", body: { label, ttlHours } }),
  revokeInvite: (code) => call("admin/invites/revoke", { method: "POST", body: { code } }),
  deleteInvite: (code) => call("admin/invites/delete", { method: "POST", body: { code } }),
  visits: () => call("admin/visits"),
  clearVisits: () => call("admin/visits/clear", { method: "POST" }),
  settings: () => call("admin/settings"),
  saveSettings: (s) => call("admin/settings", { method: "PUT", body: s }),
  uploadResume: (name, data) => call("admin/resume", { method: "PUT", body: { name, data } }),
};

export async function downloadResume() {
  const r = await fetch("/api/resume", { credentials: "same-origin", cache: "no-store" });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Download unavailable");
  const url = URL.createObjectURL(await r.blob());
  const name = /filename="([^"]+)"/.exec(r.headers.get("content-disposition") || "")?.[1] || "resume.pdf";
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
