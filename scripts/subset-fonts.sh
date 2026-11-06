#!/usr/bin/env bash
# Урезает латиницу Unbounded до ASCII + типографики (кавычки, тире, ₽):
# заголовки почти целиком кириллические, полный латинский сабсет весит 50 КБ.
# Запуск: bash scripts/subset-fonts.sh   (нужен fontTools: pip install fonttools brotli)
set -euo pipefail
pyftsubset node_modules/@fontsource-variable/unbounded/files/unbounded-latin-wght-normal.woff2 \
  --unicodes="U+0020-007E,U+00A0,U+00AB,U+00BB,U+2013-2014,U+2018-201E,U+2026,U+20BD" \
  --layout-features='*' --flavor=woff2 \
  --output-file=src/assets/fonts/unbounded-latin-basic-wght.woff2
