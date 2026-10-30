---
name: LaTeX Coder
description: The project website as a galley proof of a LaTeX paper, laid on a green desk blotter and marked up in red and blue pencil.
colors:
  blotter: "#0f3d2f"
  blotter-ink: "#e4ede7"
  blotter-dim: "#a9c2b5"
  paper: "#fdfcf8"
  listing-paper: "#f3f1ea"
  ink: "#1b1b19"
  ink-2: "#4a4944"
  ink-3: "#6b6962"
  hairline: "#d9d6cc"
  red-pencil: "#bf3328"
  red-wash: "rgba(191, 51, 40, 0.13)"
  blue-pencil: "#2152b0"
  blue-wash: "rgba(33, 82, 176, 0.12)"
  press-green: "#0b6e4f"
  press-green-deep: "#085a40"
typography:
  display:
    fontFamily: "CMU Serif, Latin Modern Roman, Computer Modern, Georgia, serif"
    fontSize: "clamp(46px, 6.6vw, 86px)"
    fontWeight: 700
    lineHeight: 1.02
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "CMU Serif, Latin Modern Roman, Computer Modern, Georgia, serif"
    fontSize: "clamp(30px, 3.6vw, 44px)"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-0.015em"
  title:
    fontFamily: "CMU Serif, Latin Modern Roman, Computer Modern, Georgia, serif"
    fontSize: "30px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  subtitle:
    fontFamily: "CMU Serif, Latin Modern Roman, Computer Modern, Georgia, serif"
    fontSize: "22px"
    fontWeight: 700
    lineHeight: 1.3
  body:
    fontFamily: "CMU Serif, Latin Modern Roman, Computer Modern, Georgia, serif"
    fontSize: "19px"
    fontWeight: 400
    lineHeight: 1.55
  caption:
    fontFamily: "CMU Serif, Latin Modern Roman, Computer Modern, Georgia, serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.45
  running-head:
    fontFamily: "CMU Serif, Latin Modern Roman, Computer Modern, Georgia, serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: "0.02em"
    fontFeature: "small-caps"
  label:
    fontFamily: "CMU Sans, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "16px"
    fontWeight: 600
    lineHeight: 1
  nav:
    fontFamily: "CMU Sans, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "15px"
    fontWeight: 500
    lineHeight: 1
  mono:
    fontFamily: "CMU Typewriter, Latin Modern Mono, ui-monospace, Menlo, monospace"
    fontSize: "15.5px"
    fontWeight: 400
    lineHeight: 1.6
  hand:
    fontFamily: "Kalam, Comic Sans MS, cursive"
    fontSize: "18px"
    fontWeight: 400
    lineHeight: 1.25
rounded:
  none: "0px"
  control: "8px"
spacing:
  gutter-left: "88px"
  gutter-right: "248px"
  note-width: "176px"
  sheet-max: "1120px"
  sheet-gap: "44px"
  section: "48px"
  block: "16px"
  figure: "44px"
components:
  button-primary:
    backgroundColor: "{colors.press-green}"
    textColor: "#ffffff"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "0 22px"
    height: "48px"
  button-primary-hover:
    backgroundColor: "{colors.press-green-deep}"
    textColor: "#ffffff"
  button-ink:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "0 22px"
    height: "48px"
  button-ink-hover:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
  desk-github:
    backgroundColor: "transparent"
    textColor: "{colors.blotter-ink}"
    typography: "{typography.nav}"
    rounded: "{rounded.control}"
    padding: "9px 14px"
  desk-nav-link:
    textColor: "{colors.blotter-dim}"
    typography: "{typography.nav}"
  proof-sheet:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "40px 248px 44px 88px"
    width: "1120px"
  margin-note-red:
    textColor: "{colors.red-pencil}"
    typography: "{typography.hand}"
    width: "{spacing.note-width}"
  margin-note-blue:
    textColor: "{colors.blue-pencil}"
    typography: "{typography.hand}"
    width: "{spacing.note-width}"
  listing:
    backgroundColor: "{colors.listing-paper}"
    textColor: "{colors.ink}"
    typography: "{typography.mono}"
    rounded: "{rounded.none}"
    padding: "18px 20px"
