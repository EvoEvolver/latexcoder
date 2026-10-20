import assert from "node:assert/strict";
import test from "node:test";
import { findMainDocument } from "../src/server/main-document.ts";

const document = "\\documentclass{article}\n\\begin{document}\nHello\n\\end{document}";
const detect = (files: Record<string, string>) => findMainDocument(Object.entries(files).map(([path, source]) => ({ path, source })));

test("main detection selects a document rather than libraries, fragments or a misleading main.tex", () => {
  assert.equal(detect({
    "qcircuit.tex": "\\ProvidesPackage{qcircuit}\n\\newcommand{\\circuit}{diagram}",
    "main.tex": "\\input{defs}",
    "defs.tex": "\\newtheorem{thm}{Theorem}",
    "lec.tex": document,
  }), "lec.tex");
  assert.equal(detect({ "main.tex": "\\section{Chapter}", "nested/paper.tex": document }), "nested/paper.tex");
});

test("main detection ignores comments, escaped commands, verbatim and embedded example files", () => {
  const examples = [
    "% " + document.replaceAll("\n", "\n% "),
    "\\\\documentclass{article}\n\\\\begin{document}",
    "\\begin{verbatim}\n" + document + "\n\\end{verbatim}",
    "\\begin{lstlisting}\n" + document + "\n\\end{lstlisting}",
    "\\begin{minted}{latex}\n" + document + "\n\\end{minted}",
    "\\begin{filecontents*}{example.tex}\n" + document + "\n\\end{filecontents*}",
    "\\begin{comment}\n" + document + "\n\\end{comment}",
    "\\verb|\\documentclass{article}| \\verb*+\\begin{document}+",
  ];
  for (const source of examples) assert.equal(detect({ "main.tex": source, "lecture.tex": document }), "lecture.tex", source);
  assert.equal(detect({ "main.tex": "% \\begin{verbatim}\n" + document }), "main.tex");
  assert.equal(detect({ "main.tex": "\\% not a comment\n" + document, "aaa.tex": "" }), "main.tex");
});

test("main detection honors valid leading root directives and conventional TeX root comments", () => {
  assert.equal(detect({ "main.tex": document, "paper.tex": document, "chapter.tex": "%% latexcoder:root paper.tex\n\\section{Chapter}" }), "paper.tex");
  assert.equal(detect({ "main.tex": document, "paper.tex": document, "chapters/a.tex": "% !TeX root = ../paper.tex\n\\section{Chapter}" }), "paper.tex");
  for (const directive of ["%% latexcoder:root missing.tex", "%% latexcoder:root ../../outside.tex", "%% latexcoder:root", "%% latexcoder:chapter-root chapter.tex"]) {
    assert.equal(detect({ "main.tex": document, "chapter.tex": directive + "\n\\section{Chapter}" }), "main.tex");
  }
  assert.equal(detect({ "main.tex": document, "paper.tex": document + "\n%% latexcoder:root paper.tex" }), "main.tex");
});

test("main detection follows includes, avoids subdocuments and prefers real roots to templates", () => {
  assert.equal(detect({
    "example.tex": document,
    "paper.tex": document + "\n\\input{sections/intro}\n\\include{sections/results}",
    "sections/intro.tex": "\\input{sections/details}",
    "sections/results.tex": "\\section{Results}",
    "sections/details.tex": "\\section{Details}",
  }), "paper.tex");
  assert.equal(detect({
    "chapter.tex": document + "\n\\input{notes}",
    "notes.tex": "\\input{chapter}", // A cycle must terminate.
    "paper.tex": document + "\n\\subfile{chapter}",
  }), "paper.tex");
  assert.equal(detect({ "main.tex": document + "\n%% latexcoder:content", "paper.tex": document }), "paper.tex");
  assert.equal(detect({ "examples/main.tex": document, "lecture.tex": document }), "lecture.tex");
  assert.equal(detect({
    "example.tex": document,
    "preamble.tex": "\\documentclass{article}",
    "lecture.tex": "\\input{preamble}\n\\begin{document}Lecture\\end{document}",
  }), "lecture.tex");
  assert.equal(detect({ "main.tex": "\\input{lecture}", "lecture.tex": document }), "main.tex");
  assert.equal(detect({
    "body.tex": "\\begin{document}Lecture\\end{document}",
    "lecture.tex": "\\documentclass{article}\n\\input{body}",
  }), "lecture.tex");
});

test("main detection is deterministic and falls back for incomplete or empty projects", () => {
  const files = { "zzz.tex": document, "main.tex": document, "aaa.tex": document };
  assert.equal(detect(files), "main.tex");
  assert.equal(detect(Object.fromEntries(Object.entries(files).reverse())), "main.tex");
  assert.equal(detect({ "chapter.tex": "\\section{Fragment}", "paper.tex": "\\documentclass{article}" }), "paper.tex");
  assert.equal(detect({ "z.tex": "z", "main.tex": "main", "a.tex": "a" }), "main.tex");
  assert.equal(detect({ "main.tex": "main", "z.tex": "\\input{main}" }), "main.tex");
  assert.equal(detect({ "z.tex": "z", "chapters/a.tex": "a" }), "z.tex");
  assert.equal(detect({ "README.md": document }), undefined);
  assert.equal(detect({}), undefined);
});
