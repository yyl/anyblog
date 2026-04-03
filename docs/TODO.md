# TODO

## P1

### Increase Bear Blog refresh frequency

- Status: Open
- File: `.github/workflows/refresh-domains.yml`
- Problem: Bear Blog discovery currently refreshes on the same weekly cadence as the HN import, which may delay newly discovered blogs from reaching `domains.json`.
- Next steps:
  - Decide whether Bear Blog should refresh hourly or every few hours.
  - Split the workflow into per-source schedules if HN should remain weekly.
  - Keep commit volume and Pages deploy frequency within acceptable bounds.

## P2

### Add a Bear Blog backfill source

- Status: Open
- File: `scripts/refresh_domains.py`
- Problem: The pipeline currently uses only Bear Blog's newest feed, which is good for incremental discovery but may miss older active blogs.
- Next steps:
  - Evaluate adding Bear Blog trending pages or feed as a secondary source.
  - Keep the backfill pass idempotent and deduplicated against `bearblog-state.json`.
  - Add guardrails so the source mix stays predictable over time.
