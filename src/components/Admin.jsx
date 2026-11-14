// Owner-only maintenance panel: visitor insights, one-time QR invites, settings.
import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { api, downloadResume } from "../api.js";

const EVENT_LABELS = {
  redeem: "Opened invite", open: "Loaded portfolio", page: "Viewed page", download: "Downloaded resume",
  "reused-invite": "Reused one-time link", "revoked-invite": "Used revoked link", "invalid-invite": "Invalid link",
  "owner-login": "Owner sign-in", "owner-login-failed": "Failed owner sign-in", "owner-login-blocked": "Owner sign-in blocked",
};
const SECURITY = new Set(["reused-invite", "revoked-invite", "invalid-invite", "owner-login-failed", "owner-login-blocked"]);
const DURATIONS = [[1, "1 hour"], [24, "24 hours"], [72, "3 days"], [168, "7 days"], [720, "30 days"]];

const fmt = (t) => (t ? new Date(t).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "—");
const ago = (t) => {
  const s = Math.round((Date.now() - t) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};
const place = (v) => [v.city, v.region, v.country].filter(Boolean).join(", ") || "—";
const inviteLink = (code) => `${window.location.origin}/#/invite/${code}`;
const countryFlag = (cc) => (cc && cc.length === 2 ? String.fromCodePoint(...[...cc.toUpperCase()].map((c) => 127397 + c.charCodeAt(0))) : "");

function Insights() {
  const [rows, setRows] = useState(null);
  const [filter, setFilter] = useState("all");
  const [err, setErr] = useState("");
  const load = () => api.visits().then(setRows).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, []);

  const shown = useMemo(() => (rows || []).filter((r) =>
    filter === "all" ? true : filter === "security" ? SECURITY.has(r.ev) : filter === "owner" ? r.ev.startsWith("owner") : r.ev === filter), [rows, filter]);

  const stats = useMemo(() => {
    const v = (rows || []).filter((r) => !r.ev.startsWith("owner"));
    const byInvite = {};
    v.forEach((r) => {
      if (!r.label) return;
      const b = (byInvite[r.label] ||= { label: r.label, opens: 0, pages: 0, downloads: 0, last: 0, where: place(r), device: `${r.browser} · ${r.os}`, ip: r.ip });
      if (r.ev === "open" || r.ev === "redeem") b.opens++;
      if (r.ev === "page") b.pages++;
      if (r.ev === "download") b.downloads++;
      if (r.t > b.last) { b.last = r.t; b.where = place(r); b.ip = r.ip; b.device = `${r.browser} · ${r.os}`; }
    });
    const countries = {};
    v.forEach((r) => { if (r.country) countries[r.country] = (countries[r.country] || 0) + 1; });
    return {
      visitors: Object.keys(byInvite).length,
      opens: v.filter((r) => r.ev === "redeem" || r.ev === "open").length,
      pages: v.filter((r) => r.ev === "page").length,
      downloads: v.filter((r) => r.ev === "download").length,
      ips: new Set(v.map((r) => r.ip).filter(Boolean)).size,
      security: (rows || []).filter((r) => SECURITY.has(r.ev)).length,
      byInvite: Object.values(byInvite).sort((a, b) => b.last - a.last),
      countries: Object.entries(countries).sort((a, b) => b[1] - a[1]),
    };
  }, [rows]);

  const exportCsv = () => {
    const cols = ["t", "ev", "label", "ip", "city", "region", "country", "lat", "lon", "tz", "browser", "os", "device", "lang", "page", "ua"];
    const esc = (x) => `"${String(x ?? "").replace(/"/g, '""')}"`;
    const csv = [cols.join(","), ...shown.map((r) => cols.map((c) => esc(c === "t" ? new Date(r.t).toISOString() : r[c])).join(","))].join("\n");
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(new Blob([csv], { type: "text/csv" })), download: "visits.csv" });
    a.click();
  };

  if (err) return <div className="err">{err}</div>;
  if (!rows) return <p className="muted">Loading insights…</p>;
  const maxC = Math.max(1, ...stats.countries.map((c) => c[1]));
  return (
    <div className="admin-section">
      <div className="stats admin-stats">
        {[["Visitors", stats.visitors], ["Opens", stats.opens], ["Page views", stats.pages], ["Downloads", stats.downloads], ["Unique IPs", stats.ips], ["Security alerts", stats.security]].map(([l, v]) => (
          <div className={`glass stat ${l === "Security alerts" && v ? "alert" : ""}`} key={l}><strong>{v}</strong><span>{l}</span></div>
        ))}
      </div>

      <div className="admin-two">
        <div className="glass admin-card">
          <h4>By invite</h4>
          {stats.byInvite.length === 0 ? <p className="muted">No visits yet. Create an invite and share its QR code.</p> : (
            <div className="table-wrap"><table>
              <thead><tr><th>Who</th><th>Last seen</th><th>Opens</th><th>Pages</th><th>PDF</th><th>Where</th><th>Device</th></tr></thead>
              <tbody>{stats.byInvite.map((b) => (
                <tr key={b.label}><td><strong>{b.label}</strong></td><td>{ago(b.last)}</td><td>{b.opens}</td><td>{b.pages}</td><td>{b.downloads}</td><td>{b.where}<br /><small className="mono">{b.ip}</small></td><td>{b.device}</td></tr>
              ))}</tbody>
            </table></div>
          )}
        </div>
        <div className="glass admin-card">
          <h4>Countries</h4>
          {stats.countries.length === 0 ? <p className="muted">—</p> : stats.countries.map(([cc, n]) => (
            <div className="bar-row" key={cc}><span>{countryFlag(cc)} {cc}</span><div className="bar"><i style={{ width: `${(n / maxC) * 100}%` }} /></div><b>{n}</b></div>
          ))}
        </div>
      </div>

      <div className="glass admin-card">
        <div className="admin-card-head">
          <h4>Event log</h4>
          <div className="row-actions">
            <select value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filter events">
              <option value="all">All events</option><option value="redeem">Invite opened</option><option value="open">Portfolio loaded</option>
              <option value="page">Page views</option><option value="download">Downloads</option><option value="security">Security alerts</option><option value="owner">Owner activity</option>
            </select>
            <button className="btn ghost sm" onClick={load}>Refresh</button>
            <button className="btn ghost sm" onClick={exportCsv} disabled={!shown.length}>Export CSV</button>
            <button className="btn ghost sm danger" onClick={() => confirm("Clear the whole visit log? This cannot be undone.") && api.clearVisits().then(load)}>Clear</button>
          </div>
        </div>
        <div className="table-wrap tall"><table>
          <thead><tr><th>Time</th><th>Event</th><th>Who</th><th>IP address</th><th>Location</th><th>Device</th><th>Language / TZ</th><th>Page</th></tr></thead>
          <tbody>{shown.slice(0, 500).map((r, i) => (
            <tr key={i} className={SECURITY.has(r.ev) ? "sec" : ""} title={r.ua || ""}>
              <td className="nowrap">{fmt(r.t)}</td>
              <td>{EVENT_LABELS[r.ev] || r.ev}</td>
              <td>{r.label || "—"}</td>
              <td className="mono">{r.ip || "—"}</td>
              <td>{countryFlag(r.country)} {place(r)}{r.lat && r.lon && <> · <a href={`https://www.openstreetmap.org/?mlat=${r.lat}&mlon=${r.lon}#map=10/${r.lat}/${r.lon}`} target="_blank" rel="noreferrer">map</a></>}</td>
              <td>{r.browser} · {r.os} · {r.device}</td>
              <td>{r.lang || "—"}<br /><small>{r.tz || ""}</small></td>
              <td className="mono">{r.page || ""}</td>
            </tr>
          ))}</tbody>
        </table></div>
        {shown.length > 500 && <p className="fine">Showing the latest 500 — export CSV for all {shown.length}.</p>}
        <p className="fine">Location comes from the visitor's IP address and is approximate (city level). Hover a row for the full user agent.</p>
      </div>
    </div>
  );
}

