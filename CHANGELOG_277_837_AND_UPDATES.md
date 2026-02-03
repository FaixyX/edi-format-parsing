# BillUp – Changelog: 277 API, 837 Rename & Related Updates

*Use this document to copy into Google Docs or share. Last updated to reflect all changes made in this phase.*

---

## 1. New 277 EDI API (Backend)

### 1.1 New Upload Endpoint

- **Endpoint:** `POST /api/v1/billing-files-277/upload`
- **Purpose:** Upload and parse X12 EDI 277 (claim status response) files.
- **Flow:**
  1. Validate file as 277 (ISA, IEA, ST*277).
  2. Parse using 277-specific extraction (NPI, header date, patients).
  3. Match agency by NPI.
  4. Encrypt EDI content and task params (same PHI encryption as 837).
  5. Store as `BackgroundTask` with status `completed` (no worker queue for 277 yet).

### 1.2 277-Specific Validation

- **File:** `backend/app/utils/edi_277_extraction.py`
- **Added:** `validate_277_file(content)` – checks ISA, IEA, and ST*277 (no longer uses generic EDI parser for 277).
- **Route:** `billing_file_277.py` now uses `validate_277_file` instead of `validate_edi_file` from `edi_parser`.

### 1.3 Batch Limit

- **Config:** `MAX_277_FILES_PER_REQUEST` (env: `MAX_277_FILES_PER_REQUEST`, default 100 in backend).
- **Behavior:** Requests with more than the limit receive HTTP 400 with a clear message and suggestion to send smaller batches.

### 1.4 Backend Files Touched

- `backend/app/api/v1/routes/billing_file_277.py` – 277 upload route, encryption, validation.
- `backend/app/utils/edi_277_extraction.py` – `validate_277_file`, existing parsing helpers.
- `backend/app/main.py` – includes `billing_file_277` router.
- `backend/app/api/v1/routes/__init__.py` – exports `billing_file_277`.

---

## 2. 277 Frontend Integration

### 2.1 277 Upload State (Separate from 837)

- **New store:** `frontend/stores/billingFiles277Store.ts`
- **Persist key:** `billing-files-277-storage` (sessionStorage).
- **Purpose:** 277 upload results and failed-file retry state are independent from 837.

### 2.2 277 Billing Files Page

- **Route:** `/control-panel/277-files/billing-files`
- **API:** All uploads and retries use `POST .../billing-files-277/upload` (not `billing-files/upload`).
- **UI:** Labels and descriptions reference “277”, “X12 EDI 277”, and max files per batch (e.g. 50 on frontend).
- **Errors:** Handles 400 “too many files” and shows server suggestion in toast.

### 2.3 277 Monitoring (Dashboard) Page

- **Route:** `/control-panel/277-files/monitoring`
- **Data:** Same monitoring API as 837; list is filtered to `edi_info?.transaction_type === "277"`.
- **Table:** Uses `MonitoringTable` with `variant="277"`:
  - **Hidden columns:** Total Amounts, Status, RA Date, Remarks, Retries.
  - **Hidden filter:** Status filter is not shown.
- **Column visibility:** Stored under `monitoring-table-277` so 277 and 837 toggles don’t affect each other.

### 2.4 Shared vs Separate

- **837 dashboard:** Shows only non-277 tasks (`transaction_type !== "277"`).
- **277 dashboard:** Shows only 277 tasks (`transaction_type === "277"`).
- **APIs:** Retry, delete, bulk delete, details, and agencies are shared; behavior is per selected task(s). Bulk delete only affects the selected rows on the current page.

---

## 3. 837 Rename (873 → 837 on Frontend)

### 3.1 Route and Folder

- **Renamed:** `frontend/app/control-panel/873-files/` → `frontend/app/control-panel/837-files/`
- **URLs:** All former `/control-panel/873-files/...` are now `/control-panel/837-files/...`.

### 3.2 Sidebar

- **Label:** “873 Files” → “837 Files”.
- **Id/path:** `873-files` → `837-files`, path prefix `/control-panel/837-files`.
- **Default open group:** 837-files when on 837 routes; fallback default is 837-files.

### 3.3 Header Title

- **Comment:** “873 Files” → “837 Files”.
- **Item ids:** `873-monitoring` / `873-billing` → `837-monitoring` / `837-billing`.
- **Links:** All point to `/control-panel/837-files/...`.

### 3.4 Redirects (next.config.ts)

- `/control-panel/monitoring` → `/control-panel/837-files/monitoring`
- `/control-panel/billing-files` → `/control-panel/837-files/billing-files`

### 3.5 Monitoring Table

- **Variant type:** `"873" | "277"` → `"837" | "277"`.
- **Default variant:** `"837"` (837 pages show all columns and Status filter).
- **Comments:** Updated to refer to 837.

### 3.6 837 Monitoring Page

- **Comment:** “873/835 tasks” → “837/835 tasks” (filter still excludes 277).

---

## 4. Security & HIPAA (277 and Backend)

### 4.1 Already in Place for 277

- **Data at rest:** EDI file and task params (including patient data) encrypted with same PHI service as 837 (AES-256-GCM, field-level).
- **Authentication:** 277 upload is not in `PUBLIC_ENDPOINTS`; requires valid Bearer JWT.
- **Security headers:** HSTS, X-Content-Type-Options, X-Frame-Options, CSP, etc., apply to all API responses.
- **Logging:** No PHI or raw EDI in logs; error handling avoids ePHI in messages.

### 4.2 To Confirm or Implement (No Code Changes in This Phase)

- **Data in transit:** Ensure all production API traffic is HTTPS (proxy/load balancer).
- **Temp files (277):** EDI is written to temp dir then deleted; consider in-memory parsing or secure delete for stricter HIPAA.
- **Database:** Confirm DB encryption at rest with provider (e.g. Fly Postgres, Neon).
- **Audit logging:** Consider audit trail for PHI access (upload, view, download).
- **Redis:** Ensure production Redis uses TLS if it carries any sensitive data.
- **Key management:** Document key rotation and access control.

---

## 5. File Summary

| Area                        | Files Created               | Files Modified                                                                                                        |
| --------------------------- | --------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Backend 277                 | –                          | `billing_file_277.py`, `edi_277_extraction.py`, `main.py`, routes `__init__.py`                               |
| Frontend 277                | `billingFiles277Store.ts` | `277-files/billing-files/page.tsx`, `277-files/monitoring/page.tsx`                                               |
| Frontend 837 rename         | –                          | `sidebar.tsx`, `header-title.tsx`, `next.config.ts`, `MonitoringTable.tsx`, `837-files/monitoring/page.tsx` |
| Frontend 837/277 separation | –                          | `873-files/monitoring/page.tsx` → `837-files/monitoring/page.tsx` (filter + folder rename)                       |

---

## 6. Quick Reference

- **837 Files:** Dashboard + Upload EOB under `/control-panel/837-files/`. Uses `billing-files/upload` and full monitoring table.
- **277 Files:** Dashboard + Upload EOB under `/control-panel/277-files/`. Uses `billing-files-277/upload`, reduced table columns, no Status filter, separate column visibility and upload state.
