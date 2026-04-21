import type { SVGProps } from "react";

export function NestMark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M4 20V7l8-4 8 4v13" />
      <path d="M9 20v-6a3 3 0 0 1 6 0v6" />
    </svg>
  );
}
