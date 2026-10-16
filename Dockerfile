# syntax=docker/dockerfile:1

FROM node:22-trixie-slim AS build

WORKDIR /app
RUN corepack enable

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

FROM node:22-trixie-slim AS runtime

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    bubblewrap \
    ca-certificates \
    curl \
    fontconfig \
    ghostscript \
    git \
    perl \
    ripgrep \
    tini \
    xz-utils \
  && rm -rf /var/lib/apt/lists/*

# A complete upstream TeX Live, matching what authors run locally, so
# documents do not fail on whichever package or font a distribution split
# left out. Documentation and sources are skipped to keep the image smaller.
# Override TEXLIVE_REPOSITORY to pin a mirror when the CTAN redirector is slow.
ARG TEXLIVE_REPOSITORY=https://mirror.ctan.org/systems/texlive/tlnet
RUN mkdir /tmp/install-tl \
  && curl -fsSL "${TEXLIVE_REPOSITORY}/install-tl-unx.tar.gz" | tar -xz --strip-components=1 -C /tmp/install-tl \
  && printf '%s\n' \
    'selected_scheme scheme-full' \
    'TEXDIR /usr/local/texlive' \
    'TEXMFLOCAL /usr/local/texlive/texmf-local' \
    'TEXMFSYSCONFIG /usr/local/texlive/texmf-config' \
    'TEXMFSYSVAR /usr/local/texlive/texmf-var' \
    'instopt_adjustpath 1' \
    'instopt_adjustrepo 1' \
    'instopt_letter 0' \
    'instopt_write18_restricted 1' \
    'tlpdbopt_autobackup 0' \
    'tlpdbopt_install_docfiles 0' \
    'tlpdbopt_install_srcfiles 0' \
    'tlpdbopt_sys_bin /usr/local/bin' \
    'tlpdbopt_sys_info /usr/local/share/info' \
    'tlpdbopt_sys_man /usr/local/share/man' \
    > /tmp/install-tl/texlive.profile \
  && /tmp/install-tl/install-tl --no-interaction --profile /tmp/install-tl/texlive.profile --repository "${TEXLIVE_REPOSITORY}" \
  && rm -rf /tmp/install-tl \
  && pdflatex --version | head -1 \
  && latexmk -v | head -2

WORKDIR /app

COPY scripts/install-tectonic.sh ./scripts/install-tectonic.sh
RUN LATEXCODER_STATE_DIR=/opt/latexcoder-compiler ./scripts/install-tectonic.sh \
  && install -m 0755 /opt/latexcoder-compiler/bin/tectonic /usr/local/bin/tectonic \
  && rm -rf /opt/latexcoder-compiler

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
COPY src ./src

ENV NODE_ENV=production \
  PORT=8080 \
  LATEXCODER_HOST=0.0.0.0 \
  LATEXCODER_STATE_DIR=/data

RUN mkdir -p /data

# Advertise only HTTP for platform port detection. SSH is published explicitly
# with Docker -p or a Railway TCP proxy; it does not require EXPOSE.
EXPOSE 8080

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["./node_modules/.bin/tsx", "src/server/main.ts"]
