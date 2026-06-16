"use client";

/**
 * CompletionBurst — celebratory overlay that fires when a task is checked
 * off.
 *
 * When an `origin` is supplied (the click position of the completion
 * toggle), the frog card *runs* on an arc from that point up to the
 * top-right corner of the viewport — like the frog snatched the task and
 * sprinted off with it. Confetti and the flash ring stay at the origin
 * so the celebration anchors visually to where the user clicked.
 *
 * Without an origin we fall back to the classic centre-rise behaviour.
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
  /** Screen-space centre of the toggle that fired the completion. */
  origin?: { x: number; y: number };
  /** Called when the animation finishes so the parent can unmount us. */
  onDone: () => void;
}

interface RunWaypoints {
  startX: number;
  startY: number;
  midX: number;
  midY: number;
  endX: number;
  endY: number;
}

function computeRunWaypoints(
  origin: { x: number; y: number },
): RunWaypoints {
  // Top-right corner of the viewport with a comfortable inset so the
  // card doesn't clip on smaller windows.
  const w = typeof window !== "undefined" ? window.innerWidth : 1024;
  const endX = Math.max(120, w - 90);
  const endY = 70;
  // Lift the arc above the higher of the two endpoints so the frog
  // visibly *jumps* over to the corner rather than dragging across the
  // page.
  const midX = (origin.x + endX) / 2;
  const midY = Math.min(origin.y, endY) - 130;
  return {
    startX: origin.x,
    startY: origin.y,
    midX,
    midY,
    endX,
    endY,
  };
}

export function CompletionBurst({
  title,
  origin,
  onDone,
}: CompletionBurstProps) {
  // Random visuals are computed once on mount via lazy state init — keeps
  // the render function pure (no Math.random() during render) and the
  // effect side-effect-only.
  const [visuals] = React.useState(() => ({
    confetti: generateConfetti(),
    phrase: FROG_PHRASES[Math.floor(Math.random() * FROG_PHRASES.length)],
  }));
  const { confetti, phrase } = visuals;

  React.useEffect(() => {
    const t = window.setTimeout(onDone, 1300);
    return () => window.clearTimeout(t);
  }, [onDone]);

  // When we know where the click came from, anchor the local celebration
  // (ring + confetti) on that spot. Otherwise fall back to viewport centre.
  const localX =
    origin?.x ?? (typeof window !== "undefined" ? window.innerWidth / 2 : 0);
  const localY =
    origin?.y ?? (typeof window !== "undefined" ? window.innerHeight / 2 : 0);

  const run = origin ? computeRunWaypoints(origin) : null;

  return (
    <div
      className="pointer-events-none fixed inset-0 z-[100]"
      aria-hidden
    >
      {/* Flash ring + confetti — anchored at the click spot. */}
      <div
        className="absolute"
        style={{ left: `${localX}px`, top: `${localY}px` }}
      >
        <span className="absolute left-0 top-0 h-32 w-32 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-emerald-400/60 frog-burst-ring" />
        {confetti.map((c, i) => (
          <span
            key={i}
            className="absolute left-0 top-0 h-2 w-2 rounded-sm frog-confetti"
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
      </div>

      {/* Frog card — runs from the click spot to the top-right corner when
          we have an origin; otherwise plays the classic centre rise. */}
      {run ? (
        <div
          className="frog-run absolute left-0 top-0"
          style={
            {
              "--frog-start-x": `${run.startX}px`,
              "--frog-start-y": `${run.startY}px`,
              "--frog-mid-x": `${run.midX}px`,
              "--frog-mid-y": `${run.midY}px`,
              "--frog-end-x": `${run.endX}px`,
              "--frog-end-y": `${run.endY}px`,
            } as React.CSSProperties
          }
        >
          <FrogCard phrase={phrase} title={title} />
        </div>
      ) : (
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 frog-burst-rise">
          <FrogCard phrase={phrase} title={title} />
        </div>
      )}
    </div>
  );
}

function FrogCard({ phrase, title }: { phrase: string; title: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5 rounded-2xl bg-emerald-600 px-5 py-3 text-white shadow-xl shadow-emerald-600/30">
      <span className="text-3xl leading-none" role="img" aria-label="frog">
        🐸
      </span>
      <span className="text-sm font-semibold tracking-wide">{phrase}</span>
      <span className="max-w-[200px] truncate text-[11px] font-medium text-emerald-50/90">
        {title}
      </span>
    </div>
  );
}
