/// <reference lib="dom" />

// Captures Simplified Chinese product screenshots for the website and social posts.
// Output: marketing/shots/<lang>/*.png (2x device scale). Usage: tsx scripts/capture-marketing.ts [zh-CN|en]

import { existsSync } from "node:fs";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import type { AddressInfo } from "node:net";
import os from "node:os";
import path from "node:path";

import { chromium, type Page } from "playwright";

import { createPaperServer } from "../src/server/main.ts";

const language = process.argv[2] === "en" ? "en" : "zh-CN";
const outputDir = path.resolve("marketing/shots", language);

const zhMainSource = String.raw`\documentclass[11pt]{ctexart}
\usepackage[margin=1in]{geometry}
\usepackage{amsmath,graphicx}
\usepackage[colorlinks=true,linkcolor=blue,citecolor=blue]{hyperref}
\input{macros}

\title{面向人机协作的科研写作}
\author{陈一鸣 \and 林晓}
\date{2026年10月}

\begin{document}
\maketitle

\begin{abstract}
本文探讨研究者如何与 AI 智能体协作撰写论文：每一处修改都可追溯、可审阅，
论文始终是普通的源文件和 Git 仓库。
\end{abstract}

\section{引言}
科研写作是一个反复迭代的过程。想法、实验与解释在团队讨论中\cite{chen2026}不断演化。

协作编辑器应当让\cmtbg{claim}{林晓}批注与修订记录\cmted{这里能不能说得更具体一点？}
对人和工具同样可见。经过校验的修改让整个流程
\addbg{revision}{陈一鸣}可审计、可复现\added。

\input{sections/method}

\section{结果}\label{sec:results}
系统的演化满足方程~\eqref{eq:wave}，测得的响应见图~\ref{fig:spectrum}。
每个项目都是一个普通的 Git 仓库，浏览器中的编辑实时同步。

\begin{figure}[h]
\centering
\includegraphics[width=.6\linewidth]{figures/spectrum}
\caption{测得的谱响应。}
\label{fig:spectrum}
\end{figure}

\section{下一步}
我们将在更长的多作者论文上评估这一流程，协议细节见第~\ref{sec:method}~节。

\bibliographystyle{plain}
\bibliography{references}
\end{document}
`;

const zhMethodSource = String.raw`\section{方法}\label{sec:method}
智能体上传修改时附带它所读取版本的哈希值。若期间有人改动过文件，
服务器会拒绝过期的修改，而不是覆盖合作者的工作。
\begin{equation}
i\hbar \frac{\partial}{\partial t}\ket{\psi} = \Hamiltonian\ket{\psi}\label{eq:wave}
\end{equation}
`;

const enMainSource = String.raw`\documentclass[11pt]{article}
\usepackage[margin=1in]{geometry}
\usepackage{amsmath,graphicx}
\usepackage[colorlinks=true,linkcolor=blue,citecolor=blue]{hyperref}
\input{macros}

\title{Writing Papers with Humans and Agents}
\author{Yiming Chen \and Xiao Lin}
\date{October 2026}

\begin{document}
\maketitle

\begin{abstract}
We study how researchers co-write papers with AI agents while every change stays
traceable and reviewable, and the paper remains ordinary files in a Git repository.
\end{abstract}

\section{Introduction}
Scientific writing is iterative. Ideas, experiments, and explanations evolve
together as a team develops a shared account of its results~\cite{chen2026}.

A collaborative editor should keep \cmtbg{claim}{Xiao Lin}review metadata\cmted{Can we make this claim more specific?}
visible to people and tools. Checked edits make the workflow
\addbg{revision}{Yiming Chen}auditable and reproducible\added.

\input{sections/method}

\section{Results}\label{sec:results}
The dynamics follow Equation~\eqref{eq:wave}; Figure~\ref{fig:spectrum} shows the
measured response. Every project remains an ordinary Git repository.

\begin{figure}[h]
\centering
\includegraphics[width=.6\linewidth]{figures/spectrum}
\caption{Measured spectral response.}
\label{fig:spectrum}
\end{figure}

\section{Next steps}
We will evaluate the workflow on longer multi-author papers (Section~\ref{sec:method}).

\bibliographystyle{plain}
\bibliography{references}
\end{document}
`;

