// Builds data/state.json for the site. Run by .github/workflows/update.yml every five minutes.
//  1. King County Elections results (summary CSV, and the precinct CSV when it exists)
//  2. Washington Secretary of State statewide results CSV
//  3. civicAPI's free live national results (Senate, governors, House), with optional corrections
//     from the desk's Google Sheet or data/desk.json "national"
//  4. Editors' notes, calls and settings from data/desk.json
// Each new local count becomes an "update"; each change to the national picture adds a point to the
// chance-of-control history.
//
// Run locally:
//   node scripts/fetch.mjs            (respects startFetchingAt for the King County and state feeds)
//   FORCE=1 node scripts/fetch.mjs    (fetch now)
// Test overrides: SUMMARY_CSV, PRECINCT_CSV, WA_CSV, NATIONAL_CSV (URL or local path), CIVIC_BASE (URL, or a
//   local folder holding race-<id>.json and forecast-house.json), ALLOW_TEST=1, NOW (ISO time),
//   OUT (write somewhere other than data/state.json, starting from an empty record).
import fs from "node:fs";
import vm from "node:vm";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const P = (...p) => path.join(root, ...p);
const ctx = { console };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(P("js/core.js"), "utf8"), ctx);
vm.runInContext(fs.readFileSync(P("js/natmodel.js"), "utf8"), ctx);
const { RACES, ingest, parseCSV } = ctx.CORE;
const NAT = ctx.NAT;

const readJSON = (f, d) => (fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, "utf8")) : d);
const desk = readJSON(P("data/desk.json"), {});
const OUT = process.env.OUT ? path.resolve(process.env.OUT) : P("data/state.json");
const before = fs.existsSync(OUT) ? fs.readFileSync(OUT, "utf8") : "";
const state = readJSON(OUT, { v: 2, drops: [], precinct: {} });
state.drops ||= [];
state.precinct ||= {};
state.national ||= { races: {}, house: { d: 0, r: 0 }, history: [] };
state.national.history ||= [];

const now = process.env.NOW ? new Date(process.env.NOW) : new Date();
const force = process.env.FORCE === "1";
const env = (k, d) => (process.env[k] !== undefined ? process.env[k] : d);
const src = {
  summary: env("SUMMARY_CSV", desk.sources?.summaryCsv ?? ""),
  precinct: env("PRECINCT_CSV", desk.sources?.precinctCsv ?? ""),
  wa: env("WA_CSV", desk.sources?.waStateCsv ?? ""),
  national: env("NATIONAL_CSV", desk.sources?.nationalSheetCsv ?? ""),
};
const pt = (d, o) => d.toLocaleString("en-US", { timeZone: "America/Los_Angeles", ...o });
const ptDate = (d) => pt(d, { year: "numeric", month: "2-digit", day: "2-digit" }).replace(/(\d+)\/(\d+)\/(\d+)/, "$3-$1-$2");
const log = (...a) => console.log("[fetch]", ...a);

async function get(url) {
  if (!/^https?:/i.test(url)) return fs.readFileSync(path.resolve(root, url), "utf8");
  const sep = url.includes("?") ? "&" : "?";
  const u = /docs\.google\.com/.test(url) ? url + sep + "cachebust=" + Date.now() : url;
  const r = await fetch(u, { redirect: "follow", headers: { "user-agent": "student-newsroom-results-desk (GitHub Actions)" } });
  if (!r.ok) throw new Error(`${url} answered ${r.status}`);
  return r.text();
}
const sum2 = (t) => (t ? (t.a || 0) + (t.b || 0) : 0);
const pick = (t) => (t ? { a: t.a, b: t.b, ballots: t.ballots, reg: t.reg } : null);
let dataChanged = false;

