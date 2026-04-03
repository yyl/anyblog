# TODO

## P1

### Add health checks to the domain refresh pipeline

- Status: Open
- File: `.github/workflows/refresh-domains.yml`
- Problem: The refresh pipeline currently trusts all domains from the upstream CSV without validation.
- Next steps:
  - Add HEAD request checks (with timeout + concurrency limits) to the GitHub Action.
  - Exclude domains that fail DNS resolution or return non-2xx/3xx responses.
  - Log removed domains for visibility.

## P2

### Make CSV parsing more robust

- Status: Open
- File: `.github/workflows/refresh-domains.yml`
- Problem: The parser assumes the domain is always the first unquoted column and extracts it by splitting on the first comma.
- Risk: If the upstream CSV format changes, the action can silently produce a partial or empty domain list.
- Next steps:
  - Validate the CSV header before parsing rows.
  - Fail the workflow if domain count drops below a threshold (e.g., 500).
