# Intra-Company App – Build Plan

A pragmatic build order so VS Code, Copilot/Codex, and you have one source of truth. Each task has a tiny “why” and a Done checklist you can paste into PRs.

---

## 0) Ground rules
- Branching: `feat/<scope>` → PR → squash merge.
- Keep tasks < 1 day. If larger, split.
- For each task: add tests or at least a repeatable manual test script.

---

## 1) Wire up SQL connection & data layer (Original #7)
**Why:** Everything else depends on data access.

**Do:**
- Create server API endpoints (Next.js route handlers or API controllers).
- Centralize DB config/connection pooling.
- Define typed models/DTOs for Orders & Tickets.

**Done when:**
- Local `.env` holds connection string.
- `GET /api/orders` and `GET /api/tickets` return sample rows.

---

## 2) Load data into both grids (Original #8)
**Why:** Validate schemas and performance early.

**Do:**
- Bind grid data sources to the new API endpoints.
- Add loading/empty/error states.

**Done when:**
- Both grids render server data (no mocks).
- Developer console shows no unhandled errors.

---

## 3) High-level filters – framework first
**Why:** Establish a single source of truth for page-level state.

**Do:**
- Create a filter state slice (Context/Zustand/Redux) and URL sync (query params).
- Debounced fetch on change.

**Done when:**
- Changing any filter refetches data and updates both grids consistently.

---

## 4) Customer number filter (Original #1)
**Why:** Primary filter that often gates others.

**Do:**
- Autocomplete/select tied to `/api/customers`.
- Persist to URL (`?customer=...`).

**Done when:**
- Selecting a customer refreshes Jobs list and both grids.

---

## 5) Jobs filter (Original #2)
**Why:** Dependent filter.

**Do:**
- Jobs list scoped by selected customer.
- Multi-select if needed.

**Done when:**
- Jobs filter narrows both grids correctly.

---

## 6) Job description text box (Original #3)
**Why:** Secondary search to refine results.

**Do:**
- Debounced text input → server query param `description`.

**Done when:**
- Typing updates both grids within 300–500ms, cancellable.

---

## 7) Insert row functionality – Orders grid (Original #11)
**Why:** Enables new data creation paths before wiring full save.

**Do:**
- Add an "Add Row" action that creates a client-side draft row.
- Mark drafts visually.

**Done when:**
- New rows can be added and edited locally; nothing persists yet.

---

## 8) Edit checks – date overlap in Orders (Original #12)
**Why:** Catch domain errors early, before persistence.

**Do:**
- Client-side validator: start/end must not overlap existing order ranges for same job/product.
- Server re-validation on save.

**Done when:**
- Overlaps block save with a clear inline message and help link.

---

## 9) Account entry validation (Original #15)
**Why:** Core business rule; prevents bad ledger writes.

**Do:**
- Synchronous client checks (format/mask, required combos).
- Server rules enforce canonical validity (chart of accounts lookup).

**Done when:**
- Invalid account codes show inline errors; server rejects bad payloads with structured errors.

---

## 10) Save pipeline (Original #14, #9, #10)
**Why:** Turn drafts/edits into real data.

**Do:**
- Add **Save** button that is disabled until there are valid changes.
- POST/PUT handlers: upsert semantics for inserts/updates.
- Return server-side re-validation errors mapped to fields.

**Done when:**
- Inserts, updates, and clears of edits persist and show after a reload.

---

## 11) Concurrency resolution (Original #13)
**Why:** Prevent overwriting someone else’s changes.

**Do:**
- Adopt optimistic concurrency with a `rowVersion`/`timestamp` column.
- On conflict (412/409), show diff and let user merge or retry.

**Done when:**
- Simulated race produces a friendly conflict flow; no silent data loss.

---

## 12) Screen Reset button with warning (Original #4)
**Why:** Escape hatch that returns to a clean state.

**Do:**
- **Reset** clears filters, drafts, and unsaved edits.
- Confirmation modal: “Unsaved changes will be lost.”

**Done when:**
- After confirm, URL/state reset and both grids refetch.

---

## Testing notes (for every PR)
- **Happy path:** filter → insert/edit → validate → save → reload.
- **Edge path:** overlapping dates, bad account code, server 500, network drop, conflicts.
- **Perf:** initial load < 1.5s; filter refetch < 800ms.

---

## Mapping back to the original list
1) Customer filter → **Task 4**  
2) Jobs filter → **Task 5**  
3) Job description text box → **Task 6**  
4) Reset button → **Task 12**  
7) SQL connection → **Task 1**  
8) Retrieval into both grids → **Task 2**  
9) Saving data → **Task 10**  
10) Updating data → **Task 10**  
11) Insert row in Orders → **Task 7**  
12) Date overlap check → **Task 8**  
13) Concurrency → **Task 11**  
14) Save button → **Task 10**  
15) Account entry validation → **Task 9**

---

## Short acceptance script (copy/paste for QA)
1. Select a **Customer** → Jobs populate.  
2. Pick **Jobs** and type a **Description** → both grids filter.  
3. **Add Row** to Orders, set dates, account codes.  
4. Try overlapping dates → blocked with clear error.  
5. Enter a bad account code → error, cannot save.  
6. Fix errors → **Save** becomes enabled; click **Save** → data persists.  
7. In a second browser, change the same row and save → first browser gets a conflict on save and shows merge options.  
8. Click **Reset** → confirm modal → view returns to defaults with fresh data.
