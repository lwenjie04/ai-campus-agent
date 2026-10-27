# Ingestion sources

- `project-text/exports/` contains original JSON files exported from campus notice pages. Preview and import them with `node server/scripts/import-browser-export-json.mjs --dry-run`.
- Put other local text files under `local-text/`. Preview them with `node server/scripts/batch-ingest-local.mjs --dry-run`.

The two importers use separate input directories so generic text ingestion does not re-import browser notice exports. Remove `--dry-run` only after reviewing the preview.
