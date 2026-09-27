#!/usr/bin/env bash
#
# Levanta un Postgres local descartable para correr las migraciones y los
# tests de RLS, SIN Docker.
#
# Esto es un PLAN B. El camino recomendado es el Supabase CLI (`npm run db:up`),
# que además levanta Auth y Storage. Este script existe para entornos donde no
# hay Docker: contenedores de CI, servidores pelados, o una máquina donde no
# querés instalar Docker Desktop.
#
# Uso:
#   ./scripts/db-local.sh start   # inicializa y arranca en el puerto 54322
#   ./scripts/db-local.sh stop
#   ./scripts/db-local.sh reset   # borra todo y vuelve a arrancar limpio
#   ./scripts/db-local.sh url     # imprime el DATABASE_URL a usar
#
set -euo pipefail

PORT="${SLP_DB_PORT:-54322}"
DATA_DIR="${SLP_DB_DIR:-/var/tmp/slp-pg}"
DB_NAME="postgres"
DB_USER="postgres"

# Encontrar los binarios del servidor: Debian/Ubuntu los esconde fuera del PATH.
find_pg_bin() {
  if command -v initdb >/dev/null 2>&1; then
    dirname "$(command -v initdb)"
    return
  fi
  for dir in /usr/lib/postgresql/*/bin /usr/local/pgsql/bin /opt/homebrew/opt/postgresql*/bin; do
    [ -x "$dir/initdb" ] && echo "$dir" && return
  done
  echo "ERROR: no se encontraron los binarios de PostgreSQL." >&2
  echo "Instalá postgresql-16 y postgresql-16-postgis-3, o usá 'npm run db:up' con Docker." >&2
  exit 1
}

PG_BIN="$(find_pg_bin)"

# initdb se niega a correr como root. Si somos root usamos un usuario sin
# privilegios; si no, corremos directo.
if [ "$(id -u)" -eq 0 ]; then
  RUN_AS="nobody"
  as_pg() { su "$RUN_AS" -s /bin/bash -c "$1"; }
  prep_dir() { mkdir -p "$DATA_DIR" && chown "$RUN_AS" "$DATA_DIR"; }
else
  as_pg() { bash -c "$1"; }
  prep_dir() { mkdir -p "$DATA_DIR"; }
fi

start() {
  if [ ! -f "$DATA_DIR/PG_VERSION" ]; then
    echo "▸ Inicializando cluster en $DATA_DIR"
    rm -rf "$DATA_DIR"
    prep_dir
    as_pg "$PG_BIN/initdb -D $DATA_DIR -U $DB_USER --auth=trust --encoding=UTF8" >/dev/null
  fi

  if as_pg "$PG_BIN/pg_ctl -D $DATA_DIR status" >/dev/null 2>&1; then
    echo "▸ Ya estaba corriendo en el puerto $PORT"
  else
    echo "▸ Arrancando en el puerto $PORT"
    as_pg "$PG_BIN/pg_ctl -D $DATA_DIR -o '-p $PORT -k /var/tmp -c listen_addresses=127.0.0.1' -l $DATA_DIR/server.log start" >/dev/null
  fi

  # Esperar a que acepte conexiones antes de devolver el control.
  for _ in $(seq 1 30); do
    if "$PG_BIN/pg_isready" -h 127.0.0.1 -p "$PORT" -q 2>/dev/null; then
      echo "▸ Listo · $(url)"
      return 0
    fi
    sleep 0.5
  done

  echo "ERROR: no arrancó. Últimas líneas del log:" >&2
  tail -20 "$DATA_DIR/server.log" >&2 || true
  exit 1
}

stop() {
  if as_pg "$PG_BIN/pg_ctl -D $DATA_DIR status" >/dev/null 2>&1; then
    as_pg "$PG_BIN/pg_ctl -D $DATA_DIR -m fast stop" >/dev/null
    echo "▸ Detenido"
  else
    echo "▸ No estaba corriendo"
  fi
}

reset() {
  stop || true
  rm -rf "$DATA_DIR"
  echo "▸ Datos borrados"
  start
}

url() {
  echo "postgresql://$DB_USER@127.0.0.1:$PORT/$DB_NAME"
}

case "${1:-start}" in
  start) start ;;
  stop) stop ;;
  reset) reset ;;
  url) url ;;
  *)
    echo "Uso: $0 {start|stop|reset|url}" >&2
    exit 1
    ;;
esac
