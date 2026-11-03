"use strict";
/* National races and the national model. No DOM: shared by the page and scripts/fetch.mjs.
   Margins are Democrat (or Democratic-aligned independent) minus Republican, in points.
   Priors: final polling averages (FiftyPlusOne where it publishes one, otherwise Poliwave's projection),
   or a rating-based margin where neither publishes a number. */
(function(){
const ST={AL:"Alabama",AK:"Alaska",AZ:"Arizona",AR:"Arkansas",CA:"California",CO:"Colorado",CT:"Connecticut",DE:"Delaware",DC:"District of Columbia",FL:"Florida",GA:"Georgia",HI:"Hawaii",ID:"Idaho",IL:"Illinois",IN:"Indiana",IA:"Iowa",KS:"Kansas",KY:"Kentucky",LA:"Louisiana",ME:"Maine",MD:"Maryland",MA:"Massachusetts",MI:"Michigan",MN:"Minnesota",MS:"Mississippi",MO:"Missouri",MT:"Montana",NE:"Nebraska",NV:"Nevada",NH:"New Hampshire",NJ:"New Jersey",NM:"New Mexico",NY:"New York",NC:"North Carolina",ND:"North Dakota",OH:"Ohio",OK:"Oklahoma",OR:"Oregon",PA:"Pennsylvania",RI:"Rhode Island",SC:"South Carolina",SD:"South Dakota",TN:"Tennessee",TX:"Texas",UT:"Utah",VT:"Vermont",VA:"Virginia",WA:"Washington",WV:"West Virginia",WI:"Wisconsin",WY:"Wyoming"};
const P50="FiftyPlusOne polling average", PW="Poliwave projection", RT="Rating-based estimate (no published average)";
// [state, dem-side name, dem-side party, rep name, seat held by, prior margin, source, note]
const SEN_RAW=[
 ["AL","Everett Wess","D","Barry Moore","R",-14.9,PW,"Open seat (Tuberville running for governor)"],
 ["AK","Mary Peltola","D","Dan Sullivan","R",2.4,P50,"Ranked-choice general election; final round may take days"],
 ["AR","Hallie Shoffner","D","Tom Cotton","R",-17.0,PW,""],
 ["CO","John Hickenlooper","D","Mark Baisley","D",21.2,PW,""],
 ["DE","Chris Coons","D","Michael Katz","D",32.8,PW,""],
 ["FL","Angie Nixon","D","Ashley Moody","R",-6.1,P50,"Special election"],
 ["GA","Jon Ossoff","D","Mike Collins","D",9.6,P50,"A runoff is required if no one tops 50%"],
 ["ID","Todd Achilles","I","Jim Risch","R",-13.0,PW,"Independent; no Democrat on the ballot"],
 ["IL","Juliana Stratton","D","Don Tracy","D",18.4,PW,"Open seat (Durbin retiring)"],
 ["IA","Josh Turek","D","Ashley Hinson","R",0.7,P50,"Open seat (Ernst retiring)"],
 ["KS","Adam Hamilton","D","Roger Marshall","R",4.5,P50,""],
 ["KY","Charles Booker","D","Andy Barr","R",-14.2,PW,"Open seat (McConnell retiring)"],
 ["LA","Jamie Davis","D","Julia Letlow","R",-9.8,PW,"Cassidy lost renomination"],
 ["ME","Troy Jackson","D","Susan Collins","R",4.7,P50,"Ranked-choice ballot"],
 ["MA","Ed Markey","D","John Deaton","D",34.5,PW,""],
 ["MI","Abdul El-Sayed","D","Mike Rogers","D",5.4,P50,"Open seat (Peters retiring)"],
 ["MN","Peggy Flanagan","D","Michele Tafoya","D",6.2,P50,"Open seat (Smith retiring)"],
 ["MS","Scott Colom","D","Cindy Hyde-Smith","R",-5.0,PW,""],
 ["MT","Seth Bodnar","I","Kurt Alme","R",-7.9,P50,"Independent backed by Jon Tester; Democrat Alani Bankhead also on the ballot"],
 ["NE","Dan Osborn","I","Pete Ricketts","R",-1.9,P50,"Independent; no Democrat on the ballot"],
 ["NH","Chris Pappas","D","John E. Sununu","D",8.8,P50,"Open seat (Shaheen retiring)"],
 ["NJ","Cory Booker","D","Justin Murphy","D",26.3,PW,""],
 ["NM","Ben Ray Luján","D","Larry Marker","D",20.8,PW,""],
 ["NC","Roy Cooper","D","Michael Whatley","R",11.6,P50,"Open seat (Tillis retiring)"],
 ["OH","Sherrod Brown","D","Jon Husted","R",2.9,P50,"Special election"],
 ["OK","N'Kiyla Thomas","D","Kevin Hern","R",-20.2,PW,"Open seat"],
 ["OR","Jeff Merkley","D","David Brock Smith","D",22.4,PW,""],
 ["RI","Jack Reed","D","Raymond McKay","D",28.5,PW,""],
 ["SC","Annie Andrews","D","Darline Graham","R",0.0,P50,"Open seat (Lindsey Graham lost renomination)"],
 ["SD","Brian Bengs","I","Mike Rounds","R",-10.0,P50,"Independent; no Democrat on the ballot"],
 ["TN","Marquita Bradshaw","D","Bill Hagerty","R",-19.6,PW,""],
 ["TX","James Talarico","D","Ken Paxton","R",3.7,P50,"Open seat (Cornyn lost renomination)"],
 ["VA","Mark Warner","D","Bert Mizusawa","D",23.6,PW,""],
 ["WV","Rachel Fetty Anderson","D","Shelley Moore Capito","R",-29.5,PW,""],
 ["WY","James Byrd","D","Harriet Hageman","R",-30.8,PW,"Open seat (Lummis retiring)"],
];
const GOV_RAW=[
 ["AL","Doug Jones","D","Tommy Tuberville","R",-20,RT,"Open seat"],
 ["AK","Jonathan Kreiss-Tomkins","D","Bernadette Wilson","R",0,RT,"Four-way ranked-choice race with two Democrats and two Republicans; open seat"],
 ["AZ","Katie Hobbs","D","Andy Biggs","D",7.1,P50,""],
 ["AR","Fredrick Love","D","Sarah Huckabee Sanders","R",-25,RT,""],
 ["CA","Xavier Becerra","D","Steve Hilton","D",23.9,P50,"Open seat"],
 ["CO","Phil Weiser","D","Victor Marx","D",18,RT,"Open seat"],
 ["CT","Ned Lamont","D","Ryan Fazio","D",16.1,P50,""],
 ["FL","David Jolly","D","Byron Donalds","R",-4.4,P50,"Open seat"],
 ["GA","Keisha Lance Bottoms","D","Rick Jackson","R",0.3,P50,"Open seat; runoff if no one tops 50%"],
 ["HI","Josh Green","D","Gary Cordery","D",25,RT,""],
 ["ID","Terri Pickens","D","Brad Little","R",-28,RT,""],
 ["IL","JB Pritzker","D","Darren Bailey","D",15,RT,""],
 ["IA","Rob Sand","D","Zach Lahn","R",7.7,P50,"Open seat"],
 ["KS","Cindy Holscher","D","Ty Masterson","D",0.1,P50,"Open seat"],
 ["ME","Hannah Pingree","D","Robert Charles","D",10.6,P50,"Open seat; independent Rick Bennett also running"],
 ["MD","Wes Moore","D","Dan Cox","D",22,RT,""],
 ["MA","Maura Healey","D","Mike Minogue","D",25,RT,""],
 ["MI","Jocelyn Benson","D","John James","D",8.6,P50,"Open seat"],
 ["MN","Amy Klobuchar","D","Lisa Demuth","D",11.7,P50,"Open seat"],
 ["NE","Lynne Walz","D","Jim Pillen","R",-6.3,P50,""],
 ["NV","Aaron Ford","D","Joe Lombardo","R",0.6,P50,""],
 ["NH","Cinde Warmington","D","Kelly Ayotte","R",-5.6,P50,""],
 ["NM","Deb Haaland","D","Gregg Hull","D",12,RT,"Open seat"],
 ["NY","Kathy Hochul","D","Bruce Blakeman","D",12.3,P50,""],
 ["OH","Amy Acton","D","Vivek Ramaswamy","R",4.4,P50,"Open seat"],
 ["OK","Cyndi Munson","D","Mike Mazzei","R",-22,RT,"Open seat"],
 ["OR","Tina Kotek","D","Christine Drazan","D",6,RT,""],
 ["PA","Josh Shapiro","D","Stacy Garrity","D",24.1,P50,""],
 ["RI","Helena Foulkes","D","Aaron Guckian","D",18,RT,"Open seat"],
 ["SC","Jermaine Johnson","D","Alan Wilson","R",-18,RT,"Open seat"],
 ["SD","Dan Ahlers","D","Larry Rhoden","R",-25,RT,""],
 ["TN","Jerri Green","D","Marsha Blackburn","R",-22,RT,"Open seat"],
 ["TX","Gina Hinojosa","D","Greg Abbott","R",-1.5,P50,""],
 ["VT","Amanda Janoo","D","Phil Scott","R",-20,RT,""],
 ["WI","David Crowley","D","Tom Tiffany","D",4.7,P50,"Open seat"],
 ["WY","Kenneth Casner","D","Eric Barlow","R",-30,RT,"Open seat"],
];
const mk=(chamber)=>r=>({id:chamber+"-"+r[0],chamber,st:r[0],state:ST[r[0]],d:r[1],dp:r[2],r:r[3],held:r[4],m:r[5],src:r[6],note:r[7]});
const SENATE=SEN_RAW.map(mk("S")), GOVS=GOV_RAW.map(mk("G"));
const CHAMBERS={
  S:{name:"Senate",seats:100,notUp:{D:34,R:31},notUpNote:"Democrats hold 32 seats not on the ballot and two independents who caucus with them (Angus King, Bernie Sanders); Republicans hold 31. Vice President JD Vance breaks ties, so Democrats need 51 seats for control and Republicans need 50."},
  G:{name:"Governors",seats:50,notUp:{D:6,R:8},notUpNote:"Fourteen governors are not on the ballot: six Democrats (DE, KY, NJ, NC, VA, WA) and eight Republicans (IN, LA, MS, MO, MT, ND, UT, WV)."},
  H:{name:"House",seats:435,need:218}
};
// House: Cook Political Report final ratings (seat counts), the model's margin for each category.
const HOUSE_CATS=[["sd","Solid/Likely D",204,16],["ld","Lean D",18,5],["tu","Toss-up",18,0],["lr","Lean R",17,-5],["sr","Solid/Likely R",178,-16]];
const PARAMS={raceSd:5.0,natSd:3.0,houseSd:6.0,remSd:7.0,expSd:.08,remK:.5,shrink:2,K:5000};

function rng(seed){let a=seed>>>0;return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
function gauss(r){let u=0,v=0;while(!u)u=r();while(!v)v=r();return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v)}
const num=x=>{if(x==null||x==="")return null;const n=+String(x).replace(/[,%\s]/g,"");return isFinite(n)?n:null};

/* Normalize desk inputs: {raceId:{d,r,o,exp,call,ts,note,label,dn,rn,rating}} plus HOUSE totals. */
function readInputs(nat){
  const races={};let house={d:0,r:0};
  for(const [id,v] of Object.entries((nat&&nat.races)||{})){
    const call=String(v.call||"").trim().toUpperCase().replace(/^DEM.*/,"D").replace(/^REP.*/,"R").replace(/^IND.*/,"I");
    races[id]={d:num(v.d),r:num(v.r),o:num(v.o),exp:num(v.exp),call:/^[DRI]$/.test(call)?call:null,ts:v.ts||null,note:v.note||"",label:v.label||"",dn:v.dn||"",rn:v.rn||"",rating:String(v.rating||"").toLowerCase()};
  }
  if(nat&&nat.house){house={d:num(nat.house.d)||0,r:num(nat.house.r)||0}}
  return{races,house};
}
/* One race's state given inputs: counted fraction, current margin. */
function raceState(def,inp){
  const v=inp||{};const tot=(v.d||0)+(v.r||0);
  const has=tot>0;
  const f=has?Math.min(.999,Math.max(.001,(v.exp!=null?v.exp:50)/100)):0;
  return{has,f,c:has?100*((v.d||0)-(v.r||0))/tot:null,call:v.call||null,expMissing:has&&v.exp==null,votes:tot,inp:v};
}
function houseWatch(inputs){
  const cats=Object.fromEntries(HOUSE_CATS.map(c=>[c[0],c[3]]));
  return Object.entries(inputs.races).filter(([id])=>/^H-/.test(id)).map(([id,v])=>({id,chamber:"H",st:id.split("-")[1]||"",state:ST[id.split("-")[1]]||"",label:v.label||id.slice(2),d:v.dn||"Democrat",dp:"D",r:v.rn||"Republican",held:null,rating:cats[v.rating]!=null?v.rating:"tu",m:cats[v.rating]!=null?cats[v.rating]:0,src:"House rating ("+((HOUSE_CATS.find(c=>c[0]===v.rating)||HOUSE_CATS[2])[1])+")",note:v.note||""}));
}

/* The simulation. Returns per-race and per-chamber summaries. Deterministic for a given input. */
function simulate(nat,opts){
  opts=opts||{};const K=opts.K||PARAMS.K;
  const inputs=readInputs(nat);
  const watch=houseWatch(inputs);
  const all=[...SENATE,...GOVS,...watch];
  const S=all.map(def=>({def,...raceState(def,inputs.races[def.id])}));
  // National polling error, estimated from races with substantial counts (weight f^2), shrunk toward 0.
  let W=0,WR=0;S.forEach(x=>{if(x.has&&!x.call&&x.def.chamber!=="H"){const w=x.f*x.f;W+=w;WR+=w*(x.c-x.def.m)}});
  const delta=WR/(W+PARAMS.shrink), natSd=PARAMS.natSd*Math.sqrt(PARAMS.shrink/(W+PARAMS.shrink));
  // House pool: remove called seats (listed races by their rating; bulk calls from safest first).
  const pool=Object.fromEntries(HOUSE_CATS.map(c=>[c[0],c[2]]));let calledH={D:0,R:0};
  watch.forEach(w=>{const st=S.find(x=>x.def.id===w.id);if(st.call){calledH[st.call==="R"?"R":"D"]++;pool[w.rating]=Math.max(0,pool[w.rating]-1)}else pool[w.rating]=Math.max(0,pool[w.rating]-1)});
  const extra={D:Math.max(0,inputs.house.d-calledH.D),R:Math.max(0,inputs.house.r-calledH.R)};
  const take=(order,n)=>{for(const k of order){const t=Math.min(pool[k],n);pool[k]-=t;n-=t;if(!n)break}};
  take(["sd","ld","tu","lr","sr"],extra.D);take(["sr","lr","tu","ld","sd"],extra.R);
  const houseCalled={D:Math.max(inputs.house.d,calledH.D),R:Math.max(inputs.house.r,calledH.R)};
  const r=rng(opts.seed||(1234567+Math.round(W*1000)+S.reduce((a,x)=>a+(x.call?x.def.id.length*7:0)+(x.has?Math.round(x.c*10):0),0)));
  const per=S.map(()=>({w:0,margins:new Float32Array(K),bins:new Int32Array(41)}));
  const sen=new Int16Array(K),senI=new Int16Array(K),gov=new Int16Array(K),house=new Int16Array(K);
  const catList=HOUSE_CATS.filter(c=>pool[c[0]]>0);
  for(let k=0;k<K;k++){
    const z=delta+natSd*gauss(r);
    let sD=0,sI=0,gD=0,hD=0;
    for(let i=0;i<S.length;i++){
      const x=S[i];let m;
      if(x.call){m=x.call==="R"?-1:1}
      else if(x.has){const f=Math.min(.999,Math.max(.01,x.f*(1+PARAMS.expSd*gauss(r))));const prior=x.def.m+z;const muRem=prior+PARAMS.remK*f*(x.c-prior);m=f*x.c+(1-f)*(muRem+PARAMS.remSd*gauss(r))}
      else m=x.def.m+z+PARAMS.raceSd*gauss(r);
      per[i].margins[k]=x.call?NaN:m;if(!x.call)per[i].bins[Math.max(0,Math.min(40,Math.round(m/2)+20))]++;
      const dWin=m>0;if(dWin)per[i].w++;
      if(x.def.chamber==="S"&&dWin){if(x.def.dp==="I")sI++;else sD++}
      else if(x.def.chamber==="G"&&dWin)gD++;
      else if(x.def.chamber==="H"&&dWin)hD++;
    }
    for(const c of catList){const n=pool[c[0]];for(let j=0;j<n;j++)if(c[3]+z+PARAMS.houseSd*gauss(r)>0)hD++}
    sen[k]=sD;senI[k]=sI;gov[k]=gD;house[k]=hD;
  }
  const races={};
  S.forEach((x,i)=>{const ms=Array.from(per[i].margins).filter(v=>!isNaN(v)).sort((a,b)=>a-b);const q=p=>ms.length?ms[Math.floor(p*(ms.length-1))]:null;
    races[x.def.id]={bins:Array.from(per[i].bins),def:x.def,pD:x.call?(x.call==="R"?0:1):per[i].w/K,call:x.call,has:x.has,f:x.f,c:x.c,votes:x.votes,expMissing:x.expMissing,inp:x.inp,med:q(.5),lo:q(.1),hi:q(.9),
      status:x.call?"called":(()=>{const p=per[i].w/K,pm=Math.max(p,1-p);if(!x.has)return"forecast";if(x.f<.25)return"early";return pm>=.995?"proj":pm>=.9?"lean":"close"})()}});
  const nS=CHAMBERS.S.notUp,nG=CHAMBERS.G.notUp,dist=(arr,base)=>{const h={};arr.forEach(v=>{h[v+base]=(h[v+base]||0)+1});return h};
  let pSD=0,pSR=0;for(let k=0;k<K;k++){const D=nS.D+sen[k],R=100-D-senI[k];if(D>=51)pSD++;else if(R>=50)pSR++}
  let pGD=0,pGR=0;for(let k=0;k<K;k++){const D=nG.D+gov[k],R=50-D;if(D>=26)pGD++;else if(R>=26)pGR++}
  let pHD=0;const hTot=new Int16Array(K);for(let k=0;k<K;k++){hTot[k]=house[k]+extra.D;if(hTot[k]>=218)pHD++}
  const med=a=>{const s=Array.from(a).sort((x,y)=>x-y);return s[Math.floor(s.length/2)]};
  const calledS={D:0,R:0,I:0},calledG={D:0,R:0};S.forEach(x=>{if(x.call){if(x.def.chamber==="S")calledS[x.call]++;if(x.def.chamber==="G")calledG[x.call==="R"?"R":"D"]++}});
  return{races,delta,natSd,W,
    senate:{pD:pSD/K,pR:pSR/K,pPivot:1-(pSD+pSR)/K,medD:nS.D+med(sen),medI:med(senI),distD:dist(sen,nS.D),called:calledS,notUp:nS,
      senI:Array.from(senI)},
    gov:{pD:pGD/K,pR:pGR/K,pTie:1-(pGD+pGR)/K,medD:nG.D+med(gov),dist:dist(gov,nG.D),called:calledG,notUp:nG},
    house:{pD:pHD/K,pR:1-pHD/K,medD:med(hTot),dist:dist(hTot,0),called:houseCalled,pool,watch:watch.map(w=>w.id)},
    K};
}
const NAT={ST,SENATE,GOVS,CHAMBERS,HOUSE_CATS,PARAMS,simulate,readInputs};
if(typeof globalThis!=="undefined")globalThis.NAT=NAT;
})();
