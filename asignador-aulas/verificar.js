// Ejecuta el sistema multiagente fuera del navegador y verifica las restricciones duras.  Uso: node verificar.js
globalThis.window = globalThis;
require('../planeador-espacios/data.js'); require('./pred.js'); require('./agentes.js');
const W = AGENTES.build(DATA, PRED, '2025-2');
const esp = [...W.rooms.values()].filter(r => r.esp).length;
console.log(`Sesiones con aula y horario: ${W.sess.length} · aulas: ${W.rooms.size} (${esp} especializadas)`);
for (const base of ['real', 'pred', 'cupo']) for (const otroEdificio of [false, true]) {
  const t = Date.now(), r = AGENTES.run(W, { base, otroEdificio });
  // verificación independiente: ningún movimiento deja a un grupo sin sillas ni crea cruces
  let mal = 0; r.moves.forEach(m => { if (W.rooms.get(m.to).cap < m.dem && m.via.indexOf('cede') < 0) mal++; if (W.rooms.get(m.to).esp) mal++ });
  console.log(`\nbase=${base} otroEdificio=${otroEdificio} (${Date.now() - t} ms)`);
  console.log(`  sobrecupo ${r.before.sobrecupo} -> ${r.after.sobrecupo} | estudiantes sin silla ${r.before.sinSilla} -> ${r.after.sinSilla} | casos en aulas generales ${r.casos}, especializadas ${r.fuera}`);
  console.log(`  vías ${JSON.stringify(r.vias)} | movimientos ${r.moves.length} (mismo edificio ${r.mismoEdif}) | rondas ${r.rondas} | mensajes ${r.log.length} | cruces nuevos ${r.choques} | violaciones ${mal}`);
  console.log(`  pendientes estructurales ${r.pend.filter(p => p.estructural).length} de ${r.pend.length}`);
}
