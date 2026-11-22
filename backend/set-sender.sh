#!/usr/bin/env bash
# Point RTU Tindahan's outgoing mail at a different Gmail sender.
# Usage:
#   ./set-sender.sh                 # change to rtutindahan@gmail.com (prompts for App Password)
#   ./set-sender.sh other@gmail.com
#   ./set-sender.sh --dry-run       # show what would change, write nothing
#   ./set-sender.sh --test you@x.com  # after applying, send a real test message
#
# The App Password is read without echo and never written to shell history.
set -euo pipefail

ENV_FILE="${ENV_FILE:-/home/kallisto/RTU_Tindahan/backend/.env}"
UNIT="${UNIT:-rtu-tindahan}"
DISPLAY_NAME="${DISPLAY_NAME:-RTU Tindahan Marketplace}"

DRY_RUN=0
TEST_TO=""
ARGS=()
while (($#)); do
  case "$1" in
    --dry-run) DRY_RUN=1 ;;
    --test) TEST_TO="${2:?--test needs an address}"; shift ;;
    -h|--help) sed -n '2,10p' "$0"; exit 0 ;;
    *) ARGS+=("$1") ;;
  esac
  shift
done
NEW_ADDR="${ARGS[0]:-rtutindahan@gmail.com}"

[[ -f "$ENV_FILE" ]] || { echo "missing $ENV_FILE" >&2; exit 1; }
[[ "$NEW_ADDR" =~ ^[^@[:space:]]+@[^@[:space:]]+\.[A-Za-z]{2,}$ ]] \
  || { echo "not an email address: $NEW_ADDR" >&2; exit 1; }

APP=""
if ((DRY_RUN)); then
  APP="DRYRUN0000000000"
else
  read -rsp "App Password for $NEW_ADDR (16 chars, spaces ok): " APP; echo
  APP="${APP//[[:space:]]/}"
  if [[ ! "$APP" =~ ^[A-Za-z0-9]{16}$ ]]; then
    echo "App Passwords are 16 letters/digits (got ${#APP} chars)." >&2
    echo "Generate one at https://myaccount.google.com/apppasswords" >&2
    echo "(needs 2-Step Verification turned on for $NEW_ADDR)." >&2
    exit 1
  fi
fi

BACKUP="$ENV_FILE.bak-$(date +%Y%m%d-%H%M%S)"
((DRY_RUN)) || cp -p "$ENV_FILE" "$BACKUP"

python3 - "$ENV_FILE" "$NEW_ADDR" "$APP" "$DISPLAY_NAME" "$DRY_RUN" <<'PY'
import sys, pathlib
path, addr, app, name, dry = sys.argv[1:6]
p = pathlib.Path(path)
lines = p.read_text().splitlines()
want = {
    "EMAIL_MODE": "gmail",
    "EMAIL_HOST_USER": addr,
    "EMAIL_HOST_PASSWORD": app,
    "DEFAULT_FROM_EMAIL": f"{name} <{addr}>",
}
seen, out = set(), []
for line in lines:
    key = line.split("=", 1)[0].strip() if "=" in line and not line.lstrip().startswith("#") else None
    if key in want:
        out.append(f"{key}={want[key]}")
        seen.add(key)
    else:
        out.append(line)
missing = [k for k in want if k not in seen]
if missing:
    out.append("")
    out.extend(f"{k}={want[k]}" for k in missing)
changed = [(a, b) for a, b in zip(lines, out) if a != b] if len(lines) == len(out) else []
for a, b in changed:
    k = b.split("=", 1)[0]
    old = a.split("=", 1)[1] if "=" in a else ""
    new = b.split("=", 1)[1]
    if k == "EMAIL_HOST_PASSWORD":
        print(f"  {k}: <replaced, not shown>")
        continue
    print(f"  {k}: {old}  ->  {new}")
print(f"  added: {', '.join(missing)}" if missing else "", end="")
if missing:
    print()
if dry == "0":
    p.write_text("\n".join(out) + "\n")
    p.chmod(0o600)
    print(f"written: {p}")
else:
    print("dry-run: nothing written")
PY

if ((DRY_RUN)); then
  echo "dry-run: service not restarted"
  exit 0
fi

systemctl --user restart "$UNIT"
sleep 2
systemctl --user is-active "$UNIT" >/dev/null
echo "restarted: $UNIT is active"

if [[ -n "$TEST_TO" ]]; then
  echo "sending test message to $TEST_TO ..."
  cd /home/kallisto/RTU_Tindahan/backend
  .venv/bin/python manage.py shell -c "
from django.conf import settings
from django.core.mail import send_mail
print('from    :', settings.DEFAULT_FROM_EMAIL)
print('via user:', settings.EMAIL_HOST_USER)
send_mail('RTU Tindahan sender test', 'If you can read this, the new sender works.', settings.DEFAULT_FROM_EMAIL, ['$TEST_TO'], fail_silently=False)
print('sent ok')
"
fi

echo "backup: $BACKUP"
