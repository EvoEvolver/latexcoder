import { readFile } from "node:fs/promises";
import path from "node:path";
import { compileDirectives } from "../shared/compile-directives.ts";
import { stripReviewStorage } from "../shared/review.ts";
import { apiError, MAX_TEXT_BYTES } from "./core.ts";
import { listFiles } from "./project-files.ts";

type SourceFile = { path: string; source: string };

// Ignore comments, escaped backslashes, and literal examples without trying to
// expand TeX macros. In particular, package documentation is not a document.
function executableSource(source: string): string {
  const tokens = /%[^\r\n]*|\\([A-Za-z@]+|[\s\S])/g;
  let result = "", cursor = 0;
  function skip(from: number, to: number): void {
    result += source.slice(cursor, from) + source.slice(from, to).replace(/[^\r\n]/g, " ");
    cursor = to;
    tokens.lastIndex = to;
  }
  for (let match; (match = tokens.exec(source));) {
    if (match[0].startsWith("%") || !/^[A-Za-z@]+$/.test(match[1])) {
      skip(match.index, tokens.lastIndex);
    } else if (match[1] === "verb") {
      const start = tokens.lastIndex + (source[tokens.lastIndex] === "*" ? 1 : 0);
      const delimiter = source[start];
      if (delimiter && !/\s/.test(delimiter)) {
        const end = source.indexOf(delimiter, start + 1);
        const lineEnd = source.indexOf("\n", start);
        skip(match.index, end >= 0 && (lineEnd < 0 || end < lineEnd) ? end + 1 : lineEnd < 0 ? source.length : lineEnd);
      }
    } else if (match[1] === "begin") {
      const environment = /^\s*\{(verbatim\*?|Verbatim|lstlisting|minted|comment|filecontents\*?)\}/.exec(source.slice(tokens.lastIndex));
      if (environment) {
        const marker = "\\end{" + environment[1] + "}";
        const end = source.indexOf(marker, tokens.lastIndex + environment[0].length);
        skip(match.index, end < 0 ? source.length : end + marker.length);
      }
    }
  }
  return result + source.slice(cursor);
}

function targetPath(value: string, directory = ""): string | undefined {
  const normalized = path.posix.normalize(path.posix.join(directory, value.replace(/^"(.*)"$/, "$1")));
  if (path.posix.isAbsolute(value) || normalized === ".." || normalized.startsWith("../")) return;
  return normalized;
}

export function findMainDocument(files: SourceFile[]): string | undefined {
  const sources = new Map(files.filter(file => file.path.endsWith(".tex")).map(file => [file.path, stripReviewStorage(file.source)]));
  const explicit = new Map<string, number>();
  const included = new Set<string>();
  const links = new Map<string, Set<string>>();
  const candidates = [...sources].map(([file, source]) => {
    let root: string | undefined;
    try { root = compileDirectives(source, file).root?.value; }
    catch { /* An invalid directive is reported by compilation, not detection. */ }
    if (root) {
      const target = targetPath(root);
      if (target && sources.has(target)) explicit.set(target, (explicit.get(target) || 0) + 1);
    } else {
      for (const line of source.replace(/^\uFEFF/, "").split(/\r?\n/)) {
        if (line.trim() && !line.trimStart().startsWith("%")) break;
        const magic = /^\s*%\s*!\s*TeX\s+root\s*=\s*(.+?)\s*$/i.exec(line);
        const target = magic && targetPath(magic[1], path.posix.dirname(file));
        if (target && sources.has(target)) explicit.set(target, (explicit.get(target) || 0) + 1);
      }
    }
    const clean = executableSource(source);
    const children = new Set<string>();
    for (const match of clean.matchAll(/\\(?:input|include|subfile)\b\s*(?:\[[^\]]*\]\s*)?(?:\{([^{}]+)\}|([^\s%{}]+))/g)) {
      const value = (match[1] || match[2]).trim();
      for (const directory of ["", path.posix.dirname(file)]) {
        const target = targetPath(value.endsWith(".tex") ? value : value + ".tex", directory);
        if (target && target !== file && sources.has(target)) {
          children.add(target);
          included.add(target);
          break;
        }
      }
    }
    links.set(file, children);
    const documentClass = /\\document(?:class|style)\b/.test(clean);
    const documentBody = /\\begin\s*\{document\}/.test(clean);
    return {
      path: file,
      document: documentClass ? documentBody ? 3 : 2 : documentBody ? 1 : 0,
      template: /^\s*%%\s*latexcoder:content\s*$/m.test(source),
    };
  });
  const byPath = new Map(candidates.map(file => [file.path, file]));
  const evidenceCache = new Map<string, { descendants: number; document: number }>();
  function evidence(file: string): { descendants: number; document: number } {
    const cached = evidenceCache.get(file);
    if (cached !== undefined) return cached;
    const visited = new Set([file]);
    const pending = [...(links.get(file) || [])];
    for (let index = 0; index < pending.length; index++) {
      const child = pending[index];
      if (visited.has(child)) continue;
      visited.add(child);
      pending.push(...(links.get(child) || []));
    }
    let documentClass = false, documentBody = false;
    for (const entry of visited) {
      const document = byPath.get(entry)!.document;
      documentClass ||= document >= 2;
      documentBody ||= document === 1 || document === 3;
    }
    const result = { descendants: visited.size - 1, document: documentClass ? documentBody ? 3 : 2 : documentBody ? 1 : 0 };
    evidenceCache.set(file, result);
    return result;
  }
  // Source evidence wins over filenames. With several standalone documents,
  // prefer the one that owns the project tree, then conventional names/paths.
  const ranked = candidates.filter(file => explicit.has(file.path) || evidence(file.path).document);
  const pool = ranked.length ? ranked : candidates;
  return pool.sort((left, right) =>
    (ranked.length ? (
      (explicit.get(right.path) || 0) - (explicit.get(left.path) || 0)
      || Number(left.template) - Number(right.template)
      || Number(included.has(left.path)) - Number(included.has(right.path))
      || evidence(right.path).document - evidence(left.path).document
      || evidence(right.path).descendants - evidence(left.path).descendants
    ) : 0)
    || left.path.split("/").length - right.path.split("/").length
    || Number(path.posix.basename(right.path) === "main.tex") - Number(path.posix.basename(left.path) === "main.tex")
    || left.path.localeCompare(right.path)
  )[0]?.path;
}

export async function detectMainDocument(
  projectDir: string,
  readSource: (file: string) => string | Promise<string> = file => readFile(path.join(projectDir, file), "utf8"),
): Promise<string | undefined> {
  const files = (await listFiles(projectDir)).filter(file => file.path.endsWith(".tex"));
  const sources: SourceFile[] = [];
  // Read one file at a time, avoiding an unbounded number of open descriptors.
  for (const file of files) {
    if (file.size > MAX_TEXT_BYTES) throw apiError("file_too_large", file.path + " is too large to inspect", 413);
    sources.push({ path: file.path, source: await readSource(file.path) });
  }
  return findMainDocument(sources);
}
