"use strict";
/* National views: balance of power, U.S. map, race tables, race pages, and the Seattle/WA rail. */
let US_TOPO=null, NATMAP="S", NATSORT="close", _natMemo={key:null,val:null};
function natData(){return D().national||{races:{},house:{d:0,r:0},history:[]}}
function natSim(){const nat=natData();const key=JSON.stringify([nat.races,nat.house]);if(_natMemo.key!==key){_natMemo={key,val:NAT.simulate(nat)}}return _natMemo.val}
const PARTY={D:"Democrat",R:"Republican",I:"Independent"};
const pcol=k=>k==="R"?"var(--rep)":k==="I"?"var(--ind)":"var(--dem)";
function natShade(x){const p=x.pD,side=p>=.5?(x.def.dp==="I"?"I":"D"):"R";if(x.call)return pcol(x.call==="R"?"R":x.def.dp==="I"&&x.call!=="R"?"I":x.call);const t=Math.min(1,Math.abs(p-.5)*2);return`color-mix(in srgb, ${pcol(side)} ${Math.round(14+t*66)}%, var(--surface))`}
function sidePct(x,k){if(!x.has)return null;const v=x.inp;const tot=(v.d||0)+(v.r||0)+(v.o||0);return tot?(k==="d"?v.d:v.r)/tot:null}
function marginTxt(m,def){if(m==null||isNaN(m))return"–";if(Math.abs(m)<.05)return"Even";const lead=m>=0?(def.dp==="I"?"I":"D"):"R";return`${lead}+${Math.abs(m).toFixed(1)}`}
function natStatus(x){
  if(x.call){const w=x.call==="R"?x.def.r:x.def.d;return`<span class="chip called ${x.call==="R"?"rep":x.def.dp==="I"?"ind":"dem"}">Called: ${esc(w.split(" ").slice(-1)[0])}</span>`}
  const m={forecast:["Forecast","prior"],early:["Early count","early"],close:["Too close","close"],lean:["Leaning","lean"],proj:["Model: projected","proj"]}[x.status];
  return`<span class="chip ${m[1]}">${m[0]}</span>`;
}
function chanceTxt(x){const dW=x.pD>=.5,k=dW?(x.def.dp==="I"?"I":"D"):"R",p=Math.max(x.pD,1-x.pD);return`<span class="num ch-${k}">${k} ${p>.995&&p<1?">99%":pct(p,0)}</span>`}
function probBar(x){const p=x.pD;const dk=x.def.dp==="I"?"ind":"dem";return`<div class="pbar" role="img" aria-label="${pct(p,0)} chance for ${esc(x.def.d)}, ${pct(1-p,0)} for ${esc(x.def.r)}"><i class="${dk}" style="width:${p*100}%"></i><i class="rep" style="width:${(1-p)*100}%"></i><span class="mid"></span></div>`}

