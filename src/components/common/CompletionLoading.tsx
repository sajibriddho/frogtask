"use client";

/**
 * CompletionLoading — fancy full-page overlay that plays while a
 * mark-complete API call is in-flight.
 *
 * Layers (back-to-front):
 *   1. Frosted gradient backdrop.
 *   2. Drifting bubbles in the background (pre-computed positions).
 *   3. Glassmorphic centre card.
 *   4. Conic rotating ring + dual pulsing rings around the frog.
 *   5. Bouncing-with-wiggle frog inside a soft-glowing disc.
 *   6. Orbiting sparkle dots around the frog.
 *   7. Shimmering phrase + task title underneath.
 *   8. Pulsing progress dots at the bottom.
 *
 * Pair with `withMinDuration` so even a fast network call still gets
 * to enjoy the joy.
 */

import * as React from "react";

const PHRASES = [
  "Eating the frog…",
  "Crushing it…",
  "Almost there…",
  "Hop hop hop!",
  "Frog incoming…",
  "Ribbit ribbit!",
  "Owning the day…",
];

interface Bubble {
  left: number;
  size: number;
  delay: number;
  duration: number;
  opacity: number;
}

const BUBBLE_COUNT = 14;
function generateBubbles(): Bubble[] {
  const out: Bubble[] = [];
  for (let i = 0; i < BUBBLE_COUNT; i++) {
    out.push({
      left: Math.random() * 100,
      size: 6 + Math.random() * 18,
      delay: -Math.random() * 6000,
      duration: 5000 + Math.random() * 4000,
      opacity: 0.15 + Math.random() * 0.35,
    });
  }
  return out;
}

const SPARKLE_COUNT = 6;

export interface CompletionLoadingProps {
  open: boolean;
  title?: string | null;
}

