#!/usr/bin/env sh
# codemux installer — clones, builds, and links the codemux CLI.
#
#   curl -fsSL https://raw.githubusercontent.com/vibhusharma101/codemux/main/install.sh | sh
#
# Env overrides:
#   CODEMUX_SRC  source checkout dir   (default: $HOME/.codemux-src)
#   CODEMUX_BIN  where to link the bin (default: $HOME/.local/bin)
set -eu

REPO="https://github.com/vibhusharma101/codemux.git"
SRC="${CODEMUX_SRC:-$HOME/.codemux-src}"
BIN_DIR="${CODEMUX_BIN:-$HOME/.local/bin}"

info() { printf '\033[1;34m::\033[0m %s\n' "$1"; }
die()  { printf '\033[1;31merror:\033[0m %s\n' "$1" >&2; exit 1; }

command -v git  >/dev/null 2>&1 || die "git is required"
command -v node >/dev/null 2>&1 || die "node (>=20) is required"
command -v npm  >/dev/null 2>&1 || die "npm is required"

NODE_MAJOR=$(node -p 'process.versions.node.split(".")[0]')
[ "$NODE_MAJOR" -ge 20 ] || die "node >=20 required (found $(node -v))"

if [ -d "$SRC/.git" ]; then
  info "Updating existing checkout at $SRC"
  git -C "$SRC" pull --ff-only
else
  info "Cloning codemux into $SRC"
  git clone --depth 1 "$REPO" "$SRC"
fi

cd "$SRC"
info "Installing dependencies"
npm install --no-audit --no-fund
info "Building"
npm run build

mkdir -p "$BIN_DIR"
chmod +x "$SRC/dist/cli.js"
ln -sf "$SRC/dist/cli.js" "$BIN_DIR/codemux"

info "Installed: $BIN_DIR/codemux"
case ":$PATH:" in
  *":$BIN_DIR:"*) : ;;
  *) printf '\033[1;33mnote:\033[0m add %s to your PATH:\n  export PATH="%s:$PATH"\n' "$BIN_DIR" "$BIN_DIR" ;;
esac
"$BIN_DIR/codemux" --version >/dev/null && info "Run: codemux --help"
