import type { ReactNode, SVGProps } from "react";

export type RsbuildIconName =
  | "control-tower"
  | "finance"
  | "reconciliation"
  | "logistics"
  | "guardian"
  | "audit"
  | "approval"
  | "document"
  | "import"
  | "matching"
  | "alert"
  | "analytics"
  | "users"
  | "integration"
  | "delivery"
  | "search";

export type RsbuildIconTone = "primary" | "secondary" | "accent" | "muted";

interface RsbuildIconProps extends Omit<SVGProps<SVGSVGElement>, "name"> {
  name: RsbuildIconName;
  size?: number;
  tone?: RsbuildIconTone;
  strokeWidth?: number;
}

const ICON_PATHS: Record<RsbuildIconName, ReactNode> = {
  "control-tower": (
    <>
      <path d="M12 3v4M5 7h14M7 7l-2 4h14l-2-4M12 11v9M8 20h8" />
      <circle cx="12" cy="3" r="1.4" />
      <circle cx="5" cy="13" r="1.4" />
      <circle cx="19" cy="13" r="1.4" />
      <path d="M5 14.5V18h14v-3.5" />
    </>
  ),
  finance: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 9h18M7 15h3M16 13v4M14 15h4" />
    </>
  ),
  reconciliation: (
    <>
      <path d="M4 8h11M12 5l3 3-3 3M20 16H9m3-3-3 3 3 3" />
      <circle cx="4" cy="8" r="1.5" />
      <circle cx="20" cy="16" r="1.5" />
    </>
  ),
  logistics: (
    <>
      <path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5z" />
      <path d="M3.5 7.8 12 12l8.5-4.2M12 12v8.5M8 5l9 4.5" />
    </>
  ),
  guardian: (
    <>
      <path d="M12 3 19 6v5.5c0 4.2-2.8 7.5-7 9.5-4.2-2-7-5.3-7-9.5V6z" />
      <circle cx="12" cy="11" r="2.2" />
      <path d="M8.5 16c.9-1.5 2.1-2.2 3.5-2.2s2.6.7 3.5 2.2" />
    </>
  ),
  audit: (
    <>
      <path d="M7 3h7l4 4v14H7zM14 3v5h5M10 12h5M10 16h5" />
      <path d="m3 11 1.5 1.5L7 10" />
    </>
  ),
  approval: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="m8 12 2.6 2.6L16.5 9" />
    </>
  ),
  document: (
    <>
      <path d="M6 3h8l4 4v14H6zM14 3v5h5M9 12h6M9 16h6" />
    </>
  ),
  import: (
    <>
      <path d="M12 3v11M8 10l4 4 4-4M4 17v3h16v-3" />
    </>
  ),
  matching: (
    <>
      <circle cx="7" cy="8" r="3.5" />
      <circle cx="17" cy="16" r="3.5" />
      <path d="M10 8h4a3 3 0 0 1 3 3v1M14 16h-4a3 3 0 0 1-3-3v-1" />
    </>
  ),
  alert: (
    <>
      <path d="M12 3 21 19H3z" />
      <path d="M12 9v4M12 16.5v.1" />
    </>
  ),
  analytics: (
    <>
      <path d="M4 20V11M10 20V5M16 20v-8M22 20H2" />
      <path d="m3 8 6-4 6 5 6-6" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 20v-1.5A5.5 5.5 0 0 1 9 13h1a5 5 0 0 1 4.5 3" />
      <path d="M16 5.5a3 3 0 0 1 0 5.8M17 14a4 4 0 0 1 3.5 4v2" />
    </>
  ),
  integration: (
    <>
      <rect x="3" y="4" width="7" height="7" rx="1.5" />
      <rect x="14" y="13" width="7" height="7" rx="1.5" />
      <path d="M10 7.5h3a2 2 0 0 1 2 2v3.5M14 16.5h-3a2 2 0 0 1-2-2V11" />
    </>
  ),
  delivery: (
    <>
      <path d="M3 5h11v12H3zM14 9h4l3 3v5h-7" />
      <circle cx="7" cy="18" r="2" />
      <circle cx="18" cy="18" r="2" />
      <path d="m8 10 2 2 3-3" />
    </>
  ),
  search: (
    <>
      <circle cx="10.8" cy="10.8" r="6.8" />
      <path d="m16 16 4.5 4.5M8 10.8h5.6M10.8 8v5.6" />
    </>
  )
};

export function RsbuildIcon({
  name,
  size = 22,
  tone = "primary",
  strokeWidth = 1.7,
  className,
  ...props
}: RsbuildIconProps) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={["rsbuild-icon", `rsbuild-icon--${tone}`, className].filter(Boolean).join(" ")}
      {...props}
    >
      {ICON_PATHS[name]}
    </svg>
  );
}
