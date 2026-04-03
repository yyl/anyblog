# Agent Rules

The following are rules that coding agents working on this repository must follow:

- **Read the docs in the right order:** Read `README.md` first to understand the project from the user point of view, then read `docs/DESIGN.md` to understand how the system works.
- **Always update both docs when needed:** After making changes to the repository, update `README.md` for user-facing changes and update `docs/DESIGN.md` for system, architecture, workflow, or file-structure changes so both stay in sync with the code.
- **Know the local dev commands:**
  - Start the static site locally with `python3 -m http.server 8788`
  - Run the refresh pipeline locally with `python3 scripts/refresh_domains.py`
