# ADR 002 — Ningún nombre propio dentro del motor

**Fecha:** 2026-10-08 · **Estado:** aceptada

## Contexto

Las **mecánicas** de un juego no son objeto de copyright: implementar «2D6 contra la
armadura» no requiere permiso. Lo que sí está protegido es la **expresión**: el texto del
reglamento, las ilustraciones y, sobre todo, los **nombres**. «Blood Bowl» es marca
registrada de Games Workshop, igual que Nuffle, Skaven, Khorne, Nurgle o los jugadores
estrella. Además existe un videojuego con licencia, lo que hace de un juego online
gratuito con ese nombre el caso más incómodo posible.

Mientras el proyecto sea privado esto da igual. Si algún día se publica, deja de darlo, y
para entonces renombrar no puede costar una reescritura.

## Decisión

**El motor no conoce ningún nombre propio.** Trabaja solo con identificadores estables:

```js
{ pos: 'human_blitzer', skills: ['block', 'tackle'], team: 'human' }
```

Cómo se llama cada identificador en pantalla vive en una capa aparte
(`src/data/nombres.es.js`), que el motor jamás importa. Las reglas se escriben contra
`skills.includes('block')`, nunca contra la cadena «Placar».

## Consecuencias

- Cambiar a una ambientación propia = reescribir **un archivo**, sin tocar reglas ni tests.
- Traducir la app = otro archivo más. El inglés sale gratis.
- Los tests del motor son legibles y estables: no se rompen al retocar un nombre.
- Disciplina requerida: cualquier `if` que compare contra texto visible es un error de
  diseño, no un atajo.

## Norma de contenido

**El texto del reglamento no entra en el repositorio**, igual que en
`bloodbowl-my-rosters` («copia local, no publicada»). El código cita las reglas en
comentarios de una línea para poder rastrear cada decisión hasta su fuente, nunca copiando
párrafos. Las tablas de juego (valores, rangos, modificadores) son datos, no expresión, y
sí se implementan.
