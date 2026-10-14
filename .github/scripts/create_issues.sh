#!/usr/bin/env bash
# Creates labels, Sprint milestones and one issue per row of docs/backlog.csv.
# Safe to re-run: issues whose title already exists are skipped.
set -euo pipefail
REPO="${GITHUB_REPOSITORY:?}"; CSV="docs/backlog.csv"
gh api -X POST "repos/$REPO/milestones" -f title="Sprint 1" -f due_on="2026-10-23T23:59:00Z" >/dev/null 2>&1 || true
gh api -X POST "repos/$REPO/milestones" -f title="Sprint 2" -f due_on="2026-10-30T23:59:00Z" >/dev/null 2>&1 || true
existing=$(gh issue list --repo "$REPO" --state all --limit 500 --json title -q '.[].title')
python3 - "$CSV" <<'PY' | while IFS=$'\t' read -r id title epic req who pts sprint ac; do
import csv,sys
for r in csv.DictReader(open(sys.argv[1])):
    print("\t".join([r["ID"],r["Story"],r["Epic"],r["SRS requirement"],r["Assignee"],r["Story points"],r["Sprint"],r["Acceptance criteria"]]))
PY
  full="$id: $title"
  if grep -qxF "$full" <<<"$existing"; then echo "skip $id"; continue; fi
  gh label create "$epic" --repo "$REPO" >/dev/null 2>&1 || true
  gh label create "SP-$pts" --repo "$REPO" >/dev/null 2>&1 || true
  gh label create "owner: $who" --repo "$REPO" >/dev/null 2>&1 || true
  body=$(printf '**SRS requirement:** %s\n**Owner:** %s\n**Story points:** %s\n**Sprint:** %s\n\n**Acceptance criteria**\n%s\n' "$req" "$who" "$pts" "$sprint" "$ac")
  gh issue create --repo "$REPO" --title "$full" --body "$body" \
    --label "$epic" --label "SP-$pts" --label "owner: $who" --milestone "Sprint $sprint"
  echo "created $id"
done
