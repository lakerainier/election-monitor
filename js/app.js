"use strict";
/* ============================== STATE ============================== */
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
let STATE={v:1,updated:null,drops:[],calls:{},posts:[],aliases:{},precinct:{},national:{races:{},house:{d:0,r:0},history:[]},settings:{turnout:.72,turnoutSd:.04}};
let GEO_TOPO=null, LAST_CHECK=null, FETCH_ERR=null;
let SIM=null;            // rehearsal data, never published
let CAN_EDIT=false, DL=true;
let GEO_ERR=null;
let mapRace="sea-prop1";
const D=()=>SIM||STATE;
const fmt=n=>n==null||isNaN(n)?"–":Math.round(n).toLocaleString("en-US");
const pct=(x,d=1)=>x==null||isNaN(x)?"–":(x*100).toFixed(d)+"%";
const pp=(x,d=1)=>(x>=0?"+":"−")+Math.abs(x*100).toFixed(d);
const tstr=iso=>{if(!iso)return"–";const d=new Date(iso);return d.toLocaleString("en-US",{month:"short",day:"numeric",hour:"numeric",minute:"2-digit",timeZone:"America/Los_Angeles"})};

/* ============================== MODEL ============================== */
function rng(seed){let a=seed>>>0;return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
function hash(s){let h=2166136261;for(const c of s){h^=c.charCodeAt(0);h=Math.imul(h,16777619)}return h>>>0}
function gauss(r){let u=0,v=0;while(!u)u=r();while(!v)v=r();return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v)}
function Phi(z){const t=1/(1+.2316419*Math.abs(z)),d=.3989423*Math.exp(-z*z/2);const p=d*t*(.3193815+t*(-.3565638+t*(1.781478+t*(-1.821256+t*1.330274))));return z>0?1-p:p}
function scopeOf(t,scope){if(!t)return null;if(t.full||t.kc){return scope==="sea"?t.sea:scope==="kc"?t.kc:t.full}return scope==="sea"?t.sea:scope==="full"?t:null}
function tally(drop,race,scope){scope=scope||"full";const t=drop.totals&&drop.totals[race.id];const v=scopeOf(t,scope);if(!v)return null;return{scope,a:v.a||0,b:v.b||0,ballots:v.ballots||null,reg:v.reg||null,countyBallots:drop.countyBallots||null,countyLeft:drop.countyLeft,stateLeft:drop.stateLeft,stateBallots:drop.stateBallots||null}}
function hasScope(race,scope){return D().drops.some(d=>{const v=tally(d,race,scope);return v&&(v.a+v.b)>0})}

/* Projection for one race given the drop history. Returns everything the UI shows. */
function project(race,scope){
  scope=scope||"full";const data=D();
  if(race.kind==="uncontested")return{status:"uncont"};
  const series=data.drops.map(d=>({d,t:tally(d,race,scope)})).filter(x=>x.t&&(x.t.a+x.t.b)>0);
  const P=(scope==="sea"&&race.priorSea)||race.prior, lean=race.lean==="a"?1:race.lean==="b"?-1:0;
  if(!series.length){
    const p=1-Phi((.5-P.a)/P.sd);
    return{status:"prior",pA:p,mean:P.a,lo:P.a-1.2816*P.sd,hi:P.a+1.2816*P.sd,series:[],counted:0};
  }
  const last=series[series.length-1].t, N=last.a+last.b, s=last.a/N;
  // incremental (new-ballot) shares between drops, and the shift each shows vs. the running count
  const inc=[];for(let i=0;i<series.length;i++){const c=series[i].t,p=i?series[i-1].t:{a:0,b:0};const dn=(c.a+c.b)-(p.a+p.b);if(dn>0)inc.push({n:dn,share:(c.a-p.a)/dn,prev:i?p.a/(p.a+p.b):null,label:series[i].d.label,ts:series[i].d.ts})}
  // late-ballot shift: prior (+3 pts toward lean side, sd 2.5) updated by each later drop's observed shift
  const s0=.025, so=.02; let prec=1/(s0*s0), num=(lean*.03)*prec;
  inc.filter(x=>x.prev!=null).forEach(x=>{const w=Math.min(1,x.n/(N*.15));const pr=w/(so*so);prec+=pr;num+=(x.share-x.prev)*pr});
  const delta=num/prec, deltaSd=Math.sqrt(1/prec);
  // ballots and remaining votes
  const uv=last.ballots?Math.min(1,N/last.ballots):race.uv;
  const ballots=last.ballots||N/uv;
  let remB, remSd, remSrc;
  const kcScope=(race.src==="kc"&&scope==="full")||scope==="kc"||scope==="sea";
  if(scope==="full"&&race.src==="state"&&last.stateLeft!=null&&last.stateLeft!==""&&last.stateBallots){remB=Number(last.stateLeft)*(ballots/last.stateBallots);remSd=.10;remSrc="The Secretary of State's reported ballots left to count statewide, prorated by this race's share of ballots counted"}
  else if(kcScope&&last.countyLeft!=null&&last.countyLeft!==""&&last.countyBallots){remB=Number(last.countyLeft)*(ballots/last.countyBallots);remSd=.10;remSrc="King County's reported ballots left to count, prorated by this race's share of ballots counted"}
  else{const reg=last.reg||(race.regs&&race.regs[scope])||race.reg, st=data.settings||{turnout:.72,turnoutSd:.04};const T=reg*st.turnout;remB=Math.max(0,T-ballots);remSd=Math.min(.6,reg*st.turnoutSd/Math.max(remB,1));remSrc=`Projected turnout of ${pct(st.turnout,0)} of ${fmt(reg)} registered voters${last.reg?"":" (approximate registration)"}`}
  const R=remB*uv;
  const muR=Math.min(.98,Math.max(.02,s+delta)), sdR=Math.sqrt(deltaSd*deltaSd+.012*.012);
  // Monte Carlo
  const r=rng(hash(race.id+":"+scope+":"+data.drops.length+":"+N)), K=8000, fin=new Float64Array(K);let wins=0;
  for(let k=0;k<K;k++){const Rk=Math.max(0,R*Math.exp(remSd*gauss(r)-remSd*remSd/2));const x=Math.min(1,Math.max(0,muR+sdR*gauss(r)));const f=(last.a+Rk*x)/(N+Rk);fin[k]=f;if(f>.5)wins++}
  fin.sort();const q=p=>fin[Math.floor(p*(K-1))];
  const pA=wins/K, need=R>0?(.5*(N+R)-last.a)/R:null;
  const share=N/(N+R);
  const pmax=Math.max(pA,1-pA);
  let status= share<.3?"early": pmax>=.995?"proj": pmax>=.9?"lean":"close";
  return{status,pA,mean:q(.5),lo:q(.1),hi:q(.9),s,N,R,remB,remSrc,uv,ballots,delta,deltaSd,muR,need,share,series,inc,counted:N,last};
}
const STATUS={prior:["Forecast","prior"],early:["Too early","early"],close:["Too close","close"],lean:["Leaning","lean"],proj:["Model: projected","proj"],uncont:["Uncontested","uncont"]};
function chipFor(race,m){const c=D().calls[race.id];if(c&&c.winner)return`<span class="chip called">Called: ${esc(race[c.winner].n)}</span>`;const s=STATUS[m.status];return`<span class="chip ${s[1]}">${s[0]}</span>`}
function leaderSide(m){return m.pA>=.5?"a":"b"}

