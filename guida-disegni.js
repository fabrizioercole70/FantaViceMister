// Fanta Vice Mister · disegni delle schermate di Safari e Userscripts (ricavati dalle foto reali), comuni alle guide
// iphone.html e aggiornamenti.html. Ogni <span data-fig="nome"> diventa una figura: se esiste la foto foto/<file>.jpg
// viene mostrata quella, altrimenti resta il disegno. Con #stampa nell'indirizzo si aprono tutte le sezioni (per il PDF).
(function () {
  "use strict";
  var G = "#e8bd52", SF = 'font-family="-apple-system,Helvetica,Arial,sans-serif"';
  function cerchio(x, y, r) { return '<circle cx="' + x + '" cy="' + y + '" r="' + r + '" fill="none" stroke="' + G + '" stroke-width="4"/>'; }
  function frecciaSu(x, y, t) { return '<path d="M' + x + ' ' + (y + 22) + ' L' + x + ' ' + (y + 2) + ' M' + (x - 7) + ' ' + (y + 10) + ' L' + x + ' ' + y + ' L' + (x + 7) + ' ' + (y + 10) + '" stroke="' + G + '" stroke-width="4" fill="none" stroke-linecap="round"/><text x="' + x + '" y="' + (y + 38) + '" text-anchor="middle" font-size="14" font-weight="900" fill="' + G + '">' + t + '</text>'; }
  function barra(evid, indirizzo) {
    var c = '<g ' + SF + '><rect width="340" height="150" fill="#0a1e3d"/><rect y="40" width="340" height="110" fill="#e9eef3"/>' +
      '<rect x="14" y="50" width="312" height="40" rx="12" fill="#fff"/>' +
      '<g stroke="#8a96a3" stroke-width="2.4" fill="none"><rect x="28" y="61" width="16" height="11" rx="2"/><path d="M28 77h10M28 81h7"/></g>' +
      '<text x="190" y="76" text-anchor="middle" font-size="15" fill="#5b6a7a">' + (indirizzo || "fabrizioercole70.github.io") + '</text>' +
      '<path d="M308 64a8 8 0 1 0 2 7" stroke="#5b6a7a" stroke-width="2.4" fill="none"/><path d="M304 58l6 5-6 4" stroke="#5b6a7a" stroke-width="2.4" fill="none"/>' +
      '<g stroke="#1a8cff" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M40 112l-9 10 9 10"/><path d="M100 112l9 10-9 10" stroke="#b9c4cf"/>' +
      '<path d="M162 116l8-8 8 8M170 108v18M158 116h-4v16h32v-16h-4"/>' +
      '<path d="M226 112c6-3 12-3 16 1c4-4 10-4 16-1v20c-6-3-12-3-16 1c-4-4-10-4-16-1z"/>' +
      '<rect x="292" y="114" width="16" height="16" rx="3"/><path d="M297 110h14a3 3 0 0 1 3 3v14"/></g>';
    if (evid === "condividi") c += cerchio(170, 120, 22) + frecciaSu(170, 144, "TOCCA QUI: CONDIVIDI");
    if (evid === "indirizzo") c += '<rect x="10" y="46" width="320" height="48" rx="14" fill="none" stroke="' + G + '" stroke-width="4"/><text x="170" y="32" text-anchor="middle" font-size="14" font-weight="900" fill="' + G + '">SCRIVI QUI: leghe.fantacalcio.it</text>';
    var alta = evid === "condividi";
    return { h: alta ? 190 : 150, c: (alta ? '<rect y="150" width="340" height="40" fill="#0a1e3d"/>' : "") + c + "</g>" };
  }
  function paginaCodice() {
    var righe = ["// ==UserScript==", "// @name        Fanta Vice Mister", "// @description Fanta Vice Mister per Safari…", "// @version     1.3.6", "// @match       https://leghe.fantacalcio.it/*", "// …"];
    return { h: 290, c: '<g ' + SF + '><rect width="340" height="290" rx="16" fill="#fff"/>' +
      '<rect width="340" height="30" rx="16" fill="' + G + '"/><rect y="16" width="340" height="14" fill="' + G + '"/><text x="170" y="21" text-anchor="middle" font-size="13" font-weight="900" fill="#102d59">PAGINA DEL CODICE · È NORMALE</text>' +
      righe.map(function (r, i) { return '<text x="14" y="' + (56 + i * 20) + '" font-family="Menlo,Consolas,monospace" font-size="11.5" fill="#222">' + r + "</text>"; }).join("") +
      '<text x="170" y="188" text-anchor="middle" font-size="12" fill="#8a96a3">(e sotto tante altre righe: non serve leggerle)</text>' +
      '<rect y="200" width="340" height="90" fill="#e9eef3"/><rect x="14" y="210" width="312" height="40" rx="12" fill="#fff"/>' +
      '<g stroke="#8a96a3" stroke-width="2.4" fill="none"><rect x="28" y="221" width="16" height="11" rx="2"/><path d="M28 237h10M28 241h7"/></g>' +
      '<text x="190" y="236" text-anchor="middle" font-size="14" fill="#5b6a7a">raw.githubusercontent.com</text>' +
      cerchio(36, 230, 20) + '<text x="36" y="274" font-size="13" font-weight="900" fill="#b8860b">↑ ICONA DELLE ESTENSIONI</text></g>' };
  }
  function menuPagina() {
    return { h: 190, c: '<g ' + SF + '><rect width="340" height="190" rx="16" fill="#eef1f5"/>' +
      '<rect x="12" y="12" width="316" height="44" rx="12" fill="#fff"/><text x="28" y="40" font-size="16" fill="#333">Nascondi distrazioni</text>' +
      '<rect x="12" y="66" width="316" height="100" rx="12" fill="#fff"/><text x="28" y="96" font-size="16" fill="#333">Gestisci le estensioni</text><path d="M28 116h284" stroke="#e1e5ea"/>' +
      '<text x="28" y="146" font-size="16" fill="#333">Userscripts</text><text x="300" y="147" text-anchor="middle" font-size="17" fill="#1a8cff" font-weight="700">‹/›</text>' +
      '<rect x="16" y="120" width="308" height="42" rx="10" fill="none" stroke="' + G + '" stroke-width="4"/><text x="170" y="184" text-anchor="middle" font-size="13" font-weight="900" fill="#b8860b">TOCCA “Userscripts” (icona ‹/›)</text></g>' };
  }
  // finestrella di Userscripts: barra gialla o verde; Demo user script attivo (bianco, JS giallo) o spento (grigio)
  function finestrina(modo, demoAttivo) {
    var txt = modo === "verde" ? "Userscript Installed: Tap to re-install" : "Userscript Detected: Tap to install";
    var c = '<g ' + SF + '><rect width="340" height="200" rx="16" fill="#3b4148"/><rect width="340" height="50" rx="16" fill="#f4f6f8"/><rect y="34" width="340" height="16" fill="#f4f6f8"/>' +
      '<text x="170" y="32" text-anchor="middle" font-size="16" font-weight="700" fill="#222">Userscripts</text><text x="318" y="32" text-anchor="end" font-size="16" font-weight="700" fill="#1a8cff">Fine</text>' +
      '<g stroke="#e9eef3" stroke-width="2.4" fill="none"><rect x="20" y="66" width="22" height="16" rx="2"/><path d="M58 80a8 8 0 0 1 2-14a10 10 0 0 1 18 2a6 6 0 0 1 0 12z"/><path d="M262 66a8 8 0 1 0 2 8"/></g>' +
      '<rect x="282" y="62" width="40" height="22" rx="11" fill="#5ac8fa"/><circle cx="311" cy="73" r="9" fill="#fff"/>' +
      '<rect x="0" y="100" width="340" height="32" fill="' + (modo === "verde" ? "#4cd964" : "#ffd60a") + '"/><text x="170" y="121" text-anchor="middle" font-size="14" font-weight="700" fill="#1d3b1d">' + txt + "</text>";
    if (modo === "gialla" && !demoAttivo) c += '<rect x="3" y="98" width="334" height="36" fill="none" stroke="#ff3b30" stroke-width="4"/>';
    if (modo === "verde" && demoAttivo === "fine") c += '<rect x="270" y="10" width="64" height="32" rx="10" fill="none" stroke="#ff3b30" stroke-width="4"/>';
    var on = demoAttivo === true;
    c += '<text x="20" y="166" font-size="16" fill="' + (on ? "#fff" : "#9aa3ad") + '"' + (on ? ' font-weight="700"' : "") + '>Demo user script</text><text x="320" y="166" text-anchor="end" font-size="13" font-weight="700" fill="' + (on ? "#ffd60a" : "#9aa3ad") + '">JS</text>';
    if (on) c += '<rect x="8" y="144" width="324" height="34" rx="10" fill="none" stroke="' + G + '" stroke-width="4"/><text x="170" y="194" text-anchor="middle" font-size="12" font-weight="900" fill="' + G + '">TOCCA QUI UNA VOLTA: JS DIVENTA GRIGIO</text>';
    return { h: 200, c: c + "</g>" };
  }
  function installa() {
    return { h: 250, c: '<g ' + SF + '><rect width="340" height="250" rx="16" fill="#3b4148"/>' +
      '<text x="170" y="30" text-anchor="middle" font-size="16" font-weight="700" fill="#fff">← Install Userscript</text><path d="M0 46h340" stroke="#555"/>' +
      '<text x="20" y="76" font-size="19" font-weight="800" fill="#fff">Fanta Vice Mister</text><text x="20" y="98" font-size="12" fill="#c9d2df">Fanta Vice Mister per Safari (iPhone e Mac)…</text>' +
      '<rect x="16" y="112" width="308" height="44" rx="8" fill="#2a2f35"/><text x="30" y="132" font-size="11.5" fill="#fff">⚠ Be sure you trust the author before installing…</text><text x="30" y="148" font-size="11" fill="#c9d2df">(avviso standard di Userscripts: è normale)</text>' +
      '<text x="170" y="178" text-anchor="middle" font-size="13" font-weight="900" fill="' + G + '">↑ SCORRI UN PO\' SE NON VEDI “Install”</text>' +
      '<rect x="20" y="192" width="300" height="44" rx="12" fill="#1a8cff"/><text x="170" y="220" text-anchor="middle" font-size="17" font-weight="800" fill="#fff">Install</text><rect x="16" y="188" width="308" height="52" rx="14" fill="none" stroke="' + G + '" stroke-width="4"/></g>' };
  }
  function impostazioni() {
    return { h: 120, c: '<g ' + SF + '><rect width="340" height="120" rx="16" fill="#f2f2f7"/>' +
      '<text x="20" y="30" font-size="14" fill="#1a8cff">‹ Estensioni</text><text x="170" y="30" text-anchor="middle" font-size="15" font-weight="700" fill="#111">Userscripts</text>' +
      '<rect x="12" y="50" width="316" height="52" rx="12" fill="#fff"/><text x="28" y="82" font-size="16" fill="#111">Consenti estensione</text>' +
      '<rect x="262" y="62" width="52" height="30" rx="15" fill="#34c759"/><circle cx="299" cy="77" r="13" fill="#fff"/>' +
      '<rect x="256" y="57" width="64" height="40" rx="20" fill="none" stroke="' + G + '" stroke-width="3"/></g>' };
  }
  function homeFvm() {
    return { h: 300, c: '<g ' + SF + '><rect width="340" height="300" rx="16" fill="#0a1e3d"/>' +
      '<rect x="12" y="12" width="316" height="62" rx="12" fill="#12305a"/><text x="26" y="32" font-size="11" font-weight="900" fill="' + G + '" letter-spacing="2">ACCESSO PIATTAFORMA</text>' +
      '<text x="26" y="58" font-size="18" font-weight="900" fill="#4ade80">● Connesso ✓</text>' +
      '<rect x="12" y="84" width="316" height="96" rx="12" fill="#12305a" stroke="' + G + '" stroke-width="2"/><text x="26" y="104" font-size="11" font-weight="900" fill="' + G + '" letter-spacing="2">COMPLETA L\'INSTALLAZIONE</text>' +
      '<text x="26" y="126" font-size="13" fill="#fff">Completa l\'installazione sul tuo iPhone.</text><text x="26" y="146" font-size="13" fill="#fff">Scorri verso il basso e premi METTI FVM</text><text x="26" y="166" font-size="13" fill="#fff">SULLA HOME, sotto CONDIVIDI DIAGNOSI.</text>' +
      '<text x="170" y="198" text-anchor="middle" font-size="12" fill="#9fb3cc">⋮ (più in basso)</text>' +
      '<rect x="16" y="208" width="308" height="36" rx="12" fill="#173f74" stroke="#3f68a0"/><text x="170" y="231" text-anchor="middle" font-size="13" font-weight="800" fill="#fff">CONDIVIDI DIAGNOSI</text>' +
      '<rect x="16" y="252" width="308" height="36" rx="12" fill="#173f74" stroke="' + G + '" stroke-width="2"/><text x="170" y="275" text-anchor="middle" font-size="13" font-weight="800" fill="#fff">METTI FVM SULLA HOME</text>' +
      '<rect x="11" y="247" width="318" height="46" rx="15" fill="none" stroke="' + G + '" stroke-width="4"/></g>' };
  }
  function riquadroAgg() {
    return { h: 230, c: '<g ' + SF + '><rect width="340" height="230" rx="16" fill="#0d1a2e" stroke="#e2b33c" stroke-width="3"/>' +
      '<text x="18" y="30" font-size="12" font-weight="900" fill="#e2b33c" letter-spacing="2">AGGIORNAMENTO DISPONIBILE</text>' +
      '<text x="18" y="54" font-size="13" fill="#aab3c2">Versione installata: <tspan font-weight="800" fill="#fff">1.3.5</tspan></text>' +
      '<text x="18" y="74" font-size="13" fill="#aab3c2">Nuova versione: <tspan font-weight="800" fill="#fff">1.3.6</tspan></text>' +
      '<text x="18" y="100" font-size="13" font-weight="800" fill="#aab3c2">Cosa cambia · Correzioni · Limitazioni note</text><text x="18" y="120" font-size="12" fill="#aab3c2">• …</text>' +
      '<rect x="14" y="136" width="312" height="38" rx="12" fill="#e2b33c"/><text x="170" y="160" text-anchor="middle" font-size="13" font-weight="800" fill="#1b1300">AGGIORNA ORA</text>' +
      '<rect x="14" y="182" width="312" height="38" rx="12" fill="#14243d" stroke="#2a4370"/><text x="170" y="206" text-anchor="middle" font-size="13" font-weight="800" fill="#fff">NON ORA</text></g>' };
  }
  var DISEGNI = {
    impostazioni: impostazioni, paginaCodice: paginaCodice, menuPagina: menuPagina,
    giallaDemoAttivo: function () { return finestrina("gialla", true); }, giallaDemoSpento: function () { return finestrina("gialla", false); },
    installa: installa, verde: function () { return finestrina("verde", "fine"); },
    indirizzo: function () { return barra("indirizzo", "leghe.fantacalcio.it"); }, homeFvm: homeFvm, riquadroAgg: riquadroAgg
  };
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  Array.prototype.forEach.call(document.querySelectorAll("[data-fig]"), function (el) {
    var d = DISEGNI[el.getAttribute("data-fig")]; if (!d) return;
    var s = d(), foto = el.getAttribute("data-foto"), cap = el.getAttribute("data-cap") || "";
    var fig = document.createElement("figure");
    if (el.className) fig.className = el.className;
    fig.innerHTML = (foto ? '<img src="foto/' + esc(foto) + '" alt="' + esc(cap) + '" hidden>' : "") +
      '<svg viewBox="0 0 340 ' + s.h + '" role="img" aria-label="' + esc(cap) + '">' + s.c + "</svg>" + (cap ? "<figcaption>" + esc(cap) + "</figcaption>" : "");
    var img = fig.querySelector("img");
    if (img) { img.onload = function () { img.hidden = false; var sv = fig.querySelector("svg"); if (sv) sv.remove(); }; img.onerror = function () { img.remove(); }; }
    el.parentNode.replaceChild(fig, el);
  });
  if (/stampa/.test(location.hash)) Array.prototype.forEach.call(document.querySelectorAll("details"), function (d) { d.open = true; });
})();
