#!/usr/bin/env bash
# PreCompact. Save state before summarization eats the details.
cd "${CLAUDE_PROJECT_DIR:-.}" 2>/dev/null || exit 0
[ -d .forge ] || exit 0
TS=$(date -u +%Y%m%dT%H%M%SZ)
mkdir -p ".forge/snapshots/$TS"
# AMENDMENTS.md is the record of every change made to the rubric after the
# architect handed it over, with the before-text recovered from the session
# transcript. EVIDENCE.md is the audit trail the verifier rules against.
# Neither is reconstructible after a compaction. ASSETS.md and any handoff
# carry operator-supplied context and measured design contracts.
for f in BRIEF.md DESIGN.md PLAN.md DOD.md RESUME.md AMENDMENTS.md EVIDENCE.md ASSETS.md OPERATOR.md GREENLIGHT.md NEXT-BROWSER-PASS.md VERIFIER-BRIEF.md DEFECTS.md; do
  [ -f ".forge/$f" ] && cp ".forge/$f" ".forge/snapshots/$TS/"
done
for f in .forge/handoff-*.md; do
  [ -f "$f" ] && cp "$f" ".forge/snapshots/$TS/"
done
exit 0