/* ---------- balance of power ---------- */
function seatBar(kind,sim){
  const S=sim, segs=[];
  if(kind==="S"){
    const nu=S.senate.notUp, rs=Object.values(S.races).filter(x=>x.def.chamber==="S");
        const calledD=rs.filter(x=>x.call&&x.call!=="R"&&x.def.dp!=="I").length, calledI=rs.filter(x=>x.call&&x.call!=="R"&&x.def.dp==="I").length, calledR=rs.filter(x=>x.call==="R").length;
    const un=rs.filter(x=>!x.call);const fD=un.filter(x=>x.pD>=.65&&x.def.dp!=="I").length,fI=un.filter(x=>x.pD>=.65&&x.def.dp==="I").length,fR=un.filter(x=>x.pD<=.35).length,tu=un.length-fD-fI-fR;
    segs.push(["dem",nu.D,"Not up"],["dem",calledD,"Won"],["dem lt",fD,"Favored"],["ind",calledI,"Ind. won"],["ind lt",fI,"Ind. favored"],["tu",tu,"Toss-up"],["rep lt",fR,"Favored"],["rep",calledR,"Won"],["rep",nu.R,"Not up"]);
    return barSVG(segs,100,51,"51 for Democratic control");
  }
  if(kind==="G"){
    const nu=S.gov.notUp, rs=Object.values(S.races).filter(x=>x.def.chamber==="G");
    const cD=rs.filter(x=>x.call&&x.call!=="R").length,cR=rs.filter(x=>x.call==="R").length,un=rs.filter(x=>!x.call);
    const fD=un.filter(x=>x.pD>=.65).length,fR=un.filter(x=>x.pD<=.35).length,tu=un.length-fD-fR;
    segs.push(["dem",nu.D,"Not up"],["dem",cD,"Won"],["dem lt",fD,"Favored"],["tu",tu,"Toss-up"],["rep lt",fR,"Favored"],["rep",cR,"Won"],["rep",nu.R,"Not up"]);
    return barSVG(segs,50,26,"26 for a majority");
  }
  const h=S.house, p=h.pool, cD=h.called.D, cR=h.called.R;
  segs.push(["dem",cD,"Won"],["dem lt",p.sd+p.ld,"Favored"],["tu",p.tu,"Toss-up"],["rep lt",p.lr+p.sr,"Favored"],["rep",cR,"Won"]);
  return barSVG(segs,435,218,"218 for a majority");
}
function barSVG(segs,total,maj,majLabel){
  const W=600,H=46;let x=0;const rects=segs.filter(s=>s[1]>0).map(s=>{const w=s[1]/total*W;const r=`<rect class="seg ${s[0]}" x="${x.toFixed(2)}" y="14" width="${Math.max(0,w-.6).toFixed(2)}" height="22"><title>${s[2]}: ${s[1]}</title></rect>`;x+=w;return r}).join("");
  const mx=maj/total*W;
  return`<svg class="seatbar" viewBox="0 0 ${W} ${H}" role="img" aria-label="Seat bar; ${majLabel}">${rects}<line x1="${mx}" x2="${mx}" y1="8" y2="42" class="majline"/><text x="${mx}" y="7" text-anchor="middle" class="majtxt">${maj}</text></svg>`;
}
function chamberCard(kind,sim){
  const S=sim;let title,pD,pR,mid,midLabel,sub,href;
  if(kind==="S"){title="Senate";pD=S.senate.pD;pR=S.senate.pR;mid=S.senate.pPivot;midLabel="Independents decide";href="#senate";
    const rs=Object.values(S.races).filter(x=>x.def.chamber==="S"),cD=rs.filter(x=>x.call&&x.call!=="R").length,cR=rs.filter(x=>x.call==="R").length;
    sub=`Projected: <b>${S.senate.medD}</b> D${S.senate.medI?` · <b>${S.senate.medI}</b> I`:""} · <b>${100-S.senate.medD-S.senate.medI}</b> R. Called ${cD+cR} of 35.`}
  else if(kind==="G"){title="Governors";pD=S.gov.pD;pR=S.gov.pR;mid=S.gov.pTie;midLabel="25–25 split";href="#governors";
    const rs=Object.values(S.races).filter(x=>x.def.chamber==="G"),c=rs.filter(x=>x.call).length;
    sub=`Projected: <b>${S.gov.medD}</b> D · <b>${50-S.gov.medD}</b> R governorships. Called ${c} of 36.`}
  else{title="House";pD=S.house.pD;pR=S.house.pR;mid=0;href="#house";
    sub=`Projected: <b>${S.house.medD}</b> D · <b>${435-S.house.medD}</b> R. Called ${S.house.called.D+S.house.called.R} of 435.`}
  return`<a class="chamber" href="${href}"><div class="ch-head"><h2>${title}</h2><span class="eyebrow">Chance of control</span></div>
   <div class="odds"><div class="dem"><b>${pct(pD,0)}</b><span>Democrats</span></div>${mid>=.005?`<div class="mid"><b>${pct(mid,0)}</b><span>${midLabel}</span></div>`:""}<div class="rep"><b>${pct(pR,0)}</b><span>Republicans</span></div></div>
   ${seatBar(kind,sim)}<p class="ch-sub">${sub}</p></a>`;
}
function histSVG(dist,lo,hi,maj,label){
  const keys=Object.keys(dist).map(Number);if(!keys.length)return"";const tot=Object.values(dist).reduce((a,b)=>a+b,0);
  lo=Math.min(lo,Math.min(...keys));hi=Math.max(hi,Math.max(...keys));
  const W=600,H=170,L=34,R=8,T=10,B=26,w=W-L-R,h=H-T-B,n=hi-lo+1,bw=w/n;const mx=Math.max(...Object.values(dist))/tot;
  const bars=[];for(let v=lo;v<=hi;v++){const p=(dist[v]||0)/tot;if(!p)continue;const x=L+(v-lo)*bw,bh=p/mx*h;bars.push(`<rect x="${(x+.5).toFixed(1)}" y="${(T+h-bh).toFixed(1)}" width="${Math.max(1,bw-1).toFixed(1)}" height="${bh.toFixed(1)}" class="${v>=maj?"dem":"rep"}"><title>${v} seats: ${pct(p,1)}</title></rect>`)}
  const step=n>60?20:n>30?5:2;const ticks=[];for(let v=Math.ceil(lo/step)*step;v<=hi;v+=step)ticks.push(`<text x="${(L+(v-lo+.5)*bw).toFixed(1)}" y="${H-8}" text-anchor="middle">${v}</text>`);
  const mxp=L+(maj-lo)*bw;
  return`<svg class="chart hist natchart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)}"><line class="gl" x1="${L}" x2="${W-R}" y1="${T+h}" y2="${T+h}"/>${bars.join("")}${ticks.join("")}<line class="half" x1="${mxp}" x2="${mxp}" y1="${T}" y2="${T+h}"/><text x="${mxp+4}" y="${T+10}">Majority</text></svg>`;
}
function historySVG(hist){
  if(!hist||hist.length<2)return"";
  const W=600,H=200,L=40,R=70,T=12,B=28,w=W-L-R,h=H-T-B;const t0=new Date(hist[0].ts).getTime(),t1=Math.max(t0+1,new Date(hist[hist.length-1].ts).getTime());
  const X=t=>L+(new Date(t).getTime()-t0)/(t1-t0)*w,Y=p=>T+h-p*h;
  const last=hist[hist.length-1];const ys={};const order=["s","h","g"].sort((a,b)=>Y(last[a])-Y(last[b]));let prev=-1e9;order.forEach(k=>{let y=Y(last[k])+4;if(y<prev+13)y=prev+13;ys[k]=y;prev=y});
  const line=(k,cls,lab)=>{const pts=hist.map(x=>`${X(x.ts).toFixed(1)},${Y(x[k]).toFixed(1)}`).join(" ");return`<polyline points="${pts}" class="hl ${cls}"/><text x="${W-R+6}" y="${ys[k]}" class="hlab ${cls}">${lab} ${pct(last[k],0)}</text>`};
  const ticks=[0,.25,.5,.75,1].map(p=>`<line class="gl" x1="${L}" x2="${W-R}" y1="${Y(p)}" y2="${Y(p)}"/><text x="${L-6}" y="${Y(p)+4}" text-anchor="end">${p*100}%</text>`).join("");
  const tl=[hist[0],hist[hist.length-1]].map((x,i)=>`<text x="${X(x.ts)}" y="${H-8}" text-anchor="${i?"end":"start"}">${tstr(x.ts)}</text>`).join("");
  return`<svg class="chart natchart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Chance of Democratic control over time">${ticks}${tl}${line("s","sen","Senate")}${line("h","hou","House")}${line("g","gov","Gov.")}</svg><p class="note">Chance that Democrats control each chamber, recalculated with every update.</p>`;
}

