# Biblock support plan

Status: proposed. This document describes the first implementation of
`.bib.lock` support; these features are not yet implemented in LaTeX Coder.

## Goal

Present the verification state and evidence associated with bibliography entries
without requiring users to read the lockfile's JSON. A `references.bib.lock`
file belongs to `references.bib` in the same directory. The bibliography remains
ordinary BibTeX, while the lockfile carries provenance, integrity records,
approvals, proposals, and edit history.

The first version will provide read-only interpretation of this information in
citation previews and a bibliography verification overview. All durable state
will remain in the project's `.bib` and `.bib.lock` files.

## Meaning of the state

The presence of a lockfile does not establish that its entries are verified.
Interpretation requires checking the current bibliography against the recorded
content and evidence using Biblock's rules.

| Entry state | Meaning shown to the user |
| --- | --- |
| `verified` | Current content has consistent provider API evidence or explicit human approval. |
| `valid` | Content and evidence are consistent, but only agent or web evidence supports the entry; verification is still needed. |
| `stale` | Content covered by an integrity record or approval has changed. |
| `invalid` | Integrity, approval, or provenance is missing or inconsistent. |

Display the verification basis separately from the state: for example,
"Verified via Crossref" or "Human approved". Human approval can be an overlay
on an existing source, so the original source kind alone is insufficient to
identify the basis of verification. Actor labels are attribution, not
authenticated identities, and provider verification does not prove factual
correctness of the publication's metadata.

Keep these additional dimensions separate:

- **Lockfile synchronization:** whether the lockfile matches the current
  bibliography and has valid structure and history.
- **Pending proposals:** proposed replacements awaiting a decision. A pending
  proposal does not change the current entry's trust state, but prevents
  Biblock's overall readiness gate from passing.
- **Availability:** a missing lockfile means verification is not enabled for that
  bibliography. An unsupported format, malformed file, or unavailable checker
  means the status cannot be evaluated. These are distinct from an evaluated
  entry's `invalid` state.

None of these states will block LaTeX compilation.

## User experience

### Citation previews

Extend the existing `\cite{...}` hover card with an entry status and a short
explanation of its basis. Let users expand the evidence details or open the
corresponding overview entry to see the provider, identifier or source link,
approval attribution and time when available, and pending proposal information.

Associate an entry with both its bibliography path and citation key. Duplicate
keys across bibliography files must not cause evidence from one file to be
attached to an entry from another; show ambiguity instead of silently selecting
the first match.

### Lockfile overview

Selecting a `.bib.lock` file will open a structured, read-only overview instead
of the source editor or generic binary-file fallback. Keep the file visible in
the project tree and retain its download and project export behavior.

The overview will show:

- The associated bibliography and lockfile synchronization state.
- Counts of verified, valid, stale, and invalid entries.
- A filterable list of entries needing attention, with reasons.
- Pending proposals, their rationale, and saved before/after field differences.
- Available provenance and a concise history summary for a selected entry.

An entry action will navigate to its definition in the associated `.bib` file.
Missing bibliography files and unsupported or damaged lockfiles will have
explicit explanatory states rather than an empty or apparently successful view.

### Updates during editing

Changes to either file will invalidate its interpreted status. Debounce
re-evaluation and show that a check is pending, rather than continuing to present
an old verified badge as current. Apply the same behavior to browser edits,
agent uploads, Git updates, renames, and deletions. Results from a previous
project or an older file revision must not replace newer results.

## Backend integration

Use the existing Biblock CLI as the authority for interpretation. Its
`diagnosis` and `inspect` commands provide offline, read-only JSON covering
overall readiness, lockfile consistency, entry states, and provenance summaries.
Use its read-only proposal and history interfaces for details as needed.
Validated lockfile metadata can supply approval details that the basic entry
summary does not expose.

LaTeX Coder's current bibliography parser is designed to extract display fields.
It does not implement Biblock's canonicalization, macro resolution, evidence
validation, or version handling, so it should not determine verification state.

Add a project-scoped read-only API that returns a normalized overview and entry
details. The implementation should:

1. Capture the current `.bib` and `.bib.lock` as one revision-identified snapshot,
   using live collaborative content where applicable. Run the CLI against a
   temporary snapshot so separate commands inspect the same pair of files.
2. Invoke the CLI with explicit arguments and bounded execution time. Treat
   diagnosis exit code `3` as a successful report that work remains; distinguish
   it from exit code `2`, which indicates invalid input or an operational error.
3. Return the evaluated revisions with the result. Cache by project,
   bibliography path, both file revisions, and checker version; discard stale
   responses after edits or project switches.
4. Preserve Biblock's distinction between entry state, lockfile state, and
   pending proposals. Do not derive a green badge from field presence alone.
5. Report checker or format unavailability explicitly while leaving ordinary
   bibliography editing, citation previews, and compilation usable.

Pin a compatible Biblock version in the deployment image and document the local
development dependency. The inspected implementation is Biblock 0.12.0, which
writes lockfile format 1.1 and reads existing 1.0 lockfiles. Future versions
should be adopted through explicit compatibility checks.

Recognize `.bib.lock` as a specific file kind without treating every `.lock`
file as a bibliography lockfile. Ensure updates through the project API and Git
remain observable and invalidate the semantic view. Keep the raw sidecar intact
in storage, downloads, and exports.

## Implementation sequence

1. Add lockfile recognition, file pairing, the CLI adapter, and the read-only API.
2. Add the lockfile overview and navigation to bibliography entries.
3. Extend citation hover cards with state and evidence details.
4. Connect revision-based caching and invalidation to existing project updates.
5. Add deployment support, documentation, and focused integration coverage.

## Verification

Use fixtures produced by the pinned Biblock version and compare displayed states
with its output. Cover provider verification, human approval over another source
kind, agent/web evidence, changed content, and inconsistent evidence. Include a
verified entry with a pending proposal to test that these remain separate.

Also cover missing and malformed lockfiles, unsupported versions, orphaned
lockfiles, missing checker, duplicate keys across files, and a bibliography
edited during evaluation. Confirm citation cards and the overview update after
both bibliography and sidecar changes, and that read-only inspection changes
neither project file. Verify compilation and export still work with or without
a lockfile.

## Later work

Human approval, provider lookups, proposal adoption or rejection, history
restoration, and automatic lockfile synchronization are outside the first
version. These actions modify bibliography workflow state and should be designed
as explicit review operations after read-only support is established.

## References

- [Biblock source and CLI documentation](https://github.com/EvoEvolver/biblock)
- [Lockfile format and trust model](https://github.com/EvoEvolver/biblock/blob/main/docs/lockfile.md)
- Existing integration points: `src/client/citation-hover.ts`,
  `src/client/file-tree.ts`, `src/shared/bibliography.ts`, and
  `src/server/core.ts`.