function QrCard({ inv, onRevoke, onDelete }) {
  const [qr, setQr] = useState("");
  const link = inviteLink(inv.code);
  useEffect(() => {
    if (inv.status === "new") QRCode.toDataURL(link, { margin: 1, width: 360, color: { dark: "#0b1a28", light: "#ffffff" } }).then(setQr);
  }, [link, inv.status]);
  const status = inv.status === "revoked" ? "Revoked" : inv.status === "new" ? "Not used yet" : inv.expired ? "Expired" : "Active";
  const copy = () => navigator.clipboard?.writeText(link);
  return (
    <div className={`glass invite ${inv.status}`}>
      <div className="invite-head">
        <div><h4>{inv.label}</h4><small className="muted">Created {fmt(inv.created)} · {DURATIONS.find((d) => d[0] === inv.ttlHours)?.[1] || `${inv.ttlHours}h`} access</small></div>
        <span className={`badge ${status.toLowerCase().replace(/ /g, "-")}`}>{status}</span>
      </div>
      {inv.status === "new" && qr && (
        <div className="qr-row">
          <img src={qr} alt={`QR code for ${inv.label}`} className="qr" />
          <div className="qr-actions">
            <p className="muted">Works once. The first device to open it gets access for {DURATIONS.find((d) => d[0] === inv.ttlHours)?.[1] || `${inv.ttlHours} hours`}.</p>
            <button className="btn primary sm" onClick={copy}>Copy link</button>
            <a className="btn ghost sm" href={qr} download={`invite-${inv.label.replace(/\W+/g, "-")}.png`}>Download QR</a>
            <p className="fine">Don't open it yourself — that uses it up.</p>
          </div>
        </div>
      )}
      {inv.status !== "new" && inv.usedAt && (
        <p className="muted small">Opened {fmt(inv.usedAt)} from <span className="mono">{inv.usedIp}</span> · {inv.browser} on {inv.os}{inv.expiresAt ? ` · access ${inv.expiresAt > Date.now() ? "until" : "ended"} ${fmt(inv.expiresAt)}` : ""}</p>
      )}
      <div className="row-actions">
        {inv.status !== "revoked" && <button className="btn ghost sm danger" onClick={() => onRevoke(inv.code)}>{inv.status === "new" ? "Cancel invite" : "Revoke access"}</button>}
        {(inv.status === "revoked" || inv.expired) && <button className="btn ghost sm" onClick={() => onDelete(inv.code)}>Remove</button>}
      </div>
    </div>
  );
}