/* ---------- U.S. map ---------- */
function usMap(kind,sim){
  if(!US_TOPO)return`<div class="usmap-empty note">Loading the map…</div>`;
  const feats=topoFeatures(US_TOPO,"states");const path=d3.geoPath();
  const byST={};Object.values(sim.races).filter(x=>x.def.chamber===kind).forEach(x=>byST[x.def.st]=x);
  const ps=feats.map(f=>{const st=f.properties.st,x=byST[st];const fill=x?natShade(x):"var(--nomap)";return`<path d="${path(f)}" fill="${fill}" class="st ${x?"has":""} ${x&&x.call?"called":""}" data-st="${st}" ${x?`data-id="${x.def.id}" tabindex="0" role="link" aria-label="${esc(x.def.state)}: ${esc(x.def.d)} ${pct(x.pD,0)} chance, ${esc(x.def.r)} ${pct(1-x.pD,0)}"`:""}/>`}).join("");
  const small=new Set(["RI","DE","CT","NJ","MD","MA","NH","VT","DC","HI"]);
  const labs=feats.map(f=>{const st=f.properties.st;if(small.has(st))return"";const c=path.centroid(f);if(!c||isNaN(c[0]))return"";const adj={FL:[12,8],LA:[-8,4],MI:[10,22],KY:[6,4],ID:[0,14],CA:[-6,0]}[st]||[0,0];return`<text x="${(c[0]+adj[0]).toFixed(1)}" y="${(c[1]+adj[1]+4).toFixed(1)}" class="stlab ${byST[st]&&Math.abs(byST[st].pD-.5)>.3?"inv":""}" text-anchor="middle">${st}</text>`}).join("");
  const side=["NH","VT","MA","RI","CT","NJ","DE","MD"].map((st,i)=>{const x=byST[st];return`<g transform="translate(905,${150+i*26})"><rect width="22" height="18" rx="2" fill="${x?natShade(x):"var(--nomap)"}" class="st ${x?"has":""}" ${x?`data-id="${x.def.id}" tabindex="0" role="link"`:""}/><text x="28" y="13" class="stlab2">${st}</text></g>`}).join("");
  const leg=`<div class="maplegend nat"><span>Republican</span><div class="scale">${[.02,.15,.3,.42,.58,.7,.85,.98].map(p=>`<i style="background:${natShade({pD:p,def:{dp:"D"},call:null})}"></i>`).join("")}</div><span>Democrat</span><span class="lg-i"><i style="background:var(--ind)"></i>Independent</span><span class="lg-n"><i style="background:var(--nomap)"></i>No race</span></div>`;
  return`<div class="usmap" data-kind="${kind}"><svg viewBox="0 0 975 610" role="img" aria-label="${kind==="S"?"Senate":"Governor"} races by state">${ps}${labs}${side}</svg><div class="tip" hidden></div></div>${leg}<p class="note">Shade shows each side's chance of winning; solid color with a dark outline means the race has been called.</p>`;
}
function wireUSMap(){
  document.querySelectorAll(".usmap").forEach(box=>{const tip=box.querySelector(".tip"),sim=natSim();
    box.querySelectorAll("[data-id]").forEach(el=>{const x=sim.races[el.dataset.id];
      const show=ev=>{const d=x.def;const sd=sidePct(x,"d"),sr=sidePct(x,"r");tip.innerHTML=`<b>${esc(d.state)}</b> ${natStatus(x)}<div><span>${esc(d.d)} (${d.dp})</span><span class="num">${sd!=null?pct(sd):pct(x.pD,0)+" chance"}</span></div><div><span>${esc(d.r)} (R)</span><span class="num">${sr!=null?pct(sr):pct(1-x.pD,0)+" chance"}</span></div>${x.has?`<div class="muted num">~${pct(x.f,0)} of expected vote</div>`:""}`;tip.hidden=false;const r=box.getBoundingClientRect();let px=ev.clientX-r.left+14,py=ev.clientY-r.top+14;if(px>r.width-220)px=Math.max(4,px-234);tip.style.left=px+"px";tip.style.top=py+"px"};
      el.addEventListener("mousemove",show);el.addEventListener("mouseleave",()=>tip.hidden=true);
      el.addEventListener("click",()=>{location.hash="race-"+x.def.id});el.addEventListener("keydown",e=>{if(e.key==="Enter"){location.hash="race-"+x.def.id}})})});
  document.querySelectorAll("[data-natmap]").forEach(b=>b.addEventListener("click",()=>{NATMAP=b.dataset.natmap;render()}));
  document.querySelectorAll("[data-sort]").forEach(b=>b.addEventListener("click",()=>{NATSORT=b.dataset.sort;render()}));
}

