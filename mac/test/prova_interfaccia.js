// Prova automatica NON invasiva dell'interfaccia FVM (macOS su GitHub Actions o anteprima su Windows).
// Si collega all'app avviata con --remote-debugging-port, legge versione e piattaforma, apre la Home FVM,
// fotografa la Home a 1440 e 800 px, apre l'Area Admin (senza codice) e raccoglie gli errori JavaScript.
// Nessun accesso, nessun salvataggio, nessun invio. Uso: node prova_interfaccia.js <porta> <cartella-risultati>
const fs = require('fs'), path = require('path');
const porta = process.argv[2] || '9222', out = process.argv[3] || 'risultati';
fs.mkdirSync(out, { recursive: true });
const attesa = (ms) => new Promise((r) => setTimeout(r, ms));
const esiti = [], errori = [];
// ok: true = OK, false = NO, 'NV' = non verificabile (controllo non eseguito davvero: mai un falso OK)
function esito(nome, ok, dettaglio) { const e = ok === 'NV' ? 'NON VERIFICABILE' : ok ? 'OK' : 'NO'; esiti.push({ prova: nome, esito: e, dettaglio: dettaglio || '' }); console.log((ok === 'NV' ? 'NV ' : ok ? 'OK ' : 'NO ') + nome + (dettaglio ? ' · ' + dettaglio : '')); }

async function pagina() {
  for (let i = 0; i < 60; i++) {
    try { const l = await (await fetch('http://127.0.0.1:' + porta + '/json')).json(); const p = l.find((x) => x.type === 'page' && /^https:/.test(x.url)); if (p) return p; } catch (e) {}
    await attesa(1000);
  }
  throw new Error('app non raggiungibile sulla porta ' + porta);
}