function Invites() {
  const [list, setList] = useState(null);
  const [label, setLabel] = useState("");
  const [ttl, setTtl] = useState(24);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const load = () => api.invites().then(setList).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, []);
  const create = async (e) => {
    e.preventDefault();
    setBusy(true); setErr("");
    try { await api.createInvite(label.trim() || "Untitled", ttl); setLabel(""); await load(); }
    catch (e2) { setErr(e2.message); }
    finally { setBusy(false); }
  };
  return (
    <div className="admin-section">
      <form className="glass admin-card invite-form" onSubmit={create}>
        <h4>New one-time invite</h4>
        <div className="form-row">
          <label className="field grow"><span>Who is it for?</span><input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Jane Doe — Acme recruiting" maxLength={80} /></label>
          <label className="field"><span>Access lasts</span>
            <select value={ttl} onChange={(e) => setTtl(Number(e.target.value))}>{DURATIONS.map(([h, l]) => <option key={h} value={h}>{l}</option>)}</select>
          </label>
          <button className="btn primary" disabled={busy}>{busy ? "Creating…" : "Create QR code"}</button>
        </div>
        {err && <div className="err">{err}</div>}
      </form>
      {!list ? <p className="muted">Loading…</p> : list.length === 0 ? <p className="muted">No invites yet.</p> : (
        <div className="invite-grid">
          {list.map((inv) => (
            <QrCard key={inv.code} inv={inv}
              onRevoke={(c) => confirm("Revoke this invite? Anyone using it loses access immediately.") && api.revokeInvite(c).then(load)}
              onDelete={(c) => api.deleteInvite(c).then(load)} />
          ))}
        </div>
      )}
    </div>
  );
}