/* ---------- 1 + 2: King County and Washington State ---------- */
const start = desk.startFetchingAt ? new Date(desk.startFetchingAt) : null;
if (!force && start && now < start) {
  log(`Before startFetchingAt (${desk.startFetchingAt}); skipping King County and Secretary of State feeds.`);
} else {
  let K = null, Pr = null, W = null;
  try { if (src.summary) K = ingest(await get(src.summary), desk.aliases); } catch (e) { log("King County summary failed:", e.message); }
  try { if (src.precinct) Pr = ingest(await get(src.precinct), desk.aliases); } catch (e) { log("King County precinct file failed:", e.message); }
  try { if (src.wa) W = ingest(await get(src.wa), desk.aliases); } catch (e) { log("Secretary of State file failed:", e.message); }
  if (K) log(`King County: ${K.rows} rows, matched ${Object.keys(K.matched).length}; untracked ${K.unmatched.length}`);
  if (Pr) log(`King County precincts: ${Pr.rows} rows, matched ${Object.keys(Pr.matched).length}`);
  if (W) log(`Washington: ${W.rows} rows, matched ${Object.keys(W.matched).join(", ") || "nothing"}`);

  const totals = {}, byLD = {};
  for (const R of RACES) {
    const k = K?.matched[R.id] || Pr?.matched[R.id], p = Pr?.matched[R.id], w = W?.matched[R.id];
    const kcT = k ? k.t : null;
    const sameCount = p && kcT && Math.abs(sum2(p.t) - sum2(kcT)) <= Math.max(5, 0.002 * sum2(kcT));
    const sea = sameCount && sum2(p.t.sea) > 0 ? pick(p.t.sea) : null;
    if (sea && Object.keys(p.byLD).length) byLD[R.id] = p.byLD;
    let entry;
    if (R.src === "state") entry = { full: w ? pick(w.t) : null, kc: pick(kcT), sea };
    else entry = { full: pick(kcT), sea };
    if (entry.full || entry.kc || entry.sea) totals[R.id] = entry;
  }
  const ids = Object.keys(totals).sort();
  const last = state.drops[state.drops.length - 1];
  const sig = JSON.stringify(ids.map((id) => [id, ...["full", "kc", "sea"].map((s) => (totals[id][s] ? [totals[id][s].a, totals[id][s].b] : 0))]));
  const shrank = last && ids.some((id) => ["full", "kc"].some((s) => last.totals?.[id]?.[s] && totals[id][s] && sum2(totals[id][s]) < sum2(last.totals[id][s]) * 0.98));
  if (!ids.length) log("No tracked contests in the local results files; nothing recorded.");
  else if (shrank) log("Vote totals went DOWN versus the last update. That usually means a wrong file; not recording. Check sources in desk.json.");
  else if (last && last.sig === sig) log("Local results: no change.");
  else {
    if (last) for (const id of Object.keys(last.totals || {})) {
      totals[id] ||= {};
      for (const s of ["full", "kc", "sea"]) if (!totals[id][s] && last.totals[id][s]) totals[id][s] = last.totals[id][s];
    }
    const day = pt(now, { month: "short", day: "numeric" }).replace(/^(\w{3}) /, "$1. ").replace("May. ", "May ");
    const sameDay = state.drops.filter((d) => ptDate(new Date(d.ts)) === ptDate(now)).length;
    const label = state.drops.length === 0 ? "Election night" : `${day} update${sameDay ? " " + (sameDay + 1) : ""}`;
    state.drops.push({ id: "d" + now.getTime(), ts: now.toISOString(), label, source: Object.entries(src).filter(([k, v]) => v && k !== "national").map(([, v]) => v).join(" + "), totals, byLD, countyBallots: K?.countyBallots || Pr?.countyBallots || null, countyLeft: null, stateLeft: null, stateBallots: null, sig });
    log(`Recorded local update "${label}" with ${ids.length} contests.`);
    dataChanged = true;
  }
  if (Pr) for (const id of Object.keys(Pr.matched)) {
    const v = Pr.matched[id].byPct;
    if (Object.keys(v).length && JSON.stringify(v) !== JSON.stringify(state.precinct[id])) { state.precinct[id] = v; dataChanged = true; }
  }
}