let toastT;function toast(m){const t=document.getElementById("toast");t.textContent=m;t.hidden=false;clearTimeout(toastT);toastT=setTimeout(()=>t.hidden=true,4200)}
/* ============================== REHEARSAL ============================== */
function makeSim(){
  loadBase();const p2=precToCouncil();const r=rng(Date.now()%1e9), fracs=[.56,.70,.80,.88,.94,.98];
  const ldIdx={"43":.07,"37":.05,"36":.03,"46":.01,"34":0,"11":.01,"32":-.03},cdIdx={1:-.01,2:.04,3:.08,4:.03,5:-.02,6:.02,7:-.01};
  const P=PREC.map(f=>{const nm=f.properties.name,ld=(String(nm).match(/^SEA\s+(\d+)-/i)||[])[1]||"",cd=p2[normP(nm)];return{nm,ld,cd,v:f.properties.voters||400,prog:(ldIdx[ld]||0)+(cdIdx[cd]||0)+.035*gauss(r)}});
  const inJur=(R,p)=>{switch(R.id){case"sea-d5":return p.cd===5;case"kc-d8":return p.cd===1;case"kc-d2":return p.cd===2;case"wa9":return p.cd===2;case"wa7":return p.cd!==2;case"ld43-sen":return p.ld==="43";case"ld37-h1":case"ld37-sen":return p.ld==="37";case"ld46-h":return p.ld==="46";case"wa3":case"wa4":return false;default:return true}};
  const truth={};RACES.forEach(R=>{if(R.kind!=="uncontested")truth[R.id]=Math.min(.93,Math.max(.07,R.prior.a+R.prior.sd*.8*gauss(r)))});
  const seaTotal=P.reduce((s,p)=>s+p.v,0)*.71;let tsBase=new Date("2026-11-03T20:15:00-08:00").getTime();
  // national truth: one shared polling error plus race noise
  const z0=2.5*gauss(r), nTruth={}, bias={};[...NAT.SENATE,...NAT.GOVS].forEach(d=>{nTruth[d.id]=d.m+z0+4*gauss(r);bias[d.id]=5*gauss(r)});
  const region=st=>/^(WA|OR|CA|NV|AK|HI)$/.test(st)?.42:/^(AZ|CO|ID|MT|NM|UT|WY)$/.test(st)?.72:/^(AL|AR|IL|IA|KS|LA|MN|MS|NE|ND|OK|SD|TN|TX|WI)$/.test(st)?.86:.92;
  const hTruthD=Math.round(229+z0*4), L=fracs.length;
  const closeAt=st=>/^(WA|OR|CA|NV|AK|HI)$/.test(st)?.85:/^(AZ|CO|ID|MT|NM|UT|WY)$/.test(st)?.55:/^(AL|AR|IL|IA|KS|LA|MN|MS|NE|ND|OK|SD|TN|TX|WI)$/.test(st)?.3:.1;
  // level 0 = 3 p.m. PT, 1 = King County's first count (8:15 p.m.), then one level per later update
  const natAt=level=>{const races={};let hp=0;[...NAT.SENATE,...NAT.GOVS].forEach(def=>{const c0=closeAt(def.st),reg=region(def.st);let fr;
      if(level<=c0)fr=0;else if(level<=1)fr=reg*Math.min(1,(level-c0)/(1-c0)*1.15);else fr=Math.min(.995,reg+(1-reg)*Math.min(1,(level-1)/(L-1.4)));fr=Math.min(fr,.995);
      if(!fr)return;const c=nTruth[def.id]+bias[def.id]*(1-fr);const tot=Math.round((800000+400000*Math.abs(Math.sin(def.st.charCodeAt(0)*7+def.st.charCodeAt(1))))*fr*3);
      const dv=Math.round(tot*(.5+c/200)),rv=tot-dv;let call="";const tm=nTruth[def.id];
      if((Math.abs(def.m)>15&&fr>.2)||(fr>.7&&Math.abs(c)>Math.max(5,18*(1-fr))&&Math.sign(c)===Math.sign(tm))||fr>.985)call=tm>0?(def.dp==="I"?"I":"D"):"R";
      races[def.id]={d:dv,r:rv,exp:Math.round(fr*100),call,ts:call?new Date(tsBase+(level-1)*(level<=1?5*3600e3:24*3600e3)).toISOString():null}});
    hp=level<=0?0:level<=1?.55*level:Math.min(.99,.55+.44*(level-1)/(L-1.4));
    return{races,house:{d:Math.round(hTruthD*hp),r:Math.round((435-hTruthD)*hp)}}};
  const drops=fracs.map((f,i)=>{
    const d={id:"sim"+i,ts:new Date(tsBase+(i?((i-1)*24+20)*3600e3:0)).toISOString(),label:i?`Update ${i+1}`:"Election night",source:"Simulated",totals:{},byLD:{},_pct:{},countyBallots:Math.round(seaTotal*f*2.8),countyLeft:Math.round(seaTotal*(1-f)*2.8*(1+.04*gauss(r)))};
    RACES.forEach(R=>{if(R.kind==="uncontested")return;const lean=R.lean==="a"?1:R.lean==="b"?-1:0, dir=lean||.5;
      let A=0,B=0,bal=0;const pc={},ld={};const late=-lean*.035*(1-f)/.44;
      P.forEach(p=>{if(!inJur(R,p))return;const sh=Math.min(.98,Math.max(.02,(R.priorSea?truth[R.id]+(R.priorSea.a-R.prior.a):truth[R.id])+dir*p.prog*1.3+late));const b=p.v*.71*f, v=b*R.uv, a=Math.round(v*sh), o=Math.round(v)-a;
        A+=a;B+=o;bal+=b;pc[p.nm]=[a,o];if(p.ld){const L=ld[p.ld]||(ld[p.ld]={a:0,b:0});L.a+=a;L.b+=o}});
      const sea={a:A,b:B,ballots:Math.round(bal)};let full=sea,kc=null;
      if(R.src==="state"){const T=(R.regs.full||500000)*.70*Math.min(1,f*1.02),vv=T*R.uv,sh=Math.min(.97,Math.max(.03,truth[R.id]+late));full={a:Math.round(vv*sh),b:Math.round(vv*(1-sh)),ballots:Math.round(T)};
        if(R.regs.kc){const Tk=R.regs.kc*.72*f,vk=Tk*R.uv,shk=Math.min(.97,Math.max(.03,(truth[R.id]+(sea.a/(sea.a+sea.b||1)))/2+late));kc={a:Math.round(vk*shk),b:Math.round(vk*(1-shk)),ballots:Math.round(Tk)}}}
      d.totals[R.id]={full,kc,sea:A+B?sea:null};d.byLD[R.id]=ld;d._pct[R.id]=pc});
    d._nat=natAt(i+1);
    return d});
  return{...JSON.parse(JSON.stringify(STATE)),_natAt:natAt,drops:[],precinct:{},_all:drops,_step:0,national:{races:{},house:{d:0,r:0},history:[]},posts:[{ts:drops[0].ts,title:"Rehearsal: first results are in",body:"These numbers are simulated. Use them to practice reading the national model, the Seattle projections and the maps."}],calls:{}};
}
function simStep(n){if(!SIM)return;SIM._step=Math.max(0,Math.min(SIM._all.length,SIM._step+n));SIM.drops=SIM._all.slice(0,SIM._step);SIM.precinct=SIM._step?SIM._all[SIM._step-1]._pct:{};
  const cur=SIM._step?SIM._all[SIM._step-1]._nat:{races:{},house:{d:0,r:0}};
  const hist=[];const pts=[[0,"15:00"],[.2,"16:00"],[.4,"17:00"],[.6,"18:00"],[.8,"19:00"]];
  if(SIM._step)pts.forEach(([lv,t])=>hist.push({ts:"2026-11-03T"+t+":00-08:00",...histPoint(NAT.simulate(SIM._natAt(lv),{K:1500}))}));
  for(let i=0;i<SIM._step;i++){hist.push({ts:SIM._all[i].ts,...histPoint(NAT.simulate(SIM._all[i]._nat,{K:1500}))})}
  SIM.national={races:cur.races,house:cur.house,history:hist};render()}
function histPoint(o){return{s:+o.senate.pD.toFixed(3),h:+o.house.pD.toFixed(3),g:+o.gov.pD.toFixed(3)}}

/* ============================== VIEWS ============================== */
function barHTML(race,m,big){
  const prior=m.status==="prior";let a,b;
  if(prior){a=m.mean;b=1-a}else{const t=m.last;a=t.a/(t.a+t.b);b=1-a}
  return`<div class="bar ${prior?"prior":""}" style="height:${big?18:12}px" role="img" aria-label="${esc(race.a.n)} ${pct(a)}, ${esc(race.b.n)} ${pct(b)}${prior?" (forecast)":""}"><i class="ba" style="width:${a*100}%"></i><i class="bb" style="width:${b*100}%"></i><span class="mid"></span></div>`;
}
function headScope(race){if(race.src!=="state"||hasScope(race,"full"))return"full";return hasScope(race,"kc")?"kc":"full"}
function scopeShare(race,scope){const ds=D().drops;for(let i=ds.length-1;i>=0;i--){const v=tally(ds[i],race,scope);if(v&&v.a+v.b>0)return v.a/(v.a+v.b)}return null}
function localScopeLine(race){if(race.src!=="state")return"";const sea=scopeShare(race,"sea"),kc=scopeShare(race,"kc");if(sea==null&&kc==null)return(race.g==="state"||race.g==="court")&&D().drops.length?`<div class="foot"><span>Seattle and King County splits appear as county results post.</span></div>`:"";
  return`<div class="foot scopes">${sea!=null?`<span>Seattle: <b class="num">${esc(race.a.n)} ${pct(sea,0)}</b></span>`:""}${kc!=null?`<span>King County: <b class="num">${esc(race.a.n)} ${pct(kc,0)}</b></span>`:""}</div>`}
