# syntax=docker/dockerfile:1

FROM node:22-trixie-slim AS build

WORKDIR /app
RUN corepack enable

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

FROM node:22-trixie-slim AS runtime

# perl runs the TeX Live installer, latexmk, and other TeX Live scripts;
# xz-utils unpacks its packages; ghostscript converts EPS figures; fontconfig
# lets XeLaTeX and LuaLaTeX find installed fonts.
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

WORKDIR /app

# A complete upstream TeX Live is not baked into the image: the server
# installs it once into LATEXCODER_TEXLIVE_DIR on the persistent volume at
# first start (see scripts/install-texlive.sh) and every later container
# reuses it. Set LATEXCODER_TEXLIVE_INSTALL=0 to skip that and rely on
# Tectonic alone.
COPY scripts/install-tectonic.sh scripts/install-texlive.sh ./scripts/
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
  LATEXCODER_STATE_DIR=/data \
  LATEXCODER_TEXLIVE_DIR=/data/texlive \
  LATEXCODER_TEXLIVE_INSTALL=1

RUN mkdir -p /data

# Advertise only HTTP for platform port detection. SSH is published explicitly
# with Docker -p or a Railway TCP proxy; it does not require EXPOSE.
EXPOSE 8080

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["./node_modules/.bin/tsx", "src/server/main.ts"]