(async () => {
  const p = await pagina();
  esito('avvio app e pagina caricata', true, p.url.split('?')[0]);
  const ws = new WebSocket(p.webSocketDebuggerUrl);
  await new Promise((r, k) => { ws.onopen = r; ws.onerror = k; });
  let id = 0; const att = {};
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data);
    if (d.id && att[d.id]) { att[d.id](d); delete att[d.id]; }
    if (d.method === 'Runtime.exceptionThrown' && !/FVM: schermata aperta/.test(JSON.stringify(d.params))) errori.push( // blocco video voluto da FVM: non e un errore
      (d.params.exceptionDetails.exception || {}).description || d.params.exceptionDetails.text);
  };
  const cdp = (method, params) => new Promise((r) => { const i = ++id; att[i] = r; ws.send(JSON.stringify({ id: i, method, params: params || {} })); });
  const val = async (expr) => ((await cdp('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result.result || {}).value;
  const foto = async (nome) => { const r = await cdp('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(out, nome + '.png'), Buffer.from(r.result.data, 'base64')); };
  await cdp('Runtime.enable'); await cdp('Page.enable');
  await attesa(8000);

  const RADICE = '[...document.querySelectorAll("*")].map(e=>e.shadowRoot).find(r=>r&&r.querySelector("style")&&r.querySelector("style").textContent.indexOf("fvm-home")>=0)';
  const info = await val('JSON.stringify({v:window.__FVM_VERSIONE__,p:window.__FVM_PIATTAFORMA__,ponte:!!(window.fvmWindows&&window.fvmWindows.statoAggiornamento),ua:navigator.userAgent})');
  const I = JSON.parse(info || '{}');
  esito('script FVM iniettato (versione da unica fonte)', /^\d+\.\d+\.\d+\.\d+$/.test(I.v || ''), I.v);
  esito('piattaforma mac', I.p === 'mac', I.p);
  esito('ponte aggiornamenti presente', !!I.ponte);
  esito('sistema operativo del test', true, /Mac OS X/.test(I.ua) ? 'macOS (vero)' : 'NON macOS (anteprima)');
  const stato = await val('window.fvmWindows.statoAggiornamento().then(s=>JSON.stringify(s))');
  const S = JSON.parse(stato || '{}');
  // mac.json non ancora pubblicato: il controllo fallisce in modo previsto → NON VERIFICABILE, non OK
  esito('controllo aggiornamenti mac.json', !stato ? false : S.errore ? 'NV' : true, S.errore ? 'manifest non raggiungibile (' + S.errore + '): mac.json non pubblicato' : 'installata ' + S.installata + ', nuova ' + (S.nuova ? S.nuova.versione : 'nessuna'));

  // banner cookie del sito: «Continua senza accettare» (nessun consenso facoltativo), se presente
  const TROVA = '[...document.querySelectorAll("a,button,span,div,p")].filter(x=>/^\\s*(Continua senza accettare|Continue without accepting)\\s*$/i.test(x.textContent||"")&&x.offsetParent).pop()';
  let cookie = 'assente';
  for (let i = 0; i < 10; i++) {
    const r = await val('(function(){var e=' + TROVA + ';if(!e)return "assente";e.click();return "cliccato"})()');
    if (r === 'cliccato') cookie = 'cliccato';
    await attesa(1500);
    if (cookie === 'cliccato' && (await val('!(' + TROVA + ')'))) { cookie = 'chiuso'; break; }
  }
  // OK solo se il banner e stato chiuso o non e mai comparso; ricontrollo finale che non sia ancora visibile
  const ancora = await val('!!(' + TROVA + ')');
  esito('banner cookie del sito', !ancora && cookie !== 'cliccato', ancora ? 'ancora visibile: foto non attendibili' : cookie);
  // apre la Home FVM: pulsante tondo FVM, se presente (alcune pagine di accesso non lo mostrano)
  const aperta = await val('(function(){var r=' + RADICE + ';if(!r)return "radice assente";var f=r.querySelector(".fab");if(!f)return "pulsante FVM assente";f.click();return "ok"})()');
  await attesa(2500);
  for (const [nome, w] of [['home_1440', 1440], ['home_800', 800]]) {
    await cdp('Emulation.setDeviceMetricsOverride', { width: w, height: 900, deviceScaleFactor: 1, mobile: false });
    await attesa(800); await foto(nome);
  }
  const home = JSON.parse(await val('(function(){var r=' + RADICE + ';var h=r&&r.querySelector(".fvm-home");if(!h)return JSON.stringify({});var t=r.querySelector(".hero .ht");return JSON.stringify({col:h.querySelectorAll(".fvm-col").length,titolo:t?t.innerText.replace(/\\s+/g," ").trim():"",scroll:document.documentElement.scrollWidth>innerWidth})})()') || '{}');
  esito('Home FVM aperta', aperta === 'ok' && home.col === 2, aperta + (home.col ? ' · colonne ' + home.col : ''));
  if (home.titolo) esito('titolo «FANTA VICE MISTER»', /FANTA VICE MISTER/.test(home.titolo), home.titolo);

  await cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  const admin = await val('(function(){var r=' + RADICE + ';var b=r&&r.querySelector("[data-a=admin]");if(!b)return "pulsante AREA ADMIN assente";b.click();return "ok"})()');
  await attesa(1500); await foto('area_admin');
  const testa = await val('(function(){var r=' + RADICE + ';return !!(r&&r.querySelector(".fvm-admin-testa img"))})()');
  esito('Area Admin (senza codice)', admin === 'ok' && testa, admin);

  esito('nessun errore JavaScript', !errori.length, errori.slice(0, 3).join(' | '));
  fs.writeFileSync(path.join(out, 'esiti.json'), JSON.stringify({ esiti, errori, info: I }, null, 2));
  ws.close();
  process.exit(esiti.some((e) => e.esito === 'NO' && /iniettato|avvio/.test(e.prova)) ? 1 : 0);
})().catch((e) => { console.log('NO prova interrotta · ' + e.message); fs.writeFileSync(path.join(out, 'esiti.json'), JSON.stringify({ esiti, errori, errore: e.message }, null, 2)); process.exit(1); });
