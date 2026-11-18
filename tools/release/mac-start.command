#!/bin/bash
set -e
cd "$(dirname "$0")"
case "$(uname -m)" in
  arm64) arch=arm64 ;;
  x86_64) arch=x64 ;;
  *) echo '暂不支持此Mac处理器'; exit 1 ;;
esac
runtime="$HOME/Library/Application Support/WuzhangyuanWeb/runtime/node-v24.22.3-darwin-$arch"
if [ ! -x "$runtime/bin/node" ]; then
  mkdir -p "$(dirname "$runtime")"
  tar -xzf "runtime/node-v24.22.3-darwin-$arch.tar.gz" -C "$(dirname "$runtime")"
  chmod +x "$runtime/bin/node"
fi
exec "$runtime/bin/node" launch.mjs
