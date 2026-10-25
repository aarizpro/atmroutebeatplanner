# ATM Atlas — Full application

This is the complete project. No earlier ZIP or update patch is required.

## 1. Extract

Extract ATM_Atlas_Full_Project.zip into a new folder. Open its `atm-route-planner` folder in VS Code. Use a new folder so the bundled starter database cannot overwrite any existing working data.

Node.js 22.12 or later is required. Check:

```powershell
node --version
npm --version
```

## 2. Install once from the main project folder

```powershell
npm install
```

The root package uses npm workspaces and installs dependencies for both server and client. Do not install node_modules from another project.

## 3. Start the backend — Terminal 1

Starting from the main project folder:

```powershell
cd server
npm run dev
```

The backend uses http://localhost:5000.

## 4. Start the frontend — Terminal 2

Open another VS Code terminal in the main project folder:

```powershell
cd client
npm run dev
```

Open http://localhost:5173. Keep both terminals running.

Alternatively, `npm run dev` from the main project folder starts both processes together. For the compiled production frontend, `npm start` serves everything at http://localhost:5000. START_WINDOWS.bat is another way to install dependencies on first use and start the production app.

## 5. Configure your beat plan

1. **Branches:** add/remove branches and enter their names, route code prefixes and coordinates. Set a route count and select the start/end branch for each branch's beats.
2. **ATM count rule:** choose Exact ATM count per route, or Minimum/maximum. Enter your own count(s); 35–40 is no longer enforced. Different branches may use different rules. Save all branch settings.
3. **ATM master:** check data and active status. The original workbook's four missing-coordinate ATMs are S1BW000800002, 24105UHR, 00013HRY and 00014HRY. Correct their coordinates or deactivate them if they are not to be serviced.
4. **MSP & bank allocation:** choose one branch or Both/All branches for each pair. Save allocations. Shared ATMs are split geographically and rebalanced to fit capacity. Fixed pairs stay with their branch.
5. **Generate beat plan:** review/edit route counts and ATM counts again, inspect the live feasibility report, then generate. Successful generation saves the counts you entered.
6. **Routes:** inspect ordered stops, open Google Maps Part 1 onward, download all/selected beats as Excel or CSV, or print/save PDF.

## Exact counts must match

Four routes with exactly 25 ATMs each require 100 active ATMs in that branch. If there are 101, the app reports the mismatch. It does not ignore the extra ATM. Choose a range such as 20–30, change counts, or adjust the active ATM list as appropriate.

The full project starts with your original 1,767 ATM records, 41 MSP–Bank pairs, unset branch coordinates and unassigned pair ownership. It contains no guessed branch coordinates.

## Addresses and Maps

The original spreadsheet contains locations but no street-address column. Add ADDRESS to your full ATM master and import using Merge, or fill ADDRESS in the ATM editor. Excel and CSV exports include the address field; missing addresses remain blank.

Ordered Google Maps links include the start point, all ATM stops and the end point in sequential sections. Road directions open in Google Maps; the application's own ordering/distance estimates remain based on coordinates.

## Bring over an existing database

To retain records from an older installation: stop both applications, keep a backup copy, then copy the old `server/data/db.json` into the same path in this extracted project. Do not replace it while the server is running. Existing records are compatible; configure/save your branch counts and regenerate the beats after starting.

## Rebuild and test

From the main project folder:

```powershell
npm run build
npm test
```

## Free demo deployment

README_RENDER.md and render.yaml are included. Render builds the React app and serves it with Node on one URL. Its Free service loses local JSON edits on restart/spin-down/redeploy, so retain JSON backups. This application currently has no login.
