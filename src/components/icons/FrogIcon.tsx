import * as React from "react";

export type FrogIconProps = React.SVGProps<SVGSVGElement>;

export function FrogIcon({
  className,
  strokeWidth = 2,
  ...rest
}: FrogIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      <circle cx="8" cy="6" r="2.5" />
      <circle cx="16" cy="6" r="2.5" />
      <circle cx="8" cy="6" r="0.6" fill="currentColor" stroke="none" />
      <circle cx="16" cy="6" r="0.6" fill="currentColor" stroke="none" />
      <path d="M3 13c0-3 3.5-5 9-5s9 2 9 5v2a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3z" />
      <path d="M9 15c1 1 5 1 6 0" />
    </svg>
  );
}

export default FrogIcon;
