# ATM Atlas — React / Tailwind / Node / JSON

A Chennai ATM planning application using React, Tailwind CSS, Express and a JSON database. This full project includes editable branch counts/names/coordinates, per-branch route counts, custom exact or ranged ATM counts, start/end branch selection, shared MSP–Bank allocation, Google Maps stop-order links, Excel/CSV address exports and printing. Read QUICK_START.md first.

## Run locally

Install dependencies once from the project root:

```powershell
npm install
```

Terminal 1:

```powershell
cd server
npm run dev
```

Terminal 2, starting from the project root:

```powershell
cd client
npm run dev
```

Open http://localhost:5173. Alternatively `npm run dev` in the project root starts both processes.

For the compiled production frontend, use `npm run build` followed by `npm start`, then open http://localhost:5000. The update ZIP includes the compiled frontend.

## Current workflow

1. Branches: add/remove branches; edit names, unique code prefixes and coordinates; enter route counts and select start/end branches; Save all.
2. ATM master: import, add, edit or delete ATMs; activate/deactivate; import or enter ADDRESS for full address exports.
3. MSP–Bank allocation: choose a fixed branch or All branches. Save allocations.
4. Generate beat plan: review/edit each branch's route count and ATM count rule, then review the feasibility report. Total routes is calculated from the branch counts.
5. Routes: inspect the ordered stops, open the Google Maps section links, export selected/all beats as Excel or CSV, or Print/PDF.

Every branch has a configurable ATM count rule: Exact count, or a minimum/maximum range. Set the rule in Branches or change it immediately before generation. The previous 35–40 values are only initial defaults and impose no fixed restriction. Exact mode requires each branch to have exactly route count × ATM count active ATMs after shared allocation; mismatches block generation instead of dropping leftovers. Invalid coordinates, missing allocations or incompatible branch counts block generation. Start/end branches can differ. Shared ATMs are distributed between configured branches; fixed pairs stay fixed. Route estimates are straight-line distances; Maps links calculate road directions externally.

## Data and imports

The working database is server/data/db.json. The initial server/data/seed.json is used only when the working database is missing. This update does not replace either file. Use Download JSON backup, or stop Node and back up the working file. Restore by stopping Node, replacing db.json with a saved backup and restarting.

The supplied original workbook contains 1,767 ATMs, 41 MSP–Bank pairs and four missing-coordinate records; it contains no postal-address column. Old workbooks still import. Add ADDRESS to a full master to populate street addresses. Missing addresses remain blank in exports.

Keep ATMID cells as Text to preserve leading zeroes. Merge updates by ATMID and preserves an existing address when the upload omits ADDRESS. Replace removes absent ATMs. Active status defaults to true unless provided. Duplicate IDs reject the entire import.

A branch has a stable ID, editable name/code/coordinates, routeCount, minATMs, maxATMs, capacityMode, startBranchId and endBranchId. The total is no longer fixed at 45. Existing BOTH allocation rules mean all configured branches when more than two exist. API import accepts BOTH or ALL. Generated per-ATM assignments and routes are stored in JSON; the original ROUTE field is retained.

Node uses serialized, atomic JSON writes with revision conflict detection and a rotating previous-state backup. Run one Node process per JSON file. Optional environment: PORT (5000), HOST (127.0.0.1), ATM_DB_PATH (absolute working database path).

For Render Free see README_RENDER.md and render.yaml. HOST must be 0.0.0.0. Local JSON changes are temporary on Render Free; the app currently has no login.

## Verify

```powershell
npm test
npm run build
```

The backend entry is server/index.js. Clustering is in server/planner.js, map/export helpers in server/beat-export.js, and persistence in server/store.js. The React UI is client/src/main.jsx with Tailwind and custom styles in client/src/style.css.

## Exact versus range examples

- 100 active ATMs, 4 routes, exact 25 ATMs per route: 4 routes of 25.
- 101 active ATMs, 4 routes, exact 25: blocked; the extra ATM is not omitted. Use a suitable range, change route counts or update the active ATM list.
- 101 active ATMs, 4 routes, range 20–30: balanced routes of 25 or 26.
- Different branches can use different exact counts or ranges. Shared ATMs may move between eligible branches to meet the requested capacities; exclusive branch allocations remain fixed.

The original workbook contains 1,767 ATMs and four missing-coordinate records. If all 1,767 are active, exact 40 × 45 = 1,800 does not match. Correct/deactivate missing-coordinate ATMs and choose counts appropriate to the resulting active totals.

Production build and automated tests cover exact counts under 35 and over 40, configurable ranges, invalid/uneven totals, persistence, exports, Maps coverage and multiple branches. Browser visual QA was unavailable in the build environment.
