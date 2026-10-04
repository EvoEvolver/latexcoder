<p align="center">
  <img src="docs/images/l-keycap.svg" width="112" alt="LaTeX Coder L keycap logo">
</p>

<h1 align="center">LaTeX Coder</h1>

<p align="center"><strong>A self-hosted LaTeX workspace where people, coding agents, and Git work on the same paper.</strong></p>

<p align="center">
  <a href="https://evoevolver.github.io/LatexCoder/">Website</a> ·
  <a href="https://github.com/EvoEvolver/LatexCoder#quick-start">Documentation</a>
</p>

<p align="center">
  <a href="https://railway.com/deploy/latexcoder?referralCode=4KUZ4o&amp;utm_medium=integration&amp;utm_source=template&amp;utm_campaign=generic"><img src="https://railway.com/button.svg" alt="Deploy on Railway"></a>
</p>

LaTeX Coder combines real-time collaborative editing, integrated LaTeX
compilation, and a first-class editing path for coding agents. Your paper
stays ordinary files on disk, and every project is a real Git repository you
can clone, push to, and back up like any other directory.

![LaTeX Coder workspace with files, source editing, and PDF preview](docs/images/workspace.png)

> Working with BibTeX? See [Biblock](https://github.com/EvoEvolver/biblock), an
> auditable bibliography workflow for humans and agents.

## Why LaTeX Coder

- **Hover to preview images and equations.** See a figure or rendered equation
  by hovering over its reference, even when it is defined in another file.
  Previews also work directly on `\includegraphics` paths and math expressions.
- **Blame mode: see who wrote what.** Character-level authorship in the
  editor, down to the Git checkpoint that introduced each range.
- **Command-click to jump to a definition.** Follow citations to their BibTeX
  entries and cross-references to their labels across the project
  (`\cite`, `\citep`, `\citet`, `\ref`, `\eqref`, `\autoref`, `\cref`).
  `\input`, `\include`, `\includegraphics`, and `\url` open their targets too.

### Write together

- Edit simultaneously with live cursors and presence.
- Share a project with a view or edit link. Guests don't need an account.
- Comment, reply, and suggest changes inline. Reviews live in the source as
  LaTeX macros, so agents and Git can read them too — nothing is locked in a
  UI-only database.

### Navigate the paper, not just its files

- Browse an indented file tree with folders, drag-and-drop moves, downloads,
  recoverable deletion, image/PDF previews, and open-file tabs.
- Edit Markdown beside LaTeX with a sanitized GFM preview: project-relative
  images, tables, task lists, code blocks, and links to other project files.
- Use **Tree** for the section outline and **TreeWriter** for a paper-level
  view of section titles, `\tldr`, and `\sectiontldr` summaries, editable in
  place.
- Complete citation keys with titles and authors visible in the suggestions.
- Search the whole project with optional regular expressions, and preview
  multi-file replacements before applying them.

### Preview as you write

- Compile with Tectonic or latexmk. If neither is installed, a verified
  Tectonic binary is set up automatically on first use.
- Navigate both ways with SyncTeX: source to PDF and PDF back to source.
- The last successful PDF stays on screen while you edit and is only flagged
  when it goes stale.

### Give agents a first-class editing path

Every collaborator can copy a project-specific **Agent editing** command from
the Collaborate menu. It hands the agent a plain-text manual containing the
project's files and its API URLs.

The edit workflow is deliberately simple:

1. Download a file.
2. Edit it with ordinary local tools.
3. Upload the replacement together with the original content hash.

The server applies the changes in one transaction; if a collaborator edited
the file in the meantime, the upload is rejected instead of overwriting their
work. Agent access can also be restricted so every edit arrives as a
reviewable suggestion. The same manual covers project search, compilation,
blame, reviews, and Git.

<p align="center">
  <img src="docs/images/mobile-source-pdf.png" width="1000" alt="LaTeX Coder mobile source and PDF views side by side">
</p>

## LaTeX Coder vs. Overleaf

For teams considering an alternative to Overleaf, start with the
[editor features above](#why-latex-coder). LaTeX Coder also gives teams control
of their infrastructure and makes coding agents part of the writing workflow.
The table below compares collaboration and integration choices.

| | LaTeX Coder | Overleaf |
| --- | --- | --- |
| Hosting | Self-hosted Node service; persistent data stays on your volume. | Hosted service, with separate on-premises products. |
| Guest collaboration | View/Edit share links; an account is optional for project access. | Account-based collaboration with plan-dependent collaborator limits. |
| Review data | Comments, replies, and suggestions are LaTeX macros visible to humans, agents, and Git. | Comments and Track Changes are platform-managed; Track Changes is a premium feature. |
| Git model | Every project is a Git repository. The live documents represent `main`; incoming changes are merged before import. | Git Bridge translates Overleaf history into one linear branch named `master`; cloud Git integration is premium. |
| Git and reviews | Macro-backed review state travels with source and is validated on import. | Overleaf advises against mixing active Git use with comments or Track Changes because pushes can displace or lose review metadata. |
| Agent editing | Project-scoped plain-text manual, checked full-file edits, search, compilation, blame, review, and Git APIs. | General editor and integration workflows rather than this checked file-edit protocol. |
| Export | ZIP of the live working tree, including uncommitted source changes. | Source ZIP; the compiled PDF and most generated files are downloaded separately. |

Comparison details are based on Overleaf's official documentation for
[plans][overleaf-plans], [Track Changes][overleaf-track-changes],
[advanced Git behavior][overleaf-git], and [project downloads][overleaf-download].

[overleaf-plans]: https://docs.overleaf.com/getting-started/free-and-premium-plans/premium-features
[overleaf-track-changes]: https://docs.overleaf.com/collaborating/track-changes
[overleaf-git]: https://docs.overleaf.com/integrations-and-add-ons/git-integration-and-github-synchronization/git-integration/advanced-git-operations
[overleaf-download]: https://docs.overleaf.com/managing-projects-and-files/downloading-a-project

## Quick Start

Requirements: Node.js 22+, pnpm 10+, and Git.

```sh
pnpm install
pnpm check
LATEXCODER_ADMIN_PASSWORD='use-a-long-random-password' pnpm start
```

Open <http://127.0.0.1:8090> and sign in as `admin` with that password
(10+ characters, used only to create the first account). You can then invite
more users from the admin panel with registration links.

## Deploy with Docker or Railway

The image includes Tectonic, SyncTeX, Git, ripgrep, and bubblewrap, and stores
all persistent state beneath `/data`.

```sh
docker build -t latexcoder .
docker volume create latexcoder-data
docker run --rm \
  --name latexcoder \
  --publish 8090:8090 \
  --publish 2222:2222 \
  --security-opt seccomp=unconfined \
  --env LATEXCODER_ADMIN_PASSWORD='use-a-long-random-password' \
  --volume latexcoder-data:/data \
  latexcoder
```

The seccomp override lets bubblewrap create the namespaces used by sandboxed
regex search; skip it if you only need literal search.

For Railway, use the deploy button above, attach a persistent volume at
`/data`, and set `LATEXCODER_ADMIN_PASSWORD`. Railway's injected `PORT` is
picked up automatically — no custom start command needed. For SSH Git, expose
TCP port `2222` and set `LATEXCODER_SSH_PUBLIC_HOST` and
`LATEXCODER_SSH_PUBLIC_PORT` to the externally reachable TCP address. An HTTP
proxy alone does not forward SSH.

In Railway's **Settings → Networking → TCP Proxy**, set the target port to
`2222`. Keep the existing HTTPS domain for the web app. If Railway assigns
`shuttle.proxy.rlwy.net:15140`, for example, configure:

```env
PORT=8080
LATEXCODER_PORT=8080
LATEXCODER_SSH_PORT=2222
LATEXCODER_SSH_PUBLIC_HOST=shuttle.proxy.rlwy.net
LATEXCODER_SSH_PUBLIC_PORT=15140
```

SSH key management and SSH clone options appear only when both public endpoint
variables are valid and the SSH listener starts successfully. Otherwise, the Git
menu provides the existing access link.

Keep the HTTPS domain target port at `8080`; HTTP and SSH must use different
internal ports. Replace the example hostname and public port with your assigned
TCP proxy address, then redeploy. The Git menu uses these values for SSH clone commands;
the existing HTTPS access links remain available under **Access link**.

## Accounts and sharing

Signed-in users get a project dashboard with tags, search, and archiving.
Invite links create either Internal accounts, which can invite further users,
or External accounts, which can create projects but not invite anyone. Guests
join a single project through a share link, no account required.

Each collaborator gets their own browser, agent, and Git credentials.
Rotating a collaborator's link credentials revokes their previous links without
affecting anyone else. SSH keys are managed separately in Account Settings.
The admin panel covers user search, password resets,
account deletion that preserves projects and attribution, and project
deletion.

Projects can be created from ZIP archives, and uploading a ZIP inside an
existing project adds files without overwriting existing ones.

## Git

Every project lives on `main`, and the live collaborative documents always
represent that branch. Browser edits are checkpointed automatically, so a
`git pull` in another tool always sees the latest state — nobody has to
"push" from the editor.

Add your SSH public key under **Account Settings → SSH keys**, then copy the
SSH command from **Collaborate → Git access**. SSH is selected by default;
clone and push require the matching private key and project membership. Viewers
can clone but cannot push. Removing a key revokes its SSH access.

```sh
git clone ssh://git@your-host:2222/<project-id>.git
cd <project-id>
# edit and commit normally
git push origin main
```

The **Access link** option retains the existing HTTPS remote at
`https://your-host/git/<project-id>/<personal-secret>`. It works without an SSH
key; anyone holding the link can use it.

The SSH host key is generated on first startup and persisted in the state
directory. The Git dialog shows its fingerprint for the first connection.

Pushes are merged into the live documents automatically. If a push cannot be
merged safely, it is kept on a `conflict/<timestamp>` branch while `main` and
the live documents stay untouched.

The History view provides paginated checkpoints, per-file diffs, an Agent
edits filter, and whole-project or single-file restore. Restores are new
commits — history is never rewritten.

## Compilation

Project settings select the main TeX file, the compiler, and optional
automatic compilation. The Log view groups errors and warnings, highlights the
first fatal error, and links each diagnostic to its source file and line
alongside the full compiler output.

PDF navigation needs the `synctex` executable (included in the Docker image).
Compile an older project once after deployment to generate its synchronization
data.

Choose **Top-level root** or **Chapter root** beside Compile to build the whole
document or just the chapter you are working on, including its child files.
If no chapter root is declared or its file is missing, compilation automatically
falls back to the top-level root.

Keep chapter configuration in the project source: a child file declares
`%% latexcoder:chapter-root chapters/methods.tex`, and the chapter entry declares
`%% latexcoder:template templates/chapter.tex`. The template supplies the document
class, packages, and surrounding content, with `%% latexcoder:content` marking
where the chapter is inserted. An optional `%% latexcoder:root main.tex` selects
the top-level entry. Paths are relative to the project root, and chapter builds
keep their own PDF, log, and source-navigation data. See the
[chapter compilation guide](docs/chapter-compilation.md) for a complete example.

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `LATEXCODER_ADMIN_PASSWORD` | none | Creates the initial `admin` account on an empty database. |
| `LATEXCODER_STATE_DIR` | `.latexcoder` | SQLite database, projects, Git repositories, Yjs snapshots, build cache, and PDFs. |
| `LATEXCODER_HOST` | `0.0.0.0` | Listener address. |
| `LATEXCODER_PORT` | `PORT` or `8090` | HTTP listener port. |
| `LATEXCODER_SSH_PORT` | `2222` | SSH Git listener port; enabled only with a valid public host and port. |
| `LATEXCODER_SSH_HOST` | `0.0.0.0` | SSH listener address. |
| `LATEXCODER_SSH_PUBLIC_HOST` | `RAILWAY_TCP_PROXY_DOMAIN` | Public hostname for SSH Git; explicit configuration overrides the Railway fallback. |
| `LATEXCODER_SSH_PUBLIC_PORT` | `RAILWAY_TCP_PROXY_PORT` | External SSH port; explicit configuration overrides the Railway fallback. Does not change the internal listener port. |
| `LATEXCODER_LATEX_BIN` | auto-detected | Explicit Tectonic or latexmk executable. |
| `LATEXCODER_TECTONIC_BUNDLE_URL` | Tectonic default | Tectonic bundle mirror URL, useful when the default package bundle is slow or unavailable. |
| `LATEXCODER_COMPILE_CONCURRENCY` | `2` | Process-wide concurrent build limit. |
| `LATEXCODER_RG_BIN` | `rg` | ripgrep executable used by regex search. |
| `LATEXCODER_BWRAP_BIN` | `bwrap` | bubblewrap executable used to sandbox ripgrep. |
| `LATEXCODER_SYNCTEX_BIN` | `synctex` | SyncTeX executable used for source/PDF navigation. |

`GET /health/live` is the liveness probe. `GET /health/ready` additionally
reports detected external tools; missing optional tools are reported without
making the editor itself unready.

## Where your data lives

```text
<state-dir>/
  state.sqlite
  projects/<project-id>/
    project/        source files and the project's .git directory
    build/          current compilation artifacts
```

SQLite stores accounts, sessions, and project settings. Papers stay as plain
files with real Git repositories, so backups are an ordinary file copy.

## Security model

LaTeX Coder is designed for trusted teams, not hostile multi-tenant workloads.
Passwords are scrypt-hashed and share/invite links use high-entropy tokens.
Anyone holding an Edit, Agent, or Git link can modify that project within the
link's scope.

Regex search runs through ripgrep in a read-only bubblewrap sandbox (no
network, 15-second timeout, 4 MiB output limit); literal search works without
it. LaTeX compilation is **not** sandboxed — do not compile untrusted
projects, and do not store unrelated secrets inside project directories.

## Development

TypeScript throughout: `src/client` is the React/Vite interface, `src/server`
handles HTTP, Git/Yjs coordination, persistence, and compilation, and
`src/shared` holds the schemas and parsers used by both.

```sh
LATEXCODER_ADMIN_PASSWORD='1234567890' pnpm dev   # Vite on 5173 → app server on 8090
pnpm check                                        # build + typecheck
pnpm test                                         # full test suite
```

## License

[MIT](LICENSE)
