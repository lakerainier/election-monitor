# Election 2026 Results Desk

A free, public, self-updating results site for Nov. 3, 2026: Senate, House and governors nationwide, with a second window for Seattle and Washington. It runs on GitHub Pages. A GitHub Actions job runs every five minutes, collects new numbers and republishes; open browsers refresh themselves within a minute.

```
index.html                     the page
js/core.js                     Seattle and Washington races, priors, results-file reader
js/natmodel.js                 national races, priors and the national simulation
js/national.js                 national pages: balance of power, U.S. map, race tables
js/app.js                      Seattle/WA model and pages, Seattle map, live refresh
data/desk.json                 what editors edit by hand (settings, notes, calls, sources)
data/national-sheet-template.csv  starting point for the national results sheet
data/state.json                written by the bot; don't edit
data/us-states.topo.json       U.S. map (Census Bureau, via us-atlas)
data/seattle-map.topo.json     Seattle map (shoreline, council districts, precincts, freeways)
scripts/fetch.mjs              collects all feeds and writes data/state.json
.github/workflows/update.yml   runs fetch.mjs every 5 minutes and publishes
```

## Where the numbers come from

| What | Source | How it gets in |
|---|---|---|
| Seattle and King County races | King County Elections results CSV | Automatic, every 5 minutes after 8 p.m. |
| Washington statewide measures, Supreme Court, WA-3, WA-4, WA-9 | Washington Secretary of State results CSV | Automatic, every 5 minutes after 8 p.m. |
| National Senate, governor and House counts and calls | Your desk's Google Sheet | Editors type them in; the bot reads the sheet every 5 minutes |

No free feed exists for national vote counts. The Associated Press's is licensed, and the free alternatives aren't reliable enough for election night. So national numbers come from a shared Google Sheet that editors fill in from AP results pages and state election offices. Keeping up takes one or two people: about 35 Senate and 36 governor rows plus one line for House totals.

## Set up (15 to 20 minutes)

1. **Create a public repository** on GitHub and upload everything in this folder, including the hidden `.github` folder. Use GitHub Desktop, or:
   ```
   git init && git add . && git commit -m "Results desk" && git branch -M main
   git remote add origin https://github.com/YOUR-ORG/results-desk.git && git push -u origin main
   ```
2. **Settings → Pages → Source: GitHub Actions.**
3. **Settings → Actions → General → Workflow permissions: Read and write.** Save.
4. **Make the national sheet.** In Google Sheets: **File → Import → Upload** `data/national-sheet-template.csv` (choose *Replace spreadsheet*). Then **File → Share → Publish to web → Sheet1 → Comma-separated values (.csv) → Publish**, and copy the link. Paste it into `data/desk.json` as `"nationalSheetCsv"`. Share the sheet (as an editor) with whoever is entering results.
5. **Actions → Update results → Run workflow.** The run page shows your site's address once it finishes.

Anyone who edits `desk.json` needs write access to the repo (**Settings → Collaborators**). People who only enter national results just need the Google Sheet.

## The national sheet

One row per race. Race IDs are `S-` plus the state for Senate and `G-` plus the state for governor (`S-OH`, `G-GA`).

| Column | What to enter |
|---|---|
| `dem_votes`, `rep_votes` | Current totals for the Democrat (or the Democratic-aligned independent, in NE, MT, SD and ID) and the Republican |
| `other_votes` | Optional |
| `expected_pct` | The share of the expected vote counted, as AP shows it ("72% of expected vote in"), entered as `72`. This matters: the model uses it to size the votes still out. If it's blank, the model assumes 50% and flags it on the race page. |
| `call` | `D`, `R` or `I`, only when the AP calls the race |
| `called_at` | Optional, e.g. `2026-11-03T18:42:00-08:00` |
| `note` | Optional, shown on the race page |

The **HOUSE** row holds total House seats called so far for each party (`dem_votes` = Democratic seats called, `rep_votes` = Republican). To follow an individual House race, add a row like `H-PA-07` with a `label`, `dem_name`, `rep_name` and `rating` (`sd`, `ld`, `tu`, `lr` or `sr`, using Cook's final ratings). It appears in "House races we're watching" and is modeled individually.

Publishing a sheet to the web caches it for about five minutes, so expect five to ten minutes from typing a number to seeing it on the site.

## Test before polls close

- **Rehearsal:** the footer button plays a simulated night, with national calls coming in, then King County and Secretary of State counts. Nothing is published.
- **Real file check:** **Actions → Update results → Run workflow**, and paste a results CSV address into **test_csv**. For King County's August primary, use `https://data.kingcounty.gov/api/views/2ydw-3iau/rows.csv?accessType=DOWNLOAD`. The log lists every contest it matched. Nothing is published.
- **Sheet check:** type a few numbers into your sheet, run the workflow, and check that they appear.

## Election night

- The King County and Secretary of State feeds start at `startFetchingAt` (8 p.m. PT). The national sheet is read at any time.
- GitHub can run scheduled jobs 5 to 15 minutes late. During busy stretches, press **Run workflow** by hand.
- **Check the Secretary of State address.** `sources.waStateCsv` in `desk.json` follows the pattern the Secretary of State used in past elections (`results.vote.wa.gov/results/20261103/export/20261103_AllState.csv`). When results go up, open the "Export Results" page on results.vote.wa.gov and confirm the address of the statewide CSV. If it differs, paste the real one in.
- King County's live CSV has county totals only. Seattle-only splits and the precinct map come from the precinct-level file, posted later (Nov. 12 for the mid-election file). When it's out, put its address in `sources.precinctCsv`.

## What editors change in `data/desk.json`

Edit it on GitHub (pencil icon), then **Commit changes**. The site republishes in about a minute. Keep the JSON valid.

- **Live updates:** add items to `posts` (`ts`, `title`, `body`).
- **Seattle and King County calls:** `calls`, keyed by race ID, e.g. `"sea-d5": {"winner": "a", "ts": "...", "note": "..."}`. Here `a` is the first-listed option.
- **Ballots left to count** (sharpens Seattle projections): `"ballotsLeft": {"2026-11-03": 410000}`. For statewide races: `"stateBallotsLeft": {"2026-11-03": {"left": 1200000, "counted": 2100000}}`.
- **A contest isn't matched:** the workflow log lists untracked contest names. Map one with `"aliases": {"Exact contest name": "race-id"}`.
- **Current precinct boundaries:** commit King County's voting-district GeoJSON as `data/precincts.geojson`.

## Embedding

- Google Sites: **Insert → Embed → By URL**, then paste the Pages address and make the box tall.
- Any site: `<iframe src="https://YOUR-ORG.github.io/results-desk/" style="width:100%;height:2200px;border:0" title="Election results"></iframe>`
- Deep links: `#senate`, `#house`, `#governors`, `#seattle`, `#race-S-ME`, `#race-sea-d5`, `#map-i645`.

## Changing races or forecasts

National races, candidates and starting margins are at the top of `js/natmodel.js`. Seattle and Washington races are at the top of `js/core.js`. Readers can see every assumption on the Method page.
