import { useEffect, useState } from "react";
import { unlock, resume, lock } from "./vault.js";
import Figure from "./components/Figure.jsx";
import Animation from "./components/Animations.jsx";
import Carousel from "./components/Carousel.jsx";

function LockScreen({ onUnlock }) {
  const [pw, setPw] = useState("");
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const submit = async (e) => {
    e.preventDefault();
    if (!pw) return;
    setBusy(true); setErr("");
    try { onUnlock(await unlock(pw, remember)); }
    catch (e2) { setErr(e2.message === "Vault not found" ? "Content is not published yet." : "That password didn't work."); setPw(""); }
    finally { setBusy(false); }
  };
  return (
    <main className="lock">
      <div className="orb o1" /><div className="orb o2" /><div className="orb o3" />
      <form className="glass lock-card" onSubmit={submit}>
        <div className="lock-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2"><rect x="4" y="11" width="16" height="10" rx="2.5" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
        </div>
        <h1>Private portfolio</h1>
        <p className="muted">This page is encrypted end to end. Enter the password you were given to decrypt it in your browser.</p>
        <Animation scene="encryption" height={190} className="lock-anim" />
        <label className="field">
          <span>Password</span>
          <input type="password" autoFocus autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} aria-invalid={!!err} />
        </label>
        <label className="check"><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /> Keep unlocked in this tab</label>
        {err && <div className="err" role="alert">{err}</div>}
        <button className="btn primary" disabled={busy || !pw}>{busy ? "Decrypting…" : "Unlock"}</button>
        <p className="fine">AES-256-GCM · PBKDF2-SHA256 · nothing is sent to a server</p>
      </form>
    </main>
  );
}

