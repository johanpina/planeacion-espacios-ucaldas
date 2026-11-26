"""Modelo de predicción de inscritos por grupo de la Facultad de IA e Ingenierías (ODS 1038 de 2025).
Entrena y valida un modelo que estima cuántos estudiantes se inscribirán realmente
en cada grupo, a partir de lo que se conoce al programar (cupo ofertado, departamento,
tipo de curso, franja, historial del curso en el periodo anterior).
Salida: entregables/asignador-aulas/pred.js
"""
import pandas as pd, numpy as np, json, re, warnings, datetime
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.model_selection import GroupKFold
from sklearn.inspection import permutation_importance
warnings.filterwarnings('ignore')
SRC="fuente/Apoyo Decanatura ingeniería IA Ucaldas/AULAS 2025.xlsx"
df=pd.read_excel(SRC); df=df[df.ID_CURSO.notna()].copy()
def tmin(s):
    m=re.match(r'(\d+):(\d+):\d+\.\d+(AM|PM)',str(s))
    if not m: return np.nan
    h,mi,ap=int(m[1]),int(m[2]),m[3]
    if ap=='PM' and h!=12: h+=12
    if ap=='AM' and h==12: h=0
    return h*60+mi
df['ini']=df['HORA INICIO'].map(tmin); df['fin']=df['HORA FIN'].map(tmin)
D=['LUNES','MARTES','MIERCOLES','JUEVES','VIERNES','SABADO','DOMINGO']
df['nd']=sum((df[d]=='Y').astype(int) for d in D)
df['hsem']=(df.fin-df.ini)/60*df.nd
df['sab']=(df['SABADO']=='Y').astype(int)
df['sinaula']=(df['ID AULA']==999).astype(int)
df['cod']=df.COD_MATERIA.str.replace('\xa0','').str.strip()
g=df.groupby(['CICLO','CLASE']).agg(curso=('ID_CURSO','first'),cod=('cod','first'),materia=('NOM_MATERIA','first'),
    dep=('DEPTO_MATERIA','first'),cupo=('CAPACIDAD_PIAA','first'),ins=('INSCRITOS','first'),
    ini=('ini','min'),hsem=('hsem','sum'),sab=('sab','max'),sinaula=('sinaula','max'),nfilas=('Row','size')).reset_index()
# Alcance: solo los departamentos de la Facultad de IA e Ingenierías
FAC=['G8E','G8F']
g=g[g.dep.isin(FAC)].copy()
g['ngrupos']=g.groupby(['CICLO','curso']).CLASE.transform('size')
g['noche']=(g.ini>=18*60).astype(int)
g['ini']=g.ini.fillna(-1); g['hsem']=g.hsem.fillna(0)
g['dep_c']=g.dep.astype('category').cat.codes
A=g[g.CICLO==1860].copy(); B=g[g.CICLO==1870].copy()
# historial del curso en el periodo anterior (2025-1)
h=A.groupby('curso').agg(h_ins=('ins','mean'),h_fill=('ins',lambda s: s.sum()),h_cupo=('cupo','sum'),h_ng=('ins','size'))
h['h_fill']=h.h_fill/h.h_cupo
B=B.join(h[['h_ins','h_fill','h_ng']],on='curso'); B['h_tiene']=B.h_ins.notna().astype(int)
hd=A.groupby('dep').apply(lambda x: x.ins.sum()/x.cupo.sum()).rename('hd_fill'); B=B.join(hd,on='dep')
FE=['cupo','dep_c','ini','hsem','sab','noche','sinaula','ngrupos','h_ins','h_fill','h_ng','h_tiene','hd_fill']
NOM={'cupo':'Cupo ofertado','dep_c':'Departamento','ini':'Hora de inicio','hsem':'Horas por semana','sab':'Clase en sábado','noche':'Franja nocturna',
     'sinaula':'No requiere aula','ngrupos':'N.º de grupos del curso','h_ins':'Inscritos por grupo, periodo anterior','h_fill':'Llenado del curso, periodo anterior',
     'h_ng':'Grupos del curso, periodo anterior','h_tiene':'Curso con historial','hd_fill':'Llenado del departamento, periodo anterior'}
X=B[FE].values; y=B.ins.values; grp=B.curso.values
def mk(loss='squared_error',q=None):
    return HistGradientBoostingRegressor(loss=loss,quantile=q,max_iter=150,learning_rate=0.05,max_leaf_nodes=7,min_samples_leaf=10,l2_regularization=1.0,random_state=7,categorical_features=[1])
