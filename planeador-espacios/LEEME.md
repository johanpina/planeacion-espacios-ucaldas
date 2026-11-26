# Planeador de Capacidad y Espacios

Herramienta web de la Facultad de Inteligencia Artificial e Ingenierías (Universidad de Caldas) para estimar la capacidad instalada de aulas, encontrar espacios libres y simular el ingreso de programas nuevos. Desarrollada en el marco de la ODS 1038 de 2025.

## Cómo abrirla

No requiere instalación. Dos opciones:

1. Doble clic en `index.html` (funciona sin internet).
2. Publicarla en cualquier alojamiento de archivos estáticos (servidor de la Universidad, GitHub Pages, Vercel, Netlify) subiendo los cuatro archivos: `index.html`, `styles.css`, `app.js`, `data.js`.

## Qué hace cada pestaña

| Pestaña | Para qué sirve |
|---|---|
| Panorama | Ocupación por día, hora y edificio. Filtros de periodo, edificio y departamento. |
| Aulas | Inventario de las 247 aulas con ocupación, llenado y sobrecupos. Clic en una fila: horario semanal. |
| Buscar espacio | Aulas libres para una franja y un tamaño de grupo, ordenadas por mejor ajuste. |
| Simular programa nuevo | Ubica las clases de un programa nuevo y calcula cuántas cohortes soporta la infraestructura. |
| Hallazgos | Diagnóstico automático con detalle descargable en CSV. |
| Metodología | Definiciones, supuestos y límites. |

## Cómo actualizar los datos de un nuevo periodo

1. Pida a Registro Académico el archivo de programación con las mismas columnas de `AULAS 2025.xlsx`.
2. Ajuste en `prep_data.py` la ruta del archivo (`SRC`) y los códigos de ciclo (`CIC`); en `app.js`, las fechas del semestre (`SEM`).
3. Ejecute `python prep_data.py` (requiere `openpyxl`). Se regenera `data.js`.

## Límites

- Solo incluye las aulas que tuvieron programación en 2025.
- No distingue tipo de espacio (laboratorio, sala de cómputo): revise el nombre del aula.
- Los nombres de edificio son la expansión de los códigos del archivo fuente.
- Es apoyo a la decisión; la asignación definitiva corresponde a la oficina que administra los espacios.
