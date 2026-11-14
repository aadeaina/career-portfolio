// Animation carousel: arrows, dots or thumbnail strip, swipe, keyboard, autoplay
// (paused on hover/focus, off for reduced motion). Only the active slide's canvas
// is mounted, so off-screen animations cost nothing.
import { useEffect, useRef, useState } from "react";
import Animation from "./Animations.jsx";

export default function Carousel({ items, height = 300, start = 0, autoplay = 0, thumbs = false, compact = false, onChange, label = "Animations" }) {
  const n = items.length;
  const [i, setI] = useState(() => Math.min(Math.max(start, 0), n - 1));
  const [paused, setPaused] = useState(false);
  const [dir, setDir] = useState(1);
  const touch = useRef(null);
  const reduce = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => { setI(Math.min(Math.max(start, 0), n - 1)); }, [start, n]);

  const go = (next, d) => {
    const k = (next + n) % n;
    setDir(d ?? (k > i ? 1 : -1));
    setI(k);
    onChange?.(items[k], k);
  };

  useEffect(() => {
    if (!autoplay || paused || reduce) return;
    const t = setTimeout(() => go(i + 1, 1), autoplay);
    return () => clearTimeout(t);
  });

  const item = items[i];
  return (
    <section
      className={`carousel ${compact ? "compact" : ""}`}
      aria-roledescription="carousel"
      aria-label={label}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      onKeyDown={(e) => { if (e.key === "ArrowRight") go(i + 1, 1); if (e.key === "ArrowLeft") go(i - 1, -1); }}
    >
      <div
        className="car-viewport"
        onPointerDown={(e) => { touch.current = e.clientX; }}
        onPointerUp={(e) => {
          if (touch.current == null) return;
          const dx = e.clientX - touch.current; touch.current = null;
          if (Math.abs(dx) > 40) go(i + (dx < 0 ? 1 : -1), dx < 0 ? 1 : -1);
        }}
      >
        <div className="car-slide" key={item.scene} style={{ "--dir": dir }} aria-roledescription="slide" aria-label={`${i + 1} of ${n}: ${item.title}`}>
          <Animation scene={item.scene} height={height} />
        </div>
        <button className="car-arrow prev" onClick={() => go(i - 1, -1)} aria-label="Previous animation">‹</button>
        <button className="car-arrow next" onClick={() => go(i + 1, 1)} aria-label="Next animation">›</button>
        {autoplay > 0 && !reduce && (
          <div className="car-progress" aria-hidden="true">
            <span key={`${i}-${paused}`} className={paused ? "paused" : ""} style={{ animationDuration: `${autoplay}ms` }} />
          </div>
        )}
        <span className="car-count">{String(i + 1).padStart(2, "0")} / {String(n).padStart(2, "0")}</span>
      </div>

      <div className="car-caption" aria-live="polite">
        <strong>{item.title}</strong>
        {!compact && <span>{item.caption}</span>}
      </div>

      {thumbs ? (
        <div className="car-thumbs" role="tablist">
          {items.map((m, k) => (
            <button key={m.scene} role="tab" aria-selected={k === i} className={`glass car-thumb ${k === i ? "on" : ""}`} onClick={() => go(k)}>
              <small>{String(k + 1).padStart(2, "0")}</small>
              <strong>{m.title}</strong>
            </button>
          ))}
        </div>
      ) : (
        <div className="car-dots" role="tablist">
          {items.map((m, k) => (
            <button key={m.scene} role="tab" aria-selected={k === i} aria-label={m.title} className={k === i ? "on" : ""} onClick={() => go(k)} />
          ))}
        </div>
      )}
    </section>
  );
}
