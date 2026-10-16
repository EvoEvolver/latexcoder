#!/bin/sh
# Installs a complete upstream TeX Live into TEXLIVE_DIR, once. The directory
# is meant to live on persistent storage (the Docker image mounts /data), so a
# redeploy reuses the multi-gigabyte installation instead of downloading it
# again. A marker file records a finished installation; without it a partial
# tree from an interrupted run is discarded and the installation starts over.
set -eu

texlive_dir="${TEXLIVE_DIR:?TEXLIVE_DIR is required}"
# A fixed mirror replaces the mirror.ctan.org redirector, which can land on a
# mirror with a broken TLS chain.
repository="${TEXLIVE_REPOSITORY:-https://mirrors.mit.edu/CTAN/systems/texlive/tlnet}"
marker="$texlive_dir/.latexcoder-ready"

case "$texlive_dir" in
  /|/usr|/usr/local|/data|/var|/home|/tmp|/opt) echo "refusing to install TeX Live directly into $texlive_dir" >&2; exit 1 ;;
esac

if [ -f "$marker" ] && [ -x "$texlive_dir/bin/linux/pdflatex" ] && [ -x "$texlive_dir/bin/linux/latexmk" ]; then
  echo "TeX Live is already installed at $texlive_dir ($(cat "$marker"))"
  exit 0
fi

echo "Installing TeX Live into $texlive_dir from $repository"
rm -rf "$texlive_dir"
mkdir -p "$texlive_dir"
installer=$(mktemp -d)
trap 'rm -rf "$installer"' EXIT

curl -fsSL --retry 5 --retry-all-errors "$repository/install-tl-unx.tar.gz" | tar -xz --strip-components=1 -C "$installer"
cat > "$installer/texlive.profile" <<PROFILE
selected_scheme scheme-full
TEXDIR $texlive_dir
TEXMFLOCAL $texlive_dir/texmf-local
TEXMFSYSCONFIG $texlive_dir/texmf-config
TEXMFSYSVAR $texlive_dir/texmf-var
instopt_adjustpath 0
instopt_adjustrepo 1
instopt_letter 0
instopt_write18_restricted 1
tlpdbopt_autobackup 0
tlpdbopt_install_docfiles 0
tlpdbopt_install_srcfiles 0
PROFILE
"$installer/install-tl" --no-interaction --profile "$installer/texlive.profile" --repository "$repository"

# The architecture-specific bin directory gets a stable name for PATH.
arch_bin=$(find "$texlive_dir/bin" -mindepth 1 -maxdepth 1 -type d -name '*-linux*' | head -1)
[ -n "$arch_bin" ] || { echo "TeX Live installed no Linux binaries under $texlive_dir/bin" >&2; exit 1; }
ln -sfn "$(basename "$arch_bin")" "$texlive_dir/bin/linux"
PATH="$texlive_dir/bin/linux:$PATH"
export PATH

# install-tl builds the formats already; rebuilding reports any engine whose
# format is broken without failing the installation over it.
if ! fmtutil-sys --all >"$texlive_dir/fmtutil.log" 2>&1; then
  echo "fmtutil-sys --all reported failures; see $texlive_dir/fmtutil.log" >&2
fi

pdflatex --version >/dev/null
latexmk -v >/dev/null
command -v synctex xelatex lualatex biber >/dev/null

release=$(head -1 "$texlive_dir/release-texlive.txt" 2>/dev/null || echo "TeX Live")
printf '%s\n' "$release" > "$marker"
echo "Installed $release at $texlive_dir"
