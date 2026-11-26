/* Planeador de Capacidad y Espacios — Facultad de IA e Ingenierías, Universidad de Caldas.
   Aplicación estática sin dependencias. Toda la lógica corre en el navegador sobre data.js. */
(function(){
'use strict';
const D=window.DATA, S=D.sess;
const SEM={'2025-1':['2025-02-03','2025-06-13'],'2025-2':['2025-08-11','2025-12-12']};
const T0=360, NS=32, ND=6, GRID=ND*NS;            // 6:00–22:00 en medias horas, lunes a sábado
const UD=5, U0=2, U1=30;                           // franja de referencia: L–V 7:00–21:00 (70 h)
const DAYN=['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'], DAYS=['Lun','Mar','Mié','Jue','Vie','Sáb'];
const FAC=new Set(['G8E','G8F']);
const EDIF={ADMIN:'Administrativo',BICENTE:'Bicentenario',PALOGRANDE:'Palogrande',CENTRAL:'Sede Central',AGROP:'Agropecuarias',PARQUE:'Edificio del Parque',SALUD:'Ciencias para la Salud',BELARTE:'Bellas Artes',LABORA:'Laboratorios',BIOFILO:'Biófilo',DORADA:'La Dorada'};
const ROOMS=D.rooms, ROOM=new Map(ROOMS.map(r=>[r.id,r]));
const $=s=>document.querySelector(s), esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const pct=(v,d=0)=>isFinite(v)?(v*100).toFixed(d)+'%':'—', num=v=>Math.round(v).toLocaleString('es-CO');
const hhmm=m=>{const h=Math.floor(m/60),mi=m%60;return h+':'+String(mi).padStart(2,'0')};
const slotT=s=>hhmm(T0+s*30);
const day=t=>Date.parse(t)/864e5;

// Peso de cada sesión: fracción del semestre regular en la que está activa (0..1).
const W=S.map(s=>{const [a,b]=SEM[s[0]].map(day);const o=Math.min(day(s[6]),b)-Math.max(day(s[5]),a)+1;return Math.max(0,Math.min(1,o/(b-a+1)))});
const state={ciclo:'2025-2',edif:'*',depto:'*'};
const deptoOk=(d,f)=>f==='*'||(f==='FAC'?FAC.has(d):d===f);
const deptoName=f=>f==='*'?'toda la Universidad':f==='FAC'?'la Facultad de IA e Ingenierías':D.depts[f];

const cache=new Map();
/** Ocupación por aula: o = fracción del semestre ocupada por franja, st = estudiantes·peso. */
function occupancy(ciclo,depto){
  const k=ciclo+'|'+depto; if(cache.has(k)) return cache.get(k);
  const m=new Map(ROOMS.map(r=>[r.id,{o:new Float32Array(GRID),st:new Float32Array(GRID),list:[]}]));
  S.forEach((s,i)=>{
    if(s[0]!==ciclo||s[1]==null||s[2]==null||!W[i]||!deptoOk(s[8],depto)) return;
    const e=m.get(s[1]); e.list.push(i);
    const a=Math.max(0,Math.floor((s[2]-T0)/30)), b=Math.min(NS,Math.ceil((s[3]-T0)/30));
    for(let d=0;d<ND;d++) if(s[4][d]==='1') for(let t=a;t<b;t++){e.o[d*NS+t]+=W[i]; e.st[d*NS+t]+=W[i]*s[9];}
  });
  cache.set(k,m); return m;
}
function roomStats(r,e){
  let u=0,h=0,so=0,st=0;
  for(let d=0;d<ND;d++) for(let t=0;t<NS;t++){const v=Math.min(1,e.o[d*NS+t]); h+=v; so+=e.o[d*NS+t]; st+=e.st[d*NS+t]; if(d<UD&&t>=U0&&t<U1) u+=v;}
  const over=e.list.filter(i=>r.cap>0&&S[i][9]>r.cap).length;
  return {util:u/(UD*(U1-U0)), hrs:h/2, fill:r.cap&&so?st/(so*r.cap):NaN, avg:so?st/so:NaN, n:e.list.length, over};
}
const rooms=(edif=state.edif)=>ROOMS.filter(r=>edif==='*'||r.edif===edif);
function summary(ciclo,edif,depto){
  const occ=occupancy(ciclo,depto), rs=rooms(edif); let u=0,st=0,sc=0,seats=0,hrs=0;
  const heat=new Float32Array(GRID);
  rs.forEach(r=>{const e=occ.get(r.id), x=roomStats(r,e); u+=x.util; hrs+=x.hrs; seats+=r.cap;
    for(let i=0;i<GRID;i++){heat[i]+=Math.min(1,e.o[i]); st+=e.st[i]; sc+=e.o[i]*r.cap;}});
  for(let i=0;i<GRID;i++) heat[i]/=rs.length||1;
  return {n:rs.length,seats,util:u/(rs.length||1),fill:sc?st/sc:NaN,hrs,heat};
}
const heatColor=v=>{const a=[236,241,248],b=[11,46,92],t=Math.min(1,v/0.85);return 'rgb('+a.map((x,i)=>Math.round(x+(b[i]-x)*t)).join(',')+')'};

/* ---------- utilidades de interfaz ---------- */
const tip=$('#tip');
document.addEventListener('mousemove',e=>{const t=e.target.closest&&e.target.closest('[data-tip]');
  if(!t){tip.hidden=true;return} tip.hidden=false; tip.textContent=t.dataset.tip;
  tip.style.left=Math.min(innerWidth-290,e.clientX+12)+'px'; tip.style.top=(e.clientY+14)+'px';});
function barCell(v,cls=''){return `<div class="cellbar"><span>${pct(v)}</span><div class="bar ${cls}"><i style="width:${Math.min(100,v*100||0)}%"></i></div></div>`}
function csv(name,head,rows){
  const q=v=>'"'+String(v??'').replace(/"/g,'""')+'"';
  const blob=new Blob(['﻿'+[head,...rows].map(r=>r.map(q).join(';')).join('\n')],{type:'text/csv;charset=utf-8'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=name; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),500);
}
const utilCls=v=>v>=.7?'b':v>=.45?'w':v<.2?'':'g';
const edifN=c=>EDIF[c]||c;
function openModal(html){$('#modalBody').innerHTML=html;$('#modal').hidden=false}
$('#modalX').onclick=()=>$('#modal').hidden=true;
$('#modal').onclick=e=>{if(e.target.id==='modal')$('#modal').hidden=true};
document.addEventListener('keydown',e=>{if(e.key==='Escape')$('#modal').hidden=true});

/* ---------- PANORAMA ---------- */
function renderPanorama(){
  const {ciclo,edif,depto}=state, sm=summary(ciclo,edif,depto), all=S.filter(s=>s[0]===ciclo&&deptoOk(s[8],depto));
  const sinAula=all.filter(s=>s[1]==null).length, conAula=all.filter(s=>s[1]!=null&&(edif==='*'||ROOM.get(s[1]).edif===edif)).length;
  // hora pico y valle (L–V)
  const hr=[]; for(let h=0;h<16;h++){let v=0;for(let d=0;d<5;d++)v+=(sm.heat[d*NS+h*2]+sm.heat[d*NS+h*2+1])/2;hr.push(v/5)}
  const pk=hr.indexOf(Math.max(...hr));
  let h=`<p class="intro">Lectura de la <b>capacidad instalada</b> y su uso real en ${esc(ciclo)}, para ${edif==='*'?'todos los edificios':'<b>'+esc(edifN(edif))+'</b>'} y la demanda de <b>${esc(deptoName(depto))}</b>. La ocupación se mide sobre la franja lunes a viernes de 7:00 a 21:00 (70 horas semanales por aula).</p>
  <div class="grid kpis">
    <div class="card kpi"><div class="l">Aulas programadas</div><div class="v">${sm.n}</div><div class="n">${num(sm.seats)} sillas instaladas</div></div>
    <div class="card kpi"><div class="l">Ocupación horaria</div><div class="v">${pct(sm.util)}</div><div class="n">${num(sm.hrs)} horas-aula por semana</div></div>
    <div class="card kpi"><div class="l">Llenado de sillas</div><div class="v">${pct(sm.fill)}</div><div class="n">inscritos sobre capacidad, cuando el aula está en uso</div></div>
    <div class="card kpi"><div class="l">Hora pico</div><div class="v">${6+pk}:00</div><div class="n">${pct(hr[pk])} de las aulas ocupadas</div></div>
    <div class="card kpi"><div class="l">Sesiones</div><div class="v">${num(conAula)}</div><div class="n">${num(sinAula)} más no requieren aula</div></div>
  </div>
  <div class="grid g2 mt">
    <div class="card"><h3>¿Cuándo están ocupadas las aulas?</h3><p class="sub">Porcentaje de aulas en uso por día y hora (semana tipo del semestre).</p>
      <div class="heat" style="grid-template-columns:44px repeat(16,minmax(0,1fr))"><div></div>${Array.from({length:16},(_,i)=>`<div class="h">${6+i}</div>`).join('')}
      ${DAYS.map((dn,d)=>`<div class="d">${dn}</div>`+Array.from({length:16},(_,i)=>{const v=(sm.heat[d*NS+i*2]+sm.heat[d*NS+i*2+1])/2;
        return `<div class="c ${v<.38?'lt':''}" style="background:${heatColor(v)}" data-tip="${DAYN[d]} ${6+i}:00–${7+i}:00 · ${pct(v)} de las aulas ocupadas">${Math.round(v*100)}</div>`}).join('')).join('')}</div>
      <div class="legend"><span>menos uso</span>${[0,.2,.4,.6,.85].map(v=>`<i style="background:${heatColor(v)}"></i>`).join('')}<span>más uso</span></div>
    </div>
    <div class="card"><h3>Ocupación por edificio</h3><p class="sub">Ocupación horaria promedio de sus aulas y llenado de sillas. Haga clic para filtrar.</p>
      <div class="hbars">${Object.keys(EDIF).map(c=>({c,x:summary(ciclo,c,depto)})).filter(o=>o.x.n).sort((a,b)=>b.x.util-a.x.util).map(o=>
        `<a href="#" data-edif="${o.c}" style="color:inherit;text-decoration:none"><b>${esc(edifN(o.c))}</b> <span class="muted">· ${o.x.n} aula${o.x.n===1?'':'s'}</span></a>
         <div class="bar ${utilCls(o.x.util)}" data-tip="Ocupación ${pct(o.x.util,1)} · llenado ${pct(o.x.fill)} · ${num(o.x.seats)} sillas"><i style="width:${o.x.util*100}%"></i></div><span>${pct(o.x.util)}</span>`).join('')}</div>
    </div>
  </div>
  <div class="grid g2 mt">
    <div class="card"><h3>¿El tamaño de las aulas corresponde al de los grupos?</h3><p class="sub">Distribución de las aulas por capacidad frente a las horas de clase por tamaño real del grupo (inscritos).</p>${sizeChart(ciclo,edif,depto)}</div>
    <div class="card"><h3>Curva de demanda del día</h3><p class="sub">Aulas ocupadas en promedio de lunes a viernes, por hora.</p>
      <div class="cols">${hr.map((v,i)=>`<div class="col" data-tip="${6+i}:00 · ${pct(v)} de aulas ocupadas (${num(v*sm.n)} aulas)"><div class="pair"><i class="a" style="height:${v/Math.max(...hr,.01)*100}%;width:70%"></i></div><span>${6+i}</span></div>`).join('')}</div>
    </div>
  </div>`;
  $('#panorama').innerHTML=h;
  $('#panorama').querySelectorAll('[data-edif]').forEach(a=>a.onclick=e=>{e.preventDefault();state.edif=a.dataset.edif;$('#fEdif').value=state.edif;renderAll()});
}
const BINS=[[1,19,'< 20'],[20,29,'20–29'],[30,39,'30–39'],[40,49,'40–49'],[50,999,'50 o más']];
function sizeChart(ciclo,edif,depto){
  const rs=rooms(edif).filter(r=>r.cap>0), occ=occupancy(ciclo,depto), a=BINS.map(()=>0), b=BINS.map(()=>0);
  rs.forEach(r=>{a[BINS.findIndex(x=>r.cap>=x[0]&&r.cap<=x[1])]++;
    occ.get(r.id).list.forEach(i=>{const s=S[i],k=BINS.findIndex(x=>Math.max(1,s[9])>=x[0]&&Math.max(1,s[9])<=x[1]); b[k]+=W[i]*(s[3]-s[2])/60*[...s[4]].slice(0,6).filter(c=>c==='1').length})});
  const ta=a.reduce((x,y)=>x+y,0)||1, tb=b.reduce((x,y)=>x+y,0)||1, mx=Math.max(...a.map(v=>v/ta),...b.map(v=>v/tb),.01);
  return `<div class="cols">${BINS.map((x,i)=>`<div class="col"><div class="pair"><i class="a" style="height:${a[i]/ta/mx*100}%" data-tip="${a[i]} aulas con capacidad ${x[2]} (${pct(a[i]/ta)})"></i><i class="b" style="height:${b[i]/tb/mx*100}%" data-tip="${num(b[i])} horas semanales con grupos de ${x[2]} estudiantes (${pct(b[i]/tb)})"></i></div><span>${x[2]}</span></div>`).join('')}</div>
  <div class="legend"><i style="background:var(--navy2)"></i><span>aulas por capacidad</span><i style="background:var(--gold);margin-left:10px"></i><span>horas de clase por tamaño del grupo</span></div>`;
}

/* ---------- AULAS ---------- */
let sortK='util',sortD=-1,qAula='';
function aulaRows(){
  const occ=occupancy(state.ciclo,state.depto);
  return rooms().map(r=>({r,...roomStats(r,occ.get(r.id))}));
}
function renderAulas(){
  const rows=aulaRows().filter(x=>!qAula||(x.r.cod+' '+x.r.nom+' '+edifN(x.r.edif)).toLowerCase().includes(qAula));
  const get={aula:x=>x.r.nom,edif:x=>edifN(x.r.edif),cap:x=>x.r.cap,util:x=>x.util,hrs:x=>x.hrs,fill:x=>isNaN(x.fill)?-1:x.fill,over:x=>x.over}[sortK];
  rows.sort((a,b)=>{const u=get(a),v=get(b);return (u>v?1:u<v?-1:0)*sortD});
  const th=(k,l,c='')=>`<th class="s ${c}" data-k="${k}">${l}${sortK===k?(sortD<0?' ↓':' ↑'):''}</th>`;
  $('#aulas').innerHTML=`<p class="intro">Inventario de aulas con su uso en ${esc(state.ciclo)}. Haga clic en una fila para ver el horario semanal del aula. <b>Ocupación</b>: horas usadas de las 70 de referencia. <b>Llenado</b>: inscritos promedio frente a la capacidad.</p>
  <div class="row sp mb"><div class="form" style="grid-template-columns:280px"><label>Buscar aula<input id="qAula" value="${esc(qAula)}" placeholder="Código, nombre o edificio"></label></div>
  <div class="row"><span class="muted small">${rows.length} aulas</span><button class="btn ghost sm" id="csvAulas">Descargar CSV</button></div></div>
  <div class="scroll"><table><thead><tr>${th('aula','Aula')}${th('edif','Edificio')}${th('cap','Capacidad','r')}${th('util','Ocupación')}${th('hrs','Horas/sem','r')}${th('fill','Llenado')}${th('over','Sobrecupos','r')}<th>Lectura</th></tr></thead><tbody>
  ${rows.map(x=>`<tr class="click" data-id="${x.r.id}"><td><b>${esc(x.r.nom)}</b></td><td>${esc(edifN(x.r.edif))}</td><td class="r">${x.r.cap||'—'}</td><td>${barCell(x.util,utilCls(x.util))}</td><td class="r">${x.hrs.toFixed(1)}</td><td>${isNaN(x.fill)?'—':barCell(x.fill,x.fill>1?'b':x.fill<.5?'w':'g')}</td><td class="r">${x.over||''}</td><td>${lectura(x)}</td></tr>`).join('')}
  </tbody></table></div>`;
  const q=$('#qAula'); q.oninput=()=>{qAula=q.value.toLowerCase();const p=q.selectionStart;renderAulas();const n=$('#qAula');n.focus();n.setSelectionRange(p,p)};
  $('#aulas').querySelectorAll('th.s').forEach(t=>t.onclick=()=>{const k=t.dataset.k;if(k===sortK)sortD*=-1;else{sortK=k;sortD=-1}renderAulas()});
  $('#aulas').querySelectorAll('tr.click').forEach(t=>t.onclick=()=>roomModal(+t.dataset.id));
  $('#csvAulas').onclick=()=>csv(`aulas_${state.ciclo}.csv`,['Aula','Edificio','Capacidad','Ocupacion','Horas semana','Llenado','Sobrecupos'],rows.map(x=>[x.r.nom,edifN(x.r.edif),x.r.cap,pct(x.util,1),x.hrs.toFixed(1),pct(x.fill,1),x.over]));
}
function lectura(x){
  if(x.util>=.7) return '<span class="pill bad">Saturada</span>';
  if(x.over>0&&x.fill>.95) return '<span class="pill bad">Queda pequeña</span>';
  if(x.util<.2) return '<span class="pill nav">Con holgura</span>';
  if(x.fill<.5&&x.r.cap>=30) return '<span class="pill warn">Grupos pequeños</span>';
  return '<span class="pill ok">Uso adecuado</span>';
}
function timetable(cells){ // cells[d][h] = {t,c,tip}
  return `<div class="tt"><div></div>${DAYS.map(d=>`<div class="dd">${d}</div>`).join('')}${Array.from({length:16},(_,h)=>`<div class="hh">${6+h}:00</div>`+DAYS.map((_,d)=>{const c=cells[d][h];return c?`<div class="s ${c.c}" data-tip="${esc(c.tip||c.t)}">${esc(c.t)}</div>`:'<div class="s"></div>'}).join('')).join('')}</div>`;
}
function roomModal(id){
  const r=ROOM.get(id), e=occupancy(state.ciclo,state.depto).get(id), x=roomStats(r,e);
  const cells=DAYS.map(()=>Array(16).fill(null));
  e.list.forEach(i=>{const s=S[i];for(let d=0;d<ND;d++) if(s[4][d]==='1') for(let h=0;h<16;h++){const m=T0+h*60; if(s[2]<m+60&&s[3]>m){const c=cells[d][h]; if(!c||W[i]>c.w) cells[d][h]={w:W[i],t:s[7],c:W[i]>=.5?'u':'p',tip:`${s[7]} · ${hhmm(s[2])}–${hhmm(s[3])} · ${s[9]} inscritos · ${D.depts[s[8]]}${W[i]<.5?' · solo parte del semestre':''}`}}}});
  const list=e.list.map(i=>S[i]).sort((a,b)=>a[4]<b[4]?1:a[4]>b[4]?-1:a[2]-b[2]);
  openModal(`<h2>${esc(r.nom)}</h2><p class="muted">${esc(edifN(r.edif))} · capacidad ${r.cap||'no registrada'} · ${esc(state.ciclo)}</p>
  <div class="row mb mt"><span class="pill nav">Ocupación ${pct(x.util)}</span><span class="pill">${x.hrs.toFixed(1)} h/semana</span><span class="pill">Llenado ${pct(x.fill)}</span>${x.over?`<span class="pill bad">${x.over} sesiones con sobrecupo</span>`:''}</div>
  ${timetable(cells)}<div class="legend"><i style="background:#cfdcf0"></i><span>ocupada todo el semestre</span><i style="background:#e3e9f3;margin-left:10px"></i><span>ocupada parte del semestre</span></div>
  <h3 class="mt mb">Sesiones programadas (${list.length})</h3><div class="scroll" style="max-height:260px"><table><thead><tr><th>Asignatura</th><th>Días</th><th>Horario</th><th class="r">Inscritos</th><th>Departamento</th></tr></thead><tbody>
  ${list.map(s=>`<tr><td>${esc(s[7])}</td><td>${[...s[4]].slice(0,6).map((c,i)=>c==='1'?DAYS[i]:'').filter(Boolean).join(', ')}</td><td>${hhmm(s[2])}–${hhmm(s[3])}</td><td class="r">${s[9]>r.cap&&r.cap?`<span class="pill bad">${s[9]}</span>`:s[9]}</td><td>${esc(D.depts[s[8]])}</td></tr>`).join('')}</tbody></table></div>`);
}

/* ---------- BUSCAR ESPACIO ---------- */
const bq={days:[0],ini:16,dur:4,n:30,edif:'*',parcial:false};
function freeLevel(e,d,a,b){let m=0;for(let t=a;t<b;t++)m=Math.max(m,e.o[d*NS+t]);return m}
function searchRooms(q,ciclo){
  const occ=occupancy(ciclo,'*'), a=q.ini, b=q.ini+q.dur, out=[];
  if(b>NS||!q.days.length) return out;
  rooms(q.edif).forEach(r=>{ if(r.cap<q.n) return; const lv=Math.max(...q.days.map(d=>freeLevel(occ.get(r.id),d,a,b)));
    if(lv===0||(q.parcial&&lv<.5)) out.push({r,lv,x:roomStats(r,occ.get(r.id))});});
  return out.sort((u,v)=>u.lv-v.lv||u.r.cap-v.r.cap);
}
function renderBuscar(){
  const el=$('#buscar');
  el.innerHTML=`<p class="intro">Encuentre aulas <b>libres</b> para una franja concreta en ${esc(state.ciclo)}. Se ordenan por mejor ajuste: la más pequeña que alcanza para el grupo, para no gastar un aula grande en un grupo pequeño.</p>
  <div class="card"><div class="form">
    <label style="grid-column:span 2">Días en que se dicta<div class="checks">${DAYS.map((d,i)=>`<label><input type="checkbox" data-d="${i}" ${bq.days.includes(i)?'checked':''}>${d}</label>`).join('')}</div></label>
    <label>Hora de inicio<select id="bIni">${Array.from({length:NS-1},(_,i)=>`<option value="${i}" ${i===bq.ini?'selected':''}>${slotT(i)}</option>`).join('')}</select></label>
    <label>Duración<select id="bDur">${[[2,'1 hora'],[3,'1 h 30'],[4,'2 horas'],[6,'3 horas'],[8,'4 horas']].map(o=>`<option value="${o[0]}" ${o[0]===bq.dur?'selected':''}>${o[1]}</option>`).join('')}</select></label>
    <label>Estudiantes<input id="bN" type="number" min="1" max="300" value="${bq.n}"></label>
    <label>Edificio<select id="bEdif">${edifOpts(bq.edif)}</select></label>
    <label style="flex-direction:row;align-items:center;gap:6px"><input type="checkbox" id="bPar" ${bq.parcial?'checked':''}> Incluir aulas ocupadas solo parte del semestre</label>
  </div></div><div id="bRes" class="mt"></div>`;
  const run=()=>{
    bq.days=[...el.querySelectorAll('[data-d]')].filter(c=>c.checked).map(c=>+c.dataset.d); bq.ini=+$('#bIni').value; bq.dur=+$('#bDur').value;
    bq.n=Math.max(1,+$('#bN').value||1); bq.edif=$('#bEdif').value; bq.parcial=$('#bPar').checked;
    const res=searchRooms(bq,state.ciclo), fin=bq.ini+bq.dur;
    if(!bq.days.length){$('#bRes').innerHTML='<div class="note">Seleccione al menos un día.</div>';return}
    if(fin>NS){$('#bRes').innerHTML='<div class="note">La franja termina después de las 22:00. Elija una hora de inicio más temprana o una duración menor.</div>';return}
    // alternativas: aulas libres por hora de inicio
    const alt=[];for(let i=2;i+bq.dur<=NS;i+=2)alt.push([i,searchRooms({...bq,ini:i,parcial:false},state.ciclo).length]); const mx=Math.max(...alt.map(a=>a[1]),1);
    $('#bRes').innerHTML=`<div class="grid g2"><div class="card" style="grid-column:span 2">
      <div class="row sp mb"><h3>${res.length} aulas disponibles · ${bq.days.map(d=>DAYS[d]).join(', ')} ${slotT(bq.ini)}–${slotT(fin)} · ${bq.n} estudiantes</h3>${res.length?'<button class="btn ghost sm" id="csvB">Descargar CSV</button>':''}</div>
      ${res.length?`<div class="scroll" style="max-height:420px"><table><thead><tr><th>Aula</th><th>Edificio</th><th class="r">Capacidad</th><th>Sillas que usaría</th><th>Disponibilidad</th><th>Uso actual del aula</th></tr></thead><tbody>
      ${res.slice(0,80).map(o=>`<tr class="click" data-id="${o.r.id}"><td><b>${esc(o.r.nom)}</b></td><td>${esc(edifN(o.r.edif))}</td><td class="r">${o.r.cap}</td><td>${barCell(bq.n/o.r.cap,bq.n/o.r.cap<.5?'w':'g')}</td><td>${o.lv===0?'<span class="pill ok">Libre todo el semestre</span>':`<span class="pill warn">Ocupada ${pct(o.lv)} del semestre</span>`}</td><td>${barCell(o.x.util,utilCls(o.x.util))}</td></tr>`).join('')}</tbody></table></div>${res.length>80?`<p class="muted small">Se muestran las 80 de mejor ajuste; el CSV incluye todas.</p>`:''}`
      :'<div class="note">No hay aulas libres con esa capacidad en esa franja. Revise las alternativas de horario o amplíe los edificios.</div>'}</div>
      <div class="card" style="grid-column:span 2"><h3>Alternativas de horario</h3><p class="sub">Número de aulas libres con capacidad para ${bq.n} estudiantes según la hora de inicio (misma duración y días).</p>
      <div class="cols">${alt.map(a=>`<div class="col" data-tip="${slotT(a[0])}: ${a[1]} aulas libres"><b>${a[1]}</b><div class="pair" style="height:70%"><i class="${a[0]===bq.ini?'b':'a'}" style="height:${a[1]/mx*100}%;width:70%"></i></div><span>${slotT(a[0])}</span></div>`).join('')}</div></div></div>`;
    $('#bRes').querySelectorAll('tr.click').forEach(t=>t.onclick=()=>roomModal(+t.dataset.id));
    if($('#csvB'))$('#csvB').onclick=()=>csv('aulas_disponibles.csv',['Aula','Edificio','Capacidad','Disponibilidad'],res.map(o=>[o.r.nom,edifN(o.r.edif),o.r.cap,o.lv===0?'Libre todo el semestre':'Ocupada '+pct(o.lv)+' del semestre']));
  };
  el.querySelectorAll('input,select').forEach(i=>i.onchange=run); run();
}
const edifOpts=sel=>`<option value="*">Todos los edificios</option>`+Object.keys(EDIF).map(c=>`<option value="${c}" ${c===sel?'selected':''}>${esc(edifN(c))}</option>`).join('');

/* ---------- SIMULADOR DE PROGRAMA NUEVO ---------- */
const JOR={diurna:[2,24,'Diurna (7:00–18:00)'],nocturna:[24,32,'Nocturna (18:00–22:00)'],completa:[2,32,'Completa (7:00–22:00)']};
const sim={nombre:'Ingeniería en Inteligencia Artificial',n:40,coh:4,cursos:6,horas:4,jor:'diurna',sab:false,edifs:null};
const blocksOf=h=>h<=3?[h*2]:h===4?[4,4]:h===5?[6,4]:h===6?[4,4,4]:[...Array(Math.floor(h/2)).fill(4),...(h%2?[2]:[])];
/** Asignación voraz con restricciones: aula libre todo el semestre, capacidad suficiente y sin cruces de la cohorte. */
function schedule(p,ciclo,coh){
  const occ=occupancy(ciclo,'*'), [j0,j1]=JOR[p.jor];
  const cand=ROOMS.filter(r=>p.edifs.includes(r.edif)&&r.cap>=p.n).sort((a,b)=>a.cap-b.cap);
  const busy=new Map(cand.map(r=>[r.id,Uint8Array.from(occ.get(r.id).o,v=>v>0?1:0)]));
  const days=p.sab?[0,1,2,3,4,5]:[0,1,2,3,4], lim=d=>d===5?[2,Math.min(j1,14)]:[j0,j1];
  let supply=0; cand.forEach(r=>{const b=busy.get(r.id);days.forEach(d=>{const [a,z]=lim(d);for(let t=a;t<z;t++)if(!b[d*NS+t])supply++})});
  const plan=[], added=new Map(); let placed=0,total=0,hPlaced=0,hTotal=0;
  for(let c=0;c<coh;c++){
    const cb=new Uint8Array(GRID), load=[0,0,0,0,0,0], used=new Map(), items=[];
    for(let k=0;k<p.cursos;k++){
      const seen=new Set();
      for(const len of blocksOf(p.horas)){
        total++; hTotal+=len/2; let done=false;
        for(const strict of [true,false]){
          const ds=days.filter(d=>!strict||!seen.has(d)).sort((a,b)=>load[a]-load[b]||a-b);
          for(const d of ds){ const [a,z]=lim(d);
            for(let t=a;t+len<=z&&!done;t+=2){
              let ok=true; for(let i=t;i<t+len;i++) if(cb[d*NS+i]){ok=false;break} if(!ok) continue;
              const free=cand.filter(r=>{const b=busy.get(r.id);for(let i=t;i<t+len;i++)if(b[d*NS+i])return false;return true});
              if(!free.length) continue;
              const r=free.slice().sort((x,y)=>(used.get(y.id)||0)-(used.get(x.id)||0)||x.cap-y.cap)[0], b=busy.get(r.id);
              for(let i=t;i<t+len;i++){b[d*NS+i]=1;cb[d*NS+i]=1}
              load[d]+=len; seen.add(d); used.set(r.id,(used.get(r.id)||0)+len); added.set(r.id,(added.get(r.id)||0)+len);
              items.push({k,d,t,len,r}); placed++; hPlaced+=len/2; done=true;
            }
            if(done) break;
          }
          if(done) break;
        }
      }
    }
    plan.push(items);
  }
  return {plan,placed,total,hPlaced,hTotal,supply:supply/2,cand,added};
}
function defaultEdifs(){ // edificios donde hoy dicta clase la Facultad
  const m={}; S.forEach((s,i)=>{if(s[1]!=null&&FAC.has(s[8])&&s[2]!=null){const e=ROOM.get(s[1]).edif;m[e]=(m[e]||0)+W[i]*(s[3]-s[2])}});
  return Object.entries(m).sort((a,b)=>b[1]-a[1]).slice(0,2).map(x=>x[0]);
}
function renderSimular(){
  if(!sim.edifs) sim.edifs=defaultEdifs();
  const el=$('#simular');
  el.innerHTML=`<p class="intro">Estime si la infraestructura actual puede recibir un <b>programa nuevo o una ampliación de cupos</b>. El simulador ubica cada bloque de clase en un aula libre durante todo el semestre, con capacidad suficiente y sin cruces de horario para los estudiantes de una misma cohorte, sobre la programación real de ${esc(state.ciclo)}.</p>
  <div class="card"><div class="form">
    <label style="grid-column:span 2">Programa<input id="sNom" value="${esc(sim.nombre)}"></label>
    <label>Estudiantes por cohorte<input id="sN" type="number" min="5" max="200" value="${sim.n}"></label>
    <label>Cohortes simultáneas<input id="sCoh" type="number" min="1" max="12" value="${sim.coh}"></label>
    <label>Asignaturas por cohorte<input id="sCur" type="number" min="1" max="10" value="${sim.cursos}"></label>
    <label>Horas presenciales por asignatura/semana<select id="sHor">${[2,3,4,5,6].map(h=>`<option ${h===sim.horas?'selected':''}>${h}</option>`).join('')}</select></label>
    <label>Jornada<select id="sJor">${Object.entries(JOR).map(([k,v])=>`<option value="${k}" ${k===sim.jor?'selected':''}>${v[2]}</option>`).join('')}</select></label>
    <label style="flex-direction:row;align-items:center;gap:6px"><input type="checkbox" id="sSab" ${sim.sab?'checked':''}> Usar sábados (7:00–13:00)</label>
    <label style="grid-column:1/-1">Edificios donde puede dictarse<div class="checks">${Object.keys(EDIF).map(c=>`<label><input type="checkbox" data-e="${c}" ${sim.edifs.includes(c)?'checked':''}>${esc(edifN(c))}</label>`).join('')}</div></label>
  </div></div><div id="sRes" class="mt"></div>`;
  const run=()=>{
    sim.nombre=$('#sNom').value; sim.n=Math.max(5,+$('#sN').value||5); sim.coh=Math.min(12,Math.max(1,+$('#sCoh').value||1)); sim.cursos=Math.min(10,Math.max(1,+$('#sCur').value||1));
    sim.horas=+$('#sHor').value; sim.jor=$('#sJor').value; sim.sab=$('#sSab').checked; sim.edifs=[...el.querySelectorAll('[data-e]')].filter(c=>c.checked).map(c=>c.dataset.e);
    if(!sim.edifs.length){$('#sRes').innerHTML='<div class="note">Seleccione al menos un edificio.</div>';return}
    const R=schedule(sim,state.ciclo,sim.coh); let max=0; for(let c=1;c<=12;c++){const t=schedule(sim,state.ciclo,c); if(t.placed===t.total)max=c; else break}
    window.__sim=R;
    const cov=R.placed/R.total, cls=cov===1?'':cov>=.85?'warn':'bad', occ=occupancy(state.ciclo,'*');
    const used=[...R.added.entries()].map(([id,sl])=>{const r=ROOM.get(id),x=roomStats(r,occ.get(id));return {r,h:sl/2,before:x.util,after:Math.min(1,x.util+sl/2/70)}}).sort((a,b)=>b.h-a.h);
    $('#sRes').innerHTML=`<div class="verdict ${cls}"><b>${cov===1?'La infraestructura seleccionada sí absorbe el programa.':cov>=.85?'Cabe casi todo: faltan algunos bloques por ubicar.':'La infraestructura seleccionada no alcanza para este escenario.'}</b>
      <div>Se ubicaron ${R.placed} de ${R.total} bloques (${R.hPlaced} de ${R.hTotal} horas semanales) para ${sim.coh} cohorte${sim.coh>1?'s':''} de ${sim.n} estudiantes de <b>${esc(sim.nombre)}</b>. ${max>=12?'Con estos parámetros caben 12 o más cohortes simultáneas.':`Con estos parámetros la capacidad máxima es de <b>${max} cohorte${max===1?'':'s'} simultánea${max===1?'':'s'}</b> (${num(max*sim.n)} estudiantes).`}</div></div>
    <div class="grid kpis mt">
      <div class="card kpi"><div class="l">Demanda</div><div class="v">${R.hTotal} h</div><div class="n">horas-aula por semana</div></div>
      <div class="card kpi"><div class="l">Aulas candidatas</div><div class="v">${R.cand.length}</div><div class="n">con ${sim.n} sillas o más en los edificios elegidos</div></div>
      <div class="card kpi"><div class="l">Holgura disponible</div><div class="v">${num(R.supply)} h</div><div class="n">horas libres por semana en esa jornada</div></div>
      <div class="card kpi"><div class="l">Uso de la holgura</div><div class="v">${pct(R.supply?R.hTotal/R.supply:NaN)}</div><div class="n">de las horas libres que consumiría</div></div>
      <div class="card kpi"><div class="l">Aulas requeridas</div><div class="v">${used.length}</div><div class="n">equivalen a ${(R.hPlaced/70).toFixed(1)} aulas de tiempo completo</div></div>
    </div>
    <div class="card mt"><div class="row sp mb"><h3>Horario propuesto por cohorte</h3><button class="btn ghost sm" id="csvS">Descargar propuesta (CSV)</button></div>
      <div class="grid g2">${R.plan.map((items,c)=>{const cells=DAYS.map(()=>Array(16).fill(null));
        items.forEach(it=>{for(let i=it.t;i<it.t+it.len;i+=2)cells[it.d][i/2]={t:`A${it.k+1} · ${it.r.cod||it.r.nom}`,c:'n',tip:`Asignatura ${it.k+1} · ${DAYN[it.d]} ${slotT(it.t)}–${slotT(it.t+it.len)} · ${it.r.nom} (${edifN(it.r.edif)}, ${it.r.cap} sillas)`}});
        const exp=sim.cursos*blocksOf(sim.horas).length;
        return `<div><h4 class="mb">Cohorte ${c+1} ${items.length<exp?`<span class="pill bad">${exp-items.length} bloques sin ubicar</span>`:''}</h4>${timetable(cells)}</div>`}).join('')}</div></div>
    <div class="card mt"><h3>Aulas que usaría el programa</h3><p class="sub">Ocupación de cada aula antes y después de incorporar el programa.</p>
      <div class="scroll" style="max-height:320px"><table><thead><tr><th>Aula</th><th>Edificio</th><th class="r">Capacidad</th><th class="r">Horas nuevas/sem</th><th>Ocupación actual</th><th>Ocupación proyectada</th></tr></thead><tbody>
      ${used.map(u=>`<tr class="click" data-id="${u.r.id}"><td><b>${esc(u.r.nom)}</b></td><td>${esc(edifN(u.r.edif))}</td><td class="r">${u.r.cap}</td><td class="r">${u.h}</td><td>${barCell(u.before,utilCls(u.before))}</td><td>${barCell(u.after,utilCls(u.after))}</td></tr>`).join('')}</tbody></table></div></div>`;
    $('#sRes').querySelectorAll('tr.click').forEach(t=>t.onclick=()=>roomModal(+t.dataset.id));
    $('#csvS').onclick=()=>csv('propuesta_horario.csv',['Programa','Cohorte','Asignatura','Dia','Inicio','Fin','Aula','Edificio','Capacidad'],R.plan.flatMap((items,c)=>items.map(it=>[sim.nombre,c+1,'Asignatura '+(it.k+1),DAYN[it.d],slotT(it.t),slotT(it.t+it.len),it.r.nom,edifN(it.r.edif),it.r.cap])));
  };
  el.querySelectorAll('input,select').forEach(i=>i.onchange=run); run();
}

/* ---------- HALLAZGOS ---------- */
function findings(ciclo,edif){
  const occ=occupancy(ciclo,'*'), rs=rooms(edif), st=rs.map(r=>({r,...roomStats(r,occ.get(r.id))})), sm=summary(ciclo,edif,'*');
  const sat=st.filter(x=>x.util>=.7).sort((a,b)=>b.util-a.util), hol=st.filter(x=>x.util<.2).sort((a,b)=>a.util-b.util);
  const over=[],small=[],cross=[];
  rs.forEach(r=>{const l=occ.get(r.id).list;
    l.forEach(i=>{const s=S[i]; if(r.cap&&s[9]>r.cap)over.push({s,r}); if(r.cap>=30&&s[9]>0&&s[9]<=r.cap*.5)small.push({s,r,i})});
    for(let a=0;a<l.length;a++)for(let b=a+1;b<l.length;b++){const x=S[l[a]],y=S[l[b]];
      if(x[11]===y[11]||x[7]===y[7]||x[12]===y[12]) continue;
      if(x[2]<y[3]&&y[2]<x[3]&&x[5]<=y[6]&&y[5]<=x[6]&&[0,1,2,3,4,5].some(d=>x[4][d]==='1'&&y[4][d]==='1')) cross.push({x,y,r});}});
  over.sort((a,b)=>(b.s[9]-b.r.cap)-(a.s[9]-a.r.cap));
  const hSmall=small.reduce((t,o)=>t+W[o.i]*(o.s[3]-o.s[2])/60*[...o.s[4]].slice(0,6).filter(c=>c==='1').length,0);
  const hr=[];for(let h=0;h<16;h++){let v=0;for(let d=0;d<5;d++)v+=(sm.heat[d*NS+h*2]+sm.heat[d*NS+h*2+1])/2;hr.push(v/5)}
  const am=hr.slice(1,6).reduce((a,b)=>a+b)/5, pm=hr.slice(8,12).reduce((a,b)=>a+b)/4, nt=hr.slice(12,16).reduce((a,b)=>a+b)/4;
  const all=S.filter(s=>s[0]===ciclo);
  return {sm,sat,hol,over,small,hSmall,cross,am,pm,nt,sinAula:all.filter(s=>s[1]==null).length,sinHora:all.filter(s=>s[2]==null).length,total:all.length};
}
function renderHallazgos(){
  const {ciclo,edif}=state, F=findings(ciclo,edif), fac=summaryFac(ciclo);
  const item=(n,t,p,extra='')=>`<div class="f"><div class="num">${n}</div><div><h3>${t}</h3><p>${p}</p>${extra}</div></div>`;
  const tbl=(head,rows,id)=>rows.length?`<details class="mt"><summary class="small" style="cursor:pointer;color:var(--navy2);font-weight:600">Ver detalle (${rows.length})</summary><div class="scroll mt" style="max-height:280px"><table><thead><tr>${head.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.slice(0,150).map(r=>`<tr>${r.map(c=>`<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div><button class="btn ghost sm mt" data-csv="${id}">Descargar CSV</button></details>`:'';
  const T={
    sat:[['Aula','Edificio','Capacidad','Ocupación','Horas/sem'],F.sat.map(x=>[x.r.nom,edifN(x.r.edif),x.r.cap,pct(x.util),x.hrs.toFixed(1)])],
    hol:[['Aula','Edificio','Capacidad','Ocupación','Horas/sem'],F.hol.map(x=>[x.r.nom,edifN(x.r.edif),x.r.cap,pct(x.util),x.hrs.toFixed(1)])],
    over:[['Asignatura','Aula','Edificio','Inscritos','Capacidad','Exceso'],F.over.map(o=>[o.s[7],o.r.nom,edifN(o.r.edif),o.s[9],o.r.cap,o.s[9]-o.r.cap])],
    small:[['Asignatura','Aula','Edificio','Inscritos','Capacidad'],F.small.map(o=>[o.s[7],o.r.nom,edifN(o.r.edif),o.s[9],o.r.cap])],
    cross:[['Aula','Asignatura A','Horario A','Asignatura B','Horario B'],F.cross.map(c=>[c.r.nom,c.x[7],hhmm(c.x[2])+'–'+hhmm(c.x[3]),c.y[7],hhmm(c.y[2])+'–'+hhmm(c.y[3])])]};
  $('#hallazgos').innerHTML=`<p class="intro">Diagnóstico generado automáticamente a partir de la programación de <b>${esc(ciclo)}</b> en ${edif==='*'?'todos los edificios':'<b>'+esc(edifN(edif))+'</b>'}. Cambie el periodo o el edificio en la parte superior para recalcular.</p>
  <div class="card"><div class="find">
  ${item(1,'Hay capacidad instalada sin usar, pero no a todas las horas',`La ocupación horaria promedio es de <b>${pct(F.sm.util)}</b>. En la mañana (7:00–12:00) se ocupa en promedio el <b>${pct(F.am)}</b> de las aulas, en la tarde (14:00–18:00) el <b>${pct(F.pm)}</b> y en la noche (18:00–22:00) el <b>${pct(F.nt)}</b>. El crecimiento de la oferta cabe con menor fricción en las franjas de menor uso.`)}
  ${item(2,`${F.sat.length} aulas están saturadas y ${F.hol.length} tienen holgura amplia`,`Las saturadas superan el 70% de ocupación horaria; las de holgura están por debajo del 20% y suman <b>${num(F.hol.reduce((t,x)=>t+x.r.cap,0))} sillas</b>. Redistribuir carga entre unas y otras reduce la presión sin obra nueva.`,tbl(...T.sat,'sat')+tbl(...T.hol,'hol'))}
  ${item(3,`${F.over.length} sesiones tienen más inscritos que sillas`,`Son grupos asignados a un aula cuya capacidad registrada es menor al número de inscritos. Conviene reubicarlos con la pestaña “Buscar espacio” o verificar la capacidad registrada del aula.`,tbl(...T.over,'over'))}
  ${item(4,`${F.small.length} sesiones ocupan aulas de 30 o más sillas con la mitad o menos de los puestos`,`Equivalen a <b>${num(F.hSmall)} horas-aula semanales</b> en las que un aula grande atiende un grupo pequeño. Pasar esos grupos a aulas menores libera espacios para cohortes numerosas.`,tbl(...T.small,'small'))}
  ${item(5,F.cross.length?`${F.cross.length} posible${F.cross.length>1?'s':''} cruce${F.cross.length>1?'s':''} de programación`:'No se detectan cruces de programación',`Se buscan pares de asignaturas distintas registradas en la misma aula, con horario y fechas que se traslapan. Pueden ser cursos compartidos entre programas o errores de registro; se recomienda validarlos con Registro Académico.`,tbl(...T.cross,'cross'))}
  ${item(6,'Facultad de IA e Ingenierías: dónde y cuándo dicta clase',fac)}
  ${item(7,'Calidad de los datos',`De ${num(F.total)} registros del periodo, <b>${num(F.sinAula)}</b> no requieren aula (prácticas, trabajos de grado, rotaciones) y <b>${num(F.sinHora)}</b> no tienen horario registrado. El análisis solo incluye las aulas que aparecen en la programación; los espacios que nunca se programan no figuran en la fuente.`)}
  </div></div>`;
  $('#hallazgos').querySelectorAll('[data-csv]').forEach(b=>b.onclick=()=>csv(`hallazgo_${b.dataset.csv}_${ciclo}.csv`,T[b.dataset.csv][0],T[b.dataset.csv][1]));
}
function summaryFac(ciclo){
  const m={},hr=Array(16).fill(0); let tot=0,n=0,ins=0;
  S.forEach((s,i)=>{if(s[0]!==ciclo||!FAC.has(s[8])) return; n++; if(s[1]==null||s[2]==null||!W[i]) return;
    const dd=[...s[4]].slice(0,6).filter(c=>c==='1').length, h=W[i]*(s[3]-s[2])/60*dd, e=ROOM.get(s[1]).edif; m[e]=(m[e]||0)+h; tot+=h; ins+=h*s[9];
    for(let k=0;k<16;k++){const mm=T0+k*60; if(s[2]<mm+60&&s[3]>mm) hr[k]+=W[i]*dd}});
  const top=Object.entries(m).sort((a,b)=>b[1]-a[1]), pk=hr.indexOf(Math.max(...hr));
  return `Los departamentos de Ingeniería y de Sistemas e Informática suman <b>${num(n)} registros</b> y <b>${num(tot)} horas-aula semanales</b>, con un tamaño medio de grupo de <b>${(ins/tot||0).toFixed(0)} estudiantes</b>. Se concentran en ${top.slice(0,3).map(t=>`<b>${esc(edifN(t[0]))}</b> (${pct(t[1]/tot)})`).join(', ')}; su hora de mayor demanda es las <b>${6+pk}:00</b>.`;
}

/* ---------- METODOLOGÍA ---------- */
function renderMetodo(){
  $('#metodo').innerHTML=`<div class="card prose">
  <h2>Cómo se calcula</h2>
  <h3>Fuente</h3><p>${esc(D.fuente)}: ${num(S.length)} registros de programación, ${ROOMS.length} aulas en ${new Set(ROOMS.map(r=>r.edif)).size} edificios y ${Object.keys(D.depts).length} departamentos. Datos procesados el ${esc(D.generado)}.</p>
  <h3>Semana tipo</h3><p>Cada sesión pesa según la fracción del semestre regular en que está activa (2025-1: 3 de febrero a 13 de junio; 2025-2: 11 de agosto a 12 de diciembre). Un curso de todo el semestre pesa 1; un módulo de cuatro semanas pesa cerca de 0,2. Así las rotaciones cortas no inflan la ocupación.</p>
  <h3>Indicadores</h3><ul>
   <li><b>Ocupación horaria</b>: horas en uso del aula sobre 70 horas de referencia (lunes a viernes, 7:00 a 21:00).</li>
   <li><b>Llenado de sillas</b>: inscritos sobre capacidad del aula, ponderado por las horas en uso.</li>
   <li><b>Saturada</b>: ocupación de 70% o más. <b>Con holgura</b>: menos de 20%.</li>
   <li><b>Aula libre</b> (buscador y simulador): sin ninguna sesión durante todo el semestre en la franja consultada.</li></ul>
  <h3>Simulador</h3><p>Asignación voraz con restricciones: cada asignatura se parte en bloques (2 h + 2 h para cuatro horas semanales), los bloques de una misma asignatura se reparten en días distintos, los estudiantes de una cohorte no tienen dos clases a la vez, y se prefiere el aula más pequeña que alcance y la que la cohorte ya usa, para reducir desplazamientos. La capacidad máxima es el mayor número de cohortes que se ubican completas.</p>
  <h3>Alcance y límites</h3><ul>
   <li>Es una herramienta de apoyo a la decisión: la asignación definitiva corresponde a la oficina que administra los espacios.</li>
   <li>La fuente solo trae las aulas que tuvieron programación en 2025; un aula sin uso no aparece, por lo que la holgura real puede ser mayor.</li>
   <li>No distingue tipos de espacio especializados (laboratorios, salas de cómputo); revise el nombre del aula antes de asignar.</li>
   <li>Para actualizar los datos de un nuevo periodo, reemplace el archivo de origen y ejecute <code>scripts/prep_data.py</code>.</li></ul>
  <h3>Fechas corregidas</h3><p>El archivo original mezcla formatos de fecha (mes/día y día/mes). El proceso de limpieza los unifica antes del cálculo.</p></div>`;
}

/* ---------- arranque ---------- */
const R={panorama:renderPanorama,aulas:renderAulas,buscar:renderBuscar,simular:renderSimular,hallazgos:renderHallazgos,metodo:renderMetodo};
let cur='panorama';
function renderAll(){R[cur]()}
function init(){
  $('#fEdif').innerHTML=edifOpts('*');
  $('#fDepto').innerHTML=`<option value="*">Toda la Universidad</option><option value="FAC">Facultad de IA e Ingenierías</option>`+Object.entries(D.depts).sort((a,b)=>a[1].localeCompare(b[1],'es')).map(([k,v])=>`<option value="${k}">${esc(v)}</option>`).join('');
  $('#fCiclo').onchange=e=>{state.ciclo=e.target.value;renderAll()};
  $('#fEdif').onchange=e=>{state.edif=e.target.value;renderAll()};
  $('#fDepto').onchange=e=>{state.depto=e.target.value;renderAll()};
  $('#tabs').onclick=e=>{const b=e.target.closest('button');if(!b)return;cur=b.dataset.tab;
    document.querySelectorAll('#tabs button').forEach(x=>x.classList.toggle('on',x===b));
    document.querySelectorAll('.tab').forEach(x=>x.classList.toggle('on',x.id===cur)); history.replaceState(null,'','#'+cur); renderAll(); scrollTo(0,0)};
  const h=location.hash.slice(1); if(R[h]) document.querySelector(`#tabs [data-tab=${h}]`).click(); else renderAll();
}
window.__planner={findings,summary,schedule,searchRooms,occupancy,roomStats,rooms,summaryFac,sim,state,defaultEdifs,W};
init();
})();
