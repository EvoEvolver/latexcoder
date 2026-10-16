import { ArrowRightToLine, Braces, CircleX, Copy, createIcons, File, FileCheck2, FileCode2, FileText, Image, SquareX, X } from "lucide";
import { localizedAttribute, localizedText, t } from './i18n.ts';
export type TabFile = { path: string; text?: boolean };
export type AuxiliaryTab = { id: string; label: string; controls: string };
export type TabUpdateOptions = { transient?: boolean };
export type FileTabCallbacks = {
  open: (path: string) => void;
  openAuxiliary: (id: string) => void;
  /** Called when the last tab closes, so the editor can show its empty state. */
  empty: () => void;
  copyPath: (path: string) => void;
};

type StoredTabs = { version: 1; projects: Record<string, { paths: string[]; active: string }> };
const TABS_STORAGE_KEY = "latexcoder-open-tabs";
const TAB_ICONS = { ArrowRightToLine, Braces, CircleX, Copy, File, FileCheck2, FileCode2, FileText, Image, SquareX, X };

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

export function fileTabIcon(path: string, text: boolean | undefined): string {
  if (/\.(png|jpe?g|gif|svg|webp|avif|bmp|ico)$/i.test(path)) return "image";
  if (/\.pdf$/i.test(path)) return "file-check-2";
  if (/\.(bib|json|yaml|yml)$/i.test(path)) return "braces";
  if (/\.(sty|cls|py|js|ts|css)$/i.test(path)) return "file-code-2";
  return text === false ? "file" : "file-text";
}

/** The tab a context menu or middle click targets: a file path or the auxiliary panel. */
type TabTarget = { path: string } | { auxiliary: true };

