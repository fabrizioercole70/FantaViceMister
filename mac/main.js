const { app, BrowserWindow, shell, Menu, ipcMain, session, dialog } = require('electron');
const path = require('path');
const agg = require('./aggiornamento');
// ANTEPRIMA MAC su Windows (file ANTEPRIMA_LOCALE, mai nella build Mac): dati separati e nessuna scrittura sui siti
if (agg.ANTEPRIMA) app.setPath('userData', path.join(app.getPath('appData'), 'Fanta Vice Mister MAC ANTEPRIMA'));
const MAC = process.platform === 'darwin';

const AMMESSI = ['leghe.fantacalcio.it', 'www.fantaclub.it', 'fantaclub.it', 'fabrizioercole70.github.io'];
// Domini necessari al login (restano nella finestra)
const LOGIN = ['fantacalcio.it', 'accounts.google.com', 'appleid.apple.com'];

function interno(url) {
  try {
    const h = new URL(url).hostname;
    return AMMESSI.includes(h) || LOGIN.some(d => h === d || h.endsWith('.' + d));
  } catch (e) { return false; }
}

function creaFinestra(url) {
  const win = new BrowserWindow({
    width: 1200, height: 900, icon: path.join(__dirname, 'icona.png'),
    title: agg.ANTEPRIMA ? 'Fanta Vice Mister · ANTEPRIMA MAC su Windows (invii bloccati)' : 'Fanta Vice Mister', autoHideMenuBar: !MAC && !agg.ANTEPRIMA,
    minWidth: 380, minHeight: 500,
    webPreferences: {
      partition: 'persist:fvm',
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, sandbox: false, nodeIntegration: false
    }
  });
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (interno(url)) { creaFinestra(url); return { action: 'deny' }; }
    shell.openExternal(url); return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (!interno(url)) { e.preventDefault(); shell.openExternal(url); }
  });
  if (agg.ANTEPRIMA) win.on('page-title-updated', (e) => e.preventDefault());
  win.loadURL(url);
  return win;
}

Menu.setApplicationMenu(Menu.buildFromTemplate([
  { label: 'Fanta Vice Mister', submenu: [
    { label: 'Indietro', accelerator: MAC ? 'Cmd+[' : 'Alt+Left', click: (m, w) => w && w.webContents.navigationHistory.goBack() },
    { label: 'Ricarica', role: 'reload' },
    { label: 'Leghe Fantacalcio', click: (m, w) => w && w.loadURL('https://leghe.fantacalcio.it/') },
    { label: 'Fantaclub', click: (m, w) => w && w.loadURL('https://www.fantaclub.it/') },
    { type: 'separator' }, { label: 'Strumenti sviluppatore', role: 'toggleDevTools' },
    { label: 'Esci da Fanta Vice Mister', role: 'quit' }
  ]},
  // Mac: menu Modifica standard → Cmd+Z, Cmd+X, Cmd+C, Cmd+V, Cmd+A nei campi di accesso e nelle pagine
  { label: 'Modifica', submenu: [
    { label: 'Annulla', role: 'undo' }, { label: 'Ripeti', role: 'redo' }, { type: 'separator' },
    { label: 'Taglia', role: 'cut' }, { label: 'Copia', role: 'copy' }, { label: 'Incolla', role: 'paste' },
    { label: 'Seleziona tutto', role: 'selectAll' }
  ]},
  { label: 'Finestra', submenu: [{ label: 'Riduci', role: 'minimize' }, { label: 'Zoom', role: 'zoom' }, { label: 'Schermo intero', role: 'togglefullscreen' }, { label: 'Chiudi finestra', role: 'close' }] }
]));