---

# Design System: LaTeX Coder

## Overview

**Creative North Star: "The Galley Proof on the Lab Desk"**

The website is a typeset LaTeX paper in proof: white sheets set in Computer Modern, with running heads, folios, line numbers every fifth line, numbered sections, booktabs tables, propositions, an algorithm block, code listings, captioned figures and a reference list. The sheets lie on a deep green desk blotter, and coauthors and an agent have already marked them up: red pencil for people, blue pencil for the agent, handwritten notes in the outer margin anchored to the words they mark. Everything the page says, it says as part of the paper; there is no landing-page chrome on the paper.

Density is that of a real article: long measure, justified abstract, generous section breaks, and evidence carried by numbered figures that are real product screenshots. The world refuses the dev-tool landing page (centred hero over a window screenshot, icon-card grids). The proof-sheet ground, blotter and pencil system are the reusable signature; the specific story told on the first sheet belongs to the surface brief (`.impeccable/surfaces/site-index-html.md`), not here.

The blotter ground is #0f3d2f, a deliberate darker replacement of the #0f4f3b named in the direction contract: the darker green makes the paper sheets read as lit objects on a desk and keeps the primary green action distinct from the ground.

**Key Characteristics:**
- Green blotter ground, white proof sheets with a soft cast shadow, square corners.
- Computer Modern everywhere on the sheet (serif for text, sans for controls, typewriter for code); Kalam handwriting only for pencil notes.
- Paper apparatus as structure: running head, folio, line numbers, section numbers, captions, booktabs rules.
- Two pencils with fixed meanings: red is a human, blue is an agent.
- Brand green only on the blotter and the primary action.
- Marks draw on once, in pencil; pointing at a note lights the text it marks.

## Colors

A two-material palette: green desk, white paper in near-black ink, with two pencil colors and one press-green action.

### Primary
- **Press Green** (`press-green`): the primary action fill ("Deploy on Railway") and nothing else on the sheet; its hover deepens to **Press Green Deep** (`press-green-deep`).

### Secondary
- **Red Pencil** (`red-pencil`): human marks. Underlines, strike-throughs, and the margin notes written by coauthors. Its translucent **Red Wash** (`red-wash`) lights the marked text while its note is pointed at.

### Tertiary
- **Blue Pencil** (`blue-pencil`): agent marks. Insertions with a caret, underlines, agent margin notes, and the focus ring. **Blue Wash** (`blue-wash`) is the lit state and the text selection color.

### Neutral
- **Blotter Green** (`blotter`): page ground and the sticky desk bar (92% opaque with blur). Darker than the contract's #0f4f3b by design.
- **Blotter Ink** (`blotter-ink`): brand name and the GitHub control on the desk bar.
- **Blotter Dim** (`blotter-dim`): desk-bar nav links at rest; they brighten to white on hover.
- **Proof Paper** (`paper`): the sheet surface; a warm, barely-off white.
- **Listing Paper** (`listing-paper`): the slightly darker stock behind code listings.
- **Ink** (`ink`): body text, headings, booktabs rules, secondary button stroke.
- **Ink 2** (`ink-2`): captions, affiliations, keywords, footnotes, secondary table columns.
- **Ink 3** (`ink-3`): running heads, folios, algorithm line markers, dimmed listing output.
- **Hairline** (`hairline`): figure borders and quiet link underlines.

### Named Rules
**The Two Pencils Rule.** Red always means a person, blue always means an agent. Never swap them and never use either as decoration without a mark it belongs to.

**The Press Green Rule.** Green appears on the desk and on the primary action. On the paper it is the one button you are meant to press.

## Typography

