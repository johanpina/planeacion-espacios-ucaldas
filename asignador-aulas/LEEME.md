# Asignador Inteligente de Aulas

Predicción de inscritos por grupo y sistema multiagente que propone cambios de aula.
Desarrollado en el marco de la ODS 1038 de 2025 · Facultad de Inteligencia Artificial e Ingenierías, Universidad de Caldas.

En línea: https://johanpina.github.io/planeacion-espacios-ucaldas/

## Cómo abrirlo

Abra `index.html` con doble clic. Necesita la carpeta `planeador-espacios` al lado, porque usa sus datos (`../planeador-espacios/data.js`).

## Qué trae

| Archivo | Para qué sirve |
|---|---|
| `index.html`, `app.js`, `styles.css` | Interfaz |
| `agentes.js` | Sistema multiagente (Predictor, Auditor, departamentos, edificios, Coordinador) |
| `pred.js` | Predicciones y métricas del modelo, generadas por `train_demanda.py` |
| `train_demanda.py` | Entrena y valida el modelo de predicción de inscritos |
| `verificar.js` | Ejecuta el sistema fuera del navegador y verifica las restricciones |

## Actualizar con un periodo nuevo

1. Reemplace el archivo de programación y ejecute `prep_data.py` (carpeta del planeador).
2. Reentrene el modelo: `python train_demanda.py` (requiere pandas, scikit-learn y openpyxl; se ejecuta desde la raíz del proyecto).
3. Verifique: `node verificar.js`.

Los códigos de ciclo (1860, 1870) y el nombre del periodo están en la parte superior de cada script.

## Límites

- El modelo se entrenó con dos periodos (2025-1 y 2025-2); debe reentrenarse cada semestre.
- Las aulas especializadas se identifican por su nombre y quedan por fuera de la asignación.
- El archivo fuente no trae equipamiento ni distancias entre edificios: la propuesta es un insumo para quien programa las aulas, no una asignación definitiva.