/* ---------- 3a: civicAPI live national results (free, keyless; attribution required) ---------- */
const norm = (x) => String(x || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z ]/g, " ").replace(/\s+/g, " ").trim();
const lastName = (x) => norm(x).split(" ").filter((w) => !/^(jr|sr|ii|iii|iv)$/.test(w)).pop() || "";
function findCand(cands, name, party) {
  const n = norm(name), l = lastName(name);
  const top = (a) => a.sort((x, y) => (y.votes || 0) - (x.votes || 0))[0] || null;
  return cands.find((c) => n && norm(c.name) === n) || top(cands.filter((c) => l && lastName(c.name) === l)) || (party ? top(cands.filter((c) => c.party === party)) : null);
}
const civicBase = env("CIVIC_BASE", desk.sources?.civicApi ?? "https://civicapi.org/api/v2");
const civicURL = (p, file) => (/^https?:/.test(civicBase) ? `${civicBase}/${p}` : path.join(path.resolve(root, civicBase), file));
async function getJSON(p, file) { return JSON.parse(await get(civicURL(p, file))); }
async function civicNational() {
  if (!civicBase) return null;
  const ids = { S: 87528, G: 87535, H: 87524, ...(desk.sources?.civicRaceIds || {}) };
  const out = { races: {}, house: { d: 0, r: 0 }, updated: null, ok: false };
  const allowTest = !!desk.allowTestData || process.env.ALLOW_TEST === "1";
  for (const ch of ["S", "G"]) {
    let doc;
    try { doc = await getJSON(`race/${ids[ch]}`, `race-${ids[ch]}.json`); } catch (e) { log(`civicAPI ${ch === "S" ? "Senate" : "governors"} failed:`, e.message); continue; }
    if (doc.test_data && !allowTest) { log(`civicAPI ${ch}: flagged as test data; ignored`); continue; }
    out.ok = true; out.updated = doc.last_updated || out.updated;
    for (const def of ch === "S" ? NAT.SENATE : NAT.GOVS) {
      const reg = doc.region_results?.[def.st.toLowerCase()]; if (!reg) continue;
      const cands = reg.candidates || [];
      const dc = findCand(cands, def.d, def.dp === "I" ? null : "Democratic"), rc = findCand(cands, def.r, "Republican");
      const tot = cands.reduce((a, c) => a + (c.votes || 0), 0);
      const w = cands.find((c) => c.winner);
      const call = w ? (w === dc ? (def.dp === "I" ? "I" : "D") : w === rc ? "R" : w.party === "Republican" ? "R" : w.party === "Democratic" ? "D" : "I") : "";
      if (!tot && !call) continue;
      const dv = dc ? dc.votes || 0 : 0, rv = rc ? rc.votes || 0 : 0;
      out.races[def.id] = { d: dv, r: rv, o: Math.max(0, tot - dv - rv), exp: reg.percent_reporting ?? "", call };
    }
  }
  try {
    const doc = await getJSON(`race/${ids.H}`, `race-${ids.H}.json`);
    if (doc.test_data && !allowTest) log("civicAPI House: flagged as test data; ignored");
    else {
      out.ok = true;
      let fc = state.national.houseForecast;
      if (!fc || !fc.fetched || now - new Date(fc.fetched) > 6 * 3600e3) {
        try {
          const f = await getJSON("forecast/house/2026/civicapi", "forecast-house.json");
          const cats = { sd: 0, ld: 0, tu: 0, lr: 0, sr: 0 }, watch = {};
          const cat = (r) => /^(safe|likely) d/i.test(r) ? "sd" : /^(lean|tilt) d/i.test(r) ? "ld" : /^toss/i.test(r) ? "tu" : /^(lean|tilt) r/i.test(r) ? "lr" : "sr";
          for (const [k, v] of Object.entries(f.states || {})) { const c = cat(v.rating || ""); cats[c]++; if (c === "ld" || c === "tu" || c === "lr") watch[k.toUpperCase()] = { rating: c, dn: v.democratic || "", rn: v.republican || "" }; }
          if (Object.values(cats).reduce((a, b) => a + b, 0) === 435) { fc = { fetched: now.toISOString(), cats, watch }; state.national.houseForecast = fc; log(`civicAPI House ratings: ${JSON.stringify(cats)}`); }
          else log("civicAPI House forecast does not cover 435 seats; keeping Cook's ratings");
        } catch (e) { log("civicAPI House forecast failed:", e.message); }
      }
      for (const [k, reg] of Object.entries(doc.region_results || {})) {
        const cands = reg.candidates || [], w = cands.find((c) => c.winner);
        if (w) { if (w.party === "Democratic") out.house.d++; else if (w.party === "Republican") out.house.r++; }
        const key = k.toUpperCase(), wt = fc?.watch?.[key];
        if (!wt) continue;
        const dc = findCand(cands, wt.dn, "Democratic"), rc = findCand(cands, wt.rn, "Republican");
        const tot = cands.reduce((a, c) => a + (c.votes || 0), 0);
        const row = { label: key, dn: dc?.name || wt.dn || "Democrat", rn: rc?.name || wt.rn || "Republican", rating: wt.rating };
        if (tot) Object.assign(row, { d: dc?.votes || 0, r: rc?.votes || 0, o: Math.max(0, tot - (dc?.votes || 0) - (rc?.votes || 0)), exp: reg.percent_reporting ?? "" });
        if (w) row.call = w.party === "Republican" ? "R" : w.party === "Democratic" ? "D" : "I";
        out.races["H-" + key] = row;
      }
      if (fc?.cats) { out.houseCats = fc.cats; out.houseCatSource = "civicAPI forecast rating"; }
    }
  } catch (e) { log("civicAPI House failed:", e.message); }
  log(`civicAPI: ${Object.keys(out.races).filter((k) => !/^H-/.test(k)).length} Senate/governor races with votes or calls; House seats called D ${out.house.d}, R ${out.house.r}; ${Object.keys(out.races).filter((k) => /^H-/.test(k)).length} competitive districts tracked`);
  return out.ok ? out : null;
}
const civ = await civicNational();

