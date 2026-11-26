"""Limpia AULAS 2025.xlsx y genera data.js para el Planeador de Espacios."""
import openpyxl, json, re, datetime, collections, sys
SRC="fuente/Apoyo Decanatura ingeniería IA Ucaldas/AULAS 2025.xlsx"
wb=openpyxl.load_workbook(SRC,data_only=True); ws=wb.active
rows=list(ws.iter_rows(values_only=True)); hdr=rows[0]
data=[dict(zip(hdr,r)) for r in rows[1:] if r[1] is not None]
def tmin(s):
    if not s: return None
    m=re.match(r'(\d+):(\d+):\d+\.\d+(AM|PM)',s)
    h,mi,ap=int(m[1]),int(m[2]),m[3]
    if ap=='PM' and h!=12: h+=12
    if ap=='AM' and h==12: h=0
    return h*60+mi
def fdate(v):
    # Excel interpretó MM/DD como DD/MM cuando el día <= 12: se corrige intercambiando.
    if isinstance(v,datetime.datetime): return datetime.date(v.year,v.day,v.month)
    m,d,y=map(int,v.split('/')); return datetime.date(y,m,d)
DAYS=['LUNES','MARTES','MIERCOLES','JUEVES','VIERNES','SABADO','DOMINGO']
CIC={1860:'2025-1',1870:'2025-2'}
rooms={}; depts={}; sess=[]; skipped=collections.Counter()
for d in data:
    aid=int(d['ID AULA']); c=CIC[int(d['CICLO'])]
    s,e=tmin(d['HORA INICIO']),tmin(d['HORA FIN'])
    dm=d['DEPTO_MATERIA']; depts[dm]=d['NOM_DEPTO_MATERIA'].strip()
    dd=''.join('1' if d[x]=='Y' else '0' for x in DAYS)
    fi,ff=fdate(d['FECHA INICIAL']),fdate(d['FECHA FINAL'])
    if aid==999: skipped['sin_aula']+=1; room=None
    else:
        room=aid
        rooms[aid]={'id':aid,'cod':str(d['AULA'] if d['AULA'] is not None else '').replace('.0','').strip(),'nom':str(d['NOM_AULA']).strip(),'edif':d['EDIFICIO'].strip(),'cap':int(d['CAPACIDAD_AULA'])}
    if s is None or e is None or e<=s: skipped['sin_horario']+=1; s=e=None
    sess.append([c,room,s,e,dd,fi.isoformat(),ff.isoformat(),d['NOM_MATERIA'].strip(),dm,int(d['INSCRITOS']),int(d['CAPACIDAD_PIAA']),int(d['CLASE']),d['COD_MATERIA'].replace('\xa0','').strip()])
out={'generado':datetime.date.today().isoformat(),'fuente':'AULAS 2025.xlsx (programación académica 2025-1 y 2025-2)','rooms':sorted(rooms.values(),key=lambda r:(r['edif'],r['cod'])),'depts':depts,
     'campos':['ciclo','aula','ini','fin','dias','fi','ff','materia','depto','inscritos','cupo','clase','cod'],'sess':sess}
open('entregables/planeador-espacios/data.js','w').write('window.DATA='+json.dumps(out,ensure_ascii=False,separators=(',',':'))+';')
print(len(sess),'sesiones',len(rooms),'aulas',dict(skipped))
print(json.dumps(depts,ensure_ascii=False,indent=0))
ed=collections.Counter(r['edif'] for r in rooms.values()); print(ed)
print('cap0',[r for r in rooms.values() if r['cap']==0][:10])
import statistics
for c in CIC.values():
    ds=[(x[5],x[6]) for x in sess if x[0]==c]; print(c,collections.Counter(ds).most_common(4), min(a for a,b in ds), max(b for a,b in ds))
