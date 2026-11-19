# F02.1 — Payables ingestion

**Status:** CSV/XLSX preview and transactional import implementation in PR #113. The new migration is not applied to any remote Supabase project.

## Implemented

- Pure CSV and XLSX preview mapped to a shared payable-row contract.
- Authenticated preview endpoint: `POST /api/payables/import/preview`.
- Authenticated commit endpoint: `POST /api/payables/import/commit`.
- Organization Finance capability and role checks before preview or commit.
- CSV support for comma, semicolon and tab delimiters, quoted cells, UTF-8 and Windows-1252/UTF-16 input.
- XLSX workbook selection by sheet name; default is the first worksheet.
- Shared strings, inline strings, rich text runs, cached formula values and Excel 1900/1904 date systems.
- Source sheet and physical source row provenance.
- Brazilian and ISO dates; currency amounts converted to integer BRL centavos.
- Per-row validation and in-file SHA-256 deduplication; supplier CPF/CNPJ participates in the fingerprint when present, normalized independently of punctuation.
- Commit uploads the original artifact to the private tenant path, then invokes a service-role-only transactional RPC.
- The RPC creates an import batch and source artifact, inserts payable titles, records audit metadata, and uses tenant-scoped unique constraints for duplicate protection.
- Invalid rows and in-file duplicates are counted separately; database conflicts are included in the duplicate count.

## XLSX parser boundaries

The XLSX reader is deliberately bounded: maximum 10 MiB upload, 2,000 ZIP entries, 12 MiB per uncompressed entry and 30 MiB total uncompressed content. The aggregate limit is checked against the actual decompressed byte count as well as ZIP metadata; local and central ZIP headers must agree. It rejects encrypted and ZIP64 workbooks, unsupported compression methods, path traversal and sheets wider than 256 columns. Formula cells use the cached value stored by Excel; formulas are not recalculated by the server.

The parser is not yet certified against the customer's actual workbook exports. Excel number formats that encode identifiers (for example, leading-zero CNPJ/CPF) and unusual workbook layouts require fixture-based verification. Custom date formats are distinguished from currency formats after removing Excel color, condition, locale, literal and escape metadata; identifiers stored as numeric cells can still lose leading zeroes before the parser receives them.

## Import safeguards

- Preview is read-only: it does not upload files or create database records.
- Commit reparses the submitted file server-side; it does not trust a client-supplied preview payload.
- The workspace exposes a dedicated payable-import panel alongside bank-statement imports. It supports CSV/XLSX selection, server preview, worksheet selection and re-preview, row-level issue review, and explicit commit confirmation. The commit endpoint reparses the same selected file and worksheet server-side.
- The service-role RPC independently checks actor attribution, organization membership, source artifact ownership/path, file metadata, row counts and every persisted field.
- The commit is atomic across import batch, source artifact, payable titles and audit event.
- Title-level deduplication is enforced in the database. Re-imports may create a new audit/import batch while inserting zero duplicate titles; a file-level unique batch key is not part of this slice.
- Paid-title workbooks are not converted into open obligations. Recurrence references are retained as metadata and do not create separate titles.

## Not yet done

- Automated endpoint integration tests for authenticated preview/commit, upload cleanup and tenant isolation.
- Runtime application of the new migration in an isolated QA database.
- Functional homologation with synthetic workbooks and then the customer's real workbook layouts.
- Production enablement.

## API contract

Both endpoints accept multipart form data:
- `organizationId`: organization UUID.
- `file`: CSV or XLSX file.
- `sheetName`: optional exact worksheet name; XLSX only.

Preview returns `previewId`/SHA-256, parser version, selected/available sheets, accepted/rejected/duplicate counts, valid rows and bounded row-level errors.

Commit accepts the same source file and optional sheet name. It reparses the source, persists only valid nonduplicate rows, and returns batch ID plus inserted, duplicate and rejected counts.

## Data provenance

The original file is retained in `rsbuild-source-artifacts` under an organization-scoped path. Each payable title stores its source sheet, source row, source reference, import batch and deduplication key. The batch metadata records parser version, media type and counts.