/* ---------- routing: #/page or #/page/sub (works on GitHub Pages without a 404 trick) ---------- */
const PAGES = [
  { id: "home", label: "Home", blurb: "The case in one screen." },
  { id: "journey", label: "Journey", blurb: "2012 → today, one chapter at a time." },
  { id: "media", label: "Live media", blurb: "Six animated systems: drones, LiDAR, packets, handshakes, encryption, faces." },
  { id: "patterns", label: "Patterns", blurb: "How I plan, ship and prove cloud platforms." },
  { id: "stack", label: "Stack", blurb: "Every layer from silicon to AI, and the full toolkit." },
  { id: "resume", label: "Resume", blurb: "Full experience, skills and a PDF download." },
];
const parseHash = () => {
  const [page, sub] = window.location.hash.replace(/^#\/?/, "").split("/");
  return { page: PAGES.some((p) => p.id === page) ? page : "home", sub: sub || null };
};
function useRoute() {
  const [route, setRoute] = useState(parseHash);
  useEffect(() => {
    const on = () => { setRoute(parseHash()); window.scrollTo({ top: 0, behavior: "instant" }); };
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return route;
}
const href = (page, sub) => `#/${page}${sub ? `/${sub}` : ""}`;

function Nav({ name, onLock, page }) {
  return (
    <header className="nav glass">
      <a href={href("home")} className="brand">{name.replace(/[“”"]/g, "").split(" ").filter((_, i, a) => i === 0 || i === a.length - 1).join(" ")}</a>
      <nav>{PAGES.map((p) => <a key={p.id} href={href(p.id)} className={page === p.id ? "on" : ""} aria-current={page === p.id ? "page" : undefined}>{p.label}</a>)}</nav>
      <button className="btn ghost sm" onClick={onLock}>Lock</button>
    </header>
  );
}

function Reveal({ children, as: Tag = "div", className = "", ...rest }) {
  const [ref, setRef] = useState(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (!ref) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setShown(true); io.disconnect(); } }, { threshold: 0.12 });
    io.observe(ref);
    return () => io.disconnect();
  }, [ref]);
  return <Tag ref={setRef} className={`reveal ${shown ? "in" : ""} ${className}`} {...rest}>{children}</Tag>;
}

function downloadPdf(b64, name) {
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function PageHead({ kicker, title, lede }) {
  return (
    <Reveal className="page-head">
      <div className="kicker">{kicker}</div>
      <h1 className="page-title">{title}</h1>
      {lede && <p className="lede sm">{lede}</p>}
    </Reveal>
  );
}

function PageFooter({ page }) {
  const i = PAGES.findIndex((p) => p.id === page);
  const prev = PAGES[i - 1], next = PAGES[i + 1];
  return (
    <nav className="pager" aria-label="Page navigation">
      {prev ? <a className="glass pager-link" href={href(prev.id)}><small>← Previous</small><strong>{prev.label}</strong></a> : <span />}
      {next && <a className="glass pager-link next" href={href(next.id)}><small>Next →</small><strong>{next.label}</strong></a>}
    </nav>
  );
}

/* ---------------- pages ---------------- */
function Home({ c, data }) {
  const p = c.profile;
  const previews = { journey: "drones", media: "face", patterns: null, stack: null, resume: null };
  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <div className="kicker">Candidate dossier · {p.title}</div>
          <h1>{p.name}</h1>
          <p className="lede">{p.tagline}</p>
          <p className="muted">{p.role} · {p.location}</p>
          <div className="actions">
            {data.resumePdf && <button className="btn primary" onClick={() => downloadPdf(data.resumePdf, "resume.pdf")}>Download resume</button>}
            <a className="btn ghost" href={href("journey")}>Start the journey →</a>
          </div>
        </div>
        <div className="glass hero-media">
          <Carousel items={c.media.items} height={300} autoplay={7000} compact start={c.media.items.findIndex((m) => m.scene === "packets")} label="Featured animations" />
        </div>
      </section>
      <Reveal className="stats">
        {c.stats.map((s) => <div className="glass stat" key={s.label}><strong>{s.value}</strong><span>{s.label}</span><small>{s.sub}</small></div>)}
      </Reveal>
      <Reveal className="glass thesis"><div className="kicker">My thesis</div><p>{c.thesis}</p></Reveal>
      <section className="block">
        <Reveal><div className="kicker">Explore</div><h2>Pick a thread</h2></Reveal>
        <div className="explore">
          {PAGES.filter((x) => x.id !== "home").map((x, i) => (
            <Reveal as="a" href={href(x.id)} className="glass explore-card" key={x.id} style={{ "--d": `${i * 60}ms` }}>
              {previews[x.id] && <Animation scene={previews[x.id]} height={130} />}
              <div className="explore-body"><span className="kicker">{String(i + 1).padStart(2, "0")}</span><h3>{x.label}</h3><p>{x.blurb}</p><span className="go">Open →</span></div>
            </Reveal>
          ))}
        </div>
      </section>
    </>
  );
}

const TIMELINE_TO_CHAPTER = { "University of Ilorin": "foundations", "Florida Tech": "foundations", Dell: "dell", Lumen: "web", SeekOps: "web", Kyndryl: "kyndryl", Astound: "astound", "JOSFAITH LLC": "josfaith" };

function Journey({ c, sub }) {
  const chapters = c.chapters;
  const idx = Math.max(0, chapters.findIndex((x) => x.id === sub));
  const ch = chapters[idx];
  const startAt = Math.max(0, c.media.items.findIndex((x) => x.scene === ch.media));
  return (
    <>
      <PageHead kicker="Career progression" title="The journey: 2012 → today" lede="Select a stop on the timeline or a chapter to dive in." />
      <ol className="timeline">
        {c.timeline.map((e) => {
          const target = TIMELINE_TO_CHAPTER[e.org];
          return (
            <li key={e.year + e.org} className={`tl ${e.kind} ${target === ch.id ? "sel" : ""}`}>
              <span className="tl-dot" />
              <a className="glass tl-card" href={href("journey", target)}>
                <span className="tl-year">{e.year}</span><strong>{e.org}</strong><span>{e.role}</span><small>{e.note}</small>
              </a>
            </li>
          );
        })}
      </ol>
      <div className="tabs chapter-tabs" role="tablist">
        {chapters.map((x, i) => (
          <a key={x.id} role="tab" aria-selected={x.id === ch.id} href={href("journey", x.id)} className={`pill ${x.id === ch.id ? "on" : ""}`}>{i + 1}. {x.title.split(/[,—:]/)[0]}</a>
        ))}
      </div>
      <article className="chapter solo" key={ch.id}>
        <div className="kicker">{ch.kicker}</div>
        <h2>{ch.title}</h2>
        <p className="lede sm">{ch.lede}</p>
        <div className="glass media-inline">
          <Carousel items={c.media.items} height={280} start={startAt} label="Chapter animations" />
        </div>
        <Figure figure={ch.figure} />
        <div className="chapter-nav">
          {idx > 0 ? <a className="btn ghost sm" href={href("journey", chapters[idx - 1].id)}>← {chapters[idx - 1].title.split(/[,—:]/)[0]}</a> : <span />}
          {idx < chapters.length - 1 && <a className="btn primary sm" href={href("journey", chapters[idx + 1].id)}>Next chapter →</a>}
        </div>
      </article>
    </>
  );
}

function Media({ c, sub }) {
  const items = c.media.items;
  const startAt = Math.max(0, items.findIndex((m) => m.scene === sub));
  return (
    <>
      <PageHead kicker="Systems in motion" title="Live media" lede={c.media.intro} />
      <div className="glass media-main">
        <Carousel
          items={items}
          height={400}
          start={startAt}
          autoplay={9000}
          thumbs
          label="Live media"
          onChange={(m) => history.replaceState(null, "", href("media", m.scene))}
        />
      </div>
    </>
  );
}

function Patterns({ c, sub }) {
  const pat = c.patterns.items.find((x) => x.id === sub) || c.patterns.items[0];
  return (
    <>
      <PageHead kicker="Architecture & delivery patterns" title="How I plan, ship and prove platforms" lede={c.patterns.intro} />
      <div className="tabs" role="tablist">
        {c.patterns.items.map((x) => (
          <a key={x.id} role="tab" aria-selected={pat.id === x.id} href={href("patterns", x.id)} className={`pill ${pat.id === x.id ? "on" : ""}`}>{x.title}</a>
        ))}
      </div>
      <div className="glass pattern" key={pat.id}>
        <div className="kicker">{pat.kicker}</div>
        <h3>{pat.title}</h3>
        <p className="muted">{pat.lede}</p>
        <Figure figure={pat.figure} />
      </div>
    </>
  );
}

function Stack({ c }) {
  return (
    <>
      <PageHead kicker="The stack I have built in" title="Every layer, first-hand — from silicon to AI" />
      <div className="ladder">
        {c.stack.map((s, i) => (
          <Reveal className="rung glass" key={s.layer} style={{ "--d": `${i * 40}ms`, "--hue": 200 - i * 14 }}>
            <span className="rung-n">{String(c.stack.length - i).padStart(2, "0")}</span>
            <strong>{s.layer}</strong>
            <span className="rung-detail">{s.detail}</span>
            <span className="rung-where">{s.where}</span>
          </Reveal>
        ))}
        <div className="ladder-axis" aria-hidden="true"><span>Abstraction</span></div>
      </div>
      <section className="block">
        <Reveal><div className="kicker">The toolkit</div><h2>A periodic table of my stack</h2></Reveal>
        <div className="periodic">
          {c.toolkit.map((g, gi) => (
            <Reveal className="ptable-group" key={g.group} style={{ "--hue": 170 + gi * 28 }}>
              <div className="pgroup-name">{g.group}</div>
              <div className="elements">
                {g.items.map(([sym, nm], i) => <div className="element" key={nm} title={nm}><small>{gi * 10 + i + 1}</small><b>{sym}</b><span>{nm}</span></div>)}
              </div>
            </Reveal>
          ))}
        </div>
      </section>
      <section className="block">
        <Reveal><div className="kicker">What you get</div><h2>Four commitments</h2></Reveal>
        <div className="commit-grid">
          {c.commitments.map((x, i) => <Reveal className="glass commit" key={x.n} style={{ "--d": `${i * 80}ms` }}><span className="commit-n">{x.n}</span><h4>{x.title}</h4><p>{x.body}</p></Reveal>)}
        </div>
      </section>
    </>
  );
}

function Resume({ c, data }) {
  const p = c.profile;
  return (
    <>
      <Reveal className="resume-head page-head">
        <div><div className="kicker">Resume</div><h1 className="page-title">{p.title}</h1></div>
        {data.resumePdf && <button className="btn primary" onClick={() => downloadPdf(data.resumePdf, "resume.pdf")}>Download PDF</button>}
      </Reveal>
      <Reveal className="glass resume-summary"><p>{p.summary}</p></Reveal>
      <div className="resume-grid">
        <div className="exp">
          {c.resume.experience.map((x) => (
            <Reveal as="article" className="glass job" key={x.org}>
              <header><div><h4>{x.org}</h4><span className="muted">{x.role} · {x.place}</span></div><span className="dates">{x.dates}</span></header>
              <ul>{x.bullets.map((b) => <li key={b}>{b}</li>)}</ul>
            </Reveal>
          ))}
        </div>
        <aside className="side">
          <Reveal className="glass side-card"><h4>Skills</h4><dl>{c.resume.skills.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl></Reveal>
          <Reveal className="glass side-card"><h4>Education</h4>{c.resume.education.map(([d, s, y]) => <div className="edu" key={d}><strong>{d}</strong><span>{s}</span><small>{y}</small></div>)}</Reveal>
          <Reveal className="glass side-card"><h4>Certifications</h4>{c.resume.certifications.map((x) => <div key={x}>{x}</div>)}</Reveal>
        </aside>
      </div>
      <Reveal as="section" className="glass contact">
        <div className="kicker">Ready to lead</div>
        <h2>Every layer. One accountable lead.</h2>
        <div className="contact-links">
          <a href={`mailto:${p.email}`}>{p.email}</a>
          <a href={`https://${p.linkedin}`} target="_blank" rel="noreferrer">{p.linkedin}</a>
          <a href={`https://${p.github}`} target="_blank" rel="noreferrer">{p.github}</a>
        </div>
      </Reveal>
    </>
  );
}

const VIEWS = { home: Home, journey: Journey, media: Media, patterns: Patterns, stack: Stack, resume: Resume };

function Portfolio({ data, onLock }) {
  const c = data.content;
  const { page, sub } = useRoute();
  const View = VIEWS[page];
  useEffect(() => {
    const label = PAGES.find((p) => p.id === page)?.label;
    document.title = page === "home" ? "Private Portfolio" : `${label} · Private Portfolio`;
  }, [page]);
  return (
    <>
      <div className="bg" aria-hidden="true"><div className="orb o1" /><div className="orb o2" /><div className="orb o3" /></div>
      <Nav name={c.profile.name} onLock={onLock} page={page} />
      <main key={page} className="page">
        <View c={c} data={data} sub={sub} />
        <PageFooter page={page} />
      </main>
      <footer className="foot">Decrypted locally in your browser · <button className="linkish" onClick={onLock}>Lock page</button></footer>
    </>
  );
}

export default function App() {
  const [data, setData] = useState(null);
  const [checking, setChecking] = useState(true);
  useEffect(() => { resume().then((d) => { if (d) setData(d); setChecking(false); }); }, []);
  if (checking) return <div className="boot" />;
  if (!data) return <LockScreen onUnlock={setData} />;
  return <Portfolio data={data} onLock={() => { lock(); setData(null); window.scrollTo(0, 0); }} />;
}
