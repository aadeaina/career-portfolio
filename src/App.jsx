import { useEffect, useState } from "react";
import { unlock, resume, lock } from "./vault.js";
import Figure from "./components/Figure.jsx";
import Animation from "./components/Animations.jsx";

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

const NAV = [["overview", "Overview"], ["journey", "Journey"], ["chapters", "Chapters"], ["motion", "In motion"], ["patterns", "Patterns"], ["toolkit", "Toolkit"], ["resume", "Resume"]];

function Nav({ name, onLock, active }) {
  return (
    <header className="nav glass">
      <a href="#overview" className="brand">{name.replace(/[“”"]/g, "").split(" ").filter((_, i, a) => i === 0 || i === a.length - 1).join(" ")}</a>
      <nav>{NAV.map(([id, l]) => <a key={id} href={`#${id}`} className={active === id ? "on" : ""}>{l}</a>)}</nav>
      <button className="btn ghost sm" onClick={onLock}>Lock</button>
    </header>
  );
}

function useActiveSection() {
  const [active, setActive] = useState("overview");
  useEffect(() => {
    const io = new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting && setActive(e.target.id)), { rootMargin: "-45% 0px -50% 0px" });
    NAV.forEach(([id]) => { const el = document.getElementById(id); el && io.observe(el); });
    return () => io.disconnect();
  }, []);
  return active;
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

function Portfolio({ data, onLock }) {
  const c = data.content;
  const p = c.profile;
  const active = useActiveSection();
  const [pattern, setPattern] = useState(c.patterns.items[0].id);
  const pat = c.patterns.items.find((x) => x.id === pattern);
  const mediaFor = (scene) => c.media?.items.find((m) => m.scene === scene);

  return (
    <>
      <div className="bg" aria-hidden="true"><div className="orb o1" /><div className="orb o2" /><div className="orb o3" /></div>
      <Nav name={p.name} onLock={onLock} active={active} />

      <main>
        <section id="overview" className="hero">
          <div className="hero-copy">
            <div className="kicker">Candidate dossier · {p.title}</div>
            <h1>{p.name}</h1>
            <p className="lede">{p.tagline}</p>
            <p className="muted">{p.role} · {p.location}</p>
            <div className="actions">
              {data.resumePdf && <button className="btn primary" onClick={() => downloadPdf(data.resumePdf, "resume.pdf")}>Download resume</button>}
              <a className="btn ghost" href="#resume">Read the resume</a>
            </div>
          </div>
          <div className="glass hero-media">
            <Animation scene="packets" height={300} />
            <div className="media-cap">Every layer, one accountable lead</div>
          </div>
        </section>

        <Reveal className="stats">
          {c.stats.map((s) => (
            <div className="glass stat" key={s.label}><strong>{s.value}</strong><span>{s.label}</span><small>{s.sub}</small></div>
          ))}
        </Reveal>

        <Reveal className="glass thesis"><div className="kicker">My thesis</div><p>{c.thesis}</p></Reveal>

        <section className="block">
          <Reveal><div className="kicker">The stack I have built in</div><h2>Every layer, first-hand — from silicon to AI</h2></Reveal>
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
        </section>

        <section id="journey" className="block">
          <Reveal><div className="kicker">Career progression</div><h2>The journey: 2012 → today</h2></Reveal>
          <ol className="timeline">
            {c.timeline.map((e, i) => (
              <Reveal as="li" key={e.year + e.org} className={`tl ${e.kind}`} style={{ "--d": `${i * 60}ms` }}>
                <span className="tl-dot" />
                <div className="glass tl-card">
                  <span className="tl-year">{e.year}</span>
                  <strong>{e.org}</strong>
                  <span>{e.role}</span>
                  <small>{e.note}</small>
                </div>
              </Reveal>
            ))}
          </ol>
        </section>

        <section id="chapters" className="block">
          {c.chapters.map((ch) => {
            const m = ch.media && mediaFor(ch.media);
            return (
              <Reveal className="chapter" key={ch.id} id={`ch-${ch.id}`}>
                <div className="kicker">{ch.kicker}</div>
                <h2>{ch.title}</h2>
                <p className="lede sm">{ch.lede}</p>
                {m && (
                  <div className="glass media-inline">
                    <Animation scene={m.scene} height={280} />
                    <div className="media-cap"><strong>{m.title}</strong> — {m.caption}</div>
                  </div>
                )}
                <Figure figure={ch.figure} />
              </Reveal>
            );
          })}
        </section>

        {c.media && (
          <section id="motion" className="block">
            <Reveal><div className="kicker">Systems in motion</div><h2>Live media</h2><p className="lede sm">{c.media.intro}</p></Reveal>
            <div className="media-grid">
              {c.media.items.map((m, i) => (
                <Reveal className="glass media-card" key={m.scene} style={{ "--d": `${i * 70}ms` }}>
                  <Animation scene={m.scene} height={250} />
                  <div className="media-body"><h4>{m.title}</h4><p>{m.caption}</p></div>
                </Reveal>
              ))}
            </div>
          </section>
        )}

        <section id="patterns" className="block">
          <Reveal><div className="kicker">Architecture & delivery patterns</div><h2>How I plan, ship and prove platforms</h2><p className="lede sm">{c.patterns.intro}</p></Reveal>
          <div className="tabs" role="tablist">
            {c.patterns.items.map((x) => (
              <button key={x.id} role="tab" aria-selected={pattern === x.id} className={`pill ${pattern === x.id ? "on" : ""}`} onClick={() => setPattern(x.id)}>{x.title}</button>
            ))}
          </div>
          <div className="glass pattern" key={pat.id}>
            <div className="kicker">{pat.kicker}</div>
            <h3>{pat.title}</h3>
            <p className="muted">{pat.lede}</p>
            <Figure figure={pat.figure} />
          </div>
        </section>

        <section id="toolkit" className="block">
          <Reveal><div className="kicker">The toolkit</div><h2>A periodic table of my stack</h2></Reveal>
          <div className="periodic">
            {c.toolkit.map((g, gi) => (
              <Reveal className="ptable-group" key={g.group} style={{ "--hue": 170 + gi * 28 }}>
                <div className="pgroup-name">{g.group}</div>
                <div className="elements">
                  {g.items.map(([sym, nm], i) => (
                    <div className="element" key={nm} title={nm}><small>{gi * 10 + i + 1}</small><b>{sym}</b><span>{nm}</span></div>
                  ))}
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        <section className="block">
          <Reveal><div className="kicker">What you get</div><h2>Four commitments</h2></Reveal>
          <div className="commit-grid">
            {c.commitments.map((x, i) => (
              <Reveal className="glass commit" key={x.n} style={{ "--d": `${i * 80}ms` }}><span className="commit-n">{x.n}</span><h4>{x.title}</h4><p>{x.body}</p></Reveal>
            ))}
          </div>
        </section>

        <section id="resume" className="block">
          <Reveal className="resume-head">
            <div><div className="kicker">Resume</div><h2>{p.title}</h2></div>
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
        </section>

        <Reveal as="section" className="glass contact">
          <div className="kicker">Ready to lead</div>
          <h2>Every layer. One accountable lead.</h2>
          <div className="contact-links">
            <a href={`mailto:${p.email}`}>{p.email}</a>
            <a href={`https://${p.linkedin}`} target="_blank" rel="noreferrer">{p.linkedin}</a>
            <a href={`https://${p.github}`} target="_blank" rel="noreferrer">{p.github}</a>
          </div>
        </Reveal>
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
