#!/bin/sh
set -e
cd "$(dirname "$0")"
export LINCE_DB="$(pwd)/lince-institucional.sqlite"
export LINCE_DEMO=0
export HOST=0.0.0.0
node tools/configurar_directora_inicial.js
exec node server.js
