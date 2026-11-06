import { useSyncExternalStore } from "react";

export type Theme = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

/** Shared with the inline script in index.html that prevents a flash. */
export const THEME_STORAGE_KEY = "mushak-theme";

const DARK_QUERY = "(prefers-color-scheme: dark)";
const THEME_COLORS: Record<ResolvedTheme, string> = {
  light: "#ffffff",
  dark: "#09090b",
};

const listeners = new Set<() => void>();

function isTheme(value: unknown): value is Theme {
  return value === "light" || value === "dark" || value === "system";
}

export function readStoredTheme(): Theme {
  if (typeof window === "undefined") return "system";

  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isTheme(stored) ? stored : "system";
  } catch {
    // Storage can be blocked (private mode, embedded webviews).
    return "system";
  }
}

export function systemTheme(): ResolvedTheme {
  if (typeof window === "undefined") return "light";
  return window.matchMedia(DARK_QUERY).matches ? "dark" : "light";
}

export function resolveTheme(theme: Theme): ResolvedTheme {
  return theme === "system" ? systemTheme() : theme;
}

/** Applies the resolved theme to <html>, native controls and the PWA bar. */
export function applyTheme(theme: Theme) {
  if (typeof document === "undefined") return;

  const resolved = resolveTheme(theme);
  const root = document.documentElement;

  root.classList.toggle("dark", resolved === "dark");
  root.dataset.theme = resolved;
  root.style.colorScheme = resolved;

  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", THEME_COLORS[resolved]);
}

export function setTheme(theme: Theme) {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Keep the in-memory choice even when storage is unavailable.
  }

  applyTheme(theme);
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** React binding: current stored choice ("system" until changed). */
export function useTheme() {
  return useSyncExternalStore(subscribe, readStoredTheme, () => "system" as Theme);
}

let started = false;

/**
 * Wires up the OS preference listener and cross-tab sync.
 *
 * Called once from main.tsx. The initial class is already applied by the
 * inline script in index.html, so this only keeps it up to date.
 */
export function startThemeWatcher() {
  if (started || typeof window === "undefined") return;
  started = true;

  const media = window.matchMedia(DARK_QUERY);

  const onSystemChange = () => {
    if (readStoredTheme() === "system") {
      applyTheme("system");
      listeners.forEach((listener) => listener());
    }
  };

  const onStorage = (event: StorageEvent) => {
    if (event.key !== THEME_STORAGE_KEY) return;
    applyTheme(readStoredTheme());
    listeners.forEach((listener) => listener());
  };

  media.addEventListener("change", onSystemChange);
  window.addEventListener("storage", onStorage);

  applyTheme(readStoredTheme());
}
