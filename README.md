# Metadata & Outlet Distributor Parsing Manager

Internal web application for metadata/master-data management, Outlet Distributor parsing, audit reporting, user management, and data-operations integrations.

This README is intentionally maintained as the **project handover / source of truth**. When work continues in a new ChatGPT conversation, with another developer, or after a long pause, read this file first before changing the codebase.

---

## 1. Repository

Repository:

`bari-data-dev/Fastapi-React-Metadata-and-Pipeline-Manager-Web-App-Project`

Default branch:

`main`

Primary deployment/project path on server:

`/srv/data_platform`

Application copy commonly used on server:

`/srv/data_platform/MetadataApp`

Typical internal URLs:

- Frontend: `http://192.100.38.67:8080`
- Backend: `http://192.100.38.67:8000`
- Prefect UI: `http://192.100.38.67:4200`
- Dashboard: `https://dashboard.galenium.com/reports/browse`

Backend API routes are registered under global prefix `/api`.

---

## 2. Technology Stack

### Frontend

- React
- TypeScript
- Tailwind CSS
- shadcn/ui-style components
- React Router
- TanStack Query infrastructure
- Lucide icons

### Backend

- FastAPI
- Python
- SQLAlchemy / SQLModel session usage
- JWT authentication

### Databases

Primary application/master-data database:

- Microsoft SQL Server 2019

Additional ODIST/parsing data source:

- MySQL `pipeline_bigdata`

The wider data platform follows a Medallion-style architecture with Bronze, Silver, and Gold schemas/layers.

---

# 3. CRITICAL PROJECT RULES

These rules are mandatory and must be preserved in future changes.

## 3.1 Changes requested for this project must be implemented directly in GitHub

When a requested change can be implemented by inspecting the repository, update the repository directly.

Do not stop at giving code snippets when the actual task is a repository change.

Do not ask the user to paste existing code when the repository can answer the question.

Current workflow is direct commits to `main`, matching the existing project workflow.

---

## 3.2 NEVER automatically create or modify database structures from the web application

This is a hard rule.

The web application must **never** execute database-structure operations such as:

- `CREATE TABLE`
- `ALTER TABLE`
- `DROP TABLE`
- `CREATE INDEX`
- `DROP INDEX`
- `CREATE SCHEMA`
- `sp_rename`
- ORM `create_all()`
- `ensure_schema()` helpers that create/alter objects
- automatic migration logic on application startup

The application must assume the required database structure already exists.

### Database DDL workflow

If a feature needs:

- a new table,
- a new column,
- a changed datatype,
- an identity column,
- a constraint,
- an index,
- a trigger,
- or any other schema change,

then the SQL must be provided **separately in conversation** for the user to review and execute manually.

Do not put new DDL/migration scripts into this web-app repository unless the user explicitly changes this rule.

The application should fail normally if a required database object is missing rather than silently creating or altering it.

### Current repository status

Runtime application code was scanned for structure-changing SQL and cleaned of automatic DDL logic.

Historical DDL scripts that remained under `backend/sql` were also removed when they contained structural changes.

A remaining SQL file may exist only when it is data-only and does not change structure.

---

## 3.3 Preserve existing business logic unless the request explicitly changes it

When modifying an existing page/service/view:

- preserve existing behavior that is not part of the requested change,
- do not simplify away existing logic,
- do not silently change access rules,
- do not change unrelated UI behavior,
- do not change database semantics unless requested.

---

## 3.4 Reuse established UI/UX patterns

When adding another master-data page, use the current metadata editor pattern rather than designing a new interaction model from scratch.

The reference implementation is primarily:

`frontend/src/pages/metadata/ProdukDistributorPage.tsx`

New master pages should inherit the same interaction expectations unless a requirement explicitly differs.

---

# 4. Authentication and Roles

Current roles:

- `ADMIN`
- `TEAM`
- `MANAGER`
- `INTERN`

General role behavior:

| Feature | ADMIN | MANAGER | TEAM | INTERN |
|---|---:|---:|---:|---:|
| Outlet Distributor Parsing | Yes | Yes | Yes | Yes |
| Parsing Report | Yes | Yes | Yes | Own/restricted data |
| Produk Distributor | Yes | Yes | Yes | No |
| Produk Price (`ARTBST`) | Yes | Yes | Yes | No |
| List Distributor (`Distributor`) | Yes | Yes | Yes | No |
| Activity Report | Yes | Yes | Yes | No |
| User Management view | Yes | Yes | Yes | No |
| Create/edit user detail | Yes | No | No | No |
| Toggle user active status | Yes | Yes | No | No |

