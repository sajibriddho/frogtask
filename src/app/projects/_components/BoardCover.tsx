"use client";

/**
 * BoardCover — render the small gradient swatch used as a board's
 * background. Accepts either one of the named keys from
 * BOARD_BACKGROUNDS or any CSS colour / gradient string.
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import { backgroundFromKey, BOARD_BACKGROUNDS } from "@/types/project";

interface Props {
  background: string;
  className?: string;
  children?: React.ReactNode;
}

export function BoardCover({ background, className, children }: Props) {
  const isKey = BOARD_BACKGROUNDS.some((b) => b.key === background);
  const value = isKey ? backgroundFromKey(background) : background;
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl bg-gradient-to-br",
        className,
      )}
      style={{ background: value }}
    >
      <div className="absolute inset-0 bg-black/10" />
      {children}
    </div>
  );
}