// CHIUDI della Home FVM: uscita dai siti, via le credenziali della sola sessione persist:fvm, chiusura del processo.
// I dati di FVM (storico, preferenze) restano: si cancellano solo cookie e cache di autenticazione.
let chiusura = false;
ipcMain.on('fvm-esci-chiudi', async (e) => {
  let h = '';
  try { h = new URL(e.senderFrame.url).hostname; } catch (x) {}
  if (chiusura || !AMMESSI.includes(h)) return;
  chiusura = true;
  const s = session.fromPartition('persist:fvm');
  const esci = (u) => Promise.race([s.fetch(u).catch(() => {}), new Promise(r => setTimeout(r, 4000))]);
  await Promise.all([esci('https://leghe.fantacalcio.it/logout'), esci('https://www.fantaclub.it/servlet/Logout')]);
  try { await s.clearStorageData({ storages: ['cookies'] }); await s.clearAuthCache(); await s.cookies.flushStore(); } catch (x) {}
  app.exit(0);
});

// AGGIORNA ORA: solo due richieste, solo dalle pagine ammesse
function mittenteOk(e) { try { return AMMESSI.includes(new URL(e.senderFrame.url).hostname); } catch (x) { return false; } }
// unica fonte del numero di versione per lo script (intestazioni, diagnosi, confronti)
ipcMain.on('fvm-versione', (e) => { e.returnValue = agg.VERSIONE; });
let controllo = null;
ipcMain.handle('fvm-agg-stato', (e) => mittenteOk(e) ? (controllo || (controllo = agg.controlla())).then(() => agg.statoPubblico()) : null);
// Nessun download senza azione esplicita: la richiesta della pagina apre una finestra di conferma NATIVA del programma
// (la pagina non puo rispondere al posto dell'utente); si procede solo con «AGGIORNA ORA».
ipcMain.handle('fvm-agg-ora', async (e) => {
  if (!mittenteOk(e) || chiusura) return { ok: false, errore: 'non ammesso' };
  const s = agg.statoPubblico();
  agg.registra('richiesta AGGIORNA ORA dalla pagina ' + e.senderFrame.url.split('?')[0]);
  if (!s || !s.nuova) return { ok: false, errore: 'nessun aggiornamento disponibile' };
  const w = BrowserWindow.fromWebContents(e.sender);
  const r = await dialog.showMessageBox(w, { type: 'question', title: 'Fanta Vice Mister', buttons: ['AGGIORNA ORA', 'Annulla'], defaultId: 1, cancelId: 1, noLink: true,
    message: 'Aprire la pagina di download di Fanta Vice Mister ' + s.nuova.versione + '?', detail: "Si apre la pagina ufficiale nel browser: scarica la nuova versione e sostituisci l'app nella cartella Applicazioni. Accesso, impostazioni e storico restano invariati." });
  if (r.response !== 0) { agg.registra('AGGIORNA ORA annullato dall utente'); return { ok: false, annullato: true, errore: 'annullato' }; }
  agg.registra('AGGIORNA ORA confermato dall utente');
  return agg.aggiornaOra();
});

if (!app.requestSingleInstanceLock()) app.quit();
app.whenReady().then(() => {
  // ANTEPRIMA: blocca ogni scrittura verso Leghe Fantacalcio e Fantaclub (salvataggi, invii), tranne accesso/uscita
  if (agg.ANTEPRIMA) session.fromPartition('persist:fvm').webRequest.onBeforeRequest((d, cb) => {
    let h = ''; try { h = new URL(d.url).hostname; } catch (x) {}
    const sito = h === 'leghe.fantacalcio.it' || h.endsWith('fantaclub.it');
    const scrive = !['GET', 'HEAD', 'OPTIONS'].includes(d.method);
    const accesso = /login|logout|signin|auth|account|token|refresh/i.test(d.url);
    if (sito && scrive && !accesso) { agg.registra('ANTEPRIMA: bloccata ' + d.method + ' ' + d.url.split('?')[0]); return cb({ cancel: true }); }
    cb({});
  });
  creaFinestra('https://leghe.fantacalcio.it/');
});
// Mac: clic sull'icona nel Dock senza finestre aperte → nuova finestra
app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) creaFinestra('https://leghe.fantacalcio.it/'); });
app.on('window-all-closed', () => app.quit());