Backend authorization must always be enforced even if frontend navigation already hides a page.

---

# 5. Current Pages and Routes

## Home

Route:

`/`

Provides feature cards based on role.

---

## Outlet Distributor Parsing

Route:

`/metadata/odists-parsing`

Page title:

`Outlet Distributor Parsing`

Sidebar label:

`Parsing`

This is the parsing/editor workflow for ODIST data.

Parsing-specific audit is intentionally separate from generic master-data activity audit.

---

## Produk Distributor

Route:

`/metadata/produk-distributor`

Backend prefix:

`/api/produk-distributor`

Primary table:

`bronze_so.Produk_Distributor`

Sidebar label:

`Produk Distributor`

Sidebar icon:

`Pill`

This page is the main UI/UX reference for editable master grids.

---

## Produk Price (technical module: ARTBST)

Route:

`/metadata/artbst`

Backend prefix:

`/api/artbst`

Primary table:

`bronze_so.ARTBST`

Sidebar label:

`Produk Price`

Technical identifiers, backend names, route names, and the physical table still use `ARTBST` for compatibility unless explicitly changed later.

Sidebar icon:

`Banknote`

Displayed business fields:

- `id` -> `ID`
- `artcode` -> `PROD CODE`
- `oms30_0` -> `PROD NAME`
- `u_konversi` -> `CRT`
- `verkp_verp` -> `PRICE`

All business fields are required on INSERT.

---

## List Distributor (technical module: Distributor)

Route:

`/metadata/distributor`

Backend prefix:

`/api/distributor`

Primary table:

`bronze_so.distributor`

Sidebar label:

`List Distributor`

Technical identifiers, backend names, route names, and the physical table still use `Distributor` / `distributor` for compatibility unless explicitly changed later.

Access:

- ADMIN
- MANAGER
- TEAM

INTERN is blocked in both frontend and backend.

### Visible columns

Only these columns are displayed in the Distributor grid:

| Database column | UI label |
|---|---|
| `iddistributor` | `ID` |
| `Kode_Dist` | `DIST CODE` |
| `Kode_Dist_Grup` | `DIST CODE GROUP` |
| `Nama_Dist` | `DIST NAME` |
| `Nama_Dist_Grup` | `DIST NAME GROUP` |
| `Tgl_Gabung` | `TANGGAL GABUNG` |
| `Tgl_Data_Pertama` | `TANGGAL DATA PERTAMA` |
| `status` | `STATUS AKTIF` |

### Required database audit columns

The table also contains these fields, but they are intentionally hidden from the grid:

- `dwh_created_by`
- `dwh_updated_by`
- `dwh_created_at`
- `dwh_updated_at`

Insert behavior:

- `dwh_created_by` = current logged-in actor
- `dwh_created_at` = `SYSDATETIME()`

Update behavior:

- `dwh_updated_by` = current logged-in actor
- `dwh_updated_at` = `SYSDATETIME()`

### Expected final table structure

The web application expects `bronze_so.distributor` to already exist with this conceptual structure:

- `iddistributor` - `INT IDENTITY`, primary key
- `Kode_Dist`
- `Kode_Dist_Grup`
- `Nama_Dist`
- `Nama_Dist_Grup`
- `Tgl_Gabung`
- `Tgl_Data_Pertama`
- `status`
- `dwh_created_by`
- `dwh_updated_by`
- `dwh_created_at`
- `dwh_updated_at`

Legacy columns intentionally removed from the new table design:

- `Kode_Dist_Exact`
- `Nama_DB`
- `Kode_Dist_Yasa`
- `claim`
- `general`
- `branch`

The migration/rebuild SQL is supplied manually in chat, not from the application.

### Distributor field rules

All seven editable business fields must be populated when inserting a new row:

- `Kode_Dist`
- `Kode_Dist_Grup`
- `Nama_Dist`
- `Nama_Dist_Grup`
- `Tgl_Gabung`
- `Tgl_Data_Pertama`
- `status`

The same completeness rule applies when saving updates. If an existing legacy row still contains a blank required field, a user cannot save another change to that row until the full required snapshot is valid.

### Status UX

`status` remains stored as text-compatible `1` / `0` values:

- `1` = ACTIVE
- `0` = INACTIVE

The UI uses a toggle similar to User Management.

Important difference from User Management:

**Distributor status changes are pending changes.**

Toggling the switch does not immediately update the database. It becomes part of the same pending transaction as other cell edits and is only committed through `Save Changes`.

### Date UX

`Tgl_Gabung` and `Tgl_Data_Pertama` use date-picker inputs.

A selected date is normalized for storage as:

`YYYY-MM-DD 00:00:00`

Time is intentionally fixed to midnight because business usage does not require time-of-day precision.

---

## Parsing Report

Route:

`/reports/parsing`

Backend prefix:

`/api/parsing-report`

Parsing audit remains separate from master-data Activity Report.

---

## Activity Report

Route:

`/reports/activity`

Backend prefix:

`/api/activity-report`

Access:

- ADMIN
- MANAGER
- TEAM

INTERN is blocked.

Primary audit table expected to already exist:

`tools.activity_audit_log`

The application does **not** create this table automatically.

### Purpose

This is the generic historical audit trail for non-parsing application activities.

It is not based only on `dwh_updated_by`, because `dwh_updated_by` only identifies the last updater and does not provide history.

Activity Report records historical actions such as:

- INSERT
- UPDATE
- DELETE

### Currently audited modules

- Produk Distributor
- ARTBST / Produk Price
- Distributor / List Distributor
- User Management

Future master-data modules should reuse the same generic audit mechanism.

### Audit information

The generic audit design stores information including:

- batch ID
- module key
- module label
- table name
- record ID
- record label
- action
- actor user ID
- actor username
- actor full name
- changed fields
- old values
- new values
- activity source
- changed timestamp

Multiple rows modified in one Save Changes operation share a batch ID where applicable.

### Password safety

User Management audit must never store plaintext passwords or password hashes.

When a password changes, audit only records that the password changed, not the secret value.

---

## User Management

Route:

`/admin/users`

Sidebar section:

`Administration`

User Management has intentionally different status behavior from Distributor.

User active/inactive toggle applies immediately because it is an account-access operation.

Distributor toggle does not apply immediately; it participates in pending Save Changes.

---

# 6. Master Grid UI/UX Contract

Unless a feature explicitly requires different behavior, editable metadata/master pages should follow this interaction model.

## Core grid behavior

- paginated table
- server-side sorting
- filter by distinct values
- filter search
- reset filters
- resizable columns
- double-click resize separator to reset width
- visible vertical column separators
- horizontally scrollable grid
- sticky ID column where appropriate
- sticky ACTION column

## Editing behavior

- inline editing
- changed cells highlighted
- row-level cancel for edited existing rows
- Insert Row
- Duplicate Row
- pending Delete
- pending Insert
- pending Update
- Discard All
- Save Changes

Delete should be staged visually before commit rather than immediately deleting the row.

## Transaction behavior

Batch `Save Changes` should process pending inserts, updates, and deletes as one logical transaction.

When audit is required, data change and audit record should participate in the same database transaction so they cannot diverge.

## Confirmation behavior

Save confirmation dialog summarizes:

- number of inserted rows
- number of edited rows
- number of deleted rows

Pressing `Enter` while the Save confirmation is active should confirm the save.

## Keyboard shortcuts

Metadata editor pages support:

- `Ctrl + S` / `Cmd + S` -> Save Changes
- `Ctrl + R` / `Cmd + R` -> Reset Filter
- `Enter` -> confirm active Save dialog

Current metadata editor shortcut coverage includes:

- Outlet Distributor Parsing
- Produk Distributor
- ARTBST / Produk Price
- Distributor / List Distributor

---

# 7. Audit Architecture

There are two intentionally separate audit systems.

## Parsing audit

Used by Outlet Distributor Parsing / Parsing Report.

This is parsing-specific because it contains parsing-specific concepts such as effective result, revisions, revert state, parsing ownership, and ODIST history.

## Generic activity audit

Table:

`tools.activity_audit_log`

Used for master-data and application administration history.

Current modules:

- Produk Distributor
- ARTBST / Produk Price
- Distributor / List Distributor
- User Management

Do not merge parsing audit into generic Activity Report unless requirements explicitly change.

---

# 8. Important Backend Files

Router registration:

`backend/app/routers/__init__.py`

FastAPI application:

`backend/main.py`

Generic activity audit service:

`backend/app/services/activity_audit_service.py`

Activity Report router:

`backend/app/routers/activity_report_router.py`

Distributor implementation:

- `backend/app/schemas/distributor.py`
- `backend/app/services/distributor_service.py`
- `backend/app/routers/distributor_router.py`

Produk Distributor implementation:

- `backend/app/services/produk_distributor_service.py`
- `backend/app/routers/produk_distributor_router.py`

ARTBST / Produk Price implementation:

- `backend/app/schemas/artbst.py`
- `backend/app/services/artbst_service.py`
- `backend/app/routers/artbst_router.py`

---

# 9. Important Frontend Files

Route/persistent page registration:

`frontend/src/App.tsx`

Sidebar:

`frontend/src/components/layout/Sidebar.tsx`

Global keyboard/interaction enhancements:

`frontend/src/components/layout/InteractionEnhancements.tsx`

Home page:

`frontend/src/pages/Index.tsx`

Master pages:

- `frontend/src/pages/metadata/OdistsParsingPage.tsx`
- `frontend/src/pages/metadata/ProdukDistributorPage.tsx`
- `frontend/src/pages/metadata/ArtbstPage.tsx`
- `frontend/src/pages/metadata/DistributorPage.tsx`

Reports:

- `frontend/src/pages/reports/ParsingReportPage.tsx`
- `frontend/src/pages/reports/ActivityReportPage.tsx`

User management:

`frontend/src/pages/admin/UsersPage.tsx`

Shared API client:

`frontend/src/lib/appApi.ts`

---

# 10. Frontend Persistent Page Behavior

Protected pages are intentionally preserved after they have been visited rather than always being unmounted during navigation.

Reason:

- retain table state
- retain filters
- retain in-progress page context

When adding a protected page, ensure it is correctly included in the persistent protected-page routing model in `frontend/src/App.tsx`.

Also enforce role restrictions in that routing layer where appropriate.

---

# 11. Current Sidebar Structure

The old single `Data Management` group has been split into functional segments.

## Parsing Data

- Parsing -> `/metadata/odists-parsing`

## Master Data Management

Visible to ADMIN, MANAGER, and TEAM; hidden from INTERN.

- Produk Distributor -> `/metadata/produk-distributor`
- List Distributor -> `/metadata/distributor`
- Produk Price -> `/metadata/artbst`

## Administration

Visible where User Management is permitted.

- User Management -> `/admin/users`

## Analytics

- Parsing Report
- Activity Report where permitted
- Dashboard external link

Important sidebar labels/icons currently used:

- Parsing -> `TableProperties`
- Produk Distributor -> `Pill`
- List Distributor -> `Truck`
- Produk Price -> `Banknote`
- User Management -> `Users`
- Activity Report -> `History`

Technical naming note:

- `Produk Price` is only the user-facing navigation label for the existing ARTBST module.
- `List Distributor` is only the user-facing navigation label for the existing Distributor module.
- Existing routes, backend services, audit module keys, and physical table names remain unchanged unless explicitly requested.

---

# 12. Database Contract

The web application is a database **consumer/editor**, not a database migration manager.

## Required behavior

Backend services may perform normal data operations such as:

- SELECT
- INSERT
- UPDATE
- DELETE

They may use transactions and database functions such as `SYSDATETIME()`.

They may not create or mutate schema structure automatically.

## DWH audit fields

For editable master tables that include standard audit columns, use the established pattern:

Insert:

- `dwh_created_by` = current actor
- `dwh_created_at` = current database timestamp

Update:

- `dwh_updated_by` = current actor
- `dwh_updated_at` = current database timestamp

These table-level fields complement the historical `tools.activity_audit_log`; they do not replace it.

---

# 13. Current Deployment Prerequisites

Before using a newly added page, required manual database changes must already have been applied by the user.

For the current Distributor feature:

1. `bronze_so.distributor` must already have been rebuilt manually to the expected final structure.
2. `iddistributor` must be an `INT IDENTITY` primary key.
3. The four DWH audit columns must exist.
4. `tools.activity_audit_log` must already exist for generic Activity Report/audit writes.
5. Then pull the latest application source and restart services.

Typical application update flow:

```bash
git pull
```

Then restart backend/frontend using the deployment method currently used on the server.

Do not claim a runtime test passed unless it was actually executed in the deployed environment.

---

# 14. Known Runtime / Environment Notes

## CORS

Historical issue:

Frontend origin `http://192.100.38.67:8080` calling backend `http://192.100.38.67:8000` once experienced intermittent missing `Access-Control-Allow-Origin` responses.

FastAPI does have CORSMiddleware configured from `settings.CORS_ORIGINS`.

If CORS suddenly fails despite unchanged frontend code, verify:

- active backend process
- loaded `.env`
- actual CORS origin setting
- whether multiple stale backend processes exist
- reverse proxy/network behavior

Do not assume a source-code CORS change is required before checking runtime configuration.

---

# 15. Current Naming

Preferred user-facing/navigation naming:

- `Outlet Distributor Parsing`, not `ODIST Parsing` as a page title
- `Parsing` in the sidebar for the parsing editor
- `Produk Distributor`
- `List Distributor` for the technical Distributor module
- `Produk Price` for the technical ARTBST module
- `User Management`
- `Parsing Report`
- `Activity Report`

