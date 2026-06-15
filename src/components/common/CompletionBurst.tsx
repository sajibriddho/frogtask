"use client";

/**
 * CompletionBurst — celebratory overlay that fires when a task is checked
 * off. Anchored to the viewport center; renders a rising frog + the task
 * title, a flash ring, and a confetti spray. Hands control back to the
 * caller via `onDone` once the longest animation has finished.
 */

import * as React from "react";

const CONFETTI_COLORS = [
  "#facc15", // yellow-400
  "#22c55e", // green-500
  "#0ea5e9", // sky-500
  "#a855f7", // purple-500
  "#f43f5e", // rose-500
  "#fb923c", // orange-400
];

const CONFETTI_COUNT = 14;
const FROG_PHRASES = [
  "Frog eaten!",
  "Crushed it!",
  "One down!",
  "Nice work!",
  "Boom!",
  "On a roll!",
];

interface ConfettiPiece {
  dx: number;
  dy: number;
  rot: number;
  color: string;
  delay: number;
}

function generateConfetti(): ConfettiPiece[] {
  const out: ConfettiPiece[] = [];
  for (let i = 0; i < CONFETTI_COUNT; i++) {
    const angle = (Math.PI * 2 * i) / CONFETTI_COUNT + Math.random() * 0.4;
    const distance = 90 + Math.random() * 70;
    out.push({
      dx: Math.cos(angle) * distance,
      dy: Math.sin(angle) * distance,
      rot: 360 + Math.random() * 360,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      delay: Math.random() * 80,
    });
  }
  return out;
}

export interface CompletionBurstProps {
  /** Title of the completed task — shown alongside the frog. */
  title: string;
  /** Called when the animation finishes so the parent can unmount us. */
  onDone: () => void;
}

export function CompletionBurst({ title, onDone }: CompletionBurstProps) {
  // Random visuals are computed once on mount via an effect — keeps the
  // render function pure (no Math.random() during render).
  const [visuals, setVisuals] = React.useState<{
    confetti: ConfettiPiece[];
    phrase: string;
  } | null>(null);

  React.useEffect(() => {
    setVisuals({
      confetti: generateConfetti(),
      phrase:
        FROG_PHRASES[Math.floor(Math.random() * FROG_PHRASES.length)],
    });
    const t = window.setTimeout(onDone, 1200);
    return () => window.clearTimeout(t);
  }, [onDone]);

  if (!visuals) return null;
  const { confetti, phrase } = visuals;

  return (
    <div
      className="pointer-events-none fixed inset-0 z-[100] flex items-center justify-center"
      aria-hidden
    >
      {/* Flash ring */}
      <span className="absolute left-1/2 top-1/2 h-32 w-32 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-emerald-400/60 frog-burst-ring" />

      {/* Confetti spray */}
      {confetti.map((c, i) => (
        <span
          key={i}
          className="absolute left-1/2 top-1/2 h-2 w-2 rounded-sm frog-confetti"
          style={
            {
              backgroundColor: c.color,
              animationDelay: `${c.delay}ms`,
              "--frog-dx": `${c.dx}px`,
              "--frog-dy": `${c.dy}px`,
              "--frog-rot": `${c.rot}deg`,
            } as React.CSSProperties
          }
        />
      ))}

      {/* Frog + phrase + title */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 frog-burst-rise">
        <div className="flex flex-col items-center gap-1.5 rounded-2xl bg-emerald-600 px-5 py-3 text-white shadow-xl shadow-emerald-600/30">
          <span className="text-3xl leading-none" role="img" aria-label="frog">
            🐸
          </span>
          <span className="text-sm font-semibold tracking-wide">{phrase}</span>
          <span className="max-w-[200px] truncate text-[11px] font-medium text-emerald-50/90">
            {title}
          </span>
        </div>
      </div>
    </div>
  );
}