**Display Font:** CMU Serif (with Latin Modern Roman, Computer Modern, Georgia)
**Body Font:** CMU Serif
**UI Font:** CMU Sans (with system-ui), for buttons and the desk bar only
**Mono Font:** CMU Typewriter (with Latin Modern Mono, ui-monospace)
**Hand Font:** Kalam (Google Fonts), for pencil notes only

**Character:** The Computer Modern family is the world: a reader should recognise the page as LaTeX output before reading a word. Fonts are self-hosted subsets in `site/assets/fonts`; Kalam is the one external face, because handwriting is the one thing a typeset proof does not contain.

### Hierarchy
- **Display** (700, clamp 46–86px, 1.02, -0.02em): the paper title on the first sheet only; 42px on phones.
- **Headline** (700, clamp 30–44px, 1.15): a lead-in sentence that opens a section in larger type.
- **Title** (700, 30px, 1.2): numbered section heads ("1 How this started"); 25px on phones.
- **Subtitle** (700, 22px, 1.3): numbered subsections and the References head.
- **Body** (400, 19px, 1.55): running text; abstract at 20px justified with hyphenation, 17px body on phones.
- **Caption** (400, 16px, 1.45, Ink 2): figure, table and listing captions, led by a bold "Figure n." label.
- **Running head** (400, 15px, small caps, 0.02em): running heads; folios share the size without small caps.
- **Label** (CMU Sans 600, 16px): button text.
- **Hand** (Kalam 400, 18px, 1.25): margin notes, with the author name in 700 at 15px.

### Named Rules
**The Typeset Rule.** Every heading, label and number on the sheet uses a device LaTeX would print: section numbers, "Figure n.", "Table n.", "Proposition n", "Algorithm n", small-caps running heads. No eyebrows or kickers above headings.

**The One Hand Rule.** Kalam appears only inside pencil notes and the insertion caret. Nothing typeset is ever handwritten.

## Layout

Pages are a single column of proof sheets (max 1120px) stacked on the blotter with a 44px gap. Each sheet has asymmetric margins like a proof: an 88px inner gutter that carries line numbers every fifth line, and a 248px outer margin that holds 176px handwritten notes, placed by script level with the text they mark and never overlapping. Title block, wide figures, figure pairs, running head and folio reach into the outer margin (to 40px from the edge) when they need the width.

Rhythm: 48px between sections, 44px above figures, 16px between blocks, 28px before algorithms, listings and remarks. Every sheet opens with a running head ruled underneath and closes with a folio carrying the page number.

Responsive: at 1100px and below both gutters shrink to 64px and margin notes drop inline under their paragraph, slightly rotated. At 760px gutters go to 34/18px, desk-bar nav hides (brand and GitHub stay), buttons fill the row, figure pairs and result lists go to one column, and booktabs tables restack each row into a short entry with small-caps column labels. Reduced motion disables smooth scrolling and all transitions.

## Elevation & Depth

Depth is physical and has exactly one job: paper lying on a desk. Sheets carry a two-layer cast shadow; everything on the sheet is flat ink. The primary button has a small press shadow so it reads as the one raised object on the page. Outlines are drawn with inset box-shadows (secondary button, GitHub control) rather than borders.

### Shadow Vocabulary
- **Sheet on blotter** (`box-shadow: 0 2px 4px rgba(0,0,0,0.18), 0 28px 60px -18px rgba(0,0,0,0.5)`): every proof sheet.
- **Press** (`box-shadow: 0 1px 1px rgba(0,0,0,0.14), 0 6px 14px -6px rgba(0,0,0,0.35)`): primary button only.
- **Inked outline** (`box-shadow: inset 0 0 0 1.5px var(--ink)`): secondary button stroke.
- **Desk outline** (`box-shadow: inset 0 0 0 1px rgba(228,237,231,0.28)`): GitHub control on the desk bar.

### Named Rules
**The Flat Ink Rule.** Nothing printed on the sheet casts a shadow. Only the sheet itself, and the primary action, sit above their ground.

## Shapes

