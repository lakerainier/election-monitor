"use strict";
/* Ballot definitions and results-file parser. Shared by the page (browser) and scripts/fetch.mjs (Node). */
/* ============================== BALLOT ============================== */
/* a/b are the two options. lean = which option tends to gain in later-counted Seattle ballots (younger, later voters). */
const RACES = [
 {id:"sea-prop1",g:"seattle",title:"Proposition 1: Seattle Transit Measure",short:"Prop. 1 Transit",kind:"measure",
  desc:"A 0.3% sales tax for 10 years, expected to raise about $138 million a year for bus service and transit programs. It replaces the 2020 measure, which expires in April 2027.",
  a:{n:"Yes",s:"Approve"},b:{n:"No",s:"Reject"},src:"kc",decides:true,lean:"a",reg:525000,uv:.95,
  prior:{a:.60,sd:.08,note:"No public polling found. Seattle approved the current transit measure in 2020; this version doubles the tax rate, so the prior is centered lower and kept wide."},
  match:[/seattle/,/prop/],optm:{a:[/^yes|approv/],b:[/^no|reject/]}},
 {id:"sea-d5",g:"seattle",title:"City Council District 5 (special election)",short:"Council D5",kind:"cand",
  desc:"North Seattle seat (Lake City, Northgate, Aurora corridor). The winner serves until the 2027 regular election.",
  a:{n:"Nilu Jenks",s:"Nonpartisan"},b:{n:"Julie Kang",s:"Nonpartisan"},src:"kc",decides:true,lean:"a",reg:82000,uv:.93,
  primary:{a:.54,b:.33,src:"Aug. 4 primary, later count (City Cast Seattle)"},
  prior:{a:.59,sd:.06,note:"Jenks won 54% to Kang's 33% in the four-way August primary. The remaining 13% is split, and the gap is regressed toward even because general electorates are larger and older-skewing."},
  match:[/seattle/,/district.*\b5\b|district no\.? ?5/],optm:{a:[/jenks/],b:[/kang/]}},
 {id:"kc-d2",g:"county",title:"King County Council District 2",short:"KC Council D2",kind:"cand",
  desc:"Open seat covering Southeast Seattle and parts of South King County, including SeaTac and Tukwila.",
  a:{n:"Rebecca Saldaña",s:"State senator"},b:{n:"Toshiko Hasegawa",s:"Port commissioner"},src:"kc",decides:true,lean:null,reg:150000,uv:.92,
  primary:{a:.531,b:.382,src:"Aug. 4 primary"},
  prior:{a:.57,sd:.06,note:"Saldaña led Hasegawa 53.1% to 38.2% in the primary; Miriam Mboya's 8.7% is assumed to split roughly evenly."},
  match:[/county council/,/district.*\b2\b|district no\.? ?2/],optm:{a:[/salda/],b:[/hasegawa/]}},
 {id:"kc-d8",g:"county",title:"King County Council District 8",short:"KC Council D8",kind:"cand",
  desc:"West Seattle, South Park, White Center, Burien, Tukwila and Vashon-Maury Island.",
  a:{n:"Teresa Mosqueda",s:"Incumbent"},b:{n:"Nick Duda",s:""},src:"kc",decides:true,lean:"a",reg:150000,uv:.93,
  primary:{a:.628,b:.275,src:"Aug. 4 primary, election-night count"},
  prior:{a:.67,sd:.05,note:"Mosqueda took 62.8% in the primary against Duda's 27.5%."},
  match:[/county council/,/district.*\b8\b|district no\.? ?8/],optm:{a:[/mosqueda/],b:[/duda/]}},
 {id:"kc-assessor",g:"county",title:"King County Assessor",short:"Assessor",kind:"cand",
  desc:"Open seat. Incumbent John Wilson did not seek re-election.",
  a:{n:"Rob Foxcurran",s:""},b:{n:"Dominique Scarimbolo",s:""},src:"kc",decides:true,lean:null,reg:1480000,uv:.85,
  primary:{a:.4707,b:.1923,src:"Aug. 4 primary"},
  prior:{a:.65,sd:.07,note:"Foxcurran won 47.1% of a four-way primary; Scarimbolo 19.2%. Chris Roberts (18.6%) and Al Dams (14.8%) voters are the unknown."},
  match:[/assessor/],optm:{a:[/foxcurran/],b:[/scarimbolo/]}},
 {id:"kc-pa",g:"county",title:"King County Prosecuting Attorney",short:"Prosecutor",kind:"uncontested",
  desc:"Leesa Manion is the only filed candidate.",a:{n:"Leesa Manion",s:"Incumbent"},b:null,src:"kc",decides:true,
  match:[/prosecut/],optm:{a:[/manion/]}},
 {id:"i645",g:"state",title:"Initiative 645: Repeal the tax on income over $1 million",short:"I-645 Income tax",kind:"measure",
  desc:"Repeals the 9.9% tax on household income above $1 million and bars state and local income taxes. Yes repeals; No keeps the tax.",
  a:{n:"Yes",s:"Repeal"},b:{n:"No",s:"Keep tax"},src:"state",regs:{full:4950000,kc:1480000,sea:525000},decides:true,lean:"b",reg:525000,uv:.97,
  prior:{a:.38,sd:.06,note:"Statewide, DHM Research (Sept. 14 to 21) found 35% yes and 57% no among voters shown the ballot's budget-impact statement. In 2024 Washington voters rejected Let's Go Washington's capital-gains repeal with 36% yes."},priorSea:{a:.27,sd:.07,note:"Statewide, a DHM Research poll (Sept. 14 to 21) found 35% yes and 57% no among voters shown the ballot's budget-impact statement. Seattle runs well to the left of the state."},
  match:[/645/],optm:{a:[/^yes/],b:[/^no/]}},
 {id:"i638",g:"state",title:"Initiative 638: Sex verification for girls' school sports",short:"I-638 School sports",kind:"measure",
  desc:"Bars students assigned male at birth from girls' school sports and requires health-care-provider verification of sex.",
  a:{n:"Yes",s:"Approve"},b:{n:"No",s:"Reject"},src:"state",regs:{full:4950000,kc:1480000,sea:525000},decides:true,lean:"b",reg:525000,uv:.96,
  prior:{a:.50,sd:.08,note:"No public statewide polling found. Of Let's Go Washington's four 2024 measures, one passed statewide (I-2066, 52%) and three failed (36% to 44%). The prior is centered at even and kept wide."},priorSea:{a:.30,sd:.08,note:"No Seattle polling found. In 2024 King County voted 41% yes on I-2066, another Let's Go Washington measure; Seattle precincts run lower than the county."},
  match:[/638/],optm:{a:[/^yes/],b:[/^no/]}},
 {id:"i1",g:"state",title:"Initiative 1: Parental rights in public schools",short:"I-1 Parental rights",kind:"measure",
  desc:"Re-enacts the 2024 parental-rights law (Initiative 2081) as originally written, undoing the Legislature's 2025 changes.",
  a:{n:"Yes",s:"Approve"},b:{n:"No",s:"Reject"},src:"state",regs:{full:4950000,kc:1480000,sea:525000},decides:true,lean:"b",reg:525000,uv:.96,
  prior:{a:.48,sd:.08,note:"No public statewide polling found. Same 2024 benchmarks as I-638; a re-enactment of a law the Legislature once passed, kept wide."},priorSea:{a:.33,sd:.08,note:"No Seattle polling found. Same Let's Go Washington benchmark as I-638, with a slightly higher prior because the measure re-enacts a law the Legislature once passed."},
  match:[/il26-0*1\b|initiative[^0-9]*\b1\b(?!\d)|measure no\.? ?1\b(?!\d)/],optm:{a:[/^yes/],b:[/^no/]}},
 {id:"ld43-sen",g:"leg",title:"43rd District State Senator",short:"LD43 Senate",kind:"cand",
  desc:"Capitol Hill, the U District, Wallingford, Fremont. Senate Majority Leader Jamie Pedersen faces a challenge from his left.",
  a:{n:"Jamie Pedersen",s:"Democrat, incumbent"},b:{n:"Hannah Sabio-Howell",s:"Democrat"},src:"kc",decides:true,lean:"b",reg:118000,uv:.92,
  primary:{a:.667,b:.236,src:"Aug. 4 primary (Secretary of State)"},
  prior:{a:.67,sd:.06,note:"Pedersen 66.7%, Sabio-Howell 23.6%, Heather-Marie Wilson 9.5% in the primary. Wilson's voters are treated as unpredictable."},
  match:[/\b43\b/,/senat/],optm:{a:[/pedersen/],b:[/sabio|howell/]}},
 {id:"ld37-h1",g:"leg",title:"37th District Representative, Position 1",short:"LD37 Rep. 1",kind:"cand",
  desc:"Central and Southeast Seattle. A 28-year incumbent trailed a newcomer in the primary.",
  a:{n:"Sharon Tomiko Santos",s:"Democrat, incumbent"},b:{n:"Kelabe Tewolde",s:"Democrat"},src:"kc",decides:true,lean:"b",reg:100000,uv:.90,
  primary:{a:.48,b:.51,src:"Aug. 4 primary, partial count (PubliCola)"},
  prior:{a:.48,sd:.05,note:"Tewolde led Santos 51% to 48% in a partial primary count. Close race; prior stays near even."},
  match:[/\b37\b/,/representative|position/,/\b1\b|pos.*1/],optm:{a:[/santos/],b:[/tewolde/]}},
 {id:"ld37-sen",g:"leg",title:"37th District State Senator",short:"LD37 Senate",kind:"cand",
  desc:"Open seat after Sen. Rebecca Saldaña ran for King County Council.",
  a:{n:"Tatiana Brown",s:"Democrat"},b:{n:"Chipalo Street",s:"Democrat"},src:"kc",decides:true,lean:null,reg:100000,uv:.88,
  prior:{a:.50,sd:.10,note:"We did not find published primary figures for this race; the prior is centered at even and kept wide."},
  match:[/\b37\b/,/senat/],optm:{a:[/brown/],b:[/street/]}},
 {id:"ld46-h",g:"leg",title:"46th District Representative (Pollet seat)",short:"LD46 Rep.",kind:"cand",
  desc:"Northeast Seattle and Lake Forest Park.",
  a:{n:"Gerry Pollet",s:"Democrat, incumbent"},b:{n:"Will Dreher",s:""},src:"kc",decides:true,lean:null,reg:110000,uv:.90,
  prior:{a:.56,sd:.10,note:"Primary figures not confirmed in our research. Incumbent edge assumed, with a wide prior."},
  match:[/\b46\b/,/representative|position/],optm:{a:[/pollet/],b:[/dreher/]}},
 {id:"wa7",g:"fed",title:"U.S. House, 7th District",short:"WA-7",kind:"cand",
  desc:"Most of Seattle plus Vashon Island and Shoreline-area suburbs.",
  a:{n:"Pramila Jayapal",s:"Democrat, incumbent"},b:{n:"Nirav Sheth",s:"Republican"},src:"kc",decides:true,lean:"a",reg:560000,uv:.96,
  prior:{a:.85,sd:.03,note:"Safe Democratic seat; prior reflects recent general-election margins in the district."},
  match:[/congress/,/\b7\b|no\.? ?7/],optm:{a:[/jayapal/],b:[/sheth/]}},
 {id:"wa9",g:"fed",title:"U.S. House, 9th District",short:"WA-9",kind:"cand",
  desc:"Southeast Seattle, Bellevue, Renton, Kent and Federal Way, plus part of Pierce County. Smith and Basler meet for the sixth time.",
  a:{n:"Adam Smith",s:"Democrat, incumbent"},b:{n:"Doug Basler",s:"Republican"},src:"state",regs:{full:500000,kc:420000},decides:true,lean:"a",reg:480000,uv:.96,
  primary:{a:.509,b:.238,src:"Aug. 4 primary"},
  prior:{a:.70,sd:.04,note:"Smith 50.9%, Basler 23.8% in a primary where Kshama Sawant took about 13% from the left. Those voters are expected to break heavily for Smith over a Republican."},
  match:[/congress/,/\b9\b|no\.? ?9/],optm:{a:[/smith/],b:[/basler/]}},
 {id:"wa3",g:"fed",title:"U.S. House, 3rd District",short:"WA-3",kind:"cand",
  desc:"Southwest Washington, from Vancouver to the coast. One of the most competitive House seats in the country.",
  a:{n:"Marie Gluesenkamp Perez",s:"Democrat, incumbent"},b:{n:"John Braun",s:"Republican"},src:"state",regs:{full:530000},decides:true,lean:"a",reg:530000,uv:.97,
  prior:{a:.49,sd:.05,note:"An OPB poll in late September found the race even; a Republican-sponsored poll had Braun ahead by 7. Prior is slightly below even with wide uncertainty."},
  match:[/congress/,/\b3\b|no\.? ?3\b/],optm:{a:[/gluesenkamp|perez/],b:[/braun/]}},
 {id:"wa4",g:"fed",title:"U.S. House, 4th District",short:"WA-4",kind:"cand",
  desc:"Central Washington, including the Yakima and Tri-Cities areas. Open seat after Rep. Dan Newhouse retired.",
  a:{n:"John Duresky",s:"Democrat"},b:{n:"Amanda McKinney",s:"Republican"},src:"state",regs:{full:470000},decides:true,lean:"a",reg:470000,uv:.97,
  prior:{a:.38,sd:.06,note:"A strongly Republican district; McKinney, endorsed by President Trump, led the primary field."},
  match:[/congress/,/\b4\b|no\.? ?4\b/],optm:{a:[/duresky/],b:[/mckinney/]}},
 {id:"sc1",g:"court",title:"State Supreme Court, Position 1",short:"Supreme Ct. 1",kind:"cand",desc:"Appointed Justice Colleen Melody stands for election.",
  a:{n:"Colleen Melody",s:"Incumbent"},b:{n:"Scott Edwards",s:""},src:"state",regs:{full:4950000,kc:1480000,sea:525000},decides:true,lean:null,reg:525000,uv:.80,
  prior:{a:.56,sd:.10,note:"Appointed incumbents usually keep their seats in Washington; wide prior."},priorSea:{a:.58,sd:.10,note:"Appointed incumbents usually hold their seats; wide prior."},match:[/supreme/,/\b1\b|no\.? ?0?1\b/],optm:{a:[/melody/],b:[/edwards/]}},
 {id:"sc3",g:"court",title:"State Supreme Court, Position 3",short:"Supreme Ct. 3",kind:"cand",desc:"Open seat.",
  a:{n:"Jaime Hawk",s:""},b:{n:"David Stevens",s:"Mason Co. Superior Court judge"},src:"state",regs:{full:4950000,kc:1480000,sea:525000},decides:true,lean:null,reg:525000,uv:.80,
  prior:{a:.54,sd:.10,note:"The state Republican Party recommended Stevens, which helps him outside King County. Wide prior."},priorSea:{a:.60,sd:.10,note:"The state Republican Party recommended Stevens; in Seattle that is expected to cost him votes."},match:[/supreme/,/\b3\b|no\.? ?0?3\b/],optm:{a:[/hawk/],b:[/stevens/]}},
 {id:"sc4",g:"court",title:"State Supreme Court, Position 4",short:"Supreme Ct. 4",kind:"cand",desc:"Open seat; no primary was held because only two candidates filed.",
  a:{n:"Ian Birk",s:"Court of Appeals judge"},b:{n:"Sean O'Donnell",s:"King Co. Superior Court judge"},src:"state",regs:{full:4950000,kc:1480000,sea:525000},decides:true,lean:null,reg:525000,uv:.78,
  prior:{a:.50,sd:.12,note:"Two sitting judges and no primary data; uninformative prior."},priorSea:{a:.50,sd:.12,note:"Two sitting judges and no primary data; uninformative prior."},match:[/supreme/,/\b4\b|no\.? ?0?4\b/],optm:{a:[/birk/],b:[/donnell/]}},
 {id:"sc5",g:"court",title:"State Supreme Court, Position 5",short:"Supreme Ct. 5",kind:"cand",desc:"Open seat.",
  a:{n:"Theo Angelis",s:""},b:{n:"Dave Larson",s:""},src:"state",regs:{full:4950000,kc:1480000,sea:525000},decides:true,lean:null,reg:525000,uv:.78,
  prior:{a:.53,sd:.10,note:"Wide prior."},priorSea:{a:.58,sd:.10,note:"Wide prior. Larson's donation history to Republican candidates is expected to matter in Seattle."},match:[/supreme/,/\b5\b|no\.? ?0?5\b/],optm:{a:[/angelis/],b:[/larson/]}},
 {id:"sc7",g:"court",title:"State Supreme Court, Position 7",short:"Supreme Ct. 7",kind:"cand",desc:"Justice Debra Stephens seeks re-election.",
  a:{n:"Debra Stephens",s:"Incumbent"},b:{n:"Todd Bloom",s:""},src:"state",regs:{full:4950000,kc:1480000,sea:525000},decides:true,lean:null,reg:525000,uv:.80,
  prior:{a:.58,sd:.09,note:"Incumbent justices rarely lose; wide prior."},priorSea:{a:.62,sd:.09,note:"Incumbent justices rarely lose; wide prior."},match:[/supreme/,/\b7\b|no\.? ?0?7\b/],optm:{a:[/stephens/],b:[/bloom/]}},
];
const GROUPS=[["seattle","City of Seattle"],["county","King County"],["state","Statewide measures"],["leg","Legislature"],["fed","Congress"],["court","State Supreme Court"]];
const RACE = Object.fromEntries(RACES.map(r=>[r.id,r]));
const KC_REG_APPROX=1480000;
const SCHEDULE=[
 ["2026-10-16T00:00:00-07:00","Oct. 16","Ballots mailed; voting opens"],
 ["2026-11-03T20:00:00-08:00","Nov. 3, 8 p.m.","Drop boxes close; postmark deadline"],
 ["2026-11-03T20:15:00-08:00","Nov. 3, ~8:15 p.m.","First count posted (ballots received before Election Day)"],
 ["2026-11-04T16:00:00-08:00","Nov. 4 onward","Daily afternoon updates as late ballots are processed"],
 ["2026-11-12T16:00:00-08:00","Nov. 12","Mid-election precinct results file"],
 ["2026-11-25T16:00:00-08:00","Nov. 25","Final precinct results file"]];