function Settings({ onSettings }) {
  const [data, setData] = useState(null);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const load = () => api.settings().then(setData).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, []);
  const toggle = async () => {
    const r = await api.saveSettings({ resumeDownload: !data.settings.resumeDownload });
    setData((d) => ({ ...d, settings: r.settings }));
    onSettings?.(r.settings);
    setMsg(r.settings.resumeDownload ? "Visitors can download your resume." : "Resume download hidden from visitors.");
  };
  const upload = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setErr(""); setMsg("Uploading…");
    try {
      const b64 = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(",")[1]); r.onerror = rej; r.readAsDataURL(f); });
      await api.uploadResume(f.name, b64);
      setMsg(`Resume replaced with ${f.name}.`);
      load();
    } catch (e2) { setErr(e2.message); setMsg(""); }
  };
  if (err && !data) return <div className="err">{err}</div>;
  if (!data) return <p className="muted">Loading…</p>;
  return (
    <div className="admin-section settings-grid">
      <div className="glass admin-card">
        <h4>Resume download</h4>
        <div className="toggle-row">
          <div><strong>Show "Download resume" to visitors</strong><p className="muted small">You can always download it while signed in as owner.</p></div>
          <button className={`switch ${data.settings.resumeDownload ? "on" : ""}`} role="switch" aria-checked={data.settings.resumeDownload} onClick={toggle}><span /></button>
        </div>
      </div>
      <div className="glass admin-card">
        <h4>Resume file</h4>
        {data.resume ? <p className="muted small">Current: <strong>{data.resume.name}</strong> · {Math.round(data.resume.size / 1024)} KB · updated {fmt(data.resume.updated)}</p> : <p className="muted small">No resume uploaded.</p>}
        <div className="row-actions">
          <label className="btn primary sm file-btn">Upload new PDF<input type="file" accept="application/pdf" onChange={upload} hidden /></label>
          {data.resume && <button className="btn ghost sm" onClick={() => downloadResume().catch((e2) => setErr(e2.message))}>Download current</button>}
        </div>
        <p className="fine">PDF only, up to 600 KB. Takes effect immediately; no redeploy.</p>
      </div>
      <div className="glass admin-card">
        <h4>Owner password</h4>
        <p className="muted small">To change it, run this in the project folder, then redeploy:</p>
        <code className="cmd">npm run owner-password</code>
      </div>
      {(msg || err) && <div className={err ? "err" : "ok"} role="status">{err || msg}</div>}
    </div>
  );
}

export default function Admin({ sub, onSettings }) {
  const tab = ["insights", "invites", "settings"].includes(sub) ? sub : "insights";
  return (
    <>
      <div className="page-head">
        <div className="kicker">Owner only</div>
        <h1 className="page-title">Admin</h1>
        <p className="lede sm">Invites, visitor insights and settings. Visitors never see this page.</p>
      </div>
      <div className="tabs" role="tablist">
        {[["insights", "Insights"], ["invites", "Invites & QR codes"], ["settings", "Settings"]].map(([id, l]) => (
          <a key={id} role="tab" aria-selected={tab === id} href={`#/admin/${id}`} className={`pill ${tab === id ? "on" : ""}`}>{l}</a>
        ))}
      </div>
      {tab === "insights" && <Insights />}
      {tab === "invites" && <Invites />}
      {tab === "settings" && <Settings onSettings={onSettings} />}
    </>
  );
}
