#!/bin/zsh
# macOS：双击打开「涩谷雨夜」。在本机起一个只读小服务（127.0.0.1:8852），再用默认浏览器打开；关掉这个窗口就停了。
cd "$(dirname "$0")"
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
if ! command -v node >/dev/null; then echo "没找到 Node.js，请先安装：https://nodejs.org"; read; exit 1; fi
if ! lsof -nP -iTCP:8852 -sTCP:LISTEN >/dev/null 2>&1; then node night/serve.cjs 8852 & sleep 1; fi
open "http://127.0.0.1:8852/night/"
wait