function card(race){
  const hs=headScope(race),m=project(race,hs);
  if(race.kind==="uncontested")return`<a class="card" href="#race-${race.id}"><div class="head"><h3>${esc(race.short)}</h3>${chipFor(race,m)}</div><div class="opt"><span class="nm">${esc(race.a.n)} <small>${esc(race.a.s)}</small></span><span class="pc">Unopposed</span></div><p class="muted" style="font-size:.82rem">${esc(race.desc)}</p></a>`;
  const prior=m.status==="prior";const sa=prior?m.mean:m.s, lead=sa>=.5?"a":"b";
  const line=(k,share)=>`<div class="opt k${k} ${lead===k?"lead":""}"><span class="nm">${esc(race[k].n)}${race[k].s?` <small>${esc(race[k].s)}</small>`:""}</span><span class="pc">${pct(share)}</span></div>`;
  const foot=prior?`<span>Pre-count forecast · ${esc(race.a.n)} wins ${pct(m.pA,0)} of simulations</span>`:`<span class="num">${fmt(m.counted)} votes · ~${pct(m.share,0)} counted</span><span>Projected ${esc(race[m.mean>=.5?"a":"b"].n)} ${pct(Math.max(m.mean,1-m.mean))} · P ${pct(Math.max(m.pA,1-m.pA),0)}</span>`;
  return`<a class="card" href="#race-${race.id}"><div class="head"><h3>${esc(race.short)}</h3>${chipFor(race,m)}</div>${line("a",sa)}${line("b",1-sa)}${barHTML(race,m)}<div class="foot">${foot}</div>${hs==="kc"?`<div class="foot"><span>King County count; the statewide total appears when the state posts it.</span></div>`:localScopeLine(race)}</a>`;
}
function overview(){ /* Seattle & Washington window */
  const data=D(), drops=data.drops, last=drops[drops.length-1];
  const now=Date.now();
  const tl=SCHEDULE.map((s,i)=>{const t=new Date(s[0]).getTime(),nx=SCHEDULE[i+1]?new Date(SCHEDULE[i+1][0]).getTime():Infinity;return`<li class="${now>=nx?"done":now>=t?"now":""}"><time>${s[1]}</time><span>${s[2]}</span></li>`}).join("");
  const posts=(data.posts||[]).slice().sort((a,b)=>b.ts.localeCompare(a.ts)).slice(0,6).map(p=>`<article class="post"><time>${tstr(p.ts)}</time><h3>${esc(p.title)}</h3><p>${esc(p.body)}</p></article>`).join("")||`<p class="muted">No updates posted yet.</p>`;
  const groups=GROUPS.map(([g,label])=>`<section class="group"><header><h2>${label}</h2><span class="eyebrow">${RACES.filter(r=>r.g===g).length} contests</span></header><div class="grid">${RACES.filter(r=>r.g===g).map(card).join("")}</div></section>`).join("");
  return`<p class="crumbs"><a href="#">National</a> / Seattle &amp; Washington</p><h1 style="margin-top:.5rem">Seattle &amp; Washington</h1>
  <p class="lede">${drops.length?`Latest count: ${esc(last.label)}, posted ${tstr(last.ts)}. In a mail-ballot election, the first count is the earliest ballots, not a sample of all of them. Projections below estimate the ballots still uncounted.`:`Every contest on a Seattle ballot, plus Washington's statewide measures and its two most competitive House seats. Forecasts come from the August primary and public polling; on election night they switch to live projections that account for ballots not yet counted.`}</p>
  <div class="top"><div><span class="eyebrow">Live updates</span><div class="feed">${posts}</div></div><div><span class="eyebrow">Counting calendar</span><ol class="timeline">${tl}</ol></div></div>
  ${groups}`;
}
function fanChart(race,m){
  const W=640,H=260,L=40,Rr=14,T=14,B=30,w=W-L-Rr,h=H-T-B;
  if(m.status==="prior"||!m.series.length){
    // prior density
    const xs=d3.range(0,1.0001,.005), dens=xs.map(x=>Math.exp(-.5*((x-m.mean)/race.prior.sd)**2));const mx=Math.max(...dens);
    const X=x=>L+x*w, Y=y=>T+h-y/mx*h*.95;
    const pa=xs.filter(x=>x>=.5).map(x=>[X(x),Y(Math.exp(-.5*((x-m.mean)/race.prior.sd)**2))]), pb=xs.filter(x=>x<=.5).map(x=>[X(x),Y(Math.exp(-.5*((x-m.mean)/race.prior.sd)**2))]);
    const area=pts=>pts.length?`M${pts[0][0]},${T+h}L${pts.map(p=>p.join(",")).join("L")}L${pts[pts.length-1][0]},${T+h}Z`:"";
    return`<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Forecast distribution of ${esc(race.a.n)}'s vote share"><path d="${area(pb)}" fill="var(--b)" opacity=".55"/><path d="${area(pa)}" fill="var(--a)" opacity=".55"/>
    ${[0,.25,.5,.75,1].map(v=>`<line class="gl" x1="${X(v)}" x2="${X(v)}" y1="${T}" y2="${T+h}"/><text x="${X(v)}" y="${H-10}" text-anchor="middle">${v*100}%</text>`).join("")}
    <line class="half" x1="${X(.5)}" x2="${X(.5)}" y1="${T}" y2="${T+h}"/><text x="${L}" y="${T+10}" >${esc(race.a.n)} share →</text></svg>
    <div class="legend"><span><i style="background:var(--a)"></i>${esc(race.a.n)} wins</span><span><i style="background:var(--b)"></i>${esc(race.b.n)} wins</span><span>Area = forecast probability</span></div>`;
  }
  const total=m.N+m.R, X=f=>L+f*w;const ys=[...m.series.map(x=>x.t.a/(x.t.a+x.t.b)),m.lo,m.hi,.5];let y0=Math.min(...ys)-.04,y1=Math.max(...ys)+.04;y0=Math.max(0,Math.floor(y0*50)/50);y1=Math.min(1,Math.ceil(y1*50)/50);
  const Y=v=>T+h-(v-y0)/(y1-y0)*h;
  const pts=m.series.map(x=>{const n=x.t.a+x.t.b;return[X(n/total),Y(x.t.a/n)]});
  const lp=pts[pts.length-1];
  const ticks=d3.ticks(y0,y1,5);
  return`<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(race.a.n)}'s share as ballots are counted, with projected range for the remaining count">
  ${ticks.map(v=>`<line class="gl" x1="${L}" x2="${W-Rr}" y1="${Y(v)}" y2="${Y(v)}"/><text x="${L-6}" y="${Y(v)+4}" text-anchor="end">${Math.round(v*100)}%</text>`).join("")}
  ${[0,.25,.5,.75,1].map(f=>`<text x="${X(f)}" y="${H-10}" text-anchor="middle">${f*100}%</text>`).join("")}
  ${(.5>=y0&&.5<=y1)?`<line class="half" x1="${L}" x2="${W-Rr}" y1="${Y(.5)}" y2="${Y(.5)}"/>`:""}
  <path d="M${lp[0]},${lp[1]}L${X(1)},${Y(m.hi)}L${X(1)},${Y(m.lo)}Z" fill="var(--${m.mean>=.5?"a":"b"})" opacity=".18"/>
  <line x1="${lp[0]}" y1="${lp[1]}" x2="${X(1)}" y2="${Y(m.mean)}" stroke="var(--${m.mean>=.5?"a":"b"})" stroke-width="2" stroke-dasharray="5 4"/>
  <polyline points="${pts.map(p=>p.join(",")).join(" ")}" fill="none" stroke="var(--ink)" stroke-width="2.5"/>
  ${pts.map(p=>`<circle cx="${p[0]}" cy="${p[1]}" r="3.5" fill="var(--surface)" stroke="var(--ink)" stroke-width="2"/>`).join("")}
  <circle cx="${X(1)}" cy="${Y(m.mean)}" r="4.5" fill="var(--${m.mean>=.5?"a":"b"})"/>
  <text x="${L}" y="${T+10}">${esc(race.a.n)} share ↑</text><text x="${W-Rr}" y="${H-24}" text-anchor="end">share of projected final ballots counted →</text></svg>
  <div class="legend"><span><i style="background:var(--ink)"></i>Counted so far</span><span><i style="background:var(--${m.mean>=.5?"a":"b"});opacity:.4"></i>80% range for the final result</span><span>Dashed line: 50%</span></div>`;
}
function incChart(race,m){
  if(!m.inc||m.inc.length<1)return"";
  const W=640,H=180,L=40,Rr=10,T=12,B=30,w=W-L-Rr,h=H-T-B,n=m.inc.length,bw=Math.min(70,w/n*.7);
  const vals=m.inc.map(x=>x.share);let y0=Math.max(0,Math.floor((Math.min(...vals,.5)-.05)*20)/20),y1=Math.min(1,Math.ceil((Math.max(...vals,.5)+.05)*20)/20);
  const Y=v=>T+h-(v-y0)/(y1-y0)*h;
  return`<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(race.a.n)}'s share of the ballots added in each update">
  ${d3.ticks(y0,y1,4).map(v=>`<line class="gl" x1="${L}" x2="${W-Rr}" y1="${Y(v)}" y2="${Y(v)}"/><text x="${L-6}" y="${Y(v)+4}" text-anchor="end">${Math.round(v*100)}%</text>`).join("")}
  ${m.inc.map((x,i)=>{const cx=L+(i+.5)*w/n;const up=x.share>=.5;return`<rect x="${cx-bw/2}" y="${Math.min(Y(x.share),Y(.5))}" width="${bw}" height="${Math.max(1,Math.abs(Y(x.share)-Y(.5)))}" fill="var(--${up?"a":"b"})"/><text x="${cx}" y="${H-10}" text-anchor="middle">${esc((x.label||"").slice(0,14))}</text>`}).join("")}
  <line class="half" x1="${L}" x2="${W-Rr}" y1="${Y(.5)}" y2="${Y(.5)}"/></svg>`;
}
function scopePanel(race){if(race.src!=="state")return"";const rows=[["full",race.g==="fed"?"Whole district":"Statewide"],["kc","King County"],["sea","Seattle"]].map(([sc,lab])=>{const ds=D().drops;let v=null;for(let i=ds.length-1;i>=0&&!v;i--){const t=tally(ds[i],race,sc);if(t&&t.a+t.b>0)v=t}if(!v)return"";const m=project(race,sc);return`<tr><td>${lab}</td><td class="r">${pct(v.a/(v.a+v.b))}</td><td class="r">${fmt(v.a+v.b)}</td><td class="r">${m.status==="prior"?"–":pct(m.mean)}</td></tr>`}).join("");
  return rows?`<div class="panel"><h3>Statewide, county and city</h3><div class="tbl-wrap"><table><thead><tr><th></th><th class="r">${esc(race.a.n)}</th><th class="r">Votes</th><th class="r">Projected</th></tr></thead><tbody>${rows}</tbody></table></div><p class="note" style="margin-top:.4rem">Each line runs the projection on its own count and ballots left.</p></div>`:""}
function raceView(id){
  const race=RACE[id];if(!race)return`<p>That contest isn't on this page. <a href="#">Back to all results</a></p>`;
  const hs=headScope(race),m=project(race,hs), call=D().calls[id];
  const grp=GROUPS.find(g=>g[0]===race.g)[1];
  if(race.kind==="uncontested")return`<p class="crumbs"><a href="#seattle">Seattle &amp; Washington</a> / ${grp}</p><h1 style="margin-top:.5rem">${esc(race.title)}</h1><p class="lede">${esc(race.desc)} With no opponent on the ballot, no projection is needed.</p>`;
  const prior=m.status==="prior";
  const sa=prior?m.mean:m.s;
  const side=k=>{const share=k==="a"?sa:1-sa;const votes=prior?null:m.last[k];return`<div class="side s${k}"><span class="who">${esc(race[k].n)}</span><div class="muted" style="font-size:.8rem">${esc(race[k].s||"")}</div><b>${pct(share)}</b><span class="num muted">${prior?"forecast":fmt(votes)+" votes"}</span></div>`};
  const trail=m.pA>=.5?"b":"a";
  const kv=prior?[
    ["Chance "+race.a.n+" wins",pct(m.pA,0)],["Chance "+race.b.n+" wins",pct(1-m.pA,0)],[race.a.n+" forecast share",pct(m.mean)],["80% range",`${pct(m.lo,0)}–${pct(m.hi,0)}`]
  ]:[
    ["Chance "+race.a.n+" wins",pct(m.pA,1)],["Projected final ("+race.a.n+")",pct(m.mean)],["80% range",`${pct(m.lo,1)}–${pct(m.hi,1)}`],
    ["Votes counted",fmt(m.N)],["Votes left (est.)",fmt(m.R)],["Counted share (est.)",pct(m.share,0)],
    [race[trail].n+" needs of the rest",m.need==null?"–":pct(trail==="a"?m.need:1-m.need)],
    ["Late-ballot shift (est.)",`${pp(m.delta)} pts ±${(m.deltaSd*100).toFixed(1)}`],["New-ballot share so far",m.inc.length>1?pct(m.inc[m.inc.length-1].share):"after 2nd update"]];
  const trailNeed=!prior&&m.need!=null?(trail==="a"?m.need:1-m.need):null;
  const needLine=trailNeed==null?"":trailNeed>1?`${esc(race[trail].n)} cannot catch up even by winning every remaining vote, if our estimate of ballots left is right.`:`${esc(race[trail].n)} would need ${pct(trailNeed)} of the estimated ${fmt(m.R)} votes still to be counted. ${esc(race[trail].n)}'s share of the most recent batch was ${m.inc.length?pct(trail==="a"?m.inc[m.inc.length-1].share:1-m.inc[m.inc.length-1].share):"–"}.`;
  const tbl=prior?"":`<div class="tbl-wrap"><table><thead><tr><th>Update</th><th>Posted</th><th class="r">${esc(race.a.n)}</th><th class="r">${esc(race.b.n)}</th><th class="r">${esc(race.a.n)} share</th><th class="r">New-ballot share</th></tr></thead><tbody>${m.series.map((x,i)=>{const inc=m.inc[i];return`<tr><td>${esc(x.d.label)}</td><td>${tstr(x.d.ts)}</td><td class="r">${fmt(x.t.a)}</td><td class="r">${fmt(x.t.b)}</td><td class="r">${pct(x.t.a/(x.t.a+x.t.b))}</td><td class="r">${inc?pct(inc.share):"–"}</td></tr>`}).join("")}</tbody></table></div>`;
  return`<p class="crumbs"><a href="#seattle">Seattle &amp; Washington</a> / ${grp}</p>
  <div class="row" style="justify-content:space-between;margin-top:.5rem"><h1>${esc(race.title)}</h1>${chipFor(race,m)}</div>
  <p class="lede">${esc(race.desc)}${race.src==="state"?(hs==="kc"?" The statewide count isn't available yet, so the figures below are King County's.":" Headline figures are the full contest from the Secretary of State; the King County and Seattle splits come from King County Elections."):""}</p>
  <div class="detail"><div>
   <div class="panel"><div class="big">${side("a")}${side("b")}</div>${barHTML(race,m,true)}
    ${call&&call.winner?`<p class="msg" style="margin-top:.75rem"><b>Desk call:</b> ${esc(race[call.winner].n)}, ${tstr(call.ts)}. ${esc(call.note||"")}</p>`:""}
    <dl class="kv">${kv.map(([k,v])=>`<div><dt>${esc(k)}</dt><dd>${v}</dd></div>`).join("")}</dl>
    ${needLine?`<p class="note" style="margin-top:.75rem">${needLine}</p>`:""}</div>
   <div class="panel"><h3>${prior?"Pre-count forecast":"Count so far and projected finish"}</h3><p class="note" style="margin:.25rem 0 .5rem">${prior?"Each shaded area is the share of simulated outcomes that end with that candidate or side ahead.":"The black line follows the running count. The shaded wedge is where 80% of simulated finishes land once the remaining ballots are added."}</p>${fanChart(race,m)}</div>
   ${!prior&&m.inc.length?`<div class="panel"><h3>Who the newly counted ballots favored</h3><p class="note" style="margin:.25rem 0 .5rem">Share of each batch's new votes for ${esc(race.a.n)}. Bars above the line favored ${esc(race.a.n)}; below, ${esc(race.b.n)}. A trend across batches is the late-ballot shift.</p>${incChart(race,m)}</div>`:""}
   ${tbl?`<div class="panel"><h3>Every update</h3>${tbl}</div>`:""}
  </div><div>
   <div class="panel"><h3>Where the forecast starts</h3><p class="note" style="margin-top:.35rem">${esc(race.prior.note)}</p>
    ${race.primary?`<dl class="kv"><div><dt>Primary: ${esc(race.a.n)}</dt><dd>${pct(race.primary.a)}</dd></div><div><dt>Primary: ${esc(race.b.n)}</dt><dd>${pct(race.primary.b)}</dd></div></dl><p class="note" style="margin-top:.4rem">Source: ${esc(race.primary.src)}</p>`:""}
    <dl class="kv"><div><dt>Prior mean, ${esc(race.a.n)}</dt><dd>${pct(race.prior.a,0)}</dd></div><div><dt>Prior std. dev.</dt><dd>${(race.prior.sd*100).toFixed(0)} pts</dd></div><div><dt>Expected late shift</dt><dd>${race.lean?"Toward "+esc(race[race.lean].n):"None assumed"}</dd></div></dl></div>
   ${!prior?`<div class="panel"><h3>Ballots left</h3><p class="note" style="margin-top:.35rem">${esc(m.remSrc)}. About ${pct(m.uv,0)} of ballots in this race record a vote in it.</p><dl class="kv"><div><dt>Ballots counted</dt><dd>${fmt(m.ballots)}</dd></div><div><dt>Ballots left (est.)</dt><dd>${fmt(m.remB)}</dd></div></dl></div>`:""}
   ${scopePanel(race)}
   ${race.src==="kc"||hasScope(race,"sea")?`<div class="panel"><h3>Map</h3><div style="margin-top:.5rem">${mapBox(id,{small:true,w:320,h:470,highlight:id==="sea-d5"?5:null})}</div><p class="note" style="margin-top:.4rem"><a href="#map-${id}">Open the full map</a></p></div>`:""}
   <div class="panel"><h3>Share this race</h3><p class="note" style="margin-top:.35rem">Link straight to this page: add <code class="num">#race-${race.id}</code> to the page address.</p></div>
  </div></div>`;
}
function latestLD(id){const ds=D().drops;for(let i=ds.length-1;i>=0;i--){const x=ds[i].byLD&&ds[i].byLD[id];if(x&&Object.keys(x).length)return x}return null}
function shade(m){const t=Math.min(1,Math.abs(m)/.4);const k=m>=0?"a":"b";return`color-mix(in srgb, var(--${k}) ${Math.round(18+t*82)}%, var(--surface))`}
/* ============================== MAP ============================== */
const HOODS=[["Ballard",-122.3833,47.6774],["Beacon Hill",-122.3009,47.552],["Capitol Hill",-122.3063,47.6315],["Central Area",-122.2981,47.6069],["Delridge",-122.3588,47.5351],["Downtown",-122.3297,47.6062],["Lake City",-122.2941,47.7141],["Magnolia",-122.4024,47.6517],["Georgetown",-122.3268,47.5289],["Queen Anne",-122.36,47.6373],["Rainier Valley",-122.2697,47.5166],["West Seattle",-122.3915,47.5697],["Greenwood",-122.3636,47.707],["Wallingford",-122.3418,47.6682],["U District",-122.3103,47.6593],["Wedgwood",-122.2855,47.6777]];
let BASE=null, PREC=null, PREC_SRC="2021", P2CD=null;
function topoFeatures(topo,name){
  const T=topo.transform;
  const arcs=topo.arcs.map(a=>{if(!T)return a.map(p=>p.slice());let x=0,y=0;return a.map(p=>{x+=p[0];y+=p[1];return[x*T.scale[0]+T.translate[0],y*T.scale[1]+T.translate[1]]})});
  const arc=i=>i<0?arcs[~i].slice().reverse():arcs[i];
  const line=idx=>{const pts=[];idx.forEach((i,k)=>{const a=arc(i);for(let j=k?1:0;j<a.length;j++)pts.push(a[j])});return pts};
  const geom=g=>{switch(g.type){case"Polygon":return{type:"Polygon",coordinates:g.arcs.map(line)};case"MultiPolygon":return{type:"MultiPolygon",coordinates:g.arcs.map(p=>p.map(line))};case"LineString":return{type:"LineString",coordinates:line(g.arcs)};case"MultiLineString":return{type:"MultiLineString",coordinates:g.arcs.map(line)};default:return null}};
  return topo.objects[name].geometries.filter(g=>g.type).map(g=>({type:"Feature",properties:g.properties||{},geometry:geom(g)}));
}
function loadBase(){
  if(BASE)return BASE;
  try{const topo=GEO_TOPO;if(!topo)throw new Error("map not loaded");
    BASE={council:topoFeatures(topo,"council").sort((a,b)=>a.properties.District-b.properties.District),city:topoFeatures(topo,"city"),around:topoFeatures(topo,"around"),roads:topoFeatures(topo,"roads")};
    if(!PREC){PREC=topoFeatures(topo,"prec").map(f=>({...f,properties:{name:f.properties.NAME,voters:f.properties.SUM_VOTERS}}));PREC_SRC="2021"}
  }catch(e){BASE={council:[],city:[],around:[],roads:[]};PREC=PREC||[]}
  return BASE;
}
const normP=s=>String(s||"").trim().toUpperCase().replace(/\s+/g," ");
function precToCouncil(){
  if(P2CD)return P2CD;loadBase();P2CD={};
  PREC.forEach(f=>{const c=d3.geoCentroid(f);const d=BASE.council.find(cd=>d3.geoContains(cd,c));P2CD[normP(f.properties.name)]=d?d.properties.District:null});
  return P2CD;
}
async function loadUploadedPrecincts(){
  if(PREC_SRC==="uploaded")return;
  try{const res=await fetch("data/precincts.geojson",{cache:"no-store"});if(!res.ok)return;const j=await res.json();
    const props=(j.features&&j.features[0]&&j.features[0].properties)||{};const key=["NAME","Name","name","PRECINCT","votdst_name"].find(k=>k in props&&j.features.some(f=>/^SEA\s/i.test(String(f.properties[k]||""))))||Object.keys(props).find(k=>j.features.some(f=>/^SEA\s/i.test(String(f.properties[k]||""))));
    if(!key)throw new Error("no property holds precinct names like SEA 43-1234");
    const feats=j.features.filter(f=>/^SEA\s/i.test(String(f.properties[key]||"")));
    PREC=feats.map(f=>({type:"Feature",geometry:f.geometry,properties:{name:f.properties[key],voters:f.properties.SUM_VOTERS||null}}));PREC_SRC="uploaded";P2CD=null;render();
  }catch(e){GEO_ERR="Couldn't use data/precincts.geojson ("+e.message+"). Showing King County's 2021 boundaries."}
}
/* results for one race keyed by normalized precinct name -> [a,b] */
function precResults(raceId){const src=(D().precinct||{})[raceId]||{};const o={};for(const[k,v]of Object.entries(src))o[normP(k)]=v;return o}
function districtAgg(raceId){
  const res=precResults(raceId),map=precToCouncil(),agg={};
  for(const[k,v]of Object.entries(res)){const d=map[k];if(d==null)continue;const A=agg[d]||(agg[d]={a:0,b:0,n:0});A.a+=v[0];A.b+=v[1];A.n++}
  return agg;
}
const MAPVIEW={mode:"precinct",k:null};
function mapSVG(raceId,opts){
  opts=opts||{};loadBase();const race=RACE[raceId];
  const W=opts.w||560,H=opts.h||820;
  const proj=d3.geoMercator().fitExtent([[8,8],[W-8,H-8]],{type:"FeatureCollection",features:BASE.city});
  const path=d3.geoPath(proj);
  const res=precResults(raceId), hasRes=Object.keys(res).length>0, mode=opts.mode||"precinct";
  const agg=mode==="district"&&hasRes?districtAgg(raceId):null;
  let matched=0;
  const maxV=d3.max(PREC,f=>f.properties.voters||0)||1;
  const precPaths=PREC.map(f=>{const nm=normP(f.properties.name),v=res[nm];let fill,cls="p";
    if(hasRes){if(v&&v[0]+v[1]>0){matched++;fill=agg?"none":shade((v[0]-v[1])/(v[0]+v[1]))}else{fill="var(--land)";cls+=" off"}}
    else fill=f.properties.voters?`color-mix(in srgb, var(--a) ${Math.round(8+70*Math.sqrt(f.properties.voters/maxV))}%, var(--land))`:"var(--land)";
    return`<path class="${cls}" d="${path(f)}" fill="${fill}" data-p="${esc(f.properties.name)}" vector-effect="non-scaling-stroke"/>`}).join("");
  const cdFill=agg?BASE.council.map(f=>{const A=agg[f.properties.District];const fill=A&&A.a+A.b?shade((A.a-A.b)/(A.a+A.b)):"var(--land)";return`<path class="cdfill" d="${path(f)}" fill="${fill}" data-cd="${f.properties.District}"/>`}).join(""):"";
  const hi=opts.highlight;
  const cd=BASE.council.map(f=>`<path class="cd ${hi===f.properties.District?"hi":""}" d="${path(f)}" vector-effect="non-scaling-stroke"/>`).join("");
  const cdLab=BASE.council.map(f=>{const c=proj(d3.geoCentroid(f));const A=agg&&agg[f.properties.District];return`<g class="cdl" data-x="${c[0].toFixed(1)}" data-y="${c[1].toFixed(1)}" transform="translate(${c[0].toFixed(1)},${c[1].toFixed(1)})"><circle r="11"/><text dy="4" text-anchor="middle">${f.properties.District}</text>${A?`<text class="sub" dy="24" text-anchor="middle">${pct(Math.max(A.a,A.b)/(A.a+A.b),0)}</text>`:""}</g>`}).join("");
  const roads=BASE.roads.map(f=>`<path class="rd" d="${path(f)}" vector-effect="non-scaling-stroke"/>`).join("");
  const hoods=opts.small?"":HOODS.map(h=>{const p=proj([h[1],h[2]]);return`<text class="hood" x="${p[0].toFixed(1)}" y="${p[1].toFixed(1)}" text-anchor="middle">${esc(h[0])}</text>`}).join("");
  const around=BASE.around.map(f=>`<path class="around" d="${path(f)}"/>`).join("");
  const city=BASE.city.map(f=>`<path class="cityland" d="${path(f)}"/>`).join("");
  const label=hasRes?`${esc(race.a.n)} vs. ${esc(race.b.n)}, ${mode==="district"?"by council district":"by precinct"}`:"Registered voters by precinct";
  const svg=`<svg class="smap" viewBox="0 0 ${W} ${H}" role="img" aria-label="Map of Seattle: ${label}"><rect width="${W}" height="${H}" class="water"/><g class="zoomg">${around}${city}<g class="precs">${precPaths}</g>${cdFill}${roads}${cd}${hoods}${cdLab}</g></svg>`;
  const legend=hasRes?`<div class="maplegend"><span>${esc(race.b.n)}</span><div class="scale">${[-.4,-.3,-.2,-.1,-.02,.02,.1,.2,.3,.4].map(m=>`<i style="background:${shade(m)}"></i>`).join("")}</div><span>${esc(race.a.n)}</span></div><p class="note">Shade shows the margin; stronger color is a wider lead, up to 40 points.${mode==="precinct"?` ${fmt(matched)} of ${fmt(PREC.length)} Seattle precincts have results${PREC_SRC==="2021"?" that match King County's 2021 precinct boundaries":""}.`:""}</p>`
    :`<div class="maplegend"><span>Fewer voters</span><div class="scale">${[.1,.25,.4,.55,.7,.85,1].map(t=>`<i style="background:color-mix(in srgb, var(--a) ${Math.round(8+70*Math.sqrt(t))}%, var(--land))"></i>`).join("")}</div><span>More</span></div><p class="note">No results yet. Precincts are shaded by registered voters (King County, 2021 boundaries). Numbered circles are the City Council districts adopted in 2022.</p>`;
  return{svg,legend,matched,hasRes};
}
function mapBox(raceId,opts){
  const m=mapSVG(raceId,opts);
  return`<div class="mapbox ${opts&&opts.small?"small":""}" data-race="${raceId}">${m.svg}${opts&&opts.small?"":`<div class="zoombtns"><button class="btn" data-z="in" aria-label="Zoom in">+</button><button class="btn" data-z="out" aria-label="Zoom out">−</button><button class="btn" data-z="reset">Reset</button></div>`}<div class="tip" hidden></div></div>${m.legend}`;
}
function wireMaps(){
  document.querySelectorAll(".mapbox").forEach(box=>{
    const svg=d3.select(box).select("svg"), g=svg.select(".zoomg"), raceId=box.dataset.race, race=RACE[raceId], res=precResults(raceId), tip=box.querySelector(".tip");
    const small=box.classList.contains("small");
    const z=d3.zoom().filter(e=>e.type==="wheel"?(e.ctrlKey||e.metaKey):e.type.startsWith("touch")?e.touches.length>1:!e.button).scaleExtent([1,10]).translateExtent([[0,0],[+svg.attr("viewBox").split(" ")[2],+svg.attr("viewBox").split(" ")[3]]]).on("zoom",e=>{const k=e.transform.k;g.attr("transform",e.transform);g.selectAll(".hood").style("font-size",(11/k)+"px");g.selectAll(".cdl").attr("transform",function(){return`translate(${this.dataset.x},${this.dataset.y}) scale(${1/k})`})});
    if(!small){svg.call(z);if(MAPVIEW.k)svg.call(z.transform,MAPVIEW.k);
      box.querySelectorAll("[data-z]").forEach(b=>b.addEventListener("click",()=>{const a=b.dataset.z;if(a==="reset")svg.transition().duration(300).call(z.transform,d3.zoomIdentity);else svg.transition().duration(250).call(z.scaleBy,a==="in"?1.8:1/1.8)}));
      z.on("end",e=>{MAPVIEW.k=e.transform})}
    const show=(ev,html)=>{tip.innerHTML=html;tip.hidden=false;const r=box.getBoundingClientRect();let x=ev.clientX-r.left+12,y=ev.clientY-r.top+12;if(x>r.width-200)x=Math.max(4,x-212);tip.style.left=x+"px";tip.style.top=y+"px"};
    box.querySelectorAll("path.p").forEach(p=>{const nm=p.dataset.p;const h=ev=>{const v=res[normP(nm)];const vt=PREC.find(f=>f.properties.name===nm);
      show(ev,v?`<b>${esc(nm)}</b><div>${esc(race.a.n)} <span class="num">${pct(v[0]/(v[0]+v[1]))}</span></div><div>${esc(race.b.n)} <span class="num">${pct(v[1]/(v[0]+v[1]))}</span></div><div class="muted num">${fmt(v[0]+v[1])} votes</div>`:`<b>${esc(nm)}</b><div class="muted">${Object.keys(res).length?"No results matched":"Registered voters: "+fmt(vt&&vt.properties.voters)}</div>`)};
      p.addEventListener("mousemove",h);p.addEventListener("click",h);p.addEventListener("mouseleave",()=>tip.hidden=true)});
    box.querySelectorAll("path.cdfill").forEach(p=>{const d=p.dataset.cd;const h=ev=>{const A=districtAgg(raceId)[d];show(ev,A?`<b>Council District ${d}</b><div>${esc(race.a.n)} <span class="num">${pct(A.a/(A.a+A.b))}</span></div><div>${esc(race.b.n)} <span class="num">${pct(A.b/(A.a+A.b))}</span></div><div class="muted num">${fmt(A.a+A.b)} votes in ${A.n} precincts</div>`:`<b>Council District ${d}</b><div class="muted">No results</div>`)};p.addEventListener("mousemove",h);p.addEventListener("click",h);p.addEventListener("mouseleave",()=>tip.hidden=true)});
  });
}
function mapView(){
  const race=RACE[mapRace];loadBase();
  const opts=RACES.filter(r=>r.kind!=="uncontested").map(r=>`<option value="${r.id}" ${r.id===mapRace?"selected":""}>${esc(r.short)}</option>`).join("");
  const res=precResults(mapRace),hasRes=Object.keys(res).length>0;
  const agg=hasRes?districtAgg(mapRace):{};
  const cdRows=hasRes?[1,2,3,4,5,6,7].filter(d=>agg[d]).map(d=>{const A=agg[d],t=A.a+A.b;return`<tr><td>District ${d}</td><td class="r">${pct(A.a/t)}</td><td class="r">${pct(A.b/t)}</td><td class="r">${fmt(t)}</td></tr>`}).join(""):"";
  const ld=latestLD(mapRace);
  const ldRows=ld?Object.keys(ld).sort().map(k=>{const v=ld[k],t=v.a+v.b;return`<tr><td>LD ${k}</td><td class="r">${pct(v.a/t)}</td><td class="r">${pct(v.b/t)}</td><td class="r">${fmt(t)}</td></tr>`}).join(""):"";
  const th=`<thead><tr><th></th><th class="r">${esc(race.a.n)}</th><th class="r">${esc(race.b.n)}</th><th class="r">Votes</th></tr></thead>`;
  return`<h1>Seattle map</h1><p class="lede">${hasRes?`Precinct results for ${esc(race.short)} from the latest count. Use + and − (or pinch, or Ctrl-scroll) to zoom, drag to pan, and tap a precinct for its numbers.`:"Results appear here precinct by precinct once King County posts its count. Until then, the map shows where Seattle's registered voters live."}</p>
  <div class="mapgrid"><div class="panel mappanel">${mapBox(mapRace,{mode:MAPVIEW.mode,highlight:mapRace==="sea-d5"?5:null})}</div>
  <div><div class="panel"><div class="fields"><label class="field"><span>Contest</span><select id="mapRace">${opts}</select></label><label class="field"><span>Show</span><select id="mapMode"><option value="precinct" ${MAPVIEW.mode==="precinct"?"selected":""}>Precincts</option><option value="district" ${MAPVIEW.mode==="district"?"selected":""}>Council districts</option></select></label></div>
   <p class="note" style="margin-top:.6rem"><a href="#race-${mapRace}">Open the ${esc(race.short)} race page</a></p></div>
   ${cdRows?`<div class="panel"><h3>By council district</h3><p class="note" style="margin:.25rem 0 .5rem">Precincts are assigned to the district containing their center.</p><div class="tbl-wrap"><table>${th}<tbody>${cdRows}</tbody></table></div></div>`:""}
   ${ldRows?`<div class="panel"><h3>By legislative district</h3><div class="tbl-wrap"><table>${th}<tbody>${ldRows}</tbody></table></div></div>`:""}
   <div class="panel"><h3>About this map</h3><p class="note" style="margin-top:.35rem">Council district lines are the map Seattle adopted in 2022, built from census blocks. Freeways and shoreline come from OpenStreetMap and census data. ${PREC_SRC==="uploaded"?"Precinct boundaries are the current King County file from data/precincts.geojson.":"Precinct boundaries are King County's November 2021 file; precincts renamed since then show in gray until current boundaries are added to the site as data/precincts.geojson."}</p>${GEO_ERR?`<p class="msg err" style="margin-top:.5rem">${esc(GEO_ERR)}</p>`:""}</div>
  </div></div>`;
}

function methodView(){
  return`<div class="method"><h1>How this works</h1><p class="lede">Every number on this page can be traced to a source and a formula described here. Nothing is hidden in a server.</p>
  <h2 style="margin-top:1.5rem">National forecast</h2>
  <h3>Before the count</h3><p>Each Senate and governor race starts from the final polling average (FiftyPlusOne where it publishes one, otherwise Poliwave's projection, otherwise an estimate from race ratings, labeled on each race page). The model simulates ${fmt(NAT.PARAMS.K)} elections. In each one, every race gets its own error of about ${NAT.PARAMS.raceSd} points on the margin, and all races share one nationwide polling error of about ${NAT.PARAMS.natSd} points. That shared error is what makes a good night for one party show up in many states at once, and it is why the chamber odds are less certain than the individual races suggest.</p>
  <h3>House</h3><p>We do not model 435 districts individually; several states redrew maps mid-decade and district-level polling is thin. Instead the model uses the Cook Political Report's final ratings (204 Solid or Likely Democratic, 18 Lean D, 18 Toss-up, 17 Lean R, 178 Solid or Likely R), assigns each category an expected margin, and applies the same nationwide error used for the Senate. Seats the desk records as called are removed from the safest ratings first; districts the desk lists individually are modeled one by one.</p>
  <h3>During the count</h3><p>For each race the page reads vote counts, the share of the vote reported and race calls from civicAPI's free results feed every five minutes; the desk can override any of them. The counted votes are fixed. The uncounted share is drawn from the pre-election average, pulled toward the current count in proportion to how much is in, with extra uncertainty because early and late ballots often lean differently (mail first in some states, Election Day votes first in others). The share of expected vote is itself treated as uncertain by about 8 percent.</p>
  <h3>Learning from the count</h3><p>As races report, the model compares counted margins with the polling averages. The weighted average miss, weighted by the square of the share counted so that early, lopsided counts barely matter, is applied as a correction to every race not yet called, and the nationwide uncertainty narrows as more votes come in. Race pages show the current estimate.</p>
  <div class="formula">final margin = f × counted margin + (1 − f) × remaining margin
remaining margin ~ Normal(prior + national shift + k·f·(counted − prior), ${NAT.PARAMS.remSd} pts)
national shift ~ Normal(estimated polling miss, ${NAT.PARAMS.natSd} pts × shrinkage)</div>
  <h3>Control</h3><p>Democrats control the Senate with 51 seats, because Vice President JD Vance breaks ties; Republicans need 50. Independents who win (Dan Osborn in Nebraska, Seth Bodnar in Montana, Brian Bengs in South Dakota, Todd Achilles in Idaho) are counted on their own. When neither party reaches control without them, the page reports that the independents decide it. For governors, a majority is 26 of 50.</p>
  <h3>Calls</h3><p>Race calls come from civicAPI's feed, and the desk can add or correct calls. The model's labels ("Leaning" at 90 percent, "Model: projected" at 99.5 percent) inform coverage but are not calls.</p>
  <h2 style="margin-top:2rem">Seattle and Washington</h2><h3>Why the first count misleads in Washington</h3><p>Every Washington voter gets a mail ballot. King County's first count on election night covers ballots that arrived before Election Day. Ballots dropped off on Election Day, or mailed late with a valid postmark, are counted over the following days. In Seattle those late ballots come disproportionately from younger and renter voters, and they have tended to move results toward more progressive candidates and positions. Reporting the first count as a near-final margin is the most common error in local election coverage here.</p>
  <h3>Before the count: forecasts</h3><p>Each contest starts from a prior: an estimate of the final vote share and its uncertainty, built from the August primary, published polling, or comparable past measures. Each race page shows the prior and the reasoning behind it. The chance of winning is the share of a normal distribution with that mean and spread that lands above 50%.</p>
  <h3>After the count: projections</h3><p>For each contest we estimate three things and simulate 8,000 possible finishes.</p>
  <ol><li><b>Ballots still to count.</b> When an editor enters King County's reported ballots left to count, we prorate it by this contest's share of ballots counted so far. Otherwise we use projected turnout (editable, default 72%) times registered voters, taken from the results file when it includes them.</li>
  <li><b>How many of those ballots vote in this contest.</b> The ratio of votes in the contest to ballots counted so far, so down-ballot drop-off is measured, not assumed.</li>
  <li><b>How the remaining ballots will split.</b> The current share plus a late-ballot shift. The shift starts at 3 points toward the side that late Seattle ballots usually favor (0 where we have no reason to expect one), with a 2.5-point standard deviation. Each new update tells us how new ballots differ from the running total, and the estimate is updated by precision weighting, so after two or three updates the observed pattern dominates the starting guess.</li></ol>
  <div class="formula">final share = (votes_A + R × x) / (N + R)
R ~ LogNormal(estimated remaining votes, 10–60% uncertainty)
x ~ Normal(current share + shift, √(shift_sd² + 1.2²) points)</div>
  <p>The desk reports the median, the 10th to 90th percentile range, the share of simulations each side wins, and the share of remaining votes the trailing side would need.</p>
  <h3>Calls</h3><p>The model labels a contest "Too early" while fewer than 30% of expected ballots are counted, "Too close" below 90% confidence, "Leaning" at 90%, and "Model: projected" at 99.5%. Only an editor can mark a contest "Called." The model informs that decision; it does not make it.</p>
  <h3>Data</h3><p>Results come from King County Elections' published results files. A scheduled job checks them every five minutes, records each new count as an update with its time and source, and republishes this page; readers' browsers pick up the change within a minute. The importer reads the county's precinct-level file (columns Precinct, Race, LEG, CounterType, SumOfCount) or a simple Race, Candidate, Votes summary. Seattle subtotals for statewide contests use precincts whose names begin with SEA. Every update is kept with its timestamp and source, and the full dataset can be downloaded below.</p>
  <h3>Known limits</h3><ul><li>The built-in precinct boundaries are King County's November 2021 file. Precincts renamed since then appear gray on the map until current boundaries are added to the site; their votes still count in every total.</li><li>Registered-voter counts are approximate until a results file that includes them is imported.</li><li>Statewide measures and Supreme Court races are projected statewide from the Secretary of State's results file, with Seattle and King County splits from King County Elections.</li><li>Priors marked "no polling found" are judgment calls by the desk and say so.</li></ul>
  <div class="row" style="margin-top:1.25rem">${DL?`<button class="btn" id="dlJson">Download all results (JSON)</button><button class="btn" id="dlCsv">Download totals (CSV)</button>`:`<span class="note">Downloads are available when viewing on claude.ai.</span>`}</div></div>`;
}
/* ============================== SHELL ============================== */
function route(){return(location.hash||"").replace(/^#/,"")}
function render(){
  const r=route(), data=D(), last=data.drops[data.drops.length-1];
  const sim=natSim();const nraces=Object.values(sim.races).filter(x=>x.def.chamber!=="H");
  const ncalled=nraces.filter(x=>x.call).length, anyNat=nraces.some(x=>x.has||x.call);
  const live=anyNat||last;
  const nav=[["","National"],["senate","Senate"],["house","House"],["governors","Governors"],["seattle","Seattle & WA"],["map","Seattle map"],["method","Method"]];
  const isNatRace=r.startsWith("race-")&&/^race-[SGH]-/.test(r);
  const cur=isNatRace?(r[5]==="S"?"senate":r[5]==="G"?"governors":"house"):r.startsWith("race-")?"seattle":r.startsWith("map")?"map":r;
  if(r.startsWith("map-")&&RACE[r.slice(4)])mapRace=r.slice(4);
  let body;
  if(isNatRace)body=natRace(r.slice(5));
  else if(r.startsWith("race-"))body=raceView(r.slice(5));
  else if(r==="senate")body=natChamberPage("S");else if(r==="governors")body=natChamberPage("G");else if(r==="house")body=natChamberPage("H");
  else if(r==="seattle")body=overview();
  else if(r==="map"||r.startsWith("map-"))body=mapView();else if(r==="method")body=methodView();
  else body=natHome();
  const now=new Date();
  document.getElementById("app").innerHTML=`
  <header class="mast"><div class="wrap"><a class="brand" href="#">${esc(data.masthead||STATE.masthead||"Results Desk")}<small>Election 2026 · Nov. 3</small></a>
   <span class="livechip"><span class="dot ${live?"on":""}"></span>${SIM?"Rehearsal":live?"Live":"Pre-election"}</span>
   <nav class="nav" aria-label="Sections">${nav.map(([h,l])=>`<a href="#${h}" ${cur===h?'aria-current="page"':""}>${esc(l)}</a>`).join("")}</nav></div></header>
  ${SIM?`<div class="simbar"><div class="wrap"><b>Rehearsal</b><span>Simulated numbers for practice. Step ${SIM._step} of ${SIM._all.length}.</span><span class="row"><button class="btn sim" id="simPrev">Previous</button><button class="btn sim" id="simNext">Next update</button><button class="btn sim" id="simEnd">End rehearsal</button></span></div></div>`:""}
  <div class="ticker"><div class="wrap">
   ${[["S","Senate",sim.senate.pD,sim.senate.pR],["H","House",sim.house.pD,sim.house.pR],["G","Governors",sim.gov.pD,sim.gov.pR]].map(([k,l,pd,pr])=>`<a class="tk" href="#${k==="S"?"senate":k==="H"?"house":"governors"}"><span class="tk-l">${l}</span><span class="tk-d num">D ${pct(pd,0)}</span><span class="tk-r num">R ${pct(pr,0)}</span></a>`).join("")}
   <span class="tk"><span class="tk-l">Races called</span><span class="num">${ncalled} of ${nraces.length}</span></span>
   <span class="tk"><span class="tk-l">King County</span><span class="num">${last?esc(last.label):"No count yet"}</span></span>
  </div></div>
  <main class="wrap">${body}</main>
  <footer><div class="wrap"><div class="row" style="justify-content:space-between"><span>National results: <a href="https://civicapi.org" target="_blank" rel="noopener">civicAPI</a>, with corrections by our desk. Seattle and Washington: King County Elections and the Washington Secretary of State. <a href="#method">How the forecasts work</a>.</span>${!SIM?`<button class="btn sim" id="simStart">Run an election-night rehearsal</button>`:""}</div><p class="muted" style="margin-top:.4rem">${data.updated?"Data updated "+tstr(data.updated)+". ":""}<span id="checked">${checkedText()}</span></p></div></footer>`;
  wire(r);
}
function wire(r){
  const on=(id,ev,fn)=>{const e=document.getElementById(id);if(e)e.addEventListener(ev,fn)};
  on("simStart","click",()=>{SIM=makeSim();simStep(1);window.scrollTo(0,0)});
  on("simNext","click",()=>simStep(1));on("simPrev","click",()=>simStep(-1));on("simEnd","click",()=>{SIM=null;render()});
  on("mapRace","change",e=>{mapRace=e.target.value;MAPVIEW.k=null;location.hash="map-"+mapRace});
  on("mapMode","change",e=>{MAPVIEW.mode=e.target.value;render()});
  if(document.querySelector(".mapbox"))wireMaps();
  wireUSMap();
  if(r==="method"){on("dlJson","click",()=>download("seattle-results.json",JSON.stringify(STATE,null,1),"application/json"));on("dlCsv","click",()=>download("seattle-results-totals.csv",totalsCSV(),"text/csv"))}
}
function download(filename,data,type){const u=URL.createObjectURL(new Blob([data],{type:type||"text/plain"}));const a=document.createElement("a");a.href=u;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),2000)}
function totalsCSV(){const L=["update,posted,contest,option_a,votes_a,option_b,votes_b,ballots,scope"];STATE.drops.forEach(d=>RACES.forEach(R=>{const t=d.totals&&d.totals[R.id];if(!t)return;const v=scopeOf(t,"full");if(!v)return;L.push([d.label,d.ts,R.title,R.a.n,v.a,R.b?R.b.n:"",v.b,v.ballots||"",R.src==="state"?"Full contest (statewide or district)":"Full contest (King County)"].map(x=>`"${String(x??"").replace(/"/g,'""')}"`).join(","))}));return L.join("\n")}
/* ============================== LIVE ============================== */
function checkedText(){return FETCH_ERR?"Can't reach the results feed; retrying.":LAST_CHECK?"Checked "+LAST_CHECK.toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit",timeZone:"America/Los_Angeles"})+".":""}
async function refresh(first){
  try{const r=await fetch("data/state.json?t="+Date.now(),{cache:"no-store"});if(!r.ok)throw new Error(r.status);const s=await r.json();LAST_CHECK=new Date();FETCH_ERR=null;
    if(first||s.updated!==STATE.updated){STATE=Object.assign({calls:{},posts:[],aliases:{},precinct:{},national:{races:{},house:{d:0,r:0},history:[]},settings:{turnout:.72,turnoutSd:.04}},s);if(!first&&!SIM)toast("New results posted "+tstr(s.updated));render();return}
  }catch(e){FETCH_ERR=e}
  const c=document.getElementById("checked");if(c)c.textContent=checkedText();
}
window.addEventListener("hashchange",()=>{render();window.scrollTo(0,0)});
render();
const INLINE=id=>{try{const e=document.getElementById(id);return e?JSON.parse(e.textContent):null}catch(e){return null}};
(async()=>{
  const inl=INLINE("inline-state");
  if(inl){STATE=Object.assign(STATE,inl);LAST_CHECK=new Date();GEO_TOPO=INLINE("inline-geo");US_TOPO=INLINE("inline-us");render();return}
  await refresh(true);
  try{const g=await fetch("data/seattle-map.topo.json");GEO_TOPO=await g.json();BASE=null;PREC=null;P2CD=null}catch(e){GEO_ERR="The base map didn't load."}
  try{const u=await fetch("data/us-states.topo.json");US_TOPO=await u.json()}catch(e){}
  render();
  loadUploadedPrecincts();
  setInterval(()=>{if(document.visibilityState==="visible")refresh(false)},60000);
  document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible")refresh(false)});
})();