/* ---------- 3b: national desk sheet (optional corrections) ---------- */
function readSheet(text) {
  const rows = parseCSV(text.replace(/^﻿/, ""));
  const h = rows[0].map((x) => x.trim().toLowerCase().replace(/[^a-z_]/g, ""));
  const col = (...n) => n.map((x) => h.indexOf(x)).find((i) => i >= 0) ?? -1;
  const c = { race: col("race", "race_id", "id"), label: col("label", "name"), dn: col("dem_name", "dem_candidate"), rn: col("rep_name", "rep_candidate"),
    d: col("dem_votes", "dem"), r: col("rep_votes", "rep"), o: col("other_votes", "other"), exp: col("expected_pct", "pct_expected", "expected"), call: col("call", "winner"), ts: col("called_at", "call_time"), note: col("note", "notes"), rating: col("rating") };
  if (c.race < 0) throw new Error("the sheet needs a 'race' column");
  const races = {}; let house = { d: 0, r: 0 };
  for (const row of rows.slice(1)) {
    const id = (row[c.race] || "").trim().toUpperCase(); if (!id) continue;
    const g = (i) => (i >= 0 ? (row[i] || "").trim() : "");
    if (id === "HOUSE") { house = { d: +g(c.d).replace(/[, ]/g, "") || 0, r: +g(c.r).replace(/[, ]/g, "") || 0 }; continue; }
    if (!/^[SGH]-/.test(id)) continue;
    const v = { d: g(c.d), r: g(c.r), o: g(c.o), exp: g(c.exp), call: g(c.call), ts: g(c.ts), note: g(c.note), label: g(c.label), dn: g(c.dn), rn: g(c.rn), rating: g(c.rating) };
    races[id] = Object.fromEntries(Object.entries(v).filter(([, x]) => x !== ""));
  }
  return { races, house };
}
let sheet = null;
try {
  if (src.national) { sheet = readSheet(await get(src.national)); log(`National sheet: ${Object.keys(sheet.races).length} rows, House calls D ${sheet.house.d} R ${sheet.house.r}`); }
} catch (e) { log("National sheet failed:", e.message); }
if (!sheet && desk.national) sheet = { races: desk.national.races || {}, house: desk.national.house || { d: 0, r: 0 } };
// Merge: civicAPI first; any value the desk enters overrides it, field by field.
if (civ || sheet) {
  const races = civ ? JSON.parse(JSON.stringify(civ.races)) : JSON.parse(JSON.stringify(state.national.races || {}));
  const MEANINGFUL = ["d", "r", "o", "exp", "call", "ts", "note", "rating"];
  for (const [id, v] of Object.entries(sheet?.races || {})) {
    const isHouse = /^H-/.test(id);
    const entered = Object.fromEntries(Object.entries(v).filter(([k]) => isHouse || MEANINGFUL.includes(k)));
    if (!Object.keys(entered).some((k) => MEANINGFUL.includes(k)) && !isHouse) continue;
    races[id] = { ...(races[id] || {}), ...entered, desk: true };
  }
  const house = sheet && (sheet.house.d || sheet.house.r) ? sheet.house : civ?.house || state.national.house || { d: 0, r: 0 };
  const known = new Set([...NAT.SENATE, ...NAT.GOVS].map((d) => d.id));
  const unknown = Object.keys(races).filter((id) => !known.has(id) && !/^H-/.test(id));
  if (unknown.length) log("Unknown race IDs (ignored by the model):", unknown.join(", "));
  const prev = JSON.stringify([state.national.races, state.national.house, state.national.houseCats]);
  state.national.races = races; state.national.house = house;
  if (civ?.houseCats) { state.national.houseCats = civ.houseCats; state.national.houseCatSource = civ.houseCatSource; }
  if (civ?.updated) state.national.civicUpdated = civ.updated;
  if (JSON.stringify([races, house, state.national.houseCats]) !== prev) dataChanged = true;
}

