// Automatic compilation is a personal preference, like the theme: each person
// decides for themselves in this browser, across every project.
const STORAGE_KEY = "latexcoder-auto-compile";
export const AUTO_COMPILE_EVENT = "latexcoder-auto-compile-change";

export function autoCompileEnabled(): boolean {
  try { return localStorage.getItem(STORAGE_KEY) === "on"; } catch { return false; }
}

export function setAutoCompileEnabled(enabled: boolean): void {
  try { localStorage.setItem(STORAGE_KEY, enabled ? "on" : "off"); } catch { /* Session-only preference. */ }
  window.dispatchEvent(new CustomEvent(AUTO_COMPILE_EVENT, { detail: enabled }));
}