oof=np.zeros(len(B)); o90=np.zeros(len(B)); o10=np.zeros(len(B))
for tr,te in GroupKFold(n_splits=5).split(X,y,grp):
    oof[te]=mk().fit(X[tr],y[tr]).predict(X[te])
    o90[te]=mk('quantile',0.9).fit(X[tr],y[tr]).predict(X[te])
    o10[te]=mk('quantile',0.1).fit(X[tr],y[tr]).predict(X[te])
oof=np.clip(oof,0,None); o90=np.clip(np.maximum(o90,oof),0,None); o10=np.clip(np.minimum(o10,oof),0,None)
def met(p,y=y,m=None):
    if m is None: m=np.ones(len(y),bool)
    e=p[m]-y[m]; return dict(mae=round(float(np.abs(e).mean()),2),rmse=round(float(np.sqrt((e**2).mean())),2),sesgo=round(float(e.mean()),2),
        r2=round(float(1-(e**2).sum()/((y[m]-y[m].mean())**2).sum()),3),n=int(m.sum()))
base_cupo=B.cupo.values.astype(float)
base_hist=np.where(B.h_tiene==1,np.minimum(B.h_ins.fillna(0),B.cupo),B.cupo*B.hd_fill.fillna(0.7))
base_dep=B.cupo.values*B.hd_fill.fillna(0.7).values
M={'modelo':met(oof),'cupo':met(base_cupo),'historial':met(base_hist),'depto':met(base_dep)}
hm=(B.h_tiene==1).values
M['modelo_con_hist']=met(oof,m=hm); M['modelo_sin_hist']=met(oof,m=~hm); M['historial_con_hist']=met(base_hist,m=hm)
cover=float(((y>=o10)&(y<=o90)).mean()); bajo90=float((y<=o90).mean())
# respaldo temporal estricto: entrenar en 2025-1 (sin historial) y probar en 2025-2
F2=['cupo','dep_c','ini','hsem','sab','noche','sinaula','ngrupos']
mt=HistGradientBoostingRegressor(max_iter=150,learning_rate=0.05,max_leaf_nodes=7,min_samples_leaf=10,l2_regularization=1.0,random_state=7,categorical_features=[1]).fit(A[F2].values,A.ins.values)
M['temporal_sin_hist']=met(np.clip(mt.predict(B[F2].values),0,None))
# importancia por permutación (modelo final sobre todo 2025-2, evaluada fuera de muestra en un pliegue)
tr,te=next(GroupKFold(n_splits=5).split(X,y,grp)); mf=mk().fit(X[tr],y[tr])
pi=permutation_importance(mf,X[te],y[te],n_repeats=8,random_state=7,scoring='neg_mean_absolute_error')
imp=sorted([[NOM[f],round(float(v),3)] for f,v in zip(FE,pi.importances_mean)],key=lambda t:-t[1])
B['p50']=np.round(oof,1); B['p90']=np.ceil(o90); B['p10']=np.floor(o10)
dn=df.groupby('DEPTO_MATERIA').NOM_DEPTO_MATERIA.first().str.strip()
pd_=B.groupby('dep').apply(lambda x: pd.Series({'n':len(x),'mae':np.abs(x.p50-x.ins).mean(),'mae_cupo':np.abs(x.cupo-x.ins).mean(),'ins':x.ins.sum(),'pred':x.p50.sum(),'cupo':x.cupo.sum()})).reset_index()
pd_['nom']=pd_.dep.map(dn)
out={'generado':datetime.date.today().isoformat(),'periodo':'2025-2','entrenado_con':'grupos de la Facultad: 2025-1 (historial) y 2025-2 (validación cruzada por curso, 5 pliegues)','alcance':'Facultad de IA e Ingenierías (departamentos de Ingeniería y de Sistemas e Informática)',
 'n_grupos':int(len(B)),'n_cursos':int(B.curso.nunique()),'metricas':M,'cobertura_p10_p90':round(cover,3),'bajo_p90':round(bajo90,3),'importancia':imp,
 'totales':{'inscritos':int(y.sum()),'pred':int(round(oof.sum())),'cupo':int(base_cupo.sum()),'p90':int(o90.sum())},
 'deptos':[[r.dep,r.nom,int(r.n),round(r.mae,2),round(r.mae_cupo,2),int(r.ins),int(round(r.pred)),int(r.cupo)] for r in pd_.itertuples()],
 'grupos':{str(int(r.CLASE)):[r.p50,int(r.p90),int(r.p10),int(r.ins),int(r.cupo),int(r.h_tiene)] for r in B.itertuples()}}
open('entregables/asignador-aulas/pred.js','w').write('window.PRED='+json.dumps(out,ensure_ascii=False,separators=(',',':'))+';')
print(json.dumps(M,indent=1)); print('cobertura',cover,'bajo p90',bajo90); print(imp); print(out['totales'])