Paper is square: sheets, figures, tables and listings have no radius. Rules do the structural work instead of boxes: booktabs top and bottom rules at 1.6px with a 0.8px midrule, a 0.6px rule under the running head, 0.6px hairline frames around screenshots, a 0.6px hairline on the listing's left edge. Controls are the only rounded objects (8px), marking them as things to press rather than things printed. Pencil marks are drawn as background-gradient strokes (2px underline, 3px strike) so they wrap with the text; notes tilt by -1.2deg (-0.6deg when inline) and carry a short leader stroke toward the text.

## Components

### Buttons
- **Shape:** gently rounded (8px), 48px tall, 22px side padding, CMU Sans 600 at 16px.
- **Primary:** Press Green fill, white text, press shadow; hover deepens to Press Green Deep. One per action row.
- **Secondary (ink):** transparent with a 1.5px inset ink stroke; hover fills with ink and turns the text to paper.
- **Active:** all buttons nudge down 1px. Transitions are 160ms ease-out on color and transform.
- **Aside link:** a text link in Ink 2 with a hairline underline that darkens to current color on hover, for the quieter alternative after the buttons.

### Navigation (desk bar)
- Sticky on the blotter, 92% blotter with a 10px blur, centred to the sheet width. Brand is the L keycap logo with "LaTeX Coder" in CMU Serif 700 at 21px. Section links in Blotter Dim, CMU Sans 500 at 15px, brighten to white on hover. The GitHub control is an 8px-rounded outline in Blotter Ink. On phones the section links hide.

### Proof sheet
- Paper fill, square corners, sheet shadow, asymmetric gutters (see Layout). Running head in small caps above a thin rule; folio at the foot with the page number in ink; line numbers in the inner gutter, 12px tabular serif, light grey.

### Paper apparatus
- **Booktabs table:** top/bottom 1.6px ink rules, 0.8px midrule, no vertical rules, caption above ("Table n.").
- **Figure:** full-width screenshot with a 0.6px hairline frame and a caption below ("Figure n.").
- **Proposition / Remark:** bold run-in label, italic statement, as amsthm prints them.
- **Algorithm:** ruled block with a titled header and numbered steps in small grey markers.
- **Listing:** Listing Paper stock, CMU Typewriter 15.5px, hairline left edge, caption below.
- **Results list:** two-column run-in definitions, bold term followed by Ink 2 description.
- **References:** bracketed numeric labels, 16px.

### Pencil marks and margin notes (signature)
- **Marks:** underline (`mark`), strike-through in red (`del`), insertion in blue with a handwritten caret (`ins`). Each mark has an id that a note points to.
- **Notes:** Kalam 18px in the pencil's color, author name bold on its own line, rotated -1.2deg, in the outer margin with a short leader stroke. Inline under the paragraph below 1100px.
- **Draw-on:** with script enabled, marks draw across (700ms, cubic-bezier(0.16, 1, 0.3, 1), 200ms delay) and notes fade up after them (500ms, 650ms delay), once. Without script, everything is visible.
- **Lit state:** pointing at a note washes its marked text in the matching pencil wash and nudges the note 4px toward the text.

## Do's and Don'ts

### Do:
- **Do** set the blotter ground at #0f3d2f (`blotter`); it is the recorded, deliberate replacement for the contract's #0f4f3b.
- **Do** express every new section as part of the paper: a numbered section, a numbered figure with a caption, a booktabs table, a proposition, an algorithm, or a listing.
- **Do** keep red for people and blue for agents in every mark and note.
- **Do** use real product screenshots as figures, framed with a hairline and captioned.
- **Do** keep controls in CMU Sans and everything typeset in CMU Serif.

### Don't:
- **Don't** put brand green on the paper except as the primary action fill.
- **Don't** round sheets, figures, tables or listings; only controls carry the 8px radius.
- **Don't** add shadows to anything printed on the sheet.
- **Don't** set typeset text in Kalam or use Kalam outside pencil notes.
- **Don't** put eyebrows or kickers above headings; use LaTeX's own numbering.
- **Don't** build centred hero-over-screenshot layouts or icon-card grids on this site.
