#!/usr/bin/env sh
# check:all. Every check runs, and every check reports its own status.
#
# This was a single `&&` chain. That was fine while everything passed and
# wrong the moment one thing did not: check:no-env-values:history fails on
# two pre-existing findings in git history under R4, awaiting an operator
# decision, and an && chain means nothing after it ever runs. A UI
# regression guard that never executes is not a guard.
#
# So each check runs independently, the summary names each one and its exit
# code, and the suite exits non-zero if any of them did. The R4 finding stays
# a failure. It is just no longer able to hide the checks behind it.

# WARNING, READ BEFORE RUNNING THIS WHILE A SERVER IS UP.
#
# check:ui performs a production build. If you are holding a `next start` on
# any port, that rebuild lands underneath it and your server keeps serving the
# OLD build from its loaded state, while .next moves on. Every number you take
# afterwards belongs to a build that is no longer on disk, and nothing in your
# artifacts will say so.
#
# This has now happened twice in this project. The first time it invalidated
# F12, F13 and F16, which were measured on port 3100 against a build that had
# been replaced beneath them. The second time it happened to a VERIFIER that
# ran this script, during the run in which it was re-checking the lines the
# first occurrence had invalidated. Its startup assertion "served id matches
# disk" was true when it was made and false by the time it measured. It cost
# nothing only because the source happened to be identical, so the rebuild
# produced a different BUILD_ID for the same product.
#
# If you are holding a server, run with UI_CHECK_SKIP_BUILD=1, or stop the
# server first. And assert your build id AFTER your last measurement as well as
# before it: a one-time assertion at startup cannot see a rebuild that happens
# afterwards.

set -u

names=""
fails=0

run() {
  label="$1"
  shift
  printf '\n=== %s ===\n' "$label"
  "$@"
  code=$?
  if [ "$code" -ne 0 ]; then
    fails=$((fails + 1))
    line=$(printf '  %-10s %s' "FAIL(${code})" "${label}")
  else
    line=$(printf '  %-10s %s' "ok" "${label}")
  fi
  names="${names}${line}
"
  return 0
}

run "check:barcode" npm run --silent check:barcode
run "check:verification" npm run --silent check:verification
run "check:sources" npm run --silent check:sources
run "check:no-fixture" npm run --silent check:no-fixture
run "check:no-env-values" npm run --silent check:no-env-values
run "check:no-local-paths" npm run --silent check:no-local-paths
run "check:no-env-values:history" npm run --silent check:no-env-values:history
run "check:no-local-paths:history" npm run --silent check:no-local-paths:history
run "check:theme-colors" npm run --silent check:theme-colors
run "check:ui" npm run --silent check:ui

printf '\n=== check:all summary ===\n'
printf '%s' "$names"

if [ "$fails" -ne 0 ]; then
  printf '\n%s check(s) failed. Each is listed above with its own exit code.\n' "$fails"
  exit 1
fi
printf '\nall checks passed\n'
