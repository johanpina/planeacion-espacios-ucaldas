/* Asignador Inteligente de Aulas · interfaz. La lógica está en agentes.js y el modelo en pred.js */
(function () {
  const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
  const D = window.DATA, P = window.PRED, CICLO = '2025-2';
  const W = AGENTES.build(D, P, CICLO);
  const EDIF = { ADMIN: 'Administrativo', BICENTE: 'Bicentenario', PALOGRANDE: 'Palogrande', CENTRAL: 'Sede Central', AGROP: 'Agropecuarias', PARQUE: 'Edificio del Parque', SALUD: 'Ciencias para la Salud', BELARTE: 'Bellas Artes', LABORA: 'Laboratorios', BIOFILO: 'Biófilo', DORADA: 'La Dorada' };
  const nf = new Intl.NumberFormat('es-CO'), n = x => nf.format(Math.round(x)), n1 = x => x.toFixed(1).replace('.', ','), pct = x => Math.round(x * 100) + '%';
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const M = P.metricas, depN = d => D.depts[d] || d;
  const G = new Map(); D.sess.forEach(s => { if (s[0] === CICLO && !G.has(s[11])) G.set(s[11], { materia: s[7], dep: s[8], cod: s[12] }) });
  let R = null, cur = 'resumen';
  const opts = () => ({ base: $('#fBase').value, otroEdificio: $('#fEdif').value === '1' });
  const baseTxt = () => ({ real: 'los inscritos reales de 2025-2', pred: 'la predicción del modelo (percentil 90)', cupo: 'el cupo ofertado' }[opts().base]);
  function compute() { R = AGENTES.run(W, opts()) }
  function csv(name, head, rows) {
    const q = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
    const blob = new Blob(['﻿' + [head].concat(rows).map(r => r.map(q).join(';')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 500);
  }
  const ba = (a, b) => `<div class="ba"><s>${n(a)}</s><span class="arrow">→</span><b>${n(b)}</b>${a > b ? `<i>−${pct(1 - b / a)}</i>` : ''}</div>`;
  const kpi = (l, v, note) => `<div class="card kpi"><div class="l">${l}</div><div class="v">${v}</div><div class="n">${note || ''}</div></div>`;
  const kba = (l, a, b, note) => `<div class="card kpi"><div class="l">${l}</div>${ba(a, b)}<div class="n">${note || ''}</div></div>`;
  const rn = id => { const r = W.rooms.get(id); return `${esc(r.cod)} <span class="muted">(${r.cap})</span>` };
  const ed = id => EDIF[W.rooms.get(id).edif] || W.rooms.get(id).edif;

  // ---------------- Resumen ----------------
  function renderResumen() {
    const r = R, res = r.casos - r.pend.length;
    $('#resumen').innerHTML = `
    <p class="intro">Esta herramienta responde dos preguntas de la programación académica: <b>¿cuántos estudiantes llegarán realmente a cada grupo?</b> y <b>¿en qué aula debe quedar cada clase para que nadie se quede sin silla?</b> La primera la contesta un modelo de aprendizaje automático validado con los datos de 2025; la segunda, un sistema de agentes que negocian las aulas con reglas explícitas y auditables.</p>
    <div class="grid kpis mb">
      ${kpi('Error del modelo', n1(M.modelo.mae) + ' est.', `por grupo, frente a ${n1(M.cupo.mae)} si se planea con el cupo ofertado`)}
      ${kba('Sesiones en sobrecupo', r.before.sobrecupo, r.after.sobrecupo, 'más estudiantes que sillas')}
      ${kba('Estudiantes sin silla', r.before.sinSilla, r.after.sinSilla, 'suma por sesión semanal')}
      ${kpi('Cambios de aula', n(r.moves.length), `${pct(r.mismoEdif / Math.max(1, r.moves.length))} en el mismo edificio · ${r.choques} cruces nuevos`)}
      ${kpi('Para decisión humana', n(r.pend.length), `${r.pend.filter(p => p.estructural).length} por falta de aulas grandes`)}
    </div>
    <div class="card mb"><h3>Cómo trabaja el sistema</h3><p class="sub">Cinco tipos de agente, cada uno con una responsabilidad y una regla de decisión. En esta corrida participaron ${r.agentes.deptos} agentes de departamento y ${r.agentes.edificios} de edificio, en ${r.rondas} rondas y ${n(r.log.length)} mensajes.</p>
      <div class="flow">
        <div class="a g"><em>1 · Predictor</em><b>Estima la demanda</b><span>Modelo de gradient boosting que predice los inscritos de cada grupo y su rango probable.</span></div>
        <div class="a"><em>2 · Auditor</em><b>Detecta los casos</b><span>Compara demanda y sillas de cada sesión y ordena los casos por gravedad.</span></div>
        <div class="a"><em>3 · Departamentos</em><b>Proponen aulas</b><span>Cada departamento pide para sus clases el aula que mejor ajusta, en su edificio y entre las que ya usa.</span></div>
        <div class="a"><em>4 · Edificios</em><b>Aceptan o rechazan</b><span>Cada edificio cuida el calendario de sus aulas y prioriza el caso más grave cuando dos piden la misma.</span></div>
        <div class="a k"><em>5 · Coordinador</em><b>Media y verifica</b><span>Gestiona permutas entre departamentos, verifica que no haya cruces y entrega los casos sin solución.</span></div>
      </div>
    </div>
    <div class="grid g2">
      <div class="card"><h3>Lectura del resultado</h3><p class="sub">Dimensionando con ${baseTxt()}${opts().otroEdificio ? ', permitiendo cambio de edificio' : ', sin sacar a nadie de su edificio'}.</p>
        <div class="find">
          <div class="f"><div class="num">1</div><div><b>${n(res)} de ${n(r.casos)} casos resueltos en aulas generales</b><p>${n(r.vias.directa || 0)} con un aula libre, ${n(r.vias.permuta || 0)} con permuta entre dos clases y ${n(r.vias.cadena || 0)} con una cadena de tres. Nadie pasa a un aula con menos sillas de las que necesita.</p></div></div>
          <div class="f"><div class="num">2</div><div><b>${n(r.pend.length)} casos no tienen solución con la infraestructura actual</b><p>${r.pend.length ? `En ${n(r.pend.filter(p => p.estructural).length)} el edificio no tiene ninguna aula general de ese tamaño; en el resto, todas están ocupadas en esa franja. Es el argumento de inversión o de cambio de horario.` : 'Todos los casos de aulas generales encontraron aula.'}</p></div></div>
          <div class="f"><div class="num">3</div><div><b>${n(r.fuera)} sobrecupos están en laboratorios, talleres y salas especializadas</b><p>El sistema no los mueve porque dependen del equipamiento. Se resuelven dividiendo el grupo o ajustando el cupo, no cambiando de aula.</p></div></div>
          ${opts().base !== 'real' ? `<div class="f"><div class="num">4</div><div><b>Prueba contra la realidad: ${n(r.realAntes.sobrecupo)} → ${n(r.realDespues.sobrecupo)} sesiones</b><p>Este plan se armó sin conocer la matrícula. Al compararlo con los inscritos reales de 2025-2, el sobrecupo real habría bajado ${pct(1 - r.realDespues.sobrecupo / r.realAntes.sobrecupo)}.</p></div></div>` : ''}
        </div>
      </div>
      <div class="card"><h3>Por qué importa predecir</h3><p class="sub">Sillas que se reservan frente a las que realmente se ocupan, sumando los ${n(P.n_grupos)} grupos de 2025-2.</p>
        <div class="hbars">
          ${[['Cupo ofertado', P.totales.cupo, ''], ['Predicción del modelo', P.totales.pred, 'g'], ['Inscritos reales', P.totales.inscritos, '']].map(([l, v, c]) => `<div>${l}</div><div class="bar ${c}"><i style="width:${v / P.totales.cupo * 100}%"></i></div><div><b>${n(v)}</b></div>`).join('')}
        </div>
        <p class="small muted mt">El cupo ofertado sobreestima la matrícula en ${pct(P.totales.cupo / P.totales.inscritos - 1)}. El modelo acierta el total con una diferencia de ${n(Math.abs(P.totales.pred - P.totales.inscritos))} estudiantes (${n1(Math.abs(P.totales.pred - P.totales.inscritos) / P.totales.inscritos * 100)}%).</p>
        <div class="row mt"><button class="btn" data-go="agentes">Ver la negociación</button><button class="btn ghost" data-go="propuesta">Ver la propuesta de aulas</button></div>
      </div>
    </div>`;
  }

  // ---------------- Predicción ----------------
  let gq = '', gdep = '';
  function renderPred() {
    const comp = [['Cupo ofertado (práctica actual)', M.cupo.mae, 'b'], ['Llenado promedio del departamento', M.depto.mae, 'w'], ['Mismo valor del periodo anterior', M.historial.mae, 'w'], ['Modelo', M.modelo.mae, 'g']];
    const mx = M.cupo.mae, imx = P.importancia[0][1];
    $('#prediccion').innerHTML = `
    <p class="intro">El modelo estima cuántos estudiantes se inscribirán en cada grupo usando solo lo que se conoce <b>antes de la matrícula</b>: el cupo ofertado, el departamento, el horario y lo que pasó con ese curso en el periodo anterior. Cada predicción que se muestra aquí se hizo sobre grupos que el modelo no vio al entrenarse.</p>
    <div class="grid kpis mb">
      ${kpi('Error absoluto medio', n1(M.modelo.mae), 'estudiantes por grupo')}
      ${kpi('Mejora frente al cupo', pct(1 - M.modelo.mae / M.cupo.mae), `el cupo se equivoca en ${n1(M.cupo.mae)} por grupo`)}
      ${kpi('Varianza explicada (R²)', M.modelo.r2.toFixed(2).replace('.', ','), `${n(M.modelo.n)} grupos evaluados`)}
      ${kpi('Sesgo', n1(M.modelo.sesgo), 'ni infla ni reduce la matrícula total')}
      ${kpi('Grupos bajo el P90', pct(P.bajo_p90), 'el techo usado para elegir aula')}
    </div>
    <div class="grid g2 mb">
      <div class="card"><h3>Predicción frente a inscritos reales</h3><p class="sub">Cada punto es un grupo de 2025-2. Sobre la diagonal, la predicción es exacta.</p><canvas id="sc" height="330"></canvas></div>
      <div class="card"><h3>Comparación con métodos simples</h3><p class="sub">Error absoluto medio en estudiantes por grupo. Menos es mejor.</p>
        <div class="hbars">${comp.map(([l, v, c]) => `<div>${l}</div><div class="bar ${c}"><i style="width:${v / mx * 100}%"></i></div><div><b>${n1(v)}</b></div>`).join('')}</div>
        <p class="small muted mt">Prueba temporal estricta: entrenando solo con 2025-1 y prediciendo 2025-2, sin historial del curso, el error es ${n1(M.temporal_sin_hist.mae)}.</p>
        <h3 class="mt">Qué variables pesan</h3><p class="sub">Cuánto empeora el error al desordenar cada variable.</p>
        <div class="hbars">${P.importancia.slice(0, 7).map(([l, v]) => `<div>${l}</div><div class="bar"><i style="width:${Math.max(1, v / imx * 100)}%"></i></div><div>${n1(v)}</div>`).join('')}</div>
      </div>
    </div>
    <div class="card mb"><div class="row sp"><div><h3>Por departamento</h3><p class="sub">Sillas ofertadas, predichas y ocupadas; error del modelo y del cupo.</p></div><button class="btn ghost sm" id="xDep">Descargar CSV</button></div>
      <div class="scroll" style="max-height:340px"><table><thead><tr><th>Departamento</th><th class="r">Grupos</th><th class="r">Cupo</th><th class="r">Predicción</th><th class="r">Inscritos</th><th class="r">Error modelo</th><th class="r">Error cupo</th></tr></thead><tbody>
      ${P.deptos.slice().sort((a, b) => b[5] - a[5]).map(d => `<tr><td>${esc(d[1])}</td><td class="r">${n(d[2])}</td><td class="r">${n(d[7])}</td><td class="r">${n(d[6])}</td><td class="r">${n(d[5])}</td><td class="r"><b>${n1(d[3])}</b></td><td class="r">${n1(d[4])}</td></tr>`).join('')}
      </tbody></table></div></div>
    <div class="card"><div class="row sp mb"><div><h3>Consulta por grupo</h3><p class="sub" style="margin:0">Predicción, rango probable (P10–P90) y resultado real de cada grupo.</p></div>
      <div class="row"><div class="form" style="grid-template-columns:220px 220px"><input id="gq" placeholder="Buscar materia…" value="${esc(gq)}"><select id="gdep"><option value="">Todos los departamentos</option>${Object.keys(D.depts).sort((a, b) => depN(a).localeCompare(depN(b))).map(d => `<option value="${d}" ${d === gdep ? 'selected' : ''}>${esc(depN(d))}</option>`).join('')}</select></div><button class="btn ghost sm" id="xGr">Descargar CSV</button></div></div>
      <div class="scroll" style="max-height:420px"><table><thead><tr><th>Materia</th><th>Departamento</th><th class="r">Cupo</th><th class="r">Predicción</th><th class="r">Rango</th><th class="r">Inscritos</th><th class="r">Diferencia</th></tr></thead><tbody id="gt"></tbody></table></div><p class="small muted" id="gn"></p></div>`;
    drawScatter(); fillGroups();
    $('#gq').oninput = e => { gq = e.target.value; fillGroups() }; $('#gdep').onchange = e => { gdep = e.target.value; fillGroups() };
    $('#xDep').onclick = () => csv('prediccion_por_departamento.csv', ['Departamento', 'Grupos', 'Cupo', 'Prediccion', 'Inscritos', 'Error modelo', 'Error cupo'], P.deptos.map(d => [d[1], d[2], d[7], d[6], d[5], d[3], d[4]]));
    $('#xGr').onclick = () => csv('prediccion_por_grupo.csv', ['Clase', 'Codigo', 'Materia', 'Departamento', 'Cupo', 'Prediccion', 'P10', 'P90', 'Inscritos'], groups().map(g => [g.id, g.cod, g.materia, depN(g.dep), g.v[4], g.v[0], g.v[2], g.v[1], g.v[3]]));
  }
  function groups() {
    const q = gq.trim().toLowerCase();
    return Object.entries(P.grupos).map(([id, v]) => Object.assign({ id, v }, G.get(+id) || { materia: '—', dep: '', cod: '' }))
      .filter(g => (!gdep || g.dep === gdep) && (!q || g.materia.toLowerCase().includes(q)))
      .sort((a, b) => Math.abs(b.v[0] - b.v[3]) - Math.abs(a.v[0] - a.v[3]));
  }
  function fillGroups() {
    const g = groups(), show = g.slice(0, 200);
    $('#gt').innerHTML = show.map(x => { const d = x.v[0] - x.v[3], c = Math.abs(d) <= 5 ? 'ok' : Math.abs(d) <= 10 ? 'warn' : 'bad'; return `<tr><td>${esc(x.materia)}</td><td>${esc(depN(x.dep))}</td><td class="r">${x.v[4]}</td><td class="r"><b>${n1(x.v[0])}</b></td><td class="r">${x.v[2]}–${x.v[1]}</td><td class="r">${x.v[3]}</td><td class="r"><span class="pill ${c}">${d > 0 ? '+' : ''}${n1(d)}</span></td></tr>` }).join('');
    $('#gn').textContent = `${n(g.length)} grupos; se muestran los ${n(show.length)} con mayor diferencia.`;
  }
  function drawScatter() {
    const c = $('#sc'); if (!c) return; const w = c.parentElement.clientWidth - 36, h = 330, dpr = window.devicePixelRatio || 1;
    c.width = w * dpr; c.height = h * dpr; c.style.width = w + 'px'; c.style.height = h + 'px';
    const x = c.getContext('2d'); x.scale(dpr, dpr); const m = { l: 40, r: 10, t: 8, b: 32 }, mx = 55, X = v => m.l + v / mx * (w - m.l - m.r), Y = v => h - m.b - v / mx * (h - m.t - m.b);
    x.font = '11px sans-serif'; x.fillStyle = '#7b8499'; x.strokeStyle = '#dfe3ea'; x.lineWidth = 1;
    for (let v = 0; v <= 50; v += 10) { x.beginPath(); x.moveTo(X(v), Y(0)); x.lineTo(X(v), Y(mx)); x.moveTo(X(0), Y(v)); x.lineTo(X(mx), Y(v)); x.stroke(); x.textAlign = 'center'; x.fillText(v, X(v), h - m.b + 14); x.textAlign = 'right'; x.fillText(v, m.l - 6, Y(v) + 4) }
    x.textAlign = 'center'; x.fillText('Inscritos reales', X(mx / 2), h - 3); x.save(); x.translate(11, Y(mx / 2)); x.rotate(-Math.PI / 2); x.fillText('Predicción', 0, 0); x.restore();
    x.fillStyle = 'rgba(23,73,140,.22)'; Object.values(P.grupos).forEach(v => { x.beginPath(); x.arc(X(Math.min(mx, v[3])) + (Math.random() - .5) * 3, Y(Math.min(mx, v[0])), 2, 0, 6.3); x.fill() });
    x.strokeStyle = '#c79a2b'; x.lineWidth = 2; x.beginPath(); x.moveTo(X(0), Y(0)); x.lineTo(X(mx), Y(mx)); x.stroke();
  }

  // ---------------- Agentes ----------------
  const FASES = ['Preparación: demanda y auditoría', 'Fase 1 · Propuesta directa', 'Fase 2 · Permuta y cadena', 'Fase 3 · Verificación del coordinador'];
  const TIPOS = [['propuesta', 'Propuestas'], ['acepta', 'Aceptaciones'], ['rechazo', 'Rechazos'], ['solicitud', 'Solicitudes de permuta'], ['consulta', 'Consultas'], ['pendiente', 'Pendientes']];
  let timer = null;
  function renderAgentes(play) {
    clearInterval(timer);
    $('#agentes').innerHTML = `
    <p class="intro">Aquí se ve la negociación tal como ocurre. Cada mensaje es una decisión tomada por un agente con su propia regla: <b>los departamentos proponen, los edificios aceptan o rechazan y el coordinador media cuando no hay aula libre</b>. Todo queda registrado para que la oficina responsable pueda revisar por qué se propuso cada cambio.</p>
    <div class="card mb"><div class="row sp"><div><h3>Bitácora de la negociación</h3><p class="sub" style="margin:0">${R.agentes.deptos} departamentos, ${R.agentes.edificios} edificios, ${R.rondas} rondas, ${n(R.log.length)} mensajes · dimensionando con ${baseTxt()}.</p></div>
      <div class="row"><button class="btn" id="play">▶ Reproducir negociación</button><button class="btn ghost" id="all">Ver todo</button><button class="btn ghost sm" id="xLog">Descargar bitácora</button></div></div>
      <div class="cnts mt" id="cn"></div></div>
    <div class="log" id="lg"></div>`;
    const lg = $('#lg'); let i = 0, lastF = -1; const c = {};
    const cn = () => { $('#cn').innerHTML = `<div><b>${n(i)}</b><span>Mensajes</span></div>` + TIPOS.map(([k, l]) => `<div><b>${n(c[k] || 0)}</b><span>${l}</span></div>`).join('') };
    const html = m => `<div class="msg"><div><span class="pill ${{ acepta: 'ok', rechazo: 'bad', pendiente: 'warn', propuesta: 'nav', solicitud: 'nav' }[m.tipo] || ''}">${m.tipo}</span></div><div><div class="who">${esc(m.de)} <span>→ ${esc(m.para)}</span></div><p>${esc(m.txt)}</p></div></div>`;
    function add(k) {
      let out = '';
      for (let j = 0; j < k && i < R.log.length; j++, i++) { const m = R.log[i]; if (m.fase !== lastF) { out += `<div class="ph">${FASES[m.fase]}</div>`; lastF = m.fase } c[m.tipo] = (c[m.tipo] || 0) + 1; out += html(m) }
      lg.insertAdjacentHTML('beforeend', out); cn();
    }
    const finish = () => { clearInterval(timer); add(R.log.length) };
    if (play) { add(2); timer = setInterval(() => { add(i < 40 ? 1 : 12); lg.scrollTop = lg.scrollHeight; if (i >= R.log.length) clearInterval(timer) }, 140) } else add(R.log.length);
    $('#play').onclick = () => renderAgentes(true); $('#all').onclick = finish;
    $('#xLog').onclick = () => csv('bitacora_agentes.csv', ['Fase', 'De', 'Para', 'Tipo', 'Mensaje'], R.log.map(m => [FASES[m.fase], m.de, m.para, m.tipo, m.txt]));
  }

  // ---------------- Propuesta ----------------
  let pe = '', pd = '';
  function renderPropuesta() {
    const r = R, eds = [...new Set(r.moves.map(m => W.rooms.get(m.from).edif))].sort(), deps = [...new Set(r.moves.map(m => m.s.dep))].sort((a, b) => depN(a).localeCompare(depN(b)));
    const pb = {}; r.pend.forEach(p => { const e = W.rooms.get(p.s.room).edif; (pb[e] = pb[e] || { n: 0, est: 0, mx: 0 }); pb[e].n++; pb[e].est += p.estructural ? 1 : 0; pb[e].mx = Math.max(pb[e].mx, p.dem) });
    const vias = [['directa', 'Aula libre (propuesta directa)'], ['permuta', 'Permuta entre dos clases'], ['cadena', 'Cadena de tres aulas'], ['pendiente', 'Sin solución: decisión humana']], vt = r.casos || 1;
    $('#propuesta').innerHTML = `
    <p class="intro">Resultado de la negociación: la lista de cambios de aula que eliminan sobrecupos <b>sin mover horarios, sin crear cruces y sin tocar laboratorios ni talleres</b>. Solo se mueve lo necesario; el resto de la programación queda igual.</p>
    <div class="grid kpis mb">
      ${kba('Sesiones en sobrecupo', r.before.sobrecupo, r.after.sobrecupo, `${n(r.fuera)} están en aulas especializadas`)}
      ${kba('En aulas generales', r.before.sobreGen, r.after.sobreGen, 'el alcance del sistema')}
      ${kba('Estudiantes sin silla', r.before.sinSilla, r.after.sinSilla, 'suma por sesión semanal')}
      ${kpi('Cambios propuestos', n(r.moves.length), `${n(r.moves.filter(m => m.via.startsWith('cede')).length)} son clases que ceden su aula`)}
      ${kpi('Cruces nuevos', n(r.choques), 'verificado por el coordinador')}
    </div>
    <div class="grid g2 mb">
      <div class="card"><h3>Cómo se resolvió cada caso</h3><p class="sub">${n(r.casos)} sesiones con sobrecupo en aulas generales.</p>
        <div class="hbars">${vias.map(([k, l]) => `<div>${l}</div><div class="bar ${k === 'pendiente' ? 'w' : 'g'}"><i style="width:${(r.vias[k] || 0) / vt * 100}%"></i></div><div><b>${n(r.vias[k] || 0)}</b></div>`).join('')}</div>
        ${opts().base !== 'real' ? `<div class="note mt">Contra los inscritos reales de 2025-2, este plan habría dejado <b>${n(r.realDespues.sobrecupo)}</b> sesiones en sobrecupo en lugar de ${n(r.realAntes.sobrecupo)}.</div>` : ''}</div>
      <div class="card"><h3>Dónde falta infraestructura</h3><p class="sub">Casos sin solución por edificio: el insumo para decidir inversión o cambios de horario.</p>
        ${r.pend.length ? `<table><thead><tr><th>Edificio</th><th class="r">Casos</th><th class="r">Sin aula de ese tamaño</th><th class="r">Grupo más grande</th></tr></thead><tbody>${Object.entries(pb).sort((a, b) => b[1].n - a[1].n).map(([e, v]) => `<tr><td>${EDIF[e] || e}</td><td class="r">${v.n}</td><td class="r">${v.est}</td><td class="r">${v.mx}</td></tr>`).join('')}</tbody></table>` : '<p class="muted">No quedaron casos pendientes en aulas generales.</p>'}</div>
    </div>
    <div class="card mb"><div class="row sp mb"><div><h3>Cambios de aula propuestos</h3><p class="sub" style="margin:0">Entre paréntesis, las sillas de cada aula.</p></div>
      <div class="row"><div class="form" style="grid-template-columns:190px 230px"><select id="pe"><option value="">Todos los edificios</option>${eds.map(e => `<option value="${e}" ${e === pe ? 'selected' : ''}>${EDIF[e] || e}</option>`).join('')}</select><select id="pd"><option value="">Todos los departamentos</option>${deps.map(d => `<option value="${d}" ${d === pd ? 'selected' : ''}>${esc(depN(d))}</option>`).join('')}</select></div><button class="btn ghost sm" id="xMv">Descargar CSV</button></div></div>
      <div class="scroll" style="max-height:460px"><table><thead><tr><th>Materia</th><th>Departamento</th><th>Horario</th><th class="r">Demanda</th><th>Aula actual</th><th>Aula propuesta</th><th>Edificio</th><th>Mecanismo</th></tr></thead><tbody id="mt"></tbody></table></div><p class="small muted" id="mn"></p></div>
    <div class="card"><div class="row sp mb"><div><h3>Casos para decisión humana</h3><p class="sub" style="margin:0">El sistema explica por qué no pudo resolverlos.</p></div><button class="btn ghost sm" id="xPd">Descargar CSV</button></div>
      <div class="scroll" style="max-height:360px"><table><thead><tr><th>Materia</th><th>Departamento</th><th>Horario</th><th class="r">Demanda</th><th>Aula actual</th><th>Edificio</th><th>Motivo</th></tr></thead><tbody>
      ${r.pend.map(p => `<tr><td>${esc(p.s.materia)}</td><td>${esc(depN(p.s.dep))}</td><td>${AGENTES.horario(p.s)}</td><td class="r">${p.dem}</td><td>${rn(p.s.room)}</td><td>${ed(p.s.room)}</td><td>${esc(p.motivo)}</td></tr>`).join('') || '<tr><td colspan="7" class="muted">Sin casos pendientes.</td></tr>'}</tbody></table></div></div>`;
    const sel = () => r.moves.filter(m => (!pe || W.rooms.get(m.from).edif === pe) && (!pd || m.s.dep === pd));
    const fill = () => { const mv = sel(); $('#mt').innerHTML = mv.map(m => `<tr><td>${esc(m.s.materia)}</td><td>${esc(depN(m.s.dep))}</td><td>${AGENTES.horario(m.s)}</td><td class="r">${m.dem}</td><td>${rn(m.from)}</td><td><b>${rn(m.to)}</b></td><td>${ed(m.to)}${m.mismoEdif ? '' : ' <span class="pill warn">cambia</span>'}</td><td><span class="pill ${m.via.startsWith('cede') ? '' : 'ok'}">${m.via}</span></td></tr>`).join(''); $('#mn').textContent = `${n(mv.length)} cambios.` };
    fill(); $('#pe').onchange = e => { pe = e.target.value; fill() }; $('#pd').onchange = e => { pd = e.target.value; fill() };
    const rc = id => W.rooms.get(id);
    $('#xMv').onclick = () => csv('propuesta_cambios_de_aula.csv', ['Clase', 'Codigo', 'Materia', 'Departamento', 'Horario', 'Demanda', 'Inscritos reales', 'Aula actual', 'Sillas actual', 'Aula propuesta', 'Sillas propuesta', 'Edificio propuesto', 'Mecanismo'], sel().map(m => [m.s.clase, m.s.cod, m.s.materia, depN(m.s.dep), AGENTES.horario(m.s), m.dem, m.s.ins, rc(m.from).cod, rc(m.from).cap, rc(m.to).cod, rc(m.to).cap, rc(m.to).edif, m.via]));
    $('#xPd').onclick = () => csv('casos_para_decision.csv', ['Clase', 'Materia', 'Departamento', 'Horario', 'Demanda', 'Aula actual', 'Sillas', 'Edificio', 'Motivo'], r.pend.map(p => [p.s.clase, p.s.materia, depN(p.s.dep), AGENTES.horario(p.s), p.dem, rc(p.s.room).cod, rc(p.s.room).cap, rc(p.s.room).edif, p.motivo]));
  }

  // ---------------- Metodología ----------------
  function renderMetodo() {
    const esp = [...W.rooms.values()].filter(r => r.esp).length;
    $('#metodo').innerHTML = `<div class="card prose">
    <h3 style="margin-top:0">Datos</h3><p>Programación académica 2025-1 y 2025-2 (archivo AULAS 2025.xlsx): ${n(D.sess.length)} registros, ${D.rooms.length} aulas. El asignador trabaja sobre ${n(W.sess.length)} sesiones de 2025-2 con aula y horario; el modelo, sobre ${n(P.n_grupos)} grupos de ${n(P.n_cursos)} cursos.</p>
    <h3>Modelo de predicción</h3>
    <ul><li><b>Qué predice:</b> inscritos reales de cada grupo, más un rango probable (percentiles 10 y 90).</li>
    <li><b>Con qué:</b> cupo ofertado, departamento, hora de inicio, horas semanales, sábado o nocturno, si requiere aula, número de grupos del curso y el comportamiento del curso y del departamento en 2025-1.</li>
    <li><b>Algoritmo:</b> gradient boosting por histogramas (scikit-learn), con regresión cuantílica para el rango.</li>
    <li><b>Validación:</b> cruzada en 5 pliegues agrupada por curso, de modo que ningún curso está a la vez en entrenamiento y prueba. Todas las cifras de esta herramienta son fuera de muestra.</li>
    <li><b>Resultado:</b> error absoluto medio de ${n1(M.modelo.mae)} estudiantes por grupo (R² ${M.modelo.r2.toFixed(2).replace('.', ',')}), frente a ${n1(M.cupo.mae)} del cupo ofertado y ${n1(M.historial.mae)} de repetir el valor del periodo anterior. El ${pct(P.bajo_p90)} de los grupos quedó por debajo del percentil 90.</li></ul>
    <h3>Sistema multiagente</h3>
    <ul><li><b>Predictor</b> publica la demanda de cada grupo. Con la opción de predicción usa el percentil 90, nunca por encima del cupo ofertado.</li>
    <li><b>Auditor</b> marca cada sesión cuya demanda supera las sillas del aula y las ordena por número de estudiantes sin silla.</li>
    <li><b>Agentes de departamento</b> ordenan las aulas candidatas para cada clase: prefieren la que ajusta mejor, en el mismo edificio y entre las que el departamento ya usa.</li>
    <li><b>Agentes de edificio</b> cuidan el calendario de sus aulas. Aceptan una propuesta si no cruza con ninguna clase; si dos casos piden la misma aula, gana el más grave y el otro vuelve a proponer (aceptación diferida).</li>
    <li><b>Coordinador</b> atiende los casos sin aula libre: busca una permuta con la clase que ocupa el aula, o una cadena hacia una tercera aula. La clase que cede solo se mueve a un aula del mismo edificio con sillas suficientes. Al final verifica cruces y entrega los casos sin solución con su motivo.</li></ul>
    <h3>Restricciones que nunca se rompen</h3>
    <ul><li>No se cambia ningún horario ni ningún día.</li><li>Dos clases no comparten aula en la misma franja y fechas.</li><li>Ninguna clase pasa a un aula con menos sillas que su demanda.</li>
    <li>Las ${esp} aulas especializadas (laboratorios, talleres, salas de sistemas, escenarios deportivos y artísticos) quedan por fuera: ninguna clase entra ni sale de ellas. Se identifican por el nombre del aula en el archivo fuente.</li></ul>
    <h3>Alcance y límites</h3>
    <ul><li>Los agentes son programas con reglas explícitas, no modelos de lenguaje: la misma entrada produce siempre la misma propuesta y cada decisión se puede auditar en la bitácora.</li>
    <li>El modelo se entrenó con dos periodos. Sirve para dimensionar aulas, pero debe reentrenarse cada semestre; con más historia se podrá medir su estabilidad entre años.</li>
    <li>El archivo fuente no trae el equipamiento de las aulas ni la distancia entre edificios. Por eso el cambio de edificio viene desactivado y debe revisarse caso por caso.</li>
    <li>La propuesta es un insumo para la oficina que programa las aulas, no una asignación definitiva.</li></ul>
    <h3>Reproducibilidad</h3><p>El modelo se entrena con <code>train_demanda.py</code> y el sistema multiagente se puede ejecutar y verificar fuera del navegador con <code>node verificar.js</code>.</p></div>`;
  }

  const V = { resumen: renderResumen, prediccion: renderPred, agentes: () => renderAgentes(false), propuesta: renderPropuesta, metodo: renderMetodo };
  function go(t) { if (!V[t]) t = 'resumen'; cur = t; clearInterval(timer); $$('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === t)); $$('.tab').forEach(s => s.classList.toggle('on', s.id === t)); V[t](); if (location.hash.slice(1) !== t) history.replaceState(null, '', '#' + t) }
  $('#tabs').onclick = e => { const b = e.target.closest('button'); if (b) go(b.dataset.tab) };
  document.addEventListener('click', e => { const b = e.target.closest('[data-go]'); if (b) { go(b.dataset.go); window.scrollTo(0, 0) } });
  ['#fBase', '#fEdif'].forEach(s => $(s).onchange = () => { compute(); go(cur) });
  window.addEventListener('hashchange', () => go(location.hash.slice(1)));
  window.addEventListener('resize', () => { if (cur === 'prediccion') drawScatter() });
  const q = new URLSearchParams(location.search); if (q.get('base')) $('#fBase').value = q.get('base'); if (q.get('edif')) $('#fEdif').value = q.get('edif');
  compute(); go(location.hash.slice(1) || 'resumen');
  window.__asignador = { W, run: () => R };
})();
