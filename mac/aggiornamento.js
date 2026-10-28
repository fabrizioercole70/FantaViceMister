// Aggiornamenti per Mac (gratuito, senza firma Apple): legge il manifest mac.json su GitHub e, se c'e una versione
// piu recente, la Home la mostra; AGGIORNA ORA apre la pagina ufficiale di download nel browser.
// Nessuna sostituzione automatica dell'app (su macOS senza firma Apple non sarebbe affidabile). Nessun PowerShell.
const { app, shell } = require('electron');
const fs = require('fs');
const path = require('path');
const https = require('https');

// UNICA fonte del numero di versione (stesso formato di Windows: 1.3.6.3 = 1.3.6 rev. 3)
const VERSIONE = '1.3.6.3';
const MANIFEST = 'https://raw.githubusercontent.com/fabrizioercole70/FantaViceMister/main/mac.json';
const PAGINA_UFFICIALE = 'https://fabrizioercole70.github.io/FantaViceMister/';
const PAGINA_MAC = PAGINA_UFFICIALE + 'mac.html';

// Anteprima su Windows: attiva SOLO se accanto al codice c'e il file ANTEPRIMA_LOCALE (mai incluso nella build Mac)
const ANTEPRIMA = fs.existsSync(path.join(__dirname, 'ANTEPRIMA_LOCALE'));

const cartella = () => path.join(app.getPath('userData'), 'aggiornamenti');
function registra(t) { try { fs.mkdirSync(cartella(), { recursive: true }); fs.appendFileSync(path.join(cartella(), 'aggiornamento.log'), new Date().toISOString() + ' [mac ' + VERSIONE + '] ' + t + '\n'); } catch (e) {} }

function confronta(a, b) {
  const x = String(a).split('.').map(Number), y = String(b).split('.').map(Number);
  for (let i = 0; i < Math.max(x.length, y.length); i++) { const d = (x[i] || 0) - (y[i] || 0); if (d) return d > 0 ? 1 : -1; }
  return 0;
}
function leggiTesto(u) {
  return new Promise((ok, ko) => {
    const req = https.get(u, { headers: { 'User-Agent': 'FantaViceMister-Mac/' + VERSIONE }, timeout: 20000 }, (r) => {
      if (r.statusCode !== 200) { r.resume(); return ko(new Error('HTTP ' + r.statusCode)); }
      let s = ''; r.setEncoding('utf8'); r.on('data', (c) => { s += c; if (s.length > 100000) req.destroy(); }); r.on('end', () => ok(s));
    });
    req.on('timeout', () => req.destroy(new Error('tempo scaduto')));
    req.on('error', ko);
  });
}

let stato = null;
async function controlla() {
  stato = { installata: VERSIONE, nuova: null, portatile: true, completato: null, fallito: null, errore: '', pagina: PAGINA_MAC };
  try {
    const m = JSON.parse(await leggiTesto(MANIFEST));
    if (!m || !/^\d+(\.\d+){2,3}$/.test(m.versione)) { stato.errore = 'manifest non valido'; registra('manifest non valido'); }
    else if (confronta(m.versione, VERSIONE) > 0) {
      // solo pagine del sito ufficiale; altrimenti la guida Mac
      const pagina = typeof m.pagina === 'string' && m.pagina.startsWith(PAGINA_UFFICIALE) ? m.pagina : PAGINA_MAC;
      stato.nuova = { versione: m.versione, data: String(m.data || ''), novita: (Array.isArray(m.novita) ? m.novita : []).map(String).slice(0, 20) };
      stato.pagina = pagina;
      registra('disponibile ' + m.versione);
    }
  } catch (e) { stato.errore = 'controllo non riuscito'; registra('controllo non riuscito: ' + e.message); }
  return stato;
}
function statoPubblico() { return stato ? Object.assign({}, stato) : null; }

// AGGIORNA ORA (dopo la conferma dell'utente in main.js): apre la pagina ufficiale nel browser predefinito
async function aggiornaOra() {
  if (!stato || !stato.nuova) return { ok: false, errore: 'nessun aggiornamento disponibile' };
  try { await shell.openExternal(stato.pagina); registra('pagina di download aperta: ' + stato.pagina); return { ok: false, aperto: true }; }
  catch (e) { registra('pagina non aperta: ' + e.message); return { ok: false, errore: 'pagina non aperta' }; }
}

module.exports = { VERSIONE, ANTEPRIMA, controlla, statoPubblico, aggiornaOra, registra };