/* ---------- tables ---------- */
function countCell(x){const d=x.def;if(!x.has)return`<span class="muted">Polls ${marginTxt(d.m,d)}</span>`;return`${marginTxt(x.c,d)} <span class="muted">· ${pct(x.f,0)} in</span>`}
function raceRow(x,compact){
  const d=x.def,sd=sidePct(x,"d"),sr=sidePct(x,"r");
  const nm=(n,p,share)=>`<span class="pdot ${p==="R"?"rep":p==="I"?"ind":"dem"}"></span>${esc(n)}${p==="I"?' <span class="muted">(I)</span>':""}${share!=null&&!compact?` <span class="num muted">${pct(share)}</span>`:""}`;
  return`<tr class="${x.call?"is-called":""}"><td><a href="#race-${d.id}"><b>${esc(d.state||d.label)}</b></a>${/special/i.test(d.note)?' <span class="muted">(special)</span>':""}${compact?`<div class="st-chip">${natStatus(x)}</div>`:""}</td>
   <td class="nmc">${nm(d.d,d.dp,sd)}</td><td class="nmc">${nm(d.r,"R",sr)}</td>
   <td class="r num">${countCell(x)}</td>${compact?"":`<td class="r num">${x.call?"–":marginTxt(x.med,d)}</td>`}<td class="pcell">${probBar(x)}${chanceTxt(x)}</td>${compact?"":`<td>${natStatus(x)}</td>`}</tr>`;
}
function raceTable(kind,sim,limit){
  let rs=Object.values(sim.races).filter(x=>x.def.chamber===kind);
  if(NATSORT==="state"&&!limit)rs.sort((a,b)=>a.def.state.localeCompare(b.def.state));else rs.sort((a,b)=>(a.call?1:0)-(b.call?1:0)||Math.abs(a.pD-.5)-Math.abs(b.pD-.5));
  const compact=!!limit;if(limit)rs=rs.slice(0,limit);
  return`<div class="tbl-wrap"><table class="nat"><thead><tr><th>State</th><th>Democrat or aligned</th><th>Republican</th><th class="r">Count</th>${compact?"":`<th class="r">Projected</th>`}<th>Chance of winning</th>${compact?"":"<th>Status</th>"}</tr></thead><tbody>${rs.map(x=>raceRow(x,compact)).join("")}</tbody></table></div>
  <p class="note">Count shows the current margin and the share of expected vote counted; before votes are counted it shows the final polling average.${compact?"":" Projected is the model's median final margin."}</p>`;
}
function sortBtns(){return`<div class="seg-btns" role="group" aria-label="Sort"><button class="btn ${NATSORT==="close"?"on":""}" data-sort="close">Closest first</button><button class="btn ${NATSORT==="state"?"on":""}" data-sort="state">A–Z</button></div>`}