export function CompletionLoading({ open, title }: CompletionLoadingProps) {
  // Random initial phrase via lazy init — keeps the effect side-effect-only.
  const [phrase, setPhrase] = React.useState(
    () => PHRASES[Math.floor(Math.random() * PHRASES.length)],
  );
  const [bubbles] = React.useState<Bubble[]>(() => generateBubbles());

  React.useEffect(() => {
    if (!open) return;
    const i = window.setInterval(() => {
      setPhrase(PHRASES[Math.floor(Math.random() * PHRASES.length)]);
    }, 1100);
    return () => window.clearInterval(i);
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="completion-loading-fade fixed inset-0 z-[120] flex items-center justify-center overflow-hidden bg-gradient-to-br from-emerald-950/60 via-slate-900/65 to-emerald-950/70 backdrop-blur-md"
      role="status"
      aria-live="polite"
      aria-label="Saving completion"
    >
      {/* Drifting bubbles in the background. */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        {bubbles.map((b, i) => (
          <span
            key={i}
            className="completion-loading-bubble absolute bottom-[-40px] rounded-full bg-emerald-300/60 shadow-[0_0_20px_rgba(110,231,183,0.6)]"
            style={{
              left: `${b.left}%`,
              width: `${b.size}px`,
              height: `${b.size}px`,
              opacity: b.opacity,
              animationDelay: `${b.delay}ms`,
              animationDuration: `${b.duration}ms`,
            }}
          />
        ))}
      </div>

      {/* Glassmorphic card holding the action. */}
      <div className="relative flex flex-col items-center gap-7 rounded-3xl border border-white/15 bg-white/[0.04] px-10 py-9 shadow-2xl shadow-emerald-900/40 backdrop-blur-xl">
        {/* Frog stage — every halo, ring, sparkle, and the frog itself
            anchor to this 128×128 box, so they all share one true centre. */}
        <div className="relative h-32 w-32">
          {/* Soft radial halos behind the frog, sized via negative insets
              so their centres lock onto the stage centre instead of drifting
              below it (the bug that made the frog look off-centre). */}
          <span
            aria-hidden
            className="completion-loading-glow-slow pointer-events-none absolute -inset-20 -z-10 rounded-full bg-emerald-500/30 blur-3xl"
          />
          <span
            aria-hidden
            className="completion-loading-glow-fast pointer-events-none absolute -inset-10 -z-10 rounded-full bg-emerald-300/40 blur-2xl"
          />

          {/* Conic gradient rotating ring. */}
          <span
            aria-hidden
            className="completion-loading-orbit absolute -inset-3 rounded-full"
            style={{
              background:
                "conic-gradient(from 0deg, transparent 0deg, rgba(110,231,183,0.85) 60deg, transparent 140deg, rgba(52,211,153,0.7) 220deg, transparent 320deg)",
              WebkitMask:
                "radial-gradient(circle, transparent 56%, #000 58%, #000 64%, transparent 66%)",
              mask: "radial-gradient(circle, transparent 56%, #000 58%, #000 64%, transparent 66%)",
            }}
          />

          {/* Two expanding pulse rings. */}
          <span
            aria-hidden
            className="completion-loading-ring absolute inset-0 rounded-full border-2 border-emerald-300/60"
          />
          <span
            aria-hidden
            className="completion-loading-ring-delay absolute inset-0 rounded-full border-2 border-emerald-200/50"
          />

          {/* Bouncing + wiggling frog. */}
          <div className="completion-loading-bounce absolute inset-0">
            <div className="completion-loading-wiggle relative flex h-full w-full items-center justify-center rounded-full bg-gradient-to-br from-emerald-300 via-emerald-500 to-emerald-700 shadow-2xl shadow-emerald-500/50 ring-4 ring-white/15">
              {/* Glossy highlight. */}
              <span
                aria-hidden
                className="pointer-events-none absolute inset-1 rounded-full bg-gradient-to-b from-white/40 via-transparent to-transparent"
              />
              {/* Emoji centred via flexbox (not baseline) so the glyph sits
                  squarely in the disc on every OS / emoji font. */}
              <span
                className="relative flex h-full w-full items-center justify-center leading-none drop-shadow-lg"
                style={{ fontSize: "3.5rem" }}
                role="img"
                aria-label="frog"
              >
                🐸
              </span>
            </div>
          </div>

          {/* Orbiting sparkles — staggered by negative animation-delay so
              the six dots sit at 0°/60°/120°/… instead of stacking. */}
          {Array.from({ length: SPARKLE_COUNT }).map((_, i) => (
            <span
              key={i}
              aria-hidden
              className="completion-loading-orbit-slow absolute left-1/2 top-1/2 h-0 w-0"
              style={{
                animationDelay: `${-(9000 / SPARKLE_COUNT) * i}ms`,
              }}
            >
              <span
                className="absolute left-[3.6rem] top-0 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-emerald-200 shadow-[0_0_8px_rgba(167,243,208,0.9)]"
                style={{
                  animation: `completion-loading-sparkle 1800ms ease-in-out ${i * 220}ms infinite`,
                }}
              />
            </span>
          ))}
        </div>

        {/* Phrase + task title. */}
        <div className="flex max-w-[300px] flex-col items-center gap-1.5 text-center">
          <span
            key={phrase}
            className="completion-loading-phrase relative bg-gradient-to-r from-white via-emerald-100 to-white bg-[length:200%_100%] bg-clip-text text-lg font-semibold text-transparent drop-shadow"
          >
            {phrase}
          </span>
          {title && (
            <span className="line-clamp-2 text-xs font-medium text-emerald-100/85">
              “{title}”
            </span>
          )}
        </div>

        {/* Pulsing progress dots. */}
        <div className="flex items-center gap-2" aria-hidden>
          <span className="completion-loading-dot completion-loading-dot-1 h-2.5 w-2.5 rounded-full bg-emerald-300 shadow-[0_0_10px_rgba(110,231,183,0.7)]" />
          <span className="completion-loading-dot completion-loading-dot-2 h-2.5 w-2.5 rounded-full bg-emerald-300 shadow-[0_0_10px_rgba(110,231,183,0.7)]" />
          <span className="completion-loading-dot completion-loading-dot-3 h-2.5 w-2.5 rounded-full bg-emerald-300 shadow-[0_0_10px_rgba(110,231,183,0.7)]" />
        </div>
      </div>
    </div>
  );
}

/**
 * Wrap an async action so the overlay shows for at least `ms` even on a
 * lightning-fast response — the joy moment shouldn't flicker.
 */
export async function withMinDuration<T>(
  p: Promise<T>,
  ms: number,
): Promise<T> {
  const start =
    typeof performance !== "undefined" ? performance.now() : Date.now();
  const result = await p;
  const now =
    typeof performance !== "undefined" ? performance.now() : Date.now();
  const elapsed = now - start;
  if (elapsed < ms) {
    await new Promise((r) => setTimeout(r, ms - elapsed));
  }
  return result;
}
