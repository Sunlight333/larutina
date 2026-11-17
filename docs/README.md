# docs

Requirements, specifications and project documents for LaRutina Beauty. The application itself lives in [`../code`](../code).

The repository is public, so the files in these folders are kept local and are not committed (see the root `.gitignore`). Only these README files are tracked.

| Folder | What goes there |
| --- | --- |
| `spec/` | Internal engineering specification and technical plans |
| `deliverables/` | Documents sent to the client, one folder per document, numbered in the order they were delivered. Each folder holds the source version and the designed `-final` version |
| `client-inputs/` | Files received from the client, grouped by month (`YYYY-MM/`) |

## deliverables/

| Folder | Document |
| --- | --- |
| `01-propuesta-y-especificacion/` | Proposal and design specification |
| `02-respuestas-alcance-y-cronograma/` | Answers on scope and the updated schedule |
| `03-entregables-de-marca/` | Brand deliverables checklist for the designer |
| `04-guia-catalogo-maestro/` | Master catalogue guide (S1 sample and S5 full catalogue) |

## Naming

- New deliverable: next number, kebab-case Spanish title (`05-…`).
- Designed version of a document: same file name with `-final`.
- Client inputs: keep the client's original file name, inside the month they arrived.
