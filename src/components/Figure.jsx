// Data-driven diagram renderers. All labels come from the encrypted vault.

function Cards({ items }) {
  return (
    <div className="fig-cards">
      {items.map((c) => (
        <div className="glass card" key={c.title}>
          <div className="meta">{c.meta}</div>
          <h4>{c.title}</h4>
          <p>{c.body}</p>
        </div>
      ))}
    </div>
  );
}

function Flow({ steps, outcomes }) {
  return (
    <>
      <ol className="fig-flow">
        {steps.map((s, i) => (
          <li key={s.label} style={{ "--i": i }}>
            <span className="step-n">{String(i + 1).padStart(2, "0")}</span>
            <strong>{s.label}</strong>
            <span>{s.body}</span>
          </li>
        ))}
      </ol>
      {outcomes && (
        <div className="fig-outcomes">
          {outcomes.map((o) => (
            <div className="glass outcome" key={o.value}>
              <strong>{o.value}</strong>
              <span>{o.label}</span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function Split({ columns, tags }) {
  return (
    <>
      <div className="fig-split" style={{ "--cols": columns.length }}>
        {columns.map((c) => (
          <div className="glass card" key={c.title}>
            <h4>{c.title}</h4>
            <div className="meta">{c.meta}</div>
            <ul>{c.points.map((p) => <li key={p}>{p}</li>)}</ul>
          </div>
        ))}
      </div>
      {tags && <div className="tags">{tags.map((t) => <span className="tag" key={t}>{t}</span>)}</div>}
    </>
  );
}

function Fabric({ spines, leaves, caption, notes }) {
  const W = 520, H = 230;
  const sx = (i) => (W / (spines + 1)) * (i + 1);
  const lx = (i) => (W / (leaves + 1)) * (i + 1);
  return (
    <div className="fig-fabric">
      <div className="glass fabric-svg">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={caption}>
          {Array.from({ length: spines }).flatMap((_, s) =>
            Array.from({ length: leaves }).map((_, l) => (
              <line key={`${s}-${l}`} x1={sx(s)} y1={48} x2={lx(l)} y2={140} className="link" />
            )),
          )}
          {Array.from({ length: leaves }).flatMap((_, l) =>
            [0, 1].map((h) => <line key={`h${l}${h}`} x1={lx(l)} y1={150} x2={lx(l) - 18 + h * 36} y2={196} className="link thin" />),
          )}
          {Array.from({ length: spines }).map((_, i) => (
            <g key={`s${i}`}><rect x={sx(i) - 46} y={26} width={92} height={32} rx={9} className="node spine" /><text x={sx(i)} y={47}>Spine {i + 1}</text></g>
          ))}
          {Array.from({ length: leaves }).map((_, i) => (
            <g key={`l${i}`}><rect x={lx(i) - 38} y={128} width={76} height={28} rx={8} className="node leaf" /><text x={lx(i)} y={147}>Leaf {i + 1}</text></g>
          ))}
          {Array.from({ length: leaves }).flatMap((_, l) =>
            [0, 1].map((h) => <rect key={`hr${l}${h}`} x={lx(l) - 26 + h * 36} y={196} width={16} height={14} rx={3} className="node host" />),
          )}
        </svg>
        <div className="caption">{caption}</div>
      </div>
      <div className="fabric-notes">
        {notes.map((n) => (
          <div className="glass card compact" key={n.title}><h4>{n.title}</h4><p>{n.body}</p></div>
        ))}
      </div>
    </div>
  );
}

function Hub({ left, center, right, bands }) {
  const Box = ({ b, cls }) => (
    <div className={`glass hub-box ${cls}`}>
      <h4>{b.title}</h4>
      <ul>{b.points.map((p) => <li key={p}>{p}</li>)}</ul>
    </div>
  );
  return (
    <div className="fig-hub">
      <div className="hub-row">
        <Box b={left} cls="" />
        <div className="hub-arrow" aria-hidden="true"><span>asks</span></div>
        <Box b={center} cls="center" />
        <div className="hub-arrow" aria-hidden="true"><span>scoped call</span></div>
        <Box b={right} cls="" />
      </div>
      {bands.map((b) => (
        <div className="glass band" key={b.label}><strong>{b.label}</strong><span>{b.body}</span></div>
      ))}
    </div>
  );
}

function Products({ items }) {
  return (
    <div className="fig-products">
      {items.map((p) => (
        <div className="glass card product" key={p.name}>
          <div className="meta">{p.tag}</div>
          <h4>{p.name}</h4>
          <p>{p.body}</p>
          <div className="mini-flow">
            {p.flow.map((f, i) => (
              <span key={f}>{f}{i < p.flow.length - 1 && <i aria-hidden="true">→</i>}</span>
            ))}
          </div>
          <div className="stackline">{p.stack}</div>
        </div>
      ))}
    </div>
  );
}

function Gates({ items }) {
  return (
    <ol className="fig-gates">
      {items.map((g) => (
        <li key={g.n} className="glass">
          <span className="gate-n">{g.n}</span>
          <strong>{g.label}</strong>
          <span className="gate-test"><b>Exit gate</b>{g.gate}</span>
        </li>
      ))}
    </ol>
  );
}

function Path({ steps, side }) {
  return (
    <div className="fig-path">
      <div className="path-zone">
        <div className="zone-label">Edge</div>
        <div className="zone-label right">Private VPC · 3 AZs</div>
        <ol className="fig-flow path">
          {steps.map((s, i) => (
            <li key={s.label} className={i >= 3 ? "private" : ""}>
              <strong>{s.label}</strong><span>{s.body}</span>
            </li>
          ))}
        </ol>
      </div>
      <div className="tags">{side.map((t) => <span className="tag" key={t}>{t}</span>)}</div>
    </div>
  );
}

const RENDERERS = { cards: Cards, flow: Flow, split: Split, fabric: Fabric, hub: Hub, products: Products, gates: Gates, path: Path };

export default function Figure({ figure }) {
  const R = RENDERERS[figure.type];
  return R ? <R {...figure} /> : null;
}