/* ---------- Seattle & Washington rail ---------- */
function localRail(){
  const ids=["sea-prop1","sea-d5","i645","i638","wa3","ld43-sen","kc-d2","wa9"];
  const rows=ids.map(id=>RACE[id]).filter(Boolean).map(race=>{const m=project(race);const prior=m.status==="prior";const sa=prior?m.mean:m.s;const lead=sa>=.5?"a":"b";
    return`<a class="lr" href="#race-${race.id}"><div class="lr-h"><span>${esc(race.short)}</span>${chipFor(race,m)}</div><div class="lr-o"><span class="${lead==="a"?"lead":""}">${esc(race.a.n)} <b class="num">${pct(sa,0)}</b></span><span class="${lead==="b"?"lead":""}">${esc(race.b.n)} <b class="num">${pct(1-sa,0)}</b></span></div>${barHTML(race,m)}</a>`}).join("");
  const last=D().drops[D().drops.length-1];
  return`<aside class="local-rail" aria-label="Seattle and Washington"><div class="lr-top"><span class="eyebrow">Second window</span><h2>Seattle &amp; Washington</h2><p class="note">${last?`King County update: ${esc(last.label)}, ${tstr(last.ts)}.`:"King County posts its first count shortly after 8 p.m."}</p></div>${rows}<a class="btn" href="#seattle" style="justify-content:center;margin-top:.5rem">All Seattle and Washington results</a></aside>`;
}

