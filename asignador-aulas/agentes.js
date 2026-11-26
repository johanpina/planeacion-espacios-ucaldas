/* Sistema multiagente de asignación de aulas · ODS 1038 de 2025
   Motor sin dependencias: corre igual en el navegador y en Node (node verificar.js).
   Agentes: Predictor, Auditor, un agente por departamento, un agente por edificio y Coordinador.
   Protocolo: (1) propuesta directa con aceptación diferida, (2) permuta y cadena, (3) verificación. */
(function (root) {
  const ESPECIAL = /LABORATORIO|\bLAB\b|TALLER|SISTEMAS|SALA SIG|COLISEO|PISCINA|VEL[OÓ]DROMO|MONTAÑA|DANZA|M[UÚ]SICA|\bVOZ\b|MAQUILLAJE|VESTUARIO|GALPON|PINTURA|ARTES|AUDIENCIAS|OTRO|NO REQUIERE|ACTIVIDAD F|MINERALOGIA|MEDIOS|BIOFILO|ESPECIAL|PROFESORES|MUSEO|CANCHA/i;
  const day = s => Math.round(Date.parse(s) / 864e5);
  const DAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
  const hh = m => Math.floor(m / 60) + ':' + String(m % 60).padStart(2, '0');

  /* Alcance: Facultad de IA e Ingenierías. Solo se consideran las aulas donde la Facultad dicta clase y solo se mueven sus clases;
     las clases de otras unidades en esas aulas se respetan como ocupación fija. */
  const FAC = new Set(['G8E', 'G8F']);
  function build(DATA, PRED, ciclo) {
    const facRooms = new Set(DATA.sess.filter(s => FAC.has(s[8]) && s[1] != null).map(s => s[1]));
    const rooms = new Map(DATA.rooms.filter(r => facRooms.has(r.id)).map(r => [r.id, Object.assign({ esp: ESPECIAL.test(r.nom) || ESPECIAL.test(r.cod) || r.cap <= 0 }, r)]));
    const sess = [];
    DATA.sess.forEach((s, k) => {
      if (s[0] !== ciclo || s[1] == null || s[2] == null || !facRooms.has(s[1])) return;
      let dm = 0; for (let d = 0; d < 7; d++) if (s[4][d] === '1') dm |= 1 << d;
      if (!dm) return;
      const p = PRED && PRED.grupos[s[11]];
      sess.push({ i: sess.length, k, fac: FAC.has(s[8]), room: s[1], ini: s[2], fin: s[3], dm, a: day(s[5]), b: day(s[6]), materia: s[7], dep: s[8], ins: s[9], cupo: s[10], clase: s[11], cod: s[12],
        p50: p ? p[0] : s[9], p90: p ? Math.min(p[1], Math.max(s[10], 1)) : s[9] });
    });
    return { rooms, sess, depts: DATA.depts };
  }
  const conflict = (x, y) => (x.dm & y.dm) && x.ini < y.fin && y.ini < x.fin && x.a <= y.b && y.a <= x.b;
  const horario = s => DAYS.filter((_, d) => s.dm >> d & 1).join('-') + ' ' + hh(s.ini) + '-' + hh(s.fin);

  /* opts: {base:'real'|'pred'|'cupo', otroEdificio:boolean} */
  function run(W, opts) {
    const { rooms, sess, depts } = W;
    const dem = s => Math.max(1, Math.ceil(opts.base === 'cupo' ? s.cupo : opts.base === 'pred' ? s.p90 : s.ins));
    const asg = sess.map(s => s.room);
    const occ = new Map(); rooms.forEach((_, id) => occ.set(id, new Set()));
    sess.forEach(s => occ.get(s.room).add(s.i));
    const cap = id => rooms.get(id).cap, edif = id => rooms.get(id).edif;
    const blockers = (id, s, ign) => { const out = []; occ.get(id).forEach(j => { if (j !== s.i && !(ign && ign.has(j)) && conflict(sess[j], s)) out.push(j) }); return out };
    const move = (s, to) => { occ.get(asg[s.i]).delete(s.i); asg[s.i] = to; occ.get(to).add(s.i) };
    const log = [], cnt = {};
    const say = (fase, de, para, tipo, txt) => { log.push({ fase, de, para, tipo, txt }); cnt[tipo] = (cnt[tipo] || 0) + 1 };
    const depN = d => 'Depto. ' + (depts[d] || d), edN = e => 'Edificio ' + e;
    const rn = id => rooms.get(id).cod + ' (' + cap(id) + ')';

    // familiaridad: aulas que cada departamento ya usa
    const fam = new Map(); sess.forEach(s => { const k = s.dep; if (!fam.has(k)) fam.set(k, new Set()); fam.get(k).add(s.room) });

    // ---------- Predictor + Auditor ----------
    const baseTxt = { real: 'inscritos reales', pred: 'predicción P90 del modelo', cupo: 'cupo ofertado' }[opts.base];
    say(0, 'Predictor', 'Todos', 'demanda', `Publico la demanda de ${new Set(sess.filter(s => s.fac).map(s => s.clase)).size} grupos de la Facultad (${baseTxt}).`);
    const deficit = (s, id) => Math.max(0, dem(s) - cap(id));
    const before = metrics(); const realAntes = (function () { let n = 0, f = 0; sess.forEach(s => { if (!s.fac) return; const x = s.ins - cap(s.room); if (x > 0) { n++; f += x } }); return { sobrecupo: n, sinSilla: f } })();
    function contarCruces() { let n = 0; occ.forEach((set, id) => { if (rooms.get(id).esp) return; const a = [...set]; for (let x = 0; x < a.length; x++) for (let y = x + 1; y < a.length; y++) if (conflict(sess[a[x]], sess[a[y]])) n++ }); return n }
    const choquesAntes = contarCruces();
    const casos = sess.filter(s => s.fac && !rooms.get(s.room).esp && deficit(s, s.room) > 0).sort((x, y) => deficit(y, y.room) - deficit(x, x.room) || dem(y) - dem(x));
    const fuera = sess.filter(s => s.fac && rooms.get(s.room).esp && deficit(s, s.room) > 0);
    say(0, 'Auditor', 'Coordinador', 'auditoria', `Encontré ${casos.length} sesiones de la Facultad con más estudiantes que sillas en aulas generales y ${fuera.length} en aulas especializadas (estas no se mueven).`);
    const st = new Map(casos.map(s => [s.i, { s, via: null, from: s.room, ptr: 0, cands: null }]));
    const generales = [...rooms.values()].filter(r => !r.esp);

    // preferencia del agente de departamento
    function candidatos(s) {
      const d = dem(s), e0 = edif(s.room), f = fam.get(s.dep);
      return generales.filter(r => r.id !== s.room && r.cap >= d && (opts.otroEdificio || r.edif === e0))
        .map(r => ({ id: r.id, u: 100 - 0.5 * (r.cap - d) - (r.edif === e0 ? 0 : 40) + (f.has(r.id) ? 10 : 0) }))
        .sort((x, y) => y.u - x.u).map(x => x.id);
    }
    st.forEach(c => { c.cands = candidatos(c.s) });

    // ---------- Fase 1: propuesta directa con aceptación diferida ----------
    let ronda = 0, progreso = true;
    while (progreso) {
      progreso = false; ronda++;
      const held = new Map(); // aula -> sesiones aceptadas provisionalmente en esta ronda
      const cola = [...st.values()].filter(c => !c.via);
      cola.forEach(c => { c.ptr = 0 });
      let q = cola.slice(), guard = 0;
      while (q.length && guard++ < 200000) {
        const c = q.shift(); const s = c.s;
        while (c.ptr < c.cands.length) {
          const id = c.cands[c.ptr++];
          if (blockers(id, s).length) continue;               // ocupada por una clase que no se mueve
          const h = held.get(id) || []; const riv = h.filter(o => conflict(o.s, s));
          const pri = x => deficit(x, x.room);
          if (riv.every(o => pri(o.s) < pri(s))) {
            riv.forEach(o => { o.tent = null; q.push(o); say(1, edN(edif(id)), depN(o.s.dep), 'rechazo', `Cedo ${rn(id)} a un caso más grave; ${o.s.materia} debe proponer otra aula.`) });
            held.set(id, h.filter(o => !riv.includes(o)).concat([c])); c.tent = id;
            say(1, depN(s.dep), edN(edif(id)), 'propuesta', `${s.materia} (${dem(s)} est., ${horario(s)}) pide ${rn(id)}; hoy está en ${rn(s.room)}.`);
            break;
          }
        }
      }
      cola.forEach(c => {
        if (c.tent != null) {
          say(1, edN(edif(c.tent)), depN(c.s.dep), 'acepta', `Aceptado: ${c.s.materia} pasa de ${rn(c.s.room)} a ${rn(c.tent)}.`);
          move(c.s, c.tent); c.via = 'directa'; c.ronda = ronda; c.tent = null; progreso = true;
        }
      });
    }

    // ---------- Fase 2: permuta y cadena ----------
    const movedOthers = [];
    [...st.values()].filter(c => !c.via).forEach(c => {
      const s = c.s, d = dem(s), old = asg[s.i]; let best = null;
      for (const id of c.cands) {
        const B = blockers(id, s); if (!B.length || B.length > 2) continue;
        if (B.some(j => !sess[j].fac || st.has(j) || movedOthers.some(m => m.s.i === j))) continue;
        const ign = new Set([s.i]); const plan = []; let ok = true, cost = 0;
        for (const j of B) {
          const t = sess[j], dt = dem(t);
          // primera opción: permuta al aula que libera s
          if (dt <= cap(old) && edif(old) === edif(id) && !blockers(old, t, ign).length && !plan.some(p => p.to === old && conflict(p.t, t))) { plan.push({ t, to: old, tipo: 'permuta' }); cost += 1; continue }
          // segunda: cadena a una tercera aula libre del mismo edificio
          const alt = generales.filter(r => r.id !== id && r.id !== old && r.edif === edif(id) && r.cap >= dt && !blockers(r.id, t).length && !plan.some(p => p.to === r.id && conflict(p.t, t)))
            .sort((x, y) => (x.cap - dt) - (y.cap - dt))[0];
          if (alt) { plan.push({ t, to: alt.id, tipo: 'cadena' }); cost += 1.5 } else { ok = false; break }
        }
        if (ok && (!best || cost < best.cost)) best = { id, plan, cost };
        if (best && best.cost <= 1) break;
      }
      if (best) {
        say(2, depN(s.dep), 'Coordinador', 'solicitud', `${s.materia} (${d} est., ${horario(s)}) no encontró aula libre; solicito permuta para ${rn(best.id)}.`);
        best.plan.forEach(p => {
          say(2, 'Coordinador', depN(p.t.dep), 'consulta', `¿${p.t.materia} (${dem(p.t)} est.) puede pasar de ${rn(asg[p.t.i])} a ${rn(p.to)}?`);
          say(2, depN(p.t.dep), 'Coordinador', 'acepta', `Sí: el aula propuesta tiene sillas suficientes y queda en el mismo edificio.`);
        });
        move(s, best.id);   // s sale primero para liberar su aula
        best.plan.forEach(p => { movedOthers.push({ s: p.t, from: asg[p.t.i], to: p.to, via: p.tipo, por: s.i }); move(p.t, p.to) });
        c.via = best.plan.some(p => p.tipo === 'cadena') ? 'cadena' : 'permuta';
      }
    });

    // ---------- Fase 3: verificación del coordinador ----------
    const pend = [...st.values()].filter(c => !c.via).map(c => {
      const s = c.s, d = dem(s), e0 = edif(s.room);
      const enEdif = generales.filter(r => r.edif === e0 && r.cap >= d).length;
      const motivo = !enEdif ? `No hay aulas generales de ${d} sillas o más en ${e0}` : c.cands.length ? `Las ${c.cands.length} aulas con capacidad suficiente están ocupadas en esa franja` : 'Sin aulas candidatas';
      say(3, 'Coordinador', depN(s.dep), 'pendiente', `${s.materia} (${d} est., ${horario(s)}) queda para decisión humana: ${motivo.toLowerCase()}.`);
      return { s, dem: d, motivo, estructural: !enEdif };
    });
    const choquesDespues = contarCruces(); const choques = choquesDespues - choquesAntes;
    const after = metrics();
    say(3, 'Coordinador', 'Todos', 'cierre', `Verificación terminada: ${choques} cruces nuevos de horario (había ${choquesAntes} en la programación original); ${after.sobrecupo} sesiones siguen en sobrecupo (antes ${before.sobrecupo}).`);

    function reales() { let n = 0, f = 0, vac = 0; sess.forEach(s => { if (!s.fac) return; const r = rooms.get(asg[s.i]); const x = s.ins - r.cap; if (x > 0) { n++; f += x } if (!r.esp) vac += Math.max(0, r.cap - s.ins) }); return { sobrecupo: n, sinSilla: f, vacias: vac } }
    const realDespues = reales();
    function metrics() {
      let sobre = 0, sinSilla = 0, sobreGen = 0, sinGen = 0;
      sess.forEach(s => { if (!s.fac) return; const x = deficit(s, asg[s.i]); if (x > 0) { sobre++; sinSilla += x; if (!rooms.get(asg[s.i]).esp) { sobreGen++; sinGen += x } } });
      return { sobrecupo: sobre, sinSilla, sobreGen, sinGen };
    }
    const row = (s, from, to, via) => ({ s, dem: dem(s), from, to, via, mismoEdif: edif(from) === edif(to) });
    const moves = [...st.values()].filter(c => c.via).map(c => row(c.s, c.from, asg[c.s.i], c.via))
      .concat(movedOthers.map(m => row(m.s, m.from, m.to, 'cede (' + m.via + ')')));
    const vias = {}; st.forEach(c => { const v = c.via || 'pendiente'; vias[v] = (vias[v] || 0) + 1 });
    return { opts, before, after, casos: casos.length, fuera: fuera.length, moves, pend, vias, log, cnt, rondas: ronda, choques, choquesAntes, realAntes, realDespues,
      agentes: { deptos: new Set(casos.map(s => s.dep)).size, edificios: new Set(casos.map(s => edif(s.room))).size },
      mismoEdif: moves.filter(m => m.mismoEdif).length, asg, horario, rooms };
  }
  root.AGENTES = { build, run, horario, ESPECIAL, FAC };
})(typeof window !== 'undefined' ? window : globalThis);
