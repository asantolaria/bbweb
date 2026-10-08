# Fuentes de los datos de juego

Los perfiles de los 30 equipos no se han inventado ni copiado de un libro: se han tomado
de fuentes públicas y contrastado entre ellas. Esto documenta de dónde sale cada cosa y
qué hacer cuando las fuentes no coinciden.

## Qué se ha usado

| Fuente | Qué se ha sacado |
|---|---|
| [bloodbowlbase.ru/bb2025/core_rules](https://bloodbowlbase.ru/bb2025/core_rules/) | Atributos (MA/ST/AG/PA/AV), habilidades y cantidades por posicional. Recoge las erratas publicadas. |
| Nuffle Zone | Costes, precios de re-roll y los **nombres castellanos** de posicionales y habilidades. |
| Base de plantillas 2025 de FUMBBL (publicada en GitHub) | Volcado completo de los 30 equipos, usado para no tener que leer 30 páginas una a una. |

Las tres se cruzaron entre sí. Coinciden, incluido el caso del Goblin orco con PA 4+.

## Reglas de desempate

1. **Atributos y cantidades → bloodbowlbase.** Es la que incorpora las erratas. Ejemplo
   resuelto: el Goblin de los Orcos tiene **PA 4+**, no 3+.
2. **Nombres y costes → Nuffle Zone**, para que coincidan con lo que se usa en mesa.
3. Cuando Nuffle Zone se contradice a sí misma se elige una forma y se usa siempre.
   Ejemplo: *Unsteady* aparece como «Inestable» y como «Tembloroso»; en la app es siempre
   **«Inestable»**.

## Traducciones propias

Unas **30 habilidades poco comunes** no aparecían en las fuentes consultadas en
castellano. Llevan traducción propia y se muestran con el nombre inglés entre paréntesis
para poder buscarlas en el reglamento:

```
Mirada Hipnótica (Hypnotic Gaze)
```

Si en tu grupo usáis otra traducción, cambiarla es editar la cadena `sk` del posicional en
`RACES` (ver `docs/design/architecture.md`).

## Advertencia

Los perfiles son **datos de juego**, no texto del reglamento. Este repositorio no
reproduce reglas, ilustraciones ni texto con copyright de Games Workshop. Para jugar hace
falta el reglamento; la app solo lleva la cuenta.

Las estadísticas conviene revisarlas contra la edición concreta que uséis: la app apunta a
**Season 3 (2025)**.