// chance-of-control history
{
  const anyData = Object.values(state.national.races).some((v) => v.d || v.r || v.call) || state.national.house.d || state.national.house.r;
  if (anyData) {
    const o = NAT.simulate(state.national, { K: 3000 });
    const pnt = { ts: now.toISOString(), s: +o.senate.pD.toFixed(3), h: +o.house.pD.toFixed(3), g: +o.gov.pD.toFixed(3) };
    const H = state.national.history;
    if (!H.length) { const p0 = NAT.simulate({ houseCats: state.national.houseCats }, { K: 3000 }); H.push({ ts: new Date(now.getTime() - 60000).toISOString(), s: +p0.senate.pD.toFixed(3), h: +p0.house.pD.toFixed(3), g: +p0.gov.pD.toFixed(3) }); }
    if (["s", "h", "g"].some((k) => Math.abs(pnt[k] - H[H.length - 1][k]) >= 0.005)) { H.push(pnt); log(`Control odds: Senate D ${pnt.s}, House D ${pnt.h}, Governors D ${pnt.g}`); }
  }
}

/* ---------- 4: editors' notes ---------- */
for (const d of state.drops) {
  const day = ptDate(new Date(d.ts));
  const n = (x) => (x == null || x === "" ? null : Number(x));
  const cl = n(desk.ballotsLeft?.[day]), sl = n(desk.stateBallotsLeft?.[day]?.left), sb = n(desk.stateBallotsLeft?.[day]?.counted);
  if (d.countyLeft !== cl || d.stateLeft !== sl || d.stateBallots !== sb) { d.countyLeft = cl; d.stateLeft = sl; d.stateBallots = sb; dataChanged = true; }
}
for (const k of ["masthead", "posts", "calls", "settings", "aliases"]) if (desk[k] !== undefined) state[k] = desk[k];
state.v = 2;
const strip = (j) => { try { const o = JSON.parse(j); delete o.updated; return JSON.stringify(o); } catch { return ""; } };
if (dataChanged || !state.updated || strip(JSON.stringify(state)) !== strip(before)) state.updated = now.toISOString();

const out = JSON.stringify(state);
if (out !== before) { fs.writeFileSync(OUT, out); log("Wrote " + path.relative(root, OUT)); }
else log("state.json unchanged");
