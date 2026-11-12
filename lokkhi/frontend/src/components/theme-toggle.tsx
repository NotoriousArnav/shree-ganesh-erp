import type { ReactNode } from "react";

import { setTheme, useTheme, type Theme } from "@/lib/theme";

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

const options: Array<{
  value: Theme;
  label: string;
  hint: string;
  icon: () => ReactNode;
}> = [
  { value: "light", label: "Light", hint: "Always light", icon: SunIcon },
  { value: "dark", label: "Dark", hint: "Always dark", icon: MoonIcon },
  {
    value: "system",
    label: "System",
    hint: "Follow this device's setting",
    icon: MonitorIcon,
  },
];

/**
 * Three-way appearance switch: Light, Dark, or follow the device.
 *
 * The choice is stored in localStorage and applied before React renders, so a
 * dark-mode user never sees a white flash on load.
 */
export default function ThemeToggle({ className }: { className?: string }) {
  const theme = useTheme();

  return (
    <div
      role="group"
      aria-label="Appearance"
      className={cx(
        "inline-flex items-center gap-0.5 rounded-lg border border-border bg-background p-0.5",
        className,
      )}
    >
      {options.map((option) => {
        const active = theme === option.value;

        return (
          <button
            key={option.value}
            type="button"
            onClick={() => setTheme(option.value)}
            aria-pressed={active}
            title={`${option.label} — ${option.hint}`}
            className={cx(
              "flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors",
              "hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active && "bg-accent text-foreground shadow-sm",
            )}
          >
            <option.icon />
            <span className="sr-only">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      className="size-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

function SunIcon() {
  return (
    <Icon>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </Icon>
  );
}

function MoonIcon() {
  return (
    <Icon>
      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
    </Icon>
  );
}

function MonitorIcon() {
  return (
    <Icon>
      <rect width="20" height="14" x="2" y="3" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </Icon>
  );
}