Some older technical names intentionally remain in code/database identifiers for compatibility, especially `ARTBST` and `Distributor`.

---

# 16. Current Feature Progress

Completed / implemented in repository:

- authentication and role model
- Outlet Distributor Parsing
- Parsing Report
- Produk Distributor CRUD grid
- ARTBST CRUD grid / Produk Price navigation
- User Management
- generic Activity Report
- generic master-data audit integration
- Distributor backend CRUD
- Distributor frontend grid / List Distributor navigation
- Distributor sidebar navigation
- Distributor home entry
- Distributor keyboard shortcut integration
- pending status toggle on Distributor
- date picker inputs on Distributor
- required-field validation on Distributor insert/update
- DWH actor/timestamp writes for Distributor
- sidebar split into Parsing Data, Master Data Management, Administration, and Analytics
- removal of automatic Activity Report schema creation
- removal of structural DDL migration scripts from the repository

---

# 17. Current Pending / Manual Work

At the latest documented state, the main manual deployment prerequisite is database preparation.

## Distributor database migration

The SQL Server table `bronze_so.distributor` needs to be manually rebuilt/updated to the agreed structure before the new Distributor page is used.

The migration SQL is intentionally supplied in conversation and is not stored/executed by the web application.

## Generic activity table

If `tools.activity_audit_log` does not already exist, its DDL must also be applied manually before master-data saves that require Activity Report audit history.

Again, the application must not create it automatically.

---

# 18. Important Historical Decisions

## Activity Report design

The generic Activity Report was introduced because table-level `dwh_updated_by` only shows the most recent updater and cannot provide historical accountability.

Decision:

- keep DWH audit columns for current-state metadata,
- add a separate append-only-ish historical activity table,
- retain Parsing Report separately because parsing has domain-specific audit semantics.

## Distributor status design

Decision:

- keep stored values `1` and `0`,
- present them as an ACTIVE/INACTIVE toggle,
- keep toggle changes pending until Save Changes,
- do not imitate User Management's immediate-save status behavior.

## Distributor ID design

Decision:

- convert/rebuild `iddistributor` into an `INT IDENTITY` primary key,
- preserve valid existing numeric IDs during manual migration,
- fail migration rather than silently remapping invalid/duplicate IDs.

## Sidebar information architecture

Decision:

- do not keep all operational pages under one generic `Data Management` group,
- Parsing editor belongs under `Parsing Data`,
- Produk Distributor, List Distributor, and Produk Price belong under `Master Data Management`,
- User Management belongs under `Administration`,
- reporting links remain under `Analytics`.

---

# 19. Code Quality / Safety Expectations

When implementing future work:

1. Inspect existing implementations before coding.
2. Reuse established patterns instead of introducing parallel architectures unnecessarily.
3. Keep frontend and backend validation aligned.
4. Enforce authorization on backend even when frontend hides a route.
5. Keep a master-data mutation and its generic audit record in the same transaction.
6. Never audit passwords or password hashes.
7. Avoid unrelated refactors during targeted business changes.
8. Preserve current UI behavior unless explicitly asked to change it.
9. For database schema changes, stop at application expectations and provide DDL manually in chat.
10. After repo changes, inspect latest source/signatures for consistency.

---

# 20. New Chat / Handover Checklist

When continuing this project in a new ChatGPT conversation, use this sequence:

1. Read this `README.md` fully.
2. Inspect the latest `main` branch rather than relying only on old conversation snippets.
3. Check the user's new request against the CRITICAL PROJECT RULES above.
4. If it is an application change, update the GitHub repository directly.
5. If it requires database structure changes, do **not** implement DDL in backend or repository; provide the SQL separately in chat.
6. Reuse Produk Distributor/master-grid UI behavior unless a different UX is explicitly requested.
7. Determine whether the change needs generic Activity Report audit integration.
8. Preserve role restrictions.
9. Do not claim build/runtime/deployment validation unless it was actually run.
10. Update this README when a material architectural rule, page, table contract, navigation structure, or workflow decision changes.

---

# 21. Documentation Maintenance Rule

This README is a living document.

Update it whenever there is a material change to:

- architecture
- route/page inventory
- sidebar/navigation information architecture
- roles/permissions
- database contracts
- audit behavior
- UI/UX conventions
- deployment prerequisites
- major implementation progress
- hard project rules
- known technical constraints

Minor cosmetic changes do not need a README update unless they affect future maintenance context.

The objective is simple: **a new chat or maintainer should be able to read this file and understand what the system is, how it is expected to behave, what must never be done, and where current work stands.**