const enMethodSource = String.raw`\section{Method}\label{sec:method}
Each agent upload carries the hash of the version it read. If anyone changed the
file in the meantime, the server rejects the stale edit instead of overwriting it.
\begin{equation}
i\hbar \frac{\partial}{\partial t}\ket{\psi} = \Hamiltonian\ket{\psi}\label{eq:wave}
\end{equation}
`;

const zh = language === "zh-CN";
const mainSource = zh ? zhMainSource : enMainSource;
const methodSource = zh ? zhMethodSource : enMethodSource;
const savedLive = zh ? "已实时保存" : "Saved live";

const macroSource = String.raw`\newcommand{\braket}[2]{\left\langle #1 \middle| #2 \right\rangle}
\newcommand{\ket}[1]{\left|#1\right\rangle}
\newcommand{\Hamiltonian}{\hat{H}}
`;

const references = String.raw`@article{chen2026,
  title = {Auditable Collaboration for Scientific Writing},
  author = {Chen, Yiming and Lin, Xiao},
  journal = {Journal of Open Research},
  year = {2026}
}
`;

// latexmk runs with -pdf; swapping its pdflatex command lets the ctex paper build with XeLaTeX.
const latexmkrc = "$pdflatex = 'xelatex %O %S';\n";

const spectrum = `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="400" viewBox="0 0 720 400">
  <rect width="720" height="400" fill="#ffffff"/>
  <path d="M72 48V330H670" fill="none" stroke="#26332c" stroke-width="3"/>
  <path d="M80 320 C160 310 200 120 260 110 C320 100 330 290 400 280 C470 270 500 70 560 64 C610 60 640 250 660 300" fill="none" stroke="#0b6e4f" stroke-width="5"/>
  <path d="M80 326 C180 320 240 230 300 230 C380 230 420 300 500 260 C560 230 620 270 660 310" fill="none" stroke="#c4683c" stroke-width="4" stroke-dasharray="10 8"/>
</svg>`;

async function api(base: string, pathname: string, init?: RequestInit): Promise<Response> {
  const response = await fetch(`${base}${pathname}`, init);
  if (!response.ok) throw new Error(`${init?.method || "GET"} ${pathname}: ${response.status} ${await response.text()}`);
  return response;
}

async function sourcePoint(page: Page, needle: string): Promise<{ x: number; y: number }> {
  return page.evaluate(value => {
    const view = (window as Window & { __paperE2E?: { state: { view: {
      state: { doc: { toString(): string } };
      coordsAtPos(position: number): { left: number; right: number; top: number; bottom: number } | null;
    } } } }).__paperE2E?.state.view;
    if (!view) throw new Error("Editor state is unavailable");
    const index = view.state.doc.toString().indexOf(value);
    if (index < 0) throw new Error(`Source text not found: ${value}`);
    const coordinates = view.coordsAtPos(index + Math.floor(value.length / 2));
    if (!coordinates) throw new Error(`Source text is outside the viewport: ${value}`);
    return { x: (coordinates.left + coordinates.right) / 2, y: (coordinates.top + coordinates.bottom) / 2 };
  }, needle);
}

async function hover(page: Page, needle: string, tooltip: string, file: string): Promise<void> {
  await page.mouse.move(700, 20);
  await page.waitForTimeout(400);
  const point = await sourcePoint(page, needle);
  await page.mouse.move(point.x, point.y, { steps: 8 });
  await page.locator(tooltip).waitFor();
  await page.waitForTimeout(900);
  await page.screenshot({ path: path.join(outputDir, file) });
}

