import { localizedAttribute, localizedText, t } from './i18n.ts';
export type TabFile = { path: string };
export type AuxiliaryTab = { id: string; label: string; controls: string };
export type TabUpdateOptions = { transient?: boolean };

type StoredTabs = { version: 1; projects: Record<string, { paths: string[]; active: string }> };
const TABS_STORAGE_KEY = "latexcoder-open-tabs";

export function loadTabState(projectId: string): { paths: string[]; active: string } | null {
  if (!projectId) return null;
  try {
    const stored = JSON.parse(localStorage.getItem(TABS_STORAGE_KEY) || "null") as StoredTabs | null;
    const project = stored?.version === 1 ? stored.projects?.[projectId] : null;
    if (!project || !Array.isArray(project.paths) || typeof project.active !== "string") return null;
    const paths = [...new Set(project.paths.filter(path => typeof path === "string" && path.length > 0 && path.length <= 512))];
    return { paths, active: project.active };
  } catch { return null; }
}

function saveTabState(projectId: string, value: { paths: string[]; active: string }): void {
  if (!projectId) return;
  try {
    const stored = JSON.parse(localStorage.getItem(TABS_STORAGE_KEY) || "null") as StoredTabs | null;
    const next: StoredTabs = stored?.version === 1 && stored.projects && typeof stored.projects === "object"
      ? stored : { version: 1, projects: {} };
    const paths = [...new Set(value.paths)].slice(-100);
    if (paths.length) next.projects[projectId] = { paths, active: value.active };
    else delete next.projects[projectId];
    localStorage.setItem(TABS_STORAGE_KEY, JSON.stringify(next));
  } catch { /* Tab persistence is optional. */ }
}

export function createFileTabs(host: HTMLElement, open: (path: string) => void, openAuxiliary: (id: string) => void) {
  let paths: string[] = [];
  let project = "";
  let active = "";
  let auxiliary: AuxiliaryTab | null = null;
  let auxiliaryActive = false;

  function persist(): void {
    if (project) saveTabState(project, { paths, active: paths.includes(active) ? active : paths[0] || "" });
  }

  function render(): void {
    const focused = (document.activeElement as HTMLElement | null)?.dataset.tabPath;
    host.replaceChildren();
    for (const path of paths) {
      const tab = document.createElement("div");
      tab.className = "file-tab";
      tab.classList.toggle("active", !auxiliaryActive && path === active);
      tab.classList.toggle("single-tab", paths.length === 1);

      const button = document.createElement("button");
      button.type = "button";
      button.dataset.tabPath = path;
      button.setAttribute("role", "tab");
      button.setAttribute("aria-selected", String(!auxiliaryActive && path === active));
      button.setAttribute("aria-controls", "editor");
      button.tabIndex = !auxiliaryActive && path === active ? 0 : -1;
      localizedAttribute(button, "title", () => path);
      const basename = path.split("/").at(-1)!;
      localizedText(button, () => paths.some(other => other !== path && other.split("/").at(-1) === basename) ? path : basename);
      button.addEventListener("click", () => open(path));
      button.addEventListener("keydown", event => {
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
        event.preventDefault();
        const index = paths.indexOf(path);
        const next = event.key === "Home" ? paths[0]
          : event.key === "End" ? paths.at(-1)!
          : paths[(index + (event.key === "ArrowLeft" ? -1 : 1) + paths.length) % paths.length];
        open(next);
      });

      const close = document.createElement("button");
      close.type = "button";
      close.className = "close-tab";
      localizedText(close, () => "x");
      localizedAttribute(close, "title", () => t("Close {{v0}}", { v0: path }));
      localizedAttribute(close, "aria-label", () => close.title);
      close.hidden = paths.length === 1;
      close.addEventListener("click", () => {
        if (paths.length === 1) return;
        const index = paths.indexOf(path);
        paths = paths.filter(candidate => candidate !== path);
        if (active === path) {
          active = paths[Math.min(index, paths.length - 1)];
          persist();
          open(active);
        } else { persist(); render(); }
      });
      tab.append(button, close);
      host.append(tab);
    }
    if (auxiliary) {
      const auxiliaryTab = auxiliary;
      const tab = document.createElement("div");
      tab.className = "file-tab auxiliary-tab";
      tab.classList.toggle("active", auxiliaryActive);
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.tabPanel = auxiliary.id;
      button.setAttribute("role", "tab");
      button.setAttribute("aria-selected", String(auxiliaryActive));
      button.setAttribute("aria-controls", auxiliary.controls);
      button.tabIndex = auxiliaryActive ? 0 : -1;
      localizedText(button, () => auxiliaryTab.label);
      button.addEventListener("click", () => { auxiliaryActive = true; render(); openAuxiliary(auxiliary!.id); });
      const close = document.createElement("button");
      close.type = "button";
      close.className = "close-tab";
      localizedText(close, () => "x");
      localizedAttribute(close, "title", () => t("Close {{v0}}", { v0: auxiliaryTab.label }));
      localizedAttribute(close, "aria-label", () => close.title);
      close.addEventListener("click", () => {
        const wasActive = auxiliaryActive;
        auxiliary = null;
        auxiliaryActive = false;
        render();
        if (wasActive && active) open(active);
      });
      tab.append(button, close);
      host.append(tab);
    }
    if (focused) host.querySelector<HTMLElement>('[aria-selected="true"]')?.focus({ preventScroll: true });
    host.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }

  return {
    update(files: TabFile[], selected: string, projectId: string, options: TabUpdateOptions = {}): void {
      if (project !== projectId) {
        const stored = loadTabState(projectId);
        paths = stored?.paths || [];
        active = stored?.active || "";
        auxiliary = null;
        auxiliaryActive = false;
        project = projectId;
      }
      paths = paths.filter(path => files.some(file => file.path === path));
      if (!options.transient) {
        if (selected) active = selected;
        if (selected && !paths.includes(selected) && files.some(file => file.path === selected)) paths.push(selected);
      }
      if (!paths.length && selected && files.some(file => file.path === selected)) paths.push(selected);
      if (paths.length && !paths.includes(active)) active = selected && paths.includes(selected) ? selected : paths[0];
      persist();
      render();
    },
    move(from: string, to: string): void {
      paths = paths.map(path => path === from || path.startsWith(`${from}/`) ? to + path.slice(from.length) : path);
      if (active === from || active.startsWith(`${from}/`)) active = to + active.slice(from.length);
      persist();
    },
    openAuxiliary(tab: AuxiliaryTab): void {
      auxiliary = tab;
      auxiliaryActive = true;
      render();
      openAuxiliary(tab.id);
    },
    activateFile(): void {
      if (!auxiliaryActive) return;
      auxiliaryActive = false;
      render();
    },
  };
}
