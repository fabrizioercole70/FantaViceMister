// Inietta Fanta Vice Mister nel mondo della pagina all'inizio del caricamento (equivalente di @run-at document-start, @inject-into page)
const { webFrame, contextBridge, ipcRenderer } = require('electron');
const fs = require('fs');
const path = require('path');

const AMMESSI = ['leghe.fantacalcio.it', 'www.fantaclub.it', 'fantaclub.it'];
const h = location.hostname;
const ok = AMMESSI.includes(h) || (h === 'fabrizioercole70.github.io' && location.pathname.startsWith('/FantaViceMister/'));

if (ok && window === window.top) {
  // Unico comando esposto alla pagina: disconnetti e chiudi il programma (nessuna API generica)
  contextBridge.exposeInMainWorld('fvmWindows', {
    esciEChiudi: () => ipcRenderer.send('fvm-esci-chiudi'),
    statoAggiornamento: () => ipcRenderer.invoke('fvm-agg-stato'),
    aggiornaOra: () => ipcRenderer.invoke('fvm-agg-ora')
  });
  try {
    const codice = fs.readFileSync(path.join(__dirname, 'fvm', 'FantaViceMister.user.js'), 'utf8');
    const versione = String(ipcRenderer.sendSync('fvm-versione') || '').replace(/[^0-9.]/g, '');
    webFrame.executeJavaScript('window.__FVM_PIATTAFORMA__="mac";window.__FVM_VERSIONE__="' + versione + '";\n' + codice + '\n//# sourceURL=FantaViceMister.user.js');
  } catch (e) { console.error('FVM: iniezione non riuscita', e); }
}