async function main(): Promise<void> {
  const stateDir = await mkdtemp(path.join(os.tmpdir(), "latexcoder-marketing-"));
  const compiler = ["/Library/TeX/texbin/latexmk", "/usr/bin/latexmk"].find(existsSync);
  const paper = await createPaperServer({ stateDir, authDisabled: true, compiler });
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  try {
    await new Promise<void>((resolve, reject) => {
      paper.server.once("error", reject);
      paper.server.listen(0, "127.0.0.1", resolve);
    });
    const base = `http://127.0.0.1:${(paper.server.address() as AddressInfo).port}`;
    const project = (await api(base, "/v1/projects").then(response => response.json()) as { projects: Array<{ id: string }> }).projects[0];
    if (!project) throw new Error("Default project was not created");
    const json = { "Content-Type": "application/json" };
    await api(base, `/v1/projects/${project.id}`, { method: "PATCH", headers: json, body: JSON.stringify({ name: zh ? "人机协作写作" : "Humans + Agents" }) });
    const projectQuery = new URLSearchParams({ project: project.id });
    const upload = (filePath: string, body: string | ArrayBuffer, contentType = "text/plain"): Promise<Response> => {
      const query = new URLSearchParams({ project: project.id, path: filePath });
      return api(base, `/v1/files?${query}`, { method: "PUT", headers: { "Content-Type": contentType }, body });
    };
    await upload("main.tex", mainSource);
    await upload("sections/method.tex", methodSource);
    await upload("macros.tex", macroSource);
    await upload("references.bib", references);
    await upload("latexmkrc", latexmkrc);
    browser = await chromium.launch();
    const figurePage = await browser.newPage({ viewport: { width: 720, height: 400 }, deviceScaleFactor: 2 });
    await figurePage.setContent(`<body style="margin:0">${spectrum}</body>`);
    const png = await figurePage.screenshot();
    const pngBody = new Uint8Array(png.length);
    pngBody.set(png);
    await upload("figures/spectrum.png", pngBody.buffer, "image/png");
    await figurePage.close();
    await api(base, `/v1/git/commit?${projectQuery}`, { method: "POST", headers: json, body: JSON.stringify({ message: zh ? "初稿" : "First draft" }) });
    await api(base, `/v1/compile?${projectQuery}`, { method: "POST", headers: json, body: JSON.stringify({ main: "main.tex" }) });

    await mkdir(outputDir, { recursive: true });
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, locale: language });
    await context.addInitScript(lang => {
      localStorage.setItem("latexcoder-theme", "light");
      localStorage.setItem("latexcoder-language", lang);
    }, language);
    const page = await context.newPage();
    await page.goto(`${base}/projects/${project.id}?e2e=1`);
    await page.locator("#editor-page").waitFor();
    await page.waitForFunction(text => document.querySelector("#sync-state")?.textContent === text, savedLive);
    await page.locator("#pdf-document canvas").first().waitFor();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(outputDir, "workspace.png") });

    await hover(page, "eq:wave", ".cm-formula-tooltip", "hover-eqref.png");
    await hover(page, "chen2026", ".cm-citation-tooltip", "hover-cite.png");
    await hover(page, "fig:spectrum", ".cm-image-tooltip", "hover-figure.png");
    await page.mouse.move(700, 20);

    await page.locator("#toggle-review").click();
    await page.locator("#review-list .review-item").first().waitFor();
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(outputDir, "review.png") });
    await page.locator("#close-review").click();

    await page.locator("#collaborate-menu").click();
    await page.locator("#collaborate-agent").click();
    await page.locator("#agent-access-dialog").waitFor();
    await page.addStyleTag({ content: "#agent-command { color: transparent !important; text-shadow: 0 0 7px rgba(24,32,27,.55); }" });
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(outputDir, "agent.png") });
    await page.keyboard.press("Escape");

    await page.locator("#collaborate-menu").click();
    await page.locator("#collaborate-git").click();
    await page.locator("#git-access-dialog").waitFor();
    await page.addStyleTag({ content: "#clone-command { color: transparent !important; text-shadow: 0 0 7px rgba(24,32,27,.55); }" });
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(outputDir, "git.png") });
    await page.close();

    const mobile = await context.newPage();
    await mobile.setViewportSize({ width: 430, height: 900 });
    await mobile.goto(`${base}/projects/${project.id}?e2e=1`);
    await mobile.locator("#editor-page").waitFor();
    await mobile.waitForFunction(text => document.querySelector("#sync-state")?.textContent === text, savedLive);
    await mobile.locator("#open-pdf").click();
    await mobile.locator("#pdf-document canvas").first().waitFor();
    await mobile.waitForTimeout(1200);
    await mobile.screenshot({ path: path.join(outputDir, "mobile-pdf.png") });
    await mobile.close();
  } finally {
    await browser?.close();
    paper.shutdown();
    paper.sockets.close();
    await new Promise<void>(resolve => paper.server.close(() => resolve()));
    await rm(stateDir, { recursive: true, force: true });
  }
}

await main();