export function createFileTabs(host: HTMLElement, callbacks: FileTabCallbacks) {
  let files: TabFile[] = [];
  let paths: string[] = [];
  let project = "";
  let active = "";
  let auxiliary: AuxiliaryTab | null = null;
  let auxiliaryActive = false;
  let menu: HTMLElement | null = null;
  let menuTarget: TabTarget | null = null;
  let menuOpener: HTMLElement | null = null;

  function persist(): void {
    if (project) saveTabState(project, { paths, active: paths.includes(active) ? active : paths[0] || "" });
  }

  function label(path: string): string {
    const basename = path.split("/").at(-1)!;
    return paths.some(other => other !== path && other.split("/").at(-1) === basename) ? path : basename;
  }

  function closeFiles(closing: string[]): void {
    if (!closing.length) return;
    const closingActive = closing.includes(active);
    const index = paths.indexOf(active);
    paths = paths.filter(path => !closing.includes(path));
    if (!closingActive || auxiliaryActive) {
      if (closingActive) active = paths[Math.min(index, paths.length - 1)] || "";
      persist();
      render();
      return;
    }
    if (paths.length) {
      active = paths[Math.min(index, paths.length - 1)];
      persist();
      callbacks.open(active);
    } else {
      active = "";
      persist();
      render();
      callbacks.empty();
    }
  }

  function closeAuxiliary(): void {
    if (!auxiliary) return;
    const wasActive = auxiliaryActive;
    auxiliary = null;
    auxiliaryActive = false;
    render();
    if (!wasActive) return;
    if (active) callbacks.open(active);
    else callbacks.empty();
  }

  function closeTarget(target: TabTarget): void {
    if ("auxiliary" in target) closeAuxiliary();
    else closeFiles([target.path]);
  }

  function closeOthers(target: TabTarget): void {
    const keep = "auxiliary" in target ? null : target.path;
    if (keep !== null) closeAuxiliary();
    closeFiles(paths.filter(path => path !== keep));
  }

  function closeToTheRight(target: TabTarget): void {
    if ("auxiliary" in target) return;
    closeAuxiliary();
    closeFiles(paths.slice(paths.indexOf(target.path) + 1));
  }

  function closeAll(): void {
    const hadAuxiliary = Boolean(auxiliary);
    auxiliary = null;
    auxiliaryActive = false;
    if (paths.length) closeFiles([...paths]);
    else if (hadAuxiliary) { render(); callbacks.empty(); }
  }

  function closeMenu(): void {
    if (!menu || menu.hidden) return;
    menu.hidden = true;
    menuTarget = null;
    const opener = menuOpener;
    menuOpener = null;
    if (opener?.isConnected) opener.focus({ preventScroll: true });
  }

  function ensureMenu(): HTMLElement {
    if (menu) return menu;
    menu = document.createElement("div");
    menu.id = "tab-context-menu";
    menu.className = "tab-context-menu fixed z-40 w-56 rounded-md border bg-card p-1 text-card-foreground shadow-xl";
    menu.setAttribute("role", "menu");
    menu.hidden = true;
    localizedAttribute(menu, "aria-label", () => t("Tab actions"));
    const items: Array<{ action: string; icon: string; label: () => string; separator?: boolean }> = [
      { action: "close", icon: "x", label: () => t("Close") },
      { action: "close-others", icon: "circle-x", label: () => t("Close others") },
      { action: "close-right", icon: "arrow-right-to-line", label: () => t("Close tabs to the right") },
      { action: "close-all", icon: "square-x", label: () => t("Close all tabs") },
      { action: "copy-path", icon: "copy", label: () => t("Copy path"), separator: true },
    ];
    for (const item of items) {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.tabAction = item.action;
      button.setAttribute("role", "menuitem");
      button.className = `flex h-8 w-full items-center gap-2 rounded-sm px-2 text-left text-xs hover:bg-accent disabled:pointer-events-none disabled:opacity-40 [&_svg]:size-3.5${item.separator ? " mt-1 border-t pt-1" : ""}`;
      button.innerHTML = `<i data-lucide="${item.icon}"></i><span></span>`;
      localizedText(button.querySelector("span")!, item.label);
      button.addEventListener("click", () => {
        const target = menuTarget;
        closeMenu();
        if (!target) return;
        if (item.action === "close") closeTarget(target);
        else if (item.action === "close-others") closeOthers(target);
        else if (item.action === "close-right") closeToTheRight(target);
        else if (item.action === "close-all") closeAll();
        else if (item.action === "copy-path" && "path" in target) callbacks.copyPath(target.path);
      });
      menu.append(button);
    }
    createIcons({ root: menu, icons: TAB_ICONS });
    menu.querySelectorAll("svg[data-lucide]").forEach(icon => icon.removeAttribute("data-lucide"));
    menu.addEventListener("keydown", event => {
      const buttons = [...menu!.querySelectorAll<HTMLButtonElement>("button:not(:disabled):not([hidden])")];
      const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
      if (event.key === "Escape" || event.key === "Tab") { event.preventDefault(); closeMenu(); return; }
      if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      const next = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1
        : (index + (event.key === "ArrowDown" ? 1 : -1) + buttons.length) % buttons.length;
      buttons[next]?.focus();
    });
    document.addEventListener("pointerdown", event => { if (!menu!.contains(event.target as Node)) closeMenu(); }, true);
    document.addEventListener("scroll", event => { if (!menu!.contains(event.target as Node)) closeMenu(); }, true);
    window.addEventListener("blur", closeMenu);
    window.addEventListener("resize", closeMenu);
    document.body.append(menu);
    return menu;
  }

  function openMenu(event: MouseEvent, target: TabTarget, opener: HTMLElement): void {
    event.preventDefault();
    event.stopPropagation();
    const element = ensureMenu();
    menuTarget = target;
    menuOpener = opener;
    const isFile = "path" in target;
    const index = isFile ? paths.indexOf(target.path) : -1;
    const others = paths.length + (auxiliary ? 1 : 0) - 1;
    const toTheRight = isFile ? paths.length - index - 1 + (auxiliary ? 1 : 0) : 0;
    for (const button of element.querySelectorAll<HTMLButtonElement>("[data-tab-action]")) {
      const action = button.dataset.tabAction;
      button.hidden = action === "copy-path" && !isFile;
      button.disabled = action === "close-others" ? others < 1
        : action === "close-right" ? toTheRight < 1
        : false;
    }
    element.hidden = false;
    const bounds = element.getBoundingClientRect();
    const x = event.clientX || opener.getBoundingClientRect().left;
    const y = event.clientY || opener.getBoundingClientRect().bottom;
    element.style.left = `${Math.max(8, Math.min(x, window.innerWidth - bounds.width - 8))}px`;
    element.style.top = `${Math.max(8, Math.min(y, window.innerHeight - bounds.height - 8))}px`;
    element.querySelector<HTMLButtonElement>("button:not(:disabled):not([hidden])")?.focus({ preventScroll: true });
  }

  function tabElement(options: {
    target: TabTarget;
    selected: boolean;
    icon: string | null;
    text: () => string;
    title: () => string;
    controls: string;
    activate: () => void;
    close: () => void;
    navigate?: (key: string) => void;
    dataset: Record<string, string>;
  }): HTMLElement {
    const tab = document.createElement("div");
    tab.className = "file-tab";
    tab.classList.toggle("active", options.selected);

    const button = document.createElement("button");
    button.type = "button";
    Object.assign(button.dataset, options.dataset);
    button.setAttribute("role", "tab");
    button.setAttribute("aria-selected", String(options.selected));
    button.setAttribute("aria-controls", options.controls);
    button.tabIndex = options.selected ? 0 : -1;
    localizedAttribute(button, "title", options.title);
    if (options.icon) button.innerHTML = `<i data-lucide="${options.icon}" class="file-tab-icon icon-${options.icon}"></i>`;
    const name = document.createElement("span");
    name.className = "file-tab-label";
    localizedText(name, options.text);
    button.append(name);
    button.addEventListener("click", options.activate);
    button.addEventListener("keydown", event => {
      if (event.key === "Delete" || (event.key === "w" && event.altKey)) { event.preventDefault(); options.close(); return; }
      if (event.key === "ContextMenu" || (event.key === "F10" && event.shiftKey)) {
        openMenu(new MouseEvent("contextmenu"), options.target, button);
        return;
      }
      if (options.navigate && ["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
        event.preventDefault();
        options.navigate(event.key);
      }
    });

    const close = document.createElement("button");
    close.type = "button";
    close.className = "close-tab";
    close.tabIndex = -1;
    close.innerHTML = '<i data-lucide="x"></i>';
    localizedAttribute(close, "title", () => t("Close {{v0}}", { v0: options.title() }));
    localizedAttribute(close, "aria-label", () => t("Close {{v0}}", { v0: options.title() }));
    close.addEventListener("click", event => { event.stopPropagation(); options.close(); });

    tab.append(button, close);
    tab.addEventListener("contextmenu", event => openMenu(event, options.target, button));
    // Middle click closes a tab, as in browsers and desktop editors.
    tab.addEventListener("auxclick", event => { if (event.button === 1) { event.preventDefault(); options.close(); } });
    tab.addEventListener("pointerdown", event => { if (event.button === 1) event.preventDefault(); });
    return tab;
  }

  function render(): void {
    const focused = (document.activeElement as HTMLElement | null)?.dataset.tabPath;
    closeMenu();
    host.replaceChildren();
    for (const path of paths) {
      const file = files.find(candidate => candidate.path === path);
      host.append(tabElement({
        target: { path },
        selected: !auxiliaryActive && path === active,
        icon: fileTabIcon(path, file?.text),
        text: () => label(path),
        title: () => path,
        controls: "editor",
        dataset: { tabPath: path },
        activate: () => callbacks.open(path),
        close: () => closeFiles([path]),
        navigate: key => {
          const index = paths.indexOf(path);
          const next = key === "Home" ? paths[0]
            : key === "End" ? paths.at(-1)!
            : paths[(index + (key === "ArrowLeft" ? -1 : 1) + paths.length) % paths.length];
          callbacks.open(next);
        },
      }));
    }
    if (auxiliary) {
      const auxiliaryTab = auxiliary;
      const tab = tabElement({
        target: { auxiliary: true },
        selected: auxiliaryActive,
        icon: null,
        text: () => auxiliaryTab.label,
        title: () => auxiliaryTab.label,
        controls: auxiliaryTab.controls,
        dataset: { tabPanel: auxiliaryTab.id },
        activate: () => { auxiliaryActive = true; render(); callbacks.openAuxiliary(auxiliaryTab.id); },
        close: closeAuxiliary,
      });
      tab.classList.add("auxiliary-tab");
      host.append(tab);
    }
    createIcons({ root: host, icons: TAB_ICONS });
    host.querySelectorAll("svg[data-lucide]").forEach(icon => icon.removeAttribute("data-lucide"));
    if (focused) host.querySelector<HTMLElement>('[aria-selected="true"]')?.focus({ preventScroll: true });
    host.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }

  return {
    update(nextFiles: TabFile[], selected: string, projectId: string, options: TabUpdateOptions = {}): void {
      files = nextFiles;
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
      if (!paths.length) active = "";
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
      callbacks.openAuxiliary(tab.id);
    },
    activateFile(): void {
      if (!auxiliaryActive) return;
      auxiliaryActive = false;
      render();
    },
  };
}