/* ============================== IMPORT ============================== */
function parseCSV(text){const rows=[];let row=[],f="",q=false;for(let i=0;i<text.length;i++){const c=text[i];if(q){if(c==='"'){if(text[i+1]==='"'){f+='"';i++}else q=false}else f+=c}else if(c==='"')q=true;else if(c===","){row.push(f);f=""}else if(c==="\n"||c==="\r"){if(c==="\r"&&text[i+1]==="\n")i++;row.push(f);f="";if(row.length>1||row[0]!=="")rows.push(row);row=[]}else f+=c}if(f!==""||row.length){row.push(f);rows.push(row)}return rows}
const META=/^(registered voters|times counted|times blank voted|times over ?voted|times under ?voted|ballots cast|total ballots|under ?votes?|over ?votes?|blank)/i;
function ingest(text,aliases){aliases=aliases||{};
  const rows=parseCSV(text.replace(/^﻿/,""));if(rows.length<2)throw new Error("The file has no data rows.");
  const h=rows[0].map(x=>x.trim().toLowerCase());
  const col=(...res)=>{for(const re of res){const i=h.findIndex(x=>re.test(x));if(i>=0)return i}return -1};
  const iRace=col(/^race$/,/^contest/,/race/,/office|measure|title/), iCand=col(/^countertype$/,/candidate/,/choice|option|selection/,/^name$/), iVotes=col(/^sumofcount$/,/^votes$/,/vote.?count|total.?votes/,/count$|votes/), iPct=col(/^precinct$/,/precinct/), iLeg=col(/^leg$/,/^ld$/,/legislative/);
  if(iRace<0||iCand<0||iVotes<0)throw new Error("Could not find race, candidate and vote-count columns. Expected King County's precinct file (Precinct, Race, LEG, CounterType, SumOfCount) or a Race, Candidate, Votes summary.");
  const C={};let countyB={};
  for(const r of rows.slice(1)){
    const race=(r[iRace]||"").trim(), cand=(r[iCand]||"").trim(), v=+String(r[iVotes]||"0").replace(/[, ]/g,"")||0;if(!race)continue;
    const pc=iPct>=0?(r[iPct]||"").trim():"", ld=iLeg>=0?String(r[iLeg]||"").trim().replace(/^0+/,""):"", sea=/^SEA\b/i.test(pc);
    const c=C[race]||(C[race]={race,cands:{},reg:0,ballots:0,sea:{cands:{},reg:0,ballots:0},ld:{},pct:{}});
    if(META.test(cand)){if(/registered/i.test(cand)){c.reg+=v;if(sea)c.sea.reg+=v}else if(/times counted|ballots cast|total ballots/i.test(cand)){c.ballots+=v;if(sea)c.sea.ballots+=v;if(pc)countyB[pc]=Math.max(countyB[pc]||0,v);if(ld&&sea){(c.ld[ld]||(c.ld[ld]={c:{},ballots:0})).ballots+=v}}continue}
    c.cands[cand]=(c.cands[cand]||0)+v;if(sea)c.sea.cands[cand]=(c.sea.cands[cand]||0)+v;
    if(ld&&sea){const L=c.ld[ld]||(c.ld[ld]={c:{},ballots:0});L.c[cand]=(L.c[cand]||0)+v}
    if(pc){const P=c.pct[pc]||(c.pct[pc]={});P[cand]=(P[cand]||0)+v}
  }
  const countyBallots=Object.values(countyB).reduce((a,b)=>a+b,0)||null;
  const matched={},unmatched=[];
  for(const c of Object.values(C)){
    const lc=c.race.toLowerCase();
    let race=aliases[c.race]?RACE[aliases[c.race]]:RACES.find(R=>R.match.every(re=>re.test(lc)));
    if(race&&race.g!=="seattle"&&/city of seattle/.test(lc)&&!aliases[c.race])race=null;
    if(race&&race.g==="seattle"&&!/seattle/.test(lc))race=null;
    if(!race){unmatched.push(c.race);continue}
    const pick=(obj,side)=>{if(!race[side])return 0;let s=0;for(const[k,v]of Object.entries(obj))if(race.optm[side].some(re=>re.test(k.toLowerCase())))s+=v;return s};
    const other=(obj)=>Object.entries(obj).filter(([k])=>!race.optm.a.some(re=>re.test(k.toLowerCase()))&&!(race.optm.b||[]).some(re=>re.test(k.toLowerCase()))).reduce((s,[,v])=>s+v,0);
    const t={a:pick(c.cands,"a"),b:pick(c.cands,"b"),other:other(c.cands),ballots:c.ballots||null,reg:c.reg||null,contest:c.race,
      sea:{a:pick(c.sea.cands,"a"),b:pick(c.sea.cands,"b"),ballots:c.sea.ballots||null,reg:c.sea.reg||null}};
    const byLD={};for(const[ld,L]of Object.entries(c.ld)){const a=pick(L.c,"a"),b=pick(L.c,"b");if(a+b>0)byLD[ld]={a,b,ballots:L.ballots||null}}
    const byPct={};for(const[pc,P]of Object.entries(c.pct)){const a=pick(P,"a"),b=pick(P,"b");if(a+b>0)byPct[pc]=[a,b]}
    // Several contests can fit one race's pattern (e.g. a district's Position 1 and 2): keep the one where this race's candidates got the most votes.
    const score=t.a+t.b, prev=matched[race.id];
    if(prev&&prev.score>=score){unmatched.push(c.race);continue}
    if(prev)unmatched.push(prev.t.contest);
    matched[race.id]={t,byLD,byPct,score};
  }
  return{matched,unmatched:[...new Set(unmatched)].sort(),countyBallots,rows:rows.length-1,precinctLevel:iPct>=0};
}

globalThis.CORE={RACES,RACE,GROUPS,SCHEDULE,parseCSV,ingest};