/* ---------- pages ---------- */
function natHome(){
  const sim=natSim(),nat=natData(),anyCount=Object.values(sim.races).some(x=>x.has||x.call);
  const kind=NATMAP;
  return`<div class="natgrid"><div class="natmain">
   <h1>${anyCount?"Midterm results and projections":"The 2026 midterms: what to watch"}</h1>
   <p class="lede">${anyCount?`Calls follow the Associated Press as recorded by our desk. Projections estimate the votes still uncounted and update as each state reports.`:"Thirty-five Senate seats, all 435 House seats and 36 governorships are on the ballot. Until votes are counted, every number here is a forecast built from final polling averages and race ratings."}</p>
   <div class="chambers">${chamberCard("S",sim)}${chamberCard("H",sim)}${chamberCard("G",sim)}</div>
   ${nat.history&&nat.history.length>1?`<section class="panel"><h3>The night so far</h3>${historySVG(nat.history)}</section>`:""}
   <section class="panel"><div class="row" style="justify-content:space-between"><h3>${kind==="S"?"Senate":"Governor"} map</h3><div class="seg-btns" role="group" aria-label="Map"><button class="btn ${kind==="S"?"on":""}" data-natmap="S">Senate</button><button class="btn ${kind==="G"?"on":""}" data-natmap="G">Governors</button></div></div>${usMap(kind,sim)}</section>
   <section class="panel"><div class="row" style="justify-content:space-between"><h3>Closest ${kind==="S"?"Senate":"governor"} races</h3><a href="#${kind==="S"?"senate":"governors"}">All ${kind==="S"?"35":"36"} races</a></div>${raceTable(kind,sim,10)}</section>
   ${schedulePanel()}
  </div>${localRail()}</div>`;
}
function schedulePanel(){
  const S=[["2026-11-03T15:00:00-08:00","3 p.m.","First polls close (parts of Indiana and Kentucky)"],["2026-11-03T16:00:00-08:00","4 p.m.","Polls close across much of the East, including Georgia, Virginia and most of Florida"],["2026-11-03T17:00:00-08:00","5 p.m.","Most Central and Eastern states have closed, including Texas, Michigan and Maine"],["2026-11-03T18:00:00-08:00","6 p.m.","Mountain states, plus Iowa, Minnesota and Wisconsin"],["2026-11-03T20:00:00-08:00","8 p.m.","Washington, Oregon and California close; King County's first count follows"],["2026-11-03T21:00:00-08:00","9 p.m.","Alaska and Hawaii, the last polls to close"]];
  const now=Date.now();
  return`<section class="panel"><h3>Poll closings, Pacific time</h3><ol class="timeline">${S.map((s,i)=>{const t=new Date(s[0]).getTime(),nx=S[i+1]?new Date(S[i+1][0]).getTime():t+3*3600e3;return`<li class="${now>=nx?"done":now>=t?"now":""}"><time>${s[1]}</time><span>${s[2]}</span></li>`}).join("")}</ol><p class="note" style="margin-top:.5rem">Approximate; some states close in stages across time zones. Check each state's election office for exact times.</p></section>`;
}
function natChamberPage(kind){
  const sim=natSim();
  if(kind==="H")return natHouse(sim);
  const nu=CHAMBERS_NOTE(kind);
  const dist=kind==="S"?sim.senate.distD:sim.gov.dist;
  return`<p class="crumbs"><a href="#">National</a> / ${kind==="S"?"Senate":"Governors"}</p><h1 style="margin-top:.5rem">${kind==="S"?"Senate":"Governors"}</h1><p class="lede">${nu}</p>
  <div class="chambers one">${chamberCard(kind,sim)}</div>
  <section class="panel"><h3>${kind==="S"?"Democratic Senate seats":"Democratic governorships"} across ${fmt(sim.K)} simulations</h3>${histSVG(dist,kind==="S"?42:18,kind==="S"?60:34,kind==="S"?51:26,"Seat distribution")}${kind==="S"?`<p class="note">Independents who win are not counted as Democrats here. In ${pct(sim.senate.pPivot,0)} of simulations neither party reaches control on its own and the winning independents decide it.</p>`:`<p class="note">A 25–25 split happens in ${pct(sim.gov.pTie,0)} of simulations.</p>`}</section>
  <section class="panel"><h3>Map</h3>${usMap(kind,sim)}</section>
  <section class="panel"><div class="row" style="justify-content:space-between"><h3>Every race</h3>${sortBtns()}</div>${raceTable(kind,sim)}</section>`;
}
function CHAMBERS_NOTE(kind){return NAT.CHAMBERS[kind].notUpNote}
function natHouse(sim){
  const h=sim.house,cats=NAT.HOUSE_CATS;
  const watch=h.watch.map(id=>sim.races[id]);
  const wrows=watch.map(x=>{const d=x.def;return`<tr><td><a href="#race-${d.id}"><b>${esc(d.label)}</b></a></td><td>${esc(d.d)}</td><td>${esc(d.r)}</td><td>${esc((cats.find(c=>c[0]===d.rating)||cats[2])[1])}</td><td class="r num">${x.has?pct(x.f,0):"–"}</td><td class="r num">${x.has?marginTxt(x.c,d):"–"}</td><td class="pcell">${probBar(x)}${chanceTxt(x)}</td><td>${natStatus(x)}</td></tr>`}).join("");
  return`<p class="crumbs"><a href="#">National</a> / House</p><h1 style="margin-top:.5rem">House</h1><p class="lede">All 435 seats are up; 218 is a majority. Several states redrew their maps in the middle of the decade, so district-by-district comparisons with 2024 are unreliable. The model works from final race ratings and the seats the desk has recorded as called.</p>
  <div class="chambers one">${chamberCard("H",sim)}</div>
  <section class="panel"><h3>Democratic House seats across ${fmt(sim.K)} simulations</h3>${histSVG(h.dist,200,260,218,"House seat distribution")}</section>
  <section class="panel"><h3>Seats still to be decided, by rating</h3><div class="tbl-wrap"><table><thead><tr><th>Cook Political Report final rating</th><th class="r">Seats rated</th><th class="r">Still uncalled</th></tr></thead><tbody>${cats.map(c=>`<tr><td>${c[1]}</td><td class="r num">${c[2]}</td><td class="r num">${h.pool[c[0]]}</td></tr>`).join("")}<tr><td><b>Called</b></td><td></td><td class="r num">D ${h.called.D} · R ${h.called.R}</td></tr></tbody></table></div>
   <p class="note" style="margin-top:.4rem">Called seats are removed from the safest ratings first unless the desk lists the district individually.</p></section>
  <section class="panel"><h3>House races we're watching</h3>${wrows?`<div class="tbl-wrap"><table class="nat"><thead><tr><th>District</th><th>Democrat</th><th>Republican</th><th>Rating</th><th class="r">Exp. vote in</th><th class="r">Margin now</th><th>Chance of winning</th><th>Status</th></tr></thead><tbody>${wrows}</tbody></table></div>`:`<p class="note" style="margin-top:.35rem">The desk adds districts here from its results sheet as the night goes on.</p>`}</section>
  <section class="panel"><h3>Washington's House races</h3><div class="grid" style="margin-top:.6rem">${["wa3","wa4","wa9","wa7"].map(id=>RACE[id]&&card(RACE[id])).join("")}</div></section>`;
}
function natRace(id){
  const sim=natSim(),x=sim.races[id];if(!x)return`<p>That race isn't on this page. <a href="#">Back to national results</a></p>`;
  const d=x.def,ch=d.chamber==="S"?"Senate":d.chamber==="G"?"Governor":"House";
  const sd=sidePct(x,"d"),sr=sidePct(x,"r");
  const side=(k)=>{const isD=k==="d",nm=isD?d.d:d.r,pt=isD?d.dp:"R",share=isD?sd:sr,votes=isD?x.inp.d:x.inp.r,prob=isD?x.pD:1-x.pD;
    return`<div class="side ${pt==="R"?"sr":pt==="I"?"si":"sd"}"><span class="who">${esc(nm)}</span><div class="muted" style="font-size:.8rem">${PARTY[pt]}</div><b>${share!=null?pct(share):pct(prob,0)}</b><span class="num muted">${share!=null?fmt(votes)+" votes":"chance of winning"}</span></div>`};
  const bins=x.bins,binMax=Math.max(1,...bins);
  const dens=x.call?"":`<svg class="chart natchart" viewBox="0 0 600 170" role="img" aria-label="Distribution of simulated final margins">${bins.map((b,i)=>{const m=(i-20)*2;const X=20+i*13.6;const hgt=b/binMax*120;return b?`<rect x="${X}" y="${140-hgt}" width="12" height="${hgt}" class="${m>0?(d.dp==="I"?"ind":"dem"):m<0?"rep":"tu"}"><title>${marginTxt(m,d)}: ${pct(b/sim.K,1)}</title></rect>`:""}).join("")}<line class="half" x1="${20+20*13.6+6}" x2="${20+20*13.6+6}" y1="8" y2="140"/>${[-40,-20,0,20,40].map(m=>`<text x="${20+(m/2+20)*13.6+6}" y="160" text-anchor="middle">${m===0?"Even":marginTxt(m,d)}</text>`).join("")}</svg>`;
  const kv=[["Chance "+d.d.split(" ").slice(-1)[0]+" wins",pct(x.pD,x.pD>.99||x.pD<.01?1:0)],["Projected final margin",x.call?"Called":marginTxt(x.med,d)],["80% range",x.call?"–":`${marginTxt(x.lo,d)} to ${marginTxt(x.hi,d)}`],["Expected vote counted",x.has?pct(x.f,0)+(x.expMissing?" (not entered; assumed)":""):"–"],["Votes counted",x.has?fmt(x.votes+(x.inp.o||0)):"–"],["Final polling average",marginTxt(d.m,d)]];
  return`<p class="crumbs"><a href="#">National</a> / <a href="#${d.chamber==="S"?"senate":d.chamber==="G"?"governors":"house"}">${ch}</a></p>
  <div class="row" style="justify-content:space-between;margin-top:.5rem"><h1>${esc(d.state||d.label)} ${ch}</h1>${natStatus(x)}</div>
  ${d.note?`<p class="lede">${esc(d.note)}.</p>`:""}
  <div class="detail"><div>
   <div class="panel"><div class="big">${side("d")}${side("r")}</div>${probBar(x)}
    ${x.call?`<p class="msg" style="margin-top:.75rem"><b>Called</b> for ${esc(x.call==="R"?d.r:d.d)}${x.inp.ts?", "+tstr(x.inp.ts):""}. ${esc(x.inp.note||"")}</p>`:""}
    <dl class="kv">${kv.map(([k,v])=>`<div><dt>${esc(k)}</dt><dd>${v}</dd></div>`).join("")}</dl></div>
   ${dens?`<div class="panel"><h3>Where the final margin lands</h3><p class="note" style="margin:.25rem 0 .5rem">Each bar is a two-point band of simulated final margins. ${x.has?"Counted votes are fixed; only the uncounted share varies.":"Before votes are counted, this is the polling average plus race and national uncertainty."}</p>${dens}</div>`:""}
  </div><div>
   <div class="panel"><h3>Where the forecast starts</h3><p class="note" style="margin-top:.35rem">${esc(d.src)}: ${marginTxt(d.m,d)}. The model adds a race-specific error of about ${NAT.PARAMS.raceSd} points and a nationwide error of ${NAT.PARAMS.natSd} points shared by every race, so polling misses move all states together.</p>
    ${Math.abs(sim.delta)>.05?`<p class="note" style="margin-top:.5rem">Counted votes so far suggest polls ${sim.delta>0?"underestimated Democrats":"underestimated Republicans"} by about <b>${Math.abs(sim.delta).toFixed(1)} points</b> nationally. That estimate is applied to every race not yet called.</p>`:""}</div>
   <div class="panel"><h3>About these numbers</h3><p class="note" style="margin-top:.35rem">Vote counts and the share of expected vote counted are entered by the desk from official state results and the Associated Press. Calls follow the AP.</p></div>
   <div class="panel"><h3>Other ${ch.toLowerCase()} races</h3><div class="mini-list">${Object.values(sim.races).filter(y=>y.def.chamber===d.chamber&&y.def.id!==id).sort((a,b)=>Math.abs(a.pD-.5)-Math.abs(b.pD-.5)).slice(0,6).map(y=>`<a href="#race-${y.def.id}"><span>${esc(y.def.state||y.def.label)}</span>${probBar(y)}</a>`).join("")}</div></div>
  </div></div>`;
}
