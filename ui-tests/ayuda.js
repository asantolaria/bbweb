// Arnés de las pruebas de interfaz (E2-S01): servidor estático sin dependencias,
// Chrome del sistema vía Playwright (dependencia solo de desarrollo), service worker
// bloqueado (siempre se prueba el código del disco) y recogida de errores de consola.

import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const RAIZ = fileURLToPath(new URL('..', import.meta.url));
const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json',
  '.png': 'image/png', '.css': 'text/css',
};

export async function arrancar() {
  const servidor = http.createServer(async (req, res) => {
    const ruta = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname));
    const fichero = join(RAIZ, ruta.endsWith('/') ? ruta + 'index.html' : ruta);
    if (!fichero.startsWith(RAIZ)) { res.writeHead(403).end(); return; }
    try {
      const cuerpo = await readFile(fichero);
      res.writeHead(200, { 'content-type': TIPOS[extname(fichero)] ?? 'application/octet-stream' }).end(cuerpo);
    } catch {
      res.writeHead(404).end();
    }
  });
  await new Promise((ok) => servidor.listen(0, '127.0.0.1', ok));
  const base = `http://127.0.0.1:${servidor.address().port}/`;

  const navegador = await chromium.launch(
    process.env.PW_CHROMIUM ? {} : { channel: 'chrome' },   // Chrome del sistema
  );
  return {
    base,
    async pagina({ estado = null, viewport = { width: 390, height: 800 } } = {}) {
      const ctx = await navegador.newContext({ viewport, serviceWorkers: 'block' });
      const pagina = await ctx.newPage();
      const errores = [];
      pagina.on('pageerror', (e) => errores.push(e.message));
      pagina.on('console', (m) => {
        if (m.type() === 'error' && !/favicon/.test(m.text())) errores.push(m.text());
      });
      if (estado) {
        await pagina.addInitScript((txt) => {
          if (!sessionStorage.getItem('__inyectado')) {
            localStorage.setItem('bbweb-v1', txt);
            sessionStorage.setItem('__inyectado', '1');
          }
        }, JSON.stringify(estado));
      }
      return { pagina, errores, ctx };
    },
    async cerrar() {
      await navegador.close();
      await new Promise((ok) => servidor.close(ok));
    },
  };
}

/** Pulsa un selector y espera a que la interfaz respire. */
export async function pulsar(pagina, selector) {
  await pagina.locator(selector).first().click();
  await pagina.waitForTimeout(120);
}

/** Estado actual del partido según el guardado de la app. */
export const estadoDe = (pagina) =>
  pagina.evaluate(() => JSON.parse(localStorage.getItem('bbweb-v1')));

/** Pasa todas las tarjetas de resultado y devuelve sus títulos. */
export async function leerTarjetas(pagina, titulo = 'Resultado') {
  const vistas = [];
  for (let i = 0; i < 30; i++) {
    const cab = pagina.locator('#wrap:not([hidden]) .sheet h2');
    if (!(await cab.count())) break;                 // sin hoja: no esperar 30 s a que salga
    if ((await cab.first().textContent()) !== titulo) break;
    vistas.push(await pagina.locator('.res-titulo').textContent());
    await pulsar(pagina, 'button[data-act="res_sig"]');
  }
  return vistas;
}

/** Cierra intersticiales y modales de fase que estén delante («¡A jugar!», «Continuar»). */
export async function despejar(pagina) {
  for (let i = 0; i < 6; i++) {
    const visto = pagina.locator('#wrap:not([hidden]) button[data-act="visto"]');
    if (await visto.count()) { await pulsar(pagina, '#wrap:not([hidden]) button[data-act="visto"]'); continue; }
    const sig = pagina.locator('#wrap:not([hidden]) button[data-act="res_sig"]');
    if (await sig.count()) { await pulsar(pagina, '#wrap:not([hidden]) button[data-act="res_sig"]'); continue; }
    break;
  }
}
