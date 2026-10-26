// ==UserScript==
// @name         Fanta Vice Mister
// @description  Fanta Vice Mister per Safari (iPhone e Mac) e browser PC: ordine della panchina, controllo e invio su FLE, area admin.
// @version      1.3.6.2
// @updateURL    https://raw.githubusercontent.com/fabrizioercole70/FantaViceMister/main/FantaViceMister.user.js
// @downloadURL  https://raw.githubusercontent.com/fabrizioercole70/FantaViceMister/main/FantaViceMister.user.js
// @match        https://leghe.fantacalcio.it/*
// @match        https://fabrizioercole70.github.io/FantaViceMister/*
// @match        https://www.fantaclub.it/*
// @match        https://fantaclub.it/*
// @run-at       document-start
// @inject-into  page
// ==/UserScript==

(function () {
  "use strict";
  if (window.top !== window) return;
  // 1.0: sulla pagina della guida lo script lascia solo un segnale,
  // cosi la guida capisce da sola che Fanta Vice Mister e installato e attivo.
  if (location.hostname === "fabrizioercole70.github.io") {
    try { document.documentElement.setAttribute("data-fvm-versione", "1.3.6"); } catch (e) {}
    return;
  }
  if (window.__FVM_SAFARI__) return;
  window.__FVM_SAFARI__ = true;

  var VERSIONE = "1.3.6.2"; // 1.3.6.2 (rev. 2): Ranking mai destinazione FLE · 1.3.6.1: numero TECNICO (confronti di aggiornamento, dati salvati); visibile 1.3.6
  var VERSIONE_VISIBILE = "1.3.6";
  // «1.3.6.1» -> «1.3.6 rev. 1» (riquadro aggiornamenti e diagnosi); numeri a 3 cifre invariati
  function etichettaVersione(v) { var p = String(v || "").split("."); return p.length === 4 && /^\d+$/.test(p[3]) && Number(p[3]) > 0 ? p.slice(0, 3).join(".") + " rev. " + Number(p[3]) : String(v || ""); }
  var PREFISSO = "fvm_";

  // ---------------------------------------------------------------- 1.1.0 Fantaclub · fase 2: passaggio tra domini
  // Safari tiene separati i dati di leghe.fantacalcio.it e www.fantaclub.it. FVM passa SOLO i propri dati
  // nel frammento #fvm=… dell'indirizzo (il frammento non viene mai inviato ai server): chi riceve lo legge
  // all'avvio (prima del sito), lo cancella subito dall'indirizzo e lo valida (versione, tipo, origine,
  // destinazione, eta, chiavi). Mai credenziali, cookie, token o dati di sessione.
  var DOMINI_FVM = { leghe: "leghe.fantacalcio.it", fantaclub: "www.fantaclub.it" };
  // tipo -> unico dominio che puo riceverlo (fase 3: richiesta di accesso Fantaclub e conferma di accesso riuscito;
  // fase 4: uscita da Fantaclub e suo esito)
  // PROVA14: tolti "prova" e "prova-ritorno" (pulsante di prova PROVA PASSAGGIO FANTACLUB eliminato): ora sono tipi non ammessi
  var TIPI_PASSAGGIO = { "accedi": "fantaclub", "login-ok": "leghe",
    "esci": "fantaclub", "esci-esito": "leghe",
    // fasi 5-6-10: pagina Consegna della lega, formazione letta, passaggio a SOLO FLE
    "consegna": "fantaclub", "formazione": "leghe", "solo-fle": "leghe",
    // CHIUDI su Fantaclub: ritorno alla Home FVM (anche senza accesso a Leghe Fantacalcio)
    "ritorno": "leghe",
    // S7: controllo delle consegne ufficiali Fantaclub (richiesta da Leghe, esito verso Leghe)
    "controllo-fc": "fantaclub", "controllo-fc-esito": "leghe" };
  // leghe Fantaclub del CIRCUITO FLE: _nl della pagina Consegna -> lega nella tabella delle 80 squadre
  // (come leagues.js di Android). Nessuna lega predefinita: la lega vera e quella della pagina Consegna aperta.
  var FC_CIRCUITO = { fantavaldinievole: "FANTAVALDINIEVOLE" };
  var NL_VALIDO = /^[a-z0-9_-]{2,40}$/i;
  var CHIAVI_VIETATE = /pass|pwd|token|cookie|sess|auth|bearer|jwt|credenz|secret/i;
  function dominioFvm(host) {
    host = String(host || "").toLowerCase();
    if (host === "leghe.fantacalcio.it") return "leghe";
    if (host === "www.fantaclub.it" || host === "fantaclub.it") return "fantaclub";
    return "";
  }
  function chiaviSicure(o, d) {
    if (d > 6) return false;
    if (Array.isArray(o)) return o.every(function (x) { return chiaviSicure(x, d + 1); });
    if (o && typeof o === "object") return Object.keys(o).every(function (k) { return !CHIAVI_VIETATE.test(k) && chiaviSicure(o[k], d + 1); });
    return true;
  }
  function codificaPassaggio(o) {
    return btoa(unescape(encodeURIComponent(JSON.stringify(o)))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  function decodificaPassaggio(s) {
    s = String(s || "").replace(/-/g, "+").replace(/_/g, "/");
    while (s.length % 4) s += "=";
    return JSON.parse(decodeURIComponent(escape(atob(s))));
  }
  // prepara il passaggio verso l'altro dominio; ritorna l'id del passaggio (null se i dati non sono ammessi)
  function inviaPassaggio(verso, tipo, dati, percorso) {
    var da = dominioFvm(location.hostname);
    if (!DOMINI_FVM[verso] || verso === da || TIPI_PASSAGGIO[tipo] !== verso) return null;
    dati = dati || {};
    if (!chiaviSicure(dati, 0)) return null;
    var msg = { v: 1, tipo: tipo, da: da, a: verso, at: Date.now(), id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8), dati: dati };
    var cod = codificaPassaggio(msg);
    if (cod.length > 16000) return null;
    location.assign("https://" + DOMINI_FVM[verso] + (percorso || "/") + "#fvm=" + cod);
    return msg.id;
  }
  // legge il passaggio arrivato, CANCELLA SUBITO il frammento dall'indirizzo e lo valida
  function riceviPassaggio() {
    var h = String(location.hash || "");
    if (h.indexOf("#fvm=") !== 0) return null;
    try { history.replaceState(history.state, "", location.pathname + location.search); } catch (e) {}
    var qui = dominioFvm(location.hostname), m;
    try { m = decodificaPassaggio(h.slice(5)); } catch (e) { return { ok: false, motivo: "formato non leggibile" }; }
    var eta = Date.now() - Number(m && m.at || 0);
    var motivo = !m || typeof m !== "object" ? "formato non valido" :
      m.v !== 1 ? "versione non valida" :
      !TIPI_PASSAGGIO[m.tipo] ? "tipo non ammesso" :
      m.a !== qui || TIPI_PASSAGGIO[m.tipo] !== qui ? "destinazione non valida" :
      !DOMINI_FVM[m.da] || m.da === qui ? "origine non valida" :
      !(eta >= -60000 && eta <= 10 * 60000) ? "passaggio scaduto" :
      typeof m.id !== "string" || !/^[a-z0-9]{6,24}$/.test(m.id) ? "id non valido" :
      !m.dati || typeof m.dati !== "object" || !chiaviSicure(m.dati, 0) ? "dati non ammessi" : "";
    return motivo ? { ok: false, motivo: motivo, tipo: String(m && m.tipo || "") } : { ok: true, msg: m, eta: eta };
  }

  // ---------------------------------------------------------------- 1.1.0 Fantaclub · fase 1: ramo separato
  // Su Fantaclub NON gira nulla del codice Leghe/FLE: solo la barra FVM con CHIUDI (ritorno alla Home FVM).
  // Nessuna modifica al sito (niente intercettazioni, niente stili sulla pagina).
  // ================================================================ CONTROLLO LEGHE E FANTACLUB (S5-S8)
  // Logica COMUNE Safari/Android (stessa sorgente). Solo lettura, nessun calcolo di jolly/penalita/quote.
  // Regola configurata (cosa prevede la lega) e stato reale (cosa risulta) restano SEMPRE separati.
  // Verificato dalla ricognizione S3 (ottobre 2026):
  //  - Leghe: teamLineup/<comp>/<turno>/<giornata Serie A> da TUTTE le squadre (anche giornate passate); "ldate" =
  //    ora del salvataggio in UTC (il sito mostra l'ora italiana: 16:25:13 -> 18:25:13 il 18/09); "cdate" = uguale per
  //    tutte (momento del calcolo): MAI usato come ora di consegna. mstr (inizio giornata) anch'esso in UTC.
  //  - Leghe (verificato il 10/10/2026 nel codice del sito: componente ui-match-footer "sentLabel" e storico formazioni):
  //    il campo "act" della riga teamLineup e il tipo dell'ultimo salvataggio: 0 = "Formazione inviata via web",
  //    1 = "Formazione inviata via app", 2 = "Formazione modificata dall'admin", 3 = "Sconfitta a tavolino",
  //    4 = "Recuperata dal Server"; riga assente = "Formazione non inserita". Usato SOLO per le leghe Classic
  //    (impostazioni rose: sroles != 2, come fa il sito); Mantra e tipo non letto: comportamento precedente.
  //    "coaches[].admin" non indica l'amministratore (vale 0 per un admin reale): non usato.
  //  - Fantaclub: pagine HTML (Formazioni consegnate, Report non consegnate, Giornate passate, Log consegne, Squadre,
  //    Info): orari come scritti dal sito (ora italiana), "Consegnata tramite: ..." solo dove il sito lo scrive.
  var FVM_ND = "DATO NON DISPONIBILE";
  // ---- orari: API Leghe in UTC -> ora italiana (Europe/Rome: ora legale/solare gestita dal sistema, nessun +2 fisso)
  function fvmDataUtc(v) {
    var s = String(v == null ? "" : v).trim(), m = s.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/);
    if (m) return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]));
    m = s.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/);
    if (m && !/[zZ]|[+-]\d{2}:?\d{2}$/.test(s)) return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0)));
    var d = s ? new Date(s) : null;
    return d && !isNaN(d.getTime()) ? d : null;
  }
  function fvmOraRoma(d, conSecondi) {
    if (!d || isNaN(d.getTime())) return "";
    try {
      var o = { timeZone: "Europe/Rome", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" };
      if (conSecondi) o.second = "2-digit";
      return d.toLocaleString("it-IT", o).replace(",", "");
    } catch (e) {
      // motore senza fusi orari: ora del dispositivo (in Italia coincide), mai un orario vuoto o inventato
      try { var z = function (x) { return (x < 10 ? "0" : "") + x; }; return z(d.getDate()) + "/" + z(d.getMonth() + 1) + "/" + d.getFullYear() + " " + z(d.getHours()) + ":" + z(d.getMinutes()) + (conSecondi ? ":" + z(d.getSeconds()) : ""); } catch (x) { return ""; }
    }
  }
  // ---- righe di testo di una pagina (nodi di testo, senza script/stili): servono a pagine lette con DOMParser
  function fvmRigheDom(radice) {
    var out = [];
    (function giro(n) {
      if (!n || out.length > 6000) return;
      if (n.nodeType === 3) { var t = String(n.nodeValue || "").replace(/\s+/g, " ").trim(); if (t) out.push(t); return; }
      if (n.nodeType !== 1 && n.nodeType !== 9 && n.nodeType !== 11) return;
      var tag = String(n.nodeName || "").toLowerCase();
      if (tag === "script" || tag === "style" || tag === "noscript" || tag === "template" || tag === "select" || tag === "option") return;
      for (var c = n.firstChild; c; c = c.nextSibling) giro(c);
    })(radice);
    return out;
  }
  function fvmTesti(radice, sel) { try { return Array.prototype.slice.call(radice.querySelectorAll(sel)).map(function (e) { return String(e.textContent || "").replace(/\s+/g, " ").trim(); }).filter(Boolean); } catch (e) { return []; } }
  var FVM_ORA_FC = /^(\d{1,2}):(\d{2}) (\d{2})-(\d{2})-(\d{4})$/;

  // ---- LEGHE: regola per formazione non schierata, dal testo della pagina Opzioni di Lega -> Calcolo
  // (il testo ufficiale dell'opzione scelta; nessuna corrispondenza indovinata con i campi tecnici dell'API)
  function fvmRegolaLeghe(righe, punteggioCampo) {
    righe = righe || [];
    var i = righe.indexOf("Formazione non schierata");
    if (i < 0) return { letta: false, motivo: "voce 'Formazione non schierata' non trovata nella pagina Opzioni di Lega -> Calcolo" };
    var r = { letta: true, nonSchierata: righe[i + 1] || "", fonte: "Opzioni di Lega -> Calcolo" };
    if (/tavolino/i.test(r.nonSchierata)) {
      var j = righe.indexOf("Risultato sconfitta a tavolino");
      if (j >= 0 && /^\d+\s*-\s*\d+$/.test(righe[j + 1] || "")) r.risultato = String(righe[j + 1]).replace(/\s+/g, "");
      if (punteggioCampo != null && String(punteggioCampo).trim() !== "") r.punteggio = String(punteggioCampo).trim();
    }
    return r;
  }
  function fvmTestoRegola(r) {
    if (!r || !r.letta) return FVM_ND + (r && r.motivo ? " (" + r.motivo + ")" : "");
    return r.nonSchierata + (r.risultato ? " " + r.risultato : "") + (r.punteggio ? ", punteggio d'ufficio " + r.punteggio : "");
  }

  // ---- LEGHE: stato ufficiale dell'ultimo salvataggio (campo act), con le scritte esatte del sito
  var FVM_ACT_LEGHE = { 0: "Formazione inviata via web", 1: "Formazione inviata via app", 2: "Formazione modificata dall'admin", 3: "Sconfitta a tavolino", 4: "Recuperata dal Server" };
  function fvmActLeghe(act) {
    if (act === null || act === undefined || act === "") return { noto: false, etichetta: "" };
    var n = Number(act);
    if (!isFinite(n) || !Object.prototype.hasOwnProperty.call(FVM_ACT_LEGHE, n)) return { noto: false, codice: String(act).slice(0, 12), etichetta: "stato non riconosciuto (codice " + String(act).slice(0, 12) + ")" };
    return { noto: true, codice: n, etichetta: FVM_ACT_LEGHE[n], rosso: n === 3 || n === 4 };
  }

  // ---- LEGHE: stato di ogni squadra in una giornata (solo cio che i dati dimostrano)
  // input: { turno:{matchDay, championshipMatchDay, matches:[{tIdH,tIdA}]}, formazioni:[righe teamLineup],
  //          squadre:{tid:{nome, allenatori:[...]}}, nonCalcolate:[matchDay...], giornataSerieA (status.mday),
  //          inizioGiornata (status.mstr, solo per la giornata corrente), regola, ora,
  //          tipoGioco ("classic" | "mantra" | ""), formazioniErrore (lettura non riuscita: formazioni = null) }
  function fvmStatoLeghe(I) {
    I = I || {};
    var t = I.turno || {}, ora = Number(I.ora) || Date.now();
    var sa = Number(t.championshipMatchDay || 0), corrente = Number(I.giornataSerieA || 0);
    var calcolata = sa > 0 && corrente > 0 && sa < corrente && (I.nonCalcolate || []).map(Number).indexOf(Number(t.matchDay)) < 0;
    var inizio = sa === corrente ? fvmDataUtc(I.inizioGiornata) : null;
    var fase = !sa || !corrente ? "sconosciuta" : sa > corrente ? "futura" : sa === corrente ? (inizio && ora < inizio.getTime() ? "consegna_aperta" : "in_corso") : calcolata ? "calcolata" : "da_calcolare";
    var ids = [];
    (t.matches || []).forEach(function (m) { [m && m.tIdH, m && m.tIdA].forEach(function (x) { if (Number(x) && ids.indexOf(Number(x)) < 0) ids.push(Number(x)); }); });
    if (!ids.length) Object.keys(I.squadre || {}).forEach(function (k) { if (Number(k) && ids.indexOf(Number(k)) < 0) ids.push(Number(k)); });
    var per = {};
    (I.formazioni || []).forEach(function (l) { if (l && Number(l.tid)) per[Number(l.tid)] = l; });
    var recupero = !!(I.regola && I.regola.letta && /recupera/i.test(I.regola.nonSchierata || ""));
    // stati ufficiali dettagliati solo per le leghe Classic (Mantra: rimandato, nessun collaudo disponibile)
    var dettaglio = I.tipoGioco === "classic";
    // formazioni NON lette (errore o risposta assente): nessuna squadra risulta "senza formazione"
    var nonLette = I.formazioni === null || I.formazioni === undefined || !!I.formazioniErrore;
    var righe = ids.map(function (tid) {
      var s = (I.squadre || {})[tid] || {}, l = per[tid], r = { tid: tid, squadra: s.nome || FVM_ND, allenatori: (s.allenatori || []).slice(0, 3) };
      if (nonLette && !l) { r.stato = "non_verificabile"; r.nota = "formazioni della giornata non lette" + (I.formazioniErrore ? " (" + String(I.formazioniErrore).slice(0, 120) + ")" : ""); return r; }
      if (l) {
        var d = fvmDataUtc(l.ldate);
        r.stato = "presente";
        r.ora = d ? fvmOraRoma(d, true) : FVM_ND;
        r.modulo = String(l.mdl || l.nmdl || "").replace(/\D/g, "");
        r.invisibile = l.visb === false;
        // provenienza: con la regola "Recupera formazione precedente" una formazione presente puo essere recuperata dal server
        r.provenienza = recupero ? "consegnata o recuperata dal server: " + FVM_ND + " (i dati letti non lo distinguono)" : FVM_ND + " (canale e intervento admin non indicati nei dati letti)";
        if (dettaglio) {
          var a = fvmActLeghe(l.act);
          r.act = a.noto ? a.codice : (l.act === undefined ? null : l.act);
          r.statoUfficiale = a.noto ? a.etichetta : (a.etichetta || FVM_ND + " (stato del salvataggio non indicato)");
          r.provenienza = r.statoUfficiale;
          if (a.noto && a.codice === 3) r.stato = "tavolino";
          if (a.noto && a.codice === 4) r.stato = "recuperata";
          if (a.rosso) r.evidenzia = true;
          if (Number(l.lucnt) > 0) r.salvataggi = Number(l.lucnt);
        }
      } else if (fase === "calcolata") {
        r.stato = "assente"; r.nota = "nessuna formazione nei dati ufficiali della giornata calcolata";
        if (dettaglio) { r.statoUfficiale = "Formazione non inserita"; r.evidenzia = true; }
      }
      // RC6: turno PRECEDENTE (la sua scadenza e passata: la giornata corrente e successiva), formazioni lette, nessuna formazione = ROSSO
      // anche se non ancora calcolato (solo contenitori inferiori; il controllo generale non passa avvioDistinto e resta identico)
      else if (I.avvioDistinto && fase === "da_calcolare") { r.stato = "assente"; r.scaduta = true; r.nota = "scadenza superata (giornata gia passata): nessuna formazione nei dati letti; turno non ancora calcolato"; }
      else if (fase === "da_calcolare") { r.stato = "assente_provvisorio"; r.nota = "giornata non ancora calcolata: dato provvisorio"; }
      // RC6 (solo con I.avvioDistinto, passato dalle consegne per competizione e turno e dalle consegne ufficiali; il controllo generale
      // non lo passa e resta identico): SCADENZA SUPERATA (inizio ufficiale della giornata, league/status mstr, letto e passato) + formazioni
      // lette + nessuna formazione = ROSSO «senza formazione» anche prima del calcolo; inizio non letto = non verificabile, mai rosso
      else if (I.avvioDistinto && fase === "in_corso" && inizio) { r.stato = "assente"; r.scaduta = true; r.nota = "scadenza superata (inizio della giornata " + fvmOraRoma(inizio) + "): nessuna formazione nei dati letti; turno non ancora calcolato"; }
      else if (I.avvioDistinto && fase === "in_corso") { r.stato = "non_verificabile"; r.nota = "inizio della giornata non letto: non verificabile"; }
      else if (fase === "consegna_aperta" || fase === "in_corso") { r.stato = "in_attesa"; r.nota = "formazioni altrui visibili solo dopo la scadenza o con l'area admin"; }
      else if (fase === "futura") { r.stato = "futura"; }
      else { r.stato = "non_verificabile"; r.nota = FVM_ND; }
      return r;
    });
    var conta = {}; righe.forEach(function (r) { conta[r.stato] = (conta[r.stato] || 0) + 1; });
    return { fase: fase, giornataLega: Number(t.matchDay || 0), giornataSerieA: sa, inizio: inizio ? fvmOraRoma(inizio) : "", righe: righe, conta: conta, squadre: ids.length,
      dettaglio: dettaglio, tipoGioco: I.tipoGioco || "", formazioniLette: !nonLette };
  }

  // ---- FANTACLUB: analizzatori delle pagine (righe di testo + elenchi di elementi)
  function fvmFcInfo(righe) {
    var V = {}, voci = {
      scadenza: "Scadenza periodo di consegna delle formazioni",
      nascoste: "Nascondi le formazioni consegnate durante il periodo di consegna",
      mancataConsegna: "Comportamento in caso di mancata consegna della formazione",
      separataPerCompetizione: "Consegna formazioni separata per competizione",
      cambioModulo: "Cambio di modulo nelle sostituzioni",
      maxSostituzioni: "Numero massimo di sostituzioni",
      modificaDopoMercato: "Modifica automaticamente ultima formazione consegnata in seguito ai cambi di mercato",
      gestore: "Nick gestore", altriAdmin: "Altri amministratori" };
    // PROVA13: un'altra etichetta non vale mai come valore (voce senza valore nella pagina = non letta)
    var etichette = Object.keys(voci).map(function (k) { return voci[k]; });
    Object.keys(voci).forEach(function (k) { var i = (righe || []).indexOf(voci[k]); if (i >= 0 && righe[i + 1] != null && etichette.indexOf(String(righe[i + 1])) < 0) V[k] = String(righe[i + 1]); });
    V.letta = !!V.mancataConsegna;
    return V;
  }
  // PROVA13 B1: testi della pagina nell'ordine del documento, SENZA dipendere dal CSS del sito. La pagina Info di Fantaclub tiene
  // «Consegna e sostituzioni» in una scheda nascosta finche non viene aperta: innerText non la vede (causa di «DATO NON DISPONIBILE»),
  // i nodi di testo si. Solo testo: nessun clic, nessuna esecuzione di script della pagina.
  function fvmTestiNodi(doc) {
    var out = [];
    (function giro(n, d) {
      if (!n || d > 60) return;
      if (n.nodeType === 3) { var t = String(n.nodeValue || "").replace(/\s+/g, " ").trim(); if (t) out.push(t); return; }
      if (n.nodeType !== 1 && n.nodeType !== 9 && n.nodeType !== 11) return;
      if (n.nodeType === 1 && /^(SCRIPT|STYLE|NOSCRIPT|TEMPLATE|SELECT|OPTION)$/i.test(String(n.tagName || ""))) return;
      var figli = n.childNodes || [];
      for (var i = 0; i < figli.length; i++) giro(figli[i], d + 1);
    })(doc && (doc.body || doc), 0);
    return out;
  }
  // PROVA13 B2: la regola della lega (pagina Info) prevede che alle squadre senza formazione venga data l'ultima consegnata?
  function fvmFcRecuperoAutomatico(rg) { return /usa ultima formazione consegnata/i.test(String(rg && rg.mancataConsegna || "")); }
  // PROVA13 B3: giornate offerte dal selettore ufficiale «giornata» della pagina Formazioni passate (solo i valori presenti nella
  // pagina: mai numeri inventati; esclusa la voce «Scegli giornata...»). Lettura del testo HTML, nessun modulo inviato.
  function fvmFcOpzioniGiornata(html) {
    var m = /<select[^>]*\bname\s*=\s*["']?giornata["']?[^>]*>([\s\S]*?)<\/select>/i.exec(String(html || ""));
    if (!m) return [];
    var out = [], re = /<option\b([^>]*)>([^<]*)/gi, x;
    while ((x = re.exec(m[1]))) {
      var va = /\bvalue\s*=\s*["']?([^"'\s>]*)/i.exec(x[1]), v = String(va ? va[1] : x[2]).trim(); // valore dell'opzione, altrimenti il testo
      if (/^\d{1,2}$/.test(v) && out.indexOf(v) < 0) out.push(v);
    }
    return out.slice(0, 60);
  }
  // PROVA14 (punto 4): «0» e un valore presente nel selettore ufficiale (e nel collegamento «Report formazioni non consegnate»
  // del sito: giornata=0), ma il suo significato non e verificato: nessuna interpretazione inventata
  function fvmFcEtichettaGiornata(g) { return String(g) === "0" ? "Giornata 0 (valore del selettore del sito, significato non verificato)" : "Giornata " + g + " (giornate passate, numerazione del sito)"; }
  // PROVA14 (punto 4): allineamento tra giornata scelta nel selettore, giornata richiesta al sito e giornata letta nella pagina.
  // Il titolo dice SEMPRE la giornata del risultato mostrato; gli avvisi dicono quando non corrisponde alla scelta attuale.
  function fvmFcAllineamentoGiornata(scelta, F) {
    scelta = String(scelta || ""); F = F || {};
    var richiesta = String(F.giornataRichiesta || ""), corrente = String((F.stato || {}).giornata || "?"), GP = F.giornataPrecedente || null, avvisi = [];
    if (scelta !== richiesta) avvisi.push("Hai scelto " + (scelta ? "la giornata " + scelta : "la giornata corrente") + ", ma il risultato qui sotto è della richiesta precedente (" + (richiesta ? "giornata " + richiesta : "giornata corrente") + "): premi AGGIORNA SU FANTACLUB.");
    if (richiesta && GP && GP.giornata && String(GP.giornata) !== richiesta) avvisi.push("Il sito ha mostrato la giornata " + GP.giornata + " invece della giornata " + richiesta + " richiesta: elenco da verificare sul sito.");
    if (richiesta && !GP) avvisi.push("Elenco della giornata " + richiesta + " non letto.");
    return { richiesta: richiesta, titolo: richiesta ? "giornata scelta " + richiesta + " (giornata passata) · giornata corrente " + corrente : "giornata corrente " + corrente, avvisi: avvisi };
  }
  // PROVA15 (C4 verificata sulle pagine reali): COMPETIZIONI FANTACLUB con un motore GENERICO, valido per qualsiasi lega (nessun nome,
  // cid o lega preimpostati). Fonte: pagina «Tornei» della lega (/servlet/TorneoGironi?_nl=<lega>), letta con GET come documento inerte:
  // le schede sono pulsanti con l'indirizzo nell'attributo onclick («window.location.href='/servlet/<Pagina>?cid=<n>&_nl=<lega>'»),
  // letto SOLO come testo (mai eseguito). Vale come competizione qualsiasi pagina /servlet/<Pagina> con cid numerico e la STESSA lega.
  // Indirizzo di una competizione: { pagina, cid } oppure { scarto: motivo } oppure null (non e un indirizzo di competizione)
  function fvmFcUrlCompetizione(u, nl) {
    var s = String(u || "").trim().replace(/^https?:\/\/(www\.)?fantaclub\.it/i, "");
    var m = /^\/servlet\/([A-Za-z][A-Za-z0-9_]{0,40})\?([^#\s]*)$/.exec(s);
    if (!m) return null;
    var q = {}; m[2].split("&").forEach(function (p) { var i = p.indexOf("="); if (i > 0) { try { q[p.slice(0, i)] = decodeURIComponent(p.slice(i + 1)); } catch (e) {} } });
    if (!("cid" in q)) return null;
    if (!/^\d{1,6}$/.test(String(q.cid))) return { scarto: "cid non valido" };
    if (String(q._nl || "").toLowerCase() !== String(nl || "").toLowerCase()) return { scarto: "altra lega" };
    return { pagina: m[1], cid: String(Number(q.cid)) };
  }
  // tipologia dall'intestazione ufficiale della pagina di una competizione (header.fc-competition-header--<tipo>, titolo, sottotitolo);
  // giornate di svolgimento SOLO se il regolamento della pagina le scrive («Giornate di campionato in cui si svolge: …»)
  function fvmFcIntestazioneCompetizione(doc) {
    try {
      var h = doc.querySelector("header[class*='fc-competition-header--']");
      if (!h) return null;
      var t = function (sel) { var e = h.querySelector(sel); return e ? String(e.textContent || "").replace(/\s+/g, " ").trim().slice(0, 120) : ""; };
      var tipo = (/fc-competition-header--([a-z0-9_-]+)/i.exec(String(h.getAttribute("class") || "")) || [])[1] || "";
      var reg = doc.querySelector("#inforegolamento"), g = reg ? /Giornate di campionato in cui si svolge:\s*([0-9][0-9 ,]*)/i.exec(String(reg.textContent || "").replace(/\s+/g, " ")) : null;
      return { tipo: tipo.toLowerCase().slice(0, 30), titolo: t(".fc-competition-header-title").slice(0, 60), sottotitolo: t(".fc-competition-header-subtitle"), giornate: g ? g[1].replace(/[ ,]+$/, "").trim() : "" };
    } catch (e) { return null; }
  }
  // elenco della pagina «Tornei» (o della pagina di una competizione, che ha le stesse schede). Esiti distinti, mai confusi:
  // elenco · nessuna_aggiuntiva (messaggio ufficiale «Non sono presenti altre competizioni»: NON e un errore e non dice nulla sul
  // campionato principale) · non_riconosciuta (ne schede ne messaggio: struttura cambiata o pagina diversa)
  function fvmFcCompetizioniPagina(doc, nl) {
    var out = { esito: "non_riconosciuta", voci: [], scartati: { altra_lega: 0, cid_non_valido: 0, doppioni: 0, senza_nome: 0 }, titoloLega: false };
    try {
      out.titoloLega = new RegExp("\\blega\\s+" + String(nl || "").replace(/[^a-z0-9_-]/gi, "") + "\\b", "i").test(String(doc.title || ""));
      var visti = {};
      Array.prototype.forEach.call(doc.querySelectorAll("[onclick],[href],[data-href]"), function (el) {
        var oc = /location(?:\.href)?\s*=\s*['"]([^'"]+)['"]/.exec(String(el.getAttribute("onclick") || ""));
        var u = oc ? oc[1] : el.getAttribute("data-href") || el.getAttribute("href") || "";
        var c = fvmFcUrlCompetizione(u, nl);
        if (!c) return;
        if (c.scarto) { out.scartati[c.scarto === "altra lega" ? "altra_lega" : "cid_non_valido"]++; return; }
        var nome = String(el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 60);
        if (!nome) { out.scartati.senza_nome++; return; }
        var k = c.pagina + ":" + c.cid;
        if (visti[k]) { out.scartati.doppioni++; if (visti[k].nome.toLowerCase() !== nome.toLowerCase()) visti[k].nomeNonUnivoco = true; return; }
        visti[k] = { chiave: k, pagina: c.pagina, cid: c.cid, nome: nome, attiva: /(^|\s)active(\s|$)/.test(String(el.getAttribute("class") || "")) };
        out.voci.push(visti[k]);
      });
      out.voci = out.voci.slice(0, 20);
      if (out.voci.length) out.esito = "elenco";
      else if (/Non sono presenti altre competizioni/i.test(String(doc.body && doc.body.textContent || ""))) out.esito = "nessuna_aggiuntiva";
    } catch (e) { out.errore = String(e && e.message || e).slice(0, 120); }
    return out;
  }
  // lettura completa (solo GET della stessa origine): pagina «Tornei», poi UNA pagina per competizione (al massimo 10) solo per la
  // tipologia. Un errore su una competizione resta su quella competizione; un errore sulla pagina «Tornei» da l'esito «errore».
  // pagina(percorso) -> Promise { ok, url, testo }; docDa(testo) -> documento inerte (DOMParser)
  function fvmFcLeggiCompetizioni(pagina, nl, docDa) {
    var q = "?_nl=" + encodeURIComponent(nl);
    return pagina("/servlet/TorneoGironi" + q).then(function (p) {
      if (!p || !p.ok) return { esito: "errore", voci: [], errore: "pagina Tornei non disponibile" };
      var C = fvmFcCompetizioniPagina(docDa(p.testo), nl);
      var catena = Promise.resolve();
      C.voci.slice(0, 10).forEach(function (v) {
        catena = catena.then(function () {
          return pagina("/servlet/" + v.pagina + "?cid=" + encodeURIComponent(v.cid) + "&_nl=" + encodeURIComponent(nl)).then(function (pc) {
            var I = pc && pc.ok ? fvmFcIntestazioneCompetizione(docDa(pc.testo)) : null;
            if (!I) { v.errore = pc && pc.ok ? "intestazione della competizione non riconosciuta" : "pagina della competizione non disponibile"; return; }
            v.tipo = I.tipo; v.sottotitolo = I.sottotitolo; v.giornate = I.giornate;
            v.coerente = !!I.titolo && I.titolo.toLowerCase() === v.nome.toLowerCase(); // il titolo della pagina = nome della scheda
          }).catch(function (e) { v.errore = String(e && e.message || e).slice(0, 80); });
        });
      });
      return catena.then(function () { return C; });
    }).catch(function (e) { return { esito: "errore", voci: [], errore: String(e && e.message || e).slice(0, 120) }; });
  }
  // tipologia leggibile: SEMPRE il sottotitolo ufficiale della pagina quando c'e; altrimenti il tipo dell'intestazione; altrimenti non letta
  function fvmFcTipologia(v) {
    if (!v) return "tipologia non letta";
    if (v.sottotitolo) return v.sottotitolo + (v.coerente === false ? " (titolo della pagina diverso dal nome della scheda)" : "");
    if (v.tipo) return "tipologia «" + v.tipo + "» (sottotitolo non presente)";
    return "tipologia non letta" + (v.errore ? " (" + v.errore + ")" : "");
  }
  // testo per schermata e WhatsApp: esito della lettura + regola «Consegna formazioni separata per competizione» della pagina Info.
  // No = UNA consegna valida per tutte (la scelta di una competizione NON crea consegne, stati o invii separati); Si = stato per singola
  // competizione SOLO da fonti ufficiali (oggi nessuna individuata: DATO NON DISPONIBILE). C = esito di fvmFcLeggiCompetizioni.
  function fvmFcCompetizioni(rg, C, scelta) {
    var sep = String(rg && rg.separataPerCompetizione || ""), voci = C && Array.isArray(C.voci) ? C.voci : [];
    var unica = /^no(?![a-z])/i.test(sep), separata = /^s[iì](?![a-z])/i.test(sep), esito = C && C.esito || "non_letto";
    var regola = unica ? "UNA consegna valida per tutte (Info: «Consegna formazioni separata per competizione: No»)"
      : separata ? "consegna SEPARATA per competizione (Info: «Sì»): lo stato per singola competizione NON è verificabile da FVM" : "consegna per competizione: " + FVM_ND;
    var elenco = esito === "elenco" ? "Competizioni (pagina «Tornei» del sito): " + voci.map(function (v) { return v.nome; }).join(", ")
      : esito === "nessuna_aggiuntiva" ? "Nessuna competizione aggiuntiva (pagina «Tornei»: «Non sono presenti altre competizioni in questa lega»)"
      : esito === "non_riconosciuta" ? "Elenco delle competizioni non letto: pagina «Tornei» con struttura non riconosciuta"
      : esito === "errore" ? "Elenco delle competizioni non letto: " + (C.errore || "errore di lettura")
      : "Competizioni non lette (controllo di una versione precedente: premi AGGIORNA)";
    var v = null; voci.forEach(function (x) { if (x.chiave === String(scelta || "")) v = x; });
    var nota = !v ? "" : "Competizione scelta: " + v.nome + " · " + fvmFcTipologia(v) + (v.giornate ? " · giornate di svolgimento: " + v.giornate : "") +
      (unica ? " · con la consegna unica lo stato è lo stesso per tutte le competizioni" : " · stato per singola competizione: " + FVM_ND);
    return { unica: unica, separata: separata, esito: esito, voci: voci, scelta: v, testo: elenco + " · " + regola, nota: nota,
      principale: esito === "elenco" || esito === "nessuna_aggiuntiva" ? "Campionato principale della lega: non indicato nelle pagine lette" : "" };
  }
  // PROVA13 B1: regole della pagina Info. Prima il testo visibile (come sempre); le voci mancanti si cercano nel testo completo
  // della pagina (schede nascoste comprese). Un valore e indicato SOLO se la pagina ufficiale lo contiene davvero.
  function fvmFcInfoCompleta(righe, doc) {
    var V = fvmFcInfo(righe);
    var mancano = ["mancataConsegna", "nascoste", "scadenza", "separataPerCompetizione", "gestore", "altriAdmin"].filter(function (k) { return !V[k]; });
    if (!mancano.length || !doc) { V.fonte = "pagina Info (scheda visibile)"; return V; }
    var W = fvmFcInfo(fvmTestiNodi(doc)), aggiunte = [];
    Object.keys(W).forEach(function (k) { if (k !== "letta" && W[k] && !V[k]) { V[k] = W[k]; aggiunte.push(k); } });
    V.letta = !!V.mancataConsegna;
    V.fonte = aggiunte.length ? "pagina Info (anche schede chiuse: " + aggiunte.join(", ") + ")" : "pagina Info (scheda visibile)";
    return V;
  }
  // Squadre: elenco delle squadre (h3) e account scritto subito dopo il nome
  function fvmFcSquadre(righe, nomi) {
    var out = [];
    (nomi || []).forEach(function (n) {
      var i = (righe || []).indexOf(n), acc = i >= 0 ? String(righe[i + 1] || "") : "";
      if (/^(NOME|LA TUA SQUADRA|GRAFICO ROSE|CREDITI E CAMBI|Senza rose)$/i.test(acc) || acc === n) acc = "";
      out.push({ squadra: n, account: acc || FVM_ND });
    });
    return out;
  }
  function fvmFcOra(s) { var m = String(s || "").match(FVM_ORA_FC); return m ? (m[3] + "/" + m[4] + "/" + m[5] + " " + (m[1].length < 2 ? "0" : "") + m[1] + ":" + m[2]) : ""; }
  // Formazioni consegnate (giornata corrente): intestazione "squadra (n)", poi account, poi ora "hh:mm gg-mm-aaaa"
  function fvmFcConsegnate(righe, intestazioni, squadre) {
    var out = [];
    (intestazioni || []).forEach(function (h) {
      var nome = String(h).replace(/\s*\(\d+\)\s*$/, ""), i = (righe || []).indexOf(h);
      if (i < 0) i = (righe || []).indexOf(nome);
      if (i < 0 || (squadre && squadre.indexOf(nome) < 0)) return;
      var ora = "", acc = "";
      for (var k = i + 1; k < Math.min(righe.length, i + 5); k++) { if (FVM_ORA_FC.test(righe[k])) { ora = fvmFcOra(righe[k]); break; } if (!acc && !/^\(\d+\)$/.test(righe[k])) acc = righe[k]; }
      out.push({ squadra: nome, account: acc || FVM_ND, ora: ora || FVM_ND });
    });
    return out;
  }
  // Report non consegnate: "GIORNATA N" + blocco "Squadre da controllare" -> [iniziale], squadra, account
  function fvmFcNonConsegnate(righe, squadre) {
    righe = righe || [];
    var g = "", a = righe.indexOf("Squadre da controllare"), b = righe.indexOf("Report singola squadra"), out = [];
    righe.forEach(function (l) { var m = /^GIORNATA (\d+)$/i.exec(l); if (m && !g) g = m[1]; });
    if (a < 0) return { letto: false, giornata: g, squadre: out };
    for (var i = a + 1; i < (b > a ? b : righe.length); i++) {
      var l = righe[i];
      if (squadre && squadre.indexOf(l) >= 0) { var acc = righe[i + 1] && squadre.indexOf(righe[i + 1]) < 0 && i + 1 < b ? righe[i + 1] : ""; out.push({ squadra: l, account: acc || FVM_ND }); }
    }
    return { letto: true, giornata: g, squadre: out };
  }
  // Giornate passate: "Giornata N", poi per ogni squadra consegnata: squadra, account, ora
  function fvmFcPassate(righe, squadre) {
    righe = righe || [];
    var g = "", out = [];
    righe.forEach(function (l) { var m = /^Giornata (\d+)$/.exec(l); if (m && !g) g = m[1]; });
    for (var i = 0; i < righe.length - 2; i++) {
      if (squadre && squadre.indexOf(righe[i]) >= 0 && FVM_ORA_FC.test(righe[i + 2]) && !out.some(function (x) { return x.squadra === righe[i]; }))
        out.push({ squadra: righe[i], account: righe[i + 1], ora: fvmFcOra(righe[i + 2]) });
    }
    return { giornata: g, consegnate: out };
  }
  // Log consegne: blocchi ora -> squadra -> account -> "Giornata N" ... "Consegnata tramite: X"
  function fvmFcLog(righe, squadre) {
    righe = righe || [];
    var out = [];
    for (var i = 0; i < righe.length - 3; i++) {
      if (!FVM_ORA_FC.test(righe[i]) || (squadre && squadre.indexOf(righe[i + 1]) < 0)) continue;
      var e = { ora: fvmFcOra(righe[i]), squadra: righe[i + 1], account: righe[i + 2], giornata: "", canale: "" };
      var mg = /^Giornata (\d+)$/.exec(righe[i + 3] || ""); if (mg) e.giornata = mg[1];
      for (var k = i + 4; k < righe.length && !FVM_ORA_FC.test(righe[k]); k++) { var mc = /^Consegnata tramite: (.+)$/.exec(righe[k]); if (mc) { e.canale = mc[1]; break; } }
      out.push(e);
    }
    return out;
  }
  // Fantaclub: stato per squadra della giornata corrente (solo elenchi ufficiali; nessuna deduzione)
  function fvmStatoFc(I) {
    I = I || {};
    var sq = (I.squadre || []).map(function (x) { return x.squadra; }), righe = [];
    sq.forEach(function (n) {
      var acc = ((I.squadre || []).filter(function (x) { return x.squadra === n; })[0] || {}).account || FVM_ND;
      var c = (I.consegnate || []).filter(function (x) { return x.squadra === n; })[0];
      var nc = I.nonConsegnate && I.nonConsegnate.letto ? I.nonConsegnate.squadre.filter(function (x) { return x.squadra === n; })[0] : null;
      var log = (I.log || []).filter(function (x) { return x.squadra === n; });
      var r = { squadra: n, account: acc };
      if (c) { r.stato = "consegnata"; r.ora = c.ora; r.canale = log[0] && log[0].canale ? log[0].canale : FVM_ND; r.invii = log.length || undefined; }
      else if (nc) { r.stato = "non_consegnata"; r.nota = "elenco ufficiale 'Report non consegnate'"; }
      else { r.stato = "non_verificabile"; r.nota = I.nascoste ? "formazioni nascoste durante il periodo di consegna" : FVM_ND; }
      righe.push(r);
    });
    return { righe: righe, giornata: I.nonConsegnate && I.nonConsegnate.giornata || "" };
  }

  // ---- REPORT WhatsApp (solo stati confermati; regola e stato separati; fonte e momento del controllo)
  function fvmReportLeghe(R) {
    var S = R.stato || {}, el = function (st) { return (S.righe || []).filter(function (r) { return r.stato === st; }); };
    var righe = ["📋 CONTROLLO CONSEGNE · " + R.lega + " (Leghe Fantacalcio)", (R.competizione || "Competizione") + " · " + (S.giornataLega || "?") + "ª giornata" + (S.giornataSerieA ? " (Serie A " + S.giornataSerieA + ")" : ""),
      "Controllo: " + (R.quando || "") + " · fonte: dati ufficiali della lega", "Regola per formazione non schierata: " + fvmTestoRegola(R.regola), ""];
    if (S.dettaglio) {
      // Classic: stato ufficiale di ogni formazione con le scritte del sito; in evidenza recuperi, non inserite, tavolino
      var mod = function (r) { return r.modulo ? " · " + String(r.modulo).split("").join("-") : ""; };
      var all = function (r) { return r.allenatori && r.allenatori.length ? " · " + r.allenatori.join(", ") : ""; };
      var pd = el("presente"); if (pd.length) { righe.push("🟢 Formazione presente (" + pd.length + ")"); pd.forEach(function (r) { righe.push("• " + r.squadra + " · " + (r.statoUfficiale || FVM_ND) + " · " + r.ora + mod(r) + (r.invisibile ? " · invisibile" : "") + all(r)); }); righe.push(""); }
      var rc = el("recuperata"); if (rc.length) { righe.push("🔴 Recuperata dal Server (" + rc.length + ")"); rc.forEach(function (r) { righe.push("• " + r.squadra + " · " + r.ora + mod(r) + all(r)); }); righe.push(""); }
      var tv = el("tavolino"); if (tv.length) { righe.push("🔴 Sconfitta a tavolino (" + tv.length + ")"); tv.forEach(function (r) { righe.push("• " + r.squadra + all(r)); }); righe.push(""); }
      var ni = el("assente").filter(function (r) { return !r.scaduta; }); if (ni.length) { righe.push("🔴 Formazione non inserita · giornata calcolata (" + ni.length + ")"); ni.forEach(function (r) { righe.push("• " + r.squadra + all(r)); }); righe.push(""); }
      var ns = el("assente").filter(function (r) { return r.scaduta; }); if (ns.length) { righe.push("🔴 Senza formazione · scadenza superata (" + ns.length + ")"); ns.forEach(function (r) { righe.push("• " + r.squadra + all(r)); }); righe.push(""); }
      var ap2 = el("assente_provvisorio"); if (ap2.length) { righe.push("🟠 Nessuna formazione, giornata da calcolare: provvisorio (" + ap2.length + ")"); ap2.forEach(function (r) { righe.push("• " + r.squadra); }); righe.push(""); }
      var w2 = el("in_attesa"); if (w2.length) { righe.push("⏳ In attesa / non ancora visibili (" + w2.length + ")"); w2.forEach(function (r) { righe.push("• " + r.squadra); }); righe.push(""); }
      var n2 = el("non_verificabile").concat(el("futura")); if (n2.length) { righe.push("❔ Non verificabili (" + n2.length + ")"); n2.forEach(function (r) { righe.push("• " + r.squadra + (r.nota ? " · " + r.nota : "")); }); righe.push(""); }
      righe.push("Stati come indicati da Leghe Fantacalcio per ogni formazione. Nessun calcolo di jolly, penalità o regolamento.");
      return righe.join("\n");
    }
    var p = el("presente"); if (p.length) { righe.push("🟢 Formazione presente (" + p.length + ")"); p.forEach(function (r) { righe.push("• " + r.squadra + " · salvata " + r.ora + (r.invisibile ? " · invisibile" : "")); }); righe.push(""); }
    var a = el("assente").filter(function (r) { return !r.scaduta; }); if (a.length) { righe.push("🔴 Nessuna formazione (giornata calcolata) (" + a.length + ")"); a.forEach(function (r) { righe.push("• " + r.squadra); }); righe.push(""); }
    var as = el("assente").filter(function (r) { return r.scaduta; }); if (as.length) { righe.push("🔴 Senza formazione · scadenza superata (" + as.length + ")"); as.forEach(function (r) { righe.push("• " + r.squadra); }); righe.push(""); }
    var ap = el("assente_provvisorio"); if (ap.length) { righe.push("🟠 Nessuna formazione, giornata da calcolare (" + ap.length + ")"); ap.forEach(function (r) { righe.push("• " + r.squadra); }); righe.push(""); }
    var w = el("in_attesa"); if (w.length) { righe.push("⏳ In attesa / non ancora visibili (" + w.length + ")"); w.forEach(function (r) { righe.push("• " + r.squadra); }); righe.push(""); }
    var n = el("non_verificabile").concat(el("futura")); if (n.length) { righe.push("❔ Non verificabili (" + n.length + ")"); n.forEach(function (r) { righe.push("• " + r.squadra); }); righe.push(""); }
    righe.push("Canale di invio, recupero dal server e interventi admin: " + FVM_ND + (S.tipoGioco === "mantra" ? " (lega Mantra: stati dettagliati rimandati a un prossimo aggiornamento)" : "") + ".");
    return righe.join("\n");
  }
  function fvmReportFc(R) {
    var S = R.stato || {}, el = function (st) { return (S.righe || []).filter(function (r) { return r.stato === st; }); };
    // PROVA14 (punti 3 e 4): giornata scelta e giornata corrente sempre distinte. PROVA15: competizioni dal motore generico (pagina
    // «Tornei») con la regola della consegna (unica = valida per tutte: nessuna consegna separata inventata)
    var richiesta = String(R.giornataRichiesta || ""), GP = R.giornataPrecedente || null, CF = fvmFcCompetizioni(R.regola, R.competizioni, R.competizione || "");
    var righe = ["📋 CONTROLLO CONSEGNE · " + R.lega + " (Fantaclub)", richiesta ? "Giornata scelta " + richiesta + " (giornata passata) · giornata corrente " + (S.giornata || "?") + " · numerazione del sito" : "Giornata corrente " + (S.giornata || "?") + " (numerazione del sito)",
      "Controllo: " + (R.quando || "") + " · fonte: pagine ufficiali della lega", CF.testo].concat(CF.principale ? [CF.principale] : []).concat(CF.nota ? [CF.nota] : []).concat(["Mancata consegna (regola della lega): " + (R.regola && R.regola.mancataConsegna ? R.regola.mancataConsegna : FVM_ND), ""]);
    if (richiesta) {
      var gc = GP && GP.consegnate || [];
      righe.push("📅 Giornata " + richiesta + " (passata scelta): " + (GP ? gc.length + " formazioni elencate dal sito" + (GP.giornata && String(GP.giornata) !== richiesta ? " ⚠️ la pagina del sito indica la giornata " + GP.giornata : "") : "elenco non letto"));
      gc.forEach(function (c) { righe.push("• " + c.squadra + (c.account ? " (" + c.account + ")" : "") + (c.ora ? " · " + c.ora : "")); });
      righe.push("", "Giornata corrente " + (S.giornata || "?") + " (consegne in corso):");
    }
    var c = el("consegnata"); if (c.length) { righe.push("🟢 Consegnate (" + c.length + ")"); c.forEach(function (r) { righe.push("• " + r.squadra + " (" + r.account + ") · " + r.ora + (r.canale && r.canale !== FVM_ND ? " · tramite " + r.canale : "")); }); righe.push(""); }
    var nc = el("non_consegnata"); if (nc.length) { righe.push("🔴 Senza formazione, elenco ufficiale (" + nc.length + ")"); nc.forEach(function (r) { righe.push("• " + r.squadra + " (" + r.account + ")"); });
      // PROVA13 B2: recupero automatico previsto dalla regola = NON una consegna
      if (/usa ultima formazione consegnata/i.test(String(R.regola && R.regola.mancataConsegna || ""))) righe.push("(per regola della lega riceveranno l'ultima formazione consegnata: recupero automatico, non una consegna)");
      righe.push(""); }
    var nv = el("non_verificabile"); if (nv.length) { righe.push("❔ Non verificabili (" + nv.length + ")"); nv.forEach(function (r) { righe.push("• " + r.squadra + (r.nota ? " · " + r.nota : "")); }); righe.push(""); }
    return righe.join("\n").replace(/\n+$/, "");
  }
  // ---------------------------------------------------------------- S7 · controllo Fantaclub (lato fantaclub.it)
  // Arriva con il passaggio "controllo-fc" (chiesto dalla schermata Consegne ufficiali). Legge SOLO pagine ufficiali
  // della lega con GET della stessa origine (nessun clic, nessun invio di moduli, nessuna esecuzione degli script delle
  // pagine lette) e rimanda l'esito a Leghe con "controllo-fc-esito". La barra e le consegne (ramoFantaclub) non
  // vengono toccate: questo ramo parte solo con quel passaggio.
  function controlloFcInArrivo() {
    try {
      var h = String(location.hash || "");
      if (h.indexOf("#fvm=") !== 0) return false;
      var m = decodificaPassaggio(h.slice(5));
      if (!m || m.tipo !== "controllo-fc") return false;
    } catch (e) { return false; }
    var a = riceviPassaggio();
    if (!a || !a.ok) return false;
    eseguiControlloFc(a.msg);
    return true;
  }
  // righe di testo come le mostra la pagina: HTML letto, ripulito (niente script, iframe, immagini, stili) e messo
  // per un istante in un contenitore invisibile per avere lo stesso testo "a righe" del sito
  function fvmRigheHtml(html) {
    var doc = new DOMParser().parseFromString(String(html || ""), "text/html");
    Array.prototype.slice.call(doc.querySelectorAll("script,style,iframe,img,link,noscript,video,audio,object,embed,select,form input,svg,picture,source,frame,frameset")).forEach(function (e) { e.remove(); });
    // nessun gestore di eventi del sito: tolti tutti gli attributi on... prima di misurare il testo
    Array.prototype.slice.call(doc.querySelectorAll("*")).forEach(function (e) { Array.prototype.slice.call(e.attributes).forEach(function (a) { if (/^on/i.test(a.name) || /^(src|srcset|href|style|background)$/i.test(a.name)) e.removeAttribute(a.name); }); });
    var box = document.createElement("div");
    box.setAttribute("aria-hidden", "true");
    box.style.cssText = "position:fixed;left:-20000px;top:0;width:1000px;opacity:0;pointer-events:none;";
    box.innerHTML = doc.body ? doc.body.innerHTML : "";
    (document.body || document.documentElement).appendChild(box);
    var righe = String(box.innerText || "").split("\n").map(function (l) { return l.replace(/\s+/g, " ").trim(); }).filter(Boolean);
    box.remove();
    return { righe: righe, doc: doc, titolo: String((doc.querySelector("title") || {}).textContent || "").trim() };
  }
  // PROVA15: documento inerte da un testo HTML (DOMParser: nessuno script eseguito, nessuna risorsa caricata)
  function fvmFcDocumento(t) { return new DOMParser().parseFromString(String(t || ""), "text/html"); }
  // PROVA15 (audio): pagina Fantaclub usata SOLO come appoggio della lettura delle Consegne ufficiali: caricamento fermato (window.stop),
  // play() rifiutato, audio/video muti e fermi, riquadri (iframe) tolti, anche quelli aggiunti dopo. Non vale per le pagine che
  // l'utente usa (consegna, barra FVM): li resta la protezione normale che lascia funzionare i lettori del sito.
  function fvmFcSilenzia() {
    var r = { fermata: false, media: 0, iframe: 0 };
    try { if (typeof window.stop === "function") { window.stop(); r.fermata = true; } } catch (e) {}
    var zitto = function (m) { try { m.muted = true; m.autoplay = false; m.pause(); r.media++; } catch (e) {} };
    var togli = function (n) {
      try {
        if (!n || n.nodeType !== 1) return;
        if (n.tagName === "VIDEO" || n.tagName === "AUDIO") zitto(n);
        else if (n.tagName === "IFRAME") { n.src = "about:blank"; n.remove(); r.iframe++; }
        if (n.querySelectorAll) Array.prototype.forEach.call(n.querySelectorAll("video,audio,iframe"), togli);
      } catch (e) {}
    };
    try { var MP = window.HTMLMediaElement && window.HTMLMediaElement.prototype; if (MP) MP.play = function () { zitto(this); try { return Promise.reject(new DOMException("FVM: lettura in corso", "NotAllowedError")); } catch (e) { return Promise.resolve(); } }; } catch (e) {}
    try { if (document.documentElement) togli(document.documentElement); } catch (e) {}
    try { if (window.MutationObserver && document.documentElement) new MutationObserver(function (l) { l.forEach(function (m) { Array.prototype.forEach.call(m.addedNodes || [], togli); }); }).observe(document.documentElement, { childList: true, subtree: true }); } catch (e) {}
    try { document.addEventListener("play", function (ev) { togli(ev.target); }, true); } catch (e) {}
    return r;
  }
  function eseguiControlloFc(msg) {
    var dati = msg.dati || {}, nl = NL_VALIDO.test(String(dati.nl || "")) ? String(dati.nl) : "";
    var giornata = /^\d{1,2}$/.test(String(dati.giornata || "")) ? String(dati.giornata) : "";
    var esito = { richiesta: msg.id, nl: nl, quando: Date.now(), errori: [] };
    // PROVA15 (audio): questa pagina serve solo da appoggio alla lettura (l'utente non la usa): caricamento della pagina fermato,
    // nessun audio/video e nessun riquadro di altri siti per tutta la lettura. Prima la protezione mancava del tutto qui.
    esito.audio = fvmFcSilenzia();
    var box = null;
    function stato(t) {
      try {
        if (!box && (document.body || document.documentElement)) { box = document.createElement("div"); box.style.cssText = "position:fixed;left:0;right:0;top:0;z-index:2147483647;background:#0b1730;color:#fff;font:600 15px -apple-system,Arial;padding:18px;border-bottom:3px solid #e2b33c;text-align:center"; (document.body || document.documentElement).appendChild(box); }
        if (box) box.textContent = "Fanta Vice Mister · controllo Fantaclub (sola lettura) · " + t;
      } catch (e) {}
    }
    function pagina(percorso) {
      return fetch(percorso, { credentials: "same-origin", redirect: "follow" }).then(function (r) { return r.text().then(function (t) { return { ok: r.ok, url: r.url, testo: t }; }); });
    }
    function fine() {
      // dati ammessi nel passaggio: niente codici, niente password; se troppo grande, il log viene accorciato
      var n = (esito.log || []).length;
      for (;;) {
        var id = inviaPassaggio("leghe", "controllo-fc-esito", esito, "/");
        if (id || !esito.log || !esito.log.length) { if (!id) { esito.log = []; esito.errori.push("esito troppo grande"); inviaPassaggio("leghe", "controllo-fc-esito", { richiesta: esito.richiesta, nl: nl, quando: esito.quando, errori: esito.errori }, "/"); } return; }
        esito.log = esito.log.slice(0, Math.floor(esito.log.length / 2)); esito.logRidotto = n;
      }
    }
    if (!nl) { esito.errori.push("lega Fantaclub non valida"); setTimeout(fine, 50); return; }
    var q = "?_nl=" + encodeURIComponent(nl);
    if (giornata) esito.giornataRichiesta = giornata; // PROVA14 (punto 4): la richiesta resta registrata anche se la lettura non riesce
    setTimeout(function () {
      stato("leggo le regole della lega…");
      pagina("/servlet/Informazioni" + q).then(function (p) {
        var I = fvmRigheHtml(p.testo);
        if (I.righe.indexOf("Informazioni generali") < 0) throw new Error("accesso a Fantaclub non attivo o lega non accessibile con questo account");
        esito.regola = fvmFcInfoCompleta(I.righe, I.doc); // PROVA13 B1: anche la scheda «Consegna e sostituzioni» chiusa
        stato("leggo le squadre…");
        return pagina("/servlet/ElencoSquadre" + q);
      }).then(function (p) {
        var S = fvmRigheHtml(p.testo), nomi = fvmTesti(S.doc, "h3");
        esito.squadre = fvmFcSquadre(S.righe, nomi);
        stato("leggo le formazioni consegnate…");
        return pagina("/servlet/FormazioniConsegnate" + q);
      }).then(function (p) {
        var C = fvmRigheHtml(p.testo), nomi = (esito.squadre || []).map(function (x) { return x.squadra; });
        esito.consegnate = fvmFcConsegnate(C.righe, fvmTesti(C.doc, ".fc_evidenzianomesquadra"), nomi);
        stato("leggo il report delle non consegnate…");
        return pagina("/servlet/FormazioniNonConsegnate" + q);
      }).then(function (p) {
        var N = fvmRigheHtml(p.testo);
        esito.nonConsegnate = fvmFcNonConsegnate(N.righe, (esito.squadre || []).map(function (x) { return x.squadra; }));
        stato("leggo il log delle consegne…");
        return pagina("/servlet/FormazioniReportLega" + q);
      }).then(function (p) {
        var Lg = fvmRigheHtml(p.testo);
        esito.log = fvmFcLog(Lg.righe, (esito.squadre || []).map(function (x) { return x.squadra; })).slice(0, 40);
        // PROVA13 B3: la pagina Formazioni passate si legge sempre (GET, come il sito): il suo selettore «giornata» da le giornate
        // REALI disponibili per la scelta; con una giornata scelta, anche le formazioni di quella giornata (come prima)
        stato(giornata ? "leggo la giornata " + giornata + "…" : "leggo le giornate disponibili…");
        return pagina("/servlet/FormazioniPassate" + q + (giornata ? "&giornata=" + giornata : ""));
      }).then(function (p) {
        if (p) esito.giornate = fvmFcOpzioniGiornata(p.testo);
        if (p && giornata) { var Pa = fvmRigheHtml(p.testo); esito.giornataPrecedente = fvmFcPassate(Pa.righe, (esito.squadre || []).map(function (x) { return x.squadra; })); }
        stato("leggo l'account collegato…");
        return pagina("/servlet/FormazioniReport");
      }).then(function (p) {
        var t = fvmRigheHtml(p.testo).titolo, m = /Report formazioni di (.+)$/.exec(t);
        if (m) esito.account = m[1].trim().slice(0, 40);
        // PROVA15: competizioni con il motore generico (pagina «Tornei» + una pagina per competizione per la tipologia; GET, documento
        // inerte, nessuno script del sito eseguito). Un errore qui NON annulla il resto del controllo: l'esito lo dice.
        stato("leggo le competizioni (Tornei)…");
        return fvmFcLeggiCompetizioni(pagina, nl, fvmFcDocumento).then(function (C) { esito.competizioni = C; });
      }).catch(function (e) {
        esito.errori.push(String(e && e.message || e).slice(0, 160));
      }).then(function () { stato("fatto: torno a Fanta Vice Mister…"); setTimeout(fine, 300); });
    }, 400);
  }
  if (dominioFvm(location.hostname) === "fantaclub") { if (controlloFcInArrivo()) return; ramoFantaclub(); return; }
  function ramoFantaclub() {
    function logFc(tag, dati) {
      try {
        var d = new Date(), p = function (n) { return (n < 10 ? "0" : "") + n; };
        var righe = JSON.parse(localStorage.getItem(PREFISSO + "diag") || "[]");
        righe.push((p(d.getHours()) + ":" + p(d.getMinutes()) + ":" + p(d.getSeconds()) + " FVM " + tag + " " + JSON.stringify(dati)).slice(0, 300));
        localStorage.setItem(PREFISSO + "diag", JSON.stringify(righe.slice(-100)));
      } catch (e) {}
    }
    antiPubblicitaFc();
    // 1.1.0 Fantaclub · antipubblicita (fase B: dall'app Android, src/logic/fantaclub.js, adattata a Safari).
    // Cosa fa, SOLO su Fantaclub e SOLO con regole riconoscibili (mai login, consensi cookie, CAPTCHA, moduli, menu,
    // pulsanti del sito, barra FVM):
    //  - contenitori pubblicitari (Google Ads/GPT/AdSense, Outbrain/Teads, Taboola, AdChoices, lettori video
    //    "outstream"): nascosti con CSS E con stile scritto sull'elemento (vince sugli stili !important degli annunci);
    //  - iframe pubblicitari (domini pubblicitari, nomi da annuncio, dentro un contenitore pubblicitario o dentro una
    //    finestra fissa grande): svuotati e tolti (ferma anche il loro audio); iframe del sito, login, CAPTCHA,
    //    consensi e video YouTube/Vimeo restano;
    //  - script dei lettori video/native inseriti DOPO il caricamento (Teads, Outbrain, Taboola, Vidazoo, Primis…): non
    //    inseriti. Google NON viene bloccato a livello di script (il sito e la finestra dei consensi possono usarlo);
    //  - audio/video: nessun audio parte mai da solo. Lettori del sito fermi e muti all'apertura, partono solo con Play
    //    premuto su quel lettore, restano muti finche l'utente non usa il comando volume; pubblicita ferma; uscendo
    //    dalla pagina tutto si ferma;
    //  - zone protette precise: html/body e contenitori generali non proteggono nulla (solo finestre dei consensi vere,
    //    login, CAPTCHA, moduli con password);
    //  - finestre fisse trasparenti a tutto schermo che intercettano i tocchi: non ricevono piu i tocchi;
    //  - annunci "vignette" di Google sui link interni: esclusi con data-google-vignette="false".
    // Niente timer continui: un MutationObserver sui soli nodi nuovi (300 ms di attesa). Comandi nell'indirizzo, validi
    // SUBITO anche senza ricaricare: #fvm-noads=0 spenta · =1 accesa · =stato contatori · =analisi diagnosi della pagina.
    function antiPubblicitaFc() {
      // ACCESA per impostazione predefinita. #fvm-noads=0 la spegne SOLO per questa scheda (sessionStorage): chiusa la
      // scheda torna accesa da sola. Il vecchio spegnimento permanente (localStorage) non vale piu e viene tolto.
      var CHIAVE = PREFISSO + "fc_noads";
      var attiva = true;
      try { attiva = sessionStorage.getItem(CHIAVE) !== "0"; } catch (e) {}
      try { if (localStorage.getItem(CHIAVE) !== null) { localStorage.removeItem(CHIAVE); logFc("FANTACLUB PUBBLICITA", { interruttore: "vecchio spegnimento permanente tolto" }); } } catch (e) {}
      var conta = { overlay: 0, video: 0, iframe: 0, script: 0, play: 0, muti: 0, veli: 0, nascosti: 0 };
      var nascosteFvm = []; // elementi nascosti da FVM con stile sull'elemento (tornano visibili se si spegne)
      var veliFvm = [];     // finestre trasparenti rese "non toccabili" (tornano come prima se si spegne)
      // domini pubblicitari (iframe): Google Ads, Outbrain/Teads, Taboola, aste e lettori video pubblicitari
      var DOMINI = ["doubleclick.net", "googlesyndication.com", "googleadservices.com", "googletagservices.com", "adservice.google.com",
        "amazon-adsystem.com", "taboola.com", "outbrain.com", "teads.tv", "teads.com", "adnxs.com", "criteo.com", "criteo.net",
        "seedtag.com", "smartadserver.com", "adform.net", "rubiconproject.com", "pubmatic.com", "openx.net", "casalemedia.com",
        "3lift.com", "sharethrough.com", "gumgum.com", "yieldmo.com", "adsrvr.org", "vidazoo.com", "primis.tech", "aniview.com",
        "connatix.com", "ex.co", "sekindo.com", "springserve.com", "moatads.com", "adsafeprotected.com", "doubleverify.com",
        // lettori video che partono da soli con servizi sportivi/notizie (in un iframe esterno non si possono silenziare)
        "imasdk.googleapis.com", "dailymotion.com", "dmcdn.net", "vidverto.io",
        // visti nella diagnostica reale / rete pubblicitaria di Outbrain
        "4strokemedia.com", "zemanta.com"];
      // script dei lettori video/native che partono da soli (solo se inseriti dopo il caricamento)
      var DOMINI_SCRIPT = ["teads.tv", "teads.com", "outbrain.com", "taboola.com", "vidazoo.com", "primis.tech", "aniview.com",
        "connatix.com", "ex.co", "sekindo.com", "springserve.com", "dailymotion.com", "vidverto.io"];
      var diDominio = function (host, elenco) { host = String(host || "").toLowerCase(); return elenco.some(function (d) { return host === d || host.slice(-d.length - 1) === "." + d; }); };
      var SEL = ["ins.adsbygoogle", "[id^=\"google_ads\"]", "[id*=\"div-gpt-ad\"]", "[id^=\"gpt-ad\"]", "[class*=\"google-auto-placed\"]",
        "[data-google-query-id]", "[id*=\"taboola\"]", "[class*=\"taboola\"]", "[id*=\"outbrain\"]", "[class*=\"outbrain\"]", "[class*=\"OUTBRAIN\"]",
        "[class*=\"ob-widget\"]", "[class*=\"ob-smartfeed\"]", "[id*=\"teads\"]", "[class*=\"teads\"]",
        "[class*=\"adchoices\" i]", "[id*=\"adchoices\" i]", "a[href*=\"adchoices\" i]",
        "[id*=\"vidazoo\" i]", "[class*=\"vidazoo\" i]", "[id*=\"primis\" i]", "[class*=\"primis\" i]", "[id*=\"aniview\" i]", "[class*=\"aniview\" i]",
        "[id*=\"connatix\" i]", "[class*=\"connatix\" i]", "[id*=\"outstream\" i]", "[class*=\"outstream\" i]",
        "[class*=\"sticky-ad\"]", "[class*=\"video-ad\"]", "iframe[id^=\"google_ads_iframe\"]", "iframe[id^=\"aswift_\"]"]
        .concat(DOMINI.map(function (d) { return "iframe[src*=\"" + d + "\"]"; })).join(",");
      // zone mai toccate: login del sito, consensi cookie, CAPTCHA, moduli, barra FVM
      var PROTETTE = "#login-modal,#fvm-fc-root,#fvm-fc-analisi,form,[id*=\"cookie\" i],[class*=\"cookie\" i],[id*=\"consent\" i],[class*=\"consent\" i]," +
        "[id*=\"iubenda\" i],[class*=\"iubenda\" i],[id*=\"didomi\" i],[class*=\"qc-cmp\" i],[id*=\"cmp\" i]";
      var CMP = "[id*=\"cookie\" i],[class*=\"cookie\" i],[id*=\"consent\" i],[class*=\"consent\" i],[id*=\"cmp\" i],[class*=\"cmp\" i]," +
        "[id*=\"iubenda\" i],[id*=\"didomi\" i],[id*=\"onetrust\" i],[id*=\"cookiebot\" i],[id^=\"sp_message\" i],.fc-consent-root";
      var CMP_HOST = /consensu|privacy-mgmt|fundingchoices|iubenda|cookiebot|cookielaw|onetrust|didomi|quantcast|sourcepoint|consent/i;
      // iframe sempre legittimi: sito, CAPTCHA, accesso Google/Apple, video YouTube/Vimeo (se non dentro un annuncio)
      var HOST_OK = /(^|\.)fantaclub\.it$|(^|\.)recaptcha\.net$|(^|\.)hcaptcha\.com$|(^|\.)gstatic\.com$|^accounts\.google\.com$|^appleid\.apple\.com$|(^|\.)youtube(-nocookie)?\.com$|^player\.vimeo\.com$/i;
      var SEGNI_AD = /google_ads|aswift|\bgpt|prebid|adunit|(^|[\s_-])ads?([\s_-]|$)|banner|teads|outbrain|taboola|criteo|vidazoo|primis|aniview|connatix|outstream|sponsor/i;
      var dominio = function (u) {
        u = String(u || "").trim();
        if (!u) return "senza src";
        if (/^(about|javascript|data|blob):/i.test(u)) return u.split(":")[0] + ":";
        try { return new URL(u, location.href).hostname || "?"; } catch (e) { return "?"; }
      };
      // ZONE PROTETTE PRECISE (correzione della diagnostica reale): html e body NON contano mai, e nemmeno i contenitori
      // generali della pagina. Un nome con cookie/consent/cmp protegge solo una VERA finestra dei consensi (fissa, oppure
      // non grande quanto la pagina); un modulo protegge solo se ha un campo password o un CAPTCHA.
      var CMP_ID = /^(onetrust|didomi|iubenda|qc-cmp|sp_message|cookiebot|CybotCookiebot|usercentrics|truste|cmpbox|fc-consent)/i;
      var finestraCmp = function (n) {
        try {
          if (CMP_ID.test(n.id || "") || /(^|\s)(fc-consent-root|qc-cmp2-container|cmpbox)(\s|$)/i.test(typeof n.className === "string" ? n.className : "")) return true;
          if (!n.matches(CMP)) return false;
          var p = getComputedStyle(n).position;
          if (p === "fixed" || p === "sticky") return true;
          var alto = (document.documentElement && document.documentElement.scrollHeight) || 0;
          return n.getBoundingClientRect().height < Math.max(300, alto * 0.5);
        } catch (e) { return false; }
      };
      var moduloProtetto = function (n) { try { return n.tagName === "FORM" && !!n.querySelector("input[type=\"password\"],iframe[src*=\"recaptcha\"],iframe[src*=\"hcaptcha\"],.g-recaptcha,.h-captcha"); } catch (e) { return false; } };
      var zonaProtetta = function (el) {
        for (var n = el, i = 0; n && n.nodeType === 1 && i < 40; n = n.parentElement, i++) {
          if (n === document.body || n === document.documentElement) return false;
          if (n.id === "login-modal" || n.id === "fvm-fc-root" || n.id === "fvm-fc-analisi") return true;
          if (moduloProtetto(n) || finestraCmp(n)) return true;
        }
        return false;
      };
      var zonaCmp = function (el) {
        for (var n = el, i = 0; n && n.nodeType === 1 && i < 40; n = n.parentElement, i++) {
          if (n === document.body || n === document.documentElement) return false;
          if (finestraCmp(n)) return true;
        }
        return false;
      };
      var protetto = function (el) {
        try { return zonaProtetta(el) || !!el.querySelector("input[type=\"password\"],iframe[src*=\"recaptcha\"],iframe[src*=\"hcaptcha\"],nav,[role=\"navigation\"]") || moduloProtetto(el); } catch (e) { return true; }
      };
      var inAnnuncio = function (el) { try { return !!el.closest(SEL); } catch (e) { return false; } };
      // finestra fissa sopra la pagina che contiene l'elemento (vignette, video a tutto schermo, barra in basso)
      var contenitoreFisso = function (el) {
        var w = window.innerWidth || 1, h = window.innerHeight || 1;
        for (var n = el.parentElement, i = 0; n && i < 8 && n !== document.body && n !== document.documentElement; n = n.parentElement, i++) {
          var cs = getComputedStyle(n);
          if (cs.position !== "fixed" && cs.position !== "sticky") continue;
          var r = n.getBoundingClientRect();
          var grande = (r.width * r.height) / (w * h) >= 0.3 || (r.width >= w * 0.9 && r.height >= 50);
          return grande && !protetto(n) ? n : null;
        }
        return null;
      };
      var fissoGrande = function (el) {
        try {
          var cs = getComputedStyle(el);
          if (cs.position !== "fixed" && cs.position !== "sticky") return false;
          var r = el.getBoundingClientRect(), w = window.innerWidth || 1, h = window.innerHeight || 1;
          return (r.width * r.height) / (w * h) >= 0.3;
        } catch (e) { return false; }
      };
      // iframe pubblicitario? (prudente: un iframe sconosciuto nel contenuto della pagina resta)
      var iframePub = function (f) {
        try {
          if (zonaProtetta(f)) return false;
          var src = f.getAttribute("src") || "", d = dominio(src);
          if (/recaptcha|hcaptcha/i.test(src) || CMP_HOST.test(d)) return false;
          if (inAnnuncio(f)) return true;
          if (/\./.test(d)) { if (diDominio(d, DOMINI)) return true; if (HOST_OK.test(d)) return false; }
          if (SEGNI_AD.test((f.id || "") + " " + String(f.getAttribute("name") || "").slice(0, 120) + " " + (typeof f.className === "string" ? f.className : ""))) return true;
          // l'iframe stesso e la finestra a tutto schermo (es. "Continua a guardare" messo direttamente nella pagina)
          if (fissoGrande(f)) return true;
          return !!contenitoreFisso(f);
        } catch (e) { return false; }
      };
      var mediaPub = function (m) {
        try {
          // pubblicita = dentro un contenitore pubblicitario o in una finestra fissa grande. Un lettore nel contenuto della
          // pagina (es. highlights Sky Sport) NON e pubblicita, anche se il video arriva da un CDN pubblicitario: resta
          // visibile e utilizzabile, con le regole "fermo e muto" qui sotto.
          if (zonaProtetta(m)) return false;
          if (inAnnuncio(m)) return true;
          return !!contenitoreFisso(m);
        } catch (e) { return false; }
      };
      // nasconde con stile sull'elemento (display:none !important) e lo sorveglia: se l'annuncio lo rimostra, torna nascosto
      var guardiaStile = null;
      var nascondi = function (el) {
        if (!el || el.__fvmNascosto) return;
        el.__fvmNascosto = true; el.__fvmRimesso = 0;
        try { el.style.setProperty("display", "none", "important"); } catch (e) {}
        if (nascosteFvm.length < 800) nascosteFvm.push(el);
        conta.nascosti++;
        try { if (guardiaStile) guardiaStile.observe(el, { attributes: true, attributeFilter: ["style", "class"] }); } catch (e) {}
      };
      var fermaMedia = function (m) { try { m.muted = true; m.pause(); m.removeAttribute("autoplay"); conta.video++; } catch (e) {} };
      var togliIframe = function (f) {
        if (!f.isConnected || f.__fvmTolto) return;
        f.__fvmTolto = true;
        try { f.style.setProperty("display", "none", "important"); } catch (e) {}
        var box = contenitoreFisso(f);
        try { f.setAttribute("src", "about:blank"); } catch (e) {}
        try { f.remove(); } catch (e) {}
        conta.iframe++;
        if (box) chiudiFinestra(box);
      };
      var ultimoBlocco = 0;
      var chiudiFinestra = function (box) {
        if (!box || box.__fvmNascosto || protetto(box)) return;
        nascondi(box);
        conta.overlay++;
        ultimoBlocco = Date.now();
        sbloccaScorrimento();
      };
      // finestra di login o dei consensi visibile: lo scorrimento bloccato e voluto dal sito, non lo tocco
      var finestraSitoAperta = function () {
        try {
          var m = document.getElementById("login-modal");
          if (m && (m.classList.contains("show") || getComputedStyle(m).display === "block")) return true;
          return Array.prototype.some.call(document.querySelectorAll(CMP + ",.modal.show,[role=\"dialog\"]"), function (el) {
            if (el.__fvmNascosto || el === document.body || el === document.documentElement) return false;
            if (el.matches(CMP) && !el.matches(".modal.show,[role=\"dialog\"]") && !finestraCmp(el)) return false;
            var r = el.getBoundingClientRect(), cs = getComputedStyle(el);
            return r.width * r.height > 0 && cs.display !== "none" && cs.visibility !== "hidden";
          });
        } catch (e) { return true; }
      };
      var sbloccaScorrimento = function () {
        if (finestraSitoAperta()) return;
        [document.documentElement, document.body].forEach(function (b) {
          try {
            if (!b) return;
            if (b.style.overflow === "hidden") b.style.overflow = "";
            if (b.style.overflowY === "hidden") b.style.overflowY = "";
            // blocco messo con una classe dall'annuncio appena chiuso: riapro solo lo scorrimento verticale
            if (Date.now() - ultimoBlocco < 3000 && /hidden|clip/.test(getComputedStyle(b).overflowY)) { b.style.setProperty("overflow-y", "auto", "important"); b.__fvmScroll = true; }
          } catch (e) {}
        });
      };
      // finestra fissa trasparente grande, senza contenuti ne pulsanti, che riceve i tocchi: non li riceve piu
      var velo = function (n) {
        try {
          if (!n.isConnected || n.__fvmVelo || n.__fvmNascosto || protetto(n)) return;
          var cs = getComputedStyle(n);
          if (cs.position !== "fixed" || cs.pointerEvents === "none" || cs.display === "none" || cs.visibility === "hidden") return;
          var r = n.getBoundingClientRect(), w = window.innerWidth || 1, h = window.innerHeight || 1;
          if ((r.width * r.height) / (w * h) < 0.5) return;
          if (n.querySelector(SEL) || Array.prototype.some.call(n.querySelectorAll("iframe"), iframePub)) { chiudiFinestra(n); return; }
          if (n.matches("[class*=\"modal\"],[role=\"dialog\"]") || n.querySelector("button,a,input,select,textarea,img,video,canvas,svg,iframe")) return;
          var vuoto = Number(cs.opacity) <= 0.05 || (/rgba\(0, 0, 0, 0\)|transparent/.test(cs.backgroundColor) && !String(n.textContent || "").trim());
          if (!vuoto) return;
          n.__fvmVelo = true;
          n.style.setProperty("pointer-events", "none", "important");
          veliFvm.push(n); conta.veli++;
        } catch (e) {}
      };
      var esamina = function (el) {
        if (!attiva || !el || el.nodeType !== 1 || el.__fvmVisto) return;
        el.__fvmVisto = true;
        var tag = el.tagName;
        if (tag === "IFRAME") { if (iframePub(el)) togliIframe(el); return; }
        if (tag === "VIDEO" || tag === "AUDIO") { if (mediaPub(el)) fermaMedia(el); else preparaLettore(el); return; }
        if (tag === "A") { segnaLink(el); }
        var annuncio = false;
        try { annuncio = el.matches(SEL); } catch (e) {}
        if (!annuncio || protetto(el)) return;
        nascondi(el);
        try { Array.prototype.forEach.call(el.querySelectorAll("video,audio"), fermaMedia); } catch (e) {}
        try { Array.prototype.forEach.call(el.querySelectorAll("iframe"), togliIframe); } catch (e) {}
        var box = contenitoreFisso(el);
        if (box) chiudiFinestra(box);
      };
      // annunci "vignette" di Google: esclusi sui link interni del sito (attributo previsto da Google)
      var segnaLink = function (a) {
        try { if (a.hostname && /(^|\.)fantaclub\.it$/i.test(a.hostname) && !a.hasAttribute("data-google-vignette")) a.setAttribute("data-google-vignette", "false"); } catch (e) {}
      };
      var coda = [], attesa = null, candidatiVelo = [];
      var svuota = function () {
        attesa = null;
        var nodi = coda.splice(0, 400);
        if (!attiva) return;
        nodi.forEach(function (n) {
          try {
            if (!n.isConnected || (n.closest && n.closest("#fvm-fc-root,#fvm-fc-analisi"))) return;
            esamina(n);
            if (n.querySelectorAll) Array.prototype.forEach.call(n.querySelectorAll("iframe,video,audio,ins,a[href]," + SEL), esamina);
            // finestre aggiunte in cima alla pagina: controllo "velo" dopo che si sono assestate (animazioni)
            if (n.parentElement === document.body || n.parentElement === document.documentElement) candidatiVelo.push(n);
          } catch (e) {}
        });
        if (candidatiVelo.length) setTimeout(function () { var c = candidatiVelo.splice(0, 50); if (attiva) c.forEach(velo); }, 1200);
      };
      var accoda = function (n) { if (!attiva) return; if (n && n.nodeType === 1 && coda.length < 2000) coda.push(n); if (!attesa) attesa = setTimeout(svuota, 300); };

      // ---------- audio/video. PRIORITA: NESSUN AUDIO PARTE MAI DA SOLO.
      //  - all'apertura (e dopo ogni refresh) ogni lettore della pagina e FERMO e MUTO, e resta visibile con i suoi comandi;
      //  - parte solo con un tocco volontario SU QUEL LETTORE (Play); scorrere la pagina non conta;
      //  - anche dopo Play resta muto: l'audio si attiva solo dal comando volume/altoparlante del lettore;
      //  - i lettori pubblicitari (dentro annunci o finestre fisse) restano fermi; uscendo dalla pagina tutto si ferma.
      // Gesto = click/tasto (non lo scorrimento); i tocchi sulla barra/pannelli FVM non contano.
      var gesto = { t: 0, el: null };
      var segnaGesto = function (ev) {
        try {
          var t = ev.target;
          if (!t || t.nodeType !== 1 || (t.closest && t.closest("#fvm-fc-root,#fvm-fc-analisi"))) return;
          if (ev.type === "keydown" && !/^(Enter| |Spacebar|k|m|M)$/.test(ev.key || "")) return;
          // touchend vale solo sul lettore stesso (comandi nativi di iOS, che non generano click)
          if (ev.type === "touchend" && t.tagName !== "VIDEO" && t.tagName !== "AUDIO") return;
          gesto = { t: Date.now(), el: t };
        } catch (e) {}
      };
      try { ["click", "keydown", "touchend"].forEach(function (t) { window.addEventListener(t, segnaGesto, { capture: true, passive: true }); }); } catch (e) {}
      // il tocco recente e su questo lettore? (il lettore stesso o il suo riquadro con i comandi, mai tutta la pagina)
      var gestoSu = function (m) {
        if (!gesto.el || Date.now() - gesto.t > 1500) return false;
        if (gesto.el === m) return true;
        var h = window.innerHeight || 800;
        for (var n = m.parentElement, i = 0; n && i < 6 && n !== document.body && n !== document.documentElement; n = n.parentElement, i++) {
          try { if (n.getBoundingClientRect().height > h * 2.5) return false; } catch (e) { return false; }
          if (n.contains(gesto.el)) return true;
        }
        return false;
      };
      // il tocco e sul comando volume/altoparlante del lettore (o sui comandi nativi del video)
      var RE_VOLUME = /volume|mute|muto|unmute|audio|sound|speaker|altoparlante/i;
      var gestoVolume = function (m) {
        if (!gestoSu(m)) return false;
        if (gesto.el === m) return !!m.controls;
        for (var n = gesto.el, i = 0; n && n.nodeType === 1 && i < 6 && n !== m.parentElement; n = n.parentElement, i++) {
          var segni = (typeof n.className === "string" ? n.className : "") + " " + (n.id || "") + " " + (n.getAttribute("aria-label") || "") + " " + (n.getAttribute("title") || "");
          if (RE_VOLUME.test(segni)) return true;
        }
        return false;
      };
      // lettore del sito: fermo e muto all'apertura, autoplay tolto (i comandi restano)
      var preparaLettore = function (m) {
        if (m.__fvmPronto) return;
        m.__fvmPronto = true;
        try {
          m.muted = true; m.setAttribute("muted", ""); m.autoplay = false; m.removeAttribute("autoplay");
          if (!m.paused && !gestoSu(m)) { m.pause(); conta.play++; logAudio("partenza automatica impedita", m); }
          conta.muti++;
        } catch (e) {}
      };
      var bloccato = function () {
        try { return Promise.reject(new DOMException("FVM: riproduzione automatica bloccata", "NotAllowedError")); } catch (e) { return Promise.resolve(); }
      };
      var playOrig = null, appendOrig = null, insertOrig = null;
      var playFvm = function () {
        try {
          if (attiva) {
            if (mediaPub(this)) { fermaMedia(this); conta.play++; logAudio("pubblicita fermata", this); return bloccato(); }
            preparaLettore(this);
            // partenza automatica (nessun tocco su questo lettore): non parte, come la politica autoplay di Safari
            // (dopo un Play dell'utente il lettore puo richiamare play() poco dopo: caricamento, pre-roll; vale finche
            // l'utente non preme Pausa)
            if (gestoSu(this)) this.__fvmUtente = true;
            if (!this.__fvmUtente) { try { this.pause(); } catch (e) {} conta.play++; logAudio("partenza automatica impedita", this); return bloccato(); }
            // Play premuto dall'utente: parte, ma MUTO finche l'utente non attiva l'audio dal comando volume
            if (!this.__fvmAudioOk) this.muted = true;
          }
        } catch (e) {}
        return playOrig.apply(this, arguments);
      };
      // audio/video partiti senza play() (attributo autoplay, comandi nativi): stessa regola
      var suPlay = function (ev) {
        var m = ev.target;
        if (!attiva || !m || (m.tagName !== "VIDEO" && m.tagName !== "AUDIO")) return;
        try {
          if (mediaPub(m)) { fermaMedia(m); conta.play++; logAudio("pubblicita fermata", m); return; }
          preparaLettore(m);
          if (gestoSu(m)) m.__fvmUtente = true;
          if (!m.__fvmUtente) { m.pause(); conta.play++; logAudio("partenza automatica impedita", m); return; }
          if (!m.__fvmAudioOk && !m.muted) m.muted = true;
        } catch (e) {}
      };
      // Pausa premuta dall'utente: da qui il lettore non riparte da solo
      var suPausa = function (ev) {
        var m = ev.target;
        if (!m || (m.tagName !== "VIDEO" && m.tagName !== "AUDIO")) return;
        if (gestoSu(m)) m.__fvmUtente = false;
      };
      // audio attivato: valido SOLO se l'utente ha toccato il comando volume/altoparlante di quel lettore
      var suVolume = function (ev) {
        var m = ev.target;
        if (!attiva || !m || (m.tagName !== "VIDEO" && m.tagName !== "AUDIO") || m.muted || !(m.volume > 0)) return;
        try {
          if (!mediaPub(m) && gestoVolume(m)) { m.__fvmAudioOk = true; logAudio("audio attivato dall'utente", m); return; }
          m.muted = true; logAudio("audio non richiesto rimesso muto", m);
        } catch (e) {}
      };
      var audioLoggato = {};
      // PROVA15 (diagnosi): anche quale elemento e da quale sito (solo il dominio, mai l'indirizzo completo); una riga per esito e sorgente
      var logAudio = function (cosa, m) {
        var sorg = "", tag = "";
        try { tag = m && m.tagName ? m.tagName.toLowerCase() : ""; sorg = m ? dominio(m.currentSrc || m.src || "") || (String(m.currentSrc || m.src || "").indexOf("blob:") === 0 ? "flusso della pagina" : "") : ""; } catch (e) {}
        var k = cosa + "|" + tag + "|" + sorg;
        if (audioLoggato[k]) return; audioLoggato[k] = 1;
        logFc("FANTACLUB AUDIO", { esito: cosa, elemento: tag || "non indicato", sorgente: sorg || "non indicata", pagina: location.pathname });
      };
      var scriptBloccato = function (n) {
        try { return attiva && n && n.tagName === "SCRIPT" && n.src && diDominio(dominio(n.src), DOMINI_SCRIPT); } catch (e) { return false; }
      };
      var appendFvm = function (n) { if (scriptBloccato(n)) { conta.script++; logScript(n); return n; } return appendOrig.apply(this, arguments); };
      var insertFvm = function (n) { if (scriptBloccato(n)) { conta.script++; logScript(n); return n; } return insertOrig.apply(this, arguments); };
      var scriptLoggati = {};
      var logScript = function (n) { var d = dominio(n.src); if (scriptLoggati[d]) return; scriptLoggati[d] = 1; logFc("FANTACLUB PUBBLICITA", { script: d, esito: "non inserito" }); };
      var aggancia = function () {
        try {
          var MP = window.HTMLMediaElement && window.HTMLMediaElement.prototype;
          if (MP && MP.play !== playFvm) { playOrig = MP.play; MP.play = playFvm; }
          var NP = window.Node && window.Node.prototype;
          if (NP && NP.appendChild !== appendFvm) { appendOrig = NP.appendChild; NP.appendChild = appendFvm; insertOrig = NP.insertBefore; NP.insertBefore = insertFvm; }
        } catch (e) {}
      };
      var sgancia = function () {
        try {
          var MP = window.HTMLMediaElement && window.HTMLMediaElement.prototype;
          if (MP && MP.play === playFvm && playOrig) MP.play = playOrig;
          var NP = window.Node && window.Node.prototype;
          if (NP && NP.appendChild === appendFvm && appendOrig) { NP.appendChild = appendOrig; NP.insertBefore = insertOrig; }
        } catch (e) {}
      };
      // uscendo dalla pagina (CHIUDI, SOLO FLE, link): nessun audio deve continuare
      var fermaTutto = function () {
        if (!attiva) return;
        try { Array.prototype.forEach.call(document.querySelectorAll("video,audio"), function (m) { try { m.muted = true; m.pause(); } catch (e) {} }); } catch (e) {}
      };

      var stile = null, stileDentro = false, osservatore = null, ascolti = false;
      var accendi = function () {
        if (!document.documentElement) return false;
        if (!stile) { stile = document.createElement("style"); stile.id = "fvm-fc-noads"; stile.textContent = SEL + "{display:none!important}"; }
        if (!stileDentro) { (appendOrig || document.documentElement.appendChild).call(document.documentElement, stile); stileDentro = true; }
        aggancia();
        try {
          var MO = window.MutationObserver;
          if (MO && !osservatore) osservatore = new MO(function (lista) {
            lista.forEach(function (m) {
              if (m.type === "attributes") { if (m.target.tagName === "IFRAME") { m.target.__fvmVisto = false; accoda(m.target); } }
              else Array.prototype.forEach.call(m.addedNodes || [], accoda);
            });
          });
          if (osservatore) osservatore.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["src"] });
          if (MO && !guardiaStile) guardiaStile = new MO(function (lista) {
            lista.forEach(function (m) {
              var el = m.target;
              if (!attiva || !el.__fvmNascosto || el.__fvmRimesso > 30) return;
              if (el.style.getPropertyValue("display") === "none" && el.style.getPropertyPriority("display") === "important") return;
              el.__fvmRimesso++;
              try { el.style.setProperty("display", "none", "important"); } catch (e) {}
            });
          });
        } catch (e) {}
        if (!ascolti) {
          ascolti = true;
          document.addEventListener("DOMContentLoaded", function () { accoda(document.documentElement); });
          try { document.addEventListener("play", suPlay, true); document.addEventListener("pause", suPausa, true); document.addEventListener("volumechange", suVolume, true); } catch (e) {}
          try { window.addEventListener("pagehide", fermaTutto); } catch (e) {}
        }
        if (document.readyState !== "loading") accoda(document.documentElement);
        return true;
      };
      // spegnimento immediato (anche a pagina bloccata): via CSS, osservatori e agganci; elementi nascosti di nuovo
      // visibili (gli iframe gia tolti tornano solo ricaricando la pagina)
      var spegni = function () {
        try { if (osservatore) osservatore.disconnect(); } catch (e) {}
        try { if (guardiaStile) guardiaStile.disconnect(); } catch (e) {}
        sgancia();
        try { if (stile && stileDentro) stile.remove(); } catch (e) {}
        stileDentro = false;
        coda = []; candidatiVelo = [];
        nascosteFvm.forEach(function (b) { try { b.style.removeProperty("display"); b.__fvmNascosto = false; } catch (e) {} });
        veliFvm.forEach(function (b) { try { b.style.removeProperty("pointer-events"); b.__fvmVelo = false; } catch (e) {} });
        [document.documentElement, document.body].forEach(function (b) { try { if (b && b.__fvmScroll) { b.style.removeProperty("overflow-y"); b.__fvmScroll = false; } } catch (e) {} });
        nascosteFvm = []; veliFvm = [];
      };
      var riepilogo = function () {
        var nascosti = 0;
        try { if (attiva) nascosti = document.querySelectorAll(SEL).length; } catch (e) {}
        return { attiva: attiva, nascosti: nascosti, overlay: conta.overlay, video: conta.video, iframe: conta.iframe, script: conta.script, play: conta.play, muti: conta.muti, veli: conta.veli };
      };
      var radice = function () { return document.body || document.documentElement; };
      var avviso = function (testo) {
        try {
          if (!radice()) return;
          var host = document.createElement("div");
          radice().appendChild(host);
          var r = host.attachShadow ? host.attachShadow({ mode: "open" }) : host;
          r.innerHTML = "<div style='position:fixed;left:10px;right:10px;top:calc(env(safe-area-inset-top,0px) + 10px);z-index:2147483647;background:#0d1a2e;" +
            "border:2px solid #e2b33c;border-radius:14px;padding:10px 12px;font:800 13px -apple-system,Arial;color:#e8edf5;text-align:center'>" + testo + "</div>";
          setTimeout(function () { try { host.remove(); } catch (e) {} }, 5000);
        } catch (e) {}
      };

      // ---------- ANALISI (solo lettura): nessun testo della pagina, nessun indirizzo completo, nessun cookie
      // Solo: tag, id e classi accorciati (numeri lunghi tolti), domini, misure, stili di scorrimento e tocco.
      var corto = function (s) { return String(s || "").replace(/\d{5,}/g, "…").replace(/[^\w\-…]/g, "").slice(0, 28); };
      var breve = function (el) {
        if (!el || !el.tagName) return "-";
        var cl = typeof el.className === "string" ? el.className.trim() : "";
        return el.tagName.toLowerCase() + (el.id ? "#" + corto(el.id) : "") + (cl ? "." + cl.split(/\s+/).slice(0, 2).map(corto).join(".") : "");
      };
      var vede = function (el) { try { var cs = getComputedStyle(el), r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && cs.display !== "none" && cs.visibility !== "hidden" && Number(cs.opacity) > 0.05; } catch (e) { return false; } };
      var daFvm = function (el) {
        try {
          if (attiva && el.closest(SEL)) return " · NASCOSTO-FVM";
          for (var n = el, i = 0; n && i < 10; n = n.parentElement, i++) { if (n.__fvmNascosto) return " · NASCOSTO-FVM(finestra)"; if (n.__fvmVelo) return " · VELO-SENZA-TOCCHI"; }
        } catch (e) {}
        return "";
      };
      var fissoSopra = function (el) {
        for (var n = el, i = 0; n && i < 12 && n !== document.documentElement; n = n.parentElement, i++) {
          try { var p = getComputedStyle(n).position; if (p === "fixed" || p === "sticky") return n; } catch (e) { return null; }
        }
        return null;
      };
      var analisi = function () {
        var w = window.innerWidth || 1, h = window.innerHeight || 1, righe = [], somm = {};
        var copre = function (r) { return Math.round(100 * Math.max(0, Math.min(r.right, w) - Math.max(r.left, 0)) * Math.max(0, Math.min(r.bottom, h) - Math.max(r.top, 0)) / (w * h)); };
        var misura = function (r) { return Math.round(r.width) + "x" + Math.round(r.height) + "@" + Math.round(r.top); };
        var fvm = document.getElementById("fvm-fc-root");
        var barraFvm = null;
        try { var bs = fvm && fvm.shadowRoot && fvm.shadowRoot.querySelector(".barra,.b"); if (bs) barraFvm = bs.getBoundingClientRect(); } catch (e) {}
        var dellaBarra = function (el) { return !!(fvm && el && (el === fvm || fvm.contains(el))); };
        righe.push("FVM " + etichettaVersione(VERSIONE) + " (" + VERSIONE + ") · ANALISI " + new Date().toLocaleTimeString("it-IT") + " · " + location.hostname + location.pathname);
        righe.push("antipubblicità " + (attiva ? "ACCESA" : "SPENTA") + " · schermo " + w + "x" + h + " · barra FVM " + (barraFvm ? misura(barraFvm) : "assente"));
        righe.push("bloccati: iframe " + conta.iframe + " · script " + conta.script + " · finestre " + conta.overlay + " · partenze automatiche impedite " + conta.play + " · video pubblicitari fermati " + conta.video + " · lettori resi muti " + conta.muti + " · veli " + conta.veli);

        righe.push("— SCORRIMENTO");
        var bloccato = false;
        [["html", document.documentElement], ["body", document.body]].forEach(function (p) {
          var el = p[1]; if (!el) return;
          var cs = getComputedStyle(el);
          if (/hidden|clip/.test(cs.overflowY) || cs.position === "fixed" || cs.pointerEvents === "none" || cs.touchAction === "none") bloccato = true;
          var cl = typeof el.className === "string" ? el.className.trim() : "";
          righe.push(p[0] + ": overflow " + cs.overflowX + "/" + cs.overflowY + " · position " + cs.position + " · touch " + (cs.touchAction || "-") + " · tocchi " + cs.pointerEvents +
            (el.style.overflow || el.style.position ? " · STILE DIRETTO " + (el.style.overflow || "") + " " + (el.style.position || "") : "") +
            (cl ? " · classi " + cl.split(/\s+/).slice(0, 6).map(corto).join(" ") : ""));
        });
        var se = document.scrollingElement || document.documentElement;
        righe.push("pagina alta " + se.scrollHeight + " · posizione " + Math.round(window.scrollY || 0) + " · " + (bloccato ? "⚠ SCORRIMENTO BLOCCATO DA STILE" : "nessun blocco di stile"));
        somm.scroll = bloccato ? "bloccato" : "ok";

        righe.push("— TOCCHI (chi riceve il dito)");
        var trasparenti = 0;
        [["centro", 0.5, 0.5], ["alto", 0.5, 0.15], ["basso", 0.5, 0.85], ["sinistra", 0.15, 0.5], ["destra", 0.85, 0.5]].forEach(function (p) {
          var el = document.elementFromPoint(w * p[1], h * p[2]);
          if (!el) { righe.push(p[0] + ": nessuno"); return; }
          var cs = getComputedStyle(el), r = el.getBoundingClientRect(), f = fissoSopra(el);
          var vuoto = Number(cs.opacity) <= 0.05 || (/rgba\(0, 0, 0, 0\)|transparent/.test(cs.backgroundColor) && !String(el.textContent || "").trim() && !el.querySelector("img,iframe,video,svg,canvas,input,button"));
          var avv = vuoto && copre(r) >= 30 ? " · ⚠ TRASPARENTE SOPRA LA PAGINA" : "";
          if (avv) trasparenti++;
          righe.push(p[0] + ": " + (dellaBarra(el) ? "barra FVM" : breve(el)) + " · copre " + copre(r) + "% · z " + cs.zIndex + (f && f !== el ? " · dentro fisso " + breve(f) : "") + avv + daFvm(el));
        });
        somm.trasparenti = trasparenti;

        righe.push("— FISSI GRANDI (≥15% dello schermo o barre)");
        var tutti = document.body ? document.body.getElementsByTagName("*") : [], nf = 0;
        for (var i = 0; i < tutti.length && i < 6000 && nf < 12; i++) {
          var el = tutti[i];
          if (dellaBarra(el) || el.id === "fvm-fc-analisi") continue;
          var cs = getComputedStyle(el);
          if (cs.position !== "fixed" && cs.position !== "sticky") continue;
          var r = el.getBoundingClientRect(), c = copre(r);
          if (c < 15 && !(r.width >= w * 0.9 && r.height >= 40)) continue;
          nf++;
          var invTocc = Number(cs.opacity) <= 0.05 && cs.visibility !== "hidden" && cs.pointerEvents !== "none";
          righe.push(breve(el) + " · " + cs.position + " " + misura(r) + " · " + c + "% · z " + cs.zIndex + " · " + (vede(el) ? "visibile" : "invisibile") +
            " · tocchi " + cs.pointerEvents + " · iframe " + el.getElementsByTagName("iframe").length + (invTocc ? " · ⚠ INVISIBILE MA TOCCABILE" : "") +
            (zonaCmp(el) ? " · COOKIE" : "") + daFvm(el));
        }
        if (!nf) righe.push("nessuno");
        somm.fissi = nf;

        righe.push("— IFRAME RIMASTI (classificazione FVM)");
        var ifr = document.getElementsByTagName("iframe");
        righe.push("totale " + ifr.length + (ifr.length > 25 ? " (mostro i primi 25)" : ""));
        Array.prototype.slice.call(ifr, 0, 25).forEach(function (f) {
          var d = dominio(f.getAttribute("src")), r = f.getBoundingClientRect();
          righe.push(d + " · " + breve(f) + " · in " + breve(f.parentElement) + " < " + breve(f.parentElement && f.parentElement.parentElement) +
            " · " + misura(r) + " · " + (vede(f) ? "visibile" : "invisibile") + (zonaCmp(f) || CMP_HOST.test(d) ? " · COOKIE" : "") + (iframePub(f) ? " · PUBBLICITÀ" : " · lasciato") + daFvm(f));
        });
        somm.iframe = ifr.length;

        righe.push("— AUDIO/VIDEO");
        var vid = document.querySelectorAll("video,audio");
        righe.push("totale " + vid.length);
        Array.prototype.slice.call(vid, 0, 6).forEach(function (v) {
          righe.push(v.tagName.toLowerCase() + " in " + breve(v.parentElement) + " · " + misura(v.getBoundingClientRect()) + " · " + (v.paused ? "in pausa" : "IN RIPRODUZIONE") + (v.muted ? " · muto" : " · audio") + (mediaPub(v) ? " · PUBBLICITÀ" : "") + daFvm(v));
        });

        righe.push("— BANNER FUORI DAGLI IFRAME (link e immagini esterne ≥100x40, solo dominio)");
        var visti = {}, nb = 0;
        Array.prototype.forEach.call(document.querySelectorAll("a[href],img[src]"), function (el) {
          if (nb >= 10) return;
          var d = dominio(el.tagName === "A" ? el.getAttribute("href") : el.getAttribute("src"));
          if (!/\./.test(d) || /(^|\.)fantaclub\.it$/i.test(d)) return;
          var r = el.getBoundingClientRect();
          if (r.width < 100 || r.height < 40) return;
          var k = d + "|" + breve(el.parentElement);
          if (visti[k]) return;
          visti[k] = 1; nb++;
          righe.push(el.tagName.toLowerCase() + " " + d + " · in " + breve(el.parentElement) + " · " + misura(r) + daFvm(el));
        });
        if (!nb) righe.push("nessuno");

        righe.push("— FINESTRA COOKIE");
        var cmp = Array.prototype.filter.call(document.querySelectorAll(CMP), function (el) {
          if (el === document.body || el === document.documentElement || !finestraCmp(el) || (el.parentElement && zonaCmp(el.parentElement))) return false;
          var r = el.getBoundingClientRect();
          return r.width * r.height >= w * h * 0.05;
        }).slice(0, 5);
        Array.prototype.forEach.call(ifr, function (f) { if (cmp.length < 6 && CMP_HOST.test(dominio(f.getAttribute("src"))) && !zonaCmp(f)) cmp.push(f); });
        var cmpVisibile = false;
        cmp.forEach(function (el) {
          var cs = getComputedStyle(el), r = el.getBoundingClientRect(), v = vede(el);
          if (v) cmpVisibile = true;
          var sovrapp = barraFvm && v && r.left < barraFvm.right && r.right > barraFvm.left && r.top < barraFvm.bottom && r.bottom > barraFvm.top;
          righe.push(breve(el) + " · " + cs.position + " " + misura(r) + " · z " + cs.zIndex + " · " + (v ? "VISIBILE" : "non visibile") + (sovrapp ? " · ⚠ SOTTO/ACCANTO ALLA BARRA FVM" : "") + daFvm(el));
          if (!v) return;
          var puls = el.tagName === "IFRAME" ? [el] : Array.prototype.filter.call(el.querySelectorAll("button,a,[role=\"button\"]"), vede).slice(0, 4);
          puls.forEach(function (b) {
            var rb = b.getBoundingClientRect(), x = rb.left + rb.width / 2, y = rb.top + rb.height / 2;
            if (x < 0 || y < 0 || x > w || y > h) { righe.push("  pulsante " + breve(b) + " · fuori schermo"); return; }
            var top = document.elementFromPoint(x, y);
            righe.push("  pulsante " + breve(b) + " · " + (top && (top === b || b.contains(top) || el.contains(top)) ? "raggiungibile" : "⚠ COPERTO da " + (dellaBarra(top) ? "barra FVM" : breve(top))));
          });
        });
        if (!cmp.length) righe.push("nessuna");
        somm.cookie = cmpVisibile ? "visibile" : cmp.length ? "presente" : "no";

        righe.push("— REGOLE FVM");
        if (!attiva) righe.push("spente: nessun elemento nascosto da FVM");
        else {
          var ns = document.querySelectorAll(SEL);
          righe.push("CSS: " + ns.length + " elementi");
          Array.prototype.slice.call(ns, 0, 12).forEach(function (el) { righe.push("  " + breve(el) + (el.tagName === "IFRAME" ? " " + dominio(el.getAttribute("src")) : "")); });
          righe.push("nascosti sull'elemento: " + nascosteFvm.length + nascosteFvm.slice(0, 5).map(function (b) { return " | " + breve(b); }).join(""));
          somm.css = ns.length;
        }
        somm.finestre = conta.overlay; somm.tolti = conta.iframe; somm.script = conta.script; somm.audio = conta.play + conta.video; somm.muti = conta.muti;
        logFc("FANTACLUB ANALISI", somm);
        pannello(righe);
      };
      var pannello = function (righe) {
        try {
          var vecchio = document.getElementById("fvm-fc-analisi");
          if (vecchio) vecchio.remove();
          var host = document.createElement("div");
          host.id = "fvm-fc-analisi";
          // dopo il body: sopra a tutto, anche a una pagina bloccata
          (appendOrig || document.documentElement.appendChild).call(document.documentElement, host);
          var r = host.attachShadow ? host.attachShadow({ mode: "open" }) : host;
          var testo = righe.join("\n");
          var esc = function (s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); };
          r.innerHTML = "<style>:host{all:initial}.p{position:fixed;left:6px;right:6px;top:calc(env(safe-area-inset-top,0px) + 6px);max-height:78vh;z-index:2147483647;display:flex;flex-direction:column;" +
            "background:#0d1a2e;border:2px solid #e2b33c;border-radius:12px;color:#e8edf5;pointer-events:auto;box-shadow:0 4px 16px rgba(0,0,0,.5)}" +
            ".r{display:flex;gap:6px;padding:6px;border-bottom:1px solid #2a4370}.t{flex:1;color:#e2b33c;font:900 12px -apple-system,Arial;align-self:center}" +
            ".x{border:1px solid #e2b33c;background:#14243d;color:#e2b33c;border-radius:10px;padding:7px 10px;font:900 12px -apple-system,Arial;cursor:pointer}" +
            "pre{margin:0;padding:8px;overflow:auto;-webkit-overflow-scrolling:touch;white-space:pre-wrap;word-break:break-word;font:11px/1.35 Menlo,monospace}</style>" +
            "<div class='p'><div class='r'><span class='t'>FVM · ANALISI PUBBLICITÀ</span><span class='x' id='copia'>COPIA</span><span class='x' id='chiudi'>CHIUDI</span></div><pre>" + esc(testo) + "</pre></div>";
          r.getElementById("chiudi").addEventListener("click", function () { try { host.remove(); } catch (e) {} });
          r.getElementById("copia").addEventListener("click", function () {
            var b = r.getElementById("copia");
            try {
              navigator.clipboard.writeText(testo).then(function () { b.textContent = "COPIATO ✓"; }, function () { b.textContent = "USA SCREENSHOT"; });
            } catch (e) { b.textContent = "USA SCREENSHOT"; }
          });
        } catch (e) {}
      };

      var comando = function (cmd, alCaricamento) {
        if (cmd === "0" || cmd === "1") {
          try { if (cmd === "0") sessionStorage.setItem(CHIAVE, "0"); else sessionStorage.removeItem(CHIAVE); } catch (e) {}
          var prima = attiva;
          attiva = cmd === "1";
          if (attiva && !prima) accendi();
          if (!attiva && prima) spegni();
          logFc("FANTACLUB PUBBLICITA", alCaricamento ? { interruttore: attiva ? "accesa" : "spenta" } : { interruttore: attiva ? "accesa" : "spenta", subito: true });
        }
        var mostra = function () {
          try {
            if (cmd === "analisi") { analisi(); return; }
            var x = riepilogo();
            avviso("FVM antipubblicità: " + (attiva ? "ACCESA" : "SPENTA") + (attiva ? " · nascosti " + x.nascosti + " · finestre " + x.overlay + " · video " + x.video +
              " · iframe tolti " + x.iframe + " · audio fermati " + x.play + " · muti " + x.muti : "") +
              (alCaricamento ? "" : " (subito, senza ricaricare)"));
          } catch (e) {}
        };
        if (!alCaricamento) { mostra(); return; }
        setTimeout(function () { if (document.body) mostra(); else document.addEventListener("DOMContentLoaded", mostra); }, 2500);
      };
      var leggiComando = function () { return (String(location.hash || "").match(/^#fvm-noads=(0|1|stato|analisi)$/) || [])[1] || ""; };
      var togliComando = function () { try { history.replaceState(history.state, "", location.pathname + location.search); } catch (e) {} };
      var iniziale = leggiComando();
      if (iniziale) { togliComando(); comando(iniziale, true); }
      try {
        if (attiva && !accendi()) document.addEventListener("readystatechange", function una() { if (attiva && accendi()) document.removeEventListener("readystatechange", una); });
      } catch (e) {}
      // comando scritto nell'indirizzo a pagina gia aperta: Safari cambia solo il frammento (nessun ricaricamento)
      try {
        window.addEventListener("hashchange", function () {
          var c = leggiComando();
          if (!c) return;
          togliComando();
          comando(c, false);
        });
      } catch (e) {}
      // diagnosi sintetica: una riga per pagina, solo se c'e qualcosa da dire (percorso senza parametri, solo contatori)
      setTimeout(function () {
        try {
          var x = riepilogo();
          if (x.nascosti || x.overlay || x.video || x.iframe || x.script || x.play || x.muti || x.veli)
            logFc("FANTACLUB PUBBLICITA", { pagina: location.pathname, nascosti: x.nascosti, overlay: x.overlay, video: x.video, iframe: x.iframe, script: x.script, audio: x.play, muti: x.muti, veli: x.veli });
          // PROVA15 (diagnosi audio): riquadri di altri siti RIMASTI nella pagina (FVM non puo silenziarli dall'esterno, solo toglierli
          // se riconosciuti come pubblicita) e lettori presenti: solo domini e numeri
          var rim = {}, nM = 0;
          Array.prototype.forEach.call(document.querySelectorAll("iframe"), function (f) { var d = dominio(f.src || ""); if (d && d !== location.hostname) rim[d] = (rim[d] || 0) + 1; });
          Array.prototype.forEach.call(document.querySelectorAll("video,audio"), function () { nM++; });
          if (Object.keys(rim).length || nM) logFc("FANTACLUB AUDIO", { esito: "controllo dopo 4 s", lettori: nM, riquadriAltriSiti: Object.keys(rim).slice(0, 8).map(function (d) { return d + (rim[d] > 1 ? "×" + rim[d] : ""); }).join(","), pagina: location.pathname });
        } catch (e) {}
      }, 4000);
    }
    var arrivo = riceviPassaggio();
    if (arrivo) {
      // fase 3: ACCEDI dalla Home FVM: lo ricordo nella scheda (il login del sito puo ricaricare la pagina)
      if (arrivo.ok && arrivo.msg.tipo === "accedi") { try { sessionStorage.setItem(PREFISSO + "fc_accesso", JSON.stringify({ id: arrivo.msg.id, at: Date.now() })); } catch (e) {} }
      // fase 4: DISCONNETTI Fantaclub dalla Home FVM (un eventuale accesso in sospeso non serve piu)
      if (arrivo.ok && arrivo.msg.tipo === "esci") {
        try { sessionStorage.removeItem(PREFISSO + "fc_accesso"); } catch (e) {}
        try { sessionStorage.setItem(PREFISSO + "fc_esci", JSON.stringify({ id: arrivo.msg.id, at: Date.now(), tentativi: 0 })); } catch (e) {}
      }
      // fase 5: FAI O MODIFICA FORMAZIONE con Fantaclub: consegna della lega in corso in questa scheda
      if (arrivo.ok && arrivo.msg.tipo === "consegna") {
        var dc = arrivo.msg.dati || {};
        // lega gia nota in FVM (altrimenti nessuna: la sceglie l'utente aprendo la pagina Consegna) e squadre del circuito
        var nl = NL_VALIDO.test(String(dc.nl || "")) ? String(dc.nl) : "";
        var circ = {};
        if (dc.circuito && typeof dc.circuito === "object") Object.keys(dc.circuito).slice(0, 20).forEach(function (k) {
          var v = dc.circuito[k] || {};
          if (NL_VALIDO.test(k)) circ[k.toLowerCase()] = { nome: String(v.nome || "").slice(0, 60), squadre: (Array.isArray(v.squadre) ? v.squadre : []).map(function (x) { return String(x).slice(0, 40); }).slice(0, 20) };
        });
        try {
          sessionStorage.removeItem(PREFISSO + "fc_accesso");
          sessionStorage.setItem(PREFISSO + "fc_consegna", JSON.stringify({ id: arrivo.msg.id, at: Date.now(), nl: nl, lega: nl ? nomeLegaDa(circ, nl) : "", circuito: circ, modo: dc.modo === "solo_lega" ? "solo_lega" : "lega_fle", rimbalzi: 0 }));
        } catch (e) {}
      }
      logFc("PASSAGGIO", arrivo.ok ? { tipo: arrivo.msg.tipo, esito: "ricevuto", ms: arrivo.eta, pagina: location.pathname, paginaAccesso: /login|accedi|Entra/i.test(location.pathname) } /* PROVA15 diagnosi */ : { tipo: arrivo.tipo || "", esito: "scartato", motivo: arrivo.motivo });
    }
    // fase 3: accesso Fantaclub richiesto da FVM (valido 15 minuti nella stessa scheda)
    function accessoInCorso() {
      try {
        var a = JSON.parse(sessionStorage.getItem(PREFISSO + "fc_accesso") || "null");
        if (a && Date.now() - Number(a.at || 0) < 15 * 60000) return a;
        sessionStorage.removeItem(PREFISSO + "fc_accesso");
      } catch (e) {}
      return null;
    }
    function fineAccesso() { try { sessionStorage.removeItem(PREFISSO + "fc_accesso"); } catch (e) {} }
    // Come l'app Android (FANTACLUB_LOGIN_WATCH_JS): apro da solo la finestra di login DEL SITO e riconosco
    // l'accesso riuscito. Username, password e Google/Apple restano nella pagina ufficiale: FVM non li legge.
    // strumenti comuni per leggere la pagina Fantaclub (solo lettura, nessuna modifica al sito)
    var visibile = function (el) { try { var r = el.getBoundingClientRect(), cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none"; } catch (e) { return false; } };
    var passVisibile = function () { return Array.prototype.some.call(document.querySelectorAll('input[type="password"]'), visibile); };
    var accediInAlto = function () {
      return Array.prototype.filter.call(document.querySelectorAll("a,button,span,div"), function (el) {
        return /^\s*accedi\s*$/i.test(el.innerText || el.textContent || "") && visibile(el) && !el.closest("form");
      }).sort(function (x, y) { return x.getBoundingClientRect().top - y.getBoundingClientRect().top; })[0] || null;
    };
    var clicVero = function (el) {
      try { ["mousedown", "mouseup", "click"].forEach(function (t) { el.dispatchEvent(new MouseEvent(t, { bubbles: true, cancelable: true, view: window })); }); } catch (e) { try { el.click(); } catch (x) {} }
      try { if (window.jQuery) window.jQuery(el).trigger("click"); } catch (e) {}
    };
    var testoPagina = function () { return String(document.body && document.body.innerText || "").toLowerCase(); };
    // ultime righe della diagnosi Fantaclub: tornano a FVM con l'esito (la diagnosi di fantaclub.it non e leggibile da Leghe)
    var righeFc = function () { try { return JSON.parse(localStorage.getItem(PREFISSO + "diag") || "[]").slice(-12); } catch (e) { return []; } };
    // finestra di login DEL SITO (#login-modal): la apro soltanto, i dati li scrive l'utente nella pagina ufficiale
    var finestraAperta = function () { var m = document.getElementById("login-modal"); try { return !!m && (m.classList.contains("show") || getComputedStyle(m).display === "block") && visibile(m); } catch (e) { return false; } };
    var apriFinestra = function () {
      var m = document.getElementById("login-modal");
      try { var B = window.bootstrap; if (m && B && B.Modal) { B.Modal.getOrCreateInstance(m).show(); return "bootstrap"; } } catch (e) {}
      var btn = document.querySelector('a.btn-login,[data-bs-target="#login-modal"],[data-target="#login-modal"]') || accediInAlto();
      if (btn) { clicVero(btn); return btn.tagName.toLowerCase(); }
      return "";
    };
    function vegliaAccesso() {
      var acc = accessoInCorso();
      if (!acc) return;
      var tentativi = 0, finestraSegnalata = false, finito = false;
      var giro = function () {
        if (finito || !accessoInCorso()) return;
        try {
          var testo = String(document.body && document.body.innerText || "").toLowerCase();
          var collegato = !accediInAlto() && !passVisibile() &&
            (testo.indexOf("passa a premium") >= 0 || testo.indexOf("le mie leghe") >= 0 || !!document.querySelector('a[href*="Logout" i],a[href*="logout" i],a[href*="Disconn" i]'));
          if (collegato) {
            finito = true;
            fineAccesso();
            logFc("FANTACLUB ACCESSO", { esito: "riconosciuto" });
            inviaPassaggio("leghe", "login-ok", { idAccesso: acc.id }, "/");
            return;
          }
          if (finestraAperta()) { if (!finestraSegnalata) { finestraSegnalata = true; logFc("FANTACLUB ACCESSO", { esito: "finestra di login aperta" }); } return; }
          if (tentativi < 8) { var come = apriFinestra(); if (come) { tentativi++; logFc("FANTACLUB ACCESSO", { esito: "apro la finestra di login", tentativo: tentativi, come: come }); } }
        } catch (e) {}
      };
      setTimeout(giro, 900);
      setInterval(giro, 800);
    }
    vegliaAccesso();
    // fase 4: DISCONNETTI Fantaclub, come l'app Android (SITE_LOGOUT_JS): funzione di uscita del sito
    // (logoutFunction), altrimenti il suo collegamento Logout, altrimenti /servlet/Logout. Vale solo quando
    // la pagina risulta davvero scollegata. Leghe Fantacalcio non viene toccato.
    function uscitaInCorso() {
      try {
        var u = JSON.parse(sessionStorage.getItem(PREFISSO + "fc_esci") || "null");
        if (u && Date.now() - Number(u.at || 0) < 5 * 60000) return u;
        sessionStorage.removeItem(PREFISSO + "fc_esci");
      } catch (e) {}
      return null;
    }
    function vegliaUscita() {
      if (!uscitaInCorso()) return;
      var scollegato = function () {
        if (/\/login(\/|$|\?)/i.test(location.pathname)) return true;
        var t = testoPagina();
        var dentro = t.indexOf("passa a premium") >= 0 || t.indexOf("le mie leghe") >= 0 || t.indexOf("le tue leghe") >= 0;
        var acc = Array.prototype.some.call(document.querySelectorAll("a,button,span"), function (el) { return /^\s*(accedi|login)\s*$/i.test(el.innerText || "") && visibile(el); });
        return acc && !dentro;
      };
      var eUscita = function (a) {
        return /logout|disconn/i.test((a.getAttribute("href") || "") + " " + (a.getAttribute("onclick") || "") + " " + (a.getAttribute("action") || "")) ||
          /^\s*(logout|esci|disconnetti|log out)\s*$/i.test(a.innerText || a.textContent || "");
      };
      var finito = false;
      var chiudi = function (u, esito) {
        finito = true;
        try { sessionStorage.removeItem(PREFISSO + "fc_esci"); } catch (e) {}
        logFc("FANTACLUB USCITA", { esito: esito, tentativi: u.tentativi });
        inviaPassaggio("leghe", "esci-esito", { idEsci: u.id, esito: esito, diagFc: righeFc() }, "/");
      };
      var giro = function () {
        if (finito) return;
        var u = uscitaInCorso();
        if (!u) return;
        try {
          if (scollegato()) return chiudi(u, "ok");
          u.tentativi = Number(u.tentativi || 0) + 1;
          try { sessionStorage.setItem(PREFISSO + "fc_esci", JSON.stringify(u)); } catch (e) {}
          if (u.tentativi > 14) return chiudi(u, "ko");
          if (u.tentativi % 3 !== 1) return;
          // Fantaclub: <a class="dropdown-item" href="#" onclick="logoutFunction()">Logout</a>
          if (typeof window.logoutFunction === "function") { logFc("FANTACLUB USCITA", { azione: "logoutFunction()" }); try { window.logoutFunction(); } catch (e) {} return; }
          var link = Array.prototype.filter.call(document.querySelectorAll("a,button,input[type=submit]"), eUscita)[0];
          if (link) {
            var href = link.getAttribute("href") || "";
            logFc("FANTACLUB USCITA", { azione: "collegamento", href: href || link.tagName });
            if (!href || href === "#" || /^javascript:/i.test(href)) clicVero(link); else location.href = link.href;
          } else if (u.tentativi >= 7) {
            logFc("FANTACLUB USCITA", { azione: "/servlet/Logout" });
            location.href = "https://www.fantaclub.it/servlet/Logout";
          }
        } catch (e) {}
      };
      setTimeout(giro, 1200);
      setInterval(giro, 900);
    }
    vegliaUscita();

    // fasi 5-6: FAI O MODIFICA FORMAZIONE con Fantaclub (come l'app Android, src/logic/fantaclub.js).
    // Pagina Consegna della lega; quando l'utente preme CONSEGNA leggo il modulo inviato (SOLA LETTURA: la consegna
    // la fa il sito, come sempre) e, alla conferma "consegnata correttamente", torno a FVM con la formazione.
    // Tutto questo solo con una consegna avviata dalla Home FVM: le visite normali a Fantaclub restano intatte.
    function consegnaInCorso() {
      try {
        var c = JSON.parse(sessionStorage.getItem(PREFISSO + "fc_consegna") || "null");
        if (c && Date.now() - Number(c.at || 0) < 3 * 3600000) return c;
        sessionStorage.removeItem(PREFISSO + "fc_consegna");
      } catch (e) {}
      return null;
    }
    function salvaConsegna(c) { try { sessionStorage.setItem(PREFISSO + "fc_consegna", JSON.stringify(c)); } catch (e) {} }
    // nome della lega: quello del circuito FLE se c'e, altrimenti il suo _nl in maiuscolo (es. TESTFANTAROCCO)
    function nomeLegaDa(circ, nl) { nl = String(nl || ""); return (circ && circ[nl.toLowerCase()] && circ[nl.toLowerCase()].nome) || nl.toUpperCase(); }
    function squadreLega(c) { var x = c && c.nl && c.circuito ? c.circuito[String(c.nl).toLowerCase()] : null; return x && Array.isArray(x.squadre) ? x.squadre : []; }
    // stato della lega della consegna: "circuito" (verificata dalla sua pagina Consegna e nel circuito FLE), "fuori"
    // (verificata, fuori dal circuito) o "verifica" (nessuna lega o lega non ancora verificata: MAI considerata fuori
    // circuito, ma nessun flusso FLE finche la verifica non e positiva)
    function statoLegaFc(c) {
      if (!c || !c.nl || !c.nlVerificata) return "verifica";
      return c.circuito && c.circuito[String(c.nl).toLowerCase()] ? "circuito" : "fuori";
    }
    var TESTO_FUORI_FLE = "Questa lega non appartiene al circuito FLE. La formazione non può essere inviata a FLE.";
    // lega verificata fuori dal circuito FLE: SOLO LEGA e l'unica modalita possibile (scelta da sola)
    function modoPerLegaFc(c) {
      // RC3 (come Android): SOLO LEGA scelto da FVM finché la lega non è riconosciuta nel circuito; riconosciuta = LEGA + FLE
      if (c && c.modoAuto && c.nlVerificata && statoLegaFc(c) === "circuito") { c.modo = "lega_fle"; c.modoAuto = false; salvaConsegna(c); logFc("FANTACLUB MODO", { modo: "lega_fle", perche: "lega riconosciuta nel circuito FLE" }); return; }
      if (c && statoLegaFc(c) === "verifica" && c.modo !== "solo_lega") { c.modo = "solo_lega"; c.modoAuto = true; salvaConsegna(c); logFc("FANTACLUB MODO", { modo: "solo_lega", perche: "lega da riconoscere" }); return; }
      if (!c || statoLegaFc(c) !== "fuori" || c.modo === "solo_lega") return;
      c.modo = "solo_lega"; salvaConsegna(c);
      logFc("FANTACLUB MODO", { modo: "solo_lega", perche: "lega fuori dal circuito FLE" });
    }
    function fineConsegna() { try { sessionStorage.removeItem(PREFISSO + "fc_consegna"); } catch (e) {} }
    // RC3 (stesso testo di Android FC_GUIDA_CONSEGNA_JS): fuori dalla pagina Consegna evidenzia il comando CONSEGNA del sito
    function guidaConsegnaFc() {
      if (window.__fvmFcGuida) return true; window.__fvmFcGuida = 1;
      var tag = null, el = null, giri = 0;
      var testo = function(x){ return String(x && (x.innerText || x.textContent) || '').replace(/\s+/g, ' ').trim(); };
      var trova = function(){
        var c = document.querySelectorAll('a,button,[role="button"],li,span,div'), best = null;
        for (var i = 0; i < c.length && i < 4000; i++) {
          var t = testo(c[i]);
          if (!t || t.length > 22 || !/^cons(e(g(n(a)?)?)?)?(\s+formazione)?\.*$/i.test(t)) continue;
          var r = c[i].getBoundingClientRect();
          if (r.width < 8 || r.height < 8) continue;
          var a = c[i].closest ? (c[i].closest('a,button,[role="button"]') || c[i]) : c[i];
          best = a; break;
        }
        return best;
      };
      var togli = function(){ try { if (tag) tag.remove(); } catch(e){} tag = null; if (el) { try { el.style.outline = ''; el.style.boxShadow = ''; } catch(e){} } el = null; };
      var giro = function(){
        giri++;
        if (/ConsegnaFormazione/i.test(location.pathname)) { togli(); return; }
        var x = trova();
        if (!x) { togli(); return; }
        if (x !== el) { togli(); el = x; }
        try { el.style.outline = '3px solid #e6bd56'; el.style.outlineOffset = '2px'; el.style.boxShadow = '0 0 0 6px rgba(230,189,86,.35)'; } catch(e){}
        if (!tag) { tag = document.createElement('div'); tag.setAttribute('data-fvm-guida', '1');
          tag.style.cssText = 'position:fixed;z-index:2147483646;pointer-events:none;background:#e6bd56;color:#0b1320;font:900 12px -apple-system,Roboto,sans-serif;padding:5px 8px;border-radius:9px;box-shadow:0 2px 8px rgba(0,0,0,.4);max-width:70vw';
          (document.body || document.documentElement).appendChild(tag); }
        var r = el.getBoundingClientRect(), vw = window.innerWidth || 360, fuori = r.right > vw - 4;
        tag.textContent = fuori ? 'FVM · TOCCA CONSEGNA (scorri a destra) ▶' : 'FVM · TOCCA CONSEGNA ▼';
        var w = tag.offsetWidth || 160, h = tag.offsetHeight || 24;
        var left = fuori ? Math.max(4, vw - w - 4) : Math.min(Math.max(4, r.left + r.width / 2 - w / 2), vw - w - 4);
        var top = r.top - h - 8; if (top < 4) top = r.bottom + 8;
        tag.style.left = left + 'px'; tag.style.top = top + 'px';
      };
      var t = setInterval(function(){ try { giro(); } catch(e){} if (giri > 600) { clearInterval(t); togli(); } }, 700);
      try { window.addEventListener('scroll', function(){ try { if (el) giro(); } catch(e){} }, true); } catch(e){}
      return true;
    }
    var parametro = function (k) { var m = String(location.search || "").match(new RegExp("[?&]" + k + "=([^&#]*)")); try { return m ? decodeURIComponent(m[1].replace(/\+/g, " ")) : ""; } catch (e) { return ""; } };
    var paginaConsegna = function () { return /\/servlet\/ConsegnaFormazione/i.test(location.pathname); };
    var paginaConsegnata = function () { return /\/servlet\/Consegna$/i.test(location.pathname); };
    function urlConsegna(c) {
      if (!c.nl) return "https://www.fantaclub.it/";
      var sid = "";
      try { sid = localStorage.getItem(PREFISSO + "fc_sid_" + c.nl) || ""; } catch (e) {}
      return "https://www.fantaclub.it/servlet/ConsegnaFormazione?" + (sid ? "sid=" + encodeURIComponent(sid) + "&" : "") + "_nl=" + encodeURIComponent(c.nl);
    }
    var up = function (s) { return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/[’']/g, " ").replace(/[^A-Z0-9 ]+/g, " ").replace(/\s+/g, " ").trim(); };
    var formConsegna = function () {
      var f = document.querySelector('form[action*="Consegna" i]');
      if (f) return f;
      var tutti = Array.prototype.slice.call(document.querySelectorAll("form"));
      return tutti.filter(function (x) { return x.querySelector && x.querySelector('[name^="titolare"]'); })[0] || null;
    };
    // Fantaclub manda i NOMI nei campi titolare0..10 e panchinaro0..10 (in ordine); squadra e stato si leggono
    // dal testo del modulo: riga del nome, poi riga "CAG (T)". Nessun altro campo viene tenuto.
    function leggiModulo(form) {
      form = form || formConsegna();
      if (!form) return { errore: "modulo della formazione non trovato in questa pagina" };
      var campi = [];
      try { Array.from(new FormData(form)).forEach(function (kv) { if (typeof kv[1] === "string") campi.push([String(kv[0]), kv[1]]); }); } catch (e) {}
      var ordina = function (re) {
        return campi.filter(function (kv) { return re.test(kv[0]); })
          .sort(function (a, b) { return Number(a[0].replace(/\D/g, "")) - Number(b[0].replace(/\D/g, "")); });
      };
      var tit = ordina(/^titolare\d+$/i), pan = ordina(/^panchinaro\d+$/i);
      if (!tit.length) return { errore: "titolari non trovati nel modulo (" + campi.length + " campi)", nonConsegna: true };
      var righe = String(form.innerText || form.textContent || "").split(/\n/).map(function (x) { return x.trim(); }).filter(Boolean);
      var info = {};
      for (var i = 0; i < righe.length - 1; i++) {
        var m = righe[i + 1].match(/^([A-Z]{3})(?:\s*\((T|I|S|IN|SQ)\))?$/i);
        if (!m) continue;
        info[up(righe[i].replace(/\s*\*\s*$/, ""))] = { c: m[1].toUpperCase(), s: (m[2] || "").toUpperCase(), o: /\*\s*$/.test(righe[i]) };
      }
      var gioc = function (kv) {
        var n = String(kv[1] || "").replace(/\s*\*\s*$/, "").trim();
        if (!n) return null;
        var x = info[up(n)] || {};
        return { n: n.slice(0, 40), c: x.c || "", s: x.s || "", o: !!x.o };
      };
      var modulo = parametro("modulo");
      if (!modulo) { var mc = campi.filter(function (kv) { return /modul/i.test(kv[0]); })[0]; if (mc) modulo = mc[1]; }
      if (!modulo) { var sel = Array.prototype.filter.call(document.querySelectorAll("select"), function (s) { return /modul/i.test(s.name || s.id || ""); })[0]; if (sel) modulo = sel.value; }
      var sid = parametro("sid") || ((campi.filter(function (kv) { return kv[0] === "sid"; })[0] || [])[1] || "");
      // lega della pagina in cui il modulo e stato letto (_nl della pagina Consegna ufficiale)
      var nlPagina = paginaConsegna() && NL_VALIDO.test(parametro("_nl")) ? parametro("_nl") : "";
      // S5: nome della squadra come scritto nella pagina Consegna (intestazione subito dopo "Titolari"), solo lettura
      var nomeSq = "";
      try { var hs4 = Array.prototype.slice.call(document.querySelectorAll("h4")).map(function (e) { return String(e.textContent || "").replace(/\s+/g, " ").trim(); }); var it4 = hs4.indexOf("Titolari"); if (it4 >= 0 && hs4[it4 + 1] && hs4[it4 + 1] !== "Panchina") nomeSq = hs4[it4 + 1].slice(0, 60); } catch (e) {}
      return { dati: { nl: nlPagina, modulo: String(modulo || "").replace(/\D/g, "").slice(0, 3), idSquadra: String(sid).replace(/\D/g, "").slice(0, 12),
        titolari: tit.map(gioc).filter(Boolean), panchina: pan.map(gioc).filter(Boolean), campi: campi.length, squadraNome: nomeSq } };
    }
    var consegnaFinita = false;
    function concludiConsegna(c, come, dati, errore) {
      if (consegnaFinita) return;
      consegnaFinita = true;
      fineConsegna();
      logFc("FANTACLUB CONSEGNA", dati ? { esito: "formazione letta", come: come, modulo: dati.modulo, titolari: dati.titolari.length, panchina: dati.panchina.length }
        : { esito: "formazione non letta", come: come, errore: errore });
      // lega: quella della pagina Consegna in cui e stata letta la formazione (o la lega della consegna in corso)
      // (lega non ancora verificata: nessuna lega, quindi nessun flusso FLE)
      var d = { idConsegna: c.id, come: come, modo: c.modo, nl: (dati && dati.nl) || (c.nlVerificata ? c.nl : "") || "", squadreViste: c.viste || [], diagFc: righeFc() };
      if (dati) { d.modulo = dati.modulo; d.idSquadra = dati.idSquadra; d.titolari = dati.titolari; d.panchina = dati.panchina; if (dati.squadraNome) d.squadraNome = dati.squadraNome; }
      else d.errore = String(errore || "formazione non letta").slice(0, 200);
      if (!inviaPassaggio("leghe", "formazione", d, "/")) { d.diagFc = []; inviaPassaggio("leghe", "formazione", d, "/"); }
    }
    // HO GIA CONSEGNATO · LEGGI: leggo la formazione mostrata (anche quella gia consegnata, nel modulo del sito)
    function leggiOra() {
      var c = consegnaInCorso();
      if (!c) return "";
      var r = leggiModulo();
      if (r.dati && r.dati.titolari.length) { concludiConsegna(c, "lettura", r.dati); return ""; }
      if (c.letta) { concludiConsegna(c, "lettura", c.letta); return ""; }
      logFc("FANTACLUB CONSEGNA", { azione: "LEGGI", esito: r.errore || "nessuna formazione" });
      return "Non trovo la formazione in questa pagina: apri la consegna della lega e riprova.";
    }
    function vegliaConsegna() {
      if (!consegnaInCorso()) return;
      try { if (!paginaConsegna()) guidaConsegnaFc(); } catch (e) {} // RC3: guida CONSEGNA
      // lega effettiva = _nl della pagina Consegna ufficiale aperta: diventa la lega di questa consegna
      // (niente squadre, letture o sid della lega precedente)
      (function adottaLega() {
        var c = consegnaInCorso(), qui = paginaConsegna() ? parametro("_nl") : "";
        if (!c || !NL_VALIDO.test(qui) || qui === c.nl) return;
        logFc("FANTACLUB LEGA", { da: c.nl || "nessuna", a: qui, come: "pagina Consegna aperta" });
        // passaggio da un'altra lega: modalita predefinita (LEGA + FLE) e verifica da rifare
        if (c.nl) { c.modo = "solo_lega"; c.modoAuto = true; c.nlVerificata = false; }
        c.nl = qui; c.lega = nomeLegaDa(c.circuito, qui); c.viste = []; c.letta = null; c.errLettura = ""; c.sidProvato = false; c.rimbalzi = 0;
        salvaConsegna(c);
      })();
      // CAMBIO LEGA dal sito (menu ☰ · Le mie leghe): una pagina di un'ALTRA lega (_nl diverso) rende quella la lega della
      // consegna, ma DA VERIFICARE: niente squadre, letture, sid o associazioni della lega precedente, modalita predefinita.
      // Diventa verificata solo quando si apre la sua pagina Consegna ufficiale.
      (function cambioLegaSito() {
        var c = consegnaInCorso(), qui = parametro("_nl");
        // (lega non ancora scelta: invariato, la lega si riconosce solo dalla pagina Consegna)
        if (!c || !c.nl || paginaConsegna() || paginaConsegnata() || !NL_VALIDO.test(qui) || qui === c.nl) return;
        logFc("FANTACLUB LEGA", { da: c.nl, a: qui, come: "pagina della lega aperta dal sito", stato: "da verificare" });
        c.modo = "solo_lega"; c.modoAuto = true;
        c.nl = qui; c.lega = nomeLegaDa(c.circuito, qui); c.nlVerificata = false; c.viste = []; c.letta = null; c.errLettura = ""; c.sidProvato = false; c.rimbalzi = 0;
        salvaConsegna(c);
      })();
      // lega VERIFICATA: la pagina Consegna ufficiale di questa lega e stata davvero aperta (vale anche per CHIUDI)
      (function () {
        var c = consegnaInCorso();
        if (c && c.nl && !c.nlVerificata && paginaConsegna() && parametro("_nl") === c.nl) { c.nlVerificata = true; salvaConsegna(c); logFc("FANTACLUB LEGA", { lega: c.lega || c.nl, esito: "verificata", circuito: statoLegaFc(c) === "circuito" ? "FLE" : "fuori" }); }
        modoPerLegaFc(c);
      })();
      // navigazione scelta dall'utente (tocco su un link del sito, es. menu ☰ / Le mie leghe): sulla pagina che si apre
      // nessun ritorno automatico alla Consegna (il ritorno automatico resta per i giri del sito, es. dopo il login)
      var navUtente = false;
      try {
        var nv = JSON.parse(sessionStorage.getItem(PREFISSO + "fc_nav_utente") || "null");
        sessionStorage.removeItem(PREFISSO + "fc_nav_utente");
        navUtente = !!(nv && Date.now() - Number(nv.at || 0) < 20000);
      } catch (e) {}
      document.addEventListener("click", function (e) {
        try {
          if (!e.isTrusted) return;
          var a = e.target && e.target.closest ? e.target.closest("a[href]") : null;
          if (!a || /^\s*(javascript:|#)/i.test(a.getAttribute("href") || "")) return;
          var u = new URL(a.href, location.href);
          if (u.hostname !== location.hostname || (u.pathname === location.pathname && u.search === location.search)) return;
          sessionStorage.setItem(PREFISSO + "fc_nav_utente", JSON.stringify({ at: Date.now() }));
        } catch (x) {}
      }, true);
      // il modulo inviato con CONSEGNA (sia col pulsante del sito sia con form.submit()): solo lettura
      var registra = function (form) {
        var c = consegnaInCorso();
        if (!c) return;
        var r = leggiModulo(form);
        if (r.nonConsegna) return; // per esempio il modulo di login
        c.letta = r.dati || null; c.errLettura = r.errore || ""; salvaConsegna(c);
        logFc("FANTACLUB CONSEGNA", { azione: "CONSEGNA premuto", titolari: r.dati ? r.dati.titolari.length : 0, panchina: r.dati ? r.dati.panchina.length : 0, modulo: r.dati ? r.dati.modulo : "", errore: r.errore || "" });
      };
      document.addEventListener("submit", function (e) { try { registra(e.target); } catch (x) {} }, true);
      try {
        var invioSito = window.HTMLFormElement.prototype.submit;
        window.HTMLFormElement.prototype.submit = function () { try { registra(this); } catch (x) {} return invioSito.apply(this, arguments); };
      } catch (e) {}
      var c0 = consegnaInCorso();
      // squadra gia nota su Fantaclub (sid): apro direttamente la sua consegna
      if (c0.nl && paginaConsegna() && !parametro("sid") && !c0.sidProvato) {
        c0.sidProvato = true; salvaConsegna(c0);
        var u0 = urlConsegna(c0);
        if (/[?&]sid=/.test(u0)) { logFc("FANTACLUB CONSEGNA", { azione: "apro la consegna della squadra nota" }); location.replace(u0); return; }
      }
      var tentativiLogin = 0, primo = true;
      var giro = function () {
        var c = consegnaInCorso();
        if (!c || consegnaFinita) return;
        try {
          var t = testoPagina();
          if (c.nl && paginaConsegna() && parametro("sid") && (!parametro("_nl") || parametro("_nl") === c.nl)) { try { localStorage.setItem(PREFISSO + "fc_sid_" + c.nl, parametro("sid").replace(/\D/g, "")); } catch (e) {} }
          if (/consegnata correttamente/.test(t)) {
            if (c.letta && c.letta.titolari && c.letta.titolari.length) return concludiConsegna(c, "consegna", c.letta);
            return concludiConsegna(c, "consegna", null, "consegna fatta su Fantaclub, ma la formazione non e stata letta" + (c.errLettura ? " (" + c.errLettura + ")" : ""));
          }
          var form = formConsegna();
          // nomi visibili cercati SOLO tra le squadre del circuito di questa lega (lega fuori circuito: nessuno)
          var sqLega = squadreLega(c);
          if (form && sqLega.length) {
            var corpo = " " + up(t) + " ";
            var viste = sqLega.filter(function (s) { var u = up(s); return u && corpo.indexOf(" " + u + " ") >= 0; });
            if (JSON.stringify(viste) !== JSON.stringify(c.viste || [])) { c.viste = viste; salvaConsegna(c); }
          }
          var dentro = t.indexOf("passa a premium") >= 0 || t.indexOf("le mie leghe") >= 0 || !!document.querySelector('a[href*="logout" i]') || typeof window.logoutFunction === "function";
          var fuori = !form && !dentro && (!!accediInAlto() || passVisibile());
          if (fuori) {
            // non collegato: apro la finestra di login del sito, poi torno alla consegna
            if (!c.login) { c.login = true; salvaConsegna(c); logFc("FANTACLUB CONSEGNA", { azione: "serve il login" }); }
            if (!finestraAperta() && tentativiLogin < 8) { var come = apriFinestra(); if (come) tentativiLogin++; }
            return;
          }
          if (c.login && !passVisibile()) {
            c.login = false; c.rimbalzi = 0; salvaConsegna(c);
            // lega non ancora scelta: l'utente resta libero di navigare fino alla pagina Consegna della sua lega
            if (!c.nl) { logFc("FANTACLUB CONSEGNA", { azione: "login fatto · scegli la lega" }); return; }
            logFc("FANTACLUB CONSEGNA", { azione: "login fatto · torno alla consegna" });
            location.replace(urlConsegna(c)); return;
          }
          // fuori dalla consegna della lega (Home, Community…): torno alla pagina giusta (massimo 3 volte).
          // Lega non ancora scelta: nessun rimbalzo. Consegna di un'altra lega: adottata all'apertura (adottaLega).
          // Pagina aperta dall'utente con un link del sito (menu ☰, Le mie leghe…): resta dove ha scelto.
          if (c.nl && !paginaConsegna() && !paginaConsegnata() && navUtente) {
            if (primo) logFc("FANTACLUB CONSEGNA", { azione: "pagina scelta dall'utente: nessun ritorno automatico", pagina: location.pathname });
          } else if (c.nl && !paginaConsegna() && !paginaConsegnata()) {
            if (!primo && Number(c.rimbalzi || 0) < 3 && Date.now() - Number(c.ultimoRimbalzo || 0) > 1500) {
              c.rimbalzi = Number(c.rimbalzi || 0) + 1; c.ultimoRimbalzo = Date.now(); salvaConsegna(c);
              logFc("FANTACLUB CONSEGNA", { azione: "riporto alla consegna", da: location.pathname, volta: c.rimbalzi });
              location.replace(urlConsegna(c)); return;
            }
          }
        } catch (e) {}
        primo = false;
      };
      setTimeout(giro, 900);
      setInterval(giro, 1000);
    }
    vegliaConsegna();
    // CHIUDI (come la barra Leghe): ritorno alla Home FVM con il passaggio "ritorno", cosi la Home si apre anche
    // senza accesso a Leghe Fantacalcio (prima: indirizzo semplice -> il sito mostrava il suo /login)
    // Dalla consegna: se la pagina Consegna ufficiale della lega e stata aperta (lega verificata), FVM la ricorda per il
    // prossimo FAI O MODIFICA (valida su Leghe solo per la consegna aperta da quella scheda). Nessun altro dato.
    function ritornaAFvm(c) {
      var dati = c && c.nlVerificata && NL_VALIDO.test(String(c.nl || "")) ? { idConsegna: c.id, nl: String(c.nl) } : {};
      logFc("PASSAGGIO", { tipo: "ritorno", esito: "inviato", lega: dati.nl || "nessuna" });
      if (!inviaPassaggio("leghe", "ritorno", dati, "/")) location.assign("https://" + DOMINI_FVM.leghe + "/");
    }
    // stile del comando CHIUDI copiato dalla barra Leghe approvata (.barra .chiudi)
    var STILE_CHIUDI = ".chiudi{flex:none;min-width:64px;height:40px;display:flex;align-items:center;justify-content:center;padding:0 8px;border:1px solid #2a4370;border-radius:10px;" +
      "background:#14243d;color:#e2b33c;font-size:13px;font-weight:900;cursor:pointer;-webkit-tap-highlight-color:transparent;user-select:none;-webkit-user-select:none}";
    function barra() {
      if (!document.body || document.getElementById("fvm-fc-root")) return;
      var host = document.createElement("div");
      host.id = "fvm-fc-root";
      document.body.appendChild(host);
      var r = host.attachShadow ? host.attachShadow({ mode: "open" }) : host;
      if (consegnaInCorso()) { barraConsegna(r, ""); return; }
      r.innerHTML = "<style>:host{all:initial}*{box-sizing:border-box;font-family:-apple-system,Arial,sans-serif}.b{position:fixed;right:10px;bottom:calc(env(safe-area-inset-bottom,0px) + 14px);z-index:2147483646;display:flex;align-items:center;gap:8px;" +
        "background:#0d1a2e;border:1px solid #2a4370;border-radius:22px;padding:6px 6px 6px 12px;font:800 12px -apple-system,Arial;color:#e8edf5;box-shadow:0 3px 10px rgba(0,0,0,.35)}" +
        ".t{color:#e2b33c}.ok{color:#4ade80}" + STILE_CHIUDI + "</style>" +
        "<div class='b'><span class='t'>FVM</span>" +
        (accessoInCorso() ? "<span>Accedi nella finestra di Fantaclub</span>" : "") +
        (uscitaInCorso() ? "<span>Esco da Fantaclub…</span>" : "") + "<span class='chiudi' id='torna'>CHIUDI</span></div>";
      r.getElementById("torna").addEventListener("click", function () {
        // CHIUDI durante l'accesso: annulla la richiesta (nessun cambio di stato in FVM)
        if (accessoInCorso()) { fineAccesso(); logFc("FANTACLUB ACCESSO", { esito: "annullato con CHIUDI" }); }
        if (uscitaInCorso()) { try { sessionStorage.removeItem(PREFISSO + "fc_esci"); } catch (e) {} logFc("FANTACLUB USCITA", { esito: "annullata con CHIUDI" }); }
        ritornaAFvm();
      });
    }
    // barra della consegna (fasi 5-6-10) = barra Leghe approvata: nera, fissa IN ALTO, riga unica
    // LEGA + FLE | SOLO LEGA | SOLO FLE | CHIUDI; sotto, lega e LEGGI. La pagina del sito scende di quanto e
    // alta la barra (padding-top su html, come spazioBarra di Leghe): il campo e CONSEGNA scorrono sotto, mai coperti.
    var spazioFc = null;
    function spazioBarraFc(el) {
      var de = document.documentElement;
      if (!de || !el) return;
      if (spazioFc === null) spazioFc = de.style.paddingTop || "";
      var v = Math.ceil(el.getBoundingClientRect().height) + "px";
      if (v !== "0px" && de.style.paddingTop !== v) de.style.paddingTop = v;
    }
    var osservaBarraFc = null, giriBarraFc = 0;
    function barraConsegna(r, messaggio) {
      var c = consegnaInCorso();
      if (!c) return;
      var stile = "<style>:host{all:initial}*{box-sizing:border-box;font-family:-apple-system,Arial,sans-serif}" +
        ".barra{position:fixed;left:0;right:0;top:0;z-index:2147483646;background:#0d1a2e;border-bottom:1px solid #2a4370;padding:calc(env(safe-area-inset-top,0px) + 6px) 10px 6px;color:#fff;max-height:60vh;overflow-y:auto;-webkit-overflow-scrolling:touch;box-shadow:0 2px 6px rgba(0,0,0,.25)}" +
        ".bh{display:flex;align-items:center;gap:8px}" +
        ".seg{flex:1;min-width:0;display:flex;gap:3px;padding:3px;border:1px solid #2a4370;border-radius:11px;background:#0a1524}" +
        ".seg div{flex:1;min-width:0;min-height:34px;display:flex;align-items:center;justify-content:center;text-align:center;border-radius:8px;font-size:11px;font-weight:900;letter-spacing:.5px;color:#aab3c2;cursor:pointer;white-space:nowrap;-webkit-tap-highlight-color:transparent;user-select:none;-webkit-user-select:none}" +
        ".seg div.on{background:#dbe7f3;color:#0b1320}" + STILE_CHIUDI +
        // schermi stretti (iPhone SE 1a gen., 320 px): modalita leggibili senza sovrapporsi
        "@media (max-width:359px){.bh{gap:5px}.seg div{font-size:10px;letter-spacing:0}.chiudi{min-width:56px;font-size:12px}}" +
        ".r2{display:flex;align-items:center;gap:8px;margin-top:5px;min-height:30px}" +
        ".lg{flex:1;min-width:0;color:#e2b33c;font-size:12px;font-weight:900;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}" +
        ".leggi{flex:none;border:1px solid #2a4370;border-radius:14px;padding:6px 11px;font-size:12px;font-weight:800;color:#e8edf5;background:#0a1524;cursor:pointer;white-space:nowrap;-webkit-tap-highlight-color:transparent;user-select:none;-webkit-user-select:none}" +
        ".avv{color:#f87171;font-size:12px;font-weight:800;margin-top:5px;line-height:1.35}.nota{color:#fbbf24;font-size:11px;font-weight:700;margin-top:4px;line-height:1.35}" +
        // lega fuori dal circuito FLE: LEGA + FLE e SOLO FLE restano visibili ma spenti
        ".seg div.off{opacity:.38}</style>";
      // lega verificata fuori dal circuito: SOLO LEGA scelto da solo
      modoPerLegaFc(c);
      var stato = statoLegaFc(c), fuoriCircuito = stato === "fuori";
      var AVV_SOLO_LEGA = "<div class='avv'>⚠ Questa formazione NON andrà su FLE</div>";
      // una sola nota breve (come l'avviso della barra Leghe). Fuori circuito: nessuna nota fissa (solo "FVM · LEGA").
      // Lega da verificare: nota finche non si apre la sua pagina Consegna.
      var nota = fuoriCircuito ? ""
        : stato === "verifica" ? (c.modo === "solo_lega" ? AVV_SOLO_LEGA : "") +
          (c.nl ? "<div class='nota'>Lega da verificare: apri la sua pagina Consegna formazione. FLE resta bloccato fino alla verifica.</div>"
            : "<div class='nota'>TOCCA IL NOME DELLA TUA LEGA (accanto a ≡ LEGHE), POI CONSEGNA: riconosco lega e squadra da lì. Se vedi solo «Cons», scorri un poco a destra.</div>")
        : c.modo === "solo_lega" ? AVV_SOLO_LEGA : "";
      var tasto = function (id, testo, on) {
        return "<div id='" + id + "'" + (on ? " class='on'" : fuoriCircuito && id !== "m_solo_lega" ? " class='off' aria-disabled='true'" : "") + ">" + testo + "</div>";
      };
      var giro = ++giriBarraFc;
      r.innerHTML = stile + "<div class='barra' id='barra'><div class='bh'><div class='seg'>" +
        tasto("m_lega_fle", "LEGA + FLE", c.modo !== "solo_lega") +
        tasto("m_solo_lega", "SOLO LEGA", c.modo === "solo_lega") +
        tasto("m_solo_fle", "SOLO FLE", false) + "</div><span class='chiudi' id='chiudi'>CHIUDI</span></div>" +
        "<div class='r2'><span class='lg'>FVM · " + String(c.lega || "SCEGLI LA LEGA").replace(/[<>&"']/g, "") + "</span><span class='leggi' id='leggi'>LEGGI ›</span></div>" +
        nota + (messaggio ? "<div class='avv'>" + String(messaggio).replace(/[<>&]/g, "") + "</div>" : "") + "</div>";
      // l'avviso "fuori dal circuito" dopo un tocco sparisce da solo: la barra torna a "FVM · LEGA"
      if (messaggio === TESTO_FUORI_FLE) setTimeout(function () { if (giro === giriBarraFc && consegnaInCorso()) barraConsegna(r, ""); }, 5000);
      var modo = function (m) {
        var cc = consegnaInCorso(); if (!cc || cc.modo === m) return;
        cc.modo = m; salvaConsegna(cc); logFc("FANTACLUB MODO", { modo: m }); barraConsegna(r, "");
      };
      // lega fuori dal circuito FLE: LEGA + FLE e SOLO FLE non si scelgono (avviso, resta SOLO LEGA)
      var bloccoFuori = function (m) {
        var cc = consegnaInCorso(); if (!cc || statoLegaFc(cc) !== "fuori") return false;
        logFc("FANTACLUB MODO", { modo: m, esito: "bloccato", motivo: "lega fuori dal circuito FLE" });
        modoPerLegaFc(cc); barraConsegna(r, TESTO_FUORI_FLE);
        return true;
      };
      r.getElementById("m_lega_fle").addEventListener("click", function () { if (!bloccoFuori("lega_fle")) modo("lega_fle"); });
      r.getElementById("m_solo_lega").addEventListener("click", function () { modo("solo_lega"); });
      r.getElementById("m_solo_fle").addEventListener("click", function () {
        // SOLO FLE: comportamento gia approvato, sul campo FLE di Leghe Fantacalcio (la consegna Fantaclub si chiude)
        var cc = consegnaInCorso(); if (!cc) return;
        // lega fuori dal circuito FLE o non ancora verificata: niente SOLO FLE (nessun login Leghe, nessun flusso FLE);
        // la consegna nella lega resta aperta
        if (bloccoFuori("solo_fle")) return;
        if (statoLegaFc(cc) !== "circuito") {
          logFc("FANTACLUB MODO", { modo: "solo_fle", esito: "bloccato", motivo: "lega non verificata" });
          barraConsegna(r, "Apri prima la pagina Consegna della tua lega: senza lega verificata SOLO FLE non è disponibile.");
          return;
        }
        fineConsegna(); logFc("FANTACLUB MODO", { modo: "solo_fle" });
        inviaPassaggio("leghe", "solo-fle", { idConsegna: cc.id, nl: String(cc.nl), nlVerificata: !!cc.nlVerificata }, "/");
      });
      r.getElementById("leggi").addEventListener("click", function () { var esito = leggiOra(); if (esito) barraConsegna(r, esito); });
      r.getElementById("chiudi").addEventListener("click", function () {
        var cc = consegnaInCorso();
        fineConsegna(); logFc("FANTACLUB CONSEGNA", { esito: "chiusa con CHIUDI" });
        ritornaAFvm(cc);
      });
      // spazio in cima alla pagina pari all'altezza REALE della barra (aggiornato solo se cambia: niente salti)
      var el = r.getElementById("barra");
      if (el && el.getBoundingClientRect) {
        spazioBarraFc(el);
        try {
          if (osservaBarraFc) osservaBarraFc.disconnect();
          osservaBarraFc = window.ResizeObserver ? new window.ResizeObserver(function () { spazioBarraFc(el); }) : null;
          if (osservaBarraFc) osservaBarraFc.observe(el);
        } catch (e) {}
      }
    }
    // FINESTRE DEL SITO SOTTO LA BARRA (es. "Seleziona calciatore"): la barra FVM e fissa in alto e la pagina scende grazie
    // al padding-top su html, ma il padding NON sposta gli elementi position:fixed/absolute, come le finestre del sito:
    // la loro parte alta (con la X di chiusura) finiva sotto la barra. Finche una finestra del sito e aperta e la sua
    // parte alta e sotto la barra, la sposto subito sotto la barra con uno stile sull'elemento (ripristinato alla
    // chiusura). Vale per qualunque finestra (nessun selettore Fantaclub specifico); barra FVM e pagina invariate.
    function vegliaFinestreSito() {
      var FINESTRE = ".modal,[role=\"dialog\"],[aria-modal=\"true\"],dialog[open],.ui-dialog,[class*=\"popup\" i],[class*=\"dialog\" i]";
      var spostate = [];
      var barraEl = function () { try { var h = document.getElementById("fvm-fc-root"); return h && h.shadowRoot ? h.shadowRoot.getElementById("barra") : null; } catch (e) { return null; } };
      var visibile = function (el) {
        try { var cs = getComputedStyle(el), r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && cs.display !== "none" && cs.visibility !== "hidden" && Number(cs.opacity) > 0.05; } catch (e) { return false; }
      };
      var posizionata = function (el) { try { var p = getComputedStyle(el).position; return p === "fixed" || p === "absolute"; } catch (e) { return false; } };
      // solo la finestra piu esterna (non le sue parti interne) e mai elementi FVM o annunci nascosti da FVM
      var esterna = function (el) {
        for (var n = el.parentElement; n && n !== document.body && n !== document.documentElement; n = n.parentElement) {
          try { if (n.matches(FINESTRE) && posizionata(n) && visibile(n)) return false; } catch (e) {}
        }
        return true;
      };
      var salva = function (el, props) { var o = {}; props.forEach(function (p) { o[p] = [el.style.getPropertyValue(p), el.style.getPropertyPriority(p)]; }); return o; };
      var ripristina = function (x) {
        try { Object.keys(x.prima).forEach(function (p) { var v = x.prima[p]; if (v[0]) x.el.style.setProperty(p, v[0], v[1]); else x.el.style.removeProperty(p); }); } catch (e) {}
        x.el.__fvmSpostata = false;
      };
      var sposta = function (el, fondo) {
        var cs = getComputedStyle(el), r = el.getBoundingClientRect(), h = window.innerHeight || 0, giu = Math.ceil(fondo - r.top);
        if (giu <= 0) return;
        var x = { el: el, prima: salva(el, ["padding-top", "box-sizing", "top", "max-height", "overflow-y"]), fondo: fondo };
        if (cs.position === "fixed" && r.height >= h - 2) {
          // contenitore a tutto schermo (es. finestra Bootstrap): spazio in alto, la finestra interna e la sua lista restano scorrevoli
          el.style.setProperty("box-sizing", "border-box", "important");
          el.style.setProperty("padding-top", ((parseFloat(cs.paddingTop) || 0) + giu) + "px", "important");
        } else {
          // finestra piu piccola: scende sotto la barra; se cosi esce dallo schermo, scorre al suo interno
          var top = parseFloat(cs.top);
          el.style.setProperty("top", ((isFinite(top) ? top : (cs.position === "fixed" ? r.top : el.offsetTop)) + giu) + "px", "important");
          if (cs.position === "fixed" && r.bottom + giu > h) { el.style.setProperty("max-height", Math.max(120, h - fondo) + "px", "important"); el.style.setProperty("overflow-y", "auto", "important"); }
        }
        el.__fvmSpostata = true;
        spostate.push(x);
        logFc("FANTACLUB FINESTRA", { azione: "spostata sotto la barra FVM", di: giu });
      };
      var controlla = function () {
        attesa = 0;
        var b = barraEl();
        if (!b) return;
        var fondo = Math.ceil(b.getBoundingClientRect().bottom);
        // finestre chiuse/tolte (o barra cambiata di altezza): stile originale
        spostate = spostate.filter(function (x) {
          if (x.el.isConnected && visibile(x.el) && x.fondo === fondo) return true;
          ripristina(x); return false;
        });
        if (!(fondo > 0)) return;
        // finestre riconosciute dal nome + rete di sicurezza senza nomi: figli diretti del body fissi e grandi
        // (dove i siti agganciano di solito le loro finestre), con comandi
        var w = window.innerWidth || 1, hh = window.innerHeight || 1;
        var candidate = Array.prototype.slice.call(document.querySelectorAll(FINESTRE));
        Array.prototype.forEach.call(document.body ? document.body.children : [], function (el) {
          try {
            if (candidate.indexOf(el) >= 0 || getComputedStyle(el).position !== "fixed") return;
            var q = el.getBoundingClientRect();
            if (q.width >= w * 0.5 && q.height >= hh * 0.4) candidate.push(el);
          } catch (e) {}
        });
        candidate.forEach(function (el) {
          try {
            if (el.__fvmSpostata || el.__fvmNascosto || el === document.body || el === document.documentElement || el.closest("#fvm-fc-root,#fvm-fc-analisi")) return;
            if (!posizionata(el) || !visibile(el) || !esterna(el)) return;
            // una vera finestra ha comandi (X, elenco, ricerca); sfondi scuri vuoti e annunci restano come sono
            if (!el.querySelector("button,a,input,select,[role=\"button\"],[onclick]")) return;
            // solo se la sua parte alta e proprio nella zona coperta dalla barra (non sopra lo schermo dopo uno scorrimento)
            var rr = el.getBoundingClientRect();
            if (rr.top >= fondo || rr.top < -5 || rr.bottom <= fondo) return;
            sposta(el, fondo);
          } catch (e) {}
        });
      };
      var attesa = 0;
      var prenota = function () {
        if (attesa) return;
        attesa = 1;
        // un solo controllo ogni 60 ms anche con tanti cambi nella pagina (niente requestAnimationFrame: puo restare fermo)
        try { setTimeout(controlla, 60); } catch (e) { attesa = 0; }
      };
      try {
        var MO = window.MutationObserver;
        if (MO && document.body) new MO(prenota).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "style", "open", "aria-hidden", "aria-modal"] });
        window.addEventListener("resize", prenota);
        if (window.visualViewport) window.visualViewport.addEventListener("resize", prenota);
      } catch (e) {}
      prenota();
    }
    // INTESTAZIONE DEL SITO SOTTO LA BARRA: l'intestazione di Fantaclub (logo, Passa a Premium, profilo, menu ☰ con
    // "Le mie leghe") e fissa in cima (CSS del sito: .main-header{position:fixed;top:0}); il padding-top su html non la
    // sposta e restava coperta dalla barra FVM. La faccio partire subito sotto la barra (solo "top" sull'elemento, con il
    // suo valore originale ricordato e ripristinato se la barra sparisce). Se il menu aperto e piu alto dello spazio
    // rimasto, scorre al suo interno (solo finche serve). Pagina, barra FVM e menu del sito restano quelli originali.
    function vegliaIntestazioneSito() {
      var INTESTAZIONI = "header,.main-header";
      var spostate = [];
      var barraEl = function () { try { var h = document.getElementById("fvm-fc-root"); return h && h.shadowRoot ? h.shadowRoot.getElementById("barra") : null; } catch (e) { return null; } };
      var PROP = ["top", "max-height", "overflow-y", "-webkit-overflow-scrolling"];
      var rimetti = function (x, props) {
        props.forEach(function (p) { try { var v = x.prima[p]; if (v[0]) x.el.style.setProperty(p, v[0], v[1]); else x.el.style.removeProperty(p); } catch (e) {} });
      };
      // spostamento immediato: il sito anima l'intestazione (transition: all .3s), che scivolerebbe giu a ogni pagina.
      // L'animazione e sospesa solo per questo istante e poi rimessa com'era.
      var subito = function (el, fn) {
        var t = [el.style.getPropertyValue("transition"), el.style.getPropertyPriority("transition")];
        el.style.setProperty("transition", "none", "important");
        try { fn(); void el.offsetHeight; } catch (e) {}
        if (t[0]) el.style.setProperty("transition", t[0], t[1]); else el.style.removeProperty("transition");
      };
      var controlla = function () {
        attesa = 0;
        var b = barraEl(), fondo = 0;
        try { fondo = b ? Math.ceil(b.getBoundingClientRect().bottom) : 0; } catch (e) {}
        // intestazione tolta o barra sparita: stile originale; barra cambiata di altezza: nuova posizione
        spostate = spostate.filter(function (x) {
          if (x.el.isConnected && fondo > 0) {
            if (x.fondo !== fondo) { x.fondo = fondo; subito(x.el, function () { x.el.style.setProperty("top", (x.base + fondo) + "px", "important"); }); }
            return true;
          }
          subito(x.el, function () { rimetti(x, PROP); }); x.el.__fvmIntestazione = false; return false;
        });
        if (!(fondo > 0)) return;
        Array.prototype.forEach.call(document.querySelectorAll(INTESTAZIONI), function (el) {
          try {
            if (el.__fvmIntestazione || el.__fvmNascosto || el.closest("#fvm-fc-root,#fvm-fc-analisi")) return;
            for (var n = el.parentElement; n; n = n.parentElement) if (n.__fvmIntestazione) return;
            var cs = getComputedStyle(el);
            if (cs.position !== "fixed" || cs.display === "none") return;
            // solo un'intestazione di pagina (larga) agganciata in cima allo schermo, nella zona coperta dalla barra
            var base = parseFloat(cs.top);
            if (!isFinite(base) || base < 0 || base >= fondo || el.getBoundingClientRect().width < (window.innerWidth || 0) * 0.5) return;
            var x = { el: el, prima: {}, base: base, fondo: fondo, scorre: false };
            PROP.forEach(function (p) { x.prima[p] = [el.style.getPropertyValue(p), el.style.getPropertyPriority(p)]; });
            subito(el, function () { el.style.setProperty("top", (base + fondo) + "px", "important"); });
            el.__fvmIntestazione = true;
            spostate.push(x);
            logFc("FANTACLUB INTESTAZIONE", { azione: "spostata sotto la barra FVM", di: fondo });
          } catch (e) {}
        });
        // menu ☰ aperto piu alto dello spazio sotto la barra: scorre dentro l'intestazione
        var h = window.innerHeight || 0;
        spostate.forEach(function (x) {
          try {
            // posizione finale (non quella durante l'animazione "transition" del sito)
            var spazio = Math.floor(h - (x.base + x.fondo));
            var serve = spazio > 80 && x.el.scrollHeight > spazio + 1;
            if (serve) {
              var mh = spazio + "px";
              if (x.el.style.getPropertyValue("max-height") !== mh) {
                x.el.style.setProperty("max-height", mh, "important");
                x.el.style.setProperty("overflow-y", "auto", "important");
                x.el.style.setProperty("-webkit-overflow-scrolling", "touch");
              }
              x.scorre = true;
            } else if (x.scorre) { rimetti(x, ["max-height", "overflow-y", "-webkit-overflow-scrolling"]); x.scorre = false; }
          } catch (e) {}
        });
      };
      var attesa = 0;
      var prenota = function () {
        if (attesa) return;
        attesa = 1;
        try { setTimeout(controlla, 60); } catch (e) { attesa = 0; }
      };
      try {
        var MO = window.MutationObserver;
        if (MO && document.body) new MO(prenota).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "style", "aria-expanded"] });
        window.addEventListener("resize", prenota);
        if (window.visualViewport) window.visualViewport.addEventListener("resize", prenota);
      } catch (e) {}
      prenota();
    }
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", barra); else barra();
    // solo con la barra FVM in alto (consegna avviata da FVM)
    if (consegnaInCorso()) { if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", vegliaFinestreSito); else vegliaFinestreSito(); }
    if (consegnaInCorso()) { if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", vegliaIntestazioneSito); else vegliaIntestazioneSito(); }
  }
  // Il codice admin non e scritto qui: c'e solo la sua impronta SHA-256 (il file e pubblico su GitHub).
  var CODICE_ADMIN_SHA256 = "9c080dfff5da901c881a1688fc60dbee0e020eff2635e82a775833a252f49f42";
  function sha256Hex(t) {
    return crypto.subtle.digest("SHA-256", new TextEncoder().encode(t)).then(function (b) {
      return Array.prototype.map.call(new Uint8Array(b), function (x) { return ("0" + x.toString(16)).slice(-2); }).join("");
    });
  }
  var FLE_SLUG = "fantalegaeuropa-fle";
  var API = "https://apileague.fantacalcio.it";
  // ================================================================ 1.3.5-RC · IDENTITÀ DELL'ACCOUNT DI LEGHE FANTACALCIO (C5, C5 bis)
  // Fonte ufficiale: risposta del sito a GET /onboarding/v<n>/profile (versione NON fissata); identificativo = campo utente.id, intero
  // positivo, stabile tra uscita e nuovo accesso (verificato). Solo risposte 200 con JSON valido: una 304 o un corpo vuoto NON cambiano
  // nulla. Si conserva SOLO un'impronta PBKDF2-SHA256 (150.000 iterazioni, sale casuale di questo dispositivo): mai utente.id in chiaro,
  // username, email, cookie o token (neppure nella diagnosi). L'identità separa le sessioni; i PERMESSI restano quelli del sito.
  var ID_ITERAZIONI = 150000;
  function eProfiloUfficiale(u) { return /^https:\/\/apileague\.fantacalcio\.it\/onboarding\/v\d{1,2}\/profile(\?|$)/.test(String(u || "")); }
  function idDaProfilo(testo) {
    try { var j = JSON.parse(String(testo || "")), id = j && j.utente && j.utente.id; return typeof id === "number" && isFinite(id) && id > 0 && Math.floor(id) === id ? id : 0; } catch (e) { return 0; }
  }
  function esadecimale(b) { return Array.prototype.map.call(new Uint8Array(b), function (x) { return ("0" + x.toString(16)).slice(-2); }).join(""); }
  function saleIdentita() {
    var s = leggi("id_sale", "");
    if (!/^[0-9a-f]{32}$/.test(String(s))) { var b = new Uint8Array(16); crypto.getRandomValues(b); s = esadecimale(b); scrivi("id_sale", s); }
    return s;
  }
  function improntaIdentita(id) {
    var enc = new TextEncoder(), sale = saleIdentita(), sb = new Uint8Array(16);
    for (var i = 0; i < 16; i++) sb[i] = parseInt(sale.substr(i * 2, 2), 16);
    return crypto.subtle.importKey("raw", enc.encode("fvm-utente:" + id), "PBKDF2", false, ["deriveBits"]).then(function (k) {
      return crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: sb, iterations: ID_ITERAZIONI }, k, 128);
    }).then(esadecimale);
  }
  // identità valida per QUESTA scheda e per l'epoca attuale (dopo una pagina di accesso o un cambio di account non vale piu)
  function identitaAttuale() { var t = sLeggi("identita"); return t && /^[0-9a-f]{32}$/.test(String(t.imp || "")) && Number(t.epoca) === epocaAccount() ? String(t.imp) : ""; }
  // stato della lettura (in ctl: tenuto solo in memoria per questa pagina)
  function registraIdentita(id, fonte) {
    if (!id || ctl.identitaInCorso) return Promise.resolve("");
    ctl.identitaInCorso = true;
    return improntaIdentita(id).then(function (imp) {
      var ultima = String(leggi("identita_ultima", "") || ""), prima = identitaAttuale();
      if (ultima && ultima !== imp) nuovaEpocaAccount("identità dell'account cambiata"); // nuovo account: nulla del precedente vale piu
      sScrivi("identita", { imp: imp, epoca: epocaAccount(), at: Date.now() });
      scrivi("identita_ultima", imp);
      if (prima !== imp) setTimeout(identitaArrivata, 0); // 1.3.6-G2: la Home si aggiorna da sola (apertura dall'icona)
      if (prima !== imp) log("IDENTITA", { esito: ultima && ultima !== imp ? "CAMBIATA (nuovo account)" : ultima ? "confermata" : "letta", impronta: imp.slice(0, 6), fonte: fonte });
      ctl.identitaInCorso = false;
      return imp;
    }).catch(function (e) { ctl.identitaInCorso = false; log("IDENTITA", { esito: "non letta", motivo: "impronta non calcolabile", errore: String(e && e.message || e).slice(0, 60) }); return ""; });
  }
  // lettura passiva: risposta del sito al profilo (SOLO stato 200 e JSON valido)
  function identitaDaRisposta(url, stato, testo) {
    if (!eProfiloUfficiale(url)) return;
    ctl.profiloPath = String(url).split("?")[0].replace(API, "");
    if (Number(stato) !== 200) return; // 304 / errori: nessun cambiamento
    var id = idDaProfilo(testo);
    if (id) registraIdentita(id, "risposta del sito"); else log("IDENTITA", { esito: "non letta", motivo: "risposta del profilo senza utente.id valido" });
  }
  // lettura attiva (una per pagina, solo se manca un'identita valida): stessa richiesta del sito, senza cache, intestazioni delle LETTURE
  // del sito tenute solo in memoria (mai salvate)
  function verificaIdentita(perche) {
    if (identitaAttuale() || ctl.identitaChiesta || !(ctl.hdrLettura || ctl.hdr) || typeof fetchOriginale !== "function") return;
    ctl.identitaChiesta = true;
    var path = /^\/onboarding\/v\d{1,2}\/profile$/.test(String(ctl.profiloPath || "")) ? ctl.profiloPath : "/onboarding/v2/profile";
    fetchOriginale(API + path, { headers: ctl.hdrLettura || ctl.hdr || {}, credentials: "include", cache: "no-store" }).then(function (r) {
      return r.text().then(function (t) {
        if (r.status !== 200) { log("IDENTITA", { esito: "non letta", motivo: "profilo: HTTP " + r.status, perche: perche }); return; }
        var id = idDaProfilo(t);
        if (id) registraIdentita(id, "lettura di FVM (" + perche + ")"); else log("IDENTITA", { esito: "non letta", motivo: "risposta del profilo senza utente.id valido", perche: perche });
      });
    }).catch(function (e) { log("IDENTITA", { esito: "non letta", motivo: "rete: " + String(e && e.message || e).slice(0, 60), perche: perche }); });
  }
  // ================================================================ 1.3.5-RC · SILENZIO SU LEGHE FANTACALCIO durante le schermate di FVM
  // Prima su Leghe Fantacalcio non c'era nessuna protezione audio (il suono sentito durante l'Area Admin non era attribuibile). Ora, SOLO
  // mentre e aperta una schermata di FVM (Home, Area Admin, Consegne ufficiali, storico…) o e in corso un'attivita di FVM: lettori della
  // pagina muti e fermi, play() rifiutato. A schermata chiusa il sito resta com'era. Riquadri di altri siti (pubblicita in iframe): FVM non
  // li tocca (non si possono silenziare dall'esterno senza toglierli) ma li registra nella diagnosi «LEGHE AUDIO» (solo i domini).
  var silenzioLegheAttivo = false, audioLegheLog = {};
  function fvmSchermataAperta() { try { return !!(radice && radice.querySelector && radice.querySelector(".ov")) || !!sLeggi("task"); } catch (e) { return false; } }
  function logAudioLeghe(cosa, m) {
    var dom = "", tag = "";
    try { tag = m && m.tagName ? m.tagName.toLowerCase() : ""; var u = String(m && (m.currentSrc || m.src) || ""); dom = /^https?:/i.test(u) ? new URL(u).hostname : u ? u.split(":")[0] + ":" : "senza src"; } catch (e) {}
    var k = cosa + "|" + tag + "|" + dom;
    if (audioLegheLog[k]) return; audioLegheLog[k] = 1;
    log("LEGHE AUDIO", { esito: cosa, elemento: tag || "non indicato", sorgente: dom || "non indicata", pagina: location.pathname.split("/").slice(0, 3).join("/") });
  }
  function fermaMediaLeghe(m, perche) { try { m.muted = true; if (!m.paused) m.pause(); } catch (e) {} logAudioLeghe(perche, m); }
  function avviaSilenzioLeghe() {
    if (silenzioLegheAttivo) return;
    silenzioLegheAttivo = true;
    try {
      var MP = window.HTMLMediaElement && window.HTMLMediaElement.prototype;
      if (MP && typeof MP.play === "function") {
        var playLeghe = MP.play;
        MP.play = function () {
          if (fvmSchermataAperta()) { fermaMediaLeghe(this, "partenza impedita durante una schermata FVM"); try { return Promise.reject(new DOMException("FVM: schermata aperta", "NotAllowedError")); } catch (e) { return Promise.resolve(); } }
          return playLeghe.apply(this, arguments);
        };
      }
      document.addEventListener("play", function (ev) { var m = ev.target; if (m && /^(VIDEO|AUDIO)$/.test(m.tagName || "") && fvmSchermataAperta()) fermaMediaLeghe(m, "audio/video partito durante una schermata FVM: fermato"); }, true);
    } catch (e) {}
  }
  // all'apertura di una schermata di FVM: lettori fermati e riquadri di altri siti registrati (una riga per dominio)
  function silenziaLegheOra() {
    if (!fvmSchermataAperta()) return;
    try {
      Array.prototype.forEach.call(document.querySelectorAll("video,audio"), function (m) { if (!m.paused || !m.muted) fermaMediaLeghe(m, "fermato all'apertura di una schermata FVM"); });
      var dom = {};
      Array.prototype.forEach.call(document.querySelectorAll("iframe"), function (f) { try { var u = String(f.src || ""); if (/^https?:/i.test(u)) { var d = new URL(u).hostname; if (d !== location.hostname) dom[d] = 1; } } catch (e) {} });
      var ds = Object.keys(dom).slice(0, 8);
      if (ds.length && !audioLegheLog["iframe|" + ds.join(",")]) { audioLegheLog["iframe|" + ds.join(",")] = 1; log("LEGHE AUDIO", { esito: "riquadri di altri siti presenti con una schermata FVM aperta (non toccati)", domini: ds.join(",") }); }
    } catch (e) {}
  }
  function testoIdentita() { return "Account di Leghe Fantacalcio non ancora riconosciuto in questa scheda: apri una pagina della tua lega (FVM legge l'account dal sito, sola lettura). Fino ad allora nessuna funzione FLE riservata; SOLO LEGA resta disponibile."; }
  var LOGO_FVM = "data:image/jpeg;base64,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";
  // 1.1.0: logo FantaLegaEuropa per il piede della Home (copia ridotta 200x200 di "logo FLE.png", proporzioni originali)
  var LOGO_FLE = "data:image/jpeg;base64,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";
  // Le 80 squadre: [lega, squadra, tid FLE, tid nella lega]
  var SQUADRE = [["LEGA DEL PIANTO","Ideale Bari",4583705,1011789],["LEGA DEL PIANTO","SCHALKE 104",4288743,1013377],["LEGA DEL PIANTO","Zenith Bari",4289115,1017567],["LEGA DEL PIANTO","Ass Paoloneculone",4290965,1037009],["LEGA DEL PIANTO","ANV Football Club 1990",4463113,1744019],["LEGA DEL PIANTO","REPUBBLICA DI GILEAD",4290230,1744043],["LEGA DEL PIANTO","U.S. TICCHIU",4661797,1744087],["LEGA DEL PIANTO","Lino Banfield",4583348,2623328],["LEGA DEL PIANTO","A.S. Vitin",4670912,3252428],["LEGA DEL PIANTO","Frosinone Culone - Sion",4836989,4837414],["TOTA ITALIA AD VICTORIAM","I CAZZARI",3883604,2997692],["TOTA ITALIA AD VICTORIAM","JUVENTUS MANIA",3890986,4629196],["TOTA ITALIA AD VICTORIAM","Real Banana",3856689,4681538],["TOTA ITALIA AD VICTORIAM","Mer Dal",3871740,4700229],["TOTA ITALIA AD VICTORIAM","Mai Una Gioia",7872699,8423265],["TOTA ITALIA AD VICTORIAM","Baker Street",3883077,8426062],["TOTA ITALIA AD VICTORIAM","BAR SPORT UNITED",3881411,15110114],["TOTA ITALIA AD VICTORIAM","FC Boga Juniors",3883797,19074198],["TOTA ITALIA AD VICTORIAM","SALERNO COSTAS",3871852,19092346],["TOTA ITALIA AD VICTORIAM","Fc Er Duce è Laziale",7784769,19191477],["FANTA FOCOLARE 2","Gin toNico",3856500,2583475],["FANTA FOCOLARE 2","Olympique Sartiglia",3876596,2583889],["FANTA FOCOLARE 2","Gol D. Roggero",3874629,2584018],["FANTA FOCOLARE 2","Rutti di Boskov",3872392,2584170],["FANTA FOCOLARE 2","Lokomotiv Sant€Orsola",3874451,2584516],["FANTA FOCOLARE 2","Real MaiPiu",3876601,2586324],["FANTA FOCOLARE 2","Il Santo Osso Sacro Graal Rotto DC",3883257,2589897],["FANTA FOCOLARE 2","La grande fuga di Lameck Banda",3883293,2592285],["FANTA FOCOLARE 2","atlmalitti",3883308,2618905],["FANTA FOCOLARE 2","Ufficio Sinistri zero",3880147,3617383],["FANTAPINTUS LO SCOPRITORE DI BIDONI","I TALENTI DEL PINTO",4186117,1593677],["FANTAPINTUS LO SCOPRITORE DI BIDONI","SS BARLETTA 1922",4192061,1593795],["FANTAPINTUS LO SCOPRITORE DI BIDONI","AS FAL",4189376,1594454],["FANTAPINTUS LO SCOPRITORE DI BIDONI","Companeros FC",4195025,1595003],["FANTAPINTUS LO SCOPRITORE DI BIDONI","Dos Desperados",4189377,1595777],["FANTAPINTUS LO SCOPRITORE DI BIDONI","Piu KOLO che MUANIma",4198164,1596701],["FANTAPINTUS LO SCOPRITORE DI BIDONI","FC INSIEME SI VOLA",4197802,1600002],["FANTAPINTUS LO SCOPRITORE DI BIDONI","Cuesta non e ibiza",4193606,1600221],["FANTAPINTUS LO SCOPRITORE DI BIDONI","AC MILAN",7680238,1604113],["FANTAPINTUS LO SCOPRITORE DI BIDONI","FC CALL OF DIOUF",6716524,6700723],["POLFER","FC R4iNbow",6706486,996915],["POLFER","Cassiopea",6747402,999334],["POLFER","TSN Kawa",6866666,1035252],["POLFER","napoleon",6752548,1039096],["POLFER","A.C. Avanti Cristo",6893193,1193823],["POLFER","Timberwolves",6866782,1632331],["POLFER","AC Devilteam",7262923,1635839],["POLFER","Piotr",6933887,1639195],["POLFER","Stocastico",6716135,6626512],["POLFER","Dinamo Losca",11753918,6626869],["FANTAROCCOLEGENDSPORT","Fellatium",3857314,2070261],["FANTAROCCOLEGENDSPORT","Buon 65 e mezzo",3892660,2072798],["FANTAROCCOLEGENDSPORT","DOFLAMENGO",3892533,2072867],["FANTAROCCOLEGENDSPORT","MANK TOMINAY",3892600,2072884],["FANTAROCCOLEGENDSPORT","AS PILICUETA",3892591,2073171],["FANTAROCCOLEGENDSPORT","Phramba",3894924,2073184],["FANTAROCCOLEGENDSPORT","LOFFENHEIM",3892674,2074942],["FANTAROCCOLEGENDSPORT","No Mercy",3892932,2077210],["FANTAROCCOLEGENDSPORT","DEJAVU",3892726,2079015],["FANTAROCCOLEGENDSPORT","AC Pappo",3894883,5323275],["LEGA DE NOANTRI","Acr Messina",11776923,10224048],["LEGA DE NOANTRI","FLAMENGO",11691923,10225644],["LEGA DE NOANTRI","Barcelona F.C.",11776908,10225765],["LEGA DE NOANTRI","Pennic Hellas",11822953,10227289],["LEGA DE NOANTRI","Super Santos",11708505,10237038],["LEGA DE NOANTRI","Si Puo Fare",6895801,10244150],["LEGA DE NOANTRI","Gingiskan",11858486,10288764],["LEGA DE NOANTRI","Virtus Roma FC",11838514,10374684],["LEGA DE NOANTRI","Boca Junior",11776593,14854829],["LEGA DE NOANTRI","Temptation Haaland",11733123,18944612],["FANTAVALDINIEVOLE","Big Ramblas",7790602,0],["FANTAVALDINIEVOLE","DieghINDA",7794941,0],["FANTAVALDINIEVOLE","Gli Ingiocabili",7784659,0],["FANTAVALDINIEVOLE","MisterTrip",7845790,0],["FANTAVALDINIEVOLE","Never give up",7789410,0],["FANTAVALDINIEVOLE","Press Team",7785027,0],["FANTAVALDINIEVOLE","Real Gongolo",7784760,0],["FANTAVALDINIEVOLE","Sabonis",7802493,0],["FANTAVALDINIEVOLE","The miraculous",7867526,0],["FANTAVALDINIEVOLE","The Rookie",7802273,0]];
  // 1.3.5 (come Android 1.3.1): "Ranking di Lega" e "Ranking per Club" sono CLASSIFICHE A PUNTI, nessuna formazione da
  // consegnare. Riconosciuti dagli identificativi verificati (R0, 13/10/2026) con il nome come controllo ulteriore; un
  // "Ranking" non noto, o un identificativo noto con un nome diverso, e "da verificare": mai un obbligo di consegna.
  function naturaCompetizione(c) {
    var RANKING_FLE = { 885478: "Ranking di Lega", 885485: "Ranking per Club" };
    var id = Number(c && c.id) || 0, nome = String(c && (c.name || c.nome) || "");
    var noto = Object.prototype.hasOwnProperty.call(RANKING_FLE, String(id)), conNome = /\branking\b/i.test(nome);
    if (noto) return !nome || conNome ? "ranking" : "da_verificare";
    return conNome ? "da_verificare" : "obbligo";
  }
  var NEED = { 1: 2, 2: 3, 3: 3, 4: 3 };
  var RUOLI = { 1: "P", 2: "D", 3: "C", 4: "A" };
  var COLORE_RUOLO = { 1: "#f1a62b", 2: "#3dae2b", 3: "#1f6feb", 4: "#e2333b" };

  // ---------------------------------------------------------------- memoria
  function leggi(k, def) {
    try { var v = localStorage.getItem(PREFISSO + k); return v == null ? def : JSON.parse(v); } catch (e) { return def; }
  }
  function scrivi(k, v) {
    try { localStorage.setItem(PREFISSO + k, JSON.stringify(v)); } catch (e) {}
  }
  function sLeggi(k) {
    try { var v = sessionStorage.getItem(PREFISSO + k); return v == null ? null : JSON.parse(v); } catch (e) { return null; }
  }
  function sScrivi(k, v) {
    try { if (v == null) sessionStorage.removeItem(PREFISSO + k); else sessionStorage.setItem(PREFISSO + k, JSON.stringify(v)); } catch (e) {}
  }

  // ---------------------------------------------------------------- diagnosi
  var DIAG_MAX = 300;
  function ora() {
    var d = new Date();
    function p(n) { return (n < 10 ? "0" : "") + n; }
    return p(d.getHours()) + ":" + p(d.getMinutes()) + ":" + p(d.getSeconds());
  }
  function log(tag, dati) {
    try {
      var righe = leggi("diag", []);
      var testo = ora() + " FVM " + tag + (dati === undefined ? "" : " " + (typeof dati === "string" ? dati : JSON.stringify(dati)));
      righe.push(testo.slice(0, 450));
      if (righe.length > DIAG_MAX) righe = righe.slice(-DIAG_MAX);
      scrivi("diag", righe);
    } catch (e) {}
  }
  log("AVVIO", { versione: VERSIONE, pagina: location.pathname });
  try { pulisciAbbinamentiFc(); } catch (e) {}
  // storico unificato: copia una tantum dello storico precedente (le chiavi originali restano intatte)
  try { storicoMigra(); } catch (e) {}
  try { if (location.hostname === "leghe.fantacalcio.it") controllaAccessoSito(); } catch (e) {} // PROVA14: possibile cambio di account
  try { if (location.hostname === "leghe.fantacalcio.it") avviaSilenzioLeghe(); } catch (e) {} // 1.3.5-RC: silenzio durante le schermate FVM
  // 1.1.0 Fantaclub fase 2: passaggio arrivato da Fantaclub (letto e cancellato dall'indirizzo prima del sito).
  // PROVA14: la vecchia prova di andata e ritorno (PROVA PASSAGGIO FANTACLUB) e stata tolta; nella diagnosi solo l'esito, mai i dati.
  (function () {
    var arrivo = riceviPassaggio();
    if (!arrivo) return;
    if (!arrivo.ok) { log("PASSAGGIO", { tipo: arrivo.tipo || "", esito: "scartato", motivo: arrivo.motivo }); return; }
    if (arrivo.msg.tipo === "controllo-fc-esito") { riceviControlloFc(arrivo.msg); return; }
    if (arrivo.msg.tipo === "ritorno") {
      // CHIUDI su Fantaclub: si apre la Home FVM, anche se il sito mostra /login. La lega viene ricordata SOLO se arriva
      // dalla consegna aperta da QUESTA scheda (stesso controllo della formazione) e la sua pagina Consegna e stata aperta.
      var dR = arrivo.msg.dati || {}, attesaR = sLeggi("fc_consegna_attesa");
      var legaR = !!(dR.nl && NL_VALIDO.test(String(dR.nl)) && attesaR && dR.idConsegna === attesaR.id && Date.now() - Number(attesaR.at || 0) < 3 * 3600000);
      if (legaR) {
        sScrivi("fc_consegna_attesa", null);
        var primaR = legaFc();
        scrivi("fc_lega", { nl: String(dR.nl), at: Date.now() });
        if (!primaR || primaR.nl !== String(dR.nl)) log("FANTACLUB LEGA", { lega: nomeLegaFc(dR.nl), circuito: inCircuitoFc(dR.nl) ? "FLE" : "fuori", prima: primaR ? primaR.nome : "nessuna", come: "pagina Consegna aperta" });
      }
      log("PASSAGGIO", { tipo: "ritorno", esito: "Home FVM", lega: legaR ? nomeLegaFc(dR.nl) : "nessuna" });
      sScrivi("apri", "main");
      return;
    }
    if (arrivo.msg.tipo === "login-ok") {
      // fase 3: accesso Fantaclub riuscito, valido solo se risponde alla richiesta ACCEDI fatta da questa scheda
      var richiesta = sLeggi("fc_accesso_atteso");
      sScrivi("fc_accesso_atteso", null);
      var valido = !!(richiesta && arrivo.msg.dati && arrivo.msg.dati.idAccesso === richiesta.id);
      log("PASSAGGIO", { tipo: "login-ok", esito: valido ? "Fantaclub connesso" : "accesso non riconosciuto" });
      if (valido) { impostaPiattaforma("fantaclub", "accesso Fantaclub"); scrivi("fc_connesso", { at: Date.now() }); }
      sScrivi("apri", "main");
      sScrivi("flash", valido ? "Fantaclub connesso ✓" : "Accesso Fantaclub non riconosciuto: riprova da ACCEDI");
      return;
    }
    if (arrivo.msg.tipo === "esci-esito") {
      // fase 4: esito di DISCONNETTI Fantaclub, valido solo se risponde alla richiesta fatta da questa scheda
      var richiestaE = sLeggi("fc_esci_atteso");
      sScrivi("fc_esci_atteso", null);
      var dE = arrivo.msg.dati || {};
      var validoE = !!(richiestaE && dE.idEsci === richiestaE.id);
      var okE = validoE && dE.esito === "ok";
      if (validoE) registraDiagFc(dE.diagFc);
      log("PASSAGGIO", { tipo: "esci-esito", esito: !validoE ? "uscita non riconosciuta" : okE ? "Fantaclub disconnesso" : "uscita non confermata dal sito" });
      if (okE) dimenticaFantaclub("disconnetti");
      sScrivi("apri", "main");
      sScrivi("flash", okE ? "Disconnesso da Fantaclub ✓" : validoE ? "Fantaclub non ha confermato l'uscita: riprova o esci dal menu del sito" : "Uscita da Fantaclub non riconosciuta");
      return;
    }
    if (arrivo.msg.tipo === "formazione" || arrivo.msg.tipo === "solo-fle") {
      // fasi 5-6-10: risposta alla consegna Fantaclub aperta da QUESTA scheda (FAI O MODIFICA della Home)
      var attesaC = sLeggi("fc_consegna_attesa");
      var dC = arrivo.msg.dati || {};
      var validoC = !!(attesaC && dC.idConsegna === attesaC.id && Date.now() - Number(attesaC.at || 0) < 3 * 3600000);
      if (!validoC) {
        log("PASSAGGIO", { tipo: arrivo.msg.tipo, esito: "consegna non riconosciuta" });
        sScrivi("apri", "main"); sScrivi("flash", "Formazione Fantaclub non riconosciuta: rifai FAI O MODIFICA LA FORMAZIONE");
        return;
      }
      sScrivi("fc_consegna_attesa", null);
      registraDiagFc(dC.diagFc);
      log("PASSAGGIO", { tipo: arrivo.msg.tipo, esito: "ricevuto" });
      if (arrivo.msg.tipo === "formazione") { var primaFc = Date.now(); riceviFormazioneFc(dC); try { storicoConsegnaFc(dC, primaFc); } catch (e) {} return; }
      // SOLO FLE: SOLO per la lega Fantaclub di origine verificata e nel circuito FLE (controllo PRIMA del login Leghe
      // e di qualsiasi flusso FLE; senza lega nel passaggio: bloccato). Poi stesso percorso gia approvato (campo FLE).
      var nlS = NL_VALIDO.test(String(dC.nl || "")) ? String(dC.nl) : "";
      if (nlS && dC.nlVerificata) { var primaS = legaFc(); scrivi("fc_lega", { nl: nlS, at: Date.now() }); if (!primaS || primaS.nl !== nlS) log("FANTACLUB LEGA", { lega: nomeLegaFc(nlS), circuito: inCircuitoFc(nlS) ? "FLE" : "fuori", come: "pagina Consegna aperta" }); }
      // lega non verificata dalla sua pagina Consegna: come senza lega (nessun invio FLE senza verifica positiva)
      // PROVA12: anche la squadra FLE attesa (A1); bloccato = modalita lasciata com'era, nessuna navigazione (A7)
      var esS = nlS && dC.nlVerificata ? ammessoCampoFleFc(nlS) : fleFantaclubAmmesso("");
      if (!esS.ok) {
        ripristinaModoBloccato(null, "SOLO FLE bloccato (Fantaclub)");
        log("SOLO FLE BLOCCATO", { piattaforma: "fantaclub", motivo: esS.motivo, lega: esS.lega || "" });
        try { storicoBloccato("solo_fle", nlS, esS.testo); } catch (e) {}
        sScrivi("apri", "main"); sScrivi("flash", esS.testo);
        return;
      }
      try { sScrivi("storico_modifica", null); } catch (e) {}
      scrivi("modo", "solo_fle");
      log("MODO", { a: "solo_fle", perche: "scelto su Fantaclub", lega: esS.lega });
      apriCampoFle(nlS);
      return;
    }
    // PROVA14: nessun altro tipo e previsto (la vecchia prova di andata e ritorno e stata tolta): ignorato, nessuna azione
    log("PASSAGGIO", { tipo: arrivo.msg.tipo, esito: "tipo non gestito: ignorato" });
  })();

  // ---------------------------------------------------------------- pagine
  function suFle() { return location.pathname.indexOf("/" + FLE_SLUG + "/") === 0 || location.pathname === "/" + FLE_SLUG; }
  function suFormazione() { return /\/lineup/.test(location.pathname); }
  function suLogin() {
    if (/login|accedi|registr|password/i.test(location.pathname)) return true;
    try { return !!document.querySelector('input[type="password"]'); } catch (e) { return false; }
  }
  function fleLineupUrl(comp) { return "https://leghe.fantacalcio.it/" + FLE_SLUG + "/view/competition/" + comp + "/lineup"; }
  function fleDashboardUrl() { return "https://leghe.fantacalcio.it/" + FLE_SLUG + "/view/dashboard"; }
  function fleDiscoveryUrl() { return "https://leghe.fantacalcio.it/" + FLE_SLUG + "/?fvm_discovery=" + Date.now(); }

  // ---------------------------------------------------------------- lega e competizione
  function slugDaPagina() {
    var m = location.pathname.match(/^\/([^\/]+)\/view\//);
    return m ? m[1] : "";
  }
  function nomeLega(slug) { return String(slug || "").replace(/-/g, " ").toUpperCase(); }
  function legaCorrente() { return leggi("lega_sorgente", "") || leggi("lega", ""); }
  // 1.1.0: leghe sorgente previste (Leghe Fantacalcio), copiate da leagues.js di Android 1.2.3 [nome, slug].
  // Solo queste possono diventare la lega sorgente di LEGA + FLE.
  var LEGHE_FONTE = [["LEGA DEL PIANTO","lega-del-pianto"],["TOTA ITALIA AD VICTORIAM","tota-italia------------------ad-victoriam-"],["FANTA FOCOLARE 2","fanta-focolare-2"],["FANTAPINTUS LO SCOPRITORE DI BIDONI","fantapintus-lo-scopritore-di-bidoni"],["POLFER","polfer"],["FANTAROCCOLEGENDSPORT","fantaroccolegendsport"],["LEGA DE NOANTRI","lega-de-noantri"]];
  function legaPrevista(slug) { return LEGHE_FONTE.some(function (l) { return l[1] === slug; }); }
  // Dati legati all'account: cancellati all'uscita da FVM, al nuovo ACCEDI e quando cambia la lega sorgente.
  // Mai: Storico invii, competizioni ricordate, scelte dei sostituti, impostazioni, diagnosi.
  // (1.1.0 Fantaclub: anche lo stato FLE messo da parte dall'altra piattaforma, perche FLE e sempre dell'account Leghe)
  var DATI_ACCOUNT = ["lega_sorgente", "lega", "lega_uso", "ultima", "fle", "solo_lega_salvata", "lega_lavoro", "fle_associazione", "fle_fantacalcio", "fle_fantaclub"];
  function azzeraDatiAccount(motivo) {
    DATI_ACCOUNT.forEach(function (k) { try { localStorage.removeItem(PREFISSO + k); } catch (e) {} });
    nuovaEpocaAccount(motivo);
    log("LEGA SORGENTE", { azione: "dati account azzerati", motivo: motivo });
  }
  // PROVA14 (sicurezza): EPOCA DELL'ACCOUNT. FVM non legge l'identita dell'account collegato: ogni possibile cambio di account
  // (ACCEDI o uscita da FVM, pagina di accesso del sito aperta anche senza FVM) apre una nuova epoca. Sblocco dell'Area Admin,
  // squadra FLE verificata e «leghe aperte» valgono SOLO nell'epoca in cui sono nati: dopo, servono di nuovo (codice Admin,
  // VERIFICA SQUADRA FLE, apertura della lega). Nessun dato cancellato: le registrazioni precedenti restano, ma non valgono piu.
  function epocaAccount() { return Number(leggi("account_epoca", 0)) || 0; }
  function nuovaEpocaAccount(motivo) {
    var e = epocaAccount() + 1;
    scrivi("account_epoca", e); sScrivi("admin_sessione", null); sScrivi("identita", null); // 1.3.5-RC: identita da rileggere
    try { ctl.identitaChiesta = false; ctl.identitaProgrammata = false; } catch (er) {}
    log("ACCOUNT", { epoca: e, motivo: motivo, effetto: "Admin, squadra FLE verificata e leghe aperte da confermare" });
  }
  // pagina di accesso del sito (anche aperta senza FVM): possibile cambio di account (chiamata una volta all'avvio della pagina)
  function controllaAccessoSito() {
    if (!/^\/login/i.test(location.pathname)) return;
    nuovaEpocaAccount("pagina di accesso del sito");
  }
  function impostaSorgente(slug, motivo) {
    var prima = leggi("lega_sorgente", "");
    if (prima && prima !== slug) azzeraDatiAccount("lega sorgente cambiata");
    scrivi("lega_sorgente", slug); scrivi("lega", slug);
    log("LEGA SORGENTE", { lega: slug, motivo: motivo, prima: prima || "" });
  }
  function impostaLega(slug) {
    if (!slug || slug === FLE_SLUG) return;
    // PROVA14 (sicurezza): una pagina aperta da FVM per una sua attivita (CONSEGNE UFFICIALI, controllo o verifica FLE, Area
    // Admin) NON e una lega aperta dall'utente: non entra tra le leghe note e non puo diventare la lega FLE
    var tk = sLeggi("task");
    if (tk) { log("LEGA LETTA DA FVM", { lega: slug, attivita: tk.tipo || "", effetto: "non registrata tra le leghe aperte" }); return; }
    registraLegaAperta(slug, "pagina della lega aperta");
    // 1.1.0: elenco delle leghe dell'account gia visitate (per SOLO LEGA).
    var note = leggi("leghe_note", []);
    if (note.indexOf(slug) < 0) { note.push(slug); scrivi("leghe_note", note.slice(-12)); log("LEGA NOTA", slug); }
    var sorgente = leggi("lega_sorgente", "");
    // La prima lega PREVISTA riconosciuta diventa la sorgente stabile (1.1.0: mai una lega fuori da LEGHE_FONTE).
    // Da qui in poi i passaggi temporanei del selettore non possono sostituirla.
    if (!sorgente) { if (legaPrevista(slug)) impostaSorgente(slug, "prima lega prevista vista"); return; }
    if (sorgente === slug && leggi("lega", "") !== slug) scrivi("lega", slug);
  }
  // PROVA14: leghe aperte DALL'UTENTE con l'account attuale (epoca): [{ s: lega, e: epoca, at, fonte }]. Le vecchie «leghe_note»
  // (tutte le epoche, anche pagine aperte da FVM) restano per i loro usi, ma NON compaiono piu come «leghe gia aperte».
  function legheAperte() { var e = epocaAccount(); return (leggi("leghe_aperte", []) || []).filter(function (x) { return x && x.s && Number(x.e) === e; }); }
  function registraLegaAperta(slug, fonte) {
    if (!slug || slug === FLE_SLUG) return;
    var e = epocaAccount(), l = (leggi("leghe_aperte", []) || []).filter(function (x) { return x && x.s; });
    if (l.some(function (x) { return x.s === slug && Number(x.e) === e; })) return;
    l.push({ s: slug, e: e, at: Date.now(), fonte: fonte });
    scrivi("leghe_aperte", l.slice(-40));
    log("LEGA APERTA", { lega: slug, epoca: e, fonte: fonte });
  }
  // 1.3.4: LEGA DI LAVORO. Con SOLO LEGA l'utente puo lavorare su un'altra lega del suo account: diventa la lega di
  // PASSO 1 e di FAI O MODIFICA, che resta SOLO LEGA. La lega FLE (lega_sorgente) NON cambia: appartenere al circuito
  // FLE non autorizza LEGA + FLE (l'associazione dell'account alla squadra FLE si verifica solo con il controllo FLE:
  // squadra letta su FLE = squadra attesa). Consegne ufficiali e attivita di FVM (task) non la cambiano mai.
  function legaLavoro() { var l = leggi("lega_lavoro", ""), src = leggi("lega_sorgente", ""); return l && src && l !== src ? l : ""; }
  function cambiaLegaLavoro(slug, motivo) {
    var src = leggi("lega_sorgente", "");
    if (!src || slug === FLE_SLUG) return false;
    if (slug === src) slug = "";
    var prima = legaLavoro();
    if (slug === prima) return false;
    // nessun dato della lega precedente trascinato nella nuova: formazione, squadra, controllo FLE, SOLO LEGA in sospeso
    ["ultima", "fle", "solo_lega_salvata"].forEach(function (k) { try { localStorage.removeItem(PREFISSO + k); } catch (e) {} });
    sScrivi("storico_modifica", null);
    scrivi("lega_lavoro", slug);
    log("LEGA DI LAVORO", { da: prima || src, a: slug || src, fle: slug ? "no (SOLO LEGA)" : "lega FLE", motivo: motivo });
    return true;
  }
  // l'ultimo controllo FLE ha letto su FLE una squadra DIVERSA da quella attesa per la lega FLE: account non associato
  function fleNonAssociata() { var a = leggi("fle_associazione", null); return !!(a && a.esito === "diversa" && a.lega === leggi("lega_sorgente", "")); }
  // ================================================================ 1.3.5 AUTORIZZAZIONE FLE (come Android 1.3.1)
  // Appartenere al circuito FLE non basta: LEGA + FLE, SOLO FLE, MODIFICA SU FLE, RIPETI CONTROLLO e INVIA (Leghe
  // Fantacalcio) richiedono la squadra FLE VERIFICATA per QUESTA lega FLE e QUESTO account: VERIFICA SQUADRA FLE (sola
  // lettura) oppure un controllo FLE riuscito (gia nella 1.3.4: squadra letta su FLE = squadra attesa). Esiti "diversa" e
  // "incerta" o nessuna verifica: SOLO LEGA, che resta sempre disponibile. Fantaclub: regole invariate (fleFantaclubAmmesso).
  // Le funzioni di controllo e invio FLE sono IDENTICHE alla 1.3.4: i blocchi stanno solo nei punti d'ingresso.
  // PROVA14: la verifica vale solo nell'epoca dell'account in cui e stata fatta (registrazioni precedenti senza epoca = epoca 0)
  // 1.3.5-RC: la verifica vale solo per l'IDENTITÀ dell'account che l'ha fatta (impronta), oltre che per l'epoca; le verifiche delle
  // versioni precedenti (senza identità) non valgono più: si rifà VERIFICA SQUADRA FLE (sola lettura). Nulla viene cancellato.
  function associazioneLeghe() { var a = leggi("fle_associazione", null), id = identitaAttuale(); return a && a.lega && a.lega === leggi("lega_sorgente", "") && (Number(a.epoca) || 0) === epocaAccount() && id && a.imp === id ? a : null; }
  function scriviAssociazione(rec) { rec.epoca = epocaAccount(); rec.imp = identitaAttuale(); scrivi("fle_associazione", rec); }
  function attesoAssociazione(a) { return Number(a && (a.atteso || a.fleTid) || 0); }
  function fleAutorizzatoLeghe(ignoraLavoro) {
    var src = leggi("lega_sorgente", ""), nome = src ? nomeLega(src) : "la tua lega", lav = legaLavoro();
    if (lav && !ignoraLavoro) return { ok: false, motivo: "lega_lavoro", testo: "Stai lavorando su " + nomeLega(lav) + " con SOLO LEGA: nessun invio a FLE. Per tornare alla tua lega FLE scegli LEGA + FLE nella pagina della formazione." };
    if (!src) return { ok: false, motivo: "senza_lega", testo: "Entra prima nella tua lega (CAMBIA LEGA): poi premi VERIFICA SQUADRA FLE. SOLO LEGA resta disponibile." };
    if (!identitaAttuale()) return { ok: false, motivo: "identita", testo: testoIdentita() }; // 1.3.5-RC: account non riconosciuto = prudenza
    var a = associazioneLeghe(), u = leggi("ultima", null);
    if (a && a.esito === "diversa") return { ok: false, motivo: "non_associato", testo: "Con questo account su FLE c'è una squadra diversa da quella di " + nome + (a.motivo ? " (" + a.motivo + ")" : "") + ": nessun invio a FLE. Entra in Leghe Fantacalcio con l'account che gestisce la squadra e ripeti VERIFICA SQUADRA FLE. SOLO LEGA resta disponibile." };
    if (a && a.esito === "verificata" && Number(a.sorgente) && u && u.lega === src && Number(u.tid) && Number(u.tid) !== Number(a.sorgente))
      return { ok: false, motivo: "altro_account", testo: "La verifica di " + nome + " riguarda un'altra squadra o un altro account: ripeti VERIFICA SQUADRA FLE (sola lettura, nessun invio). SOLO LEGA resta disponibile." };
    if (!(a && a.esito === "verificata")) return { ok: false, motivo: a && a.esito === "incerta" ? "incerta" : "da_verificare",
      testo: "Squadra FLE di questo account " + (a && a.esito === "incerta" ? "NON verificata (esito incerto" + (a.motivo ? ": " + a.motivo : "") + ")" : "non ancora verificata") + " per " + nome + ": premi VERIFICA SQUADRA FLE nella Home (sola lettura, nessuna formazione salvata o inviata). SOLO LEGA resta disponibile." };
    return { ok: true };
  }
  // modalita con cui si apre la pagina formazione (FAI O MODIFICA, nuova sessione): LEGA + FLE solo con verifica riuscita
  function modoInizialeLeghe() { return fleAutorizzatoLeghe().ok ? "lega_fle" : "solo_lega"; }
  // percorso FLE richiesto da Leghe Fantacalcio e non autorizzato: avviso, diagnosi, la modalita torna quella consentita
  function bloccoFleLeghe(azione) {
    if (piattaformaScelta() === "fantaclub") return false;
    var az = fleAutorizzatoLeghe(azione === "lega_fle" || azione === "solo_fle");
    if (az.ok) return false;
    log("FLE NON AUTORIZZATO", { azione: azione, motivo: az.motivo, lega: leggi("lega_sorgente", "") });
    avviso(az.testo, true);
    return true;
  }
  // teamLineupDto (squadra e competizione) da una risposta del sito: SOLO questi due numeri, nessun giocatore
  function trovaDto(x, d) {
    if (!x || typeof x !== "object" || d > 7) return null;
    if (x.teamLineupDto && typeof x.teamLineupDto === "object") return x.teamLineupDto;
    var vals = Array.isArray(x) ? x : Object.keys(x).map(function (k) { return x[k]; });
    for (var i = 0; i < vals.length; i++) { var r = trovaDto(vals[i], d + 1); if (r) return r; }
    return null;
  }
  function taskVerifica() { var t = sLeggi("task"); return t && t.tipo === "verifica" ? t : null; }
  // 1.3.5-RC2: come Android, per la verifica basta la squadra (teamLineupDto.tid) anche senza la lista dei giocatori (competizione
  // senza turno). Vale SOLO nella pagina formazione della competizione in prova e SOLO per una risposta di QUELLA competizione
  // (idcomp, oppure, se manca, l'indirizzo della lettura formazione .../teamLineup/.../<competizione>). Squadre diverse = ambiguo.
  function verificaFleDaRisposta(j, p, task) {
    var dto = trovaDto(j, 0), comp = Number(task.comp || 0), m = location.pathname.match(/\/view\/competition\/(\d+)\/lineup/);
    if (!dto || !comp || !m || Number(m[1]) !== comp) return;
    var r = ctl.verificaFle || (ctl.verificaFle = { comp: comp, tids: [], risposte: 0, altre: 0, senzaGiocatori: false });
    r.risposte++;
    var tid = Number(dto.tid || 0), idc = Number(dto.idcomp || 0);
    if (!tid) return;
    var compR = idc || (/\/teamLineup\//i.test(String(p || "")) ? Number((String(p).match(/\/(\d+)$/) || [])[1] || 0) : 0);
    if (compR !== comp) { r.altre++; return; }
    if (r.tids.indexOf(tid) < 0) r.tids.push(tid);
    if (!trovaPayload(j, 0)) r.senzaGiocatori = true;
  }
  function taskAttivoFle() {
    var t = sLeggi("task");
    return !!(t && (t.tipo === "check" || t.tipo === "invio" || t.tipo === "admin" || t.tipo === "verifica" || t.tipo === "riverifica" || t.tipo === "turno"));
  }
  function urlLegaSorgente() {
    var slug = legaCorrente();
    if (!slug) return "https://leghe.fantacalcio.it/";
    return urlFormazione(slug) || ("https://leghe.fantacalcio.it/" + slug);
  }
  function urlFleFissa() {
    var f = leggi("fle", {}) || {};
    return f.comp ? fleLineupUrl(Number(f.comp)) : fleDiscoveryUrl();
  }
  // 1.3.5 (collaudo XR): il ritorno del blocco SOSTITUISCE la pagina bloccata nella cronologia di Safari (location.replace):
  // con il tasto Indietro non si rientra nella pagina bloccata, quindi nessun nuovo rimbalzo verso la lega FLE.
  function vaiSostituendo(u) {
    if (typeof location.replace === "function") location.replace(u); else location.assign(u);
  }
  function applicaBloccoModo(perche) {
    if (suLogin()) return false;
    if (taskVerifica()) return false; // 1.3.5: VERIFICA SQUADRA FLE in corso (lega e FLE, sola lettura)
    var modo = leggi("modo", "lega_fle");
    var slugPagina = slugDaPagina();
    var sorgente = legaCorrente();
    // Durante controllo/invio LEGA+FLE FVM deve poter lavorare dentro FLE.
    if (modo === "lega_fle" && taskAttivoFle()) return false;
    if (modo === "solo_fle") {
      if (!suFle()) { log("BLOCCO MODO", { modo: modo, perche: perche || "pagina", da: location.pathname, a: "FLE" }); vaiSostituendo(urlFleFissa()); return true; }
      return false;
    }
    // 1.1.0: SOLO LEGA naviga liberamente tra le leghe dell'account.
    if (modo === "solo_lega") return false;
    // LEGA+FLE, quando non sta eseguendo un task FLE, resta sulla lega associata a FLE (sicurezza).
    if (modo === "lega_fle" && sorgente && slugPagina && slugPagina !== sorgente) {
      log("BLOCCO MODO", { modo: modo, perche: perche || "pagina", da: slugPagina, a: sorgente });
      sScrivi("avviso_blocco", "LEGA + FLE usa solo la tua lega FLE. Per un'altra lega scegli SOLO LEGA.");
      vaiSostituendo(urlLegaSorgente()); return true;
    }
    return false;
  }
  // 1.3.5 (2° collaudo XR): CAMBIA LEGA della Home come l'app Android (chooseLeague): ELENCO DELLE LEGHE dentro FVM, nessuna
  // pagina aperta e nessun ricaricamento. La lega scelta diventa subito quella di PASSO 1. Causa del difetto del 2° collaudo:
  // dopo l'avviso vaiLega("") apriva la radice del sito, che riporta all'ultima lega usata, e controllaPagina ne apriva subito
  // la formazione (vai_lega senza lega = qualsiasi lega): si tornava alla lega FLE o alla schermata generale del sito.
  //  - lega diversa dalla lega FLE: SOLO LEGA + lega di lavoro (cambiaLegaLavoro): nessun invio FLE possibile da quella lega;
  //  - lega FLE: lega di lavoro azzerata; LEGA + FLE solo con la squadra FLE verificata e mai su una pagina di un'altra lega
  //    (il blocco di sicurezza la riaprirebbe): in quel caso si attiva con PASSO 1 (vaiAllaFormazione), come sempre;
  //  - lega FLE non ancora nota: si apre la lega scelta (il sito controlla che sia dell'account) e poi torna la Home.
  // La lega FLE, la verifica della squadra e le protezioni FLE NON cambiano. Fantaclub: comportamento invariato.
  function legheElenco() {
    var out = [], visti = {};
    var metti = function (s, tipo) { if (!s || s === FLE_SLUG || visti[s]) return; visti[s] = 1; out.push({ slug: s, tipo: tipo }); };
    metti(leggi("lega_sorgente", ""), "fle");
    // PROVA14: «aperte» = SOLO quelle aperte dall'utente con l'account attuale (mai le pagine aperte da FVM, mai altri account)
    legheAperte().forEach(function (x) { metti(x.s, "nota"); });
    LEGHE_FONTE.forEach(function (l) { metti(l[1], "circuito"); });
    // vecchie registrazioni (tutte le epoche) fuori dal circuito: restano visibili, ma come NON confermate per questo account
    (leggi("leghe_note", []) || []).forEach(function (s) { metti(s, "passato"); });
    return out;
  }
  function nomeLegaElenco(s) {
    var l = LEGHE_FONTE.filter(function (x) { return x[1] === s; })[0];
    return l ? l[0] : leggi("nome_lega_" + s, "") || nomeLega(s);
  }
  function cambiaLegaHome() {
    var modo = leggi("modo", "lega_fle");
    // PROVA15: con Fantaclub, CAMBIA LEGA non apre piu la pagina iniziale di Leghe Fantacalcio: spiega e porta alla Consegna Fantaclub
    if (piattaformaScelta() === "fantaclub") { cambiaLegaFcHome(); return; }
    monta();
    if (!radice) return;
    var src = leggi("lega_sorgente", ""), inUso = legaLavoro() || src, az = fleAutorizzatoLeghe(true), elenco = legheElenco();
    log("CAMBIA LEGA", { esito: "elenco", modo: modo, leghe: elenco.length, inUso: inUso || "" });
    var box = document.createElement("div");
    box.className = "ov";
    var h = "<div class='cd'><div class='lb'>FANTA VICE MISTER</div><div class='t1' style='margin-top:6px'>Scegli la lega</div>" +
      "<div class='mu' style='margin-top:6px'>" + (src ? "La lega scelta diventa quella di PASSO 1. Solo " + esc(nomeLegaElenco(src)) + " può usare LEGA + FLE" +
        (az.ok ? "" : " (dopo VERIFICA SQUADRA FLE)") + ": le altre leghe lavorano in SOLO LEGA, senza nessun invio a FLE." : "Scegli la lega del tuo account: la apro e la riconosco.") + "</div></div>";
    var gruppo = "";
    elenco.forEach(function (l) {
      var tit = l.tipo === "fle" ? "LA TUA LEGA FLE" : l.tipo === "nota" ? "LEGHE APERTE CON QUESTO ACCOUNT" : l.tipo === "passato" ? "VISTE IN PASSATO SU QUESTO IPHONE (NON CONFERMATE)" : "ALTRE LEGHE DEL CIRCUITO FLE";
      if (tit !== gruppo) { gruppo = tit; h += "<div class='lb' style='margin:12px 2px 0'>" + tit + "</div>"; }
      var meta = l.tipo === "fle" ? (az.ok ? "LEGA + FLE · squadra FLE verificata" : "SOLO LEGA finché non verifichi la squadra FLE")
        : !src ? (l.tipo === "nota" ? "aperta con questo account" : "si apre solo se è nel tuo account")
        : "SOLO LEGA · nessun invio a FLE" + (l.tipo !== "nota" ? " · si apre solo se è nel tuo account" : "");
      h += "<button class='bt" + (l.slug === inUso ? " oro" : "") + "' data-s='" + esc(l.slug) + "'>" + esc(nomeLegaElenco(l.slug)) + (l.slug === inUso ? " ✓" : "") +
        "<div style='font-size:12px;font-weight:600;opacity:.85;margin-top:3px'>" + (l.slug === inUso ? "IN USO · " : "") + esc(meta) + "</div></button>";
    });
    h += "<div class='mu' style='margin:10px 2px 0'>Un'altra lega del tuo account? Aprila dal selettore del sito: con SOLO LEGA FVM la riconosce da sola.</div>" +
      "<button class='bt' data-s=''>ANNULLA</button>";
    box.innerHTML = h;
    radice.appendChild(box);
    Array.prototype.forEach.call(box.querySelectorAll("[data-s]"), function (b) {
      b.addEventListener("click", function (ev) {
        if (ev && ev.stopPropagation) ev.stopPropagation();
        box.remove();
        var s = b.getAttribute("data-s");
        if (!s) { log("CAMBIA LEGA", { esito: "annullato", modo: modo }); return; }
        scegliLegaElenco(s);
      });
    });
  }
  // PROVA15: CAMBIA LEGA con Fantaclub. Per sicurezza una lega Fantaclub vale SOLO dopo l'apertura della sua pagina «Consegna» (lega
  // verificata dal sito): qui lo si spiega e si porta direttamente li. Credenziali, sessione dei siti e storico NON vengono toccati.
  function cambiaLegaFcHome() {
    monta();
    if (!radice) return;
    var lg = legaFc(), stato = lg ? (inCircuitoFc(lg.nl) ? "nel circuito FLE" : "fuori dal circuito FLE: consegna solo in lega (SOLO LEGA)") : "";
    log("CAMBIA LEGA", { piattaforma: "fantaclub", lega: lg ? lg.nl : "nessuna", esito: "spiegazione" });
    var box = document.createElement("div");
    box.className = "ov";
    box.innerHTML = "<div class='cd'><div class='lb'>FANTA VICE MISTER · FANTACLUB</div><div class='t1' style='margin-top:6px'>Cambia lega Fantaclub</div>" +
      "<div class='mu' style='margin-top:6px'>" + (lg ? "Lega in uso: <b>" + esc(lg.nome) + "</b> (" + esc(stato) + ")." : "Nessuna lega Fantaclub riconosciuta.") + "</div>" +
      "<div class='mu' style='margin-top:6px'>Per sicurezza FVM riconosce una lega Fantaclub solo quando apri la sua pagina <b>Consegna</b>: per un'altra lega tocca SCEGLI UN'ALTRA LEGA, scegli la lega sul sito e apri «Consegna». Username, password, sessione e storico non vengono toccati.</div></div>" +
      (lg ? "<button class='bt oro' data-c='consegna'>APRI LA CONSEGNA DI " + esc(lg.nome) + "</button>" : "") +
      "<button class='bt" + (lg ? "" : " oro") + "' data-c='altra'>SCEGLI UN'ALTRA LEGA FANTACLUB</button><button class='bt' data-c=''>ANNULLA</button>";
    radice.appendChild(box);
    Array.prototype.forEach.call(box.querySelectorAll("[data-c]"), function (b) {
      b.addEventListener("click", function (ev) {
        if (ev && ev.stopPropagation) ev.stopPropagation();
        var c = b.getAttribute("data-c");
        box.remove();
        if (!c) { log("CAMBIA LEGA", { piattaforma: "fantaclub", esito: "annullato" }); return; }
        if (c === "altra" && lg) { cambiaLegaFc(); if (legaFc()) { aggiornaPannello(); return; } } // conferma rifiutata: nulla cambia
        log("CAMBIA LEGA", { piattaforma: "fantaclub", esito: c === "altra" ? "altra lega: apro Fantaclub" : "apro la Consegna", lega: (legaFc() || {}).nl || "da scegliere" });
        chiudiPannello();
        consegnaFantaclub();
      });
    });
  }
  // CAMBIA LEGA senza lega FLE nota: arrivati nella lega scelta torna la Home di FVM (una volta, entro 60 s)
  function homeDopoLega() {
    var hd = sLeggi("home_dopo_lega"), s = slugDaPagina();
    if (!hd) return;
    if (Date.now() - Number(hd.at || 0) > 60000) { sScrivi("home_dopo_lega", null); return; }
    if (s && s === hd.slug) { sScrivi("home_dopo_lega", null); log("CAMBIA LEGA", { esito: "lega aperta", lega: s, legaFle: leggi("lega_sorgente", "") || "" }); apriPannello(); }
  }
  function scegliLegaElenco(slug) {
    var src = leggi("lega_sorgente", ""), modo = leggi("modo", "lega_fle"), prima = legaLavoro() || src;
    if (!src) {
      log("CAMBIA LEGA", { esito: "scelta", lega: slug, perche: "lega FLE non ancora nota: apro la lega" });
      sScrivi("home_dopo_lega", { slug: slug, at: Date.now() });
      chiudiPannello(); location.assign("https://leghe.fantacalcio.it/" + slug);
      return;
    }
    var nuovo = modo;
    if (slug !== src) nuovo = "solo_lega";
    else if (modo === "solo_lega" && fleAutorizzatoLeghe(true).ok) {
      var qui = slugDaPagina();
      if (!qui || qui === src) nuovo = "lega_fle"; // altrimenti LEGA + FLE si attiva con PASSO 1 (nessun ritorno forzato da qui)
    } else if (modo !== "solo_lega" && !fleAutorizzatoLeghe(true).ok) nuovo = "solo_lega";
    if (nuovo !== modo) { scrivi("modo", nuovo); log("MODO", { da: modo, a: nuovo, perche: "CAMBIA LEGA" }); }
    cambiaLegaLavoro(slug === src ? "" : slug, "CAMBIA LEGA: scelta dall'elenco");
    log("CAMBIA LEGA", { esito: "scelta", da: prima, a: slug, modo: nuovo, fle: slug === src ? "lega FLE" : "no (SOLO LEGA)" });
    aggiornaPannello();
    avviso("PASSO 1: " + nomeLegaElenco(slug) + (slug === src ? (nuovo === "lega_fle" ? " · LEGA + FLE" : " · LEGA + FLE si attiva con PASSO 1 se la squadra FLE è verificata") : " · SOLO LEGA, nessun invio a FLE"));
  }
  // 1.1.0: apertura della formazione di una lega qualsiasi (SOLO LEGA).
  // Se la competizione non e ancora nota, controllaPagina apre la formazione appena la scopre.
  function vaiLega(slug) {
    var u = slug ? urlFormazione(slug) : "";
    log("SOLO LEGA VAI", { lega: slug || "altra", diretto: !!u });
    if (u) { location.assign(u); return; }
    sScrivi("vai_lega", { slug: slug || "", at: Date.now() });
    location.assign("https://leghe.fantacalcio.it/" + (slug || ""));
  }
  function vaiLegaAttivo() {
    var vl = sLeggi("vai_lega");
    if (vl && Date.now() - Number(vl.at || 0) > 120000) { sScrivi("vai_lega", null); return null; }
    return vl;
  }
  function urlFormazione(slug) {
    var comp = leggi("comp_" + slug, 0);
    return comp ? "https://leghe.fantacalcio.it/" + slug + "/view/competition/" + comp + "/lineup" : "";
  }
  function controllaPagina() {
    if (suFle()) {
      // 1.0.1: SOLO FLE con competizione non ancora nota. FLE porta alla pagina
      // /view/competition/<id>/dashboard: da li apriamo il campo di quella competizione.
      var vai = sLeggi("vai_campo_fle");
      if (vai && Date.now() - Number(vai) > 30000) { sScrivi("vai_campo_fle", null); vai = null; }
      var mc = location.pathname.match(/\/view\/competition\/(\d+)\//);
      if (vai && mc && !suFormazione()) {
        sScrivi("vai_campo_fle", null);
        log("SOLO FLE CAMPO", { comp: Number(mc[1]), da: location.pathname });
        chiudiPannello();
        location.assign(fleLineupUrl(Number(mc[1])));
      }
      return;
    }
    var m = location.pathname.match(/^\/([^\/]+)\/view\/competition\/(\d+)\/lineup/);
    if (m) {
      impostaLega(m[1]);
      scrivi("lega_uso", m[1]);
      // 1.3.4: con SOLO LEGA la formazione aperta e la lega di lavoro (mai durante un'attivita di FVM)
      if (leggi("modo", "lega_fle") === "solo_lega" && !sLeggi("task")) cambiaLegaLavoro(m[1], "formazione aperta con SOLO LEGA");
      sScrivi("formazione_aperta", { slug: m[1], at: Date.now() });
      sScrivi("apro_formazione", null); // la formazione si e aperta davvero
      if (!leggi("comp_" + m[1], 0)) { scrivi("comp_" + m[1], Number(m[2])); log("COMPETIZIONE", { lega: m[1], comp: Number(m[2]), da: "pagina" }); }
    } else {
      var s = slugDaPagina();
      if (s) impostaLega(s);
      // 1.3.4: lega cambiata dal sito subito dopo la pagina formazione, con SOLO LEGA (non da Consegne o altre attivita)
      var fa = sLeggi("formazione_aperta");
      if (s && s !== FLE_SLUG && fa && fa.slug !== s && Date.now() - Number(fa.at || 0) < 15 * 60000 && leggi("modo", "lega_fle") === "solo_lega" && !sLeggi("task")) {
        if (cambiaLegaLavoro(s, "lega cambiata dal sito con SOLO LEGA")) sScrivi("formazione_aperta", { slug: s, at: Date.now() });
      }
    }
    try {
      var slug = slugDaPagina();
      if (slug && !leggi("comp_" + slug, 0)) {
        var a = document.querySelector('a[href*="/view/competition/"][href*="/lineup"]');
        var mm = a && String(a.getAttribute("href")).match(/competition\/(\d+)\/lineup/);
        if (mm) { scrivi("comp_" + slug, Number(mm[1])); log("COMPETIZIONE", { lega: slug, comp: Number(mm[1]), da: "link" }); }
      }
    } catch (e) {}
    try {
      if (sessionStorage.getItem(PREFISSO + "vai") && !suFormazione()) {
        var u = urlFormazione(legaCorrente());
        if (u) { sessionStorage.removeItem(PREFISSO + "vai"); location.assign(u); }
      }
    } catch (e) {}
    // 1.1.0: SOLO LEGA · lega scelta dall'elenco o con ALTRA LEGA…: apro la sua formazione.
    try {
      var vl = vaiLegaAttivo();
      if (vl && suFormazione()) sScrivi("vai_lega", null);
      else if (vl) {
        var s2 = slugDaPagina();
        if (s2 && s2 !== FLE_SLUG && (!vl.slug || vl.slug === s2)) {
          var u2 = urlFormazione(s2);
          if (u2) { sScrivi("vai_lega", null); log("SOLO LEGA FORMAZIONE", { lega: s2 }); location.assign(u2); }
        }
      }
    } catch (e) {}
  }
  // 1.1.0: elenco delle competizioni della lega (solo il primo elenco di primo livello della risposta).
  function competizioniLega(j) {
    var d = j && !Array.isArray(j) && j.data !== undefined ? j.data : j;
    var arr = Array.isArray(d) ? d : null;
    if (!arr && d && typeof d === "object") {
      var ks = Object.keys(d);
      for (var i = 0; i < ks.length && !arr; i++) if (Array.isArray(d[ks[i]])) arr = d[ks[i]];
    }
    var out = [], visti = {};
    (arr || []).forEach(function (c) {
      var id = Number(c && c.id), nome = String(c && (c.name || c.n) || "").trim();
      if (id > 0 && nome && !visti[id]) { visti[id] = 1; out.push({ id: id, name: nome }); }
    });
    return out.slice(0, 10);
  }
  function listaCompetizioni(j) {
    var lista = [];
    (function cerca(x, d) {
      if (!x || typeof x !== "object" || d > 6) return;
      if (Array.isArray(x)) { x.forEach(function (v) { if (v && typeof v === "object" && v.id && (v.name || v.n)) lista.push(v); cerca(v, d + 1); }); return; }
      Object.keys(x).forEach(function (k) { cerca(x[k], d + 1); });
    })(j, 0);
    return lista;
  }
  // 1.1.0: indirizzo della richiesta "competitions" usata dal sito (per ripeterla in SOLO LEGA).
  // Conservato tra i ricaricamenti (da verificare nel test); ogni risposta passa comunque dalla validazione.
  var compsUrl = leggi("comps_url", "");
  function ricordaCompsUrl(url) {
    if (!url || String(url).indexOf(API) !== 0 || String(url) === compsUrl) return;
    compsUrl = String(url); scrivi("comps_url", compsUrl);
    log("COMPETIZIONI INDIRIZZO", percorsoDiag(compsUrl));
  }
  // percorso senza dominio e, della query, solo i nomi dei parametri (niente valori nella diagnosi)
  function percorsoDiag(url) {
    var s = String(url || "").replace(/^https?:\/\/[^\/]+/i, "");
    var q = s.indexOf("?");
    if (q < 0) return s;
    return s.slice(0, q) + "?" + s.slice(q + 1).split("&").map(function (p) { return p.split("=")[0]; }).join("&");
  }
  function compAperta() { var m = location.pathname.match(/\/competition\/(\d+)\//); return m ? Number(m[1]) : 0; }
  function diagCompetizioniSito(slug, cl, url, ok) {
    log("COMPETIZIONI SITO", { lega: slug || "", percorso: percorsoDiag(url), ricevute: cl.length, numeri: cl.map(function (c) { return c.id; }).slice(0, 12), attesa: compAperta(), esito: ok === true ? "valide" : ok === "attesa" ? "in attesa della pagina definitiva" : "non valide" });
  }
  // SOLO LEGA e SOLO FLE su FLE: copia separata destinata ai chip (ctl.comps non viene toccato ne riusato).
  function copiaCompetizioniFle(j, url) {
    try {
      var modoCopia = leggi("modo", "lega_fle");
      if (modoCopia !== "solo_lega" && modoCopia !== "solo_fle") return;
      var cl = competizioniLega(j);
      diagCompetizioniSito(FLE_SLUG, cl, url, salvaCompetizioni(FLE_SLUG, cl, "sito"));
    } catch (e) {}
  }
  // 1.1.0: salvo le competizioni di una lega SOLO se contengono la competizione aperta nell'indirizzo:
  // cosi quelle della lega precedente non possono mai finire sulla nuova.
  // Durante il cambio di lega il sito mostra per un attimo /<nuova lega>/competition/<id della lega precedente>:
  // in quel caso l'elenco resta "in attesa" e viene verificato sulla pagina definitiva della stessa lega.
  var compsInAttesa = null;
  function numeriComps(cl) { return cl.map(function (c) { return c.id; }).slice(0, 12); }
  function scriviCompetizioni(slug, cl, fonte, nota) {
    if (JSON.stringify(leggi("comps_" + slug, [])) !== JSON.stringify(cl)) {
      scrivi("comps_" + slug, cl);
      log("COMPETIZIONI LEGA", { lega: slug, fonte: fonte, esito: "salvate" + (nota ? " " + nota : ""), numeri: numeriComps(cl) });
    }
  }
  function salvaCompetizioni(slug, cl, fonte) {
    var mc = location.pathname.match(/^\/([^\/]+)\/view\/competition\/(\d+)\//);
    if (!slug || !cl.length || !mc || mc[1] !== slug) return false;
    var id = Number(mc[2]);
    if (!cl.some(function (c) { return c.id === id; })) {
      compsInAttesa = { slug: slug, cl: cl, fonte: fonte, at: Date.now(), compTransizione: id };
      log("COMPETIZIONI LEGA", { lega: slug, fonte: fonte, esito: "in attesa", motivo: "competizione aperta " + id + " non nell'elenco: verifico sulla pagina definitiva", numeri: numeriComps(cl) });
      return "attesa";
    }
    if (compsInAttesa && compsInAttesa.slug === slug) compsInAttesa = null;
    scriviCompetizioni(slug, cl, fonte, "");
    return true;
  }
  // Elenco in attesa: salvato solo se la pagina definitiva della STESSA lega apre una competizione dell'elenco.
  // Se la lega cambia, o dopo 15 s, o se la competizione definitiva non e nell'elenco: scartato.
  function verificaCompsInAttesa() {
    var p = compsInAttesa;
    if (!p) return;
    var mc = location.pathname.match(/^\/([^\/]+)\/view\/competition\/(\d+)\//);
    var scarta = function (motivo) { compsInAttesa = null; log("COMPETIZIONI LEGA", { lega: p.slug, fonte: p.fonte, esito: "scartate", motivo: motivo, numeri: numeriComps(p.cl) }); };
    if (Date.now() - p.at > 15000) return scarta("pagina definitiva non raggiunta in 15 s");
    if (!mc) return;
    if (mc[1] !== p.slug) return scarta("lega cambiata (" + mc[1] + ")");
    var id = Number(mc[2]);
    if (id === p.compTransizione) return;
    if (!p.cl.some(function (c) { return c.id === id; })) return scarta("manca la competizione definitiva " + id);
    compsInAttesa = null;
    scriviCompetizioni(p.slug, p.cl, p.fonte, "dopo il cambio di lega (competizione " + id + ")");
  }
  function competizioniDaApi(j, url) {
    try {
      if (suFle()) return;
      ricordaCompsUrl(url);
      var qui = slugDaPagina();
      var clSito = competizioniLega(j);
      diagCompetizioniSito(qui, clSito, url, qui ? salvaCompetizioni(qui, clSito, "sito") : false);
      var camp = listaCompetizioni(j).filter(function (c) { return /campionat/i.test(String(c.name || c.n || "")); })[0];
      var slug = slugDaPagina() || legaCorrente();
      if (camp && slug) {
        if (leggi("comp_" + slug, 0) !== Number(camp.id)) { scrivi("comp_" + slug, Number(camp.id)); log("COMPETIZIONE", { lega: slug, comp: Number(camp.id), da: "api" }); }
        impostaLega(slug);
        controllaPagina();
      }
    } catch (e) {}
  }

  // ---------------------------------------------------------------- nomi e ruoli dei giocatori
  var info = {};
  function numeroRuolo(v) {
    if (Array.isArray(v)) v = v[0];
    if (typeof v === "number") return v >= 1 && v <= 4 ? v : 0;
    var s = String(v || "").toLowerCase().trim();
    if (/^1$|^p$|portier|goalkeeper/.test(s)) return 1;
    if (/^2$|^d$|difensor|defender/.test(s)) return 2;
    if (/^3$|^c$|centrocamp|midfield/.test(s)) return 3;
    if (/^4$|^a$|attacc|forward|striker/.test(s)) return 4;
    return 0;
  }
  function idDi(v) {
    if (v && typeof v === "object") return Number(v.pid != null ? v.pid : v.playerId != null ? v.playerId : v.idplayer != null ? v.idplayer : v.idPlayer != null ? v.idPlayer : v.id || 0);
    return Number(v || 0);
  }
  function ricorda(p) {
    try {
      if (!p || typeof p !== "object") return;
      var n2 = p.player && typeof p.player === "object" ? p.player : null;
      var pid = Number(p.pid || p.playerId || p.idplayer || p.idPlayer || (n2 && (n2.pid || n2.id)) || p.id || 0);
      if (!pid) return;
      var nome = String(p.plyr || p.playerName || p.displayName || p.nome || (n2 && (n2.name || n2.playerName)) || p.name || "").trim();
      var ruolo = numeroRuolo(p.role != null ? p.role : p.roleId != null ? p.roleId : p.positionId != null ? p.positionId : p.position != null ? p.position : n2 && (n2.role || n2.roleId));
      var squadra = String(p.tname || p.team || p.teamName || "").trim();
      var flag = Number(p.status || 0) === 2 ? "INFORTUNATO" : Number(p.status || 0) === 3 ? "SQUALIFICATO" : "";
      if (!nome && !ruolo) return;
      var vecchio = info[pid] || {};
      info[pid] = { n: nome || vecchio.n || "", r: ruolo || vecchio.r || 0, c: squadra || vecchio.c || "", f: flag || vecchio.f || "" };
    } catch (e) {}
  }
  function raccogli(x, d, visti) {
    if (!x || typeof x !== "object" || d > 8) return;
    try { if (visti.has(x)) return; visti.add(x); } catch (e) {}
    if (Array.isArray(x)) { x.forEach(function (v) { if (v && typeof v === "object" && !Array.isArray(v)) ricorda(v); raccogli(v, d + 1, visti); }); return; }
    Object.keys(x).forEach(function (k) { raccogli(x[k], d + 1, visti); });
  }

  // ---------------------------------------------------------------- dati letti dal sito (FLE)
  var ctl = { hdr: null, hdrScore: 0, comps: null, status: null, payload: null, inCorso: false };
  function eApi(u) { return String(u || "").indexOf("apileague.fantacalcio.it") >= 0; }
  function tieniIntestazioni(u, h) {
    if (!eApi(u) || !h || !Object.keys(h).length) return;
    var metodo = arguments[2]; // PROVA11: metodo della richiesta del sito (terzo argomento facoltativo; inizio della funzione invariato)
    var s = String(u);
    var punti = (s.indexOf("/league/competition") >= 0 || s.indexOf("/league/status") >= 0 || s.indexOf("/gaming/") >= 0) ? 3 : s.indexOf("/league/") >= 0 ? 2 : 1;
    if (!ctl.hdr || punti >= ctl.hdrScore) { ctl.hdr = h; ctl.hdrScore = punti; ctl.hdrFrom = s.split("?")[0].replace(API, ""); }
    // PROVA11: intestazioni per le LETTURE di FVM prese solo dalle letture del sito (GET/HEAD), mai dal salvataggio (PUT/POST)
    var m = String(metodo || "").toUpperCase();
    if ((m === "GET" || m === "HEAD") && (!ctl.hdrLettura || punti >= (ctl.hdrLetturaScore || 0))) { ctl.hdrLettura = h; ctl.hdrLetturaScore = punti; ctl.hdrLetturaFrom = m + " " + s.split("?")[0].replace(API, ""); }
    // 1.3.5-RC: senza identita valida in questa scheda, dopo le prime letture del sito (la risposta del sito al profilo ha la precedenza)
    if ((m === "GET" || m === "HEAD") && !identitaAttuale() && !ctl.identitaChiesta && !ctl.identitaProgrammata) { ctl.identitaProgrammata = true; setTimeout(function () { verificaIdentita("letture del sito"); }, 2500); }
  }
  function trovaPayload(x, d) {
    if (!x || typeof x !== "object" || d > 7) return null;
    if (x.teamLineupDto && Array.isArray(x.lineUpInfo)) return x;
    var vals = Array.isArray(x) ? x : Object.keys(x).map(function (k) { return x[k]; });
    for (var i = 0; i < vals.length; i++) { var r = trovaPayload(vals[i], d + 1); if (r) return r; }
    return null;
  }
  function esaminaRisposta(testo, url) {
    try {
      if (typeof testo !== "string" || testo.length > 3000000) return;
      var c = testo.trim().charAt(0);
      if (c !== "{" && c !== "[") return;
      var j = JSON.parse(testo);
      raccogli(j, 0, new WeakSet());
      var p = String(url || "").split("?")[0];
      if (/league\/competitions$/i.test(p)) { if (suFle()) { ctl.comps = listaCompetizioni(j).concat([]); copiaCompetizioniFle(j, url); } else competizioniDaApi(j, url); }
      if (/league\/status$/i.test(p) && suFle()) ctl.status = j && j.data ? j.data : j;
      if (suFle() && testo.indexOf("teamLineupDto") >= 0) {
        var pl = trovaPayload(j, 0);
        if (pl) {
          var dto = pl.teamLineupDto || {};
          ctl.payload = { comp: Number(dto.idcomp || 0), tid: Number(dto.tid || 0), mday: dto.mday, cmday: dto.cmday, ids: (pl.lineUpInfo || []).map(function (x) { return Number(x && x.pid); }).filter(Boolean),
            sw: fvmSwLeggi(dto, "fle") }; // PROVA8: Switch della formazione FLE della pagina (stessa risposta, nessuna richiesta in piu)
          ctl.payloadDto = dto; // PROVA11: formazione ufficiale letta DAL SITO (usata da RIPROVA VERIFICA, nessuna richiesta in piu)
          var fNota = leggi("fle", {}) || {};
          if (!Number(fNota.comp || 0) && ctl.payload.comp) { fNota.comp = ctl.payload.comp; scrivi("fle", fNota); log("COMPETIZIONE FLE", { comp: ctl.payload.comp, da: "campo FLE" }); }
          try { guardiaCampoFle(); } catch (e) {} // 1.3.5: SOLO FLE / MODIFICA SU FLE con squadra diversa = pagina chiusa
          try { guardiaCampoFleFc(); } catch (e) {} // PROVA12: da Fantaclub = salvataggio bloccato, pagina aperta
        }
      }
      // 1.3.5-RC2 VERIFICA SQUADRA FLE, fase FLE: squadra dell'account nella pagina formazione FLE (solo tid e competizione)
      if (suFle() && testo.indexOf("teamLineupDto") >= 0) {
        var tF = taskVerifica();
        if (tF && tF.fase === "lineup") verificaFleDaRisposta(j, p, tF);
      }
      // 1.3.5 VERIFICA SQUADRA FLE, fase lega: squadra dell'account nella pagina formazione della lega (solo tid e competizione)
      if (!suFle() && testo.indexOf("teamLineupDto") >= 0) {
        var tV = taskVerifica();
        if (tV && tV.fase === "lega") {
          var dV = trovaDto(j, 0), mP = location.pathname.match(/\/view\/competition\/(\d+)\/lineup/), compP = mP ? Number(mP[1]) : 0;
          if (dV && Number(dV.tid) && (!compP || !Number(dV.idcomp) || Number(dV.idcomp) === compP)) ctl.payloadLega = { tid: Number(dV.tid), comp: Number(dV.idcomp || 0) };
        }
      }
    } catch (e) {}
  }

  // ---------------------------------------------------------------- formazione FLE (stesse regole dell'app)
  function sorgente(u) {
    function pl(pid, i, k) { var x = (u.nomi && u.nomi[pid]) || {}; return { pid: pid, flePid: pid, name: x.n || String(pid), role: Number(x.r || 0), key: k + ":" + pid }; }
    return { module: u.modulo, starts: u.titolari.map(function (p, i) { return pl(p, i, "s"); }), bench: u.panchina.map(function (p, i) { return pl(p, i, "b"); }) };
  }
  // PROVA12: moduli ammessi dal regolamento FLE 2026-27 (3-4-3, 4-3-3, 4-4-2, 3-5-2, 5-3-2, 4-5-1, 5-4-1)
  function moduliFle() { return ["343", "433", "442", "352", "532", "451", "541"]; }
  function costruisciFle(source, fle, choices) {
    choices = choices || {};
    var byPid = {};
    fle.forEach(function (p) { byPid[Number(p.pid)] = p; });
    function asFle(pid, extra) { var p = byPid[Number(pid)]; return Object.assign({ pid: Number(p.pid), name: p.name, role: Number(p.role || 0), flag: p.flag || "" }, extra || {}); }
    function valid(pid, role, used) { var p = byPid[Number(pid)]; return !!p && !used[Number(pid)] && (!role || Number(p.role) === Number(role)); }
    var items = [], used = {};
    var starts = source.starts.map(function () { return null; });
    source.starts.forEach(function (sp, i) {
      if (byPid[sp.flePid] && !used[sp.flePid]) { starts[i] = asFle(sp.flePid, { from: sp.name }); used[sp.flePid] = true; }
    });
    source.starts.forEach(function (sp, i) {
      if (starts[i]) return;
      var role = Number(sp.role || 0);
      var chosen = Number(choices[sp.key] || 0);
      var item = { key: sp.key, kind: "start", index: i, role: role, source: sp, chosen: 0, required: true };
      if (chosen && valid(chosen, role, used)) { starts[i] = asFle(chosen, { sub: true, from: sp.name }); used[chosen] = true; item.chosen = chosen; }
      else if (chosen) item.scartata = chosen; // PROVA12: scelta (anche ricordata) non piu valida sui 25 FLE attuali: si sceglie di nuovo
      items.push(item);
    });
    var startIds = {};
    starts.forEach(function (p) { if (p) startIds[p.pid] = true; });
    var got = { 1: [], 2: [], 3: [], 4: [] };
    // PROVA12: panchinari della lega che NON entrano nella panchina FLE, con il motivo (solo informazione: l'adattamento e quello di sempre)
    var esclusi = [];
    source.bench.forEach(function (sp, i) {
      var mapped = byPid[sp.flePid];
      if (mapped) {
        if (used[mapped.pid]) { esclusi.push({ name: sp.name, role: Number(mapped.role || 0), ord: i, motivo: "già in formazione" }); return; }
        var r = Number(mapped.role);
        if (NEED[r] && got[r].length < NEED[r]) { got[r].push(asFle(mapped.pid, { from: sp.name, ord: i })); used[mapped.pid] = true; }
        else esclusi.push({ name: sp.name, role: r, ord: i, motivo: NEED[r] ? "ruolo già completo" : "ruolo non riconosciuto" });
        return;
      }
      var r2 = Number(sp.role || 0);
      if (r2 && got[r2].length >= NEED[r2]) { esclusi.push({ name: sp.name, role: r2, ord: i, motivo: "non nei tuoi 25 FLE, ruolo già completo" }); return; }
      var chosen = Number(choices[sp.key] || 0);
      var item = { key: sp.key, kind: "bench", index: i, role: r2, source: sp, chosen: 0, required: false };
      if (chosen && valid(chosen, r2, used)) {
        var rr = Number(byPid[chosen].role);
        if (got[rr].length < NEED[rr]) { got[rr].push(asFle(chosen, { sub: true, from: sp.name, ord: i })); used[chosen] = true; item.chosen = chosen; }
        else item.scartata = chosen;
      } else if (chosen) item.scartata = chosen;
      items.push(item);
    });
    [1, 2, 3, 4].forEach(function (r) {
      var deficit = NEED[r] - got[r].length;
      if (deficit <= 0) return;
      items.forEach(function (it) {
        if (deficit <= 0) return;
        if (it.kind === "bench" && !it.chosen && (it.role === r || !it.role)) { it.required = true; it.role = it.role || r; deficit--; }
      });
      for (var k = 0; k < deficit; k++) {
        var key = "add:" + r + ":" + k;
        var chosen = Number(choices[key] || 0);
        var item = { key: key, kind: "add", index: k, role: r, source: null, chosen: 0, required: true };
        if (chosen && valid(chosen, r, used)) { got[r].push(asFle(chosen, { sub: true, ord: 1000 + r * 10 + k })); used[chosen] = true; item.chosen = chosen; }
        else if (chosen) item.scartata = chosen;
        items.push(item);
      }
    });
    var bench = got[1].concat(got[2], got[3], got[4]).sort(function (a, b) { return Number(a.ord == null ? 9999 : a.ord) - Number(b.ord == null ? 9999 : b.ord); });
    var benchIds = {};
    bench.forEach(function (p) { benchIds[p.pid] = true; });
    var missing = [];
    [1, 2, 3, 4].forEach(function (r) { if (got[r].length < NEED[r]) missing.push(RUOLI[r] + " " + got[r].length + "/" + NEED[r]); });
    items.forEach(function (it) {
      it.candidates = fle
        .filter(function (p) { return !it.role || Number(p.role) === Number(it.role); })
        .filter(function (p) { var id = Number(p.pid); return id === it.chosen || (it.kind === "start" ? !startIds[id] : (!startIds[id] && !benchIds[id])); })
        .map(function (p) { return { pid: Number(p.pid), name: p.name, role: Number(p.role), flag: p.flag || "", inBench: !!benchIds[Number(p.pid)] && Number(p.pid) !== it.chosen }; })
        .sort(function (a, b) { return (a.flag ? 1 : 0) - (b.flag ? 1 : 0) || (a.inBench ? 1 : 0) - (b.inBench ? 1 : 0) || String(a.name).localeCompare(String(b.name)); });
    });
    var finalStarts = starts.filter(Boolean);
    var pending = items.filter(function (it) { return it.required && !it.chosen; });
    var mod = String(source.module || "").replace(/[^0-9]/g, "");
    var moduleProblem = "";
    if (mod.length === 3 && finalStarts.length === 11) {
      var c = { 1: 0, 2: 0, 3: 0, 4: 0 };
      finalStarts.forEach(function (p) { c[p.role] = (c[p.role] || 0) + 1; });
      var want = { 1: 1, 2: Number(mod[0]), 3: Number(mod[1]), 4: Number(mod[2]) };
      if ([1, 2, 3, 4].some(function (r) { return c[r] !== want[r]; })) moduleProblem = "Ruoli dei titolari " + c[1] + "P " + c[2] + "D " + c[3] + "C " + c[4] + "A: non corrispondono al modulo " + mod.split("").join("-") + ".";
    }
    // PROVA12: FLE ammette solo i 7 moduli del regolamento (come Android ALLOWED_MODULES): fuori elenco = nessun invio
    if (!moduleProblem && moduliFle().indexOf(mod) < 0) moduleProblem = mod.length === 3
      ? "Modulo " + mod.split("").join("-") + " non ammesso su FLE (ammessi: " + moduliFle().map(function (m) { return m.split("").join("-"); }).join(", ") + "): nessun invio a FLE. Cambia modulo nella tua lega e salva di nuovo."
      : "Modulo della formazione non riconosciuto: FLE ammette solo " + moduliFle().map(function (m) { return m.split("").join("-"); }).join(", ") + ". Nessun invio a FLE.";
    esclusi.sort(function (a, b) { return a.ord - b.ord; });
    return {
      module: source.module, starts: finalStarts, bench: bench, items: items, pending: pending, missing: missing, moduleProblem: moduleProblem, esclusi: esclusi,
      complete: finalStarts.length === 11 && bench.length === 11 && !pending.length && !missing.length && !moduleProblem
    };
  }
  function trovaFleTid(tidLega) {
    var hit = SQUADRE.filter(function (t) { return t[3] && Number(t[3]) === Number(tidLega); })[0];
    return hit ? { fleTid: Number(hit[2]), squadra: hit[1], lega: hit[0] } : null;
  }
  function sceltePerTid(fleTid) {
    var tutte = leggi("scelte", {});
    var mie = tutte[fleTid] || {};
    var ora2 = Date.now(), out = {};
    Object.keys(mie).forEach(function (k) { if (mie[k] && mie[k].pid && new Date(mie[k].until || 0).getTime() > ora2) out[k] = Number(mie[k].pid); });
    return out;
  }
  function ricordaScelta(fleTid, key, pid) {
    var tutte = leggi("scelte", {});
    var mie = tutte[fleTid] || {};
    var d = new Date();
    var y = d.getMonth() >= 1 ? d.getFullYear() + 1 : d.getFullYear();
    mie[key] = { pid: pid, until: new Date(y, 1, 1).toISOString() };
    tutte[fleTid] = mie;
    scrivi("scelte", tutte);
  }
  function risultatoFle() {
    var u = formazioneSorgente(), f = leggi("fle", null);
    if (!u || !u.titolari || !f || !f.roster) return null;
    // 1.1.0 Fantaclub: la rosa FLE deve venire da un controllo fatto per la formazione Fantaclub
    if (u.fonte === "fantaclub" && f.fonte !== "fantaclub") return null;
    // PROVA12: una scelta presa dalla memoria (non fatta in questo controllo) e indicata come RICORDATA, con scadenza, e si puo annullare
    var mem = scelteRicordateInfo(f.tid), oggi = f.choices || {};
    var res = costruisciFle(u.fonte === "fantaclub" ? sorgenteFc(u, f.roster) : sorgente(u), f.roster, Object.assign({}, sceltePerTid(f.tid), oggi));
    res.items.forEach(function (it) {
      var m = mem[it.key];
      if (!m || Object.prototype.hasOwnProperty.call(oggi, it.key)) return;
      if (it.chosen && Number(it.chosen) === Number(m.pid)) { it.ricordata = true; it.ricordataFino = m.until; }
      if (it.scartata && Number(it.scartata) === Number(m.pid)) { it.scartataRicordata = true; it.ricordataFino = m.until; }
    });
    return res;
  }
  // PROVA12: scelte ricordate ancora valide (non scadute) di una squadra FLE, con la data di scadenza
  function scelteRicordateInfo(fleTid) {
    var mie = (leggi("scelte", {}) || {})[fleTid] || {}, ora2 = Date.now(), out = {};
    Object.keys(mie).forEach(function (k) { if (mie[k] && mie[k].pid && new Date(mie[k].until || 0).getTime() > ora2) out[k] = { pid: Number(mie[k].pid), until: mie[k].until }; });
    return out;
  }
  // PROVA12: DIMENTICA LE SCELTE RICORDATE della squadra FLE (solo memoria di FVM: nessun salvataggio, nessun invio)
  function dimenticaScelteRicordate(fleTid) {
    var tutte = leggi("scelte", {}) || {}, n = Object.keys(tutte[fleTid] || {}).length;
    delete tutte[fleTid];
    scrivi("scelte", tutte);
    // le scelte fatte in QUESTO controllo restano (sono visibili come «scelto ✓»); tornano da scegliere solo quelle ricordate
    log("SCELTE RICORDATE", { azione: "dimenticate", squadra: Number(fleTid) || 0, quante: n });
    return n;
  }
  // 1.1.0 Fantaclub: formazione sorgente della piattaforma scelta. Leghe: "ultima" com'e sempre stata.
  // Fantaclub: la formazione consegnata, con titolari/panchina come elenchi di nomi.
  function formazioneSorgente() {
    if (piattaformaScelta() !== "fantaclub") return leggi("ultima", null);
    var c = leggi("fc_ultima", null);
    if (!c) return null;
    // squadra e ID FLE SOLO se lega + squadra + ID FLE corrispondono (altrimenti nessun controllo/invio FLE)
    var valido = abbinamentoFcValido(c);
    return { ok: true, fonte: "fantaclub", at: c.at, modulo: c.modulo, titolari: c.titolari || [], panchina: c.panchina || [], squadra: valido ? c.squadra : "", fleTid: valido ? Number(c.fleTid) : 0, lega: c.lega || "", nl: c.nl || "" };
  }

  // ---------------------------------------------------------------- 1.1.0 Fantaclub fase 8: abbinamento ai 25 FLE
  // Fantaclub non usa gli ID di Fantacalcio: collego per nome, squadra e ruolo (porting di matchFantaclubToFle,
  // nameScore, pickUnique, club3 di Android fleSubstitutions.js). Un collegamento vale solo se netto.
  function normFc(s) {
    return String(s == null ? "" : s).normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase()
      .replace(/[’']/g, " ").replace(/[-.]/g, " ").replace(/[^A-Z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
  }
  var CLUB3 = { ATALANTA: "ATA", BOLOGNA: "BOL", CAGLIARI: "CAG", COMO: "COM", FIORENTINA: "FIO", FROSINONE: "FRO", GENOA: "GEN", INTER: "INT", JUVENTUS: "JUV", LAZIO: "LAZ", LECCE: "LEC", MILAN: "MIL", MONZA: "MON", NAPOLI: "NAP", PARMA: "PAR", ROMA: "ROM", SASSUOLO: "SAS", TORINO: "TOR", UDINESE: "UDI", VENEZIA: "VEN", VERONA: "VER", "HELLAS VERONA": "VER", EMPOLI: "EMP", PISA: "PIS", CREMONESE: "CRE", SALERNITANA: "SAL", SAMPDORIA: "SAM", SPEZIA: "SPE", PALERMO: "PAL", BARI: "BAR" };
  function club3(c) { var n = normFc(c); if (!n) return ""; return n.length === 3 ? n : (CLUB3[n] || n.slice(0, 3)); }
  function punteggioNome(src, dst) {
    var A = normFc(src).split(" ").filter(Boolean), B = normFc(dst).split(" ").filter(Boolean);
    var ac = A.join(""), bc = B.join("");
    if (!ac || !bc) return 0;
    if (ac === bc) return 140;
    var s = 0;
    A.forEach(function (a) { B.forEach(function (b) { if (a === b && a.length >= 3) s = Math.max(s, 120 + Math.min(a.length, 12)); }); });
    if (s) {
      // iniziali / nomi abbreviati ("L. Martinez" = "Lautaro Martinez")
      A.forEach(function (a) { B.forEach(function (b) { if (a === b) return; var m = Math.min(a.length, b.length); if (m >= 1 && m <= 4 && (a.indexOf(b) === 0 || b.indexOf(a) === 0)) s += Math.min(8, m + 2); }); });
      return s;
    }
    if (ac.indexOf(bc) >= 0 || bc.indexOf(ac) >= 0) return 100;
    return 0;
  }
  // "valido solo se netto": il migliore deve superare 100 e staccare il secondo (pari merito = ambiguo)
  function sceltaNetta(lista) {
    var a = lista[0], b = lista[1];
    if (!a || a.s < 100) return { p: null, ambiguo: false };
    if (b && b.s >= a.s) return { p: null, ambiguo: true };
    return { p: a, ambiguo: false };
  }
  function abbinaFantaclub(giocatori, rosa) {
    var res = giocatori.map(function (p) {
      var ruolo = Number(p.role || 0);
      var classifica = function (l) {
        return l.map(function (x) { return { p: x, s: punteggioNome(p.name, x.name) }; }).filter(function (x) { return x.s > 0; })
          .sort(function (a, b) { return b.s - a.s || String(a.p.name).localeCompare(String(b.p.name)); });
      };
      var fc3 = club3(p.club);
      var stessoClub = rosa.filter(function (x) { return !fc3 || !x.club || club3(x.club) === fc3; });
      var r = { p: null, ambiguo: false }, metodo = "", ambiguo = false;
      if (ruolo) { r = sceltaNetta(classifica(stessoClub.filter(function (x) { return Number(x.role) === ruolo; }))); ambiguo = ambiguo || r.ambiguo; if (r.p) metodo = "NOME + SQUADRA + RUOLO"; }
      if (!r.p) { r = sceltaNetta(classifica(stessoClub)); ambiguo = ambiguo || r.ambiguo; if (r.p) metodo = "NOME + SQUADRA"; }
      if (!r.p) {
        // squadra cambiata o scritta diversa: solo cognome esatto (>=120) e netto
        r = sceltaNetta(classifica(rosa.filter(function (x) { return !ruolo || Number(x.role) === ruolo; })).filter(function (x) { return x.s >= 120; }));
        ambiguo = ambiguo || r.ambiguo; if (r.p) metodo = "NOME + RUOLO (SQUADRA DIVERSA)";
      }
      return { flePid: r.p ? Number(r.p.p.pid) : 0, score: r.p ? r.p.s : 0, metodo: metodo || (ambiguo ? "AMBIGUO" : "NON NEI 25 FLE") };
    });
    // due giocatori sullo stesso FLE: tengo il punteggio piu alto, l'altro va sostituito
    var perPid = {};
    res.forEach(function (r, i) {
      if (!r.flePid) return;
      var j = perPid[r.flePid];
      if (j === undefined) { perPid[r.flePid] = i; return; }
      var perde = res[j].score >= r.score ? i : j;
      if (perde === j) perPid[r.flePid] = i;
      res[perde] = { flePid: 0, score: 0, metodo: "DOPPIO" };
    });
    return res;
  }
  // formazione Fantaclub -> sorgente per costruisciFle. I titolari arrivano in ordine P, D, C, A: il ruolo viene dal
  // modulo. La panchina Fantaclub e libera (senza ruoli): i ruoli veri li da la rosa FLE dopo il collegamento.
  function sorgenteFc(u, rosa) {
    var mod = String(u.modulo || "").replace(/\D/g, "");
    var seq = mod.length === 3 ? [1].concat(Array(Number(mod[0])).fill(2), Array(Number(mod[1])).fill(3), Array(Number(mod[2])).fill(4)) : [];
    var gioc = u.titolari.map(function (p, i) { return { name: p.n, club: p.c, role: seq[i] || 0, start: true }; })
      .concat(u.panchina.map(function (p) { return { name: p.n, club: p.c, role: 0, start: false }; }));
    var abb = abbinaFantaclub(gioc, rosa || []);
    var sp = gioc.map(function (g, i) {
      return { key: "fc:" + normFc(g.name) + "|" + club3(g.club), name: g.name, role: g.role, club: g.club, flePid: abb[i].flePid, metodo: abb[i].metodo,
        nota: abb[i].flePid ? "" : abb[i].metodo === "AMBIGUO" ? "nome ambiguo nei 25 FLE" : abb[i].metodo === "DOPPIO" ? "collegato due volte" : "" };
    });
    return { module: mod, starts: sp.filter(function (x, i) { return gioc[i].start; }), bench: sp.filter(function (x, i) { return !gioc[i].start; }), collegati: abb.filter(function (r) { return r.flePid; }).length, totale: gioc.length };
  }

  // ---------------------------------------------------------------- 1.3.5-PROVA8 · SWITCH di Leghe Fantacalcio
  // Dati reali (log Android 30/09 e 01/10, ricognizione Leghe 9/10): il corpo del salvataggio e il teamLineupDto hanno
  // swtcA e swtcB (pid dei due giocatori), swtc, swtcMdl e pos. PRESENTE = swtcA e swtcB diversi da 0; ASSENTE = entrambi 0.
  // swtc e pos: significato NON noto, mai dedotto. I 5 campi si leggono e si scrivono SEMPRE insieme e da UNA sola fonte.
  // Rispetto alla giornata di destinazione (giornata di Serie A: cmday, riferimento FLE league/status.mday) uno Switch puo
  // essere anche PRECEDENTE (giornata piu vecchia o formazione "Recuperata dal Server", act 4) o INCOMPATIBILE (giocatori
  // non presenti nella formazione FLE). Stato SCONOSCIUTO = nessuna scrittura automatica: l'invio si ferma e lo spiega.
  function fvmSwCampi() { return ["swtcA", "swtcB", "swtc", "swtcMdl", "pos"]; }
  function fvmSwNum(v) { var n = Number(v); return isFinite(n) && n > 0 ? Math.floor(n) : 0; }
  function fvmSwModulo(m) { return String(m == null ? "" : m).replace(/\D/g, ""); }
  // oggetto formazione (corpo del salvataggio o teamLineupDto) -> Switch letto + formazione a cui appartiene
  function fvmSwLeggi(o, fonte) {
    if (!o || typeof o !== "object") return { stato: "sconosciuto", motivo: "dati della formazione assenti", fonte: String(fonte || ""), valori: {} };
    var s = { fonte: String(fonte || ""), tid: fvmSwNum(o.tid), comp: fvmSwNum(o.idcomp != null ? o.idcomp : o.comp), mday: fvmSwNum(o.mday), cmday: fvmSwNum(o.cmday),
      act: o.act == null || o.act === "" ? null : Number(o.act), ldate: String(o.ldate || "").slice(0, 20), valori: {}, a: 0, b: 0 };
    fvmSwCampi().forEach(function (k) { if (Object.prototype.hasOwnProperty.call(o, k)) s.valori[k] = o[k]; });
    if (!("swtcA" in s.valori) || !("swtcB" in s.valori)) { s.stato = "sconosciuto"; s.motivo = "campi Switch assenti nei dati"; return s; }
    var a = Number(o.swtcA == null ? 0 : o.swtcA), b = Number(o.swtcB == null ? 0 : o.swtcB);
    if (!isFinite(a) || !isFinite(b) || a < 0 || b < 0) { s.stato = "sconosciuto"; s.motivo = "valori Switch non riconosciuti"; return s; }
    s.a = fvmSwNum(a); s.b = fvmSwNum(b);
    if (!s.a && !s.b) { s.stato = "assente"; return s; }
    if (!s.a || !s.b) { s.stato = "sconosciuto"; s.motivo = "Switch incompleto (un solo giocatore)"; return s; }
    if (s.a === s.b) { s.stato = "sconosciuto"; s.motivo = "Switch con lo stesso giocatore due volte"; return s; }
    // presente: servono tutti e 5 i campi (come nei salvataggi reali con Switch), altrimenti si mescolerebbero fonti diverse
    if (fvmSwCampi().some(function (k) { return !(k in s.valori); })) { s.stato = "sconosciuto"; s.motivo = "Switch con campi incompleti"; return s; }
    s.stato = "presente";
    return s;
  }
  // testo (o oggetto) di una risposta o di un corpo di salvataggio -> Switch letto
  function fvmSwDaTesto(t, fonte) {
    var j = t;
    if (typeof t === "string") { try { j = JSON.parse(t); } catch (e) { return fvmSwLeggi(null, fonte); } }
    var dto = j && typeof j === "object" && j.teamLineupDto && typeof j.teamLineupDto === "object" ? j.teamLineupDto : trovaFormazione(j, 0);
    return fvmSwLeggi(dto, fonte);
  }
  function fvmSwImpronta(s) { return !s ? "?" : s.stato === "presente" ? "P" + s.a + "-" + s.b + "-" + fvmSwModulo(s.valori.swtcMdl) : s.stato === "assente" ? "A" : "?"; }
  function fvmSwStesso(x, y) { return !!(x && y && x.stato === "presente" && y.stato === "presente" && x.a === y.a && x.b === y.b && fvmSwModulo(x.valori.swtcMdl) === fvmSwModulo(y.valori.swtcMdl)); }
  function fvmSwMancanti(s, starts, bench) {
    if (!s || s.stato !== "presente") return [];
    var ids = (starts || []).concat(bench || []).map(Number);
    return [s.a, s.b].filter(function (p) { return ids.indexOf(p) < 0; });
  }
  function fvmSwCompatibile(s, starts, bench) { return !!(s && s.stato === "presente" && !fvmSwMancanti(s, starts, bench).length); }
  // Switch su FLE rispetto alla destinazione: presente (giornata corrente) / assente / precedente / sconosciuto
  function fvmSwStatoFle(fle, dest, target) {
    dest = dest || {};
    if (!fle || fle.stato === "sconosciuto") return "sconosciuto";
    if (!fle.tid || fle.tid !== fvmSwNum(dest.tid) || !fle.comp || fle.comp !== fvmSwNum(dest.comp)) return "sconosciuto";
    if (fle.stato === "assente") return "assente";
    if (fle.act === 4) return "precedente";
    target = fvmSwNum(target);
    if (!target || !fle.cmday) return "sconosciuto";
    if (fle.cmday < target) return "precedente";
    if (fle.cmday > target) return "sconosciuto";
    return "presente";
  }
  // Switch della lega di origine (gia legato alla SUA formazione): presente / assente / precedente / sconosciuto / non_applicabile
  function fvmSwStatoLega(lega, fonte, target) {
    if (fonte === "fantaclub") return "non_applicabile";
    if (!lega || lega.stato === "sconosciuto") return "sconosciuto";
    target = fvmSwNum(target);
    if (lega.act === 4) return "precedente";
    if (target && lega.cmday && lega.cmday < target) return "precedente";
    if (target && lega.cmday && lega.cmday > target) return "sconosciuto";
    return lega.stato;
  }
  // DECISIONE (pura). o = { fonte: "leghe"|"fantaclub", lega, fle, target, dest: {tid, comp, starts, bench, mdl}, scelta: {azione, situazione} }
  // scrittura: "lega" (copia dalla lega) | "fle" (mantiene quello letto su FLE) | "assente" (nessuno Switch) | "nessuna".
  // obbligatoria = serve una scelta dell'utente PRIMA dell'invio; blocca = l'invio automatico non deve partire.
  function fvmSwDecidi(o) {
    o = o || {};
    var dest = o.dest || {}, target = fvmSwNum(o.target), L = fvmSwStatoLega(o.lega, o.fonte, target), F = fvmSwStatoFle(o.fle, dest, target);
    var lc = L === "presente" && fvmSwCompatibile(o.lega, dest.starts, dest.bench), fc = F === "presente" && fvmSwCompatibile(o.fle, dest.starts, dest.bench);
    var d = { lega: L, fle: F, legaCompat: lc, fleCompat: fc, caso: "", opzioni: [], evidenzia: "", predefinita: "", obbligatoria: false, blocca: false, motivo: "",
      scelta: null, azione: "", scrittura: "nessuna", posSoloSePresente: false, flePrecedentePresente: !!(F === "precedente" && o.fle && o.fle.stato === "presente"),
      mancantiLega: L === "presente" ? fvmSwMancanti(o.lega, dest.starts, dest.bench) : [], mancantiFle: F === "presente" ? fvmSwMancanti(o.fle, dest.starts, dest.bench) : [] };
    d.situazione = [target, fvmSwNum(dest.tid), fvmSwNum(dest.comp), L + ":" + fvmSwImpronta(o.lega) + (lc ? "+" : "-"), F + ":" + fvmSwImpronta(o.fle) + (fc ? "+" : "-")].join("|");
    if (F === "sconosciuto") { d.caso = "fle_non_verificabile"; d.blocca = true; d.motivo = "fle_non_verificabile"; return d; }
    if (F === "assente" || F === "precedente") {
      // su FLE nessuno Switch per QUESTA giornata: si riporta quello della lega se compatibile, altrimenti nessuno
      // (uno Switch di una giornata precedente non viene MAI trasferito alla nuova giornata)
      if (lc) { d.caso = "copia"; d.scrittura = "lega"; }
      else { d.caso = L === "presente" ? "lega_incompatibile" : L === "sconosciuto" ? "lega_non_letta" : L === "precedente" ? "lega_precedente" : "nessuno"; d.scrittura = "assente"; d.posSoloSePresente = true; }
      return d;
    }
    // su FLE c'e uno Switch della giornata corrente
    if (lc && fvmSwStesso(o.lega, o.fle)) { d.caso = "uguale"; d.scrittura = "lega"; return d; }
    if (lc) { d.caso = "conflitto"; d.opzioni = fc ? ["lega", "modifica", "mantieni"] : ["lega", "modifica", "elimina"]; d.evidenzia = "lega"; d.obbligatoria = true; }
    else if (fc) { d.caso = "fle_presente"; d.opzioni = ["modifica", "mantieni", "elimina"]; d.evidenzia = "modifica"; d.predefinita = "mantieni"; }
    else { d.caso = "fle_incompatibile"; d.opzioni = ["modifica", "elimina"]; d.evidenzia = "modifica"; d.obbligatoria = true; }
    // la scelta vale solo per la STESSA situazione (giornata, squadra, competizione, Switch della lega e di FLE, compatibilita)
    var s = o.scelta && o.scelta.situazione === d.situazione && d.opzioni.indexOf(o.scelta.azione) >= 0 ? o.scelta.azione : "";
    d.scelta = s || null;
    var az = s || (d.obbligatoria ? "" : d.predefinita);
    if (!az) { d.blocca = true; d.motivo = "scelta_mancante"; return d; }
    d.azione = az;
    d.scrittura = az === "lega" ? "lega" : az === "mantieni" ? "fle" : az === "elimina" ? "assente" : (fc ? "fle" : "assente");
    if (d.scrittura === "assente") d.posSoloSePresente = true;
    return d;
  }
  // valori da scrivere (tutti da UNA sola fonte). "assente" = come i salvataggi reali senza Switch: 0, 0, 0, modulo; pos 0
  // solo se il corpo lo contiene gia (i salvataggi reali senza Switch non hanno pos).
  function fvmSwValori(d, o) {
    o = o || {};
    var copia = function (s) { var v = {}; fvmSwCampi().forEach(function (k) { if (s && s.valori && k in s.valori) v[k] = s.valori[k]; }); return v; };
    if (!d) return null;
    if (d.scrittura === "lega") return copia(o.lega);
    if (d.scrittura === "fle") return copia(o.fle);
    if (d.scrittura === "assente") return { swtcA: 0, swtcB: 0, swtc: 0, swtcMdl: String(o.mdl == null ? "" : o.mdl), pos: 0 };
    return null;
  }
  // scrive i valori nel corpo del salvataggio FLE (stesso tipo dei campi gia presenti); ritorna i campi scritti
  function fvmSwScrivi(o, v, posSoloSePresente) {
    if (!o || !v) return [];
    var scritti = [];
    fvmSwCampi().forEach(function (k) {
      if (!(k in v)) return;
      if (k === "pos" && posSoloSePresente && !(k in o)) return;
      var x = v[k];
      if (k in o && o[k] !== null && x !== null && x !== undefined) {
        if (typeof o[k] === "number") x = isFinite(Number(x)) ? Number(x) : 0;
        else if (typeof o[k] === "string") x = String(x);
      }
      o[k] = x; scritti.push(k);
    });
    return scritti;
  }
  // verifica dopo il salvataggio: giocatori (significato noto) e swtcMdl rigorosi; pos "da verificare"; swtc solo registrato
  function fvmSwVerifica(atteso, letto) {
    if (!atteso) return { esito: "nessuna_attesa" };
    if (!letto || letto.stato === "sconosciuto") return { esito: "non_letto", motivo: (letto && letto.motivo) || "lettura non riuscita" };
    var aA = fvmSwNum(atteso.swtcA), aB = fvmSwNum(atteso.swtcB), presente = !!(aA && aB), v = letto.valori || {};
    var r = { esito: "ok", atteso: presente ? aA + "-" + aB : "nessuno", letto: letto.stato === "presente" ? letto.a + "-" + letto.b : "nessuno", differenze: [], daVerificare: [],
      swtc: { atteso: atteso.swtc === undefined ? null : atteso.swtc, letto: v.swtc === undefined ? null : v.swtc } };
    if ((letto.a || 0) !== aA || (letto.b || 0) !== aB) r.differenze.push("giocatori");
    if (presente && fvmSwModulo(atteso.swtcMdl) !== fvmSwModulo(v.swtcMdl)) r.differenze.push("swtcMdl");
    if (presente && "pos" in atteso && Number(atteso.pos) !== Number(v.pos)) r.daVerificare.push("pos");
    if (r.differenze.length) r.esito = "diverso";
    return r;
  }
  // ---- collegamento con la memoria e con il PASSO 2 (Safari)
  function swNome(pid, u, f) {
    pid = Number(pid);
    var x = (u && u.nomi && u.nomi[pid]) || info[pid] || ((f && f.roster) || []).filter(function (p) { return Number(p.pid) === pid; })[0];
    return x && (x.n || x.name) ? String(x.n || x.name) : "#" + pid;
  }
  function swCoppia(s, u, f) { return s && s.stato === "presente" ? swNome(s.a, u, f) + " ↔ " + swNome(s.b, u, f) : "nessuno"; }
  // Switch della formazione di lega in FVM: quello registrato, altrimenti dal corpo del salvataggio; mai di un'altra formazione
  function swSorgente(u) {
    if (!u || u.fonte === "fantaclub") return null;
    var s = u.sw || null;
    if (!s && u.corpo) s = fvmSwDaTesto(u.corpo, "corpo_lega");
    if (!s) return null;
    if (s.stato !== "sconosciuto" && ((s.tid && Number(u.tid) && s.tid !== Number(u.tid)) || (s.comp && Number(u.comp) && s.comp !== Number(u.comp))))
      return { stato: "sconosciuto", motivo: "Switch di un'altra formazione", valori: {}, a: 0, b: 0 };
    return s;
  }
  function swChiave(dest, target) { return fvmSwNum(dest && dest.tid) + "|" + fvmSwNum(dest && dest.comp) + "|" + fvmSwNum(target); }
  function swDecisione(u, f, dest, fle, target) {
    var fonte = u && u.fonte === "fantaclub" ? "fantaclub" : "leghe", lega = fonte === "fantaclub" ? null : swSorgente(u);
    var t = fvmSwNum(target) || fvmSwNum(f && f.swTarget) || fvmSwNum(lega && lega.cmday);
    var sc = (leggi("sw_scelte", {}) || {})[swChiave(dest, t)] || null;
    var d = fvmSwDecidi({ fonte: fonte, lega: lega, fle: fle, target: t, dest: dest, scelta: sc });
    d.fonte = fonte; d.target = t; d.chiave = swChiave(dest, t); d.legaSw = lega; d.fleSw = fle || null;
    d.valori = fvmSwValori(d, { lega: lega, fle: fle, mdl: dest.mdl });
    return d;
  }
  // PASSO 2: decisione con lo Switch letto dal CONTROLLO FLE (null se il controllo e precedente a questa versione:
  // allora decide l'invio, con la pagina FLE appena letta)
  function swPasso2(u, f, res) {
    if (!u || !u.ok || !res || !f || !Number(f.tid) || !Number(f.comp) || !("sw" in f)) return null;
    var dest = { tid: Number(f.tid), comp: Number(f.comp), starts: res.starts.map(function (p) { return Number(p.pid); }), bench: res.bench.map(function (p) { return Number(p.pid); }), mdl: u.modulo };
    return swDecisione(u, f, dest, f.sw, f.swTarget);
  }
  // testo dell'avviso quando l'invio non puo partire
  function swTesto(d, u, f) {
    if (!d) return "";
    if (d.motivo === "fle_non_letto" || d.motivo === "fle_non_verificabile")
      return "Non riesco a verificare lo Switch su FLE per questa giornata: per non rischiare di cancellarlo o di riportarne uno vecchio, l'invio automatico è fermo. Tocca RIPETI CONTROLLO FLE, oppure controlla la formazione con MODIFICA SU FLE.";
    if (d.motivo === "squadra_diversa") return "La pagina FLE mostra una squadra diversa da quella del controllo: invio fermato. Tocca RIPETI CONTROLLO FLE.";
    if (d.motivo === "scelta_mancante" && d.caso === "conflitto")
      return "Lo Switch della tua lega (" + swCoppia(d.legaSw, u, f) + ") è diverso da quello già su FLE (" + swCoppia(d.fleSw, u, f) + "): scegli nel PASSO 2 quale usare, poi CONFERMA E INVIA.";
    if (d.motivo === "scelta_mancante")
      return "Lo Switch su FLE (" + swCoppia(d.fleSw, u, f) + ") non è compatibile con la nuova formazione (" + d.mancantiFle.map(function (p) { return swNome(p, u, f); }).join(", ") + " non c'è): scegli MODIFICA o ELIMINA nel PASSO 2, poi CONFERMA E INVIA.";
    return "Switch non verificabile: invio fermato.";
  }
  // riquadro SWITCH del PASSO 2 (vuoto se non c'e nulla da dire)
  function swCarta(d, u, f) {
    if (!d) return "";
    var riga = function (t, col) { return "<div class='mu' style='margin-top:4px" + (col ? ";color:" + col : "") + "'>• " + esc(t) + "</div>"; };
    var g = d.target ? " · giornata " + d.target + " di Serie A" : "";
    if (d.caso === "fle_non_verificabile") return riga("Switch su FLE non verificabile ora: verrà riletto all'invio; se resta non verificabile l'invio si ferma, senza toccare nulla.", "#fbbf24");
    if (d.caso === "copia") return riga("Switch della tua lega: " + swCoppia(d.legaSw, u, f) + " → verrà riportato su FLE.", "#4ade80");
    if (d.caso === "uguale") return riga("Switch su FLE: " + swCoppia(d.fleSw, u, f) + " ✓ uguale alla tua lega.", "#4ade80");
    var h = "";
    if (d.caso === "lega_incompatibile" || (d.lega === "presente" && !d.legaCompat))
      h += riga("Switch della tua lega (" + swCoppia(d.legaSw, u, f) + ") non riportabile: " + d.mancantiLega.map(function (p) { return swNome(p, u, f); }).join(", ") + " non è nella formazione FLE. Dopo l'invio puoi impostarlo con MODIFICA SU FLE.", "#fbbf24");
    if (d.caso === "lega_non_letta") h += riga("Switch della tua lega non letto (formazione registrata senza i dati Switch): per riportarlo su FLE rifai FAI O MODIFICA, oppure ACQUISISCI.", "#fbbf24");
    if (d.caso === "lega_precedente") h += riga("La formazione di lega in FVM riguarda una giornata precedente: il suo Switch non verrà riportato.", "#fbbf24");
    if (d.flePrecedentePresente) h += riga("Su FLE c'è lo Switch di una giornata precedente (" + swCoppia(d.fleSw, u, f) + "): non verrà riportato alla nuova giornata.");
    if (!d.opzioni.length) return h;
    var nomi = { lega: "USA QUELLO DELLA LEGA", modifica: d.caso === "conflitto" ? "MODIFICA SU FLE" : "MODIFICA SWITCH", mantieni: d.caso === "conflitto" ? "MANTIENI QUELLO DI FLE" : "MANTIENI SWITCH", elimina: "ELIMINA SWITCH" };
    h += "<div class='cd' style='margin-top:8px;padding:10px;border-left:4px solid #e2b33c'><div class='lb'>SWITCH SU FLE" + esc(g) + "</div>";
    h += "<div class='mu' style='margin-top:4px'>Su FLE: <b>" + esc(swCoppia(d.fleSw, u, f)) + "</b>" + (d.fleCompat ? "" : " · non compatibile con la nuova formazione") + "</div>";
    if (d.caso === "conflitto") h += "<div class='mu'>Nella tua lega: <b>" + esc(swCoppia(d.legaSw, u, f)) + "</b></div>";
    if (d.scelta) {
      h += "<div style='color:#4ade80;font-weight:800;margin-top:6px'>Scelta: " + esc(nomi[d.scelta]) + " ✓</div>";
      // RC3 (come Android): FVM NON cambia lo Switch su FLE con MODIFICA; con LEGA e MANTIENI dice cosa scrive
      if (d.scelta === "modifica") h += "<div class='mu' style='color:#fbbf24;font-weight:800'>" + (d.fleCompat ? "FVM NON cambia lo Switch su FLE: con l'invio resta " + esc(swCoppia(d.fleSw, u, f)) + ". Dopo l'invio tocca MODIFICA SU FLE e cambialo tu sul sito." : "FVM NON imposta lo Switch su FLE: " + esc(swCoppia(d.fleSw, u, f)) + " non è compatibile e viene tolto con l'invio. Dopo l'invio tocca MODIFICA SU FLE e impostalo tu sul sito.") + "</div>";
      if (d.scelta === "lega") h += "<div class='mu'>Con l'invio FVM scrive su FLE lo Switch della tua lega: " + esc(swCoppia(d.legaSw, u, f)) + ".</div>";
      if (d.scelta === "mantieni") h += "<div class='mu'>Con l'invio FVM riscrive su FLE lo Switch attuale: " + esc(swCoppia(d.fleSw, u, f)) + ".</div>";
      if (d.scelta === "elimina") h += "<div class='mu'>Con l'invio lo Switch viene tolto da FLE.</div>";
      h += "<button class='bt' data-a='sw_annulla'>CAMBIA SCELTA</button>";
    } else {
      h += "<div class='mu' style='margin-top:4px'>" + (d.obbligatoria ? "Scegli prima di CONFERMA E INVIA: senza una scelta l'invio non parte." : "Lo Switch può cambiare ogni giornata. Senza una scelta FVM lo lascia com'è.") + "</div>";
      // RC3 (come Android): sotto ogni pulsante cosa fa DAVVERO (FVM scrive lo Switch solo con LEGA, MANTIENI ed ELIMINA)
      var spiega = { lega: "FVM scrive su FLE: " + swCoppia(d.legaSw, u, f) + ".", mantieni: "FVM riscrive su FLE quello attuale: " + swCoppia(d.fleSw, u, f) + ".",
        modifica: d.fleCompat ? "FVM non cambia lo Switch: lo cambi tu su FLE dopo l'invio." : "FVM non imposta lo Switch: lo imposti tu su FLE dopo l'invio.", elimina: "Con l'invio lo Switch viene tolto da FLE." };
      d.opzioni.forEach(function (op) { h += "<button class='bt" + (op === d.evidenzia ? " oro" : "") + "' data-a='sw_" + op + "'>" + esc(nomi[op]) + (op === d.evidenzia ? " · suggerita" : "") + "</button>" + (spiega[op] ? "<div class='mu' style='font-size:12px;margin-top:2px'>" + esc(spiega[op]) + "</div>" : ""); });
    }
    return h + "</div>";
  }
  // PASSO 2 dopo l'invio: esito della verifica su FLE (nulla da dire se nessuno Switch era previsto ed e tutto regolare)
  function swCartaInviata(f, u) {
    var v = f && f.swVerifica, h = "";
    var riga = function (t, col) { return "<div class='mu' style='margin-top:4px" + (col ? ";color:" + col : "") + "'>• " + esc(t) + "</div>"; };
    if (f && f.swModifica) h += riga("Hai scelto MODIFICA: tocca MODIFICA SU FLE e imposta lo Switch con la pagina ufficiale FLE.", "#e2b33c");
    // PROVA9: riepilogo della verifica individuale delle competizioni FLE (dettaglio nello STORICO)
    var cv = f && f.compVerifica && Array.isArray(f.compVerifica.esiti) ? f.compVerifica.esiti : null;
    if (cv && cv.length) {
      var n = function (es) { return cv.filter(function (r) { return r.esito === es; }).length; };
      var parti = [n("verificata") + " verificate"].concat(n("diversa") ? [n("diversa") + " diverse"] : [], n("da_verificare") ? [n("da_verificare") + " da verificare"] : [], n("senza_turno") ? [n("senza_turno") + " senza turno"] : [], n("classifica") ? [n("classifica") + " classifiche"] : []);
      h += riga("Competizioni FLE: " + parti.join(" · ") + " (dettaglio nello STORICO INVII)", n("diversa") ? "#f87171" : n("da_verificare") ? "#fbbf24" : "#4ade80");
    }
    // PROVA11: RIPROVA VERIFICA (solo letture) quando una lettura di controllo non e riuscita
    var riprova = f && f.verificaRif && ((v && v.esito === "non_letto") || (cv && cv.some(function (r) { return r.esito === "da_verificare" && /non lett|non riuscit|tempo|rete|annullat|non confermat|elenco/i.test(String(r.motivo || "") + " " + String(r.nota || "")); })));
    var bottone = riprova ? "<button class='bt' data-a='riprova_verifica'>RIPROVA VERIFICA</button><div class='mu' style='font-size:11px'>Solo lettura: nessun invio, nessuna modifica, nessuna nuova consegna.</div>" : "";
    if (!v) return h + bottone;
    if (v.esito === "ok" && v.atteso !== "nessuno") h += riga("Switch su FLE verificato ✓ (" + swCoppia({ stato: "presente", a: Number(v.atteso.split("-")[0]), b: Number(v.atteso.split("-")[1]) }, u, f) + ")", "#4ade80");
    else if (v.esito === "ok" && f.swEliminato) h += riga("Switch tolto da FLE ✓ (verificato)", "#4ade80");
    else if (v.esito === "diverso") h += riga("Lo Switch salvato su FLE è diverso da quello previsto: controllalo con MODIFICA SU FLE.", "#f87171") + (Number(v.conferme) > 1 ? riga("Differenza confermata da " + Number(v.conferme) + " letture del sito.", "#f87171") : "");
    else if (v.esito === "non_letto") h += riga("Formazione SALVATA su FLE ✓ · Switch NON VERIFICABILE ora: " + fvmMotivoBreve(v) + ". Non significa che lo Switch manchi.", "#fbbf24");
    if (v.daVerificare && v.daVerificare.length) h += riga("Switch: campo «" + v.daVerificare.join(", ") + "» diverso da quello inviato (significato non ancora noto): da verificare.", "#fbbf24");
    return h + bottone;
  }
  // PROVA11: motivo tecnico in parole semplici (mai intestazioni o credenziali)
  function fvmMotivoBreve(r) {
    if (!r) return "lettura non riuscita";
    var T = { rete: "errore di rete", annullata: "lettura annullata dal browser", tempo: "il sito non ha risposto in tempo", risposta: "risposta incompleta", accesso: "accesso al sito non disponibile",
      squadra: "la risposta riguarda un'altra squadra", non_confermato: "differenza non confermata da una seconda lettura" };
    var t = r.tipo === "http" ? String(r.motivo || "risposta del sito non valida") : T[r.tipo] || String(r.motivo || "lettura non riuscita");
    return t + (Number(r.tentativi) > 1 ? " (" + Number(r.tentativi) + " tentativi)" : "");
  }
  // PROVA11: avvisi dopo una verifica (salvataggio riuscito: una lettura fallita NON e un salvataggio fallito)
  function fvmAvvisiVerifica(rSw, rComp) {
    var avv = [];
    if (rSw && rSw.esito === "diverso") avv.push("Switch diverso da quello previsto");
    else if (rSw && rSw.esito === "non_letto") avv.push("verifica dello Switch non riuscita (" + fvmMotivoBreve(rSw) + "), puoi ripeterla");
    if (rComp && rComp.some(function (r) { return r.esito === "diversa"; })) avv.push("formazione diversa in una competizione FLE");
    return avv;
  }
  // scelta dell'utente (MODIFICA / MANTIENI / ELIMINA / USA QUELLO DELLA LEGA): mai eseguita da sola, ricordata per
  // squadra + competizione + giornata + situazione dello Switch
  function swScelta(azione) {
    var u = formazioneSorgente(), f = leggi("fle", null) || {}, res = risultatoFle(), d = swPasso2(u, f, res);
    if (!d) return;
    var tutte = leggi("sw_scelte", {}) || {};
    if (azione === "annulla") { delete tutte[d.chiave]; scrivi("sw_scelte", tutte); log("SWITCH SCELTA", { azione: "annullata", chiave: d.chiave }); aggiornaPannello(); return; }
    if (d.opzioni.indexOf(azione) < 0) { log("SWITCH SCELTA", { azione: azione, esito: "non disponibile in questa situazione" }); aggiornaPannello(); return; }
    if (azione === "elimina" && !confirm("Eliminare lo Switch " + swCoppia(d.fleSw, u, f) + " su FLE?\n\nVerrà tolto con l'invio della formazione. Puoi impostarne un altro con MODIFICA SU FLE.")) return;
    tutte[d.chiave] = { azione: azione, situazione: d.situazione, at: Date.now() };
    var ch = Object.keys(tutte).sort(function (x, y) { return Number(tutte[y].at || 0) - Number(tutte[x].at || 0); });
    ch.slice(30).forEach(function (k) { delete tutte[k]; });
    scrivi("sw_scelte", tutte);
    log("SWITCH SCELTA", { azione: azione, chiave: d.chiave, caso: d.caso });
    aggiornaPannello();
  }
  // invio: decisione con la pagina FLE APPENA letta (Switch, squadra, competizione) e la formazione FLE definitiva
  function swDecisioneInvio(task) {
    var pl = ctl.payload, f = leggi("fle", {}) || {}, u = formazioneSorgente(), inv = (task && task.inv) || {};
    if (!pl || !pl.sw) return { blocca: true, motivo: "fle_non_letto", caso: "fle_non_verificabile" };
    var dest = { tid: Number(pl.tid || 0), comp: Number(pl.comp || 0), starts: (inv.starts || []).map(Number), bench: (inv.bench || []).map(Number), mdl: inv.mdl };
    if (Number(f.tid) && dest.tid !== Number(f.tid)) return { blocca: true, motivo: "squadra_diversa", caso: "squadra_diversa" };
    var target = fvmSwNum(ctl.status && ctl.status.mday) || fvmSwNum(f.swTarget);
    var d = swDecisione(u, f, dest, pl.sw, target);
    // il PASSO 2 mostra cio che e stato appena letto (anche se l'invio si ferma)
    f.sw = pl.sw; if (d.target) f.swTarget = d.target; f.swLettoAt = Date.now(); scrivi("fle", f);
    return d;
  }
  // invio fermato PRIMA del salvataggio: nessuna richiesta a FLE, nessun esito "riuscito"
  function invioFermato(d, task) {
    var u = formazioneSorgente(), f = leggi("fle", {}) || {}, testo = swTesto(d, u, f);
    if (invioCorrente) { invioCorrente.finito = true; try { invioCorrente.w.chiudi(); } catch (e) {} }
    window.__fvmInvio = null;
    sScrivi("task", null);
    log("INVIO FLE FERMATO", { motivo: d && d.motivo, caso: d && d.caso, situazione: d && d.situazione, fonte: task && task.fonte || "leghe" });
    try { storicoBloccato("lega_fle", (task && task.fonte === "fantaclub" && (legaFc() || {}).nl) || "", "Switch: " + testo); } catch (e) {}
    f.swFermato = { at: Date.now(), testo: testo };
    scrivi("fle", f);
    sScrivi("apri", "main");
    sScrivi("flash", "Invio FERMATO prima del salvataggio (nessuna modifica su FLE): " + testo);
    var torna = f.ritorno && f.ritorno.indexOf("/" + FLE_SLUG + "/") < 0 ? f.ritorno : urlLegaSorgente();
    location.assign(torna);
  }
  // PROVA11 · LETTURE DOPO IL SALVATAGGIO (solo GET, mai una scrittura). Tipo di errore: "rete" (Safari «Load failed»,
  // «Failed to fetch»), "annullata", "tempo", "http", "risposta" (non leggibile), "accesso" (intestazioni assenti).
  function fvmErroreLettura(e) {
    var msg = String(e && e.message || e || "errore").slice(0, 80), http = Number(e && e.http) || 0;
    if (http) return { tipo: "http", http: http, motivo: "risposta del sito " + http };
    if (e && e.name === "AbortError") return { tipo: "annullata", motivo: "lettura annullata dal browser (" + msg + ")" };
    if (/tempo scaduto/i.test(msg)) return { tipo: "tempo", motivo: "tempo scaduto" };
    if (/load failed|failed to fetch|networkerror|network|rete/i.test(msg)) return { tipo: "rete", motivo: "errore di rete (" + msg + ")" };
    if (/json|unexpected|parse/i.test(msg)) return { tipo: "risposta", motivo: "risposta non leggibile" };
    return { tipo: "altro", motivo: msg };
  }
  // una lettura con tentativi limitati: subito, dopo 1,5 s, dopo altri 3 s (4 s ciascuno, al massimo ~12 s in tutto).
  // Nuovo tentativo solo per rete / annullata / tempo / risposta non leggibile / HTTP 5xx o 429; mai per 401, 403, 404.
  // Non rifiuta mai: risolve { ok, json } oppure { ok: false, tipo, motivo }, con tentativi, durata e provenienza delle intestazioni.
  function fvmLeggiConTentativi(path, opz) {
    opz = opz || {};
    var pause = opz.pause || [0, 1500, 3000], perTentativo = opz.perTentativo || 4000, massimo = opz.massimo || 12000;
    var hdr = ctl.hdrLettura || ctl.hdr, da = ctl.hdrLettura ? ctl.hdrLetturaFrom || "lettura del sito" : ctl.hdr ? "riserva: " + (ctl.hdrFrom || "?") : "";
    var t0 = Date.now(), n = 0;
    return new Promise(function (fine) {
      var esci = function (r) { fine(Object.assign(r, { tentativi: n, ms: Date.now() - t0, hdrFrom: da, nomiIntestazioni: Object.keys(hdr || {}) })); };
      if (!hdr) return esci({ ok: false, tipo: "accesso", motivo: "accesso del sito non disponibile" });
      var prova = function () {
        n++;
        new Promise(function (ok, no) {
          var t = setTimeout(function () { no(new Error("tempo scaduto")); }, perTentativo);
          fetchOriginale(API + path, { method: "GET", headers: hdr, credentials: "include", cache: "no-store" })
            .then(function (r) { return r.text().then(function (tx) { clearTimeout(t); if (!r.ok) { var e = new Error("stato " + r.status); e.http = r.status; throw e; } ok(JSON.parse(tx)); }); })
            .catch(function (e) { clearTimeout(t); no(e); });
        }).then(function (j) { esci({ ok: true, json: j }); }, function (e) {
          var er = fvmErroreLettura(e), ancora = er.tipo !== "accesso" && (er.tipo !== "http" || er.http >= 500 || er.http === 429);
          var pausa = pause[n];
          if (!ancora || pausa === undefined || Date.now() - t0 + pausa + perTentativo > massimo) return esci(Object.assign({ ok: false }, er));
          setTimeout(prova, pausa);
        });
      };
      prova();
    });
  }
  // lettura CONDIVISA: la stessa formazione ufficiale serve alla verifica dello Switch e a quella delle competizioni (una sola
  // richiesta per indirizzo). "prima" = letture gia fatte dal sito (pagina FLE), usate senza nuove richieste.
  function fvmLettoreCondiviso(prima) {
    var memo = {};
    Object.keys(prima || {}).forEach(function (p) { memo[p] = Promise.resolve({ ok: true, json: prima[p], tentativi: 0, ms: 0, hdrFrom: "lettura della pagina FLE (sito)" }); });
    return function (path, nuova) {
      if (nuova || !memo[path]) memo[path] = fvmLeggiConTentativi(path);
      return memo[path];
    };
  }
  // verifica dopo il salvataggio: rilettura della formazione FLE (sola lettura) con tentativi limitati (PROVA11).
  // "non_letto" = NON VERIFICABILE (lettura non riuscita, con il motivo tecnico): mai «Switch assente». "diverso" solo se due
  // letture riuscite lo confermano (una lettura subito dopo il salvataggio puo trovare il dato non ancora aggiornato).
  function verificaSwitchFle(comp, tid, atteso, fatto, leggi) {
    var finito = false, chiudi = function (r) { if (finito) return; finito = true; log("SWITCH VERIFICA", r); fatto(r); };
    if (!atteso || !atteso.valori) return chiudi({ esito: "nessuna_attesa" });
    if ((!ctl.hdr && !ctl.hdrLettura) || !Number(comp)) return chiudi({ esito: "non_letto", tipo: "accesso", motivo: "accesso del sito non disponibile" });
    setTimeout(function () { chiudi({ esito: "non_letto", tipo: "tempo", motivo: "tempo scaduto" }); }, 16000);
    leggi = leggi || fvmLettoreCondiviso();
    var path = "/gaming/v1/teamLineup/visualizza/" + meDivisione(FLE_SLUG) + "/" + Number(comp);
    var dati = function (x) { return { tentativi: x.tentativi, ms: x.ms, hdrFrom: x.hdrFrom }; };
    var valuta = function (x) {
      if (!x.ok) return Object.assign({ esito: "non_letto", tipo: x.tipo, motivo: x.motivo }, dati(x));
      var s = fvmSwDaTesto(x.json, "verifica_fle");
      if (s.stato !== "sconosciuto" && Number(tid) && s.tid !== Number(tid)) return Object.assign({ esito: "non_letto", tipo: "squadra", motivo: "squadra diversa nella risposta" }, dati(x));
      if (s.stato === "sconosciuto") return Object.assign({ esito: "non_letto", tipo: "risposta", motivo: "risposta incompleta: " + (s.motivo || "Switch non leggibile") }, dati(x));
      return Object.assign(fvmSwVerifica(atteso.valori, s), dati(x));
    };
    leggi(path).then(function (x) {
      var r = valuta(x);
      if (r.esito !== "diverso" && r.tipo !== "risposta") return chiudi(r);
      // conferma con una seconda lettura NUOVA: «diverso» solo se confermato; risposta incompleta: un'altra possibilita
      setTimeout(function () {
        if (finito) return;
        leggi(path, true).then(function (x2) {
          var r2 = valuta(x2);
          if (r.esito === "diverso" && r2.esito === "diverso") return chiudi(Object.assign(r2, { conferme: 2 }));
          if (r2.esito === "ok") return chiudi(Object.assign(r2, { nota: r.esito === "diverso" ? "prima lettura diversa, non confermata dalla seconda" : "prima risposta incompleta" }));
          if (r.esito === "diverso") return chiudi(Object.assign({ esito: "non_letto", tipo: "non_confermato", motivo: "una lettura diversa non confermata dalla seconda (" + (r2.motivo || r2.esito) + ")", atteso: r.atteso, letto: r.letto }, dati(x2)));
          if (r2.esito === "diverso") return chiudi(Object.assign({ esito: "non_letto", tipo: "non_confermato", motivo: "una sola lettura diversa (la prima era incompleta): non confermata", atteso: r2.atteso, letto: r2.letto }, dati(x2)));
          chiudi(r2);
        });
      }, 1500);
    });
  }
  // PROVA9 · FASE B: verifica INDIVIDUALE delle competizioni FLE dopo il salvataggio generale (SALVA PER TUTTE).
  // Confronto (puro) della formazione ufficiale di UNA competizione con quella inviata: squadra, competizione, giornata di
  // Serie A (cmday) attesa, modulo, 11 titolari, panchina con l'ordine, Switch quando inviato. Giornata diversa o risposta
  // senza formazione = "serve_calendario" (mai "senza turno" senza il calendario).
  function fvmVerificaFormazioneComp(dto, ctx, compId) {
    ctx = ctx || {};
    var inv = ctx.inv || {};
    if (!dto || typeof dto !== "object" || !Array.isArray(dto.starts)) return { esito: "serve_calendario", motivo: "risposta senza formazione" };
    if (Number(dto.tid) !== Number(ctx.tid) || Number(dto.idcomp) !== Number(compId)) return { esito: "da_verificare", motivo: "la risposta riguarda un'altra squadra o un'altra competizione" };
    var g = { giornata: Number(dto.mday) > 0 ? Number(dto.mday) : undefined, giornataSA: Number(dto.cmday) > 0 ? Number(dto.cmday) : undefined };
    if (!Number(ctx.target) || Number(dto.cmday) !== Number(ctx.target))
      return Object.assign(g, { esito: "serve_calendario", motivo: "formazione letta della giornata " + (Number(dto.cmday) || "?") + " di Serie A (attesa " + (Number(ctx.target) || "?") + ")" });
    var ids = function (a) { return (Array.isArray(a) ? a : []).map(idDi).filter(Boolean); };
    var t = ids(dto.starts), b = ids(dto.bench), ti = (inv.starts || []).map(Number), bi = (inv.bench || []).map(Number), diff = [];
    if (fvmSwModulo(dto.mdl) !== fvmSwModulo(inv.mdl)) diff.push("modulo " + (fvmSwModulo(dto.mdl) || "?") + " invece di " + fvmSwModulo(inv.mdl));
    if (t.length !== 11 || chiave(t) !== chiave(ti)) diff.push("titolari diversi");
    if (b.join(",") !== bi.join(",")) diff.push(chiave(b) === chiave(bi) ? "panchina: stessi giocatori, ordine diverso" : "panchina diversa");
    var swNonLetto = false;
    if (ctx.sw) {
      var v = fvmSwVerifica(ctx.sw, fvmSwLeggi(dto, "verifica competizione"));
      g.switchEsito = v.esito;
      if (v.esito === "diverso") diff.push("Switch diverso"); else if (v.esito === "non_letto") swNonLetto = true;
    }
    if (diff.length) return Object.assign(g, { esito: "diversa", differenze: diff });
    if (swNonLetto) return Object.assign(g, { esito: "da_verificare", motivo: "formazione uguale, Switch non leggibile nella risposta" });
    return Object.assign(g, { esito: "verificata" });
  }
  // calendario della competizione (pura): SENZA TURNO solo se il calendario lo dice (nessun turno nella giornata di Serie A,
  // oppure squadra senza partita nel turno); turno con la partita della squadra, senza avversario o senza partite = da verificare
  function fvmTurnoCalendario(cal, target, tid, prima) {
    var p = prima || {}, motivo = p.motivo ? p.motivo + "; " : "";
    if (!Array.isArray(cal)) return Object.assign({}, p, { esito: "da_verificare", motivo: motivo + "calendario non leggibile" });
    var turno = cal.filter(function (r) { return r && Number(r.championshipMatchDay) === Number(target); })[0];
    if (!turno) return Object.assign({}, p, { esito: "senza_turno", motivo: "il calendario non ha turni nella giornata " + target + " di Serie A" });
    var m = (turno.matches || []).filter(Boolean), con = m.filter(function (x) { return Number(x.tIdH) === Number(tid) || Number(x.tIdA) === Number(tid); })[0];
    var g = Number(turno.matchDay) > 0 ? Number(turno.matchDay) : p.giornata;
    if (!m.length) return Object.assign({}, p, { giornata: g, esito: "da_verificare", motivo: motivo + "turno " + (g || "?") + " senza partite nel calendario (calendario incerto)" });
    if (!con) return Object.assign({}, p, { giornata: g, esito: "senza_turno", motivo: "iscritta ma senza partita nel turno " + (g || "?") + " (calendario)" });
    if (!Number(con.tIdH) || !Number(con.tIdA)) return Object.assign({}, p, { giornata: g, esito: "da_verificare", motivo: motivo + "squadra senza avversario nel turno " + (g || "?") });
    return Object.assign({}, p, { giornata: g, esito: "da_verificare", motivo: motivo + "il calendario prevede la partita (turno " + (g || "?") + ")" });
  }
  // lettura (SOLA LETTURA) di ogni competizione coinvolta, in parallelo, con tentativi limitati (PROVA11: lettore condiviso
  // con la verifica dello Switch, ~12 s per lettura, 16 s in tutto). Ogni competizione ha il suo esito: una che non risponde
  // non cancella quelle gia verificate. Nessun salvataggio. Elenco non leggibile: verificata almeno la competizione d'ingresso.
  function verificaCompetizioniFle(ctx, fatto) {
    var finito = false, risultati = {}, lista = [], fonte = "pagina FLE";
    var chiudi = function (motivo) {
      if (finito) return; finito = true;
      var out = lista.map(function (c) { return risultati[c.id] || Object.assign({}, c, { esito: "da_verificare", motivo: motivo || "tempo scaduto" }); });
      log("VERIFICA COMPETIZIONI FLE", { giornataSA: ctx.target, esiti: out.map(function (r) { return r.id + ":" + r.esito; }), elenco: fonte, nota: motivo || "" });
      fatto(out);
    };
    if ((!ctl.hdr && !ctl.hdrLettura) || !Number(ctx.tid)) return chiudi("accesso del sito non disponibile");
    setTimeout(function () { chiudi("tempo massimo della verifica (16 s) superato"); }, 16000);
    var lettore = ctx.leggi || fvmLettoreCondiviso();
    var leggiJson = function (path, nuova) {
      return lettore(path, nuova).then(function (x) {
        if (x.ok) return x.json;
        var e = new Error(x.motivo || "lettura non riuscita"); e.tipo = x.tipo; throw e;
      });
    };
    var avvia = function (comps, notaElenco) {
      lista = storicoCompetizioniFle(comps, ctx.tid, ctx.ingresso) || [];
      // elenco senza le squadre iscritte (o non leggibile): si verifica almeno la competizione d'ingresso, dichiarandolo
      if (!lista.length && Number(ctx.ingresso)) lista = [{ id: Number(ctx.ingresso), nome: String(ctx.ingressoNome || ctx.ingresso).slice(0, 60), natura: "obbligo", coinvolta: true, ingresso: true, nota: notaElenco || "iscrizioni non disponibili: verificata solo la competizione d'ingresso" }];
      if (!lista.length) return chiudi("elenco delle competizioni FLE non disponibile");
      var attese = lista.length;
      var uno = function (c, r) { if (finito || risultati[c.id]) return; risultati[c.id] = Object.assign({}, c, r); if (--attese <= 0) chiudi(""); };
      var calendario = function (c, prima) {
        return leggiJson("/onboarding/v1/league/competition/calendar/" + c.id).then(function (cal) { uno(c, fvmTurnoCalendario(cal, ctx.target, ctx.tid, prima)); })
          .catch(function (e) { uno(c, Object.assign({}, prima, { esito: "da_verificare", motivo: (prima && prima.motivo ? prima.motivo + "; " : "") + "calendario non letto (" + String(e && e.message || e).slice(0, 40) + ")" })); });
      };
      lista.forEach(function (c) {
        if (c.natura === "ranking") return uno(c, { esito: "classifica", motivo: "classifica a punti: nessuna formazione da consegnare" });
        if (c.natura !== "obbligo") return uno(c, { esito: "da_verificare", motivo: "natura della competizione non verificata" });
        if (!Number(ctx.target)) return uno(c, { esito: "da_verificare", motivo: "giornata di Serie A del salvataggio non nota" });
        var pathC = "/gaming/v1/teamLineup/visualizza/" + ctx.divisione + "/" + c.id;
        var nonLetta = function (e) {
          // formazione non letta: solo il calendario puo dire "senza turno"; altrimenti resta da verificare
          calendario(c, { motivo: "formazione non letta (" + String(e && e.message || e).slice(0, 60) + ")" });
        };
        leggiJson(pathC).then(function (j) {
          var e = fvmVerificaFormazioneComp(trovaDto(j, 0) || trovaFormazione(j, 0), ctx, c.id);
          if (e.esito === "serve_calendario") return calendario(c, e);
          if (e.esito !== "diversa") return uno(c, e);
          // PROVA11: «diversa» solo se confermata da una seconda lettura nuova (il sito puo non essere ancora aggiornato)
          setTimeout(function () {
            if (finito) return;
            leggiJson(pathC, true).then(function (j2) {
              var e2 = fvmVerificaFormazioneComp(trovaDto(j2, 0) || trovaFormazione(j2, 0), ctx, c.id);
              if (e2.esito === "diversa") return uno(c, Object.assign(e2, { conferme: 2 }));
              if (e2.esito === "serve_calendario") return calendario(c, e2);
              uno(c, e2.esito === "verificata" ? Object.assign(e2, { nota: "prima lettura diversa, non confermata dalla seconda" }) : e2);
            }).catch(function (e3) { uno(c, Object.assign({}, e, { esito: "da_verificare", motivo: "differenza non confermata: seconda lettura non riuscita (" + String(e3 && e3.message || e3).slice(0, 60) + ")" })); });
          }, 1500);
        }).catch(nonLetta);
      });
    };
    if (Array.isArray(ctx.comps) && ctx.comps.length) avvia(ctx.comps);
    else {
      fonte = "letto da FVM";
      leggiJson("/onboarding/v1/league/competitions").then(function (j) { avvia(listaCompetizioni(j)); }).catch(function (e) {
        // PROVA11: elenco non leggibile -> almeno la competizione d'ingresso (prima: nessuna verifica)
        fonte = "non letto";
        avvia([], "elenco delle competizioni FLE non letto (" + String(e && e.message || e).slice(0, 60) + "): verificata solo la competizione d'ingresso");
      });
    }
  }
  // MODIFICHE ESTERNE · Switch: riferimento separato dall'impronta della formazione (gli avvisi gia chiusi non ritornano)
  function swRegistra(k, s, fonte) {
    if (!k || !s) return;
    var tutti = leggi("sw_rif", {}) || {};
    tutti[k] = { stato: s.stato, a: s.a || 0, b: s.b || 0, mdl: fvmSwModulo(s.valori && s.valori.swtcMdl), imp: fvmSwImpronta(s), fonte: String(fonte || ""), at: Date.now() };
    var ch = Object.keys(tutti).sort(function (x, y) { return Number(tutti[y].at || 0) - Number(tutti[x].at || 0); });
    ch.slice(40).forEach(function (x) { delete tutti[x]; });
    scrivi("sw_rif", tutti);
    var ign = leggi("sw_ign", {}) || {};
    if (ign[k]) { delete ign[k]; scrivi("sw_ign", ign); }
  }

  // ---------------------------------------------------------------- salvataggio (lega e FLE)
  function trovaFormazione(x, d) {
    if (!x || typeof x !== "object" || d > 4) return null;
    if (Array.isArray(x.starts) && Array.isArray(x.bench)) return x;
    var ks = Object.keys(x);
    for (var i = 0; i < ks.length; i++) { var f = trovaFormazione(x[ks[i]], d + 1); if (f) return f; }
    return null;
  }
  function chiave(ids) { return ids.slice().sort(function (a, b) { return a - b; }).join(","); }
  var deciso = null;
  var inAttesa = null;

  function comeOriginale(arr, ids) {
    var es = arr && arr.length ? arr[0] : null;
    if (es && typeof es === "object") { log("INVIO FORMATO", "elementi-oggetto"); return ids.map(function (id) { return { pid: id }; }); }
    return ids.map(function (id) { return typeof es === "string" ? String(id) : id; });
  }
  function riscriviPerFle(o, inv) {
    var prima = { titolari: (o.starts || []).length, panchina: (o.bench || []).length, mdl: o.mdl, allComp: o.allComp, visb: o.visb, capt: o.capt };
    o.starts = comeOriginale(o.starts, inv.starts);
    o.bench = comeOriginale(o.bench, inv.bench);
    if ("mdl" in o || inv.mdl) o.mdl = typeof o.mdl === "number" ? Number(inv.mdl) : String(inv.mdl);
    var tit = {};
    inv.starts.forEach(function (p) { tit[p] = true; });
    if (Array.isArray(o.capt)) {
      var cap = Array.isArray(inv.capt) ? inv.capt.map(idDi).filter(function (p) { return tit[p]; }) : [];
      o.capt = comeOriginale(o.capt.length ? o.capt : [0], cap);
    } else if ("capt" in o) {
      var c1 = idDi(Array.isArray(inv.capt) ? inv.capt[0] : inv.capt);
      o.capt = tit[c1] ? c1 : (typeof o.capt === "number" ? 0 : null);
    }
    if ("allComp" in o || true) o.allComp = typeof o.allComp === "number" ? 1 : true;
    if ("visb" in o || true) o.visb = typeof o.visb === "number" ? 0 : false;
    // PROVA8: Switch = i 5 campi decisi prima del salvataggio (swDecisioneInvio), da UNA sola fonte. Senza decisione i
    // campi restano quelli del sito (nessun azzeramento: prima la 1.3.5 li azzerava sempre, cancellando lo Switch su FLE).
    var swPrima = {};
    ["swtcA", "swtcB", "swtc", "swtcMdl", "pos"].forEach(function (k) { if (k in o) swPrima[k] = o[k]; });
    if (inv.sw && inv.sw.valori) log("INVIO SWITCH", { scrittura: inv.sw.scrittura, caso: inv.sw.caso, sito: swPrima, campi: fvmSwScrivi(o, inv.sw.valori, inv.sw.posSoloSePresente), scritto: inv.sw.valori });
    else log("INVIO SWITCH", { scrittura: "nessuna", sito: swPrima, motivo: "nessuna decisione Switch: campi del sito invariati" });
    log("INVIO CORPO", { prima: prima, titolari: o.starts.length, panchina: o.bench.length, mdl: o.mdl, capt: o.capt, allComp: o.allComp, visb: o.visb });
  }

  // Ritorna {corpo: nuovoCorpo|null, salvataggio: dati|null}
  function preparaSalvataggio(raw, url, metodo) {
    return new Promise(function (resolve) {
      if (typeof raw !== "string" || raw.length > 500000) return resolve({ corpo: null, salvataggio: null });
      var j;
      try { j = JSON.parse(raw); } catch (e) { return resolve({ corpo: null, salvataggio: null }); }
      var o = trovaFormazione(j, 0);
      if (!o) return resolve({ corpo: null, salvataggio: null });
      // invio automatico su FLE (Passo 3): niente pannello, metto la formazione FLE
      if (window.__fvmInvio && suFle()) {
        riscriviPerFle(o, window.__fvmInvio);
        window.__fvmInvio.inviato = true;
        return resolve({ corpo: JSON.stringify(j), salvataggio: { tipo: "fle" } });
      }
      // PROVA12 A1: Fantaclub in SOLO FLE / MODIFICA SU FLE con squadra FLE diversa o non verificabile: il salvataggio NON parte
      var bloccoFc = bloccoSalvataggioFc(o);
      if (bloccoFc) {
        log("GUARDIA FLE", { piattaforma: "fantaclub", esito: "salvataggio bloccato", tid: Number(o.tid || 0), motivo: bloccoFc.slice(0, 160) });
        avviso(bloccoFc, true);
        return resolve({ corpo: null, salvataggio: null, blocca: bloccoFc });
      }
      // 1.1.0: un salvataggio SOLO LEGA (anche di un'altra lega) non sostituisce la richiesta modello usata per FLE.
      if (!suFle() && leggi("modo", "lega_fle") !== "solo_lega") scrivi("save_req", { url: String(url || ""), metodo: String(metodo || "PUT") });
      var ids = o.bench.map(idDi);
      var dati = {
        at: Date.now(), lega: suFle() ? FLE_SLUG : (slugDaPagina() || legaCorrente()), suFle: suFle(),
        modulo: String(o.mdl || o.module || ""), titolari: o.starts.map(idDi), panchina: ids, cambiata: false,
        tid: Number(o.tid || 0), comp: Number(o.idcomp || 0), capt: o.capt, corpo: raw,
        sw: fvmSwLeggi(o, suFle() ? "salvataggio_fle" : "salvataggio_fvm") // PROVA8: Switch del salvataggio, legato a questa formazione
      };
      if (o.bench.length < 2 || ids.some(function (x) { return !x; })) return resolve({ corpo: null, salvataggio: dati });
      var k = chiave(ids);
      function applica(ordine) {
        if (!ordine || chiave(ordine) !== k) { log("PANCHINA", { cambiata: false, prima: ids }); return resolve({ corpo: null, salvataggio: dati }); }
        o.bench = ordine.map(function (id) { return o.bench.filter(function (v) { return idDi(v) === id; })[0]; });
        dati.panchina = ordine.slice();
        dati.cambiata = true;
        dati.corpo = JSON.stringify(j);
        log("PANCHINA", { cambiata: true, prima: ids, dopo: ordine });
        resolve({ corpo: JSON.stringify(j), salvataggio: dati });
      }
      if (deciso && deciso.k === k && Date.now() - deciso.at < 120000) return applica(deciso.ordine);
      chiediOrdine(ids, function (ordine) {
        deciso = { k: k, ordine: ordine, at: Date.now() };
        applica(ordine);
      });
    });
  }
  function salvataggioRiuscito(dati, ok, stato, testo) {
    if (!dati) return;
    try { storicoSalvataggio(dati, ok, stato, testo); } catch (e) {} // storico: solo registrazione, isolata
    if (dati.tipo === "fle") { fineInvio(ok, stato, testo); return; }
    dati.ok = !!ok;
    log("SALVATAGGIO", { ok: !!ok, stato: stato, lega: dati.lega, modulo: dati.modulo, titolari: dati.titolari.length, panchina: dati.panchina.length, tid: dati.tid });
    if (!ok) { avviso("Il sito non ha confermato il salvataggio: controlla la formazione.", true); return; }
    if (dati.suFle) {
      // formazione ritoccata a mano su FLE (MODIFICA SU FLE)
      var f = leggi("fle", null);
      if (f) {
        f.stato = "inviata"; f.manuale = Date.now();
        // PROVA8: Switch salvato a mano con la pagina ufficiale FLE (FVM non lo tocca): registrato e poi verificato
        if (dati.sw && dati.sw.stato !== "sconosciuto") { f.sw = dati.sw; f.swManuale = Date.now(); delete f.swModifica; delete f.swFermato; delete f.swEliminato; f.swVerifica = null; }
        scrivi("fle", f);
        if (dati.sw && dati.sw.stato !== "sconosciuto") verificaSwitchFle(dati.comp || f.comp, dati.tid || f.tid, { valori: dati.sw.valori }, function (r) {
          var f3 = leggi("fle", null); if (!f3) return;
          f3.swVerifica = r; scrivi("fle", f3);
          try { if (pannello && pannelloPrincipale) aggiornaPannello(); } catch (e) {}
        });
      }
      avviso("Formazione salvata su FLE ✓");
      setTimeout(function () { apriPannello(); }, 1300);
      return;
    }
    if (leggi("modo", "lega_fle") === "solo_lega") {
      // 1.1.0: SOLO LEGA ha un salvataggio separato: la formazione e lo stato LEGA + FLE restano intatti.
      var compSl = Number(dati.comp || (location.pathname.match(/\/competition\/(\d+)\//) || [])[1] || 0);
      var nomeComp = (leggi("comps_" + dati.lega, []).filter(function (c) { return c.id === compSl; })[0] || {}).name || "";
      scrivi("solo_lega_salvata", { at: dati.at, lega: dati.lega, comp: compSl, compName: nomeComp, modulo: dati.modulo, titolari: dati.titolari.length, panchina: dati.panchina.length, cambiata: dati.cambiata });
      log("SOLO LEGA SALVATA", { lega: dati.lega, comp: compSl, modulo: dati.modulo, cambiata: dati.cambiata });
      avviso("Formazione salvata solo nella tua lega ✓" + (dati.cambiata ? " · panchina nel tuo ordine" : ""));
      setTimeout(function () { apriPannello(); }, 1300);
      return;
    }
    dati.nomi = {};
    dati.titolari.concat(dati.panchina).forEach(function (id) { if (info[id]) dati.nomi[id] = info[id]; });
    var map = trovaFleTid(dati.tid);
    if (map) { dati.fleTid = map.fleTid; dati.squadra = map.squadra; }
    scrivi("ultima", dati);
    // 0.3.9: una nuova formazione sorgente rende da ricontrollare FLE,
    // ma non dimentichiamo la competizione FLE gia scoperta. Serve a SOLO FLE
    // per aprire direttamente il campo modificabile, senza rifare il controllo.
    var flePrima = leggi("fle", {}) || {};
    scrivi("fle", { stato: "attesa", comp: Number(flePrima.comp || 0), compName: flePrima.compName || "", tid: Number(flePrima.tid || 0), squadra: flePrima.squadra || "" });
    var storico = leggi("storico", []);
    storico.unshift({ at: dati.at, lega: dati.lega, modulo: dati.modulo, panchina: dati.panchina.length, cambiata: dati.cambiata });
    scrivi("storico", storico.slice(0, 10));
    avviso("Formazione salvata ✓" + (dati.cambiata ? " · panchina nel tuo ordine" : ""));
    if (["lega_fle", "solo_fle"].indexOf(leggi("modo", "lega_fle")) >= 0) {
      setTimeout(function () { avviaControlloFle("dopo il salvataggio"); }, 1400);
    } else {
      setTimeout(function () { apriPannello(); }, 1300);
    }
  }

  // fetch
  var fetchOriginale = window.fetch;
  if (fetchOriginale) {
    window.fetch = function () {
      var args = Array.prototype.slice.call(arguments);
      var self = this;
      var richiesta = args[0];
      var opzioni = args[1] || {};
      var metodo = String(opzioni.method || (richiesta && richiesta.method) || "GET").toUpperCase();
      var url = typeof richiesta === "string" ? richiesta : richiesta && richiesta.url;
      try {
        if (eApi(url) && !ctl.inCorso) {
          var hh = {};
          var src = opzioni.headers || (richiesta && richiesta.headers);
          if (src && typeof src.forEach === "function") src.forEach(function (v, k) { hh[k] = v; });
          else if (src) Object.keys(src).forEach(function (k) { hh[k] = src[k]; });
          tieniIntestazioni(url, hh, metodo);
        }
      } catch (e) {}
      function esegui(prep) {
        return fetchOriginale.apply(self, args).then(function (risposta) {
          if (prep && prep.salvataggio) {
            try { risposta.clone().text().then(function (t) { salvataggioRiuscito(prep.salvataggio, risposta.ok, risposta.status, t); }); }
            catch (e) { salvataggioRiuscito(prep.salvataggio, risposta.ok, risposta.status, ""); }
          }
          if (metodo === "GET") { try { risposta.clone().text().then(function (t) { esaminaRisposta(t, url); identitaDaRisposta(url, risposta.status, t); }).catch(function () {}); } catch (e) {} }
          return risposta;
        });
      }
      if (metodo !== "GET" && metodo !== "HEAD" && typeof opzioni.body === "string" && opzioni.body.indexOf('"bench"') >= 0) {
        return preparaSalvataggio(opzioni.body, url, metodo).then(function (prep) {
          // PROVA12 A1: salvataggio bloccato da FVM = la richiesta NON parte (il sito riceve un errore, la pagina resta aperta)
          if (prep.blocca) return Promise.reject(new Error("FVM: salvataggio su FLE bloccato (squadra FLE diversa o non verificabile)"));
          if (prep.corpo !== null) args[1] = Object.assign({}, opzioni, { body: prep.corpo });
          return esegui(prep);
        });
      }
      return esegui(null);
    };
  }

  // XMLHttpRequest
  var XHR = window.XMLHttpRequest;
  var apriOriginale = XHR.prototype.open;
  var inviaOriginale = XHR.prototype.send;
  var intestazioneOriginale = XHR.prototype.setRequestHeader;
  XHR.prototype.open = function (metodo, url) {
    this.__fvmMetodo = String(metodo || "GET").toUpperCase();
    this.__fvmUrl = String(url || "");
    this.__fvmH = {};
    return apriOriginale.apply(this, arguments);
  };
  XHR.prototype.setRequestHeader = function (k, v) {
    try { if (this.__fvmH) this.__fvmH[k] = v; } catch (e) {}
    return intestazioneOriginale.apply(this, arguments);
  };
  XHR.prototype.send = function (corpo) {
    var xhr = this;
    var m = xhr.__fvmMetodo || "GET";
    try { tieniIntestazioni(xhr.__fvmUrl, xhr.__fvmH, m); } catch (e) {}
    if (m === "GET" || m === "HEAD") {
      try { xhr.addEventListener("load", function () { try { if (!xhr.responseType || xhr.responseType === "text") { esaminaRisposta(xhr.responseText, xhr.__fvmUrl); identitaDaRisposta(xhr.__fvmUrl, xhr.status, xhr.responseText); } else if (xhr.responseType === "json") { esaminaRisposta(JSON.stringify(xhr.response), xhr.__fvmUrl); identitaDaRisposta(xhr.__fvmUrl, xhr.status, JSON.stringify(xhr.response)); } } catch (e) {} }); } catch (e) {}
      return inviaOriginale.apply(xhr, arguments);
    }
    if (typeof corpo !== "string" || corpo.indexOf('"bench"') < 0 || corpo.indexOf('"starts"') < 0) return inviaOriginale.apply(xhr, arguments);
    preparaSalvataggio(corpo, xhr.__fvmUrl, m).then(function (prep) {
      // PROVA12 A1: salvataggio bloccato da FVM = la richiesta NON parte; il sito riceve un errore di rete, la pagina resta aperta
      if (prep.blocca) { try { xhr.dispatchEvent(new Event("error")); xhr.dispatchEvent(new Event("loadend")); } catch (e) {} return; }
      try {
        xhr.addEventListener("load", function () {
          var t = "";
          try { t = (!xhr.responseType || xhr.responseType === "text") ? xhr.responseText : ""; } catch (e) {}
          salvataggioRiuscito(prep.salvataggio, xhr.status >= 200 && xhr.status < 300, xhr.status, t);
        });
      } catch (e) {}
      try { inviaOriginale.call(xhr, prep.corpo !== null ? prep.corpo : corpo); } catch (e) {}
    });
  };

  // ---------------------------------------------------------------- scorrimento sulla pagina formazione (come l'app)
  (function () {
    var root = function () { return document.scrollingElement || document.documentElement; };
    function scrollerOf(el) {
      var n = el && el.nodeType === 1 ? el : (el && el.parentElement);
      while (n && n.nodeType === 1 && n !== document.body && n !== document.documentElement && n !== root()) {
        try {
          var oy = getComputedStyle(n).overflowY;
          if ((oy === "auto" || oy === "scroll" || oy === "overlay") && n.scrollHeight > n.clientHeight + 5) return n;
        } catch (e) {}
        n = n.parentElement;
      }
      return root();
    }
    var SLOP = 9, st = null, bloccaClickFino = 0, anim = 0;
    function attivo(e) { return suFormazione() && !(host && e && e.target === host); }
    function stopAnim() { if (anim) { cancelAnimationFrame(anim); anim = 0; } }
    function block(e) { try { e.stopImmediatePropagation(); } catch (x) { try { e.stopPropagation(); } catch (y) {} } }
    var opt = { capture: true, passive: true };
    window.addEventListener("touchstart", function (e) {
      try {
        if (!attivo(e) || !e.touches || e.touches.length !== 1) { st = null; return; }
        stopAnim();
        var t = e.touches[0];
        st = { sc: scrollerOf(e.target), x: t.clientX, y: t.clientY, lastY: t.clientY, lastT: Date.now(), v: 0, moved: false, manual: false };
      } catch (x) { st = null; }
    }, opt);
    window.addEventListener("touchmove", function (e) {
      try {
        if (!st) return;
        if (!e.touches || e.touches.length !== 1) { st = null; return; }
        var t = e.touches[0];
        block(e);
        var dx = t.clientX - st.x, dy = t.clientY - st.y;
        if (!st.moved) { if (Math.abs(dx) < SLOP && Math.abs(dy) < SLOP) return; st.moved = true; }
        var adesso = Date.now(), step = st.lastY - t.clientY, dt = Math.max(1, adesso - st.lastT);
        st.v = 0.8 * (step / dt) + 0.2 * st.v;
        st.lastY = t.clientY; st.lastT = adesso;
        var sc = st.sc, prima = sc.scrollTop, g = st;
        requestAnimationFrame(function () { try { if (sc.scrollTop === prima) { sc.scrollTop = prima + step; g.manual = true; } } catch (x) {} });
      } catch (x) {}
    }, opt);
    window.addEventListener("touchend", function (e) {
      try {
        if (!st) return;
        var g = st; st = null;
        if (!g.moved) return;
        block(e);
        bloccaClickFino = Date.now() + 500;
        if (g.manual && Math.abs(g.v) > 0.05) {
          var v = g.v * 16, sc = g.sc;
          var tick = function () { v *= 0.94; if (Math.abs(v) < 0.5) { anim = 0; return; } sc.scrollTop += v; anim = requestAnimationFrame(tick); };
          anim = requestAnimationFrame(tick);
        }
      } catch (x) {}
    }, opt);
    window.addEventListener("touchcancel", function () { st = null; }, opt);
    window.addEventListener("pointermove", function (e) { if (st && (e.pointerType === "touch" || !e.pointerType)) block(e); }, opt);
    window.addEventListener("pointerup", function (e) { if (!st && Date.now() < bloccaClickFino) block(e); }, opt);
    window.addEventListener("click", function (e) {
      if (Date.now() < bloccaClickFino && suFormazione()) { block(e); try { e.preventDefault(); } catch (x) {} }
    }, { capture: true });
  })();

  // ---------------------------------------------------------------- interfaccia
  var host = null, radice = null, fab = null;
  var STILE =
    ":host{all:initial}" +
    "*{box-sizing:border-box;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif}" +
    ".fab{position:fixed;right:8px;top:42%;width:46px;height:46px;border-radius:50%;background:#0d1a2e;border:2px solid #e2b33c;color:#e2b33c;font:800 12px/42px -apple-system,Arial;text-align:center;z-index:2147483646;box-shadow:0 3px 10px rgba(0,0,0,.35);cursor:pointer;-webkit-tap-highlight-color:transparent}" +
    ".ov{position:fixed;inset:0;background:#05080f;z-index:2147483647;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:calc(env(safe-area-inset-top,0px) + 10px) 12px calc(env(safe-area-inset-bottom,0px) + 24px);color:#fff}" +
    ".cd{background:#0d1a2e;border:1px solid #1b2e4d;border-radius:16px;padding:14px;margin-bottom:10px}" +
    ".lb{color:#e2b33c;font-size:12px;letter-spacing:2px;font-weight:800}" +
    ".t1{font-size:22px;font-weight:900;line-height:1.1}" +
    ".t2{font-size:19px;font-weight:900;margin:6px 0}" +
    ".mu{color:#aab3c2;font-size:13px;line-height:1.4}" +
    ".bt{display:block;width:100%;border:1px solid #2a4370;background:#14243d;color:#fff;border-radius:12px;padding:12px;font-size:13px;font-weight:800;letter-spacing:1px;text-align:center;margin-top:8px;cursor:pointer}" +
    ".bt.rosso{background:#3a1418;border-color:#6b2730}" +
    ".bt.spento{opacity:.45}" +
    ".verde{background:#0f3a24;border-color:#3fae4a;text-align:center;cursor:pointer}" +
    ".x{float:right;border:1px solid #2a4370;background:#14243d;color:#e2b33c;border-radius:10px;padding:8px 12px;font-weight:800;font-size:13px;cursor:pointer}" +
    ".riga{display:flex;align-items:center;gap:10px;padding:9px 10px;border:1px solid #1b2e4d;border-radius:12px;margin-top:6px;background:#0a1524;cursor:pointer}" +
    ".riga.on{border-color:#e2b33c}" +
    ".num{width:30px;height:30px;border-radius:50%;border:2px solid #2a4370;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:14px;color:#aab3c2;flex:none}" +
    ".num.on{background:#e2b33c;border-color:#e2b33c;color:#1b1300}" +
    ".ru{width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:12px;color:#fff;flex:none}" +
    ".nm{font-size:16px;font-weight:700}" +
    ".oro{background:#e2b33c;color:#1b1300;border-color:#e2b33c}" +
    ".toast{position:fixed;left:12px;right:12px;bottom:calc(env(safe-area-inset-bottom,0px) + 90px);background:#0f3a24;border:1px solid #3fae4a;color:#fff;border-radius:14px;padding:12px 14px;font-size:14px;font-weight:700;z-index:2147483647;text-align:center}" +
    ".toast.err{background:#3a1418;border-color:#e2333b}" +
    ".box3{display:grid;grid-template-columns:1.4fr 1fr 1fr;gap:6px;margin:8px 0}" +
    ".box{border:1px solid #1b2e4d;background:#0a1524;border-radius:12px;padding:8px;text-align:center}" +
    ".box b{display:block;font-size:20px}" +
    ".box span{font-size:10px;letter-spacing:1px;color:#aab3c2}" +
    ".pill{display:inline-block;border:1px solid #2a4370;border-radius:10px;padding:6px 10px;margin:6px 6px 0 0;font-size:13px}" +
    ".modo{display:flex;gap:6px;margin-top:10px}" +
    ".modo div{flex:1;text-align:center;border:1px solid #2a4370;border-radius:10px;padding:8px;font-size:12px;font-weight:800;color:#cfe;cursor:pointer}" +
    ".modo div.on{background:#e2b33c;color:#1b1300;border-color:#e2b33c}" +
    ".hero{min-height:150px;display:flex;align-items:center;gap:14px;padding:16px;background:linear-gradient(135deg,#0b1728,#0d2850);border:1px solid #27466f;border-radius:18px;margin-bottom:10px}" +
    ".hero img{width:42%;max-width:150px;aspect-ratio:1/1;object-fit:cover;border-radius:50%;border:3px solid #d9aa32;flex:none}" +
    ".hero .ht{font-size:25px;font-weight:950;line-height:1.05;letter-spacing:.3px}" +
    ".hero .hs{color:#aab3c2;font-size:13px;font-weight:700;margin-top:8px}" +
    ".panchinaDet{display:none}" +
    ".panchinaDet.aperta{display:block}" +
    // 1.1.0: barra della pagina formazione (selettore modalita e promemoria FLE, come l'app)
    // compatta e neutra come l'app: selettore a segmenti sempre visibile, giallo solo come accento
    ".barra{position:fixed;left:0;right:0;top:0;z-index:2147483645;background:#0d1a2e;border-bottom:1px solid #2a4370;padding:calc(env(safe-area-inset-top,0px) + 6px) 10px 6px;color:#fff;max-height:60vh;overflow-y:auto;-webkit-overflow-scrolling:touch;box-shadow:0 2px 6px rgba(0,0,0,.25)}" +
    ".barra .bh{display:flex;align-items:center;gap:8px}" +
    ".barra .seg{flex:1;min-width:0;display:flex;gap:3px;padding:3px;border:1px solid #2a4370;border-radius:11px;background:#0a1524}" +
    ".barra .seg div{flex:1;min-width:0;min-height:34px;display:flex;align-items:center;justify-content:center;text-align:center;border-radius:8px;font-size:11px;font-weight:900;letter-spacing:.5px;color:#aab3c2;cursor:pointer;white-space:nowrap;-webkit-tap-highlight-color:transparent}" +
    ".barra .seg div.on{background:#dbe7f3;color:#0b1320}" +
    ".barra .chiudi{flex:none;min-width:64px;height:40px;display:flex;align-items:center;justify-content:center;padding:0 8px;border:1px solid #2a4370;border-radius:10px;background:#14243d;color:#e2b33c;font-size:13px;font-weight:900;cursor:pointer;-webkit-tap-highlight-color:transparent}" +
    ".barra .avv{color:#f87171;font-size:12px;font-weight:800;margin-top:5px;line-height:1.35}" +
    // competizioni: UNA sola riga, scorrevole in orizzontale col dito, testo mai troncato
    ".barra .chips{display:flex;flex-wrap:nowrap;gap:6px;margin-top:5px;min-height:30px;align-items:center;overflow-x:auto;overflow-y:hidden;-webkit-overflow-scrolling:touch;scrollbar-width:none;touch-action:pan-x}" +
    ".barra .chips::-webkit-scrollbar{display:none}" +
    ".barra .chip{flex:none;border:1px solid #2a4370;border-radius:14px;padding:6px 11px;font-size:12px;font-weight:800;color:#aab3c2;background:#0a1524;cursor:pointer;white-space:nowrap}" +
    ".barra .chip.on{background:#5b6678;border-color:#8390a6;color:#fff}" +
    ".barra .regole{color:#e2b33c;font-size:11px;font-weight:700;margin-top:5px;cursor:pointer;line-height:1.35}" +
    ".barra .chip{flex-shrink:0;max-width:none;overflow:visible;text-overflow:clip}" +
    // nome della lega sopra la fascia del selettore originale: non riceve tocchi, il selettore resta quello del sito
    ".fascia{position:fixed;display:flex;align-items:center;justify-content:center;pointer-events:none;box-sizing:border-box;background:#0d1a2e;color:#e8edf5;border:1px solid #3b82c4;font-size:14px;font-weight:800;white-space:nowrap;overflow:hidden;padding:0 10px;text-align:center}" +
    ".fascia.aperta{background:#dbe7f3;color:#0b1320;border-color:#93c5fd}";

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function badge(r) { return "<span class='ru' style='background:" + (COLORE_RUOLO[r] || "#555") + "'>" + (RUOLI[r] || "?") + "</span>"; }

  function monta() {
    if (host || !document.body) return;
    host = document.createElement("div");
    host.id = "fvm-root";
    document.body.appendChild(host);
    radice = host.attachShadow ? host.attachShadow({ mode: "open" }) : host;
    // 1.3.5-RC: a ogni schermata di FVM aperta, silenzio dei lettori della pagina di Leghe Fantacalcio (vedi avviaSilenzioLeghe)
    try { if (location.hostname === "leghe.fantacalcio.it" && window.MutationObserver) new MutationObserver(function () { silenziaLegheOra(); }).observe(radice, { childList: true }); } catch (e) {}
    var st = document.createElement("style");
    st.textContent = STILE;
    radice.appendChild(st);
    fab = document.createElement("div");
    fab.className = "fab";
    fab.textContent = "FVM";
    fab.addEventListener("click", function () { apriPannello(); });
    radice.appendChild(fab);
    aggiornaFab();
  }
  // 1.1.0: nella pagina formazione il ritorno a FVM e CHIUDI nella barra: niente bottone flottante.
  function aggiornaFab() { if (fab) fab.style.display = (suLogin() || (barra && barra.isConnected)) ? "none" : "block"; }

  // ---------------------------------------------------------------- accesso al sito
  function elementoTesto(re) {
    try {
      var els = document.querySelectorAll("a,button,[role='button']");
      for (var i = 0; i < els.length; i++) {
        var t = String(els[i].innerText || els[i].textContent || "").replace(/\s+/g, " ").trim();
        if (re.test(t) && els[i].offsetParent !== null) return els[i];
      }
    } catch (e) {}
    return null;
  }
  function connesso() {
    if (suLogin()) return false;
    if (slugDaPagina()) return true;
    if (elementoTesto(/^accedi$/i)) return false;
    // Se non siamo nella pagina di login e il sito non mostra piu "ACCEDI",
    // consideriamo la sessione autenticata anche nella pagina selettore leghe.
    return true;
  }
  function accedi() {
    chiudiPannello();
    // 1.1.0: nuovo accesso (potenzialmente un altro account): via i dati legati all'account precedente
    azzeraDatiAccount("nuovo accesso");
    // Ricorda che il login e partito da Fanta Vice Mister: dopo l'autenticazione
    // riapriremo automaticamente la home FVM invece di lasciare il selettore leghe.
    sScrivi("ritorno_login", { daFvm: true, at: Date.now() });
    // 1.1.0: direttamente alla vera pagina di login del sito (non alla home pubblica)
    log("ACCESSO", "apro /login");
    location.assign("https://leghe.fantacalcio.it/login");
  }
  // 1.1.0: uscita completa (CHIUDI della Home e DISCONNETTI): vero logout del sito /logout → /login.
  // Cancella SOLO lo stato di sessione di FVM (attivita in corso, segnali di ritorno/apertura):
  // i dati FVM permanenti (lega, competizioni, storico, scelte, diagnosi) restano.
  function esciDaFvm(motivo) {
    chiudiPannello();
    try { Object.keys(sessionStorage).forEach(function (k) { if (k.indexOf(PREFISSO) === 0) sessionStorage.removeItem(k); }); } catch (e) {}
    // 1.1.0: uscita reale: via anche i dati legati all'account (il prossimo accesso puo essere un altro account)
    azzeraDatiAccount("uscita " + motivo);
    sScrivi("uscita", { motivo: motivo, at: Date.now() });
    log("USCITA avvio", motivo);
    location.assign("https://leghe.fantacalcio.it/logout");
  }
  function suLogout() { return /^\/logout/i.test(location.pathname); }
  // arrivo su /login dopo un'uscita avviata da FVM: una sola riga di diagnosi
  function uscitaCompletata() {
    var u = sLeggi("uscita");
    if (!u) return;
    if (Date.now() - Number(u.at || 0) > 60000) { sScrivi("uscita", null); return; }
    if (suLogin() && !suLogout()) { sScrivi("uscita", null); log("USCITA completata su /login", { motivo: u.motivo, pagina: location.pathname }); }
  }
  function disconnetti() {
    if (!confirm("Vuoi uscire da Leghe Fantacalcio su questo iPhone?")) return;
    esciDaFvm("disconnetti");
  }
  // 1.1.0 Fantaclub fase 3: piattaforma scelta in FVM ("fantacalcio" = Leghe Fantacalcio, predefinita, oppure "fantaclub").
  function piattaformaScelta() { return leggi("piattaforma", "fantacalcio") === "fantaclub" ? "fantaclub" : "fantacalcio"; }
  // Ogni piattaforma tiene il SUO stato FLE (controllo, competizione, scelte in corso): cambiando piattaforma
  // lo metto da parte e riprendo quello dell'altra, senza perdere nulla. Nessun logout.
  function impostaPiattaforma(p, perche) {
    p = p === "fantaclub" ? "fantaclub" : "fantacalcio";
    var prima = piattaformaScelta();
    if (p === prima) return false;
    scrivi("fle_" + prima, leggi("fle", null));
    var suo = leggi("fle_" + p, null);
    try { localStorage.removeItem(PREFISSO + "fle_" + p); if (!suo) localStorage.removeItem(PREFISSO + "fle"); } catch (e) {}
    if (suo) scrivi("fle", suo);
    scrivi("piattaforma", p);
    log("PIATTAFORMA", { da: prima, a: p, perche: perche || "" });
    return true;
  }
  // CAMBIA: solo la scelta in FVM, nessun logout da Leghe ne da Fantaclub.
  function scegliPiattaforma() {
    monta();
    if (!radice) return;
    var box = document.createElement("div");
    box.className = "ov";
    var attuale = piattaformaScelta();
    box.innerHTML = "<div class='cd'><div class='lb'>ACCESSO PIATTAFORMA</div><div class='t1' style='margin-top:6px'>Scegli la piattaforma</div>" +
      "<div class='mu' style='margin-top:6px'>Cambiare piattaforma non ti disconnette da nessun sito.</div></div>" +
      "<button class='bt" + (attuale === "fantacalcio" ? " oro" : "") + "' data-p='fantacalcio'>Leghe Fantacalcio</button>" +
      "<button class='bt" + (attuale === "fantaclub" ? " oro" : "") + "' data-p='fantaclub'>Fantaclub</button>" +
      "<button class='bt' data-p=''>ANNULLA</button>";
    radice.appendChild(box);
    Array.prototype.forEach.call(box.querySelectorAll("[data-p]"), function (b) {
      b.addEventListener("click", function () {
        var p = b.getAttribute("data-p");
        box.remove();
        if (p && p !== attuale) impostaPiattaforma(p, "CAMBIA");
        apriPannello();
      });
    });
  }
  // ACCEDI Fantaclub: apre il sito Fantaclub, che mostra la sua finestra di login (nessuna credenziale passa da FVM).
  // Passaggio verso Fantaclub senza lampeggio: la schermata FVM resta visibile con "Apro Fantaclub…" finche Safari non
  // cambia pagina (prima la Home si chiudeva subito e per un istante compariva la pagina di Leghe Fantacalcio).
  // Tornando indietro con il tasto di Safari (pagina dalla cache) la copertura si toglie da sola.
  var coperturaFc = null, coperturaAscolto = false;
  function togliApertura() { if (coperturaFc) { try { coperturaFc.remove(); } catch (e) {} coperturaFc = null; } }
  function mostraApertura(testo) {
    monta();
    if (!radice) return;
    togliApertura();
    coperturaFc = document.createElement("div");
    coperturaFc.className = "ov";
    coperturaFc.innerHTML = "<div class='cd' style='margin-top:38vh;text-align:center'><div class='t1'>" + esc(testo) + "</div><div class='mu' style='margin-top:8px'>Un attimo…</div></div>";
    radice.appendChild(coperturaFc);
    if (!coperturaAscolto) { coperturaAscolto = true; try { window.addEventListener("pageshow", function (ev) { if (ev.persisted) togliApertura(); }); } catch (e) {} }
  }
  function accediFantaclub() {
    mostraApertura("Apro Fantaclub…");
    var id = inviaPassaggio("fantaclub", "accedi", {}, "/");
    if (!id) { togliApertura(); avviso("Impossibile aprire Fantaclub"); log("FANTACLUB ACCESSO", "passaggio non partito"); return; }
    sScrivi("fc_accesso_atteso", { id: id, at: Date.now() });
    log("FANTACLUB ACCESSO", "apro www.fantaclub.it");
  }
  // 1.1.0 Fantaclub fase 4: DISCONNETTI Fantaclub = logout reale sul sito Fantaclub (fatto la, vedi ramoFantaclub).
  // Scollega SOLO Fantaclub: Leghe Fantacalcio, Storico invii e scelte restano.
  function disconnettiFantaclub() {
    if (!confirm("Vuoi uscire da Fantaclub su questo iPhone?\n\nLeghe Fantacalcio e lo Storico invii non vengono toccati.")) return;
    mostraApertura("Esco da Fantaclub…");
    var id = inviaPassaggio("fantaclub", "esci", {}, "/");
    if (!id) { togliApertura(); avviso("Impossibile aprire Fantaclub"); log("FANTACLUB USCITA", "passaggio non partito"); return; }
    sScrivi("fc_esci_atteso", { id: id, at: Date.now() });
    log("FANTACLUB USCITA", "apro www.fantaclub.it per il logout");
  }
  // dati FVM legati alla sessione Fantaclub (mai Storico invii, scelte dei sostituti, Leghe Fantacalcio)
  // (elenco dentro la funzione: viene chiamata anche dal passaggio d'arrivo, prima che il resto dello script sia pronto)
  function dimenticaFantaclub(motivo) {
    ["fc_connesso", "fc_ultima", "fc_solo_lega", "fc_errore"].forEach(function (k) { try { localStorage.removeItem(PREFISSO + k); } catch (e) {} });
    log("FANTACLUB DATI", { azione: "dati Fantaclub azzerati", motivo: motivo });
  }
  // righe della diagnosi scritte su fantaclub.it (arrivano con l'esito del passaggio)
  function registraDiagFc(righe) {
    if (!Array.isArray(righe)) return;
    righe.slice(-12).forEach(function (r) { log("FANTACLUB SITO", String(r).slice(0, 300)); });
  }
  // 1.1.0 Fantaclub fase 5: FAI O MODIFICA LA FORMAZIONE con Fantaclub = pagina Consegna della lega
  // (mai la Home o la Community di Fantaclub). Si parte sempre da LEGA + FLE, come per Leghe.
  // Lega Fantaclub: quella della pagina Consegna da cui arriva la formazione (_nl), mai una lega predefinita.
  function nomeLegaFc(nl) { nl = String(nl || ""); return FC_CIRCUITO[nl.toLowerCase()] || nl.toUpperCase(); }
  function inCircuitoFc(nl) { return !!FC_CIRCUITO[String(nl || "").toLowerCase()]; }
  // ultima lega Fantaclub usata (memorizzata solo da una formazione letta su una pagina Consegna)
  function legaFc() { var l = leggi("fc_lega", null); return l && NL_VALIDO.test(String(l.nl || "")) ? { nl: String(l.nl), nome: nomeLegaFc(l.nl) } : null; }
  // squadre della lega nella tabella delle 80 (solo leghe del circuito FLE; fuori circuito: nessuna)
  function squadreFantaclub(nl) { var lega = FC_CIRCUITO[String(nl || "").toLowerCase()]; return lega ? SQUADRE.filter(function (t) { return t[0] === lega; }) : []; }
  // CONTROLLO UNICO prima di controllo/invio FLE: lega del circuito + squadra di QUELLA lega + suo ID FLE
  function abbinamentoFcValido(f) {
    if (!f || !inCircuitoFc(f.nl) || !f.squadra || !Number(f.fleTid)) return false;
    var lega = FC_CIRCUITO[String(f.nl).toLowerCase()];
    return SQUADRE.some(function (t) { return t[0] === lega && t[1] === f.squadra && Number(t[2]) === Number(f.fleTid); });
  }
  // abbinamenti salvati prima della lega reale (es. squadra FANTAVALDINIEVOLE su una formazione TESTFANTAROCCO):
  // non verificabili -> annullati. Ricordi squadra senza lega (chiave solo sid) eliminati.
  function pulisciAbbinamentiFc() {
    var cambi = [];
    ["fc_ultima", "fc_solo_lega"].forEach(function (k) {
      var f = leggi(k, null);
      if (f && (f.squadra || f.fleTid) && !abbinamentoFcValido(f)) { delete f.squadra; delete f.fleTid; delete f.sceltaUtente; scrivi(k, f); cambi.push(k); }
    });
    var m = leggi("fc_squadre", null);
    if (m && Object.keys(m).some(function (k) { return k.indexOf(":") < 1; })) {
      var nuova = {};
      Object.keys(m).forEach(function (k) { if (k.indexOf(":") > 0) nuova[k] = m[k]; });
      scrivi("fc_squadre", nuova); cambi.push("fc_squadre");
    }
    var u = leggi("fc_ultima", null);
    ["fle", "fle_fantaclub"].forEach(function (k) {
      var fl = leggi(k, null);
      if (fl && fl.fonte === "fantaclub" && Number(fl.tid || 0) && !(abbinamentoFcValido(u) && Number(u.fleTid) === Number(fl.tid))) { scrivi(k, { stato: "attesa", fonte: "fantaclub" }); cambi.push(k); }
    });
    if (cambi.length) log("FANTACLUB ABBINAMENTI", { azione: "abbinamenti non verificati annullati", dati: cambi });
  }
  function consegnaFantaclub() {
    mostraApertura("Apro Fantaclub…");
    // RC3 (come Android): LEGA + FLE solo per una lega già riconosciuta nel circuito FLE; nuova lega = SOLO LEGA finché non è riconosciuta
    var modoFc = legaFc() && inCircuitoFc(legaFc().nl) ? "lega_fle" : "solo_lega";
    scrivi("modo", modoFc);
    try { localStorage.removeItem(PREFISSO + "fc_errore"); } catch (e) {}
    var lg = legaFc(), circuito = {};
    Object.keys(FC_CIRCUITO).forEach(function (nl) { circuito[nl] = { nome: FC_CIRCUITO[nl], squadre: squadreFantaclub(nl).map(function (t) { return t[1]; }) }; });
    // lega nota: la sua pagina Consegna; lega non ancora nota: Fantaclub, dove l'utente apre la Consegna della sua lega
    var id = inviaPassaggio("fantaclub", "consegna", { nl: lg ? lg.nl : "", lega: lg ? lg.nome : "", modo: modoFc, modoAuto: modoFc === "solo_lega", circuito: circuito },
      lg ? "/servlet/ConsegnaFormazione?_nl=" + encodeURIComponent(lg.nl) : "/");
    if (!id) { togliApertura(); avviso("Impossibile aprire Fantaclub"); log("FANTACLUB CONSEGNA", "passaggio non partito"); return; }
    sScrivi("fc_consegna_attesa", { id: id, at: Date.now() });
    log("FANTACLUB CONSEGNA", lg ? { lega: lg.nome, azione: "apro la pagina Consegna" } : { lega: "da scegliere", azione: "apro Fantaclub: l'utente apre la Consegna della sua lega" });
  }
  // FLE con Fantaclub scelto (SOLO FLE, campo FLE, MODIFICA SU FLE): ammesso SOLO per una lega Fantaclub VERIFICATA
  // (dalla pagina Consegna ufficiale) e appartenente al circuito FLE. Una sessione o le credenziali di Leghe Fantacalcio
  // NON provano nulla sulla lega di origine. Lega non ancora verificata: non e "fuori circuito", ma FLE resta bloccato.
  function fleFantaclubAmmesso(nl) {
    var l = nl === undefined ? ((legaFc() || {}).nl || "") : String(nl || "");
    if (!l || !NL_VALIDO.test(l)) return { ok: false, motivo: "non_verificata", testo: "Lega Fantaclub non ancora verificata: apri la pagina Consegna della tua lega. Nessun flusso FLE avviato." };
    if (!inCircuitoFc(l)) return { ok: false, motivo: "fuori", lega: nomeLegaFc(l), testo: "Questa lega non appartiene al circuito FLE. La formazione non può essere inviata a FLE." };
    return { ok: true, lega: nomeLegaFc(l) };
  }
  // PROVA12 A1: squadra FLE ATTESA per SOLO FLE / MODIFICA SU FLE da Fantaclub = squadra FLE abbinata alla squadra Fantaclub
  // della lega (formazione LEGA + FLE o SOLO LEGA letta dalla pagina Consegna, abbinamento lega + squadra + ID FLE valido).
  // Senza abbinamento la squadra non e verificabile: nessuna operazione FLE (SOLO LEGA resta sempre disponibile).
  function fleAttesoFc(nl) {
    var l = nl === undefined ? ((legaFc() || {}).nl || "") : String(nl || "");
    var cand = [leggi("fc_ultima", null), leggi("fc_solo_lega", null)].filter(function (c) { return c && abbinamentoFcValido(c) && (!l || String(c.nl).toLowerCase() === l.toLowerCase()); })[0];
    if (!cand) return { ok: false, motivo: "senza_squadra", testo: "Squadra FLE non verificabile: prima consegna la formazione con FAI O MODIFICA LA FORMAZIONE e scegli la tua squadra Fantaclub. Nessuna operazione su FLE; la formazione preparata resta com'è e SOLO LEGA resta disponibile." };
    return { ok: true, fleTid: Number(cand.fleTid), squadra: String(cand.squadra || ""), lega: cand.lega || nomeLegaFc(cand.nl) };
  }
  // SOLO FLE / MODIFICA SU FLE da Fantaclub: lega verificata nel circuito FLE + squadra FLE attesa nota
  function ammessoCampoFleFc(nl) {
    var es = fleFantaclubAmmesso(nl);
    if (!es.ok) return es;
    if (!identitaAttuale()) return { ok: false, motivo: "identita", testo: testoIdentita() }; // 1.3.5-RC: il campo FLE sta su Leghe Fantacalcio
    var at = fleAttesoFc(nl);
    return at.ok ? { ok: true, lega: es.lega, fleTid: at.fleTid, squadra: at.squadra } : at;
  }
  // PROVA12 A1: salvataggio sulla pagina FLE con Fantaclub in SOLO FLE / MODIFICA SU FLE (non l'invio di FVM, che ha i suoi
  // controlli): ammesso SOLO se la formazione che il sito sta salvando e della squadra FLE attesa. Ritorna il motivo del blocco
  // ("" = ammesso). La pagina NON viene chiusa: la formazione preparata resta sulla pagina, il salvataggio non parte.
  function bloccoSalvataggioFc(o) {
    if (!suFle() || window.__fvmInvio || piattaformaScelta() !== "fantaclub" || leggi("modo", "lega_fle") !== "solo_fle") return "";
    var at = fleAttesoFc(), tid = Number(o && o.tid || ctl.payload && ctl.payload.tid || 0);
    if (!at.ok) return at.testo;
    if (!tid) return "Squadra della formazione FLE non leggibile: salvataggio NON eseguito. La formazione resta sulla pagina; ricarica la pagina e riprova.";
    if (tid !== at.fleTid) return "Su FLE questo account sta salvando la squadra " + tid + ", non la tua (" + at.squadra + ", squadra FLE " + at.fleTid + "): salvataggio NON eseguito. Entra in Leghe Fantacalcio con l'account della tua squadra FLE.";
    return "";
  }
  // PROVA12 A1: sulla pagina formazione FLE (SOLO FLE / MODIFICA SU FLE da Fantaclub) squadra diversa o non verificabile =
  // avviso chiaro e salvataggi bloccati (bloccoSalvataggioFc). Nessuna chiusura della pagina, nessun cambio di modalita.
  function guardiaCampoFleFc() {
    if (!suFle() || !suFormazione() || sLeggi("task") || window.__fvmInvio || piattaformaScelta() !== "fantaclub" || leggi("modo", "lega_fle") !== "solo_fle") return false;
    var pl = ctl.payload;
    if (!pl || !pl.tid) return false;
    var at = fleAttesoFc();
    if (at.ok && Number(pl.tid) === at.fleTid) { sScrivi("fc_guardia", null); return false; }
    var testo = at.ok ? "Su FLE questo account mostra la squadra " + pl.tid + ", non la tua (" + at.squadra + ", squadra FLE " + at.fleTid + "): FVM blocca il salvataggio. La pagina resta aperta e nulla viene salvato; entra con l'account della tua squadra FLE. SOLO LEGA resta disponibile."
      : at.testo;
    var prima = sLeggi("fc_guardia");
    sScrivi("fc_guardia", { at: Date.now(), atteso: at.ok ? at.fleTid : 0, letto: Number(pl.tid), comp: Number(pl.comp || 0), testo: testo });
    if (!prima || Number(prima.letto) !== Number(pl.tid)) {
      log("GUARDIA FLE", { piattaforma: "fantaclub", atteso: at.ok ? at.fleTid : 0, letto: Number(pl.tid), comp: pl.comp, esito: "salvataggio bloccato, pagina aperta" });
      try { var mF = sLeggi("storico_modifica"); storicoBloccato(mF && Date.now() - Number(mF.at || 0) < 2 * 3600000 ? "modifica_fle" : "solo_fle", (legaFc() || {}).nl || "", at.ok ? "squadra FLE diversa (" + pl.tid + " invece di " + at.fleTid + ")" : "squadra FLE non verificabile"); } catch (e) {}
      avviso(testo, true); // una volta per squadra letta; a ogni tentativo di salvataggio l'avviso si ripete
    }
    return true;
  }
  // RIPETI CONTROLLO FLE con Fantaclub: lega selezionata, nel circuito FLE, formazione completa di QUELLA lega con
  // abbinamento valido (lega + squadra + ID FLE). Solo visibilita: i blocchi di controllo/invio restano quelli di sempre.
  function ricontrollaFcAmmesso() {
    var lg = legaFc(), c = leggi("fc_ultima", null);
    return !!(lg && inCircuitoFc(lg.nl) && c && String(c.nl || "").toLowerCase() === lg.nl.toLowerCase() &&
      abbinamentoFcValido(c) && (c.titolari || []).length === 11);
  }
  // CAMBIA LEGA FANTACLUB (esplicito): la prossima consegna riparte da Fantaclub; formazione e abbinamenti della lega
  // precedente non vengono riusati (i ricordi squadra restano legati alla loro lega)
  function cambiaLegaFc() {
    var lg = legaFc();
    if (!confirm("Cambiare lega Fantaclub?\n\nLa formazione Fantaclub letta" + (lg ? " (" + lg.nome + ")" : "") + " non verrà più usata per FLE. Con FAI O MODIFICA apri la Consegna della nuova lega.")) return;
    ["fc_lega", "fc_ultima", "fc_solo_lega", "fc_errore"].forEach(function (k) { try { localStorage.removeItem(PREFISSO + k); } catch (e) {} });
    var fl = leggi("fle", null);
    if (fl && fl.fonte === "fantaclub") scrivi("fle", { stato: "attesa", fonte: "fantaclub" });
    log("FANTACLUB LEGA", { azione: "CAMBIA LEGA", prima: lg ? lg.nome : "nessuna" });
  }
  // fase 7: squadra Fantaclub -> squadra FLE (tabella delle 80 squadre, come l'app). Mai un'associazione a caso e
  // mai fuori dalla lega della formazione: 1) quella gia confermata per lega + sid, 2) una sola squadra della lega
  // vista nella pagina Consegna, 3) altrimenti sceglie l'utente tra le squadre di QUELLA lega.
  function riconosciSquadraFc(f) {
    if (!f.nl) return { t: null, come: "lega non riconosciuta" };
    var squadre = squadreFantaclub(f.nl);
    if (!squadre.length) return { t: null, come: "lega fuori dal circuito FLE" };
    var nome = function (n) { return squadre.filter(function (t) { return t[1] === n; })[0] || null; };
    var mappa = leggi("fc_squadre", {}) || {}, chiave = String(f.nl).toLowerCase() + ":" + f.idSquadra;
    if (f.idSquadra && mappa[chiave] && nome(mappa[chiave])) return { t: nome(mappa[chiave]), come: "squadra gia confermata" };
    var viste = squadre.filter(function (t) { return (f.viste || []).indexOf(t[1]) >= 0; });
    if (viste.length === 1) {
      if (f.idSquadra) { mappa[chiave] = viste[0][1]; scrivi("fc_squadre", mappa); }
      return { t: viste[0], come: "nome nella pagina Consegna" };
    }
    return { t: null, come: viste.length > 1 ? "piu squadre nella pagina" : "squadra non vista nella pagina" };
  }
  function impostaSquadraFc(nomeSq) {
    var f = leggi("fc_ultima", null);
    if (!f || !inCircuitoFc(f.nl)) return;
    var t = squadreFantaclub(f.nl).filter(function (x) { return x[1] === nomeSq; })[0];
    if (!t) return;
    f.squadra = t[1]; f.fleTid = Number(t[2]); f.sceltaUtente = true;
    scrivi("fc_ultima", f);
    if (f.idSquadra) { var mappa = leggi("fc_squadre", {}) || {}; mappa[String(f.nl).toLowerCase() + ":" + f.idSquadra] = t[1]; scrivi("fc_squadre", mappa); }
    var fl = leggi("fle", {}) || {};
    if (fl.fonte === "fantaclub" && Number(fl.tid || 0) && Number(fl.tid) !== f.fleTid) scrivi("fle", { stato: "attesa", fonte: "fantaclub" });
    log("FANTACLUB SQUADRA", { scelta: t[1], fleTid: f.fleTid, come: "scelta utente" });
  }
  // PROVA12: limite sicuro di lettura della panchina Fantaclub (e della panchina registrata nello storico)
  function panchinaFcMax() { return 30; }
  // fase 6: formazione letta su Fantaclub (passaggio "formazione"). Solo nomi, squadre (3 lettere) e stato.
  function riceviFormazioneFc(d) {
    sScrivi("apri", "main");
    if (piattaformaScelta() !== "fantaclub") impostaPiattaforma("fantaclub", "formazione Fantaclub");
    var consegna = d.come === "consegna";
    // lega vera della pagina Consegna: ricordata per il prossimo FAI O MODIFICA (solo da una pagina Consegna aperta)
    var nl = NL_VALIDO.test(String(d.nl || "")) ? String(d.nl) : "";
    if (nl) {
      var primaLega = legaFc();
      scrivi("fc_lega", { nl: nl, at: Date.now() });
      if (!primaLega || primaLega.nl !== nl) log("FANTACLUB LEGA", { lega: nomeLegaFc(nl), circuito: inCircuitoFc(nl) ? "FLE" : "fuori", prima: primaLega ? primaLega.nome : "nessuna" });
    }
    if (d.errore) {
      scrivi("fc_errore", { at: Date.now(), testo: String(d.errore).slice(0, 200), consegna: consegna });
      log("FANTACLUB FORMAZIONE", { esito: "non letta", come: d.come, errore: String(d.errore).slice(0, 200) });
      sScrivi("flash", (consegna ? "Consegna fatta su Fantaclub ✓, ma " : "") + "formazione non letta");
      return;
    }
    // PROVA12: panchina Fantaclub fino a 30 (prima 15: dal 16° panchinaro in poi i giocatori venivano scartati); oltre: diagnosi
    var pulisci = function (arr, max) {
      max = max || 15;
      if (Array.isArray(arr) && arr.length > max) log("FANTACLUB FORMAZIONE", { avviso: "giocatori oltre il limite di lettura", letti: max, nellaPagina: arr.length });
      return (Array.isArray(arr) ? arr : []).slice(0, max).map(function (p) {
        return { n: String(p && p.n || "").slice(0, 40), c: String(p && p.c || "").replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase(), s: String(p && p.s || "").replace(/[^A-Za-z]/g, "").slice(0, 2).toUpperCase(), o: !!(p && p.o) };
      }).filter(function (p) { return p.n; });
    };
    var f = { at: Date.now(), come: consegna ? "consegna" : "lettura", nl: nl, lega: nl ? nomeLegaFc(nl) : "", modulo: String(d.modulo || "").replace(/\D/g, "").slice(0, 3),
      titolari: pulisci(d.titolari), panchina: pulisci(d.panchina, panchinaFcMax()), idSquadra: String(d.idSquadra || "").replace(/\D/g, "").slice(0, 12),
      viste: (Array.isArray(d.squadreViste) ? d.squadreViste : []).map(String).slice(0, 10) };
    var testo = function (l) { return l.map(function (p) { return p.n + (p.c ? " " + p.c : "") + (p.s ? " (" + p.s + ")" : ""); }).join(", "); };
    log("FANTACLUB FORMAZIONE", { come: f.come, modo: d.modo, lega: f.lega || "non riconosciuta", circuito: inCircuitoFc(nl) ? "FLE" : "fuori", modulo: f.modulo, titolari: f.titolari.length, panchina: f.panchina.length });
    log("FANTACLUB TITOLARI", testo(f.titolari));
    log("FANTACLUB PANCHINA", testo(f.panchina));
    try { localStorage.removeItem(PREFISSO + "fc_errore"); } catch (e) {}
    if (f.titolari.length !== 11 || f.modulo.length !== 3) {
      scrivi("fc_errore", { at: Date.now(), consegna: consegna, testo: "letti " + f.titolari.length + " titolari e " + f.panchina.length + " panchinari" + (f.modulo.length === 3 ? "" : ", modulo non letto") });
      sScrivi("flash", (consegna ? "Consegna fatta su Fantaclub ✓, ma " : "") + "formazione letta male: manda la diagnosi");
      return;
    }
    var sq = riconosciSquadraFc(f);
    if (sq.t) { f.squadra = sq.t[1]; f.fleTid = Number(sq.t[2]); }
    log("FANTACLUB SQUADRA", { squadra: f.squadra || "da scegliere", come: sq.come, viste: f.viste });
    if (d.modo === "solo_lega") {
      // SOLO LEGA: resta solo su Fantaclub; la formazione LEGA + FLE e il suo controllo restano com'erano.
      // Cambio lega (es. lega fuori circuito, ora sempre SOLO LEGA): formazione e abbinamento FLE della lega
      // PRECEDENTE non vengono piu usati.
      var ultimaAltra = leggi("fc_ultima", null);
      if (nl && ultimaAltra && ultimaAltra.nl && String(ultimaAltra.nl).toLowerCase() !== nl.toLowerCase()) {
        try { localStorage.removeItem(PREFISSO + "fc_ultima"); } catch (e) {}
        var flAltra = leggi("fle", null);
        if (flAltra && flAltra.fonte === "fantaclub") scrivi("fle", { stato: "attesa", fonte: "fantaclub" });
        log("FANTACLUB LEGA", { azione: "formazione della lega precedente non più usata", prima: ultimaAltra.lega || "nessuna", ora: f.lega });
      }
      scrivi("fc_solo_lega", f);
      log("SOLO LEGA", { piattaforma: "fantaclub", lega: f.lega, squadra: f.squadra || "" });
      sScrivi("flash", consegna ? "Formazione consegnata solo su Fantaclub ✓" : "Formazione letta ✓ · solo nella tua lega");
      return;
    }
    try { localStorage.removeItem(PREFISSO + "fc_solo_lega"); } catch (e) {}
    usaFormazioneFc(f, consegna);
  }
  // nuova formazione Fantaclub per LEGA + FLE: controllo FLE da rifare (competizione FLE gia nota conservata)
  function usaFormazioneFc(f, consegna) {
    scrivi("fc_ultima", f);
    var valido = abbinamentoFcValido(f);
    var prima = leggi("fle", {}) || {};
    var stessa = valido && prima.fonte === "fantaclub" && Number(prima.tid || 0) === Number(f.fleTid);
    scrivi("fle", { stato: "attesa", fonte: "fantaclub", comp: stessa ? Number(prima.comp || 0) : 0, compName: stessa ? prima.compName || "" : "", tid: stessa ? Number(prima.tid) : 0, squadra: stessa ? prima.squadra || "" : "" });
    if (valido) sScrivi("fc_controllo_dopo", Date.now());
    var base = consegna ? "Formazione consegnata su Fantaclub ✓" : "Formazione letta ✓";
    sScrivi("flash", !f.nl ? base + " · lega non riconosciuta: nessun invio FLE"
      : !inCircuitoFc(f.nl) ? base
      : base + (valido ? " · la controllo per FLE…" : " · scegli la tua squadra"));
  }

  // ---------------------------------------------------------------- STORICO INVII UNIFICATO
  // Una voce per OPERAZIONE dell'utente, con un esito separato per ogni destinazione (lega, FLE): LEGA + FLE = una sola
  // voce con due esiti. "confermata" nasce SOLO da una conferma osservata: risposta del sito al salvataggio (Leghe, FLE),
  // pagina Fantaclub "consegnata correttamente", risposta del server FLE all'invio di FVM. Una formazione soltanto letta
  // o preparata non crea voci. Se la conferma non e sicura: "non_verificata" (mai un successo inventato).
  // Scritture isolate: tutto in try/catch, nessuna attesa, nessuna modifica a richieste o navigazione.
  // Memoria: localStorage fvm_storico_v1; le vecchie chiavi "invii" e "storico" restano intatte (migrazione per copia).
  function storicoCfg() { return { chiave: "storico_v1", max: 120, conFormazione: 15, unione: 10 * 60000 }; }
  function storicoTutto() {
    try { var s = leggi(storicoCfg().chiave, null); return Array.isArray(s) ? s.filter(function (x) { return x && typeof x === "object" && x.id; }) : []; } catch (e) { return []; }
  }
  function storicoSalva(lista) {
    var cfg = storicoCfg();
    lista.sort(function (a, b) { return Number(b.creato || 0) - Number(a.creato || 0); });
    lista = lista.slice(0, cfg.max);
    // titolari e panchina solo nelle voci piu recenti (memoria leggera)
    lista.forEach(function (x, i) { if (i >= cfg.conFormazione && x.formazione) delete x.formazione; });
    try { localStorage.setItem(PREFISSO + cfg.chiave, JSON.stringify(lista)); return true; } catch (e) {}
    // memoria piena: via le formazioni dettagliate e le voci piu vecchie, le operazioni recenti restano
    try { lista.forEach(function (x) { delete x.formazione; }); localStorage.setItem(PREFISSO + cfg.chiave, JSON.stringify(lista.slice(0, 60))); return true; } catch (e) { return false; }
  }
  // crea o aggiorna l'operazione "id": "base" = dati dell'operazione (sovrascritti solo se presenti), "esiti" =
  // { lega: {...}, fle: {...} }. Un esito "confermata" non viene mai declassato: i tentativi successivi non riusciti
  // restano come tentativi. Restituisce l'operazione (o null se non registrata).
  function storicoAggiorna(id, base, esiti) {
    try {
      if (!id) return null;
      var lista = storicoTutto(), op = null, ora = Date.now();
      for (var i = 0; i < lista.length; i++) if (lista[i].id === id) { op = lista[i]; break; }
      if (!op) { op = { v: 1, id: String(id).slice(0, 60), origine: "safari", versione: VERSIONE, creato: ora, stagione: storicoStagione(ora), destinazioni: {} }; lista.push(op); }
      Object.keys(base || {}).forEach(function (k) { var v = base[k]; if (v !== undefined && v !== null && v !== "" && !(typeof v === "number" && !v)) op[k] = v; });
      op.destinazioni = op.destinazioni || {};
      Object.keys(esiti || {}).forEach(function (dest) {
        var n = Object.assign({}, esiti[dest], { at: ora }), d = op.destinazioni[dest];
        Object.keys(n).forEach(function (k) { if (n[k] === undefined || n[k] === "") delete n[k]; });
        if (!d) { op.destinazioni[dest] = n; return; }
        if (d.esito === "confermata") {
          if (n.esito === "confermata") {
            d.conferme = Number(d.conferme || 1) + 1; d.ultimaConferma = ora;
            // PROVA11: ogni invio ripetuto conservato (ora, risposta, Switch della risposta); la prima consegna resta com'era
            d.invii = (Array.isArray(d.invii) ? d.invii : [{ at: Number(d.at) || 0, prova: d.prova || "" }]).concat([{ at: ora, prova: n.prova || "", switch: n.switch && n.switch.stato ? n.switch.stato + (n.switch.a ? " " + n.switch.a + "-" + n.switch.b : "") : undefined }]).slice(-10);
          }
          else if (n.esito === "errore" || n.esito === "non_verificata" || n.esito === "bloccata") d.tentativi = (d.tentativi || []).concat([{ at: ora, esito: n.esito, motivo: n.motivo || "" }]).slice(-5);
          return;
        }
        // esito precedente non definitivo: sostituito; errori e blocchi precedenti restano come tentativi
        var prima = d.tentativi || [];
        if (d.esito === "errore" || d.esito === "non_verificata" || d.esito === "bloccata") prima = prima.concat([{ at: d.at, esito: d.esito, motivo: d.motivo || "" }]);
        if (prima.length) n.tentativi = prima.slice(-5);
        op.destinazioni[dest] = n;
      });
      op.aggiornato = ora;
      storicoSalva(lista);
      var es = {}; Object.keys(op.destinazioni).forEach(function (k) { es[k] = op.destinazioni[k].esito; });
      log("STORICO", { op: op.id, modalita: op.modalita || "", esiti: es });
      return op;
    } catch (e) {
      try { log("STORICO", { esito: "non registrato", errore: String(e && e.message || e).slice(0, 120) }); } catch (x) {}
      return null;
    }
  }
  // operazione recente (stessa formazione appena risalvata, ritorno dalla pagina ufficiale): stessa voce, niente doppioni
  function storicoRecente(prova) {
    var ora = Date.now(), cfg = storicoCfg();
    return storicoTutto().filter(function (x) { try { return ora - Number(x.aggiornato || x.creato || 0) < cfg.unione && prova(x); } catch (e) { return false; } })[0] || null;
  }
  // S2: stagione calcolata dalla data dell'operazione (agosto-luglio), dichiarata come tale nella scheda
  function storicoStagione(at) {
    var d = new Date(Number(at) || 0);
    if (!Number(at) || isNaN(d.getTime())) return "";
    var y = d.getMonth() >= 7 ? d.getFullYear() : d.getFullYear() - 1;
    return y + "/" + String(y + 1).slice(-2);
  }
  // S2: lega di origine di una squadra FLE dalla tabella ufficiale delle 80 squadre (lega in cui gioca davvero):
  // Fantaclub se la lega e nel circuito Fantaclub, Leghe Fantacalcio se e tra le leghe sorgente; altrimenti nessuna
  function storicoLegaOrigineFle(fleTid) {
    var t = SQUADRE.filter(function (x) { return Number(x[2]) === Number(fleTid); })[0];
    if (!Number(fleTid) || !t) return undefined;
    var nl = Object.keys(FC_CIRCUITO).filter(function (k) { return FC_CIRCUITO[k] === t[0]; })[0];
    if (nl) return { piattaforma: "fantaclub", id: nl, nome: t[0], fonte: "tabella squadre FLE" };
    var lf = LEGHE_FONTE.filter(function (l) { return l[0] === t[0]; })[0];
    return lf ? { piattaforma: "fantacalcio", id: lf[1], nome: t[0], fonte: "tabella squadre FLE" } : { nome: t[0], fonte: "tabella squadre FLE" };
  }
  // S2: giornata della COMPETIZIONE (cmday del salvataggio), distinta dalla giornata di Serie A (mday)
  function storicoGiornataComp(o) { return o && Number(o.cmday) > 0 ? Number(o.cmday) : undefined; }
  // PROVA9 · GIORNATE (verificato con l'invio reale del 20/10: mday 3 = giornata della competizione FLE, cmday 8 = Serie A;
  // ricognizione 9/10: lega mday 3, cmday 6 = league/status.mday). Voci nuove (schemaGiornate 2): giornataSA nella voce,
  // giornataComp in ogni destinazione. Voci precedenti: la giornata delle destinazioni era cmday (Serie A, valore certo);
  // quella della voce era ambigua (mday della lega oppure di FLE): mostrata cosi com'e, mai rinumerata.
  function storicoGiornataSerieA(o) { return o && Number(o.cmday) > 0 ? Number(o.cmday) : undefined; }
  function storicoGiornataCompetizione(o) { return o && Number(o.mday) > 0 ? Number(o.mday) : undefined; }
  function storicoSerieA(x) {
    if (!x) return 0;
    if (x.schemaGiornate === 2) return Number(x.giornataSA) || 0;
    var d = x.destinazioni || {};
    return Number((d.lega && d.lega.giornata) || (d.fle && d.fle.giornata) || 0) || 0;
  }
  // PROVA9 · SWITCH della consegna: i valori di QUELLA consegna (mai sostituiti da uno successivo). In campo / in panchina
  // dalla formazione della consegna (mai dedotto da swtcA/swtcB); swtcMdl mostrato come «Modulo indicato con lo SWITCH».
  function storicoSwitch(sw, tit, pan, fonte) {
    if (!sw) return undefined;
    var s = { stato: sw.stato === "presente" || sw.stato === "assente" ? sw.stato : "sconosciuto", fonte: String(fonte || sw.fonte || "") };
    if (s.stato !== "presente") return s;
    var t = (tit || []).map(Number), p = (pan || []).map(Number), nomeDi = function (pid) { var x = info[pid]; return x && x.n ? String(x.n).slice(0, 40) : ""; };
    s.a = Number(sw.a) || 0; s.b = Number(sw.b) || 0; s.nomeA = nomeDi(s.a); s.nomeB = nomeDi(s.b); s.mdl = fvmSwModulo(sw.valori && sw.valori.swtcMdl);
    if (t.indexOf(s.a) >= 0 && p.indexOf(s.b) >= 0) { s.inCampo = s.a; s.inPanchina = s.b; }
    else if (t.indexOf(s.b) >= 0 && p.indexOf(s.a) >= 0) { s.inCampo = s.b; s.inPanchina = s.a; }
    return s;
  }
  function storicoSwitchUguale(x, y) { return !!(x && y && x.stato === y.stato && (x.stato !== "presente" || (x.a === y.a && x.b === y.b && x.mdl === y.mdl))); }
  function storicoSwitchRighe(s) {
    if (!s || s.stato === "assente") return [];
    if (s.stato !== "presente") return ["Switch: " + DATO_ND];
    var nome = function (pid) { return (pid === s.a ? s.nomeA : s.nomeB) || "#" + pid; }, r = [];
    if (s.inCampo) { r.push("In campo: " + nome(s.inCampo)); r.push("In panchina: " + nome(s.inPanchina)); }
    else r.push("Giocatori: " + nome(s.a) + " ↔ " + nome(s.b) + " (posizione in formazione non registrata)");
    if (s.mdl && s.mdl.length >= 3) r.push("Modulo indicato con lo SWITCH: " + s.mdl.split("").join("-"));
    if (s.verifica) r.push(s.verifica === "ok" ? "Verificato su FLE ✓" : s.verifica === "diverso" ? "Su FLE risulta diverso da quello inviato" : "Verifica su FLE non riuscita");
    return r;
  }
  // blocco SWITCH CONSEGNATO sotto la panchina: uno solo se Lega e FLE coincidono, altrimenti LEGA e FLE separati; voci
  // precedenti: "non registrato" solo dentro FORMAZIONE (fuori = true: nulla, per non riempire lo storico)
  function storicoSwitchHtml(x, fuori) {
    if (!x || x.schemaGiornate !== 2) return fuori ? "" : "<div class='mu' style='margin-top:6px;font-size:12px'>Switch: non registrato (voce di una versione precedente di FVM)</div>";
    var d = x.destinazioni || {}, sL = d.lega && d.lega.switch, sF = d.fle && d.fle.switch, vF = d.fle && d.fle.switchVerifica;
    if (sF && (vF === "ok" || vF === "diverso" || vF === "non_letto")) sF = Object.assign({}, sF, { verifica: vF });
    var blocco = function (titolo, s) { var r = storicoSwitchRighe(s); return r.length ? "<div style='margin-top:8px'><div class='lb' style='font-size:11px'>" + esc(titolo) + "</div>" + r.map(function (t) { return "<div class='mu'>" + esc(t) + "</div>"; }).join("") + "</div>" : ""; };
    // RC3 (come Android): la destinazione è sempre scritta (lo Switch della lega non è «consegnato» anche su FLE)
    if (sL && sF && storicoSwitchUguale(sL, sF)) return blocco("SWITCH CONSEGNATO IN LEGA E SU FLE", sF);
    return blocco("SWITCH CONSEGNATO IN LEGA", sL) + blocco("SWITCH CONSEGNATO SU FLE", sF);
  }
  // competizioni FLE della consegna: istantanea (iscritte, coinvolte dal comando) + esito individuale della rilettura
  function storicoCompetizioniHtml(e) {
    var ist = Array.isArray(e && e.competizioniFle) ? e.competizioniFle : null, ver = Array.isArray(e && e.competizioniVerifica) ? e.competizioniVerifica : null;
    if (!ist && !ver) return "";
    var perId = {}, elenco = (ist || []).slice();
    (ver || []).forEach(function (r) { perId[r.id] = r; if (!elenco.some(function (c) { return c.id === r.id; })) elenco.push(r); });
    var ESITI = { verificata: ["VERIFICATA ✓", "#4ade80"], diversa: ["DIVERSA", "#f87171"], da_verificare: ["DA VERIFICARE", "#fbbf24"], senza_turno: ["SENZA TURNO", "#aab3c2"], classifica: ["CLASSIFICA (nessuna formazione)", "#aab3c2"] };
    var coinv = elenco.filter(function (c) { return c.coinvolta; }).length, verif = elenco.filter(function (c) { return perId[c.id] && perId[c.id].esito === "verificata"; }).length;
    var h = "<div class='mu' style='font-size:12px;margin-top:2px'>Competizioni FLE · iscritte: " + elenco.length + " · coinvolte dal comando: " + coinv + " · verificate: " + (ver ? verif : "verifica individuale non eseguita") + "</div>";
    elenco.forEach(function (c) {
      var r = perId[c.id], es = r ? ESITI[r.esito] || [String(r.esito || "").toUpperCase(), "#aab3c2"] : c.natura === "ranking" ? ESITI.classifica : ["NON VERIFICATA", "#aab3c2"];
      var giorn = r && r.esito === "verificata" && Number(r.giornata) > 0 ? " · " + Number(r.giornata) + "ª giornata FLE" : "";
      var dett = r && r.esito === "diversa" && r.differenze ? ": " + r.differenze.join(", ") : r && r.esito !== "verificata" && r.motivo ? ": " + r.motivo : c.nota ? ": " + c.nota : "";
      if (r && r.ultima) dett += " · ultima lettura " + storicoData(r.ultima.at) + ": " + String(r.ultima.esito || "").replace("_", " ") + (r.ultima.motivo ? " (" + r.ultima.motivo + ")" : ""); // PROVA11
      h += "<div style='font-size:12px;margin-top:2px'>• <span style='color:#e8edf5'>" + esc((c.nome || "competizione " + c.id) + (c.ingresso ? " (ingresso)" : "") + giorn) + "</span> · <span style='color:" + es[1] + ";font-weight:800'>" + esc(es[0]) + "</span><span class='mu'>" + esc(dett) + "</span></div>";
    });
    return h;
  }
  // PROVA9 · ISTANTANEA delle competizioni FLE note al momento dell'invio (elenco competizioni del sito, nessun nome fisso):
  // iscritte = la squadra e tra le squadre della competizione; coinvolte dal comando SALVA PER TUTTE = iscritte, attive,
  // non classifiche (Ranking). L'esito individuale arriva solo dalla rilettura (verificaCompetizioniFle).
  function storicoCompetizioniFle(comps, fleTid, ingresso) {
    if (!Array.isArray(comps) || !comps.length || !Number(fleTid)) return undefined;
    var out = [];
    comps.forEach(function (c) {
      if (!c || !Number(c.id) || c.del) return;
      var tm = Array.isArray(c.tmids) ? c.tmids.map(Number) : null;
      if (!tm || tm.indexOf(Number(fleTid)) < 0) return;
      var nat = naturaCompetizione(c);
      out.push({ id: Number(c.id), nome: String(c.name || c.nome || c.id).slice(0, 60), natura: nat, coinvolta: nat === "obbligo", ingresso: Number(c.id) === Number(ingresso) });
    });
    return out.length ? out : undefined;
  }
  // PROVA10 · CRITERIO DETERMINISTICO delle voci, mai l'ora (la PROVA9 confondeva o duplicava le voci secondo il millisecondo):
  //  - "posto" = destinazione della consegna: LEGA = lega, modalita, squadra, competizione, giornata di Serie A e della
  //    competizione; FLE = squadra FLE, competizione d'ingresso e giornate (comune a invii FVM, SOLO FLE e MODIFICA SU FLE);
  //  - "impronta" = modulo, titolari, panchina IN ORDINE e Switch;
  //  - una consegna e un DOPPIONE (= conferma della stessa voce) solo con lo stesso posto, la stessa impronta e lo stesso tipo
  //    di operazione dell'ULTIMA consegna di quel posto, stabilita dal numero d'ordine crescente "seq" (non dall'ora):
  //    A → B → B unisce la seconda B, A → B → A crea una voce nuova (cronologia conservata). Voci precedenti (senza posto):
  //    mai unite, mai modificate. Identificativi delle voci nuove con il numero d'ordine: mai uguali per caso.
  function storicoProssimoSeq() { var n = (Number(leggi("storico_seq", 0)) || 0) + 1; scrivi("storico_seq", n); return n; }
  function storicoImprontaConsegna(modulo, tit, pan, sw) {
    return fvmSwModulo(modulo) + "|" + (tit || []).map(Number).join(",") + "|" + (pan || []).map(Number).join(",") + "|S:" + (sw ? fvmSwImpronta(sw) : "?");
  }
  function storicoPostoLega(slug, modo, tid, comp, o) { return ["L", String(slug || "").toLowerCase(), String(modo || ""), Number(tid) || 0, Number(comp) || 0, storicoGiornataSerieA(o) || "?", storicoGiornataCompetizione(o) || "?"].join("|"); }
  function storicoPostoFle(fleTid, comp, o) { return ["F", Number(fleTid) || 0, Number(comp) || 0, storicoGiornataSerieA(o) || "?", storicoGiornataCompetizione(o) || "?"].join("|"); }
  function storicoUltimaDelPosto(dest, posto) {
    var best = null;
    storicoTutto().forEach(function (x) { var d = x.destinazioni && x.destinazioni[dest]; if (d && d.posto === posto && Number(d.seq) > 0 && (!best || Number(d.seq) > Number(best.d.seq))) best = { x: x, d: d }; });
    return best;
  }
  // PROVA9 · aggiunge dati a una destinazione di una voce gia registrata (verifiche arrivate dopo l'esito), senza toccare
  // l'esito e senza contare una conferma in piu (storicoAggiorna conterebbe una conferma ripetuta)
  function storicoArricchisci(id, dest, campi) {
    try {
      if (!id || !dest || !campi) return null;
      var lista = storicoTutto(), op = lista.filter(function (x) { return x.id === id; })[0];
      if (!op) return null;
      op.destinazioni = op.destinazioni || {};
      var d = op.destinazioni[dest] = op.destinazioni[dest] || {};
      Object.keys(campi).forEach(function (k) { if (campi[k] !== undefined) d[k] = campi[k]; });
      op.aggiornato = Date.now();
      storicoSalva(lista);
      log("STORICO", { op: op.id, arricchita: dest, campi: Object.keys(campi) });
      return op;
    } catch (e) { return null; }
  }
  // PROVA11 · VERIFICHE della consegna FLE: ogni verifica (dopo l'invio, dopo un invio ripetuto, RIPROVA VERIFICA) si
  // AGGIUNGE all'elenco "verifiche" (ultime 10); l'esito di riferimento non passa mai da «ok» a «non_letto» (una lettura
  // fallita non cancella una verifica riuscita); una competizione gia verificata resta tale se la nuova lettura non riesce.
  // Voci registrate dalla PROVA9/10: la verifica gia presente diventa la prima dell'elenco, senza inventare dati.
  function storicoVerificaAggiungi(id, rSw, rComp, tipo) {
    try {
      if (!id || (!rSw && !rComp)) return null;
      var lista = storicoTutto(), op = lista.filter(function (x) { return x.id === id; })[0];
      if (!op) return null;
      op.destinazioni = op.destinazioni || {};
      var d = op.destinazioni.fle = op.destinazioni.fle || {}, ora = Date.now();
      var breve = function (l) { return (l || []).map(function (c) { return { id: Number(c.id) || 0, nome: String(c.nome || "").slice(0, 60), esito: c.esito, motivo: c.motivo ? String(c.motivo).slice(0, 100) : undefined }; }); };
      if (!Array.isArray(d.verifiche)) {
        d.verifiche = [];
        if (d.switchVerifica || Array.isArray(d.competizioniVerifica)) d.verifiche.push({ at: Number(d.verificaAt) || 0, tipo: "registrata da una versione precedente", conferma: 1, switch: d.switchVerifica, competizioni: Array.isArray(d.competizioniVerifica) ? breve(d.competizioniVerifica) : undefined });
      }
      d.verifiche.push({ at: ora, tipo: String(tipo || "verifica"), conferma: Number(d.conferme) || 1, switch: rSw ? rSw.esito : undefined, motivo: rSw && rSw.motivo ? String(rSw.motivo).slice(0, 100) : undefined,
        tentativi: rSw && Number(rSw.tentativi) || undefined, competizioni: rComp ? breve(rComp) : undefined });
      d.verifiche = d.verifiche.slice(-10);
      if (rSw && (rSw.esito === "ok" || rSw.esito === "diverso" || !d.switchVerifica || d.switchVerifica === "non_letto")) d.switchVerifica = rSw.esito;
      if (rComp && rComp.length) {
        var prec = Array.isArray(d.competizioniVerifica) ? d.competizioniVerifica : [];
        var definitivo = function (e) { return ["verificata", "diversa", "senza_turno", "classifica"].indexOf(e) >= 0; };
        var nuove = rComp.map(function (c) {
          var p = prec.filter(function (x) { return Number(x.id) === Number(c.id); })[0];
          if (p && definitivo(p.esito) && !definitivo(c.esito)) return Object.assign({}, p, { ultima: { at: ora, esito: c.esito, motivo: c.motivo ? String(c.motivo).slice(0, 100) : undefined } });
          return c;
        });
        prec.forEach(function (p) { if (!nuove.some(function (x) { return Number(x.id) === Number(p.id); })) nuove.push(p); });
        d.competizioniVerifica = nuove;
      }
      d.verificaAt = ora;
      op.aggiornato = ora;
      storicoSalva(lista);
      log("STORICO", { op: op.id, verifica: tipo || "", switch: rSw ? rSw.esito : "", competizioni: rComp ? rComp.length : 0, verifiche: d.verifiche.length });
      return op;
    } catch (e) { return null; }
  }
  // PROVA11: righe delle verifiche di una consegna FLE (storico): esito di riferimento + ultima verifica se diversa + elenco
  function storicoVerificheHtml(e) {
    var v = e && Array.isArray(e.verifiche) ? e.verifiche : null;
    if (!v || !v.length) return "";
    var testo = function (x) {
      var sw = x.switch === "ok" ? "Switch verificato ✓" : x.switch === "diverso" ? "Switch DIVERSO" : x.switch === "non_letto" ? "Switch non verificabile" + (x.motivo ? " (" + x.motivo + ")" : "") : "";
      var c = Array.isArray(x.competizioni) ? x.competizioni.filter(function (k) { return k.esito === "verificata"; }).length + "/" + x.competizioni.length + " competizioni verificate" : "";
      return [Number(x.at) ? storicoData(x.at) : "", x.tipo, x.conferma > 1 ? "consegna confermata " + x.conferma + " volte" : "", sw, c].filter(Boolean).join(" · ");
    };
    var h = "<div class='mu' style='font-size:12px;margin-top:4px'>Verifiche su FLE (sola lettura): " + v.length + "</div>";
    v.slice().reverse().forEach(function (x, i) { h += "<div class='mu' style='font-size:12px'>" + (i === 0 ? "• ultima: " : "• ") + esc(testo(x)) + "</div>"; });
    return h;
  }
  function storicoImpronta(modulo, tit, pan) { return String(modulo || "") + "|" + (tit || []).join(",") + "|" + (pan || []).join(","); }
  // messaggio leggibile della risposta (solo i campi di testo "message"/"error", mai intestazioni o altri dati)
  function storicoMessaggio(testo) {
    try {
      var j = JSON.parse(testo || "null");
      if (!j || typeof j !== "object") return "";
      var m = j.message || (typeof j.error === "string" ? j.error : j.error && j.error.message) || (Array.isArray(j.errors) && j.errors[0] && (j.errors[0].message || j.errors[0])) || "";
      return typeof m === "string" ? m.replace(/[<>]/g, "").slice(0, 120) : "";
    } catch (e) { return ""; }
  }
  // esito osservato di un salvataggio: confermata (risposta OK), errore (risposta KO), non_verificata (risposta OK ma
  // con un messaggio di errore del sito: FVM non lo considera un successo)
  function storicoRisposta(ok, stato, testo, chi) {
    var msg = storicoMessaggio(testo), prova = "risposta " + chi + (stato ? " " + stato : "");
    if (!ok) return { esito: "errore", motivo: chi + " non ha confermato il salvataggio" + (stato ? " (stato " + stato + ")" : "") + (msg ? ": " + msg : ""), prova: prova };
    var j = null; try { j = JSON.parse(testo || "null"); } catch (e) {}
    if (j && typeof j === "object" && (j.success === false || (j.error && j.error !== "") || (Array.isArray(j.errors) && j.errors.length)))
      return { esito: "non_verificata", motivo: chi + " ha risposto" + (stato ? " " + stato : "") + " ma con un messaggio di errore" + (msg ? ": " + msg : ""), prova: prova };
    return { esito: "confermata", prova: prova };
  }
  function storicoNomiLeghe(ids) {
    var nomi = (ids || []).map(function (id) { return String((info[id] && info[id].n) || ""); });
    return nomi.filter(function (n) { return !n; }).length > 2 ? null : nomi;
  }
  // salvataggi intercettati su leghe.fantacalcio.it (lega di Leghe Fantacalcio, oppure campo FLE con SOLO FLE / MODIFICA)
  function storicoSalvataggio(dati, ok, stato, testo) {
    try {
      if (!dati || dati.tipo === "fle") return; // invio FLE fatto da FVM: lo registra fineInvio
      var o = null; try { o = trovaFormazione(JSON.parse(dati.corpo || "null"), 0); } catch (e) {}
      var giornata = o && Number(o.mday) > 0 ? Number(o.mday) : 0;
      var tit = (dati.titolari || []).slice(0, 11), pan = (dati.panchina || []).slice(0, panchinaFcMax()); // PROVA12: prima 15
      var t = storicoNomiLeghe(tit), p = storicoNomiLeghe(pan);
      var formazione = t && p ? { titolari: t, panchina: p } : undefined;
      var imp = storicoImpronta(dati.modulo, tit, pan), comp = Number(dati.comp || 0);
      // PROVA9: stessa formazione con uno Switch diverso = consegna diversa (voce separata, Switch di ciascuna conservato)
      if (dati.sw && dati.sw.stato !== "sconosciuto") imp += "|S:" + fvmSwImpronta(dati.sw);
      if (dati.suFle) {
        var mod = sLeggi("storico_modifica");
        var modalita = mod && Date.now() - Number(mod.at || 0) < 2 * 3600000 ? "modifica_fle" : "solo_fle";
        var f = leggi("fle", {}) || {}, sq = SQUADRE.filter(function (x) { return Number(x[2]) === Number(dati.tid); })[0];
        var nomeComp = (leggi("comps_" + FLE_SLUG, []).filter(function (c) { return Number(c.id) === comp; })[0] || {}).name || (Number(f.comp) === comp ? f.compName || "" : "");
        var esito = storicoRisposta(ok, stato, testo, "FLE");
        esito.competizioni = comp ? [{ id: comp, nome: String(nomeComp).slice(0, 60) }] : undefined;
        if (o && "allComp" in o) esito.tutte = o.allComp === true || o.allComp === 1;
        if (o && "visb" in o) esito.invisibile = o.visb === false || o.visb === 0;
        // PROVA9: giornata della competizione FLE (mday) e Switch salvato a mano con la pagina ufficiale FLE
        esito.giornataComp = storicoGiornataCompetizione(o);
        esito.switch = storicoSwitch(dati.sw, tit, pan, "salvataggio FLE");
        // PROVA10: stessa voce solo se e la stessa consegna dell'ULTIMA dello stesso posto FLE (criterio deterministico)
        var postoF = storicoPostoFle(dati.tid, comp, o), impF = storicoImprontaConsegna(dati.modulo, tit, pan, dati.sw), seqF = storicoProssimoSeq();
        var ultF = storicoUltimaDelPosto("fle", postoF), precF = ultF && ultF.d.impronta === impF && ultF.x.modalita === modalita ? ultF.x : null;
        var idF = precF ? precF.id : "fle-" + dati.at + "-" + seqF;
        storicoAggiorna(idF, { piattaforma: piattaformaScelta(), modalita: modalita, lega: { id: FLE_SLUG, nome: "FANTALEGAEUROPA (FLE)" }, legaOrigine: storicoLegaOrigineFle(dati.tid),
          squadra: { nome: sq ? sq[1] : String(f.squadra || ""), fleTid: Number(dati.tid) || 0 }, modulo: String(dati.modulo || ""), schemaGiornate: 2, giornataSA: storicoGiornataSerieA(o), impronta: imp, formazione: formazione,
          ordine: precF ? undefined : seqF },
          { lega: { esito: "non_prevista", motivo: modalita === "solo_fle" ? "SOLO FLE" : "modifica della sola formazione FLE" }, fle: esito });
        storicoArricchisci(idF, "fle", { posto: postoF, impronta: impF, seq: seqF });
        return;
      }
      var slug = String(dati.lega || ""), solo = leggi("modo", "lega_fle") === "solo_lega", modo = solo ? "solo_lega" : "lega_fle";
      var map = trovaFleTid(dati.tid), lega = storicoRisposta(ok, stato, testo, "il sito della lega");
      var pzS = partecipantiLega(slug), psS = pzS && pzS[Number(dati.tid)];
      var nomeCompL = (leggi("comps_" + slug, []).filter(function (c) { return Number(c.id) === comp; })[0] || {}).name || "";
      lega.competizioni = comp ? [{ id: comp, nome: String(nomeCompL).slice(0, 60) }] : undefined;
      // PROVA9: giornata della competizione di lega (mday) e Switch salvato nella lega con questa consegna
      lega.giornataComp = storicoGiornataCompetizione(o);
      lega.switch = storicoSwitch(dati.sw, tit, pan, "salvataggio nella lega");
      var fle = solo ? { esito: "non_prevista", motivo: "SOLO LEGA" }
        : lega.esito !== "confermata" ? { esito: "non_inviata", motivo: "la lega non ha confermato il salvataggio" }
        : map ? { esito: "non_inviata" } : { esito: "non_prevista", motivo: "squadra non nel circuito FLE" };
      // PROVA10: stessa voce solo se e la stessa consegna dell'ULTIMA dello stesso posto di lega (criterio deterministico)
      var postoL = storicoPostoLega(slug, modo, dati.tid, comp, o), impL = storicoImprontaConsegna(dati.modulo, tit, pan, dati.sw), seqL = storicoProssimoSeq();
      var ultL = storicoUltimaDelPosto("lega", postoL), prec = ultL && ultL.d.impronta === impL && ultL.x.piattaforma === "fantacalcio" ? ultL.x : null;
      var idL = prec ? prec.id : "lg-" + dati.at + "-" + seqL;
      storicoAggiorna(idL, { piattaforma: "fantacalcio", modalita: modo, lega: { id: slug, nome: nomeLega(slug) }, ordine: prec ? undefined : seqL,
        squadra: { nome: map ? map.squadra : psS ? psS.nome : "", idSorgente: Number(dati.tid) || 0, fleTid: map ? map.fleTid : 0 }, modulo: String(dati.modulo || ""), schemaGiornate: 2, giornataSA: storicoGiornataSerieA(o),
        account: psS && psS.allenatori && psS.allenatori.length ? { nome: psS.allenatori.join(", "), fonte: "allenatori della squadra (partecipanti della lega)" } : undefined,
        impronta: imp, formazione: formazione, rif: lega.esito === "confermata" && !solo ? "fantacalcio:" + dati.at : undefined }, { lega: lega, fle: fle });
      storicoArricchisci(idL, "lega", { posto: postoL, impronta: impL, seq: seqL });
    } catch (e) { try { log("STORICO", { esito: "non registrato", errore: String(e && e.message || e).slice(0, 120) }); } catch (x) {} }
  }
  // esito dell'invio FLE fatto da FVM (PASSO 3 / CONFERMA E INVIA): stessa voce della consegna nella lega
  // PROVA9: extra = { inv: formazione inviata da FVM (con la decisione Switch), comps: elenco competizioni FLE della pagina }
  function storicoInvioFle(ok, stato, testo, extra) {
    try {
      extra = extra || {};
      var f = leggi("fle", {}) || {}, u = formazioneSorgente() || {};
      var piatt = u.fonte === "fantaclub" ? "fantaclub" : "fantacalcio", rif = piatt + ":" + Number(u.at || 0);
      var op = Number(u.at || 0) ? storicoTutto().filter(function (x) { return x.rif === rif; })[0] || null : null;
      var esito = storicoRisposta(ok, stato, testo, "FLE");
      if (!ok && !esito.motivo) esito.motivo = "FLE non ha confermato il salvataggio";
      if (!ok && testo && !storicoMessaggio(testo) && !/^\s*[{[]/.test(String(testo))) esito.motivo = "FLE: " + String(testo).replace(/[<>]/g, "").slice(0, 120);
      esito.competizioni = Number(f.comp) ? [{ id: Number(f.comp), nome: String(f.compName || "").slice(0, 60) }] : undefined;
      // FVM salva sempre su tutte le competizioni, invisibile (riscriviPerFle)
      esito.tutte = true; esito.invisibile = true;
      // PROVA9: giornate e Switch dalla RISPOSTA del salvataggio FLE (cio che FLE ha registrato per la competizione
      // d'ingresso); se la risposta non li ha, restano non registrati (mai presi da una lettura precedente)
      var rs = null; try { rs = trovaFormazione(JSON.parse(testo || "null"), 0); } catch (e) { rs = null; }
      if (rs && Number(rs.idcomp) && Number(f.comp) && Number(rs.idcomp) !== Number(f.comp)) rs = null;
      esito.giornataComp = storicoGiornataCompetizione(rs);
      var inv = extra.inv || {};
      var swRs = rs ? fvmSwLeggi(rs, "risposta FLE") : null;
      if ((!swRs || swRs.stato === "sconosciuto") && inv.sw && inv.sw.valori) swRs = fvmSwLeggi(Object.assign({ tid: f.tid, idcomp: f.comp }, inv.sw.valori, { swtcA: inv.sw.valori.swtcA, swtcB: inv.sw.valori.swtcB }), "scritto da FVM");
      if (swRs) esito.switch = storicoSwitch(swRs, inv.starts || (rs ? (rs.starts || []).map(idDi) : []), inv.bench || (rs ? (rs.bench || []).map(idDi) : []), swRs.fonte);
      // istantanea delle competizioni note ORA (elenco competizioni letto sulla pagina FLE): non cambia piu
      var ist = storicoCompetizioniFle(extra.comps, Number(f.tid), Number(f.comp));
      if (ist) { esito.competizioniFle = ist; esito.istantaneaAt = Date.now(); }
      var base = { schemaGiornate: 2, giornataSA: storicoGiornataSerieA(rs) };
      // PROVA10: scelta DETERMINISTICA della voce (mai l'ora). 1) primo invio a FLE della consegna di lega collegata -> quella
      // voce; 2) stesso posto FLE, stessa impronta e stesso tipo dell'ULTIMO invio di quel posto -> conferma di quella voce;
      // 3) altrimenti (Switch o formazione diversi, ritorno a una configurazione precedente) -> voce SEPARATA, le altre restano
      var postoF = storicoPostoFle(Number(f.tid), Number(f.comp), rs);
      var titF = rs && Array.isArray(rs.starts) ? rs.starts.map(idDi) : (inv.starts || []), panF = rs && Array.isArray(rs.bench) ? rs.bench.map(idDi) : (inv.bench || []);
      var impF = storicoImprontaConsegna((rs && rs.mdl) || inv.mdl || u.modulo, titF, panF, swRs), seqF = storicoProssimoSeq();
      var giaFle = op && op.destinazioni && op.destinazioni.fle && op.destinazioni.fle.esito === "confermata", dove = null;
      if (op && !giaFle) dove = op;
      else { var ultF = storicoUltimaDelPosto("fle", postoF); if (ultF && ultF.d.impronta === impF && ultF.x.modalita === "lega_fle") dove = ultF.x; }
      if (!dove || !dove.squadra || !dove.squadra.nome) base.squadra = { nome: String(f.squadra || u.squadra || ""), fleTid: Number(f.tid) || 0 };
      if (dove && dove.modalita === "solo_lega") { base.modalita = "lega_fle"; base.nota = "SOLO LEGA, poi MANDA ANCHE A FLE"; }
      if (dove) { storicoAggiorna(dove.id, base, { fle: esito }); storicoArricchisci(dove.id, "fle", { posto: postoF, impronta: impF, seq: seqF }); return dove.id; }
      var sl = String(u.nl || legaCorrente() || ""), id = "fle-" + Date.now() + "-" + seqF;
      if (op) base.nota = "nuovo invio a FLE della stessa consegna di lega, con formazione o Switch diverso dall'invio precedente";
      base.ordine = seqF;
      storicoAggiorna(id, Object.assign(base, { piattaforma: piatt, modalita: "lega_fle", lega: sl ? { id: sl, nome: u.nl ? u.lega || nomeLegaFc(sl) : nomeLega(sl) } : undefined, modulo: String(u.modulo || "") }),
        { lega: op ? { esito: "non_prevista", motivo: "consegna nella lega: vedi la voce precedente della stessa formazione" } : { esito: "non_registrata", motivo: "consegna nella lega non presente nello storico" }, fle: esito });
      storicoArricchisci(id, "fle", { posto: postoF, impronta: impF, seq: seqF });
      return id;
    } catch (e) { try { log("STORICO", { esito: "non registrato", errore: String(e && e.message || e).slice(0, 120) }); } catch (x) {} return null; }
  }
  // consegna Fantaclub arrivata con il passaggio "formazione" (dopo riceviFormazioneFc). Solo "consegna" (pagina
  // "consegnata correttamente" vista su Fantaclub): una formazione soltanto letta (LEGGI) non crea voci.
  function storicoConsegnaFc(d, prima) {
    try {
      if (!d || d.come !== "consegna") return;
      var nl = NL_VALIDO.test(String(d.nl || "")) ? String(d.nl) : "", solo = d.modo === "solo_lega";
      var f = leggi(solo ? "fc_solo_lega" : "fc_ultima", null);
      var letta = !!(f && Number(f.at || 0) >= Number(prima || 0) && Array.isArray(f.titolari));
      var err = leggi("fc_errore", null);
      var fle = solo ? { esito: "non_prevista", motivo: "SOLO LEGA" }
        : !letta ? { esito: "bloccata", motivo: "formazione non letta da Fantaclub" + (err && err.testo ? ": " + String(err.testo).slice(0, 100) : d.errore ? ": " + String(d.errore).slice(0, 100) : "") }
        : !nl ? { esito: "bloccata", motivo: "lega Fantaclub non verificata" }
        : !inCircuitoFc(nl) ? { esito: "non_prevista", motivo: "lega fuori dal circuito FLE" }
        : { esito: "non_inviata", motivo: abbinamentoFcValido(f) ? "" : "squadra FLE da scegliere" };
      storicoAggiorna("fc-" + String(d.idConsegna || Date.now()).replace(/[^\w-]/g, "").slice(0, 40), {
        piattaforma: "fantaclub", modalita: solo ? "solo_lega" : "lega_fle", lega: nl ? { id: nl, nome: nomeLegaFc(nl) } : undefined,
        squadra: letta ? { nome: String(f.squadra || d.squadraNome || ""), idSorgente: String(f.idSquadra || ""), fleTid: Number(f.fleTid) || 0 } : (d.squadraNome ? { nome: String(d.squadraNome) } : undefined),
        account: (function () { var mp = nl ? leggi("fc_squadre_account_" + nl.toLowerCase(), null) : null, sqn = String((letta && f.squadra) || d.squadraNome || ""), a = mp && mp.account && mp.account[sqn]; return a ? { nome: a, fonte: "pagina Squadre di Fantaclub" } : undefined; })(),
        modulo: letta ? String(f.modulo || "") : "", rif: letta ? "fantaclub:" + f.at : undefined,
        impronta: letta ? storicoImpronta(f.modulo, f.titolari.map(function (x) { return x.n; }), (f.panchina || []).map(function (x) { return x.n; })) : undefined,
        formazione: letta ? { titolari: f.titolari.map(function (x) { return x.n; }), panchina: (f.panchina || []).map(function (x) { return x.n; }) } : undefined
      }, { lega: { esito: "confermata", prova: "pagina Fantaclub \"consegnata correttamente\"" }, fle: fle });
    } catch (e) { try { log("STORICO", { esito: "non registrato", errore: String(e && e.message || e).slice(0, 120) }); } catch (x) {} }
  }
  // tentativo verso FLE bloccato da FVM (lega fuori circuito o non verificata): registrato con il suo motivo
  function storicoBloccato(modalita, nl, motivo, rif) {
    try {
      var op = rif ? storicoTutto().filter(function (x) { return x.rif === rif; })[0] : null;
      if (op) { storicoAggiorna(op.id, null, { fle: { esito: "bloccata", motivo: String(motivo || "").slice(0, 160) } }); return; }
      var prec = storicoRecente(function (x) { return x.bloccata && x.modalita === modalita && ((x.lega && x.lega.id) || "") === String(nl || ""); });
      storicoAggiorna(prec ? prec.id : "blk-" + Date.now(), { piattaforma: piattaformaScelta(), modalita: modalita, bloccata: true, lega: nl ? { id: String(nl), nome: nomeLegaFc(nl) } : undefined },
        { lega: { esito: "non_prevista" }, fle: { esito: "bloccata", motivo: String(motivo || "").slice(0, 160) } });
    } catch (e) {}
  }
  // MIGRAZIONE (una volta): copia "invii" (invii FLE riusciti) e "storico" (salvataggi in lega riusciti) delle versioni
  // precedenti. Le chiavi originali NON vengono toccate; id fissi = nessun doppione anche se ripetuta.
  function storicoMigra() {
    try {
      if (leggi("storico_migrato_v1", null)) return;
      var lista = storicoTutto(), ids = {}, nuove = 0;
      lista.forEach(function (x) { ids[x.id] = true; });
      var vecchiS = (leggi("storico", []) || []).filter(function (s) { return s && Number(s.at); });
      var vecchiI = (leggi("invii", []) || []).filter(function (s) { return s && Number(s.at); });
      var usati = {};
      vecchiS.forEach(function (s) {
        // invio FLE della stessa formazione entro 30 minuti: stessa operazione (LEGA + FLE)
        var inv = vecchiI.filter(function (i) { return !usati[i.at] && Number(i.at) >= Number(s.at) && Number(i.at) - Number(s.at) < 30 * 60000 && String(i.modulo || "") === String(s.modulo || ""); })[0];
        var id = "mig-s-" + s.at;
        if (inv) usati[inv.at] = true;
        if (ids[id]) return;
        ids[id] = true; nuove++;
        lista.push({ v: 1, id: id, origine: "safari", migrata: true, creato: Number(s.at), aggiornato: Number(inv ? inv.at : s.at), piattaforma: "fantacalcio", modalita: "lega_fle",
          lega: s.lega ? { id: String(s.lega), nome: nomeLega(s.lega) } : undefined, squadra: inv && inv.squadra ? { nome: String(inv.squadra) } : undefined, modulo: String(s.modulo || ""),
          destinazioni: { lega: { esito: "confermata", at: Number(s.at), prova: "salvataggio registrato dalla versione precedente" },
            fle: inv ? { esito: "confermata", at: Number(inv.at), prova: "invio registrato dalla versione precedente", competizioni: Number(inv.comp) ? [{ id: Number(inv.comp), nome: String(inv.compName || "") }] : undefined, tutte: true, invisibile: true }
              : { esito: "non_registrata" } } });
      });
      vecchiI.forEach(function (i) {
        var id = "mig-i-" + i.at;
        if (usati[i.at] || ids[id]) return;
        ids[id] = true; nuove++;
        lista.push({ v: 1, id: id, origine: "safari", migrata: true, creato: Number(i.at), aggiornato: Number(i.at), piattaforma: i.fonte === "fantaclub" ? "fantaclub" : "fantacalcio", modalita: "lega_fle",
          squadra: i.squadra ? { nome: String(i.squadra) } : undefined, modulo: String(i.modulo || ""),
          destinazioni: { lega: { esito: "non_registrata" }, fle: { esito: "confermata", at: Number(i.at), prova: "invio registrato dalla versione precedente", competizioni: Number(i.comp) ? [{ id: Number(i.comp), nome: String(i.compName || "") }] : undefined, tutte: true, invisibile: true } } });
      });
      if (nuove && !storicoSalva(lista)) return; // memoria piena: riprovo al prossimo avvio
      scrivi("storico_migrato_v1", { at: Date.now(), voci: nuove });
      log("STORICO MIGRAZIONE", { voci: nuove, invii: vecchiI.length, salvataggi: vecchiS.length, originali: "intatti" });
    } catch (e) { try { log("STORICO MIGRAZIONE", { esito: "non riuscita", errore: String(e && e.message || e).slice(0, 120) }); } catch (x) {} }
  }

  // ---- STORICO: presentazione (Home: una riga + esiti; elenco completo con filtro e pulizia selettiva)
  var ESITO_STORICO = { confermata: ["✓ CONFERMATA", "#4ade80"], errore: ["✗ NON RIUSCITA", "#f87171"], bloccata: ["⛔ BLOCCATA", "#fb923c"], non_inviata: ["— NON INVIATA", "#fbbf24"], non_verificata: ["? NON VERIFICATA", "#fbbf24"], non_prevista: ["— NON PREVISTA", "#7d8799"], non_registrata: ["· NON REGISTRATA", "#7d8799"] };
  var MODALITA_STORICO = { lega_fle: "LEGA + FLE", solo_lega: "SOLO LEGA", solo_fle: "SOLO FLE", modifica_fle: "MODIFICA SU FLE" };
  function storicoData(at) { try { var d = new Date(Number(at)); return d.toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit" }) + " " + d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }); } catch (e) { return ""; } }
  function storicoChip(nome, d, sempre) {
    if (!d || (!sempre && d.esito === "non_prevista")) return "";
    var e = ESITO_STORICO[d.esito] || ["? " + String(d.esito || "").toUpperCase(), "#fbbf24"];
    return "<span style='color:" + e[1] + ";white-space:nowrap'>" + nome + " " + e[0] + "</span>";
  }
  function storicoChips(x, sempre) {
    var d = x.destinazioni || {};
    return [storicoChip("LEGA", d.lega, sempre), storicoChip("FLE", d.fle, sempre)].filter(Boolean).join(" · ");
  }
  // S1 · presentazione: squadra, lega, account e piattaforma sempre separati. Un dato mancante e "DATO NON DISPONIBILE":
  // mai la lega al posto della squadra, mai un nome inventato. Solo lettura delle voci: la struttura dei dati non cambia.
  var DATO_ND = "DATO NON DISPONIBILE";
  var PIATTAFORMA_STORICO = { fantaclub: "Fantaclub", fantacalcio: "Leghe Fantacalcio" };
  function storicoSquadra(x) {
    var n = String((x && x.squadra && x.squadra.nome) || "").trim();
    if (n || !x || x.piattaforma !== "fantacalcio" || !x.lega || !x.squadra || !Number(x.squadra.idSorgente)) return n;
    var pz = partecipantiLega(String(x.lega.id || "")), p = pz && pz[Number(x.squadra.idSorgente)];
    return p && p.nome ? p.nome : "";
  }
  function storicoLegaNome(x) { return String((x && x.lega && (x.lega.nome || x.lega.id)) || "").trim(); }
  // account e lega di origine: le voci registrate finora non li contengono (letti solo se presenti)
  function storicoAccount(x) {
    var a = x && x.account, n = String((a && typeof a === "object" ? a.nome : a) || "").trim();
    if (n) return n;
    try {
      if (x && x.piattaforma === "fantacalcio" && x.lega && x.squadra && Number(x.squadra.idSorgente)) { var pz = partecipantiLega(String(x.lega.id || "")), p = pz && pz[Number(x.squadra.idSorgente)]; if (p && p.allenatori && p.allenatori.length) return p.allenatori.join(", ") + " (allenatori della squadra)"; }
      if (x && x.piattaforma === "fantaclub" && x.lega && storicoSquadra(x)) { var mp = leggi("fc_squadre_account_" + String(x.lega.id || "").toLowerCase(), null), ac = mp && mp.account && mp.account[storicoSquadra(x)]; if (ac) return ac + " (pagina Squadre)"; }
    } catch (e) {}
    return "";
  }
  function storicoLegaOrigine(x) {
    var o = x && x.legaOrigine, n = String((o && typeof o === "object" ? o.nome || o.id : o) || "").trim();
    return n && o && PIATTAFORMA_STORICO[o.piattaforma] ? n + " · " + PIATTAFORMA_STORICO[o.piattaforma] : n;
  }
  function storicoTitolo(x) {
    return storicoData(x.creato) + " · " + (storicoSquadra(x) || DATO_ND) + (x.modulo ? " · " + String(x.modulo).split("").join("-") : "");
  }
  // chiavi composite: la lega = piattaforma che la ospita + id (FLE sta su Leghe Fantacalcio), la squadra = lega + nome,
  // la competizione = lega + id. Stessi codici o nomi su piattaforme o leghe diverse restano separati.
  function storicoChiaveLega(x) {
    var id = String((x && x.lega && x.lega.id) || "").toLowerCase();
    if (!id) return "";
    return (id === FLE_SLUG ? "fantacalcio" : String(x.piattaforma || "?")) + "|" + id;
  }
  function storicoChiaveSquadra(x) {
    var n = storicoSquadra(x);
    return n ? (storicoChiaveLega(x) || "senza-lega|" + String(x.piattaforma || "?")) + "|" + n : "";
  }
  function storicoCompetizioni(x) {
    var out = [], d = (x && x.destinazioni) || {};
    ["lega", "fle"].forEach(function (dest) {
      var e = d[dest], base = dest === "fle" ? "fantacalcio|" + FLE_SLUG : storicoChiaveLega(x);
      if (!e || !Array.isArray(e.competizioni) || !base) return;
      e.competizioni.forEach(function (c) {
        if (c && Number(c.id)) out.push({ k: base + "|" + Number(c.id), nome: String(c.nome || "") || "competizione " + Number(c.id), dove: dest === "fle" ? "FLE" : storicoLegaNome(x) });
      });
    });
    return out;
  }
  // filtri indipendenti: piattaforma, lega, squadra, competizione, giornata ("" = tutte)
  var GRUPPI_STORICO = [["p", "PIATTAFORMA", "TUTTE"], ["l", "LEGA", "TUTTE LE MIE LEGHE"], ["s", "SQUADRA", "TUTTE"], ["c", "COMPETIZIONE", "TUTTE"], ["g", "GIORNATA", "TUTTE"]];
  function storicoValori(x, g) {
    if (g === "p") return x.piattaforma ? [{ k: String(x.piattaforma), nome: PIATTAFORMA_STORICO[x.piattaforma] || String(x.piattaforma).toUpperCase() }] : [];
    if (g === "l") { var l = storicoChiaveLega(x); return l ? [{ k: l, nome: storicoLegaNome(x), dove: PIATTAFORMA_STORICO[l.split("|")[0]] || "" }] : []; }
    if (g === "s") { var s = storicoChiaveSquadra(x); return s ? [{ k: s, nome: storicoSquadra(x), dove: storicoLegaNome(x) || DATO_ND }] : []; }
    if (g === "c") return storicoCompetizioni(x);
    // PROVA9: giornata di Serie A (cmday); il numero ambiguo delle voci precedenti non entra nel filtro
    if (g === "g") return storicoSerieA(x) > 0 ? [{ k: String(storicoSerieA(x)), nome: "GIORNATA " + storicoSerieA(x) + " SERIE A" }] : [];
    return [];
  }
  function storicoFiltriScelti() {
    var F = sLeggi("storico_filtri"), out = {};
    GRUPPI_STORICO.forEach(function (g) { out[g[0]] = F && typeof F[g[0]] === "string" ? F[g[0]] : ""; });
    return out;
  }
  function storicoNelFiltro(x, F, salta) {
    F = F || {};
    return GRUPPI_STORICO.every(function (g) {
      var k = g[0];
      return k === salta || !F[k] || storicoValori(x, k).some(function (v) { return v.k === F[k]; });
    });
  }
  // valori di un gruppo presenti nelle voci che rispettano gli ALTRI filtri; nomi uguali distinti dalla lega/piattaforma
  function storicoOpzioni(tutte, F, g) {
    var visti = {}, out = [];
    tutte.forEach(function (x) {
      if (!storicoNelFiltro(x, F, g)) return;
      storicoValori(x, g).forEach(function (v) { if (!visti[v.k]) { visti[v.k] = 1; out.push(v); } });
    });
    var conta = {};
    out.forEach(function (v) { conta[v.nome] = (conta[v.nome] || 0) + 1; });
    out.forEach(function (v) { if (conta[v.nome] > 1 && v.dove) v.nome += " · " + v.dove; });
    if (F[g] && !visti[F[g]]) out.unshift({ k: F[g], nome: "(scelta precedente)" });
    return out;
  }
  // lega in uso (piattaforma scelta + lega), con la stessa chiave composita delle voci
  function storicoLegaInUso() {
    var fc = piattaformaScelta() === "fantaclub", id = fc ? (legaFc() || {}).nl : legaCorrente();
    id = String(id || "").toLowerCase();
    return id ? (id === FLE_SLUG ? "fantacalcio" : fc ? "fantaclub" : "fantacalcio") + "|" + id : "";
  }
  // carta STORICO INVII della Home: ultima operazione della lega in uso; se la lega in uso non ne ha, l'ultima in
  // assoluto DICHIARATA come operazione di un'altra lega (mai attribuita alla lega in uso)
  function cartaStorico() {
    var tutte = storicoTutto();
    if (!tutte.length) return "<div class='mu' style='margin-top:6px'>Nessuna operazione registrata su questo iPhone.</div><div class='mu' style='margin-top:4px'>Qui compaiono le consegne confermate dalla lega e da FLE.</div>";
    var inUso = storicoLegaInUso(), mie = inUso ? tutte.filter(function (x) { return storicoChiaveLega(x) === inUso; }) : [], x = mie[0] || tutte[0];
    var altra = !mie.length && !!inUso;
    return "<div class='mu' style='margin-top:6px;font-weight:800;color:#e8edf5'>" + esc(MODALITA_STORICO[x.modalita] || "OPERAZIONE") + (altra ? " · <span style='color:#fbbf24'>ALTRA LEGA</span>" : "") + "</div>" +
      "<div id='fvm-ultimo' style='font-weight:800;font-size:13px;white-space:nowrap;overflow:hidden'>" + esc(storicoTitolo(x)) + "</div>" +
      "<div class='mu' style='font-size:12px'>" + esc("Lega: " + (storicoLegaNome(x) || DATO_ND) + " · " + (PIATTAFORMA_STORICO[x.piattaforma] || DATO_ND)) + "</div>" +
      (altra ? "<div class='mu' style='font-size:12px'>Nessuna operazione registrata nella lega in uso.</div>" : "") +
      "<div style='font-size:13px;font-weight:800;margin-top:4px;line-height:1.5'>" + storicoChips(x, false) + "</div>" +
      "<button class='bt' data-a='storico'>APRI STORICO (" + tutte.length + ")</button>";
  }
  function apriStorico() {
    monta();
    if (!radice) return;
    chiudiPannello();
    pannelloPrincipale = false;
    pannello = document.createElement("div");
    pannello.className = "ov";
    radice.appendChild(pannello);
    disegnaStorico();
  }
  function storicoRiga(nome, valore) {
    return "<div class='mu'>" + esc(nome) + ": " + (valore ? "<span style='color:#e8edf5'>" + esc(valore) + "</span>" : "<span style='color:#fbbf24'>" + DATO_ND + "</span>") + "</div>";
  }
  function disegnaStorico() {
    if (!pannello) return;
    var tutte = storicoTutto(), F = storicoFiltriScelti(), lista = tutte.filter(function (x) { return storicoNelFiltro(x, F); });
    var attivi = GRUPPI_STORICO.some(function (g) { return !!F[g[0]]; });
    var h = "<div class='cd'><button class='x' data-a='indietro'>INDIETRO</button><div class='t1'>STORICO INVII</div>" +
      "<div class='mu' style='margin-top:6px'>Su questo iPhone, tutte le leghe. ✓ solo con conferma del sito o del server; le formazioni soltanto lette non compaiono.</div></div>";
    if (tutte.length) {
      GRUPPI_STORICO.forEach(function (g) {
        var opz = storicoOpzioni(tutte, F, g[0]);
        if (!opz.length) return;
        var chip = function (k, nome) {
          var on = (F[g[0]] || "") === k;
          return "<span data-a='filtro' data-g='" + g[0] + "' data-k='" + esc(k) + "' style='border:1px solid " + (on ? "#e2b33c" : "#2a4370") + ";color:" + (on ? "#e2b33c" : "#e8edf5") +
            ";background:#14243d;border-radius:14px;padding:6px 10px;font-size:12px;font-weight:800;cursor:pointer'>" + esc(nome) + "</span>";
        };
        h += "<div class='lb' style='margin:4px 0 4px'>" + g[1] + "</div><div style='display:flex;flex-wrap:wrap;gap:6px;margin:0 0 8px'>" +
          chip("", g[2]) + opz.map(function (v) { return chip(v.k, v.nome); }).join("") + "</div>";
      });
    }
    if (!lista.length) h += "<div class='cd'><div class='mu'>Nessuna operazione registrata" + (tutte.length ? " per questi filtri." : " su questo iPhone.") + "</div></div>";
    lista.forEach(function (x, i) {
      var d = x.destinazioni || {}, soloFle = x.modalita === "solo_fle" || x.modalita === "modifica_fle";
      h += "<div class='cd'><div class='lb'>" + esc(storicoData(x.creato)) + " · " + esc(MODALITA_STORICO[x.modalita] || "OPERAZIONE") + "</div>" +
        "<div class='t2'>" + (storicoSquadra(x) ? esc(storicoSquadra(x)) : "<span style='color:#fbbf24;font-size:15px'>Squadra: " + DATO_ND + "</span>") + (x.modulo ? esc(" · " + String(x.modulo).split("").join("-")) : "") + "</div>" +
        storicoRiga("Lega", storicoLegaNome(x)) +
        (soloFle ? storicoRiga("Lega di origine", storicoLegaOrigine(x)) : "") +
        storicoRiga("Account", storicoAccount(x)) +
        storicoRiga("Piattaforma", PIATTAFORMA_STORICO[x.piattaforma] || "") +
        // PROVA9: giornata di SERIE A (cmday); per le voci precedenti il numero ambiguo della voce resta senza attribuzione
        "<div class='mu'>" + esc(["stagione " + (x.stagione || storicoStagione(x.creato) || "?") + " (dalla data)", storicoSerieA(x) ? storicoSerieA(x) + "ª giornata di Serie A" : "",
          x.schemaGiornate !== 2 && Number(x.giornata) > 0 ? "giornata " + Number(x.giornata) + " (competizione non registrata)" : ""].filter(Boolean).join(" · ")) + "</div>" +
        (x.nota ? "<div class='mu'>" + esc(x.nota) + "</div>" : "");
      ["lega", "fle"].forEach(function (dest) {
        var e = d[dest];
        if (!e) return;
        var det = [];
        if (Array.isArray(e.competizioni) && e.competizioni.length) det.push((dest === "fle" ? "ingresso: " : "") + e.competizioni.map(function (c) { return c.nome || "competizione " + c.id; }).join(", ") +
          (Number(e.giornataComp) > 0 ? " · " + Number(e.giornataComp) + "ª giornata" + (dest === "fle" ? " FLE" : "") : ""));
        // PROVA9: le voci precedenti avevano qui la giornata di Serie A (gia mostrata sopra): nessuna riga ambigua
        if (e.tutte === true) det.push(dest === "fle" ? "comando SALVA PER TUTTE LE COMPETIZIONI" : "salvata per TUTTE LE COMPETIZIONI");
        if (e.invisibile === true) det.push("INVISIBILE");
        if (e.motivo) det.push(e.motivo);
        if (e.prova) det.push("prova: " + e.prova);
        if (Number(e.conferme) > 1) det.push("confermata " + Number(e.conferme) + " volte (stessa formazione)");
        if (Array.isArray(e.invii) && e.invii.length > 1) det.push("invii: " + e.invii.map(function (x) { return (Number(x.at) ? storicoData(x.at) : "prima consegna") + (x.prova ? " (" + x.prova + ")" : ""); }).join(" · ")); // PROVA11
        if (e.tentativi && e.tentativi.length) det.push(e.tentativi.length + (e.tentativi.length === 1 ? " tentativo non riuscito" : " tentativi non riusciti") + (e.esito === "confermata" ? "" : " prima"));
        h += "<div style='margin-top:6px;font-size:13px;font-weight:800'>" + storicoChip(dest === "lega" ? "LEGA" : "FLE", e, true) + "</div>" +
          (det.length ? "<div class='mu' style='font-size:12px'>" + esc(det.join(" · ")) + "</div>" : "");
        if (dest === "fle") h += storicoCompetizioniHtml(e) + storicoVerificheHtml(e);
      });
      if (x.migrata) h += "<div class='mu' style='font-size:11px;margin-top:4px'>dalla versione precedente di FVM: i dati non registrati allora restano non disponibili</div>";
      if (x.formazione && x.formazione.titolari) {
        h += "<button class='bt' data-a='formazione_storico' data-i='" + i + "'>FORMAZIONE ▾</button><div id='fvm-sf-" + i + "' style='display:none;margin-top:6px'>" +
          "<div class='mu'><b>Titolari:</b> " + esc(x.formazione.titolari.join(", ")) + "</div>" +
          (x.formazione.panchina && x.formazione.panchina.length ? "<div class='mu' style='margin-top:4px'><b>Panchina:</b> " + esc(x.formazione.panchina.join(", ")) + "</div>" : "") +
          storicoSwitchHtml(x) + "</div>";
      } else h += storicoSwitchHtml(x, true); // formazione non piu conservata (voci meno recenti): lo Switch resta visibile
      h += "</div>";
    });
    if (lista.length) h += "<button class='bt rosso' data-a='pulisci'>PULISCI " + (attivi ? "QUESTE " + lista.length + " VOCI" : "TUTTO LO STORICO") + "</button>";
    h += "<button class='bt' data-a='indietro'>INDIETRO</button>";
    pannello.innerHTML = h;
    Array.prototype.forEach.call(pannello.querySelectorAll("[data-a]"), function (el) {
      el.addEventListener("click", function (ev) {
        ev.stopPropagation();
        var a = el.getAttribute("data-a");
        if (a === "indietro") apriPannello();
        if (a === "filtro") { var F2 = storicoFiltriScelti(); F2[el.getAttribute("data-g")] = el.getAttribute("data-k") || ""; sScrivi("storico_filtri", F2); disegnaStorico(); }
        if (a === "formazione_storico") {
          var box = pannello.querySelector("#fvm-sf-" + el.getAttribute("data-i"));
          if (box) { var aperta = box.style.display !== "none"; box.style.display = aperta ? "none" : "block"; el.textContent = aperta ? "FORMAZIONE ▾" : "NASCONDI FORMAZIONE ▴"; }
        }
        if (a === "pulisci") pulisciStoricoUnificato(F, lista.length);
      });
    });
  }
  // pulizia selettiva: solo le voci dei filtri scelti (mai le vecchie chiavi, mai i dati sui siti ufficiali)
  function pulisciStoricoUnificato(F, quante) {
    F = F || {};
    var tutto = !GRUPPI_STORICO.some(function (g) { return !!F[g[0]]; });
    if (!confirm("Vuoi cancellare " + (tutto ? "tutto lo storico" : quante + " voci dello storico") + " salvate su questo iPhone?\n\nLe formazioni consegnate sui siti ufficiali non vengono toccate.")) return;
    var resto = storicoTutto().filter(function (x) { return !storicoNelFiltro(x, F); });
    storicoSalva(resto);
    log("STORICO PULITO", { filtri: F, cancellate: quante, rimaste: resto.length });
    sScrivi("storico_filtri", null);
    disegnaStorico();
  }

  // ---------------------------------------------------------------- schermata principale
  var pannello = null, pannelloPrincipale = false, ultimoConn = null;
  function chiudiPannello() { if (pannello) { pannello.remove(); pannello = null; } pannelloPrincipale = false; }
  // ================================================================ 1.3.4 AGGIORNAMENTI (AGGIORNA ORA)
  // FVM legge un piccolo file pubblico (aggiornamento.json, accanto allo script) e, SOLO se annuncia una versione piu
  // recente di quella attiva, mostra nella Home: versione installata, nuova versione, «Cosa cambia», AGGIORNA ORA, NON ORA.
  // L'aggiornamento lo applica Userscripts (menu dell'estensione -> aggiornamenti -> Update, oppure reinstallazione dal
  // file dello script): FVM non puo aprire l'estensione ne aggiornarsi da solo, quindi guida l'utente e dichiara
  // "completato" solo quando, dopo la ricarica, e in esecuzione la versione nuova (VERSIONE dello script attivo).
  var AGG_URL = "https://raw.githubusercontent.com/fabrizioercole70/FantaViceMister/main/aggiornamento.json";
  var AGG_SCRIPT_URL = "https://raw.githubusercontent.com/fabrizioercole70/FantaViceMister/main/FantaViceMister.user.js";
  var AGG_INTERVALLO_MS = 6 * 3600000;
  // 1.3.6: novita di QUESTA versione, mostrate nel messaggio "aggiornamento completato" (stesse voci di aggiornamento.json)
  function novitaVersione() {
    return ["Nuova installazione su iPhone in 3 passi: alla fine, nella Home di FVM, il messaggio COMPLETA L'INSTALLAZIONE guida a mettere l'icona FVM sulla Home.",
      "Guida agli aggiornamenti separata: si aggiorna lo script, senza reinstallare Userscripts, rifare l'accesso o ricreare l'icona.",
      "Dalla 1.3.5: account riconosciuto dal sito; VERIFICA SQUADRA FLE nella Home per LEGA + FLE, SOLO FLE e MODIFICA SU FLE; SOLO LEGA funziona sempre.",
      "Dalla 1.3.5: SWITCH scelto da te e verificato dopo il salvataggio; confronto con i 25 FLE con moduli ammessi ed esclusi dalla panchina con il motivo.",
      "Dalla 1.3.5: Fantaclub con competizioni e giornate lette dal sito e CAMBIA LEGA con accesso diretto alla pagina Consegna.",
      "Dalla 1.3.5: Area Admin con consegne FLE per competizione e turno e AGGIORNA TUTTI I TURNI DELLE COMPETIZIONI; consegne ufficiali per piattaforma.",
      "Niente audio delle pagine del sito durante le schermate e le letture di Fanta Vice Mister.",
      "Dopo un aggiornamento compare una volta il riepilogo delle novità."];
  }
  // confronto come Userscripts: componenti numerici separati da punti, mancanti = 0 ("1.3.4-LAN" vale 1.3.4)
  function aggConfronta(a, b) {
    var x = String(a || "").split("-")[0].split("."), y = String(b || "").split("-")[0].split(".");
    for (var i = 0; i < Math.max(x.length, y.length); i++) { var p = parseInt(x[i], 10) || 0, q = parseInt(y[i], 10) || 0; if (p !== q) return p > q ? 1 : -1; }
    return 0;
  }
  // contenuto del file pubblico: solo testo, voci limitate (mai HTML: tutto passa da esc al momento di mostrarlo)
  function aggValida(j) {
    var lista = function (v) { return (Array.isArray(v) ? v : []).filter(function (s) { return typeof s === "string" && s.trim(); }).slice(0, 8).map(function (s) { return s.trim().slice(0, 220); }); };
    if (!j || typeof j !== "object" || !/^\d+(\.\d+){1,3}$/.test(String(j.versione || ""))) return null;
    return { versione: String(j.versione), data: String(j.data || "").slice(0, 20), novita: lista(j.novita), correzioni: lista(j.correzioni), limitazioni: lista(j.limitazioni) };
  }
  // lettura del file pubblico al massimo ogni 6 ore (dopo un errore: ogni 30 minuti); nessun cookie, nessuna intestazione del sito
  function aggControlla(forza) {
    var c = leggi("agg_info", null);
    if (!forza && c && Date.now() - Number(c.at || 0) < AGG_INTERVALLO_MS) return;
    fetchOriginale(AGG_URL, { cache: "no-store", credentials: "omit" }).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    }).then(function (j) {
      var d = aggValida(j);
      if (!d) throw new Error("file non valido");
      scrivi("agg_info", { at: Date.now(), dati: d });
      log("AGGIORNAMENTI", { attiva: VERSIONE, pubblicata: d.versione, nuova: aggConfronta(d.versione, VERSIONE) > 0 });
      if (pannello && pannelloPrincipale) aggiornaPannello();
    }).catch(function (e) {
      // lettura non riuscita: nessun riquadro inventato (restano solo i dati dell'ultima lettura riuscita)
      scrivi("agg_info", { at: Date.now() - AGG_INTERVALLO_MS + 30 * 60000, dati: c && c.dati || null, errore: String(e && e.message || e).slice(0, 80) });
      log("AGGIORNAMENTI", { esito: "non letto", motivo: String(e && e.message || e).slice(0, 80) });
    });
  }
  // AGGIORNA ORA registra "agg_attesa" {da, a}: il completamento lo conferma SOLO lo script nuovo, quando e attivo
  function aggVerificaAttivo() {
    var att = leggi("agg_attesa", null);
    if (!att) return;
    if (aggConfronta(VERSIONE, att.a) >= 0) {
      scrivi("agg_attesa", null);
      scrivi("agg_completato", { da: att.da, a: VERSIONE, at: Date.now() });
      log("AGGIORNAMENTI", { esito: "completato", da: att.da, attiva: VERSIONE });
    } else if (Date.now() - Number(att.at || 0) > 7 * 86400000) scrivi("agg_attesa", null);
  }
  // 1.3.5: versione usata l'ultima volta su questo iPhone. Se ora e attiva una versione PIU RECENTE (anche aggiornata
  // direttamente dal menu di Userscripts, senza AGGIORNA ORA) il messaggio "aggiornamento completato" compare UNA volta.
  // Prima installazione (nessun segno di uso precedente): nessun messaggio. Ritorno a una versione precedente: nessun messaggio.
  function aggVersioneUsata() {
    var vu = leggi("versione_usata", "");
    if (vu === VERSIONE) return;
    var comp = leggi("agg_completato", null), gia = !!(comp && aggConfronta(comp.a, VERSIONE) === 0);
    // versioni fino alla 1.3.4 non registravano la versione: un uso precedente (dati di FVM) significa "arrivo da 1.3.4 o prima"
    var usoPrima = !vu && aggConfronta(VERSIONE, "1.3.4") > 0 && ["benvenuto_ok", "lega_sorgente", "ultima", "fc_lega"].some(function (k) { return leggi(k, null) != null; });
    if (!gia && ((vu && aggConfronta(VERSIONE, vu) > 0) || usoPrima)) {
      scrivi("agg_completato", { da: vu || "", a: VERSIONE, at: Date.now(), come: "userscripts" });
      log("AGGIORNAMENTI", { esito: "nuova versione attiva", da: vu || "1.3.4 o precedente", attiva: VERSIONE });
    }
    scrivi("versione_usata", VERSIONE);
  }
  function aggStato() {
    var c = leggi("agg_info", null), d = c && c.dati, att = leggi("agg_attesa", null);
    var nuova = d && aggConfronta(d.versione, VERSIONE) > 0 ? d : null;
    return { nuova: nuova, nonOra: !!(nuova && leggi("agg_nonora", "") === nuova.versione), attesa: nuova && att && att.a === nuova.versione ? att : null };
  }
  function aggRiquadro() {
    aggVerificaAttivo();
    aggVersioneUsata();
    var ok = leggi("agg_completato", null);
    if (ok && aggConfronta(VERSIONE, ok.a) === 0) {
      // 1.3.5: UNA sola volta. Resta visibile per tutta la sessione di Safari in cui compare (la Home si ridisegna),
      // poi non ricompare piu, anche senza OK.
      if (!ok.mostrato) { ok.mostrato = Date.now(); scrivi("agg_completato", ok); sScrivi("agg_visto", ok.a); }
      else if (sLeggi("agg_visto") !== ok.a) { scrivi("agg_completato", null); ok = null; }
    }
    var completato = "";
    if (ok && aggConfronta(VERSIONE, ok.a) === 0) {
      completato = "<div class='cd' style='border:2px solid #3fae4a'><div class='lb' style='color:#4ade80'>AGGIORNAMENTO COMPLETATO ✓</div>" +
        "<div class='t2'>Fanta Vice Mister " + esc(etichettaVersione(VERSIONE)) + " è attivo</div>" + (ok.da ? "<div class='mu'>Versione precedente: " + esc(etichettaVersione(ok.da)) + "</div>" : "") +
        (novitaVersione().length ? "<div class='mu' style='margin-top:6px'><b>Cosa cambia</b></div>" + novitaVersione().map(function (x) { return "<div class='mu'>• " + esc(x) + "</div>"; }).join("") : "") +
        "<button class='bt oro' data-a='agg_ok'>OK</button></div>";
    }
    var s = aggStato();
    // 1.3.5: un eventuale aggiornamento ancora piu recente resta visibile anche sotto il messaggio "completato"
    if (!s.nuova || (s.nonOra && !s.attesa)) return completato;
    var d = s.nuova;
    var elenco = function (t, v) { return v.length ? "<div class='mu' style='margin-top:6px'><b>" + t + "</b></div>" + v.map(function (x) { return "<div class='mu'>• " + esc(x) + "</div>"; }).join("") : ""; };
    return completato + "<div class='cd' style='border:2px solid #e2b33c'><div class='lb' style='color:#e2b33c'>AGGIORNAMENTO DISPONIBILE</div>" +
      "<div class='mu'>Versione installata: <b>" + esc(etichettaVersione(VERSIONE)) + "</b></div>" +
      "<div class='mu'>Nuova versione: <b>" + esc(d.versione) + "</b>" + (d.data ? " · " + esc(d.data) : "") + "</div>" +
      (s.attesa ? "<div style='color:#fbbf24;margin-top:6px;font-size:13px'>La versione " + esc(d.versione) + " non è ancora attiva: completa i passi di AGGIORNA ORA, poi ricarica la pagina.</div>" : "") +
      elenco("Cosa cambia", d.novita) + elenco("Correzioni", d.correzioni) + elenco("Limitazioni note", d.limitazioni) +
      "<button class='bt oro' data-a='agg_ora'>AGGIORNA ORA</button><button class='bt' data-a='agg_nonora'>NON ORA</button></div>";
  }
  // guida all'aggiornamento con Userscripts (nessuna azione automatica: l'utente conferma nell'estensione)
  function aggApriGuida() {
    var s = aggStato();
    if (!s.nuova) { apriPannello(); return; }
    scrivi("agg_attesa", { da: VERSIONE, a: s.nuova.versione, at: Date.now() });
    scrivi("agg_nonora", "");
    log("AGGIORNAMENTI", { esito: "AGGIORNA ORA", da: VERSIONE, a: s.nuova.versione });
    monta();
    if (!radice) return;
    chiudiPannello();
    pannelloPrincipale = false;
    pannello = document.createElement("div");
    pannello.className = "ov";
    radice.appendChild(pannello);
    pannello.innerHTML = "<div class='cd'><button class='x' data-a='indietro'>INDIETRO</button><div class='t1'>AGGIORNA ORA</div>" +
      "<div class='mu'>Da " + esc(etichettaVersione(VERSIONE)) + " a " + esc(etichettaVersione(s.nuova.versione)) + ". L'aggiornamento lo installa l'estensione Userscripts: Fanta Vice Mister non può farlo da solo.</div></div>" +
      "<div class='cd'><div class='lb'>PASSI</div>" +
      "<div class='mu'>1. Nella barra di Safari tocca l'icona delle estensioni (il pezzo di puzzle, oppure <b>AA</b> → Estensioni).</div>" +
      "<div class='mu'>2. Tocca <b>Userscripts</b>.</div>" +
      "<div class='mu'>3. Tocca l'icona degli aggiornamenti (<b>Show updates</b>, con il pallino). Se l'elenco è vuoto, tocca il controllo degli aggiornamenti nella stessa schermata.</div>" +
      "<div class='mu'>4. Accanto a Fanta Vice Mister tocca <b>Update</b>.</div>" +
      "<div class='mu'>5. Torna qui e tocca <b>HO AGGIORNATO · RICARICA</b>.</div>" +
      "<button class='bt oro' data-a='agg_ricarica'>HO AGGIORNATO · RICARICA</button></div>" +
      "<div class='cd'><div class='lb'>SE L'AGGIORNAMENTO NON COMPARE</div>" +
      "<div class='mu'>Apri il file dello script; poi tocca l'icona delle estensioni → <b>Userscripts</b> e conferma l'installazione. I tuoi dati restano. Infine torna su Leghe Fantacalcio e apri FVM.</div>" +
      "<button class='bt' data-a='agg_file'>APRI IL FILE DELLO SCRIPT</button></div>" +
      "<div class='mu' style='margin:4px 2px 8px'>L'aggiornamento risulta completato solo quando la nuova versione è davvero attiva.</div>";
    Array.prototype.forEach.call(pannello.querySelectorAll("[data-a]"), function (el) {
      el.addEventListener("click", function () {
        var a = el.getAttribute("data-a");
        if (a === "indietro") apriPannello();
        if (a === "agg_ricarica") { log("AGGIORNAMENTI", { esito: "ricarica", attiva: VERSIONE }); sScrivi("apri", "main"); location.reload(); }
        if (a === "agg_file") { log("AGGIORNAMENTI", { esito: "file dello script" }); location.assign(AGG_SCRIPT_URL); }
      });
    });
  }
  function apriPannello() {
    monta();
    if (!radice) return;
    chiudiPannello();
    pannelloPrincipale = true;
    pannello = document.createElement("div");
    pannello.className = "ov";
    radice.appendChild(pannello);
    aggiornaPannello();
  }
  function rigaGiocatore(num, p, extra) {
    return "<div class='riga' style='cursor:default'>" + (num ? "<span class='num on'>" + num + "</span>" : "") + badge(p.role || p.r) + "<span class='nm'>" + esc(p.name || p.n || "") + "</span>" + (extra || "") + "</div>";
  }
  // PROVA13 decisione A: opzioni «Salva per tutte le competizioni» (allComp) e «Invisibile» (visb = false) del salvataggio fatto
  // dall'utente nella sua lega, lette dal corpo reale della richiesta del sito. Assenti = non indicate (mai dedotte).
  function opzioniLegaSalvate(u) {
    var o = null; try { o = trovaFormazione(JSON.parse(u && u.corpo || "null"), 0); } catch (e) { o = null; }
    if (!o) return null;
    return { tutte: "allComp" in o ? (o.allComp === true || o.allComp === 1) : null, invisibile: "visb" in o ? (o.visb === false || o.visb === 0) : null };
  }
  // PROVA13 decisione A: riepilogo prima di CONFERMA E INVIA, LEGA e FLE separati. Nessuna scelta dell'utente viene cambiata:
  // nella lega restano quelle salvate; su FLE FVM salva sempre per tutte le competizioni, invisibile (comportamento invariato).
  function cartaRiepilogoSalvataggio(u) {
    var sn = function (v) { return v === null || v === undefined ? "non indicato" : v ? "Sì" : "No"; };
    var lega;
    if (u && u.fonte === "fantaclub") lega = "consegna già fatta su Fantaclub (la visibilità delle formazioni è una regola della lega Fantaclub)";
    else { var op = opzioniLegaSalvate(u); lega = op ? "Salva per tutte le competizioni: <b>" + sn(op.tutte) + "</b> · Invisibile: <b>" + sn(op.invisibile) + "</b> (scelte tue, già salvate)" : "opzioni non lette dal salvataggio della lega"; }
    return "<div class='cd' style='margin-top:8px;padding:10px'><div class='lb'>RIEPILOGO PRIMA DELL'INVIO</div>" +
      "<div class='mu' style='margin-top:4px'>LEGA: " + lega + "</div>" +
      "<div class='mu'>FLE (con CONFERMA E INVIA): <b>tutte le competizioni</b> a cui sei iscritto · <b>invisibile</b> (sempre, impostato da FVM)</div>" +
      (u && u.fonte !== "fantaclub" ? "<button class='bt' data-a='formazione'>TORNA ALLA FORMAZIONE DELLA LEGA</button><div class='mu' style='font-size:11px'>La formazione salvata resta com'è: puoi cambiarla e salvarla di nuovo.</div>" : "") + "</div>";
  }
  // PROVA13 B6: avviso FACOLTATIVO dopo un invio LEGA + FLE da Fantaclub salvato su FLE. Fantaclub non ha lo Switch: l'utente puo
  // impostarlo SOLO lui, sulla pagina ufficiale FLE (MODIFICA SU FLE con la guardia della squadra, A1). FVM non scrive lo Switch,
  // non lo cancella e non insiste: NON ORA nasconde l'avviso per questo invio. Solo con la squadra FLE abbinata e verificata.
  function cartaSwitchFc(f) {
    if (!f || f.fonte !== "fantaclub" || f.stato !== "inviata") return "";
    if (f.swNonOra && Number(f.swNonOra) >= Number(f.inviataAt || 0)) return "";
    var at = fleAttesoFc();
    if (!at.ok || Number(f.tid) !== at.fleTid) return "";
    var presente = !!(f.swInviato && f.swInviato.valori && Number(f.swInviato.valori.swtcA) && Number(f.swInviato.valori.swtcB)) || !!(f.sw && f.sw.stato === "presente");
    return "<div class='cd' style='margin-top:8px;padding:10px;border-left:4px solid #e2b33c'><div class='lb'>SWITCH FLE · FACOLTATIVO</div>" +
      "<div class='mu' style='margin-top:4px'>Fantaclub non prevede lo Switch. " + (presente ? "Su FLE risulta uno Switch: puoi cambiarlo oppure lasciarlo com'è." : "Se vuoi, puoi impostarlo tu sulla pagina ufficiale FLE.") + "</div>" +
      "<div class='mu' style='font-size:11px'>FVM non scrive e non toglie lo Switch: lo scegli tu su FLE (squadra " + esc(at.squadra) + ", verificata).</div>" +
      "<button class='bt oro' data-a='fc_imposta_sw'>" + (presente ? "MODIFICA SWITCH SU FLE" : "IMPOSTA SWITCH SU FLE") + "</button>" +
      "<button class='bt' data-a='fc_sw_nonora'>" + (presente ? "LASCIA COSÌ" : "NON ORA") + "</button></div>";
  }
  function cartaPasso2() {
    var u = formazioneSorgente(), f = leggi("fle", null) || {};
    var h = "<div class='cd' style='border-left:4px solid #2f6fe0'><div class='lb'>PASSO 2 · CONTROLLO FLE</div>";
    var mod = u && u.ok ? String(u.modulo || "").split("").join("-") : "—";
    var nt = u && u.ok ? u.titolari.length : "—", np = "—";
    var res = null;
    // Fantaclub senza abbinamento verificato (lega + squadra + ID FLE): nessun risultato FLE, PASSO 3 spento
    if (f.roster && u && u.ok && !(u.fonte === "fantaclub" && !u.fleTid)) res = risultatoFle();
    if (res) np = res.bench.length;
    else if (u && u.ok) np = u.panchina.length;
    var titolo = "In attesa della formazione", colore = "#fff", dettagli = [];
    if (!u || !u.ok) dettagli.push("Fai la formazione con il riquadro verde: qui compare il confronto con la rosa FLE.");
    else if (f.stato === "attesa" || !f.stato) { titolo = "Pronto per il controllo FLE"; dettagli.push("Tocca RIPETI CONTROLLO FLE per confrontare la formazione con la tua rosa FLE."); }
    else if (f.stato === "errore") { titolo = f.titolo || "Controllo FLE non riuscito"; colore = "#f87171"; dettagli = (f.dettagli || []).slice(); }
    else if (f.stato === "inviata") { titolo = "Formazione salvata su FLE ✓"; colore = "#4ade80"; }
    else if (f.stato === "controllo") { titolo = "Controllo FLE in corso…"; colore = "#fbbf24"; dettagli.push("Se resta così, tocca RIPETI CONTROLLO FLE."); }
    else if (res && res.complete) { titolo = "Controllo FLE OK ✓"; colore = "#4ade80"; }
    else if (res) { titolo = "Scegli il sostituto FLE"; colore = "#fbbf24"; }
    // 1.3.5-RC2: Leghe Fantacalcio senza squadra FLE verificata per QUESTO account: un esito verde e di un controllo precedente
    var precedente = colore === "#4ade80" && !(u && u.fonte === "fantaclub") && piattaformaScelta() !== "fantaclub" && !fleAutorizzatoLeghe(true).ok;
    if (precedente) { titolo = "Controllo precedente: non vale per l'accesso attuale"; colore = "#9ca3af"; dettagli.unshift("Risultato di un controllo FLE fatto prima. Per questo account serve VERIFICA SQUADRA FLE riuscita: fino ad allora si usa SOLO LEGA."); }
    h += "<div class='t2' style='color:" + colore + "'>" + esc(titolo) + "</div>";
    h += "<div class='box3'><div class='box'><span>MODULO</span><b>" + esc(mod) + "</b></div><div class='box'><b>" + nt + "</b><span>TITOLARI</span></div><div class='box'><b>" + np + "</b><span>PANCHINA</span></div></div>";
    dettagli.forEach(function (d) { h += "<div class='mu'>• " + esc(d) + "</div>"; });
    if (res && f.stato !== "errore" && f.stato !== "inviata") {
      if (f.compName) h += "<div class='mu'>• Destinazione FLE: " + esc(f.compName) + (f.squadra ? " · " + esc(f.squadra) : "") + "</div>";
      if (u.fonte === "fantaclub") {
        // 1.1.0 Fantaclub fase 8: quanti giocatori Fantaclub sono collegati ai 25 FLE (nome, squadra, ruolo)
        var sfc = sorgenteFc(u, f.roster || []);
        h += "<div class='mu'>• Giocatori Fantaclub collegati ai 25 FLE: " + sfc.collegati + "/" + sfc.totale + "</div>";
      }
      if (res.moduleProblem) h += "<div class='mu' style='color:#f87171'>• " + esc(res.moduleProblem) + "</div>";
      // PROVA12: panchinari della lega che non entrano nella panchina FLE (2P · 3D · 3C · 3A), con il motivo
      if (res.esclusi && res.esclusi.length) h += "<div class='mu'>• Non entrano nella panchina FLE: " + res.esclusi.map(function (x) { return esc(x.name) + " (" + (RUOLI[x.role] || "?") + " · " + esc(x.motivo) + ")"; }).join(", ") + "</div>";
      var nomeFle = function (pid) { var p = (f.roster || []).filter(function (x) { return Number(x.pid) === Number(pid); })[0]; return p ? p.name : (info[pid] && info[pid].n) || ("giocatore " + pid); };
      var fino = function (d) { var t = new Date(d || 0); return isNaN(t.getTime()) ? "febbraio" : t.toLocaleDateString("it-IT"); };
      var ricordate = 0;
      res.items.forEach(function (it) {
        var src = it.source ? (it.source.name + (it.source.club ? " " + it.source.club : "") + " (" + (RUOLI[it.role] || "?") + ")" + (it.source.nota ? " · " + it.source.nota : "")) : ("posto aggiunto in panchina (" + (RUOLI[it.role] || "?") + ")");
        var tit = it.kind === "start" ? "Titolare non nei tuoi 25 FLE: " + src : it.kind === "bench" ? "Panchinaro non nei tuoi 25 FLE: " + src : "Panchina FLE: manca un " + (RUOLI[it.role] || "?");
        if (!it.required && !it.chosen) return;
        h += "<div class='cd' style='margin-top:8px;padding:10px'><div class='mu' style='color:#fbbf24;font-weight:700'>" + esc(tit) + "</div>";
        if (it.scartata && !it.chosen) h += "<div class='mu' style='color:#f87171'>La scelta " + (it.scartataRicordata ? "ricordata" : "precedente") + " (" + esc(nomeFle(it.scartata)) + ") non vale più: non è nei tuoi 25 FLE attuali, ha un altro ruolo o è già in formazione. Scegli di nuovo.</div>";
        if (it.chosen) {
          var ch = it.candidates.filter(function (c) { return c.pid === it.chosen; })[0] || { name: it.chosen, role: it.role };
          if (it.ricordata) ricordate++;
          h += rigaGiocatore(0, ch, "<span class='mu' style='margin-left:auto'>" + (it.ricordata ? "ricordata ✓" : "scelto ✓") + "</span>");
          if (it.ricordata) h += "<div class='mu'>Scelta ricordata fino al " + esc(fino(it.ricordataFino)) + (it.kind === "add" ? ": vale per qualsiasi " + esc(RUOLI[it.role] || "?") + " mancante in panchina, non per un giocatore preciso." : ", ricontrollata sui tuoi 25 FLE attuali.") + "</div>";
          h += "<button class='bt' data-a='annulla' data-k='" + esc(it.key) + "'>" + (it.ricordata ? "ANNULLA SCELTA RICORDATA" : "CAMBIA SCELTA") + "</button>";
        } else {
          it.candidates.slice(0, 12).forEach(function (c) {
            h += "<div class='riga' data-a='scegli' data-k='" + esc(it.key) + "' data-p='" + c.pid + "'>" + badge(c.role) + "<span class='nm'>" + esc(c.name) + "</span>" +
              (c.flag ? "<span class='mu' style='color:#f87171;margin-left:auto'>" + esc(c.flag) + "</span>" : c.inBench ? "<span class='mu' style='margin-left:auto'>in panchina</span>" : "") + "</div>";
          });
          if (!it.candidates.length) h += "<div class='mu'>Nessun giocatore disponibile di questo ruolo nei tuoi 25 FLE.</div>";
        }
        h += "</div>";
      });
      if (res.items.some(function (it) { return it.required || it.chosen; })) {
        h += "<label class='mu' style='display:flex;gap:8px;align-items:center;margin-top:6px'><input type='checkbox' id='fvm-ricorda' " + (leggi("ricorda", true) ? "checked" : "") + "> Ricorda le scelte fino a febbraio</label>";
      }
      if (ricordate) h += "<button class='bt' data-a='dimentica_scelte'>DIMENTICA LE SCELTE RICORDATE (" + ricordate + ")</button>";
    }
    var pronto = res && res.complete && f.stato !== "errore" && !precedente;
    // PROVA12: PASSO 3 solo con un controllo FLE recente (rosa FLE riletta)
    var vecchioP2 = res && res.complete && f.stato !== "errore" && f.stato !== "inviata" ? controlloFleVecchio(f) : null;
    if (vecchioP2) { pronto = false; h += "<div class='mu' style='color:#fbbf24;margin-top:4px'>• " + esc(vecchioP2.testo) + "</div><button class='bt' data-a='ricontrolla'>RIPETI CONTROLLO FLE</button>"; }
    // PROVA8: SWITCH (solo se c'e qualcosa da dire). Una scelta obbligatoria mancante spegne CONFERMA E INVIA.
    var swD = null;
    if (res && f.stato !== "errore" && f.stato !== "inviata") {
      try { swD = swPasso2(u, f, res); } catch (e) { swD = null; }
      // invio fermato: UNA sola riga (niente doppione «non verificabile ora») + RIPETI CONTROLLO FLE subito sotto
      if (f.swFermato) h += "<div class='mu' style='color:#f87171;margin-top:4px'>• Invio fermato prima del salvataggio, nessuna modifica su FLE: " + esc(f.swFermato.testo) + "</div>" +
        "<button class='bt' data-a='ricontrolla'>RIPETI CONTROLLO FLE</button>";
      if (swD && !(f.swFermato && swD.caso === "fle_non_verificabile")) h += swCarta(swD, u, f);
      if (swD && swD.blocca && swD.motivo === "scelta_mancante") pronto = false;
    }
    if (f.stato === "inviata") {
      if (f.compName) h += "<div class='mu'>• Destinazione FLE: " + esc(f.compName) + (f.squadra ? " · " + esc(f.squadra) : "") + "</div>";
      h += "<div class='mu' style='margin-top:6px'>Su FLE è salvata per tutte le competizioni a cui sei iscritto, <b>invisibile</b> agli avversari.</div>";
      if (f.swInviato || f.swVerifica || f.swModifica || f.compVerifica) h += swCartaInviata(f, u);
      if (u && u.fonte === "fantaclub") h += cartaSwitchFc(f); // PROVA13 B6: Switch facoltativo dopo l'invio da Fantaclub
      h += "<button class='bt' data-a='modifica'>MODIFICA SU FLE</button>";
    } else {
      if (res && f.stato !== "errore") h += cartaRiepilogoSalvataggio(u); // PROVA13 decisione A
      h += "<button class='bt " + (pronto ? "oro" : "spento") + "' data-a='invia'><span style='font-size:10px;letter-spacing:2px'>PASSO 3</span><br>CONFERMA E INVIA A FLE</button>";
    }
    h += "</div>";
    return h;
  }
  // 1.1.0 Fantaclub: carte della Home con Fantaclub scelto (PASSO 1 consegna, SOLO LEGA, squadra, PASSO 2 e 3, formazione)
  function carteFantaclub() {
    var c = leggi("fc_ultima", null), sl = leggi("fc_solo_lega", null), err = leggi("fc_errore", null), lg = legaFc();
    var valido = abbinamentoFcValido(c), circuitoC = !!c && inCircuitoFc(c.nl);
    // lega fuori dal circuito FLE (formazione, SOLO LEGA o lega in uso): UN SOLO avviso nella Home.
    // I blocchi FLE restano quelli di sempre (abbinamentoFcValido, formazioneSorgente, controllo e invio).
    var fuori = c && c.nl && !circuitoC ? c.lega || nomeLegaFc(c.nl) : sl && sl.nl && !inCircuitoFc(sl.nl) ? sl.lega || nomeLegaFc(sl.nl) : lg && !inCircuitoFc(lg.nl) ? lg.nome : "";
    var h = "<div class='cd verde' data-a='formazione_fc'><div class='lb' style='color:#cfe'>PASSO 1 · " + esc(lg ? lg.nome : "SCEGLI LA LEGA") + " · FANTACLUB</div>" +
      "<div style='font-size:18px;font-weight:900;margin:4px 0'>FAI O MODIFICA LA FORMAZIONE</div>" +
      "<div class='mu' style='color:#cfe'>" + (lg ? "Apro la consegna della tua lega su Fantaclub. Premi CONSEGNA: leggo la formazione" + (inCircuitoFc(lg.nl) ? " e la controllo per FLE da solo." : ".")
        : "Apro Fantaclub: entra nella tua lega e apri la sua pagina Consegna formazione. La lega viene riconosciuta da lì.") + "</div>" +
      "<div class='mu' style='color:#cfe;margin-top:4px'>Nella barra FVM di Fantaclub puoi scegliere <span style='white-space:nowrap'>LEGA + FLE</span>, <span style='white-space:nowrap'>SOLO LEGA</span> o <span style='white-space:nowrap'>SOLO FLE</span>.</div></div>";
    if (err) {
      h += "<div class='cd' style='border-left:4px solid #e2333b'><div class='lb'>FORMAZIONE FANTACLUB</div><div class='t2' style='color:#f87171'>" + (err.consegna ? "Consegna fatta su Fantaclub ✓, ma formazione non letta" : "Formazione non letta") + "</div>" +
        "<div class='mu'>• " + esc(err.testo || "") + "</div><div class='mu'>• Nessun invio a FLE. Riprova con FAI O MODIFICA o manda la diagnosi al tuo admin.</div></div>";
    }
    if (sl) {
      h += "<div class='cd' style='border-left:4px solid #e2b33c'><div class='lb'>SOLO LEGA · FANTACLUB</div>" +
        "<div class='t2' style='color:#4ade80'>" + (sl.come === "consegna" ? "Formazione consegnata solo su Fantaclub ✓" : "Formazione letta · solo nella tua lega") + "</div>" +
        "<div class='mu'>" + esc(sl.lega || "Lega non riconosciuta") + (abbinamentoFcValido(sl) ? " · " + esc(sl.squadra) : "") + "</div>" +
        "<div class='mu'>" + esc(new Date(sl.at).toLocaleString("it-IT")) + " · modulo " + esc(String(sl.modulo || "").split("").join("-")) + "</div>" +
        "<div class='mu' style='color:#fbbf24;font-weight:700;margin-top:4px'>Non è stata mandata a FLE.</div>" +
        (inCircuitoFc(sl.nl) ? "<button class='bt' data-a='fc_manda_fle'>MANDA ANCHE A FLE</button>" : "") + "</div>";
    }
    // l'unico avviso per la lega fuori dal circuito FLE
    if (fuori) {
      h += "<div class='cd' style='border-left:4px solid #e2b33c'><div class='lb'>" + esc(fuori) + " · FANTACLUB</div>" +
        "<div class='t2' style='color:#fbbf24'>Fuori dal circuito FLE</div>" +
        "<div class='mu'>La formazione resta solo su Fantaclub: nessun controllo né invio FLE.</div></div>";
    }
    // formazione senza lega verificata (dati precedenti alla lega reale): nessun FLE
    if (c && !c.nl) {
      h += "<div class='cd' style='border-left:4px solid #e2b33c'><div class='lb'>LEGA NON RICONOSCIUTA</div>" +
        "<div class='t2' style='color:#fbbf24'>Lega non verificata</div>" +
        "<div class='mu'>Questa formazione non arriva da una pagina Consegna riconosciuta: nessun controllo né invio FLE. Rifai FAI O MODIFICA.</div></div>";
    }
    // fase 7: squadra Fantaclub -> squadra FLE; se non e sicura sceglie l'utente tra le squadre di QUELLA lega
    if (c && circuitoC && !valido) {
      h += "<div class='cd' style='border-left:4px solid #fbbf24'><div class='lb'>LA TUA SQUADRA FANTACLUB · " + esc(c.lega) + "</div><div class='t2' style='color:#fbbf24'>Quale è la tua squadra?</div>" +
        "<div class='mu'>Non riesco a riconoscerla con certezza dalla pagina Consegna: sceglila tu (la ricordo per le prossime volte).</div>";
      squadreFantaclub(c.nl).forEach(function (t) { h += "<button class='bt' data-a='fc_squadra' data-s='" + esc(t[1]) + "'>" + esc(t[1]) + "</button>"; });
      h += "</div>";
    }
    if (!fuori && (!c || circuitoC)) h += cartaPasso2();
    h += "<div class='cd'><div class='lb'>LA MIA SQUADRA</div><div class='t1' style='margin-top:6px'>" + esc(valido ? c.squadra : (c && !circuitoC) || fuori ? "—" : "Da acquisire") + "</div>" +
      "<div class='mu' style='font-weight:800;margin-top:4px'>" + esc((c && c.nl && c.lega) || (lg && lg.nome) || "Lega da scegliere") + " · FANTACLUB</div>" +
      (valido ? "<div style='color:#4ade80;font-weight:800;margin-top:10px'>✓ Squadra FLE " + (c.sceltaUtente ? "scelta da te" : "riconosciuta") + "</div><button class='bt' data-a='fc_cambia_squadra'>NON È LA MIA SQUADRA</button>"
        : fuori || (c && !circuitoC) ? ""
        : "<div style='color:#fbbf24;font-weight:700;margin-top:10px'>La squadra verrà riconosciuta dopo la consegna della formazione</div>") +
      (lg ? "<button class='bt' data-a='fc_cambia_lega'>CAMBIA LEGA FANTACLUB</button>" : "") + "</div>";
    if (c) {
      h += "<div class='cd'><div class='lb'>FORMAZIONE " + (c.come === "consegna" ? "CONSEGNATA" : "LETTA") + " SU FANTACLUB</div><div class='mu' style='margin-top:6px'>" + esc(new Date(c.at).toLocaleString("it-IT")) + " · modulo " + esc(c.modulo) + " · " + c.titolari.length + " titolari · " + c.panchina.length + " panchinari</div>" +
        (circuitoC ? "<div class='mu' style='margin-top:4px'>Per il controllo e l'invio FLE serve anche l'accesso a Leghe Fantacalcio.</div>" : "") +
        "<button class='bt' data-a='panchina'>MOSTRA PANCHINA ▾</button><div id='fvm-panchina' class='panchinaDet'>";
      c.panchina.forEach(function (p, i) { h += rigaGiocatore(i + 1, { name: p.n + (p.c ? " · " + p.c : "") + (p.s ? " (" + p.s + ")" : ""), role: 0 }); });
      h += "</div></div>";
    }
    return h;
  }
  // 1.1.0: squadra FLE corrente per lo Storico (riconosciuta da controllo FLE o salvataggio in lega).
  // Dopo un cambio account questi dati sono azzerati: nessuno storico dell'account precedente viene mostrato.
  function squadraCorrenteStorico() {
    var f = leggi("fle", null) || {}, u = formazioneSorgente() || {};
    return String(f.squadra || u.squadra || "");
  }
  // 1.1.0: PULISCI STORICO: solo gli invii LOCALI della squadra corrente (mai quelli delle altre squadre,
  // mai le formazioni salvate sul sito FLE).
  function pulisciStorico() {
    var sq = squadraCorrenteStorico();
    if (!sq) return;
    if (!confirm("Vuoi cancellare lo storico invii di " + sq + " salvato su questo iPhone?\n\nLe formazioni salvate sul sito FLE non vengono toccate.")) return;
    var tutti = leggi("invii", []);
    var resto = tutti.filter(function (s) { return !s || s.squadra !== sq; });
    scrivi("invii", resto);
    log("STORICO PULITO", { squadra: sq, cancellati: tutti.length - resto.length, rimasti: resto.length });
    aggiornaPannello();
  }
  // 1.1.0: storico invii, riga "data, ora · squadra · modulo" sempre intera su una sola riga:
  // parte da 13 px e scende di mezzo punto solo se non entra, fino a 10 px.
  function adattaUltimoInvio() {
    try {
      var el = pannello && pannello.querySelector("#fvm-ultimo");
      if (!el) return;
      for (var dim = 13; dim >= 10; dim -= 0.5) { el.style.fontSize = dim + "px"; if (el.scrollWidth <= el.clientWidth) break; }
    } catch (e) {}
  }
  function aggiornaPannello() {
    if (!pannello) return;
    var slug = legaCorrente();
    var u = leggi("ultima", null);
    var invii = leggi("invii", []);
    var conn = connesso();
    ultimoConn = conn;
    var modo = leggi("modo", "lega_fle");
    iconaHomeInizio(); // G1: prima installazione o FVM gia in uso (prima che la Home scriva versione_usata)
    var msgIcona = iconaHomeMessaggio(piattaformaScelta() === "fantaclub" ? !!leggi("fc_connesso", null) : conn), iconaDaFare = iconaHomeDaCompletare();
    var h = "";
    h += "<div class='hero'><img src='" + LOGO_FVM + "' alt='FVM'><div style='flex:1'><button class='x' data-a='chiudi'>CHIUDI</button><div class='ht'>FANTA VICE<br>MISTER</div><div class='hs'>v" + VERSIONE_VISIBILE + " · Stagione 2026/27</div></div></div>";
    h += aggRiquadro(); // 1.3.4: aggiornamento disponibile / completato (solo se esiste davvero)
    // 1.0: riquadro di benvenuto alla prima apertura (sostituisce i passi login della guida)
    if (!leggi("benvenuto_ok", false) && !msgIcona) {
      h += "<div class='cd' style='border:2px solid #3fae4a'><div class='lb' style='color:#4ade80'>" + (iconaDaFare ? "BENVENUTO IN FANTA VICE MISTER" : "BENVENUTO · INSTALLAZIONE COMPLETATA ✓") + "</div>" +
        "<div class='t2'>Fanta Vice Mister è attivo su questo iPhone</div>" +
        (conn
          ? "<div class='mu'>• Sei connesso ✓</div><div class='mu'>• " + (slug ? "Lega riconosciuta: " + esc(nomeLega(slug)) : "Entra una volta nella tua lega con <b>CAMBIA LEGA</b>: poi la ricordo da solo.") + "</div>"
          : "<div class='mu'>• " + (iconaDaFare ? "Tocca" : "Ultimo passo: tocca") + " <b>ACCEDI</b> qui sotto ed entra con username e password di Fantacalcio. Dopo il login torni qui da solo.</div>") +
        "<div class='mu'>• Da ora apri Fanta Vice Mister dall'icona <b>FVM</b> sulla Home.</div>" +
        "<div class='mu'>• Dalle pagine di Fantacalcio, il bottone tondo <b>FVM</b> sul bordo destro ti riporta sempre qui.</div>" +
        "<button class='bt oro' data-a='benvenuto'>HO CAPITO</button></div>";
    }
    // 1.1.0 Fantaclub fase 3: piattaforma scelta (Leghe Fantacalcio o Fantaclub) con CAMBIA, come l'app Android.
    // CAMBIA cambia solo la piattaforma scelta in FVM: nessun logout da nessun sito.
    if (piattaformaScelta() === "fantaclub") {
      var fcConn = leggi("fc_connesso", null);
      h += "<div class='cd'><div class='lb'>ACCESSO PIATTAFORMA</div>" +
        (fcConn ? "<div style='color:#4ade80;font-size:20px;font-weight:900;margin-top:6px'>● Connesso ✓</div>" : "<div style='color:#fbbf24;font-size:20px;font-weight:900;margin-top:6px'>● Non connesso</div>") +
        "<div style='color:#e2b33c;font-weight:800'>Fantaclub</div>" +
        (fcConn ? "<div class='mu'>Accesso riconosciuto il " + esc(new Date(fcConn.at).toLocaleString("it-IT")) + "</div>" : "") +
        "<div class='mu'>Username e password vengono inseriti esclusivamente nella pagina ufficiale della piattaforma.</div>" +
        (fcConn
          ? "<button class='bt' data-a='cambia'>CAMBIA</button><button class='bt rosso' data-a='disconnetti_fc'>DISCONNETTI</button>"
          : "<button class='bt oro' data-a='accedi_fc'>ACCEDI</button><button class='bt' data-a='cambia'>CAMBIA</button>") + "</div>";
    } else {
      h += "<div class='cd'><div class='lb'>ACCESSO PIATTAFORMA</div>" +
        (conn ? "<div style='color:#4ade80;font-size:20px;font-weight:900;margin-top:6px'>● Connesso ✓</div>" : "<div style='color:#fbbf24;font-size:20px;font-weight:900;margin-top:6px'>● Non connesso</div>") +
        "<div style='color:#e2b33c;font-weight:800'>Leghe Fantacalcio</div>" +
        "<div class='mu'>Username e password vengono inseriti esclusivamente nella pagina ufficiale della piattaforma.</div>" +
        (conn ? "<button class='bt' data-a='cambia'>CAMBIA</button><button class='bt rosso' data-a='disconnetti'>DISCONNETTI</button>" : "<button class='bt oro' data-a='accedi'>ACCEDI</button><button class='bt' data-a='cambia'>CAMBIA</button>") + "</div>";
    }
    h += msgIcona; // G1: COMPLETA L'INSTALLAZIONE (solo prima configurazione, con l'accesso attivo)
    // 1.1.0 Fantaclub fasi 5-10: con Fantaclub scelto, carte Fantaclub (il ramo Leghe qui sotto resta invariato)
    if (piattaformaScelta() === "fantaclub") h += carteFantaclub();
    else {
    // 1.1.0: un solo comando. LEGA + FLE / SOLO LEGA / SOLO FLE si scelgono nella pagina formazione.
    var lav = legaLavoro(), slugP1 = lav || slug;
    h += "<div class='cd verde' data-a='formazione'><div class='lb' style='color:#cfe'>PASSO 1 · " + esc(slugP1 ? nomeLega(slugP1) : "LA TUA LEGA") + "</div>" +
      "<div style='font-size:18px;font-weight:900;margin:4px 0'>FAI O MODIFICA LA FORMAZIONE</div>" +
      "<div class='mu' style='color:#cfe'>Premi Salva formazione: ordine della panchina, poi controllo per FLE da solo.</div>" +
      "<div class='mu' style='color:#cfe;margin-top:4px'>Nella pagina della formazione puoi scegliere <span style='white-space:nowrap'>LEGA + FLE</span>, <span style='white-space:nowrap'>SOLO LEGA</span> o <span style='white-space:nowrap'>SOLO FLE</span>.</div></div>";
    // la mia squadra (PROVA7: subito sotto FAI O MODIFICA LA FORMAZIONE, prima di SQUADRA FLE; contenuto identico)
    var squadra = u && u.squadra ? u.squadra : "Da rilevare";
    h += "<div class='cd'><div class='lb'>LA MIA SQUADRA</div><div class='t1' style='margin-top:6px'>" + esc(squadra) + "</div>" +
      "<div class='mu' style='font-weight:800;margin-top:4px'>" + esc(slugP1 ? nomeLega(slugP1) : "") + "</div>" +
      "<button class='bt' data-a='leghe'>CAMBIA LEGA</button>" +
      (lav ? "<div style='color:#fbbf24;font-weight:700;margin-top:10px'>SOLO LEGA: nessuna squadra FLE per questa lega</div>" : u && u.fleTid ? (fleAutorizzatoLeghe(true).ok ? "<div style='color:#4ade80;font-weight:800;margin-top:10px'>✓ Squadra FLE verificata per questo account</div>" : identitaInArrivo() ? "<div style='color:#fbbf24;font-weight:700;margin-top:10px'>Riconoscimento dell'account in corso…</div>" : "<div style='color:#fbbf24;font-weight:700;margin-top:10px'>Squadra FLE prevista dalla tabella: da verificare con VERIFICA SQUADRA FLE</div>") : "<div style='color:#fbbf24;font-weight:700;margin-top:10px'>La squadra verrà riconosciuta dopo il salvataggio della formazione</div>") + "</div>";
    var sl = leggi("solo_lega_salvata", null);
    if (sl) {
      h += "<div class='cd' style='border-left:4px solid #e2b33c'><div class='lb'>SOLO LEGA</div>" +
        "<div class='t2' style='color:#4ade80'>Formazione salvata solo nella tua lega ✓</div>" +
        "<div class='mu'>" + esc(nomeLega(sl.lega)) + (sl.compName ? " · " + esc(sl.compName) : "") + "</div>" +
        "<div class='mu'>" + esc(new Date(sl.at).toLocaleString("it-IT")) + " · modulo " + esc(String(sl.modulo || "").split("").join("-")) + (sl.cambiata ? " · panchina nel tuo ordine" : "") + "</div>" +
        "<div class='mu' style='color:#fbbf24;font-weight:700;margin-top:4px'>Non è stata mandata a FLE.</div></div>";
    }
    if (lav) {
      // 1.3.4: nessun controllo/invio FLE con l'identita di un'altra lega (1.3.5: l'account non associato e nel riquadro SQUADRA FLE)
      h += "<div class='cd' style='border-left:4px solid #e2b33c'><div class='lb'>SOLO LEGA · NESSUN INVIO A FLE</div>" +
        "<div class='mu'>Stai lavorando su " + esc(nomeLega(lav)) + ". La tua lega FLE resta " + esc(nomeLega(slug)) + ": per tornarci scegli LEGA + FLE nella pagina della formazione.</div>" +
        "<div class='mu'>Far parte del circuito FantaLegaEuropa non basta: serve l'account associato alla squadra su FLE.</div></div>";
    }
    // 1.3.5: VERIFICA SQUADRA FLE (sola lettura) con lo stato della verifica per la lega FLE
    if (!lav) h += cartaSquadraFle();
    if (!lav) h += cartaPasso2();
    if (u && u.ok) {
      h += "<div class='cd'><div class='lb'>FORMAZIONE SALVATA IN LEGA</div><div class='mu' style='margin-top:6px'>" + esc(new Date(u.at).toLocaleString("it-IT")) + " · modulo " + esc(u.modulo) + " · " + u.titolari.length + " titolari · " + u.panchina.length + " panchinari</div>" +
        "<button class='bt' data-a='panchina'>MOSTRA PANCHINA ▾</button><div id='fvm-panchina' class='panchinaDet'>";
      u.panchina.forEach(function (id, i) { var p = (u.nomi && u.nomi[id]) || {}; h += rigaGiocatore(i + 1, { name: p.n || id, role: p.r }); });
      h += "</div></div>";
    }
    }
    // Fantaclub: RIPETI CONTROLLO FLE solo con lega del circuito FLE in uso e abbinamento valido (altrimenti assente).
    // Leghe Fantacalcio: invariato.
    if ((piattaformaScelta() !== "fantaclub" && !legaLavoro()) || (piattaformaScelta() === "fantaclub" && ricontrollaFcAmmesso())) h += "<button class='bt' data-a='ricontrolla'>RIPETI CONTROLLO FLE</button>";
    h += "<button class='bt' data-a='diagnosi'>CONDIVIDI DIAGNOSI</button>";
    h += "<button class='bt' data-a='icona'" + (msgIcona ? " style='border:2px solid #e2b33c'" : "") + ">METTI FVM SULLA HOME</button>"; // 1.3.3: icona FVM con la lega in uso (G1: bordo dorato durante la prima configurazione)
    h += "<div class='cd' style='margin-top:10px'><div class='lb'>STORICO INVII</div>";
    // storico unificato: ultima operazione (lega in uso, se presente) su una riga + esiti LEGA / FLE; elenco a parte
    try { h += cartaStorico(); } catch (e) { h += "<div class='mu' style='margin-top:6px'>Storico non disponibile.</div>"; }
    h += "<button class='bt' style='color:#aab3c2' data-a='admin'>AREA ADMIN</button></div>";
    if (ICONA_PROVA) h += "<button class='bt' style='color:#aab3c2;font-size:12px' data-a='icona_prova'>PROVA PRIVATA · MOSTRA DI NUOVO «COMPLETA L'INSTALLAZIONE»</button>";
    // 1.1.0: piede come l'app Android: logo FantaLegaEuropa centrato + dicitura
    h += "<div style='display:flex;flex-direction:column;align-items:center;gap:6px;margin-top:14px'>" +
      "<img src='" + LOGO_FLE + "' alt='FantaLegaEuropa' style='width:86px;height:86px;object-fit:contain;display:block'>" +
      "<div class='mu' style='text-align:center;font-size:11px;font-weight:700'>Per le competizioni della FantaLegaEuropa</div></div>";
    h += "<div class='mu' style='text-align:center;margin-top:6px'>Fanta Vice Mister " + VERSIONE_VISIBILE + " · Stagione 2026/27</div>";
    pannello.innerHTML = h;
    adattaUltimoInvio();
    var cb = pannello.querySelector("#fvm-ricorda");
    if (cb) cb.addEventListener("change", function () { scrivi("ricorda", !!cb.checked); });
    Array.prototype.forEach.call(pannello.querySelectorAll("[data-a]"), function (el) {
      el.addEventListener("click", function (ev) {
        ev.stopPropagation();
        var a = el.getAttribute("data-a");
        // 1.3.5: VERIFICA SQUADRA FLE; RIPETI CONTROLLO, INVIA e MODIFICA SU FLE (Leghe) solo con la squadra FLE verificata
        if (a === "verifica") { avviaVerificaFle("pulsante"); return; }
        // PROVA8: scelta dello SWITCH nel PASSO 2 (solo registrata: nessuna modifica su FLE finche non si invia)
        if (a.indexOf("sw_") === 0) { swScelta(a.slice(3)); return; }
        if ((a === "ricontrolla" || a === "invia" || a === "modifica") && piattaformaScelta() !== "fantaclub" && bloccoFleLeghe(a)) return;
        // 1.1.0: CHIUDI della Home = uscita completa, solo dopo conferma (Annulla: non succede nulla)
        if (a === "chiudi" && confirm("Vuoi chiudere Fanta Vice Mister e uscire da Leghe Fantacalcio su questo iPhone?")) esciDaFvm("chiudi");
        if (a === "benvenuto") { scrivi("benvenuto_ok", true); log("BENVENUTO", "chiuso"); aggiornaPannello(); }
        if (a === "agg_ora") aggApriGuida();
        if (a === "agg_nonora") { var sN = aggStato(); if (sN.nuova) { scrivi("agg_nonora", sN.nuova.versione); scrivi("agg_attesa", null); log("AGGIORNAMENTI", { esito: "NON ORA", versione: sN.nuova.versione }); } aggiornaPannello(); }
        if (a === "agg_ok") { scrivi("agg_completato", null); aggiornaPannello(); }
        // storico: una nuova consegna non e piu una MODIFICA SU FLE
        if (a === "formazione" || a === "formazione_fc") { try { sScrivi("storico_modifica", null); } catch (e) {} }
        if (a === "storico") apriStorico();
        if (a === "ufficiale") apriUfficiale();
        if (a === "formazione") vaiAllaFormazione();
        if (a === "icona") { if (iconaHomeStato() === "da_fare") iconaHomeSegna("aperta", "METTI FVM SULLA HOME"); meIconaHome(); } // G1: azione del pulsante invariata
        if (a === "icona_gia") { iconaHomeSegna("fatta", "conferma: ho gia l'icona"); aggiornaPannello(); return; }
        if (a === "icona_prova" && ICONA_PROVA) { scrivi("icona_home", { stato: "da_fare", at: Date.now(), come: "prova privata" }); log("ICONA HOME", { stato: "da_fare", come: "prova privata" }); aggiornaPannello(); return; }
        // 1.1.0: RIPETI CONTROLLO e INVIA lavorano sulla formazione LEGA + FLE: da SOLO LEGA si torna a LEGA + FLE.
        if ((a === "ricontrolla" || a === "invia") && leggi("modo", "lega_fle") === "solo_lega") { scrivi("modo", "lega_fle"); log("MODO", { a: "lega_fle", perche: a }); }
        if (a === "leghe") cambiaLegaHome();
        if (a === "accedi") accedi();
        if (a === "accedi_fc") accediFantaclub();
        if (a === "cambia") scegliPiattaforma();
        if (a === "disconnetti") disconnetti();
        if (a === "disconnetti_fc") disconnettiFantaclub();
        if (a === "diagnosi") condividiDiagnosi();
        if (a === "pulisci_storico") pulisciStorico();
        if (a === "admin") apriAdmin(true);
        // 1.1.0 Fantaclub: con Fantaclub scelto controllo e invio partono dalla formazione Fantaclub
        var conFc = piattaformaScelta() === "fantaclub";
        // PROVA13 B6: Switch facoltativo dopo l'invio da Fantaclub. NON ORA = solo memoria di FVM; IMPOSTA = MODIFICA SU FLE (stesse guardie)
        if (a === "fc_sw_nonora") { var fN = leggi("fle", null); if (fN) { fN.swNonOra = Date.now(); scrivi("fle", fN); } log("SWITCH FLE", { fonte: "fantaclub", scelta: "NON ORA" }); aggiornaPannello(); return; }
        if (a === "fc_imposta_sw") { log("SWITCH FLE", { fonte: "fantaclub", scelta: "IMPOSTA SWITCH" }); a = "modifica"; }
        if (a === "ricontrolla") { if (conFc) avviaControlloFc("pulsante"); else avviaControlloFle("pulsante"); }
        if (a === "formazione_fc") consegnaFantaclub();
        if (a === "fc_squadra") { impostaSquadraFc(el.getAttribute("data-s")); if (abbinamentoFcValido(leggi("fc_ultima", null))) avviaControlloFc("squadra scelta"); else aggiornaPannello(); }
        if (a === "fc_cambia_lega") { cambiaLegaFc(); aggiornaPannello(); }
        if (a === "fc_cambia_squadra") { var fu = leggi("fc_ultima", null); if (fu) { delete fu.squadra; delete fu.fleTid; scrivi("fc_ultima", fu); log("FANTACLUB SQUADRA", "da scegliere di nuovo"); } aggiornaPannello(); }
        if (a === "fc_manda_fle") {
          // SOLO LEGA Fantaclub -> MANDA ANCHE A FLE (come l'app): la formazione consegnata diventa quella LEGA + FLE
          var sl2 = leggi("fc_solo_lega", null);
          if (sl2 && !inCircuitoFc(sl2.nl)) { try { storicoBloccato("lega_fle", sl2.nl, "MANDA ANCHE A FLE: lega fuori dal circuito FLE", "fantaclub:" + sl2.at); } catch (e) {} avviso("Questa lega Fantaclub non è nel circuito FLE: nessun invio FLE.", true); sl2 = null; }
          if (sl2) { try { localStorage.removeItem(PREFISSO + "fc_solo_lega"); } catch (e) {} scrivi("modo", "lega_fle"); log("MODO", { a: "lega_fle", perche: "manda anche a FLE (Fantaclub)" }); usaFormazioneFc(sl2, false); sScrivi("fc_controllo_dopo", null); sScrivi("flash", null); if (abbinamentoFcValido(sl2)) avviaControlloFc("manda anche a FLE"); else aggiornaPannello(); }
        }
        if (a === "panchina") {
          var pd = pannello && pannello.querySelector("#fvm-panchina");
          if (pd) { pd.classList.toggle("aperta"); el.textContent = pd.classList.contains("aperta") ? "NASCONDI PANCHINA ▴" : "MOSTRA PANCHINA ▾"; }
        }
        if (a === "invia") { if (conFc) avviaInvioFc(); else avviaInvioFle(); }
        if (a === "riprova_verifica") avviaRiverifica(); // PROVA11: solo letture
        if (a === "dimentica_scelte") { var fD = leggi("fle", null); if (fD && fD.tid && confirm("Dimenticare le scelte ricordate per questa squadra FLE?\n\nI posti tornano da scegliere. Nessuna formazione viene salvata o inviata.")) { dimenticaScelteRicordate(fD.tid); aggiornaPannello(); } return; }
        // 1.1.0: MODIFICA SU FLE e lavoro solo sulla formazione FLE (modalita SOLO FLE nella barra).
        if (a === "modifica" && conFc && !fleFantaclubAmmesso().ok) { try { storicoBloccato("modifica_fle", (legaFc() || {}).nl || "", fleFantaclubAmmesso().testo); } catch (e) {} avviso(fleFantaclubAmmesso().testo, true); return; }
        // PROVA12 A1: MODIFICA SU FLE da Fantaclub solo per la squadra FLE abbinata e gia controllata (squadra attesa nota)
        if (a === "modifica" && conFc) {
          var atM = fleAttesoFc(), fM = leggi("fle", {}) || {};
          var noM = !atM.ok ? atM.testo : fM.fonte === "fantaclub" && Number(fM.tid) && Number(fM.tid) !== atM.fleTid
            ? "L'ultimo controllo FLE riguarda la squadra " + fM.tid + ", non la tua (" + atM.squadra + "): MODIFICA SU FLE non aperta. Tocca RIPETI CONTROLLO FLE." : "";
          if (noM) { log("GUARDIA FLE", { piattaforma: "fantaclub", azione: "modifica", esito: "non aperta", atteso: atM.ok ? atM.fleTid : 0, controllo: Number(fM.tid || 0) }); try { storicoBloccato("modifica_fle", (legaFc() || {}).nl || "", noM); } catch (e) {} avviso(noM, true); return; }
        }
        if (a === "modifica") { var f = leggi("fle", {}); if (f.comp) { try { sScrivi("storico_modifica", { at: Date.now() }); } catch (e) {} scrivi("modo", "solo_fle"); log("MODO", { a: "solo_fle", perche: "modifica" }); chiudiPannello(); location.assign(fleLineupUrl(f.comp)); } }
        if (a === "scegli" || a === "annulla") {
          var f2 = leggi("fle", null);
          if (!f2) return;
          f2.choices = f2.choices || {};
          var k = el.getAttribute("data-k");
          if (a === "scegli") {
            var pid = Number(el.getAttribute("data-p"));
            f2.choices[k] = pid;
            if (leggi("ricorda", true)) ricordaScelta(f2.tid, k, pid);
            log("SCELTA FLE", { chiave: k, pid: pid });
          } else {
            delete f2.choices[k];
            var tutte = leggi("scelte", {});
            if (tutte[f2.tid]) { delete tutte[f2.tid][k]; scrivi("scelte", tutte); }
          }
          scrivi("fle", f2);
          aggiornaPannello();
        }
      });
    });
  }

  // 0.3.9: SOLO FLE significa lavorare direttamente sul campo FLE.
  // Non avviare il controllo automatico: l'utente deve poter vedere,
  // modificare e salvare la formazione FLE normalmente.
  // 1.1.0: si sceglie dalla barra della pagina formazione.
  // PROVA12 A7: un SOLO FLE bloccato non cambia da solo la modalita scelta: resta quella di prima. Unica eccezione di
  // sicurezza: se la modalita registrata fosse gia SOLO FLE (aprirebbe FLE da sola), torna quella precedente o LEGA + FLE.
  function ripristinaModoBloccato(prima, perche) {
    var ora = leggi("modo", "lega_fle");
    if (ora !== "solo_fle") return ora;
    var torna = prima && prima !== "solo_fle" ? prima : "lega_fle";
    scrivi("modo", torna);
    log("MODO", { da: ora, a: torna, perche: perche || "SOLO FLE bloccato", nota: "SOLO FLE non attivato" });
    return torna;
  }
  function apriCampoFle(nlFc) {
    // Fantaclub scelto: blocco PRIMA di qualsiasi navigazione (quindi prima del login Leghe e della scelta di altre leghe)
    if (piattaformaScelta() === "fantaclub") {
      // PROVA12: anche la squadra FLE attesa (A1); bloccato = nessuna navigazione e modalita lasciata com'era (A7)
      var esFle = ammessoCampoFleFc(nlFc);
      if (!esFle.ok) {
        ripristinaModoBloccato(null, "SOLO FLE bloccato (Fantaclub)");
        log("SOLO FLE BLOCCATO", { piattaforma: "fantaclub", motivo: esFle.motivo, lega: esFle.lega || "" });
        aggiornaBarra(true);
        apriPannello();
        avviso(esFle.testo, true);
        return;
      }
    }
    var fSolo = leggi("fle", {}) || {};
    var destinazioneFle = Number(fSolo.comp || 0) ? fleLineupUrl(Number(fSolo.comp)) : fleDiscoveryUrl();
    if (!Number(fSolo.comp || 0)) sScrivi("vai_campo_fle", Date.now());
    log("PASSO 1 SOLO FLE", { comp: Number(fSolo.comp || 0), diretto: !!Number(fSolo.comp || 0) });
    chiudiPannello();
    location.assign(destinazioneFle);
  }
  function vaiAllaFormazione() {
    // 1.3.4: lega di lavoro diversa dalla lega FLE: si apre quella, sempre in SOLO LEGA (mai LEGA + FLE automatico)
    var lav = legaLavoro();
    if (lav) {
      scrivi("modo", "solo_lega");
      log("PASSO 1", { lega: lav, modo: "solo_lega", perche: "lega di lavoro, non la lega FLE" });
      chiudiPannello();
      vaiLega(lav);
      return;
    }
    // 1.1.0: come l'app, si parte da LEGA + FLE; 1.3.4: salvo account non associato alla squadra FLE (resta SOLO LEGA)
    // 1.3.5: LEGA + FLE SOLO con la squadra FLE verificata (VERIFICA SQUADRA FLE o controllo riuscito); altrimenti SOLO LEGA
    var azF = fleAutorizzatoLeghe();
    scrivi("modo", azF.ok ? "lega_fle" : "solo_lega");
    if (!azF.ok) log("PASSO 1", { modo: "solo_lega", perche: azF.motivo === "non_associato" ? "squadra FLE non associata a questo account (ultimo controllo)" : "squadra FLE " + (azF.motivo === "incerta" ? "con verifica incerta" : "non ancora verificata") });
    scrivi("solo_lega_salvata", null);
    var slug = legaCorrente();
    if (!slug) {
      // 1.1.0: lega sorgente non nota: la cerco tra le leghe dell'account (pagina "Scegli una lega" del sito)
      log("PASSO 1", { lega: "", azione: "cerco la lega sorgente nell'account" });
      sScrivi("apri_formazione_dopo", Date.now());
      chiudiPannello();
      location.assign("https://leghe.fantacalcio.it/");
      return;
    }
    var u = urlFormazione(slug);
    log("PASSO 1", { lega: slug, diretto: !!u });
    // 1.1.0: se il sito porta invece a "Scegli una lega", questa lega non e dell'account attuale (vedi riconosciSorgente)
    sScrivi("apro_formazione", { slug: slug, at: Date.now() });
    chiudiPannello();
    if (u) { location.assign(u); return; }
    try { sessionStorage.setItem(PREFISSO + "vai", "1"); } catch (e) {}
    location.assign("https://leghe.fantacalcio.it/" + slug);
    setTimeout(function () { avviso("Se non si apre da sola, tocca \"Inserisci formazione\" nella pagina della lega."); }, 8000);
  }

  // ---------------------------------------------------------------- 1.1.0 · lega sorgente dall'account
  // Sulla pagina "Scegli una lega" del sito si vedono le leghe dell'account collegato: la lega sorgente e quella
  // tra queste che e prevista in LEGHE_FONTE (una sola: automatica; piu di una: sceglie l'utente).
  // Se FAI O MODIFICA apriva una lega e il sito ha portato qui, quella lega non e dell'account attuale.
  var sceltaDa = 0, sceltaFatta = false;
  function paginaSceltaLega() {
    if (suLogin() || suFle() || slugDaPagina()) return false;
    try { return /scegli\s+una\s+lega/i.test(String(document.body && document.body.innerText || "")); } catch (e) { return false; }
  }
  function legheAccountVisibili() {
    var trovate = [];
    try {
      var as = document.querySelectorAll("a[href]");
      for (var i = 0; i < as.length; i++) {
        if (!elementoVisibile(as[i])) continue;
        var p = String(as[i].getAttribute("href") || "").replace(/^https?:\/\/leghe\.fantacalcio\.it/i, "").split(/[?#]/)[0];
        LEGHE_FONTE.forEach(function (l) { if ((p === "/" + l[1] || p.indexOf("/" + l[1] + "/") === 0) && trovate.indexOf(l[1]) < 0) trovate.push(l[1]); });
      }
      var els = document.querySelectorAll("a,button,[role='button'],div,span,p,h1,h2,h3,h4,li");
      for (var j = 0; j < els.length; j++) {
        var el = els[j];
        if (el.children.length > 3) continue;
        var tx = String(el.textContent || "");
        if (!tx || tx.length > 80 || !elementoVisibile(el)) continue;
        var n = soloLettere(tx);
        LEGHE_FONTE.forEach(function (l) {
          var k = soloLettere(l[0]);
          if (trovate.indexOf(l[1]) < 0 && n.indexOf(k) === 0 && n.length <= k.length + 30) trovate.push(l[1]);
        });
      }
    } catch (e) {}
    return trovate;
  }
  function continuaDopoSorgente() {
    if (sLeggi("apri_formazione_dopo")) { sScrivi("apri_formazione_dopo", null); vaiAllaFormazione(); return; }
    if (pannello && pannelloPrincipale) aggiornaPannello();
  }
  function scegliSorgente(slugs) {
    monta();
    if (!radice) return;
    var box = document.createElement("div");
    box.className = "ov";
    var h = "<div class='cd'><div class='lb'>FANTA VICE MISTER</div><div class='t1' style='margin-top:6px'>Quale lega usi per FLE?</div>" +
      "<div class='mu' style='margin-top:6px'>In questo account ci sono più leghe FLE previste: scegli quella della tua squadra FLE.</div></div>";
    slugs.forEach(function (s) {
      var l = LEGHE_FONTE.filter(function (x) { return x[1] === s; })[0];
      h += "<button class='bt' data-s='" + esc(s) + "'>" + esc(l ? l[0] : nomeLega(s)) + "</button>";
    });
    box.innerHTML = h;
    radice.appendChild(box);
    Array.prototype.forEach.call(box.querySelectorAll("[data-s]"), function (b) {
      b.addEventListener("click", function () { box.remove(); impostaSorgente(b.getAttribute("data-s"), "scelta utente"); continuaDopoSorgente(); });
    });
  }
  function riconosciSorgente() {
    try {
      var tent = sLeggi("apro_formazione");
      if (tent && Date.now() - Number(tent.at || 0) > 20000) { sScrivi("apro_formazione", null); tent = null; }
      var dopo = sLeggi("apri_formazione_dopo");
      if (dopo && Date.now() - Number(dopo) > 60000) { sScrivi("apri_formazione_dopo", null); dopo = null; }
      if (!paginaSceltaLega()) { sceltaDa = 0; sceltaFatta = false; return; }
      if (sceltaFatta) return;
      if (!sceltaDa) sceltaDa = Date.now();
      if (Date.now() - sceltaDa < 1200) return; // lascio al sito il tempo di mostrare le leghe
      var sorgente = leggi("lega_sorgente", "");
      var nonDisponibile = !!(tent && sorgente && tent.slug === sorgente);
      if (nonDisponibile) {
        log("LEGA SORGENTE NON DISPONIBILE", { lega: sorgente });
        sScrivi("apro_formazione", null);
        sScrivi("apri_formazione_dopo", Date.now());
        dopo = Date.now();
      }
      var trovate = legheAccountVisibili();
      if (!trovate.length && Date.now() - sceltaDa < 6000) return; // ancora in caricamento
      sceltaFatta = true;
      log("LEGA SORGENTE ACCOUNT", { previste: trovate, attuale: sorgente || "", nonDisponibile: nonDisponibile });
      // PROVA14: le leghe del circuito mostrate dal sito per l'account collegato sono leghe di QUESTO account
      if (!sLeggi("task")) trovate.forEach(function (s) { registraLegaAperta(s, "elenco «Scegli una lega» del sito"); });
      if (sorgente && !nonDisponibile && trovate.indexOf(sorgente) >= 0) return; // gia corretta per questo account
      if (trovate.length === 1) { impostaSorgente(trovate[0], "account"); continuaDopoSorgente(); return; }
      if (trovate.length > 1) {
        if (sorgente && !nonDisponibile && trovate.indexOf(sorgente) >= 0) return;
        chiudiPannello();
        scegliSorgente(trovate);
        return;
      }
      if (dopo || nonDisponibile) { sScrivi("apri_formazione_dopo", null); avviso("In questo account non trovo una lega FLE prevista.", true); }
    } catch (e) {}
  }

  // ---------------------------------------------------------------- 1.1.0 · barra della pagina formazione
  // Come l'app: nella vera pagina Inserisci formazione compaiono il selettore
  // LEGA + FLE / SOLO LEGA / SOLO FLE e il promemoria FLE.
  var barra = null, barraFirma = "";
  function scegliModo(m) {
    var prima = leggi("modo", "lega_fle");
    if (m === prima) return;
    // 1.3.5: LEGA + FLE e SOLO FLE (Leghe Fantacalcio) solo con la squadra FLE verificata; altrimenti resta la modalita attuale
    if ((m === "lega_fle" || m === "solo_fle") && piattaformaScelta() !== "fantaclub" && bloccoFleLeghe(m)) { log("MODO", { da: prima, a: m, esito: "non autorizzato" }); aggiornaBarra(true); return; }
    // PROVA12 A1/A7: SOLO FLE con Fantaclub controllato PRIMA di cambiare modalita (bloccato = resta quella di prima)
    if (m === "solo_fle" && piattaformaScelta() === "fantaclub") {
      var esM = ammessoCampoFleFc();
      if (!esM.ok) { log("SOLO FLE BLOCCATO", { piattaforma: "fantaclub", motivo: esM.motivo, lega: esM.lega || "" }); log("MODO", { da: prima, a: m, esito: "non autorizzato" }); aggiornaBarra(true); avviso(esM.testo, true); return; }
    }
    scrivi("modo", m);
    log("MODO", { da: prima, a: m, pagina: location.pathname });
    if (m !== "solo_lega" && leggi("lega_lavoro", "")) cambiaLegaLavoro("", m === "lega_fle" ? "LEGA + FLE scelto" : "SOLO FLE scelto");
    if (m === "solo_fle") { apriCampoFle(); return; }
    if (m === "solo_lega") {
      if (suFle()) vaiLega(leggi("lega_uso", "") || legaCorrente());
      else aggiornaBarra(true);
      return;
    }
    // LEGA + FLE: per FLE conta la competizione principale della lega associata.
    var src = legaCorrente();
    if (!src) { avviso("Entra prima nella tua lega dal sito: poi la riconosco da sola.", true); aggiornaBarra(true); return; }
    var qui = location.pathname.match(/^\/([^\/]+)\/view\/competition\/(\d+)\/lineup/);
    if (qui && qui[1] === src && Number(qui[2]) === Number(leggi("comp_" + src, 0))) { aggiornaBarra(true); return; }
    vaiLega(src);
  }
  function apriPromemoriaFle() {
    monta();
    if (!radice) return;
    var box = document.createElement("div");
    box.className = "ov";
    box.innerHTML = "<div class='cd'><div class='lb'>PROMEMORIA FANTALEGAEUROPA</div>" +
      "<div class='mu' style='margin-top:10px;font-size:14px;color:#e8edf5'>• Titolari: solo giocatori presenti nella tua rosa FLE da 25.</div>" +
      "<div class='mu' style='margin-top:10px;font-size:14px;color:#e8edf5'>• Panchina: almeno 2 portieri, 3 difensori, 3 centrocampisti e 3 attaccanti presenti nei 25 FLE, nell'ordine di entrata che scegli tu (non serve raggrupparli per ruolo).</div>" +
      "<div class='mu' style='margin-top:10px;font-size:14px;color:#e8edf5'>• Se la tua lega permette una panchina più lunga (12, 13, 15…) va bene: per FLE prendo i primi 2P, 3D, 3C e 3A nell'ordine in cui li hai messi, saltando chi non è nei 25 FLE.</div>" +
      "<div class='mu' style='margin-top:10px;font-size:14px;color:#e8edf5'>• La tua lega può avere una rosa più grande (26, 27, 30…) o mercati in date diverse: per FLE conta solo la rosa registrata in FantaLegaEuropa.</div>" +
      "<button class='bt oro' data-b='ok'>HO CAPITO</button></div>";
    radice.appendChild(box);
    box.querySelector("[data-b='ok']").addEventListener("click", function () { box.remove(); aggiornaBarra(true); });
  }
  function aggiornaBarra(forza) {
    if (!radice) return;
    var mostra = suFormazione() && !suLogin() && !taskAttivoFle() && !window.__fvmInvio && !radice.querySelector(".ov");
    if (!mostra) {
      if (barra) { barra.remove(); barra = null; }
      if (osservaBarra) { osservaBarra.disconnect(); osservaBarra = null; }
      barraFirma = ""; spazioBarra(); aggiornaFab(); return;
    }
    var modo = leggi("modo", "lega_fle");
    var slug = slugDaPagina();
    var mc = location.pathname.match(/\/competition\/(\d+)\//);
    var compQui = mc ? Number(mc[1]) : 0;
    // elenco arrivato durante il cambio di lega: verificato sulla pagina definitiva della stessa lega
    verificaCompsInAttesa();
    // SOLO LEGA, e SOLO FLE sulla pagina FantaLegaEuropa-FLE: competizioni della lega della pagina
    // (per FLE la copia separata comps_<FLE>, mai ctl.comps)
    var conChip = !!slug && (modo === "solo_lega" || (modo === "solo_fle" && suFle()));
    var comps = conChip ? leggi("comps_" + slug, []) : [];
    // mostro solo competizioni valide per la competizione aperta (mai quelle di un'altra lega)
    if (!comps.some(function (c) { return c.id === compQui; })) comps = [];
    if (conChip) richiediCompetizioni(slug, compQui, comps.length > 0);
    var firma = [modo, location.pathname, JSON.stringify(comps)].join("|");
    if (!forza && barra && barra.isConnected && firma === barraFirma) { spazioBarra(); return; }
    barraFirma = firma;
    if (!barra || !barra.isConnected) {
      barra = document.createElement("div"); barra.className = "barra"; radice.appendChild(barra);
      if (osservaBarra) osservaBarra.disconnect();
      osservaBarra = window.ResizeObserver ? new ResizeObserver(function () { spazioBarra(); }) : null;
      if (osservaBarra) osservaBarra.observe(barra);
    }
    // Riga unica: le tre modalita sempre selezionabili + CHIUDI (stessa funzione del bottone FVM).
    // Per cambiare lega in SOLO LEGA si usa il selettore originale del sito.
    var h = "<div class='bh'><div class='seg'>" +
      "<div data-b='modo' data-m='lega_fle' class='" + (modo === "lega_fle" ? "on" : "") + "'>LEGA + FLE</div>" +
      "<div data-b='modo' data-m='solo_lega' class='" + (modo === "solo_lega" ? "on" : "") + "'>SOLO LEGA</div>" +
      "<div data-b='modo' data-m='solo_fle' class='" + (modo === "solo_fle" ? "on" : "") + "'>SOLO FLE</div></div>" +
      "<span class='chiudi' data-b='chiudi'>CHIUDI</span></div>";
    // avviso rosso: SOLO LEGA su una lega diversa da FantaLegaEuropa-FLE (invariato)
    if (modo === "solo_lega" && !suFle()) h += "<div class='avv'>⚠ Questa formazione NON andrà su FLE</div>";
    // solo le competizioni reali della lega (SOLO LEGA, e SOLO FLE su FantaLegaEuropa-FLE); il nome e gia sulla fascia
    if (comps.length) {
      h += "<div class='chips'>";
      comps.forEach(function (c) { h += "<span class='chip" + (c.id === compQui ? " on" : "") + "' data-b='comp' data-c='" + c.id + "'>" + esc(c.name) + "</span>"; });
      h += "</div>";
    } else if (conChip) {
      // 1.1.0 sfarfallio: riga competizioni gia riservata (vuota) finche i chip non arrivano: la pagina non si sposta
      h += "<div class='chips'></div>";
    }
    // sulla pagina FLE niente piu testo lungo: restano i chip. Promemoria Panchina FLE solo in LEGA + FLE (come Android).
    if (modo === "lega_fle" && !suFle()) h += "<div class='regole' data-b='regole'>ⓘ Panchina FLE: esattamente 2P · 3D · 3C · 3A (11 fissi, regolamento FLE) dei 25 FLE, nel tuo ordine di entrata ›</div>";
    // PROVA13 decisione A: promemoria delle opzioni di salvataggio (le scelte nella lega restano dell'utente; su FLE FVM decide sempre)
    if (modo === "lega_fle" && !suFle()) h += "<div class='regole'>ⓘ Nella tua lega «Salva per tutte le competizioni» e «Invisibile» li scegli tu. Su FLE FVM salva sempre per tutte le competizioni, invisibile.</div>";
    // 1.1.0 sfarfallio: se il contenuto e identico a quello gia disegnato non ricostruisco la barra
    // (i comandi restano quelli gia collegati: stesso HTML = stessi valori)
    if (barra.__fvmHtml === h) { spazioBarra(); aggiornaFab(); return; }
    barra.__fvmHtml = h;
    barra.innerHTML = h;
    // riga competizioni scorrevole: porto in vista la competizione aperta
    try { var rigaC = barra.querySelector(".chips"), chipOn = barra.querySelector(".chip.on"); if (rigaC && chipOn) rigaC.scrollLeft = Math.max(0, chipOn.offsetLeft - rigaC.offsetLeft - 10); } catch (e) {}
    Array.prototype.forEach.call(barra.querySelectorAll("[data-b]"), function (el) {
      el.addEventListener("click", function (ev) {
        ev.stopPropagation();
        var b = el.getAttribute("data-b");
        if (b === "chiudi") apriPannello();
        if (b === "modo") scegliModo(el.getAttribute("data-m"));
        if (b === "regole") apriPromemoriaFle();
        if (b === "comp") {
          var id = Number(el.getAttribute("data-c"));
          if (id && id !== compQui && slug) { log("SOLO LEGA COMPETIZIONE", { lega: slug, comp: id }); location.assign("https://leghe.fantacalcio.it/" + slug + "/view/competition/" + id + "/lineup"); }
        }
      });
    });
    spazioBarra();
    aggiornaFab();
    var msg = sLeggi("avviso_blocco");
    if (msg) { sScrivi("avviso_blocco", null); avviso(msg, true); }
  }
  // Spazio in cima alla pagina del sito pari all'altezza REALE della barra,
  // cosi selettore leghe, countdown e Dashboard del sito restano visibili e cliccabili.
  var osservaBarra = null, paddingPagina = null;
  function spazioBarra() {
    var de = document.documentElement;
    if (!de) return;
    if (barra && barra.isConnected) {
      posizioneSoloLega();
      if (paddingPagina === null) paddingPagina = de.style.paddingTop || "";
      var v = Math.ceil(barra.getBoundingClientRect().height) + "px";
      if (de.style.paddingTop !== v) de.style.paddingTop = v;
    } else if (paddingPagina !== null) {
      de.style.paddingTop = paddingPagina;
      paddingPagina = null;
    }
    aggiornaFascia();
  }
  // Solo SOLO LEGA: testata originale del sito (con il selettore delle leghe) visibile,
  // barra FVM subito sotto, menu del selettore sopra la barra.
  // Testata = contenitore fisso del pulsante con il nome della lega, trovato con lo stesso
  // criterio di selezionaFleNelSelettore; se non basta, misura di cio che sta in cima allo schermo.
  var testataCache = { at: 0, r: null }, testataLog = "";
  // L'elemento della testata resta in memoria 2 s, ma il suo bordo inferiore viene letto OGNI volta:
  // la testata del sito si accorcia e si allunga scrollando (66 → 39 → 19 → 66).
  function bassoAttuale(r) {
    if (!r) return null;
    if (!r.el.isConnected) { testataCache.at = 0; return null; }
    r.basso = Math.max(0, Math.ceil(r.el.getBoundingClientRect().bottom));
    return r;
  }
  function trovaTestataSito() {
    if (Date.now() - testataCache.at < 2000) return bassoAttuale(testataCache.r);
    var r = null;
    try {
      var fissoDa = function (el) {
        for (var n = el; n && n.nodeType === 1 && n !== document.body && n !== document.documentElement; n = n.parentElement) {
          var p = getComputedStyle(n).position;
          if (p === "fixed" || p === "sticky") return n;
        }
        return null;
      };
      // confronto solo su lettere e cifre: vale anche per nomi con trattini (TOTA ITALIA -AD VICTORIAM-, FantaLegaEuropa-FLE)
      var nome = soloLettere(nomeLega(slugDaPagina()));
      if (nome) {
        var candidati = document.querySelectorAll('button,[role="button"],div,a'), migliore = null, altoMin = 1e9;
        for (var i = 0; i < candidati.length; i++) {
          var el = candidati[i]; if (!elementoVisibile(el)) continue;
          var tx = soloLettere(el.textContent);
          if (tx.indexOf(nome) >= 0 && tx.length < nome.length + 80) {
            var t = el.getBoundingClientRect().top;
            if (t < altoMin) { altoMin = t; migliore = el; }
          }
        }
        var fx = migliore && altoMin < window.innerHeight / 3 ? fissoDa(migliore) : null;
        if (fx) r = { metodo: "selettore", el: fx };
      }
      if (!r && document.elementsFromPoint) {
        var punti = [2, 20];
        for (var k = 0; k < punti.length && !r; k++) {
          var els = document.elementsFromPoint(window.innerWidth / 2, punti[k]);
          for (var j = 0; j < els.length; j++) {
            if (els[j] === host) continue;
            var f = fissoDa(els[j]);
            if (f) { r = { metodo: "misura", el: f }; break; }
          }
        }
      }
      if (r) {
        var rc = r.el.getBoundingClientRect();
        // (bordo <= 0 = testata momentaneamente nascosta dallo scroll: resta valida)
        if (rc.bottom > window.innerHeight / 3) r = null;
        else r.z = parseInt(getComputedStyle(r.el).zIndex, 10) || 0;
      }
    } catch (e) { r = null; }
    testataCache = { at: Date.now(), r: r };
    return bassoAttuale(r);
  }
  function posizioneSoloLega() {
    if (!barra) return;
    // anche su FantaLegaEuropa-FLE scelta dal selettore del sito restando in SOLO LEGA
    var soloLega = leggi("modo", "lega_fle") === "solo_lega";
    var t = soloLega ? trovaTestataSito() : null;
    var legaQui = slugDaPagina();
    // 1.1.0 sfarfallio: la posizione massima della testata e legata alla LEGA (non all'elemento della testata,
    // che il sito puo ridisegnare) e ricordata nella scheda, cosi a ogni nuova pagina della stessa lega
    // la barra compare subito nella posizione giusta invece di partire dall'alto.
    if (soloLega && (!testataMax || testataMax.lega !== legaQui)) {
      var memo = (sLeggi("testata_max") || {})[legaQui];
      testataMax = { lega: legaQui, max: memo ? Number(memo.max || 0) : 0, z: memo ? Number(memo.z || 0) : 0 };
    }
    if (t) {
      // Posizione STABILE: sotto il bordo della testata quando e alla sua altezza piena (il massimo visto).
      // Quando la testata si accorcia scrollando, la barra non la insegue: niente salti e niente coperture.
      // (a menu aperto la testata si allunga: quella misura non conta)
      if (!menuAperto && t.basso > testataMax.max) testataMax.max = t.basso;
      testataMax.z = t.z;
      var mem = sLeggi("testata_max") || {};
      if (!mem[legaQui] || mem[legaQui].max !== testataMax.max || mem[legaQui].z !== testataMax.z) { mem[legaQui] = { max: testataMax.max, z: testataMax.z }; sScrivi("testata_max", mem); }
    }
    if (soloLega && testataMax && testataMax.max > 0) {
      attesaPosizioneDa = 0;
      barra.style.visibility = "";
      // (anche se la testata per un attimo non si trova, es. menu aperto o cambio lega: resta dov'era)
      barra.style.top = testataMax.max + "px";
      barra.style.paddingTop = "6px";
      // Livello: SOPRA tutta la pagina del sito, compreso l'header con la fascia celeste 1.50.4
      // (relative z300, 143-243 px: si sovrapponeva alla riga competizioni). Valore fisso e stabile,
      // sotto solo alle finestre di FVM (Home, ordine panchina, avvisi).
      // SOTTO la testata solo mentre il menu delle leghe del sito e aperto, cosi il menu compare sopra la barra.
      barra.style.zIndex = String(menuAperto ? Math.max(1, testataMax.z - 1) : LIVELLO_BARRA_SOLO_LEGA);
      controllaCoperturaBarra();
    } else {
      if (!soloLega) testataMax = null;
      barra.style.top = ""; barra.style.paddingTop = ""; barra.style.zIndex = "";
      // 1.1.0 sfarfallio: in SOLO LEGA, finche la testata non e stata trovata, la barra resta invisibile
      // (lo spazio in cima e gia riservato) per al massimo 1,5 s: non compare in alto per poi scendere.
      if (soloLega) {
        if (!attesaPosizioneDa) attesaPosizioneDa = Date.now();
        barra.style.visibility = Date.now() - attesaPosizioneDa < 1500 ? "hidden" : "";
      } else { attesaPosizioneDa = 0; barra.style.visibility = ""; }
    }
    if (!soloLega) return;
    // registro solo quando cambia la testata trovata (non a ogni movimento dello scroll)
    var chiave = t ? t.metodo + "|" + t.z + "|" + String(t.el.className || "").slice(0, 60) : "nessuna";
    if (chiave !== testataLog) {
      testataLog = chiave;
      log("BARRA SOLO LEGA", t ? { metodo: t.metodo, tag: t.el.tagName.toLowerCase(), classe: String(t.el.className || "").slice(0, 60), basso: t.basso, z: t.z } : { metodo: "nessuna testata fissa" });
    }
  }
  var LIVELLO_BARRA_SOLO_LEGA = 2147483600;
  // Diagnosi (una volta per pagina): cosa c'e davvero in primo piano a meta della riga competizioni.
  var coperturaLog = "";
  function controllaCoperturaBarra() {
    try {
      if (menuAperto || !barra || coperturaLog === location.pathname) return;
      var riga = barra.querySelector(".chips") || barra;
      var rr = riga.getBoundingClientRect();
      if (rr.height < 4) return;
      coperturaLog = location.pathname;
      var sopra = document.elementFromPoint(window.innerWidth / 2, rr.top + rr.height / 2);
      log("BARRA SOLO LEGA PRIMO PIANO", sopra === host ? "FVM" : { tag: sopra ? sopra.tagName.toLowerCase() : "", classe: sopra ? String(sopra.className || "").slice(0, 50) : "", z: sopra ? getComputedStyle(sopra).zIndex : "" });
    } catch (e) {}
  }
  // SOLO LEGA: durante lo scroll (e per un attimo dopo, mentre la testata si anima) solo il nome
  // sulla fascia segue la fascia vera del sito; la barra FVM resta ferma (vedi posizioneSoloLega).
  var testataMax = null, attesaPosizioneDa = 0;
  var seguiId = 0, seguiFino = 0;
  function seguiTestata() {
    seguiFino = Date.now() + 600;
    if (seguiId) return;
    var passo = function () {
      seguiId = 0;
      if (!barra || !barra.isConnected || leggi("modo", "lega_fle") !== "solo_lega") return;
      spostaFascia();
      if (Date.now() < seguiFino) seguiId = requestAnimationFrame(passo);
    };
    seguiId = requestAnimationFrame(passo);
  }
  window.addEventListener("scroll", seguiTestata, { capture: true, passive: true });

  // ---------------------------------------------------------------- SOLO LEGA · competizioni e nome reale della lega
  // Competizioni: il sito le chiede solo aprendo il suo menu. Dopo un cambio di lega ripeto
  // (in sola lettura) la stessa richiesta del sito; il risultato passa da salvaCompetizioni.
  var richiestaComps = null;
  var ATTESE_COMPS = [1500, 4000, 8000]; // 3 tentativi, misurati dal cambio di pagina
  function altraLegaNellIndirizzo(slug) {
    var u = String(compsUrl || "");
    if (u.indexOf(slug) >= 0) return false;
    return leggi("leghe_note", []).concat([FLE_SLUG]).some(function (s) { return s && s !== slug && u.indexOf(s) >= 0; });
  }
  function richiediCompetizioni(slug, comp, giaValide) {
    if (giaValide || !slug || !comp) return;
    var chiave = location.pathname;
    if (!richiestaComps || richiestaComps.chiave !== chiave) richiestaComps = { chiave: chiave, n: 0, inizio: Date.now(), inCorso: false, saltata: "" };
    var rq = richiestaComps;
    var motivo = !compsUrl ? "indirizzo competitions non noto" : altraLegaNellIndirizzo(slug) ? "indirizzo legato a un'altra lega" : "";
    if (motivo) {
      if (rq.saltata !== motivo) { rq.saltata = motivo; log("COMPETIZIONI RICHIESTA", { lega: slug, esito: "saltata", motivo: motivo }); }
      return;
    }
    if (rq.inCorso || rq.n >= ATTESE_COMPS.length || Date.now() - rq.inizio < ATTESE_COMPS[rq.n]) return;
    rq.inCorso = true; rq.n++;
    var tentativo = rq.n;
    getApi(compsUrl.slice(API.length)).then(function (j) {
      var cl = competizioniLega(j);
      var esito = location.pathname === chiave ? salvaCompetizioni(slug, cl, "fvm") : false;
      var ok = esito === true;
      log("COMPETIZIONI RICHIESTA", { lega: slug, tentativo: tentativo, ricevute: cl.length, numeri: numeriComps(cl), attesa: comp, esito: ok ? "valide" : esito === "attesa" ? "in attesa della pagina definitiva" : "non valide" });
      if (ok) aggiornaBarra(true);
    }).catch(function (e) {
      log("COMPETIZIONI RICHIESTA", { lega: slug, tentativo: tentativo, esito: "errore", dettaglio: String(e && e.message || e).slice(0, 80) });
    }).then(function () { rq.inCorso = false; });
  }
  // Nome reale: 1) dal DOM del sito (anche se non si vede); 2) solo se manca, appreso dal menu del sito.
  function soloLettere(s) { return String(s || "").toUpperCase().replace(/[^A-Z0-9]/g, ""); }
  // Dal blocco trovato tengo SOLO i pezzi di testo che formano il nome della lega
  // (la fascia contiene anche la competizione o "Classic": vanno esclusi).
  function testoNome(el, cerca) {
    try {
      var w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null), acc = "", nodo;
      while ((nodo = w.nextNode())) {
        var t = nodo.nodeValue || "";
        if (!soloLettere(t)) { if (acc) acc += t; continue; }
        var prova = acc + t, lp = soloLettere(prova);
        if (cerca.indexOf(lp) !== 0) break;
        acc = prova;
        if (lp === cerca) return acc.replace(/\s+/g, " ").trim();
      }
    } catch (e) {}
    return "";
  }
  // Prima riga di testo di un elemento (per i nomi appresi dal menu).
  function primoTesto(el) {
    try {
      var w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null), nodo;
      while ((nodo = w.nextNode())) { var t = String(nodo.nodeValue || "").replace(/\s+/g, " ").trim(); if (soloLettere(t)) return t; }
    } catch (e) {}
    return "";
  }
  var nomeCache = { chiave: "", at: 0, r: null }, nomeLog = "", ultimoNome = null;
  function nomeLegaSito(slug) {
    var chiave = location.pathname;
    if (nomeCache.r && nomeCache.chiave === chiave && Date.now() - nomeCache.at < 1000) return nomeCache.r;
    var r = { nome: "", fonte: "", el: null };
    try {
      var cerca = soloLettere(nomeLega(slug));
      if (cerca) {
        // prima nella testata del sito (dove sta il selettore), solo se li non c'e in tutta la pagina:
        // su FantaLegaEuropa-FLE il nome compare anche nel contenuto e non va confuso con la fascia
        var testa = trovaTestataSito();
        var trova = function (base) {
          var els = base.querySelectorAll("button,[role='button'],a,div,span,p,h1,h2,h3,li"), m = null, lm = 1e9;
          for (var i = 0; i < els.length; i++) {
            var el = els[i];
            if (el.children.length > 3) continue;
            var tx = String(el.textContent || "").replace(/\s+/g, " ").trim();
            if (!tx || tx.length > 80) continue;
            var n = soloLettere(tx);
            if (n.indexOf(cerca) === 0 && n.length <= cerca.length + 30 && tx.length < lm) { lm = tx.length; m = el; }
          }
          return m;
        };
        var migliore = (testa && trova(testa.el)) || trova(document);
        var nomeDom = migliore ? testoNome(migliore, cerca) : "";
        if (nomeDom) r = { nome: nomeDom, fonte: "dom", el: migliore };
      }
      if (!r.nome) {
        var sc = sLeggi("nome_scelto");
        if (sc && Date.now() - Number(sc.at || 0) < 15000 && sc.da !== slug && slug !== FLE_SLUG) {
          scrivi("nome_lega_" + slug, sc.nome); sScrivi("nome_scelto", null);
          log("NOME LEGA APPRESO", { lega: slug, nome: sc.nome, da: "voce del menu" });
        }
        var appreso = leggi("nome_lega_" + slug, "");
        if (appreso) r = { nome: appreso, fonte: "menu", el: null };
      }
    } catch (e) {}
    // Ultimo nome valido della lega corrente: se durante un ridisegno o un cambio di competizione
    // il nome sparisce per un attimo dal DOM, resta quello (cambia solo con una lega diversa).
    if (r.nome) ultimoNome = { slug: slug, nome: r.nome, fonte: r.fonte, el: r.el };
    else if (ultimoNome && ultimoNome.slug === slug) r = { nome: ultimoNome.nome, fonte: ultimoNome.fonte, el: ultimoNome.el && ultimoNome.el.isConnected ? ultimoNome.el : null, conservato: true };
    nomeCache = { chiave: chiave, at: Date.now(), r: r };
    var k = slug + "|" + r.fonte + "|" + r.nome;
    if (k !== nomeLog) { nomeLog = k; log("NOME LEGA", { lega: slug, nome: r.nome || "(non disponibile)", fonte: r.fonte || "nessuna" }); }
    return r;
  }
  // Menu delle leghe del sito aperto = sotto la fascia e visibile la voce FLE o il nome di un'altra lega nota.
  function menuLegheAperto(slug, sotto) {
    try {
      var chiavi = [];
      if (slug !== FLE_SLUG) chiavi.push(soloLettere("FantaLegaEuropa-FLE"));
      leggi("leghe_note", []).forEach(function (s) {
        if (!s || s === slug) return;
        chiavi.push(soloLettere(nomeLega(s)));
        var n = leggi("nome_lega_" + s, ""); if (n) chiavi.push(soloLettere(n));
      });
      chiavi = chiavi.filter(Boolean);
      if (!chiavi.length) return false;
      var els = document.querySelectorAll("button,[role='button'],a,li,div,span");
      for (var i = 0; i < els.length; i++) {
        var el = els[i];
        if (el.children.length > 3) continue;
        var tx = String(el.textContent || "");
        if (!tx || tx.length > 80) continue;
        var n2 = soloLettere(tx);
        if (!chiavi.some(function (k) { return n2.indexOf(k) === 0 && n2.length <= k.length + 30; })) continue;
        if (!elementoVisibile(el)) continue;
        if (sotto != null && el.getBoundingClientRect().top < sotto - 2) continue;
        return true;
      }
    } catch (e) {}
    return false;
  }
  // Solo se il nome non e nel DOM: dalle voci-collegamento del menu aperto imparo i nomi delle altre leghe.
  function imparaNomiMenu(slug) {
    try {
      var as = document.querySelectorAll("a[href]");
      for (var i = 0; i < as.length; i++) {
        if (!elementoVisibile(as[i])) continue;
        var m = String(as[i].getAttribute("href") || "").replace(/^https?:\/\/leghe\.fantacalcio\.it/i, "").match(/^\/([^\/?#]+)/);
        var tx = primoTesto(as[i]);
        if (!m || m[1] === slug || m[1] === FLE_SLUG || !tx || tx.length > 60) continue;
        if (leggi("nome_lega_" + m[1], "") !== tx) { scrivi("nome_lega_" + m[1], tx); log("NOME LEGA APPRESO", { lega: m[1], nome: tx, da: "collegamento del menu" }); }
      }
    } catch (e) {}
  }
  // Fascia del selettore: contenitore cliccabile del nome nel DOM, oppure quella appresa dal tocco che apre il menu.
  function trovaFascia(info) {
    if (info.el) {
      // deve stare nella testata in alto, non nel contenuto della pagina
      var t = trovaTestataSito();
      if (t && !t.el.contains(info.el)) return null;
      for (var n = cliccabileDa(info.el); n && n !== document.body; n = n.parentElement) {
        var rc = n.getBoundingClientRect();
        if (rc.width > 40 && rc.height > 16) return rc.top < window.innerHeight / 3 ? { el: n, metodo: "dom" } : null;
      }
      return null;
    }
    var f = leggi("fascia_firma", null);
    if (!f || !f.tag) return null;
    var els = document.getElementsByTagName(f.tag);
    for (var i = 0; i < els.length; i++) {
      if (String(els[i].className || "") !== f.classe || !elementoVisibile(els[i])) continue;
      if (els[i].getBoundingClientRect().top < window.innerHeight / 3) return { el: els[i], metodo: "appresa" };
    }
    return null;
  }
  // Overlay con il SOLO nome della lega: blu scuro da chiuso, celestino con il menu aperto,
  // centrato nello schermo con margini uguali. Il tocco va SEMPRE al vero selettore del sito:
  // - se l'overlay sta tutto sopra la fascia vera: pointer-events:none (il dito la tocca direttamente);
  // - se, per centrarlo, sporge fuori dalla fascia vera: il tocco viene inoltrato alla fascia vera.
  var fascia = null, fasciaLog = "", fasciaEl = null, inoltroLog = false;
  function inoltraAllaFascia(ev) {
    try {
      ev.preventDefault(); ev.stopPropagation();
      var el = fasciaEl && fasciaEl.isConnected ? cliccabileDa(fasciaEl) : null;
      if (!el) return;
      segnaToccoFascia();
      var rc = el.getBoundingClientRect(), x = rc.left + rc.width / 2, y = rc.top + rc.height / 2;
      ["pointerdown", "mousedown", "pointerup", "mouseup"].forEach(function (tipo) {
        try {
          var opz = { bubbles: true, cancelable: true, composed: true, view: window, clientX: x, clientY: y, pointerType: "touch", isPrimary: true };
          el.dispatchEvent(tipo.indexOf("pointer") === 0 && window.PointerEvent ? new PointerEvent(tipo, opz) : new MouseEvent(tipo, opz));
        } catch (e) {}
      });
      el.click();
      if (!inoltroLog) { inoltroLog = true; log("FASCIA LEGA", "tocco inoltrato al selettore originale"); }
    } catch (e) {}
  }
  // posizione orizzontale: centrata, dentro lo schermo, senza coprire INSERISCI FORMAZIONE sulla stessa riga
  function geometriaFascia(r, larghezza) {
    var vw = document.documentElement.clientWidth || window.innerWidth, margine = 12;
    var w = Math.min(larghezza, vw - 2 * margine), left = (vw - w) / 2;
    var b = elementoTesto(/^inserisci formazione$/i);
    if (b) {
      var rb = b.getBoundingClientRect();
      if (rb.bottom > r.top && rb.top < r.bottom && rb.left < left + w && rb.right > left) {
        var limite = rb.left - 8;
        left = Math.max(margine, limite - w);
        if (left + w > limite) w = Math.max(80, limite - left);
      }
    }
    var dentro = left >= r.left - 1 && left + w <= r.right + 1;
    return { left: left, width: w, dentro: dentro };
  }
  // durante lo scroll: solo la posizione verticale segue la fascia vera
  function spostaFascia() {
    if (!fascia || !fasciaEl || !fasciaEl.isConnected) return;
    var r = fasciaEl.getBoundingClientRect();
    fascia.style.top = r.top + "px"; fascia.style.height = r.height + "px";
  }
  // Stato del menu leghe del sito (per il livello della barra FVM): aperto se rilevato,
  // oppure per 1,5 s dopo un tocco sulla fascia (il menu deve comparire SOPRA la barra).
  var menuAperto = false, menuApertoFino = 0;
  function segnaToccoFascia() {
    menuApertoFino = Date.now() + 1500; menuAperto = true;
    try { posizioneSoloLega(); } catch (e) {}
  }
  document.addEventListener("pointerdown", function (e) {
    try { if (fasciaEl && fasciaEl.isConnected && fasciaEl.contains(e.target) && leggi("modo", "lega_fle") === "solo_lega") segnaToccoFascia(); } catch (x) {}
  }, true);
  // Posizione orizzontale FISSA: calcolata una volta per nome lega e larghezza schermo (niente saltelli scrollando).
  var geoFascia = null, fasciaSlug = "";
  function aggiornaFascia() {
    var attiva = !!(radice && barra && barra.isConnected && leggi("modo", "lega_fle") === "solo_lega");
    // INSERISCI FORMAZIONE leggibile come in SOLO LEGA anche in LEGA + FLE e SOLO FLE (barra FVM visibile, qualsiasi modalita)
    sistemaInserisci(!!(radice && barra && barra.isConnected));
    var f = null, info = null, aperto = false, slug = "";
    if (attiva) {
      slug = slugDaPagina();
      info = nomeLegaSito(slug);
      if (info.nome) f = trovaFascia(info);
      // fascia vera momentaneamente non trovata (ridisegno/cambio competizione) ma stessa lega: uso l'ultima
      if (!f && info.nome && fasciaEl && fasciaEl.isConnected && fasciaSlug === slug) f = { el: fasciaEl, metodo: "ultima" };
      aperto = menuLegheAperto(slug, f ? f.el.getBoundingClientRect().bottom : null);
      if (aperto && info.fonte !== "dom") imparaNomiMenu(slug);
    }
    menuAperto = aperto || Date.now() < menuApertoFino;
    // stessa lega e nome conservato: l'overlay resta dov'e (non sparisce per un ridisegno del sito)
    if (!f && attiva && info && info.nome && fascia && fascia.isConnected && fasciaSlug === slug) return;
    fasciaEl = f ? f.el : null;
    if (!f) { if (fascia) { fascia.remove(); fascia = null; } fasciaSlug = ""; geoFascia = null; return; }
    fasciaSlug = slug;
    if (!fascia || !fascia.isConnected) {
      fascia = document.createElement("div"); radice.appendChild(fascia);
      fascia.addEventListener("click", inoltraAllaFascia);
      geoFascia = null;
    }
    var r = f.el.getBoundingClientRect(), st = getComputedStyle(f.el), t = trovaTestataSito();
    fascia.className = "fascia" + (aperto ? " aperta" : "");
    var testo = info.nome + " ▼";
    if (fascia.textContent !== testo) fascia.textContent = testo;
    var vw = document.documentElement.clientWidth || window.innerWidth;
    if (!geoFascia || geoFascia.nome !== info.nome || geoFascia.vw !== vw) {
      // larghezza naturale del nome a 14 px (+ margini), poi centratura nello schermo: una volta sola
      fascia.style.cssText = "left:0;top:" + r.top + "px;height:" + r.height + "px;width:auto;font-size:14px;visibility:hidden";
      var naturale = Math.max(120, Math.ceil(fascia.getBoundingClientRect().width) + 4);
      var g0 = geometriaFascia(r, naturale);
      fascia.style.cssText = "left:" + g0.left + "px;top:" + r.top + "px;width:" + g0.width + "px;height:" + r.height + "px";
      // nome intero: se non entra riduco progressivamente il carattere (14 → 10 px)
      var dim = 14;
      for (; dim >= 10; dim--) { fascia.style.fontSize = dim + "px"; if (fascia.scrollWidth <= fascia.clientWidth) break; }
      geoFascia = { nome: info.nome, vw: vw, left: g0.left, width: g0.width, dim: Math.max(10, dim) };
    }
    var g = geoFascia;
    var dentro = g.left >= r.left - 1 && g.left + g.width <= r.right + 1;
    fascia.style.cssText = "left:" + g.left + "px;top:" + r.top + "px;width:" + g.width + "px;height:" + r.height + "px;font-size:" + g.dim + "px;border-radius:" + st.borderRadius +
      ";z-index:" + (t ? t.z + 2 : 2147483644) + ";pointer-events:" + (dentro ? "none" : "auto");
    var k = f.metodo + "|" + info.nome + "|" + Math.round(g.left) + "|" + dentro;
    if (k !== fasciaLog) {
      fasciaLog = k;
      log("FASCIA LEGA", { metodo: f.metodo, tag: f.el.tagName.toLowerCase(), classe: String(f.el.className || "").slice(0, 40), larga: Math.round(r.width), alta: Math.round(r.height), nome: info.nome, nomeNelDom: info.fonte === "dom", overlay: { sinistra: Math.round(g.left), larga: Math.round(g.width), tocco: dentro ? "diretto" : "inoltrato" } });
    }
  }
  // INSERISCI FORMAZIONE del sito tagliato: solo in SOLO LEGA, solo aspetto (mai il funzionamento).
  // 1) carattere e margini un po' piu piccoli; 2) se non basta, due righe centrate. Ripristinato fuori da SOLO LEGA.
  var inserisciEl = null, inserisciFix = [];
  function ripristinaInserisci() {
    inserisciFix.forEach(function (x) { try { if (x.stile === null) x.el.removeAttribute("style"); else x.el.setAttribute("style", x.stile); } catch (e) {} });
    inserisciFix = []; inserisciEl = null;
  }
  function sistemaInserisci(attiva) {
    try {
      if (!attiva) { if (inserisciEl) ripristinaInserisci(); return; }
      var b = elementoTesto(/^inserisci formazione$/i);
      if (!b || b === inserisciEl) return;
      ripristinaInserisci();
      inserisciEl = b;
      var lab = b, testoNodo = null, w = document.createTreeWalker(b, NodeFilter.SHOW_TEXT, null), nodo;
      while ((nodo = w.nextNode())) { if (/inserisci/i.test(nodo.nodeValue || "")) { testoNodo = nodo; lab = nodo.parentElement || b; break; } }
      // Catena da sistemare: dall'elemento del testo al pulsante, piu fino a 3 contenitori sopra che tagliano
      // (il taglio "Inserisci fo..." puo essere fatto da un contenitore, non dal pulsante: per questo il
      // vecchio controllo diceva "non tagliato").
      var catena = [];
      for (var n = lab; n; n = n.parentElement) { catena.push(n); if (n === b) break; }
      for (var p = b.parentElement, k = 0; p && p !== document.body && k < 3; p = p.parentElement, k++) {
        var cp = getComputedStyle(p);
        if (cp.overflowX !== "visible" || cp.textOverflow === "ellipsis") catena.push(p);
      }
      catena.forEach(function (el) { inserisciFix.push({ el: el, stile: el.getAttribute("style") }); });
      // misura reale: larghezza del testo disegnato contro il bordo destro visibile dei contenitori che tagliano
      var misura = function () {
        var rg = document.createRange();
        if (testoNodo) rg.selectNodeContents(testoNodo); else rg.selectNodeContents(lab);
        var rt = rg.getBoundingClientRect(), destra = Infinity;
        catena.forEach(function (el) {
          var cs = getComputedStyle(el);
          if (cs.overflowX !== "visible" || cs.textOverflow === "ellipsis" || el.scrollWidth > el.clientWidth + 1) {
            var re = el.getBoundingClientRect();
            destra = Math.min(destra, re.right - (parseFloat(cs.paddingRight) || 0) - (parseFloat(cs.borderRightWidth) || 0));
          }
        });
        var tagliato = rt.right > destra + 0.5 || catena.some(function (el) { return el.scrollWidth > el.clientWidth + 1; });
        return { tagliato: tagliato, testo: Math.round(rt.width), spazio: destra === Infinity ? null : Math.round(destra - rt.left) };
      };
      // 1) carattere un po' piu piccolo  2) margini interni ridotti
      var fs = parseFloat(getComputedStyle(lab).fontSize) || 14, cb = getComputedStyle(b);
      lab.style.fontSize = Math.max(10, Math.round(fs * 0.88 * 10) / 10) + "px";
      b.style.paddingLeft = Math.max(4, (parseFloat(cb.paddingLeft) || 0) * 0.5) + "px";
      b.style.paddingRight = Math.max(4, (parseFloat(cb.paddingRight) || 0) * 0.5) + "px";
      var m = misura();
      if (!m.tagliato) { log("INSERISCI FORMAZIONE", { azione: "carattere e margini ridotti", testo: m.testo, spazio: m.spazio }); return; }
      // 3) due righe centrate: INSERISCI / FORMAZIONE
      catena.forEach(function (el) { el.style.whiteSpace = "normal"; el.style.textOverflow = "clip"; el.style.textAlign = "center"; });
      lab.style.lineHeight = "1.1";
      var m2 = misura();
      log("INSERISCI FORMAZIONE", { azione: "due righe", primaTesto: m.testo, primaSpazio: m.spazio, ancoraTagliato: m2.tagliato });
    } catch (e) {}
  }
  // Apprendimento (solo se il nome reale non e nel DOM): voce scelta nel menu e tocco che apre il menu.
  document.addEventListener("click", function (e) {
    try {
      if (leggi("modo", "lega_fle") !== "solo_lega" || suFle() || !suFormazione()) return;
      var slug = slugDaPagina();
      if (nomeLegaSito(slug).fonte === "dom") return;
      var el = e.target;
      if (!el || el === host || el.nodeType !== 1) return;
      var c = cliccabileDa(el);
      if (menuLegheAperto(slug, null)) {
        var tx = primoTesto(c);
        if (tx && tx.length <= 60 && !/^FantaLegaEuropa-FLE/i.test(tx)) { sScrivi("nome_scelto", { nome: tx, da: slug, at: Date.now() }); log("NOME LEGA SCELTO", tx); }
      } else {
        var firmaF = { tag: c.tagName.toLowerCase(), classe: String(c.className || "") };
        setTimeout(function () {
          if (menuLegheAperto(slug, null) && JSON.stringify(leggi("fascia_firma", null)) !== JSON.stringify(firmaF)) {
            scrivi("fascia_firma", firmaF); log("FASCIA LEGA APPRESA", { tag: firmaF.tag, classe: firmaF.classe.slice(0, 40) });
          }
        }, 700);
      }
    } catch (x) {}
  }, true);

  var timerAvviso = null;
  function avviso(testo, errore) {
    monta();
    if (!radice) return;
    var t = radice.querySelector(".toast");
    if (!t) { t = document.createElement("div"); radice.appendChild(t); }
    t.className = "toast" + (errore ? " err" : "");
    t.textContent = testo;
    clearTimeout(timerAvviso);
    timerAvviso = setTimeout(function () { if (t) t.remove(); }, 5000);
  }
  function lavoro(titolo) {
    monta();
    chiudiPannello();
    var box = document.createElement("div");
    box.className = "ov";
    box.innerHTML = "<div class='cd' style='margin-top:30%'><div class='lb'>FANTA VICE MISTER</div><div class='t1' style='margin-top:8px'>" + esc(titolo) + "</div><div class='mu' id='fvm-stato' style='margin-top:8px'>…</div></div>";
    radice.appendChild(box);
    return {
      stato: function (t) { var e = box.querySelector("#fvm-stato"); if (e) e.textContent = t; },
      chiudi: function () { box.remove(); }
    };
  }

  // ---------------------------------------------------------------- PASSO 2 · controllo FLE
  // Prima di leggere FLE, porta davvero il selettore Leghe Fantacalcio sulla lega FLE.
  // Il solo cambio URL non basta sempre su Safari: l'app puo mantenere selezionata la lega sorgente.
  function elementoVisibile(el) {
    if (!el) return false;
    try { var r = el.getBoundingClientRect(); var st = getComputedStyle(el); return r.width > 2 && r.height > 2 && st.display !== "none" && st.visibility !== "hidden"; } catch (e) { return false; }
  }
  function cliccabileDa(el) {
    if (!el) return null;
    return el.closest('button,[role="button"],a,[tabindex]') || el;
  }
  function trovaTestoVisibile(re) {
    var all = document.querySelectorAll('button,[role="button"],a,div,span,p');
    for (var i = 0; i < all.length; i++) {
      var el = all[i];
      if (!elementoVisibile(el)) continue;
      var t = String(el.textContent || "").replace(/\s+/g, " ").trim();
      if (re.test(t)) return el;
    }
    return null;
  }
  function selezionaFleNelSelettore(task) {
    var w = lavoro("Apro FantaLegaEuropa-FLE…");
    w.stato("Seleziono FantaLegaEuropa-FLE nel menu delle leghe…");
    var iniziato = Date.now(), aperto = false;
    var timer = setInterval(function () {
      // Se il click ha gia cambiato davvero lega, prosegui sul dashboard FLE.
      if (suFle()) {
        clearInterval(timer); w.chiudi();
        task.fase = "dash"; sScrivi("task", task);
        setTimeout(function () { location.assign(fleDiscoveryUrl()); }, 350);
        return;
      }
      // Se il menu e aperto, la voce FLE e visibile: cliccala.
      var voce = trovaTestoVisibile(/^FantaLegaEuropa-FLE(?:\s|$)/i);
      if (voce) {
        var c = cliccabileDa(voce);
        log("SELETTORE FLE", { azione: "click FLE", testo: String(voce.textContent || "").trim().slice(0,120) });
        try { c.click(); } catch (e) {}
        aperto = true;
        return;
      }
      // Apri il selettore partendo dalla lega mostrata in alto
      // (1.1.0: quella della pagina; se manca, la lega sorgente).
      if (!aperto) {
        var slug = (slugDaPagina() && slugDaPagina() !== FLE_SLUG) ? slugDaPagina() : legaCorrente();
        var nome = nomeLega(slug).replace(/\s+/g, "");
        var candidati = document.querySelectorAll('button,[role="button"],div,a');
        for (var i = 0; i < candidati.length; i++) {
          var el = candidati[i]; if (!elementoVisibile(el)) continue;
          var tx = String(el.textContent || "").replace(/\s+/g, "").toUpperCase();
          if (nome && tx.indexOf(nome) >= 0 && tx.length < nome.length + 80) {
            log("SELETTORE FLE", { azione: "apri menu", testo: String(el.textContent || "").trim().slice(0,120) });
            try { cliccabileDa(el).click(); } catch (e) {}
            aperto = true; break;
          }
        }
      }
      if (Date.now() - iniziato > 12000) {
        clearInterval(timer); w.chiudi();
        log("SELETTORE FLE", "fallback URL dopo timeout");
        task.fase = "dash"; sScrivi("task", task);
        location.assign(fleDiscoveryUrl());
      }
    }, 400);
  }

  // ================================================================ 1.3.5 VERIFICA SQUADRA FLE (sola lettura, come Android 1.3.1)
  // Tre dati confrontati; nessuna formazione salvata o inviata (solo pagine del sito aperte e letture GET):
  //  1) squadra dell'account nella lega FLE = teamLineupDto.tid della pagina formazione della lega (risposta del sito);
  //  2) squadra FLE attesa = tabella delle 80 squadre per quella squadra (deve appartenere a quella lega);
  //  3) squadra dell'account su FLE = teamLineupDto.tid della pagina formazione FLE di una competizione in cui la squadra
  //     attesa e iscritta (classifiche Ranking per ultime).
  // Esiti: VERIFICATA (3 = 2), DIVERSA (3 != 2), INCERTA (qualunque dato mancante o non coerente). Mai dedotta dal circuito.
  function avviaVerificaFle(perche) {
    if (piattaformaScelta() === "fantaclub") { avviso("La verifica riguarda Leghe Fantacalcio: tocca CAMBIA → Leghe Fantacalcio.", true); return; }
    if (!connesso()) { avviso("Prima tocca ACCEDI ed entra in Leghe Fantacalcio.", true); return; }
    var src = leggi("lega_sorgente", "");
    if (!src) { avviso("Entra prima nella tua lega con CAMBIA LEGA: poi premi di nuovo VERIFICA SQUADRA FLE.", true); return; }
    // 1.3.5-RC: la verifica e legata all'account: senza account riconosciuto non parte (lo legge, poi si ripete)
    if (!identitaAttuale()) { verificaIdentita("VERIFICA SQUADRA FLE"); log("VERIFICA FLE", { esito: "non avviata", motivo: "identita non riconosciuta" }); avviso(testoIdentita(), true); return; }
    var t = sLeggi("task");
    if (t && Date.now() - Number(t.inizio || 0) < 180000) { avviso("Fanta Vice Mister sta già lavorando: attendi la fine e riprova.", true); return; }
    var task = { tipo: "verifica", fase: "lega", run: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), inizio: Date.now(), lega: src };
    sScrivi("task", task);
    ctl.payloadLega = null;
    log("VERIFICA SQUADRA FLE", { fase: "avvio", perche: perche, lega: src, account: "riconosciuto in questa scheda", associazione: (associazioneLeghe() || {}).esito || "nessuna" });
    chiudiPannello();
    // la pagina formazione va sempre RICARICATA: la squadra si legge dalla risposta del sito al caricamento
    var u = urlFormazione(src);
    if (u) { location.assign(u); return; }
    try { sessionStorage.setItem(PREFISSO + "vai", "1"); } catch (e) {}
    location.assign("https://leghe.fantacalcio.it/" + src);
    setTimeout(function () { avviso("Se non si apre da sola, tocca \"Inserisci formazione\" nella pagina della lega."); }, 8000);
  }
  function eseguiVerificaLega(task) {
    var w = lavoro("Verifica squadra FLE…"), atteso = 0;
    w.stato("Leggo la tua squadra in " + nomeLega(task.lega) + "…");
    var t1 = setInterval(function () {
      atteso += 500;
      var p = ctl.payloadLega;
      if (p && p.tid) {
        clearInterval(t1); w.chiudi();
        var map = trovaFleTid(p.tid), nomeL = (LEGHE_FONTE.filter(function (l) { return l[1] === task.lega; })[0] || [])[0] || nomeLega(task.lega);
        task.sorgente = Number(p.tid);
        if (!map) return concludiVerifica(task, "incerta", "la squadra dell'account in " + nomeL + " (" + p.tid + ") non è nella tabella delle 80 squadre FLE");
        if (map.lega !== nomeL) return concludiVerifica(task, "incerta", "la squadra letta (" + map.squadra + ") appartiene a " + map.lega + ", non a " + nomeL);
        task.atteso = map.fleTid; task.squadra = map.squadra; task.fase = "select_fle";
        sScrivi("task", task);
        log("VERIFICA SQUADRA FLE", { fase: "lega", sorgente: task.sorgente, atteso: task.atteso });
        selezionaFleNelSelettore(task);
      } else if (atteso >= 20000) { clearInterval(t1); w.chiudi(); concludiVerifica(task, "incerta", "squadra dell'account nella lega non letta"); }
    }, 500);
  }
  function eseguiVerificaFle(task) {
    var w = lavoro("Verifica squadra FLE…"), atteso = 0;
    if (task.fase === "dash") {
      w.stato("Cerco le competizioni FLE della tua squadra…");
      var chieste = false;
      var t2 = setInterval(function () {
        atteso += 500;
        // come AGGIORNA (1.3.4): se il sito non chiede l'elenco delle competizioni, FVM lo legge UNA volta dopo 6 s
        if (!ctl.comps && !chieste && ctl.hdr && atteso >= 6000) {
          chieste = true;
          getApi("/onboarding/v1/league/competitions", true).then(function (j) { var l = listaCompetizioni(j); if (l.length && !ctl.comps) ctl.comps = l; })
            .catch(function (e) { log("VERIFICA SQUADRA FLE", { fase: "competizioni", esito: "errore", http: e && e.http || 0 }); });
        }
        if (ctl.comps) {
          clearInterval(t2); w.chiudi();
          var attive = ctl.comps.filter(function (c) { return c && !c.del; });
          var dove = attive.filter(function (c) { return (Array.isArray(c.tmids) ? c.tmids : []).map(Number).indexOf(Number(task.atteso)) >= 0; })
            .sort(function (a, b) { return (naturaCompetizione(a) !== "obbligo" ? 1 : 0) - (naturaCompetizione(b) !== "obbligo" ? 1 : 0); });
          // 1.3.5-RC2: fino a 4 competizioni della squadra attesa, una dopo l'altra (come Android); classifiche per ultime
          var daProvare = dove.slice(0, 4).map(function (c) { return Number(c.id); });
          log("VERIFICA SQUADRA FLE", { fase: "competizioni", attive: attive.length, conLaSquadra: dove.length, daProvare: daProvare.join(",") });
          if (!dove.length) return concludiVerifica(task, "incerta", "la squadra FLE attesa (" + task.squadra + ", " + task.atteso + ") non risulta iscritta a una competizione FLE attiva");
          task.fase = "lineup"; task.comps = daProvare; task.idx = 0; task.tentativi = []; task.comp = daProvare[0];
          sScrivi("task", task);
          location.assign(fleLineupUrl(task.comp));
        } else if (atteso >= 25000) { clearInterval(t2); w.chiudi(); concludiVerifica(task, "incerta", "competizioni FLE non lette"); }
      }, 500);
      return;
    }
    if (task.fase === "lineup") {
      var tutte = Array.isArray(task.comps) && task.comps.length ? task.comps : [task.comp], stabile = 0;
      w.stato("Leggo la squadra del tuo account su FLE (" + (Number(task.idx || 0) + 1) + "/" + tutte.length + ")…");
      var t3 = setInterval(function () {
        atteso += 500;
        // 1.3.5-RC2: squadra dalle risposte della pagina formazione di QUESTA competizione (verificaFleDaRisposta)
        var r = ctl.verificaFle;
        if (r && r.tids.length > 1) { clearInterval(t3); w.chiudi(); return tentativoVerificaFle(task, "squadre diverse nella stessa pagina: lettura ambigua"); }
        if (r && r.tids.length === 1) {
          stabile += 500;
          if (stabile < 1500) return; // breve attesa: nessuna seconda squadra diversa nella stessa pagina
          clearInterval(t3); w.chiudi();
          task.letto = Number(r.tids[0]);
          log("VERIFICA SQUADRA FLE", { fase: "tentativo", comp: Number(task.comp), tentativo: Number(task.idx || 0) + 1, di: tutte.length, esito: "squadra letta", senzaGiocatori: !!r.senzaGiocatori });
          if (task.letto === Number(task.atteso)) return concludiVerifica(task, "verificata", "");
          var altra = SQUADRE.filter(function (t) { return Number(t[2]) === task.letto; })[0];
          return concludiVerifica(task, "diversa", "su FLE questo account gestisce " + (altra ? altra[1] + " (" + altra[0] + ")" : "la squadra FLE " + task.letto + ", non presente nella tabella delle 80") + ", non " + task.squadra + " (squadra FLE " + task.atteso + ")");
        }
        if (atteso >= 20000) { clearInterval(t3); w.chiudi(); tentativoVerificaFle(task, location.pathname.indexOf("/competition/" + task.comp + "/lineup") < 0 ? "il sito non ha aperto la pagina formazione di questa competizione" : !r || !r.risposte ? "nessuna risposta del sito con la squadra" : r.altre ? "risposte di un'altra competizione" : "risposta del sito senza squadra"); }
      }, 500);
    }
  }
  // 1.3.5-RC2: tentativo non riuscito su una competizione: si prova la successiva (al massimo 4), poi esito INCERTO con i motivi
  function tentativoVerificaFle(task, motivo) {
    var tutte = Array.isArray(task.comps) && task.comps.length ? task.comps : [task.comp], idx = Number(task.idx || 0);
    task.tentativi = (task.tentativi || []).concat([{ comp: Number(task.comp), motivo: motivo }]).slice(-4);
    log("VERIFICA SQUADRA FLE", { fase: "tentativo", comp: Number(task.comp), tentativo: idx + 1, di: tutte.length, esito: "non letta", motivo: motivo });
    var att = sLeggi("task");
    if (idx + 1 < tutte.length && att && att.tipo === "verifica" && att.run === task.run) {
      task.idx = idx + 1; task.comp = Number(tutte[idx + 1]); task.inizio = Date.now();
      sScrivi("task", task);
      location.assign(fleLineupUrl(task.comp));
      return;
    }
    concludiVerifica(task, "incerta", "squadra FLE dell'account non letta in " + tutte.length + (tutte.length === 1 ? " competizione" : " competizioni") + " FLE (" + task.tentativi.map(function (t) { return t.comp + ": " + t.motivo; }).join("; ") + ")");
  }
  function concludiVerifica(task, esito, motivo) {
    var att = sLeggi("task");
    if (!att || att.tipo !== "verifica" || att.run !== task.run) { log("VERIFICA SQUADRA FLE", { esito: "ignorata", motivo: "attività superata" }); return; }
    sScrivi("task", null);
    var rec = { lega: task.lega, esito: esito, atteso: Number(task.atteso || 0), letto: Number(task.letto || 0), sorgente: Number(task.sorgente || 0),
      squadra: String(task.squadra || ""), motivo: String(motivo || "").slice(0, 240), fonte: "verifica", at: Date.now() };
    // vale SOLO per la lega FLE per cui e partita (se nel frattempo e cambiata, l'esito non viene registrato)
    if (leggi("lega_sorgente", "") === task.lega) scriviAssociazione(rec);
    log("VERIFICA SQUADRA FLE", { esito: esito, lega: task.lega, sorgente: rec.sorgente, atteso: rec.atteso, letto: rec.letto, tentativiFalliti: (task.tentativi || []).length, motivo: rec.motivo });
    sScrivi("apri", "main");
    sScrivi("flash", esito === "verificata" ? "Squadra FLE verificata ✓ " + rec.squadra : esito === "diversa" ? "Squadra FLE DIVERSA: nessun invio a FLE (vedi la Home)" : "Verifica non riuscita: " + rec.motivo);
    location.assign(urlLegaSorgente());
  }
  // 1.3.5 PROTEZIONE SOLO FLE / MODIFICA SU FLE (Leghe Fantacalcio): se nella pagina formazione FLE il sito mostra una
  // squadra DIVERSA da quella verificata, o se la squadra non e verificata, la pagina si chiude prima di qualsiasi salvataggio.
  function guardiaCampoFle() {
    if (!suFle() || !suFormazione() || sLeggi("task") || window.__fvmInvio || piattaformaScelta() === "fantaclub" || leggi("modo", "lega_fle") !== "solo_fle") return false;
    var pl = ctl.payload;
    if (!pl || !pl.tid) return false;
    var a = associazioneLeghe(), atteso = a && a.esito === "verificata" ? attesoAssociazione(a) : 0;
    if (atteso && Number(pl.tid) === atteso) return false;
    var testo = atteso ? "Su FLE questo account mostra la squadra " + pl.tid + ", non la tua (" + atteso + "): pagina FLE chiusa, nessun salvataggio. Entra con l'account giusto e ripeti VERIFICA SQUADRA FLE."
      : fleAutorizzatoLeghe(true).testo;
    if (atteso) scriviAssociazione({ lega: leggi("lega_sorgente", ""), esito: "diversa", atteso: atteso, letto: Number(pl.tid), motivo: "squadra diversa nella pagina FLE (SOLO FLE / MODIFICA SU FLE)", fonte: "guardia", at: Date.now() });
    log("GUARDIA FLE", { atteso: atteso, letto: Number(pl.tid), comp: pl.comp, esito: "pagina FLE chiusa" });
    scrivi("modo", "solo_lega");
    sScrivi("storico_modifica", null);
    sScrivi("apri", "main"); sScrivi("flash", testo);
    location.assign(urlLegaSorgente());
    return true;
  }
  // 1.3.5: riquadro SQUADRA FLE nella Home (Leghe Fantacalcio): stato della verifica e pulsante VERIFICA SQUADRA FLE
  // 1.3.6-G2 · APERTURA DALL'ICONA. L'identita dell'account vale solo per la scheda di Safari (scheda nuova = da rileggere) e arriva dal
  // sito qualche secondo DOPO la Home. Quando arriva: Home ridisegnata e, se la sessione era partita in SOLO LEGA soltanto perche mancava
  // l'identita, ritorno a LEGA + FLE. Nel frattempo (al massimo 20 s dall'apertura della pagina, e solo se per questo account e questa epoca
  // c'e gia una verifica riuscita salvata) la Home dice «riconoscimento in corso» invece di «da verificare».
  // Sicurezza invariata: fleAutorizzatoLeghe non cambia, nessuna funzione FLE prima che l'identita sia riconosciuta.
  var AVVIO_PAGINA = Date.now(), IDENTITA_ATTESA_MS = 20000;
  function identitaInArrivo() {
    if (identitaAttuale() || Date.now() - AVVIO_PAGINA > IDENTITA_ATTESA_MS) return false;
    var a = leggi("fle_associazione", null);
    return !!(a && a.esito === "verificata" && a.lega && a.lega === leggi("lega_sorgente", "") && (Number(a.epoca) || 0) === epocaAccount() && /^[0-9a-f]{32}$/.test(String(a.imp || "")));
  }
  // allo scadere dell'attesa la Home torna a dire «da verificare» se l'identita non e arrivata
  function programmaRidisegnoIdentita() {
    if (ctl.identitaRidisegno) return;
    ctl.identitaRidisegno = true;
    setTimeout(function () { ctl.identitaRidisegno = false; if (!identitaAttuale() && pannello && pannelloPrincipale) aggiornaPannello(); }, Math.max(0, IDENTITA_ATTESA_MS - (Date.now() - AVVIO_PAGINA)) + 300);
  }
  function identitaArrivata() {
    try {
      var att = sLeggi("modo_attesa_identita");
      if (att) {
        sScrivi("modo_attesa_identita", null);
        if (Date.now() - Number(att.at || 0) <= IDENTITA_ATTESA_MS && piattaformaScelta() === "fantacalcio" && !sLeggi("task") && !legaLavoro() && !suFormazione() &&
            leggi("modo", "lega_fle") === "solo_lega" && fleAutorizzatoLeghe().ok) {
          scrivi("modo", "lega_fle"); log("MODO", { a: "lega_fle", perche: "account riconosciuto dopo l'apertura (squadra FLE verificata)" });
        }
      }
      if (pannello && pannelloPrincipale) aggiornaPannello();
    } catch (e) {}
  }
  function cartaSquadraFle() {
    var src = leggi("lega_sorgente", ""), a = associazioneLeghe(), nome = src ? nomeLega(src) : "la tua lega";
    var quando = a && a.at ? " · " + new Date(a.at).toLocaleString("it-IT") : "";
    var h = "<div class='cd' style='border-left:4px solid " + (a && a.esito === "verificata" ? "#3fae4a" : a && a.esito === "diversa" ? "#e2333b" : "#e2b33c") + "'><div class='lb'>SQUADRA FLE</div>";
    if (!a && identitaInArrivo()) { programmaRidisegnoIdentita(); return h + "<div style='color:#fbbf24;font-weight:900;margin-top:6px'>RICONOSCIMENTO DELL'ACCOUNT IN CORSO…</div>" +
      "<div class='mu'>FVM sta leggendo dal sito l'account collegato (sola lettura). Tra pochi secondi la verifica di " + esc(nome) + " compare qui da sola.</div></div>"; } // 1.3.6-G2
    if (a && a.esito === "verificata") h += "<div style='color:#4ade80;font-weight:900;margin-top:6px'>✓ VERIFICATA" + (a.squadra ? " · " + esc(a.squadra) : "") + "</div><div class='mu'>Questo account gestisce su FLE la squadra di " + esc(nome) + esc(quando) + ". LEGA + FLE disponibile.</div>";
    else if (a && a.esito === "diversa") h += "<div style='color:#f87171;font-weight:900;margin-top:6px'>SQUADRA DIVERSA · NESSUN INVIO A FLE</div><div class='mu'>Con questo account su FLE c'è una squadra FLE diversa da quella di " + esc(nome) + (a.motivo ? ": " + esc(a.motivo) : "") + esc(quando) + ". FAI O MODIFICA parte in SOLO LEGA.</div>";
    else if (a && a.esito === "incerta") h += "<div style='color:#fbbf24;font-weight:900;margin-top:6px'>NON VERIFICATA</div><div class='mu'>Esito incerto" + (a.motivo ? ": " + esc(a.motivo) : "") + esc(quando) + ". Finché la verifica non riesce si usa SOLO LEGA.</div>";
    else h += "<div style='color:#fbbf24;font-weight:900;margin-top:6px'>DA VERIFICARE</div><div class='mu'>Prima di mandare formazioni a FLE controlla che questo account gestisca su FLE la squadra di " + esc(nome) + ". Fino ad allora si usa SOLO LEGA.</div>";
    return h + "<button class='bt" + (a && a.esito === "verificata" ? "" : " oro") + "' data-a='verifica'>VERIFICA SQUADRA FLE</button>" +
      "<div class='mu' style='margin-top:6px;font-size:11px'>Sola lettura: nessuna formazione viene salvata o inviata.</div></div>";
  }
  function avviaControlloFle(perche) {
    var u = leggi("ultima", null);
    if (!u || !u.ok) { avviso("Prima salva la formazione con il riquadro verde.", true); return; }
    var map = trovaFleTid(u.tid);
    log("CONTROLLO FLE AVVIO", { perche: perche, tidLega: u.tid, fleTid: map && map.fleTid, squadra: map && map.squadra });
    if (!map) {
      scrivi("fle", { stato: "errore", titolo: "Squadra FLE non trovata", dettagli: ["Non trovo la tua squadra tra le 80 squadre FLE (squadra di lega " + u.tid + ").", "Nessun salvataggio è stato eseguito su FLE.", "Manda la diagnosi al tuo admin."] });
      apriPannello();
      return;
    }
    var ritorno = suFle() ? (leggi("fle", {}).ritorno || "") : location.href;
    scrivi("fle", { stato: "controllo", ritorno: ritorno });
    var taskSelettore = { tipo: "check", fase: "select_fle", inizio: Date.now(), fleTid: map.fleTid, squadra: map.squadra, ritorno: ritorno };
    sScrivi("task", taskSelettore);
    // In SOLO FLE (e anche quando si parte dalla lega sorgente) selezioniamo prima FLE
    // nello stesso menu che l'utente usa manualmente. Poi il motore FLE resta invariato.
    if (!suFle()) { selezionaFleNelSelettore(taskSelettore); return; }
    taskSelettore.fase = "dash"; sScrivi("task", taskSelettore);
    location.assign(fleDiscoveryUrl());
  }
  // 1.1.0 Fantaclub fase 8: controllo FLE della formazione Fantaclub. Stesso motore FLE di Leghe (rosa dei 25 dalla
  // pagina formazione FLE, squadra verificata con il TID): cambia solo la sorgente e la squadra (dalla tabella).
  function avviaControlloFc(perche) {
    var u = formazioneSorgente();
    if (!u || u.fonte !== "fantaclub" || u.titolari.length !== 11) { avviso("Prima consegna la formazione su Fantaclub con FAI O MODIFICA LA FORMAZIONE.", true); return; }
    if (!inCircuitoFc(u.nl)) { avviso("Questa lega Fantaclub non è nel circuito FLE (o non è stata riconosciuta): nessun controllo né invio FLE.", true); apriPannello(); return; }
    // 1.3.5-RC: il controllo FLE si fa con l'account di Leghe Fantacalcio: serve riconosciuto in questa scheda
    if (!identitaAttuale()) { log("CONTROLLO FLE BLOCCATO", { fonte: "fantaclub", motivo: "identita non riconosciuta" }); verificaIdentita("controllo FLE da Fantaclub"); avviso(testoIdentita(), true); apriPannello(); return; }
    if (!u.fleTid) { avviso("Prima scegli la tua squadra Fantaclub.", true); apriPannello(); return; }
    var ritorno = suFle() ? (leggi("fle", {}).ritorno || "") : location.href;
    // FLE sta su Leghe Fantacalcio: senza quell'accesso il controllo non puo partire (lo dico chiaramente)
    if (!suFle() && !connesso()) {
      scrivi("fle", { stato: "errore", fonte: "fantaclub", titolo: "Serve l'accesso a Leghe Fantacalcio",
        dettagli: ["Il controllo e l'invio FLE si fanno su Leghe Fantacalcio (FantaLegaEuropa-FLE).", "Tocca CAMBIA → Leghe Fantacalcio → ACCEDI; poi CAMBIA → Fantaclub (resti collegato) e RIPETI CONTROLLO FLE.", "Nessun salvataggio è stato eseguito su FLE."] });
      log("CONTROLLO FLE ERRORE", { fonte: "fantaclub", titolo: "serve l'accesso a Leghe Fantacalcio" });
      apriPannello();
      return;
    }
    scrivi("fle", { stato: "controllo", fonte: "fantaclub", ritorno: ritorno });
    var task = { tipo: "check", fase: "dash", inizio: Date.now(), fleTid: Number(u.fleTid), squadra: u.squadra, ritorno: ritorno, fonte: "fantaclub" };
    log("CONTROLLO FLE AVVIO", { perche: perche, fonte: "fantaclub", fleTid: task.fleTid, squadra: task.squadra });
    // come per Leghe: se la pagina mostra una lega, passo a FLE dal selettore del sito; altrimenti indirizzo FLE
    if (!suFle() && slugDaPagina() && legaCorrente()) { task.fase = "select_fle"; sScrivi("task", task); selezionaFleNelSelettore(task); return; }
    sScrivi("task", task);
    chiudiPannello();
    location.assign(fleDiscoveryUrl());
  }
  // 1.1.0 Fantaclub fase 9: invio FLE della formazione Fantaclub. Il salvataggio lo fa il SITO FLE (pulsante
  // Salva formazione della pagina FLE): FVM mette la formazione FLE nella richiesta del sito con "Salva per tutte le
  // competizioni" e formazione invisibile, poi registra l'esito VERO del server (fineInvio). Nessun invio alternativo
  // con i dati della lega Leghe: Fantaclub non li ha.
  function avviaInvioFc() {
    var f = leggi("fle", null), res = risultatoFle(), u = formazioneSorgente();
    if (!u || u.fonte !== "fantaclub" || !u.fleTid || !f || f.fonte !== "fantaclub" || !res || !res.complete || f.stato === "errore" || f.stato === "controllo") { avviso("Prima completa il controllo FLE.", true); return; }
    if (!Number(f.comp) || Number(f.tid) !== Number(u.fleTid)) { avviso("Il controllo FLE non corrisponde a questa squadra: tocca RIPETI CONTROLLO FLE.", true); return; }
    var vecchioFc = controlloFleVecchio(f); // PROVA12: rosa FLE da rileggere prima di inviare
    if (vecchioFc) { log("INVIO FLE FERMATO", { fonte: "fantaclub", motivo: "controllo FLE vecchio", dettaglio: vecchioFc.motivo }); avviso(vecchioFc.testo, true); return; }
    var inv = { starts: res.starts.map(function (p) { return p.pid; }), bench: res.bench.map(function (p) { return p.pid; }), mdl: u.modulo, capt: null };
    // PROVA8: Switch gia presente su FLE e incompatibile = scelta obbligatoria prima dell'invio (Fantaclub non ha lo Switch)
    var swD = null; try { swD = swPasso2(u, f, res); } catch (e) { swD = null; }
    if (swD && swD.blocca && swD.motivo === "scelta_mancante") { log("INVIO FLE FERMATO", { fonte: "fantaclub", motivo: swD.motivo, caso: swD.caso, prima: "del passaggio a FLE" }); avviso(swTesto(swD, u, f), true); return; }
    sScrivi("task", { tipo: "invio", inizio: Date.now(), comp: f.comp, inv: inv, fonte: "fantaclub" });
    log("INVIO FLE AVVIO", { fonte: "fantaclub", comp: f.comp, tid: f.tid, squadra: f.squadra, titolari: inv.starts.length, panchina: inv.bench.length, modulo: inv.mdl });
    if (suFle() && location.pathname.indexOf("/competition/" + f.comp + "/lineup") >= 0) eseguiInvio(sLeggi("task"));
    else { chiudiPannello(); location.assign(fleLineupUrl(f.comp)); }
  }
  // ripiego quando il sito FLE non fa partire il salvataggio: per Leghe invioDiretto (invariato),
  // per Fantaclub nessun invio alternativo: esito NON riuscito, onesto
  function invioDirettoSorgente(task) {
    if (task && task.fonte === "fantaclub") { log("INVIO FLE DIRETTO", { fonte: "fantaclub", esito: "non disponibile per Fantaclub" }); fineInvio(false, 0, "il sito FLE non ha fatto partire il salvataggio"); return; }
    invioDiretto(task);
  }
  function erroreControllo(titolo, dettagli, task) {
    sScrivi("task", null);
    var f = leggi("fle", {}) || {};
    f.stato = "errore"; f.titolo = titolo; f.dettagli = dettagli.concat(["Nessun salvataggio è stato eseguito su FLE."]);
    scrivi("fle", f);
    log("CONTROLLO FLE ERRORE", { titolo: titolo, dettagli: dettagli });
    apriPannello();
  }
  // fresco: lettura sempre dal server (controlli Area Admin e Consegne ufficiali); errore con il codice HTTP in e.http
  // RC4: le intestazioni copiate dal sito possono contenere una convalida della cache (If-None-Match, If-Modified-Since…): con quelle
  // il server risponde 304 SENZA dati (anche con cache "no-store"). Le letture di FVM non le inviano: il server risponde 200 con i dati.
  function senzaConvalida(h) {
    var o = {};
    Object.keys(h || {}).forEach(function (k) { if (!/^(if-none-match|if-modified-since|if-match|if-unmodified-since|if-range)$/i.test(k)) o[k] = h[k]; });
    return o;
  }
  function getApi(path, fresco) {
    var op = { headers: senzaConvalida(ctl.hdr), credentials: "include" };
    if (fresco) op.cache = "no-store";
    return fetchOriginale(API + path, op).then(function (r) {
      if (!r.ok) { var e = new Error("HTTP " + r.status + " " + path); e.http = r.status; throw e; }
      return r.json();
    });
  }
  function eseguiControllo(task) {
    var w = lavoro("Controllo FLE in corso…");
    var atteso = 0;
    if (task.fase === "dash") {
      w.stato("Apro la FantaLegaEuropa-FLE…");
      var t1 = setInterval(function () {
        atteso += 500;
        if (ctl.comps && (ctl.hdr || atteso >= 6000)) {
          clearInterval(t1);
          var comps = ctl.comps.filter(function (c) { return c && !c.del; });
          log("CONTROLLO FLE COMPETIZIONI", { n: comps.length, conSquadre: comps.filter(function (c) { return Array.isArray(c.tmids); }).length });
          var dirette = comps.filter(function (c) { return Array.isArray(c.tmids) && c.tmids.map(Number).indexOf(task.fleTid) >= 0; });
          if (dirette.length) return scegliCompetizione(task, dirette.map(function (c) { return { id: Number(c.id), name: c.name }; }), w);
          w.stato("Cerco le tue competizioni FLE…");
          var trovate = [], i = 0;
          (function prossima() {
            if (i >= comps.length) {
              if (trovate.length) return scegliCompetizione(task, trovate, w);
              task.lista = comps.filter(function (c) { return naturaCompetizione({ id: c.id, name: c.name }) === "obbligo"; }).map(function (c) { return { id: Number(c.id), name: c.name }; });
              if (!task.lista.length) { w.chiudi(); return erroreControllo("Nessuna competizione FLE giocabile", ["Nessuna competizione FLE con formazione trovata.", "Nessun salvataggio eseguito."], task); }
              task.idx = 0;
              return provaPagina(task);
            }
            var c = comps[i++];
            getApi("/onboarding/v1/league/competition/calendar/" + c.id).then(function (cal) {
              var dentro = JSON.stringify(cal || []).indexOf(String(task.fleTid)) >= 0;
              if (dentro) trovate.push({ id: Number(c.id), name: c.name });
            }).catch(function (e) { log("CALENDARIO", String(e && e.message || e)); }).then(prossima);
          })();
        } else if (atteso >= 8000 && suFle()) {
          // Android V1.6.1: non serve conoscere per forza TUTTO il selettore.
          // Qualunque competizione FLE realmente accessibile e contenente la squadra
          // e un punto d'ingresso valido per "Salva per tutte le competizioni".
          // Fantacalcio, entrando nella root FLE, ci reindirizza gia alla competizione
          // corrente (/view/competition/<id>/dashboard): usiamo quell'ID come candidato
          // e lo VERIFICHIAMO sulla lineup (TID/rosa) prima di abilitarne l'invio.
          var mm = location.pathname.match(/\/fantalegaeuropa-fle\/view\/competition\/(\d+)\//i);
          var compCorrente = mm ? Number(mm[1]) : 0;
          if (compCorrente && !task.currentCandidateTried) {
            clearInterval(t1);
            task.currentCandidateTried = 1;
            task.fase = "lineup";
            task.comp = compCorrente;
            task.compName = "Competizione FLE " + compCorrente;
            sScrivi("task", task);
            log("CONTROLLO FLE CANDIDATO CORRENTE", { comp: compCorrente, motivo: "redirect FLE verificato su lineup" });
            w.stato("Verifico la competizione FLE corrente…");
            setTimeout(function () { location.assign(fleLineupUrl(compCorrente)); }, 250);
            return;
          }
          if (atteso >= 25000) {
            clearInterval(t1);
            if (!task.discoveryRetry) {
              task.discoveryRetry = 1; task.fase = "dash"; sScrivi("task", task);
              log("CONTROLLO FLE", "competizioni non lette · retry discovery root");
              w.stato("Ricarico FantaLegaEuropa-FLE e cerco un ingresso valido…");
              setTimeout(function () { location.assign(fleDiscoveryUrl()); }, 350);
              return;
            }
            w.chiudi();
            erroreControllo("FantaLegaEuropa-FLE non letta", ["Non ho trovato una competizione FLE verificabile per questa squadra.", "Controlla di essere entrato con l'account della tua squadra FLE."], task);
          }
        }
      }, 500);
      return;
    }
    if (task.fase === "lineup") {
      w.stato("Leggo la tua rosa FLE in " + (task.compName || "competizione " + task.comp) + "…");
      var t2 = setInterval(function () {
        atteso += 500;
        var pl = ctl.payload;
        if (pl && (!task.comp || pl.comp === task.comp)) {
          clearInterval(t2);
          if (task.fleTid && pl.tid && pl.tid !== task.fleTid) {
            log("CONTROLLO FLE TID DIVERSO", { atteso: task.fleTid, letto: pl.tid, comp: pl.comp });
            if (task.lista && task.idx + 1 < task.lista.length) { task.idx++; return provaPagina(task); }
            // 1.3.4: account NON associato alla squadra FLE attesa per la lega FLE: da qui FAI O MODIFICA parte in SOLO LEGA
            scriviAssociazione({ lega: leggi("lega_sorgente", ""), esito: "diversa", atteso: Number(task.fleTid), letto: Number(pl.tid), at: Date.now() });
            w.chiudi();
            return erroreControllo("Squadra FLE diversa", ["In questa pagina FLE c'è la squadra " + pl.tid + ", non la tua (" + task.fleTid + ").", "Controlla di essere entrato in Leghe con il tuo account."], task);
          }
          // PROVA12: rosa FLE da 25 giocatori, letta per intero (come Android «Rosa FLE non conforme»): altrimenti nessun invio
          var esameR = esameRosaFle(pl.ids);
          if (esameR.esito !== "ok") {
            log("CONTROLLO FLE ROSA", { esito: esameR.esito, giocatori: esameR.n, senzaRuolo: esameR.senzaRuolo, comp: pl.comp, tid: pl.tid });
            w.chiudi();
            return erroreControllo(esameR.titolo, esameR.dettagli, task);
          }
          // (1.1.0 Fantaclub: anche la squadra di Serie A, per l'abbinamento per nome + squadra + ruolo)
          var roster = pl.ids.map(function (pid) { var x = info[pid] || {}; return { pid: pid, name: x.n || String(pid), role: Number(x.r || 0), flag: x.f || "", club: x.c || "" }; });
          var f = leggi("fle", {}) || {};
          f.controlloAt = Date.now(); // PROVA12: ora del controllo (PASSO 3 solo con un controllo recente)
          if (task.fleTid && pl.tid && Number(pl.tid) === Number(task.fleTid)) scriviAssociazione({ lega: leggi("lega_sorgente", ""), esito: "verificata", fleTid: Number(pl.tid), at: Date.now() });
          f.stato = "controllato"; f.comp = pl.comp; f.compName = task.compName || ""; f.tid = pl.tid || task.fleTid; f.squadra = task.squadra;
          f.roster = roster; f.mday = pl.mday; f.cmday = pl.cmday; f.choices = {}; f.ritorno = task.ritorno || f.ritorno || "";
          // PROVA8: Switch letto su FLE e giornata di Serie A corrente (league/status di FLE) per il PASSO 2
          f.sw = pl.sw || null; f.swTarget = Number(ctl.status && ctl.status.mday || 0) || 0; f.swLettoAt = Date.now();
          delete f.swFermato; delete f.swVerifica; delete f.swModifica; delete f.swEliminato; delete f.compVerifica; // PROVA9: anche la verifica delle competizioni
          scrivi("fle", f);
          sScrivi("task", null);
          var res = risultatoFle();
          log("CONTROLLO FLE RISULTATO", { comp: f.comp, tid: f.tid, rosa: roster.length, senzaRuolo: roster.filter(function (p) { return !p.role; }).length, completo: res && res.complete, sostituzioni: res ? res.pending.length : -1, mancano: res ? res.missing : [], modulo: res ? res.moduleProblem : "" });
          w.chiudi();
          // 0.3.8: in LEGA+FLE, finito il controllo, il blocco modalita
          // riporta correttamente alla lega sorgente. Conserviamo pero l'ordine
          // di riaprire la HOME FVM, cosi la conferma INVIA A FLE compare
          // automaticamente dopo il rientro, senza dover premere il tasto FVM.
          if (leggi("modo", "lega_fle") === "lega_fle" && suFle()) {
            sScrivi("apri", "main");
            log("CONTROLLO FLE", "rientro automatico a FVM per conferma invio");
            location.assign(urlLegaSorgente());
            return;
          }
          apriPannello();
        } else if (atteso >= 20000) {
          clearInterval(t2);
          log("CONTROLLO FLE PAGINA", { comp: task.comp, letta: !!pl, compLetta: pl && pl.comp });
          if (task.lista && task.idx + 1 < task.lista.length) { task.idx++; return provaPagina(task); }
          w.chiudi();
          erroreControllo("Rosa FLE non letta", ["La pagina formazione FLE non ha caricato la tua rosa."], task);
        }
      }, 500);
    }
  }
  // PROVA12: esame della rosa FLE letta nella pagina formazione FLE (regolamento: 25 giocatori, 3 P · 8 D · 8 C · 6 A).
  // Motivi distinti: NON LETTA (nessun giocatore), INCOMPLETA (giocatori senza nome o ruolo: dati del sito non caricati),
  // NON CONFORME (letta per intero ma con un numero diverso da 25). Ogni caso ferma il controllo: nessun invio.
  function esameRosaFle(ids) {
    var lista = (Array.isArray(ids) ? ids : []).map(Number).filter(Boolean), visti = {}, doppi = 0;
    lista.forEach(function (p) { if (visti[p]) doppi++; visti[p] = 1; });
    var n = lista.length - doppi;
    var senza = lista.filter(function (p) { var x = info[p] || {}; return !Number(x.r || 0) || !String(x.n || "").trim(); }).length;
    var fine = "Nessun salvataggio è stato eseguito su FLE: tocca RIPETI CONTROLLO FLE.";
    if (!n) return { esito: "non_letta", n: 0, senzaRuolo: 0, titolo: "Rosa FLE non letta",
      dettagli: ["La pagina formazione FLE non ha mostrato i giocatori della tua rosa.", fine] };
    if (senza) return { esito: "incompleta", n: n, senzaRuolo: senza, titolo: "Rosa FLE letta in modo incompleto",
      dettagli: [senza + " giocatori su " + n + " senza nome o ruolo: il sito FLE non ha caricato tutti i dati.", fine] };
    if (n !== 25) return { esito: "non_conforme", n: n, senzaRuolo: 0, titolo: "Rosa FLE non conforme: " + n + "/25",
      dettagli: ["La rosa FLE ufficiale letta ha " + n + " giocatori invece di 25 (regolamento FLE).", "Verifica la rosa con l'admin della tua lega FLE.", fine] };
    return { esito: "ok", n: n, senzaRuolo: 0 };
  }
  // PROVA12: un controllo FLE vale per l'invio solo se recente: stessa giornata di Serie A (se nota) e al massimo 12 ore
  function fleControlloMaxMs() { return 12 * 3600000; }
  function controlloFleVecchio(f) {
    if (!f || !f.roster) return null;
    var at = Number(f.controlloAt || f.swLettoAt || 0), gSA = Number(ctl.status && ctl.status.mday || 0), gF = Number(f.cmday || 0);
    var r = !at ? "il controllo è di una versione precedente di FVM (ora non registrata)"
      : Date.now() - at > fleControlloMaxMs() ? "il controllo è di " + new Date(at).toLocaleString("it-IT") + " (più di 12 ore fa)"
      : gSA && gF && gSA !== gF ? "il controllo è della " + gF + "ª giornata di Serie A, ora è la " + gSA + "ª"
      : "";
    return r ? { motivo: r, testo: "Controllo FLE da ripetere prima dell'invio: " + r + ". La rosa FLE potrebbe essere cambiata: tocca RIPETI CONTROLLO FLE (nessun salvataggio finora)." } : null;
  }
  function scegliCompetizione(task, lista, w) {
    // 1.3.6.2 (come Android rev. 4): la squadra è iscritta anche ai Ranking (classifiche a punti, nessuna formazione): mai
    // punto di ingresso né destinazione dell'invio; lo Switch si legge sulla competizione realmente giocata.
    var tutteL = lista;
    lista = lista.filter(function (x) { return naturaCompetizione({ id: x.id, name: x.name }) === "obbligo"; });
    log("CONTROLLO FLE DESTINAZIONI", { trovate: tutteL.map(function (x) { return x.id; }), valide: lista.map(function (x) { return x.id; }) });
    if (!lista.length) { w.chiudi(); return erroreControllo("Nessuna competizione FLE giocabile", ["La squadra risulta iscritta solo a classifiche Ranking o a competizioni da verificare: nessuna formazione da inviare.", "Nessun salvataggio eseguito."], task); }
    var c = lista[0];
    log("CONTROLLO FLE DESTINAZIONE", { comp: c.id, nome: c.name, possibili: lista.length });
    task.fase = "lineup"; task.comp = c.id; task.compName = c.name; task.lista = null;
    sScrivi("task", task);
    w.stato("Apro la formazione FLE in " + c.name + "…");
    location.assign(fleLineupUrl(c.id));
  }
  function provaPagina(task) {
    var c = task.lista[task.idx];
    task.fase = "lineup"; task.comp = c.id; task.compName = c.name;
    sScrivi("task", task);
    location.assign(fleLineupUrl(c.id));
  }

  // ---------------------------------------------------------------- PASSO 3 · invio su FLE
  function avviaInvioFle() {
    var f = leggi("fle", null), res = risultatoFle(), u = leggi("ultima", null);
    if (!f || !res || !res.complete || f.stato === "errore") { avviso("Prima completa il controllo FLE.", true); return; }
    var vecchio = controlloFleVecchio(f); // PROVA12: rosa FLE da rileggere prima di inviare
    if (vecchio) { log("INVIO FLE FERMATO", { motivo: "controllo FLE vecchio", dettaglio: vecchio.motivo }); avviso(vecchio.testo, true); return; }
    // capitano e vice: se uno dei due e stato sostituito su FLE, passa al suo sostituto (stessa posizione)
    var cambio = {};
    u.titolari.forEach(function (pid, i) { if (res.starts[i]) cambio[pid] = res.starts[i].pid; });
    var capt = Array.isArray(u.capt) ? u.capt.map(function (c) { var id = idDi(c); return cambio[id] || id; }) : (cambio[idDi(u.capt)] || u.capt);
    var inv = { starts: res.starts.map(function (p) { return p.pid; }), bench: res.bench.map(function (p) { return p.pid; }), mdl: u.modulo, capt: capt };
    // PROVA8: scelta Switch obbligatoria mancante = nessun invio (la decisione definitiva si ripete sulla pagina FLE)
    var swD = null; try { swD = swPasso2(u, f, res); } catch (e) { swD = null; }
    if (swD && swD.blocca && swD.motivo === "scelta_mancante") { log("INVIO FLE FERMATO", { motivo: swD.motivo, caso: swD.caso, prima: "del passaggio a FLE" }); avviso(swTesto(swD, u, f), true); return; }
    sScrivi("task", { tipo: "invio", inizio: Date.now(), comp: f.comp, inv: inv });
    log("INVIO FLE AVVIO", { comp: f.comp, titolari: inv.starts.length, panchina: inv.bench.length, modulo: inv.mdl });
    if (suFle() && location.pathname.indexOf("/competition/" + f.comp + "/lineup") >= 0) eseguiInvio(sLeggi("task"));
    else location.assign(fleLineupUrl(f.comp));
  }
  function bottoneSalva() {
    try {
      var els = document.querySelectorAll("button,a,[role='button'],div,span");
      for (var i = 0; i < els.length; i++) {
        var t = String(els[i].innerText || "").replace(/\s+/g, " ").trim();
        if (/^salva formazione$/i.test(t) && els[i].offsetParent !== null) {
          var b = els[i].closest ? (els[i].closest("button,[role='button']") || els[i]) : els[i];
          return b;
        }
      }
    } catch (e) {}
    return null;
  }
  var invioCorrente = null;
  function eseguiInvio(task) {
    var w = lavoro("Invio su FLE in corso…");
    invioCorrente = { w: w, task: task, finito: false };
    w.stato("Apro la tua formazione FLE…");
    var atteso = 0;
    var t = setInterval(function () {
      atteso += 500;
      var b = bottoneSalva();
      if (ctl.payload && b) {
        clearInterval(t);
        // PROVA8: decisione Switch con la pagina FLE appena letta, PRIMA del clic; non sicura = invio fermato
        if (!swPreparaInvio(task)) return;
        window.__fvmInvio = Object.assign({}, task.inv);
        w.stato("Salvo la formazione su FLE…");
        log("INVIO FLE CLICK", { comp: ctl.payload.comp, tid: ctl.payload.tid, disabilitato: !!b.disabled });
        try { b.click(); } catch (e) { log("INVIO FLE CLICK ERRORE", String(e)); }
        setTimeout(function () {
          var conf = elementoTesto(/^salva$/i);
          if (conf && !window.__fvmInvio.inviato) { log("INVIO FLE CONFERMA", "secondo pulsante Salva"); try { conf.click(); } catch (e) {} }
        }, 1200);
        setTimeout(function () {
          if (invioCorrente && !invioCorrente.finito && window.__fvmInvio && !window.__fvmInvio.inviato) invioDirettoSorgente(task);
        }, 7000);
      } else if (atteso >= 20000) {
        clearInterval(t);
        // PROVA8: anche l'invio di riserva solo con lo Switch verificato sulla pagina FLE
        if (!swPreparaInvio(task)) return;
        invioDirettoSorgente(task);
      }
    }, 500);
  }
  // PROVA8: decisione Switch per l'invio (in task.inv.sw, usata da riscriviPerFle sia nel salvataggio del sito sia
  // nell'invio di riserva). Ritorna false se l'invio e stato fermato.
  function swPreparaInvio(task) {
    var d = null;
    try { d = swDecisioneInvio(task); } catch (e) { d = { blocca: true, motivo: "fle_non_verificabile", caso: "fle_non_verificabile", errore: String(e && e.message || e).slice(0, 80) }; }
    if (d.blocca) { invioFermato(d, task); return false; }
    task.inv = task.inv || {};
    task.inv.sw = { valori: d.valori, scrittura: d.scrittura, caso: d.caso, azione: d.azione || "", posSoloSePresente: !!d.posSoloSePresente, situazione: d.situazione, target: d.target, chiave: d.chiave };
    log("INVIO SWITCH DECISO", { caso: d.caso, scrittura: d.scrittura, azione: d.azione || "", lega: d.lega, fle: d.fle, giornata: d.target, chiave: d.chiave });
    return true;
  }
  // 1.1.0 diagnosi: solo i NOMI delle intestazioni e il valore del Content-Type (mai credenziali, cookie, token, Authorization)
  function diagIntestazioni(h) {
    var nomi = Object.keys(h || {});
    var ct = nomi.filter(function (k) { return /^content-type$/i.test(k); }).map(function (k) { return k + "=" + String(h[k]).slice(0, 80); });
    return { nomi: nomi, contentType: ct, quanteContentType: ct.length };
  }
  // Se il sito non fa partire il salvataggio (pagina FLE vuota o pulsante bloccato), invio io la stessa richiesta del sito.
  function invioDiretto(task) {
    var req = leggi("save_req", null), u = leggi("ultima", null), f = leggi("fle", {});
    log("INVIO FLE DIRETTO", { url: req && req.url, metodo: req && req.metodo, intestazioni: ctl.hdr ? Object.keys(ctl.hdr).length : 0 });
    if (!req || !req.url || !u || !u.corpo) { fineInvio(false, 0, "manca la richiesta di salvataggio della lega"); return; }
    var j;
    try { j = JSON.parse(u.corpo); } catch (e) { fineInvio(false, 0, "corpo non leggibile"); return; }
    var o = trovaFormazione(j, 0);
    if (!o) { fineInvio(false, 0, "corpo senza formazione"); return; }
    if ("idcomp" in o) o.idcomp = typeof o.idcomp === "string" ? String(f.comp) : Number(f.comp);
    if ("tid" in o) o.tid = typeof o.tid === "string" ? String(f.tid) : Number(f.tid);
    var pl = ctl.payload || {};
    if (pl.mday != null && "mday" in o) o.mday = pl.mday;
    if (pl.cmday != null && "cmday" in o) o.cmday = pl.cmday;
    riscriviPerFle(o, task.inv);
    // 1.1.0 fix 415: dalle intestazioni copiate dal sito tolgo OGNI variante di Content-Type e Content-Length
    // (maiuscole o minuscole) e ne imposto UNA sola. Tutte le altre, autorizzazione compresa, restano com'erano.
    var h = {};
    Object.keys(ctl.hdr || {}).forEach(function (k) { if (!/^content-(type|length)$/i.test(k)) h[k] = ctl.hdr[k]; });
    h["Content-Type"] = "application/json";
    log("INVIO INTESTAZIONI", diagIntestazioni(h)); // solo diagnosi
    window.__fvmInvio = null;
    fetchOriginale(req.url, { method: req.metodo || "PUT", headers: h, body: JSON.stringify(j), credentials: "include" })
      .then(function (r) { return r.text().then(function (t) { fineInvio(r.ok, r.status, t); }); })
      .catch(function (e) { fineInvio(false, 0, String(e && e.message || e)); });
  }
  function fineInvio(ok, stato, testo) {
    if (invioCorrente && invioCorrente.finito) return;
    // PROVA8: decisione Switch di questo invio (per la verifica su FLE dopo il salvataggio)
    var swInv = invioCorrente && invioCorrente.task && invioCorrente.task.inv && invioCorrente.task.inv.sw ? invioCorrente.task.inv.sw : null;
    // PROVA9: formazione inviata da FVM (per la verifica individuale delle competizioni); assente = nessun invio FVM in corso
    var taskInv = invioCorrente && invioCorrente.task && invioCorrente.task.inv && Array.isArray(invioCorrente.task.inv.starts) ? invioCorrente.task.inv : null;
    if (invioCorrente) { invioCorrente.finito = true; try { invioCorrente.w.chiudi(); } catch (e) {} }
    window.__fvmInvio = null;
    var esito = "";
    try { var j = JSON.parse(testo || "null"); esito = j && (j.success === false || j.error || j.errors) ? JSON.stringify(j).slice(0, 200) : ""; } catch (e) {}
    if (esito) ok = false;
    log("INVIO FLE ESITO", { ok: !!ok, stato: stato, risposta: String(testo || "").slice(0, 200) });
    // PROVA9: sintesi della risposta (campi chiave, mai intestazioni o credenziali), sempre completa nella diagnosi
    var rsF = null; try { rsF = trovaFormazione(JSON.parse(testo || "null"), 0); } catch (e) { rsF = null; }
    if (rsF) log("INVIO FLE RISPOSTA", { idcomp: Number(rsF.idcomp) || 0, tid: Number(rsF.tid) || 0, mday: rsF.mday, cmday: rsF.cmday, swtcA: rsF.swtcA, swtcB: rsF.swtcB, swtc: rsF.swtc, swtcMdl: rsF.swtcMdl, pos: rsF.pos,
      mdl: rsF.mdl, titolari: (rsF.starts || []).length, panchina: (rsF.bench || []).length, tutte: rsF.allComp, visb: rsF.visb });
    var idSt = null;
    try { idSt = storicoInvioFle(ok, stato, testo, { inv: taskInv, comps: ctl.comps }); } catch (e) {} // storico: solo registrazione, isolata
    var f = leggi("fle", {}) || {}, u = formazioneSorgente() || {};
    sScrivi("task", null);
    if (ok) {
      f.stato = "inviata"; f.inviataAt = Date.now();
      if (swInv) {
        // PROVA8: cosa e stato scritto; la scelta MODIFICA resta in evidenza finche l'utente non salva su FLE
        f.swInviato = { scrittura: swInv.scrittura, caso: swInv.caso, azione: swInv.azione, valori: swInv.valori, at: Date.now() };
        delete f.swFermato; delete f.swVerifica;
        if (swInv.azione === "modifica") f.swModifica = true; else delete f.swModifica;
        if (swInv.azione === "elimina") f.swEliminato = true; else delete f.swEliminato;
      }
      // PROVA11: cio che serve per ripetere SOLO la verifica (RIPROVA VERIFICA, sola lettura): mai un nuovo invio
      var targetV = swInv || taskInv ? Number(rsF && rsF.cmday) || Number(ctl.status && ctl.status.mday) || 0 : 0; // letto solo se ci sono verifiche (come prima)
      if (swInv || taskInv) f.verificaRif = { at: Date.now(), comp: Number(f.comp) || 0, compName: f.compName || "", tid: Number(f.tid) || 0, idSt: idSt || null, target: targetV,
        sw: swInv && swInv.valori ? { valori: swInv.valori } : null, inv: taskInv ? { starts: (taskInv.starts || []).slice(), bench: (taskInv.bench || []).slice(), mdl: taskInv.mdl } : null };
      else delete f.verificaRif;
      scrivi("fle", f);
      var invii = leggi("invii", []);
      invii.unshift({ at: Date.now(), comp: f.comp, compName: f.compName, squadra: f.squadra || u.squadra, modulo: u.modulo, fonte: u.fonte });
      scrivi("invii", invii.slice(0, 20));
      var modoFine = leggi("modo", "lega_fle");
      sScrivi("apri", "main");
      sScrivi("flash", "Formazione salvata su FLE ✓");
      var prosegui = function () {
        if (modoFine === "solo_fle") {
          log("BLOCCO MODO", { modo: modoFine, perche: "fine invio", a: "FLE" });
          // SOLO FLE resta fisicamente dentro FantaLegaEuropa.
          if (!suFle()) location.assign(urlFleFissa()); else { avviso("Formazione salvata su FLE ✓"); apriPannello(); }
        } else {
          // LEGA+FLE torna sempre alla lega sorgente stabile.
          var torna = f.ritorno && f.ritorno.indexOf("/" + FLE_SLUG + "/") < 0 ? f.ritorno : urlLegaSorgente();
          log("BLOCCO MODO", { modo: modoFine, perche: "fine invio", a: legaCorrente() || "lega sorgente" });
          location.assign(torna);
        }
      };
      // PROVA8: verifica dello Switch su FLE dopo il salvataggio (sola lettura); PROVA9: in parallelo la verifica individuale
      // delle competizioni; PROVA11: UNA lettura condivisa con tentativi limitati, esiti nello storico senza sovrascrivere
      // quelli precedenti; poi il ritorno di sempre
      var attese = 0, chiuso = false, rSw = null, rComp = null, wv = null, lettore = null;
      var finisci = function () {
        if (chiuso || attese > 0) return;
        chiuso = true;
        if (wv) { try { wv.chiudi(); } catch (e) {} }
        if (rSw || rComp) {
          var f4 = leggi("fle", {}) || {};
          if (rSw) f4.swVerifica = rSw;
          if (rComp) f4.compVerifica = { at: Date.now(), esiti: rComp };
          scrivi("fle", f4);
          if (idSt) storicoVerificaAggiungi(idSt, rSw, rComp, "dopo l'invio");
        }
        var avv = rSw || rComp ? fvmAvvisiVerifica(rSw, rComp) : [];
        if (avv.length) sScrivi("flash", "Formazione salvata su FLE ✓ · " + avv.join(" · ") + ": controlla nel PASSO 2");
        prosegui();
      };
      // prima si contano tutte le verifiche, poi si avviano (una che finisce subito non chiude le altre)
      attese = (swInv ? 1 : 0) + (taskInv ? 1 : 0);
      if (attese) { wv = lavoro("Verifico la formazione su FLE (sola lettura)…"); lettore = fvmLettoreCondiviso(); }
      if (swInv) verificaSwitchFle(f.comp, f.tid, swInv, function (r) { rSw = r; attese--; finisci(); }, lettore);
      if (taskInv) {
        verificaCompetizioniFle({ tid: Number(f.tid), ingresso: Number(f.comp), ingressoNome: f.compName || "", target: targetV,
          inv: taskInv, sw: swInv && swInv.valori ? swInv.valori : null, comps: ctl.comps, divisione: meDivisione(FLE_SLUG), leggi: lettore }, function (lst) { rComp = lst; attese--; finisci(); });
      }
      if (!swInv && !taskInv) finisci();
    } else {
      f.stato = "errore"; f.titolo = "Invio su FLE non riuscito";
      f.dettagli = ["Il sito FLE non ha confermato il salvataggio" + (stato ? " (stato " + stato + ")" : "") + ".", "Riprova con RIPETI CONTROLLO FLE oppure manda la diagnosi al tuo admin."];
      scrivi("fle", f);
      apriPannello();
    }
  }

  // ---------------------------------------------------------------- PROVA11 · RIPROVA VERIFICA (SOLO LETTURE)
  // Ripete soltanto le verifiche dell'ultimo invio FLE: apre la pagina della formazione FLE (lettura del sito), usa la
  // formazione che il sito stesso ha letto e, se serve, letture GET con tentativi limitati. Mai un salvataggio, mai un
  // invio, mai una nuova consegna nello storico: l'esito si aggiunge alle verifiche della consegna gia registrata.
  function avviaRiverifica() {
    var f = leggi("fle", null), R = f && f.verificaRif;
    if (!R || !Number(R.comp)) { avviso("Nessuna verifica da ripetere: manca un invio FLE recente.", true); return; }
    var qui = location.href.indexOf("/" + FLE_SLUG + "/") < 0 ? location.href : "";
    var task = { tipo: "riverifica", inizio: Date.now(), comp: Number(R.comp), ritorno: qui || (f.ritorno && f.ritorno.indexOf("/" + FLE_SLUG + "/") < 0 ? f.ritorno : "") };
    sScrivi("task", task);
    log("RIPROVA VERIFICA", { fase: "avvio", comp: Number(R.comp), da: suFle() ? "pagina FLE" : "pagina della lega" });
    chiudiPannello();
    if (suFle() && location.pathname.indexOf("/competition/" + R.comp + "/lineup") >= 0) eseguiRiverifica(task);
    else location.assign(fleLineupUrl(R.comp));
  }
  function eseguiRiverifica(task) {
    var f = leggi("fle", {}) || {}, R = f.verificaRif, finito = false;
    var w = lavoro("Ripeto la verifica su FLE (sola lettura, nessun invio)…");
    var fine = function (rSw, rComp, nota) {
      if (finito) return; finito = true;
      var f5 = leggi("fle", {}) || {};
      if (rSw) f5.swVerifica = rSw;
      if (rComp) f5.compVerifica = { at: Date.now(), esiti: rComp };
      f5.riverificaAt = Date.now();
      scrivi("fle", f5);
      if (R && R.idSt && (rSw || rComp)) storicoVerificaAggiungi(R.idSt, rSw, rComp, "RIPROVA VERIFICA");
      log("RIPROVA VERIFICA", { fase: "fine", switch: rSw ? rSw.esito : "", tipo: rSw && rSw.tipo || "", motivo: rSw && rSw.motivo || "", tentativi: rSw && rSw.tentativi || 0,
        competizioni: (rComp || []).map(function (c) { return c.id + ":" + c.esito; }), nota: nota || "" });
      sScrivi("task", null);
      sScrivi("apri", "main");
      var avv = fvmAvvisiVerifica(rSw, rComp);
      sScrivi("flash", avv.length ? "Verifica ripetuta (sola lettura) · " + avv.join(" · ") : rSw && rSw.esito === "ok" ? "Verifica ripetuta (sola lettura): Switch su FLE verificato ✓" : "Verifica ripetuta (sola lettura) ✓");
      try { w.chiudi(); } catch (e) {}
      if (task && task.ritorno) location.assign(task.ritorno); else apriPannello();
    };
    if (!R || !Number(R.comp)) return fine(null, null, "dati della verifica non disponibili");
    // prima la formazione letta DAL SITO su questa pagina (nessuna richiesta di FVM), al massimo 8 s di attesa
    var atteso = 0, t = setInterval(function () {
      atteso += 500;
      var d = ctl.payloadDto, pronta = !!(d && Number(d.idcomp) === Number(R.comp) && (!Number(R.tid) || Number(d.tid) === Number(R.tid)));
      if (!pronta && atteso < 8000) return;
      clearInterval(t);
      var prima = {};
      if (pronta) prima["/gaming/v1/teamLineup/visualizza/" + meDivisione(FLE_SLUG) + "/" + Number(R.comp)] = { teamLineupDto: d };
      var lettore = fvmLettoreCondiviso(prima), rSw = null, rComp = null, attese = (R.sw ? 1 : 0) + (R.inv ? 1 : 0);
      var nota = pronta ? "formazione letta dalla pagina FLE" : "pagina FLE senza formazione: letture di FVM";
      if (!attese) return fine(null, null, "nessuna verifica prevista");
      var uno = function () { if (--attese <= 0) fine(rSw, rComp, nota); };
      if (R.sw) verificaSwitchFle(R.comp, R.tid, R.sw, function (r) { rSw = r; uno(); }, lettore);
      if (R.inv) verificaCompetizioniFle({ tid: Number(R.tid), ingresso: Number(R.comp), ingressoNome: R.compName || "", target: Number(R.target) || 0, inv: R.inv,
        sw: R.sw ? R.sw.valori : null, comps: ctl.comps, divisione: meDivisione(FLE_SLUG), leggi: lettore }, function (l) { rComp = l; uno(); });
    }, 500);
  }

  // ---------------------------------------------------------------- pannello ordine di entrata
  function chiediOrdine(ids, fatto) {
    monta();
    if (!radice) { fatto(null); return; }
    if (inAttesa) { try { inAttesa(null); } catch (e) {} }
    var scelti = [];
    var finito = false;
    var box = document.createElement("div");
    box.className = "ov";
    function chiudi(ordine) {
      if (finito) return;
      finito = true;
      inAttesa = null;
      box.remove();
      log("ORDINE", ordine ? { ordine: ordine } : "lascia così");
      fatto(ordine);
    }
    inAttesa = chiudi;
    log("CHIEDO ORDINE", { giocatori: ids.length, senzaNome: ids.filter(function (id) { return !(info[id] && info[id].n); }).length });
    function disegna() {
      var h = "<div class='cd'><div class='lb'>ORDINE DI ENTRATA</div><div class='t1' style='margin-top:6px'>Tocca i panchinari in ordine</div>" +
        "<div class='mu' style='margin-top:6px'>Il primo che tocchi entra per primo, portieri dove vuoi tu. Tocca di nuovo un numero per toglierlo. Chi non tocchi resta dopo, nell'ordine attuale.</div></div>";
      ids.forEach(function (id, i) {
        var p = info[id] || {};
        var pos = scelti.indexOf(id);
        h += "<div class='riga" + (pos >= 0 ? " on" : "") + "' data-id='" + id + "'><span class='num" + (pos >= 0 ? " on" : "") + "'>" + (pos >= 0 ? pos + 1 : "") + "</span>" + badge(p.r) + "<span class='nm'>" + esc(p.n || "Panchinaro " + (i + 1)) + "</span></div>";
      });
      if (scelti.length) {
        var finale = scelti.concat(ids.filter(function (id) { return scelti.indexOf(id) < 0; }));
        h += "<div class='cd' style='margin-top:10px'><div class='lb'>ORDINE FINALE</div><div class='mu' style='margin-top:6px'>" +
          finale.map(function (id, i) { var p = info[id] || {}; return (i + 1) + ". " + esc(p.n || id) + " (" + (RUOLI[p.r] || "?") + ")"; }).join("<br>") + "</div></div>";
      }
      h += "<button class='bt oro" + (scelti.length ? "" : " spento") + "' data-b='ok'>SALVA IN QUEST'ORDINE</button>" +
        "<button class='bt' data-b='reset'>RICOMINCIA</button><button class='bt' data-b='lascia'>LASCIA COSÌ</button>";
      box.innerHTML = h;
      Array.prototype.forEach.call(box.querySelectorAll("[data-id]"), function (el) {
        el.addEventListener("click", function () {
          var id = Number(el.getAttribute("data-id"));
          var pos = scelti.indexOf(id);
          if (pos >= 0) scelti.splice(pos, 1); else scelti.push(id);
          var sc = box.scrollTop;
          disegna();
          box.scrollTop = sc;
        });
      });
      box.querySelector("[data-b='ok']").addEventListener("click", function () {
        if (!scelti.length) return;
        var resto = ids.filter(function (id) { return scelti.indexOf(id) < 0; });
        chiudi(scelti.concat(resto));
      });
      box.querySelector("[data-b='reset']").addEventListener("click", function () { scelti = []; disegna(); });
      box.querySelector("[data-b='lascia']").addEventListener("click", function () { chiudi(null); });
    }
    disegna();
    radice.appendChild(box);
    setTimeout(function () { if (!finito) chiudi(null); }, 300000);
  }

  // ---------------------------------------------------------------- S5-S8 · CONSEGNE UFFICIALI DELLE LEGHE (lato Leghe)
  // Registri UFFICIALI delle piattaforme (anche consegne fatte fuori da FVM o prima della sua installazione), tenuti
  // SEPARATI dallo storico personale FVM (fvm_storico_v1): chiavi proprie, schermata propria, nessuna fusione.
  // Solo lettura: GET ai dati che la pagina della lega usa gia (stessa sessione), lettura del testo di Opzioni di Lega.
  var UFF_MAX_MS = 75000;
  function legheControllabili() {
    var v = {};
    LEGHE_FONTE.forEach(function (l) { v[l[1]] = l[0]; });
    (leggi("leghe_note", []) || []).forEach(function (s) { if (s && s !== FLE_SLUG && !v[s]) v[s] = nomeLega(s); });
    return Object.keys(v).map(function (s) { return { slug: s, nome: v[s] }; });
  }
  function legheFcControllabili() {
    var v = {};
    Object.keys(FC_CIRCUITO).forEach(function (k) { v[k] = FC_CIRCUITO[k]; });
    var lf = legaFc(); if (lf) v[lf.nl.toLowerCase()] = lf.nome;
    (leggi("fc_leghe_note", []) || []).forEach(function (s) { if (NL_VALIDO.test(String(s)) && !v[String(s).toLowerCase()]) v[String(s).toLowerCase()] = String(s).toUpperCase(); });
    return Object.keys(v).map(function (s) { return { nl: s, nome: v[s] }; });
  }
  // partecipanti della lega (squadra -> nome e allenatori): MAI i codici o le email della risposta
  function squadreDaPartecipanti(j) {
    var out = {};
    (Array.isArray(j) ? j : []).forEach(function (p) {
      if (!p || !Number(p.teamId)) return;
      out[Number(p.teamId)] = { nome: String(p.teamName || "").slice(0, 60), allenatori: (Array.isArray(p.coaches) ? p.coaches : []).map(function (c) { return String(c && c.name || "").slice(0, 40); }).filter(Boolean).slice(0, 3) };
    });
    return out;
  }
  function partecipantiLega(slug) { var c = leggi("partecipanti_" + slug, null); return c && c.squadre ? c.squadre : null; }
  // S5: aggiornamento dei partecipanti della lega aperta (al massimo una volta al giorno, solo lettura)
  function aggiornaPartecipanti() {
    try {
      var slug = slugDaPagina();
      if (!slug || slug === FLE_SLUG || !ctl.hdr) return;
      var c = leggi("partecipanti_" + slug, null);
      if (c && Date.now() - Number(c.at || 0) < 24 * 3600000) return;
      getApi("/onboarding/v1/invitation/participants?pageNumber=1&pageSize=1000").then(function (j) {
        var sq = squadreDaPartecipanti(j);
        if (Object.keys(sq).length) { scrivi("partecipanti_" + slug, { at: Date.now(), squadre: sq }); log("PARTECIPANTI", { lega: slug, squadre: Object.keys(sq).length }); }
      }).catch(function (e) { log("PARTECIPANTI", { lega: slug, esito: String(e && e.message || e).slice(0, 80) }); });
    } catch (e) {}
  }
  function apiJson(path) {
    return getApi(path, true).then(function (j) { if (typeof j === "string" && /^\s*[\[{]/.test(j)) { try { return JSON.parse(j); } catch (e) {} } return j; });
  }
  // ---- S6 Leghe: avvio (passa alla pagina della lega scelta: lo stesso accesso, nessuna nuova credenziale)
  function avviaControlloLega(slug, comp, turno) {
    if (!slug) return;
    sScrivi("uff_sel", Object.assign(sLeggi("uff_sel") || {}, { slug: slug, comp: Number(comp) || 0, turno: Number(turno) || 0 }));
    sScrivi("task", { tipo: "lega", fase: "dati", slug: slug, comp: Number(comp) || 0, turno: Number(turno) || 0, inizio: Date.now(), ritorno: location.href });
    log("CONSEGNE UFFICIALI", { piattaforma: "leghe", lega: slug, comp: Number(comp) || 0, turno: Number(turno) || 0 });
    chiudiPannello();
    location.assign("https://leghe.fantacalcio.it/" + slug + "/view/dashboard?fvm_uff=" + Date.now());
  }
  function fineControlloLega(task, w) {
    sScrivi("task", null);
    sScrivi("apri", "ufficiale");
    try { w.chiudi(); } catch (e) {}
    if (task.ritorno && task.ritorno.indexOf("/" + task.slug + "/settings") < 0) location.assign(task.ritorno); else { apriUfficiale(); }
  }
  // ================================================================ PROVA6: CONSEGNE UFFICIALI per partita (partecipanti)
  // Tipi di competizione del sito con partite A COPPIE: 1 calendario, 4-6 gironi, 7-9 eliminazione diretta. Gli altri
  // (2 contro tutti, 3 Formula 1, 10 Battle Royale, 11 Highlander) non hanno partite a coppie: nessuna lettura per partita.
  // come letturaPartiteFle (FLE, NON modificata), per una competizione di una lega personale: tiene anche il modulo
  // (mdl/nmdl) mostrato dalle CONSEGNE UFFICIALI; mai i giocatori. 4 partite alla volta, arresto al primo 429/5xx.
  function letturaPartiteLega(comp, turno) {
    var INSIEME = 4, PAUSA_MS = 250, mday = Number(turno.championshipMatchDay) || 0;
    var coppie = (turno.matches || []).filter(function (m) { return m && Number(m.tIdH) > 0 && Number(m.tIdA) > 0; });
    var R = { lineups: [], nonLette: [], letture: 0, fallite: 0, fermata: "", messaggio: "" }, i = 0;
    function riga(p, atteso) {
      var r = rigaPartitaFle(p);
      if (!r) return null;
      if (!r.tid) r.tid = atteso;
      r.mdl = String(p.mdl || ""); r.nmdl = String(p.nmdl || "");
      return r;
    }
    function gruppo() {
      if (i >= coppie.length) return Promise.resolve(R);
      if (R.fermata) { coppie.slice(i).forEach(function (m) { R.nonLette.push(Number(m.tIdH), Number(m.tIdA)); }); i = coppie.length; return Promise.resolve(R); }
      var g = coppie.slice(i, i + INSIEME); i += g.length;
      return Promise.all(g.map(function (m) {
        var h = Number(m.tIdH), a = Number(m.tIdA);
        R.letture++;
        return apiFleLettura("/gaming/v1/teamLineup/" + comp + "/" + turno.matchDay + "/" + mday + "/" + h + "/" + a).then(function (j) {
          if (j && typeof j === "object" && !Array.isArray(j) && !("home" in j) && !("away" in j) && j.data && typeof j.data === "object") j = j.data;
          if (!j || typeof j !== "object" || Array.isArray(j)) throw new Error("risposta della partita non valida");
          [[j.home, h], [j.away, a]].forEach(function (x) { var r = riga(x[0], x[1]); if (!r) return; if (r.tid === x[1]) R.lineups.push(r); else R.nonLette.push(x[1]); });
        }).catch(function (e) {
          R.fallite++; R.nonLette.push(h, a);
          if (!R.messaggio) R.messaggio = (e && e.http ? "HTTP " + e.http : String(e && e.message || e).slice(0, 40)) + (e && e.msg ? " · " + e.msg : "");
          if (e && (e.http === 429 || e.http >= 500)) R.fermata = "HTTP " + e.http;
        });
      })).then(function () { return new Promise(function (ok) { setTimeout(ok, PAUSA_MS); }); }).then(gruppo);
    }
    return gruppo();
  }
  function eseguiControlloLega(task) {
    var w = lavoro("Consegne ufficiali · " + nomeLegaUff(task.slug)), atteso = 0;
    var R = { slug: task.slug, lega: nomeLegaUff(task.slug), quando: Date.now(), errori: [] };
    w.stato("Apro la lega con il tuo accesso…");
    var t = setInterval(function () {
      atteso += 500;
      if ((ctl.hdr && ctl.hdrScore >= 2) || (ctl.hdr && atteso >= 6000)) { clearInterval(t); leggi1(); }
      else if (atteso >= 15000) { clearInterval(t); R.errori.push("dati della lega non letti (accesso a Leghe Fantacalcio non attivo o lega non dell'account)"); salvaR(); fineControlloLega(task, w); }
    }, 500);
    function salvaR() { R.quando = Date.now(); scrivi("uff_leghe_" + task.slug, R); }
    function leggi1() {
      R.admin = !!document.querySelector(".admin-icon, nz-icon.anticon-crown");
      w.stato("Leggo competizioni, calendario e squadre…");
      var comps;
      apiJson("/onboarding/v1/league/competitions").then(function (j) {
        comps = listaCompetizioni(j).filter(function (c) { return c && !c.del; }).map(function (c) { return { id: Number(c.id), nome: String(c.name || c.n || "").slice(0, 60), tipo: Number(c.type) || 0 }; }).filter(function (c) { return c.id; });
        R.competizioni = comps;
        var c = comps.filter(function (x) { return x.id === Number(task.comp); })[0] || comps.filter(function (x) { return /campionato/i.test(x.nome); })[0] || comps[0];
        if (!c) throw new Error("nessuna competizione leggibile");
        R.comp = c.id; R.competizione = c.nome;
        return Promise.all([apiJson("/onboarding/v1/league/competition/calendar/" + c.id), apiJson("/onboarding/v1/league/status"), apiJson("/gaming/v1/lineup/notcalculated/" + c.id).catch(function () { return []; }),
          apiJson("/onboarding/v1/invitation/participants?pageNumber=1&pageSize=1000").catch(function () { return []; }),
          apiJson("/onboarding/v1/league/settings/rosters").catch(function () { return null; })]);
      }).then(function (v) {
        // calendario non leggibile = errore dichiarato (mai "nessuna giornata" o "nessuna formazione")
        if (!Array.isArray(v[0])) throw new Error("calendario della competizione non leggibile (risposta non valida)");
        // tipo di gioco come lo ricava il sito (impostazioni rose: sroles == 2 Mantra, altrimenti Classic); non letto = ""
        var ro = v[4] && typeof v[4] === "object" ? (v[4].sroles != null ? v[4] : v[4].data && v[4].data.sroles != null ? v[4].data : null) : null;
        R.tipoGioco = ro ? (Number(ro.sroles) === 2 ? "mantra" : "classic") : "";
        var cal = v[0].filter(function (r) { return r && Number(r.matchDay); });
        var st = v[1] || {}, nc = Array.isArray(v[2]) ? v[2] : [], sq = squadreDaPartecipanti(v[3]);
        if (Object.keys(sq).length) scrivi("partecipanti_" + task.slug, { at: Date.now(), squadre: sq });
        R.turni = cal.map(function (r) { return { g: Number(r.matchDay), sa: Number(r.championshipMatchDay) }; });
        var mday = Number(st.mday || 0);
        var turno = cal.filter(function (r) { return Number(r.matchDay) === Number(task.turno); })[0] ||
          cal.filter(function (r) { return Number(r.championshipMatchDay) === mday; })[0] ||
          cal.filter(function (r) { return Number(r.championshipMatchDay) < mday; }).slice(-1)[0] || cal[0];
        if (!turno) { R.stato = { fase: "nessuna_giornata", righe: [], conta: {}, squadre: 0 }; R.nota = "Competizione senza giornate disponibili (es. non ancora iniziata): nessuna mancata consegna."; return null; }
        R.turno = Number(turno.matchDay);
        w.stato("Leggo le formazioni della " + turno.matchDay + "ª giornata…");
        // PROVA6: lettura cumulativa ESATTAMENTE come prima (apiJson: amministratori della lega invariati). HTTP 400 = riservata agli amministratori della lega: per le competizioni
        // A COPPIE (calendario, gironi, eliminazione diretta) lettura PER PARTITA come fa il sito per i partecipanti.
        var pathL = "/gaming/v1/teamLineup/" + R.comp + "/" + turno.matchDay + "/" + turno.championshipMatchDay;
        var tipoC = Number((comps.filter(function (x) { return x.id === R.comp; })[0] || {}).tipo || 0), aCoppie = [1, 4, 5, 6, 7, 8, 9].indexOf(tipoC) >= 0; // tipi a coppie (vedi sopra)
        var nonLetteL = {}; // squadre non verificabili nella lettura per partita (tid -> motivo)
        return apiJson(pathL).catch(function (e) {
          if (!(e && e.http === 400 && aCoppie)) {
            R.formazioniErrore = String(e && e.message || e).slice(0, 160) + (e && e.http === 400 && !aCoppie ? " · lettura per partita non disponibile per questo tipo di competizione" : "");
            return null;
          }
          R.perPartita = { server: e.msg || "", tipo: tipoC };
          log("CONSEGNE UFFICIALI", { lega: task.slug, stage: "per partita", comp: R.comp, tipo: tipoC, http: 400, server: e.msg || "" });
          w.stato("Leggo le formazioni partita per partita…");
          return letturaPartiteLega(R.comp, turno).then(function (P) {
            P.nonLette.forEach(function (x) { nonLetteL[Number(x)] = "partita non letta"; });
            // squadra a riposo (avversario 0 o negativo): il sito non legge la sua partita, nessun dato = mai "non inserita"
            (turno.matches || []).forEach(function (m) {
              var h = Number(m && m.tIdH) || 0, a = Number(m && m.tIdA) || 0;
              if ((h > 0) !== (a > 0)) nonLetteL[h > 0 ? h : a] = "senza avversario nel turno: non letta per partita";
            });
            R.perPartita.letture = P.letture; R.perPartita.nonLette = P.nonLette.length / 2;
            log("CONSEGNE UFFICIALI", { lega: task.slug, stage: "partite", comp: R.comp, letture: P.letture, fallite: P.fallite, formazioni: P.lineups.length, fermata: P.fermata || "" });
            if (P.fallite || P.nonLette.length) R.errori.push((P.nonLette.length / 2) + " partite non lette" + (P.messaggio ? " (" + P.messaggio + ")" : "") + ": le loro squadre sono non verificabili");
            return P.lineups;
          });
        }).then(function (lu) {
          // lettura non riuscita o risposta non valida: formazioni = null (squadre "non verificabili", mai "nessuna formazione")
          if (lu !== null && !Array.isArray(lu)) R.formazioniErrore = "risposta delle formazioni non valida";
          if (R.formazioniErrore) R.errori.push("formazioni della giornata non lette: " + R.formazioniErrore);
          R.stato = fvmStatoLeghe({ avvioDistinto: true, turno: turno, formazioni: R.formazioniErrore ? null : lu, formazioniErrore: R.formazioniErrore || "", tipoGioco: R.tipoGioco, squadre: sq, nonCalcolate: nc, giornataSerieA: mday, inizioGiornata: st.mstr, regola: leggi("uff_regola_" + task.slug, null) });
          // PROVA6: dopo il motore degli stati (NON modificato): le squadre senza dati per lettura non possibile (partita non
          // letta, squadra a riposo) diventano "non verificabili" con il motivo; conteggi ricalcolati
          if (R.perPartita && R.stato && Array.isArray(R.stato.righe)) {
            R.stato.righe.forEach(function (r) {
              var mot = nonLetteL[Number(r.tid)];
              if (!mot || ["presente", "recuperata", "tavolino"].indexOf(r.stato) >= 0) return;
              r.stato = "non_verificabile"; r.nota = mot; delete r.statoUfficiale; delete r.evidenzia;
            });
            var cn = {}; R.stato.righe.forEach(function (r) { cn[r.stato] = (cn[r.stato] || 0) + 1; }); R.stato.conta = cn;
          }
        });
      }).catch(function (e) { R.errori.push(String(e && e.message || e).slice(0, 160)); }).then(function () {
        salvaR();
        log("CONSEGNE UFFICIALI", { lega: task.slug, tipoGioco: R.tipoGioco || "non letto", formazioniLette: !!(R.stato && R.stato.formazioniLette), act: R.stato && R.stato.righe ? R.stato.righe.map(function (r) { return r.act === undefined || r.act === null ? "-" : r.act; }).join(",") : "", errori: R.errori.length });
        var reg = leggi("uff_regola_" + task.slug, null);
        if (reg && Date.now() - Number(reg.at || 0) < 12 * 3600000) { fineControlloLega(task, w); return; }
        // regola della lega: pagina Opzioni di Lega -> Calcolo (sola lettura del testo)
        task.fase = "regole"; task.inizio = Date.now(); sScrivi("task", task);
        w.stato("Leggo la regola della lega (Opzioni di Lega → Calcolo)…");
        location.assign("https://leghe.fantacalcio.it/" + task.slug + "/settings#calculation");
      });
    }
  }
  function leggiRegolaLega(task) {
    var w = lavoro("Regola della lega · " + nomeLegaUff(task.slug)), atteso = 0;
    w.stato("Leggo Opzioni di Lega → Calcolo…");
    var t = setInterval(function () {
      atteso += 500;
      var righe = String(document.body && document.body.innerText || "").split("\n").map(function (l) { return l.replace(/\s+/g, " ").trim(); }).filter(Boolean);
      if (righe.indexOf("Formazione non schierata") >= 0 || atteso >= 20000) {
        clearInterval(t);
        var punti = "";
        try {
          var el = Array.prototype.slice.call(document.querySelectorAll("*")).filter(function (e) { return e.children.length === 0 && /^Punteggio d'ufficio$/.test(String(e.textContent || "").trim()); })[0];
          for (var p = el, i = 0; p && i < 5 && !punti; i++, p = p.parentElement) { var inp = p.querySelector && p.querySelector("input"); if (inp && /^\d+([.,]\d+)?$/.test(String(inp.value || "").trim())) punti = String(inp.value).trim(); }
        } catch (e) {}
        var r = fvmRegolaLeghe(righe, punti);
        r.at = Date.now();
        scrivi("uff_regola_" + task.slug, r);
        // la regola letta entra anche nello stato appena calcolato (solo come regola, MAI come esito)
        var R = leggi("uff_leghe_" + task.slug, null);
        if (R && R.stato && R.stato.righe) { R.regola = r; scrivi("uff_leghe_" + task.slug, R); }
        log("CONSEGNE UFFICIALI", { lega: task.slug, regola: r.letta ? r.nonSchierata : "non letta" });
        fineControlloLega(task, w);
      }
    }, 500);
  }
  function nomeLegaUff(slug) { var l = LEGHE_FONTE.filter(function (x) { return x[1] === slug; })[0]; return l ? l[0] : nomeLega(slug); }
  // ---- S7 Fantaclub: richiesta verso fantaclub.it e arrivo dell'esito
  function avviaControlloFcUff(nl, giornata) {
    if (!NL_VALIDO.test(String(nl || ""))) return;
    sScrivi("uff_sel", Object.assign(sLeggi("uff_sel") || {}, { nl: nl, giornataFc: giornata || "" }));
    var id = inviaPassaggio("fantaclub", "controllo-fc", { nl: String(nl), giornata: /^\d{1,2}$/.test(String(giornata || "")) ? String(giornata) : "" }, "/servlet/lega/" + encodeURIComponent(nl));
    if (id) { sScrivi("uff_fc_atteso", { id: id, nl: String(nl), at: Date.now() }); log("CONSEGNE UFFICIALI", { piattaforma: "fantaclub", lega: nl, giornata: giornata || "corrente" }); }
    else avviso("Controllo Fantaclub non avviato.", true);
  }
  // PROVA15: esito delle competizioni arrivato da Fantaclub, ripulito (solo i campi attesi, testi corti, cid numerici, al massimo 20)
  function fvmFcCompetizioniRicevute(C) {
    if (!C || typeof C !== "object") return null;
    var esiti = ["elenco", "nessuna_aggiuntiva", "non_riconosciuta", "errore"], t = function (x, n) { return String(x == null ? "" : x).slice(0, n); };
    var voci = (Array.isArray(C.voci) ? C.voci : []).filter(function (v) { return v && /^[A-Za-z][A-Za-z0-9_]{0,40}$/.test(String(v.pagina || "")) && /^\d{1,6}$/.test(String(v.cid || "")) && t(v.nome, 60).trim(); }).slice(0, 20).map(function (v) {
      return { chiave: v.pagina + ":" + v.cid, pagina: String(v.pagina), cid: String(v.cid), nome: t(v.nome, 60).trim(), attiva: !!v.attiva, tipo: t(v.tipo, 30), sottotitolo: t(v.sottotitolo, 120), giornate: t(v.giornate, 40),
        coerente: v.coerente === true ? true : v.coerente === false ? false : undefined, errore: t(v.errore, 80) || undefined, nomeNonUnivoco: !!v.nomeNonUnivoco || undefined };
    });
    var sc = C.scartati && typeof C.scartati === "object" ? C.scartati : {};
    var es = esiti.indexOf(C.esito) >= 0 ? C.esito : "non_riconosciuta"; if (es === "elenco" && !voci.length) es = "non_riconosciuta";
    return { esito: es, voci: voci, errore: t(C.errore, 120) || undefined, titoloLega: !!C.titoloLega,
      scartati: { altra_lega: Number(sc.altra_lega) || 0, cid_non_valido: Number(sc.cid_non_valido) || 0, doppioni: Number(sc.doppioni) || 0, senza_nome: Number(sc.senza_nome) || 0 } };
  }
  function riceviControlloFc(msg) {
    var att = sLeggi("uff_fc_atteso"), d = msg.dati || {};
    sScrivi("uff_fc_atteso", null);
    if (!att || d.richiesta !== att.id || String(d.nl || "") !== att.nl || Date.now() - Number(att.at || 0) > 10 * 60000) { log("PASSAGGIO", { tipo: "controllo-fc-esito", esito: "non richiesto da questa scheda" }); return; }
    var R = { nl: att.nl, lega: nomeLegaFc(att.nl), quando: Date.now(), account: d.account || "", regola: d.regola || null, squadre: d.squadre || [], log: d.log || [], giornataPrecedente: d.giornataPrecedente || null,
      giornataRichiesta: /^\d{1,2}$/.test(String(d.giornataRichiesta || "")) ? String(d.giornataRichiesta) : "", errori: d.errori || [], logRidotto: d.logRidotto || 0,
      competizioni: fvmFcCompetizioniRicevute(d.competizioni), audio: d.audio && typeof d.audio === "object" ? { fermata: !!d.audio.fermata, media: Number(d.audio.media) || 0, iframe: Number(d.audio.iframe) || 0 } : null, // PROVA15
      giornate: (Array.isArray(d.giornate) ? d.giornate : []).map(String).filter(function (g) { return /^\d{1,2}$/.test(g); }).slice(0, 60) }; // PROVA13 B3
    R.stato = fvmStatoFc({ squadre: R.squadre, consegnate: d.consegnate || [], nonConsegnate: d.nonConsegnate || { letto: false, squadre: [] }, log: R.log, nascoste: !!(R.regola && /^si/i.test(R.regola.nascoste || "")) });
    // PROVA13 B5: gestore/amministratore SOLO se la pagina Info mostra davvero il nome del gestore; senza quel dato il ruolo resta
    // non determinato (prima: «non risulti gestore» anche quando il nome del gestore non era stato letto = permesso attribuito a caso)
    R.gestore = R.regola && R.account && R.regola.gestore ? (R.regola.gestore === R.account || String(R.regola.altriAdmin || "").split(/[,;]\s*/).indexOf(R.account) >= 0) : null;
    scrivi("uff_fc_" + att.nl, R);
    // S5: account delle squadre Fantaclub (per lo storico personale: solo come dato letto dalla pagina Squadre)
    var acc = {}; R.squadre.forEach(function (s) { if (s.account && s.account !== FVM_ND) acc[s.squadra] = s.account; });
    scrivi("fc_squadre_account_" + att.nl, { at: Date.now(), account: acc, mio: R.account || "" });
    var note = leggi("fc_leghe_note", []) || []; if (note.indexOf(att.nl) < 0) { note.push(att.nl); scrivi("fc_leghe_note", note.slice(-12)); }
    log("CONSEGNE UFFICIALI", { piattaforma: "fantaclub", lega: att.nl, squadre: R.squadre.length, errori: R.errori.length, giornata: R.giornataRichiesta || "corrente",
      competizioni: R.competizioni ? { esito: R.competizioni.esito, voci: R.competizioni.voci.length, pagine: R.competizioni.voci.map(function (v) { return v.pagina; }).filter(function (p, i, a) { return a.indexOf(p) === i; }).join(","),
        tipologie: R.competizioni.voci.filter(function (v) { return v.tipo; }).length, scartati: R.competizioni.scartati, errore: R.competizioni.errore || "" } : "non lette", audio: R.audio || "non indicato" }); // PROVA15 diagnosi
    sScrivi("apri", "ufficiale");
  }
  // ---- schermata CONSEGNE UFFICIALI (Leghe Fantacalcio e Fantaclub), separata dallo storico personale
  var ETICHETTE_UFF = { presente: ["🟢", "Formazione presente", "#4ade80"], assente: ["🔴", "Senza formazione", "#f87171"],
    recuperata: ["🔴", "Recuperata dal Server", "#f87171"], tavolino: ["🔴", "Sconfitta a tavolino", "#f87171"], assente_provvisorio: ["🟠", "Nessuna formazione · giornata da calcolare", "#fbbf24"],
    in_attesa: ["⏳", "In attesa / non ancora visibile", "#fbbf24"], futura: ["·", "Giornata futura", "#7d8799"], non_verificabile: ["❔", FVM_ND, "#aab3c2"],
    consegnata: ["🟢", "Consegnata", "#4ade80"], non_consegnata: ["🔴", "Senza formazione (elenco ufficiale)", "#f87171"] };
  var FASI_UFF = { calcolata: "giornata calcolata", da_calcolare: "giornata passata, non ancora calcolata", consegna_aperta: "consegna aperta (prima della scadenza)", in_corso: "giornata in corso", futura: "giornata futura", nessuna_giornata: "competizione senza giornate", sconosciuta: FVM_ND };
  function apriUfficiale() {
    monta();
    if (!radice) return;
    chiudiPannello();
    pannelloPrincipale = false;
    pannello = document.createElement("div");
    pannello.className = "ov";
    radice.appendChild(pannello);
    disegnaUfficiale();
  }
  function rigaUff(r) {
    var e = ETICHETTE_UFF[r.stato] || ETICHETTE_UFF.non_verificabile;
    // Classic: scritta ufficiale del sito (inviata via web/app, modificata dall'admin, recuperata, tavolino, non inserita)
    var testo = r.statoUfficiale ? (r.stato === "assente" ? r.statoUfficiale + " (giornata calcolata)" : r.statoUfficiale) : e[1];
    var det = [r.ora && r.ora !== FVM_ND ? (r.stato === "presente" || r.stato === "recuperata" ? "salvata " : "") + r.ora : "", r.invisibile ? "invisibile" : "", r.modulo ? "modulo " + String(r.modulo).split("").join("-") : "", r.canale && r.canale !== FVM_ND ? "tramite " + r.canale : "", r.invii > 1 ? r.invii + " invii nel log" : "", r.account ? "account " + r.account : (r.allenatori && r.allenatori.length ? "allenatore " + r.allenatori.join(", ") : "")].filter(Boolean).join(" · ");
    // in rosso tenue: recuperi dal server, sconfitte a tavolino, formazioni non inserite (giornata calcolata)
    return "<div style='margin-top:8px;font-size:14px" + (r.evidenzia ? ";background:rgba(248,113,113,0.12);border-radius:8px;padding:4px 6px" : "") + "'><span style='color:" + e[2] + ";font-weight:800'>" + e[0] + " " + esc(r.squadra) + "</span><div class='mu' style='font-size:12px'>" + esc(testo) + (det ? " · " + esc(det) : "") + (r.nota ? " · " + esc(r.nota) : "") + (!r.statoUfficiale && r.provenienza && /recuperata/.test(r.provenienza) ? "<br>provenienza: " + esc(r.provenienza) : "") + "</div></div>";
  }
  // RC3 (come Android RiepilogoSquadre): riepilogo colorato per stato sempre visibile, squadre dietro MOSTRA SQUADRE
  function listaUff(righe, k) {
    righe = righe || [];
    if (!righe.length) return "";
    var rie = riepilogoStati(righe);
    return "<div style='margin-top:8px;font-size:14px;font-weight:800'>" + rie.map(function (x) { return "<span style='color:" + x.colore + "'>" + x.simbolo + " " + x.n + " " + esc(x.etichetta) + "</span>"; }).join(" · ") + "</div>" +
      "<button class='bt' style='margin-top:6px;padding:8px' data-a='uff_det' data-c='" + k + "'>MOSTRA SQUADRE ▾</button><div id='fvm-uffdet-" + k + "' class='panchinaDet'>" + righe.map(rigaUff).join("") + "</div>";
  }
  function selUff(id, voci, scelto) { return "<select id='" + id + "' style='width:100%;margin-top:6px;padding:10px;border-radius:10px;background:#0a1524;color:#fff;border:1px solid #2a4370;font-size:15px'>" + voci.map(function (v) { return "<option value='" + esc(v[0]) + "'" + (String(v[0]) === String(scelto) ? " selected" : "") + ">" + esc(v[1]) + "</option>"; }).join("") + "</select>"; }
  function disegnaUfficiale() {
    if (!pannello) return;
    var sel = sLeggi("uff_sel") || {}, leghe = legheControllabili(), slug = sel.slug || (legaCorrente() && legaCorrente() !== FLE_SLUG ? legaCorrente() : (leghe[0] || {}).slug);
    var R = slug ? leggi("uff_leghe_" + slug, null) : null;
    if (slug && !leghe.some(function (l) { return l.slug === slug; })) leghe.push({ slug: slug, nome: R && R.lega ? R.lega : nomeLega(slug) });
    var h = "<div class='cd'><button class='x' data-a='indietro'>INDIETRO</button><div class='t1'>CONSEGNE UFFICIALI</div><div class='mu' style='margin-top:6px'>Registri ufficiali delle piattaforme, anche per consegne fatte fuori da FVM o prima della sua installazione. Sono separati dallo storico personale di FVM. Solo lettura, con i permessi del tuo account. Nessun calcolo di jolly o penalità.</div></div>";
    // 1.3.5-RC: UNA piattaforma per volta = quella attiva. L'altra piattaforma solo come VISTA SEPARATA, richiesta esplicitamente dall'Area
    // Admin sbloccata (CONSEGNE DELL'ALTRA PIATTAFORMA), con l'intestazione della piattaforma e i permessi dell'account di quel sito.
    var pfAtt = piattaformaScelta(), altraV = !!sLeggi("uff_altra") && adminSbloccato(), pfU = altraV ? (pfAtt === "fantaclub" ? "fantacalcio" : "fantaclub") : pfAtt;
    if (sLeggi("uff_altra") && !altraV) sScrivi("uff_altra", null);
    h += "<div class='mu' style='margin:0 2px 8px'>" + (altraV ? "VISTA SEPARATA: consegne di " + (pfU === "fantaclub" ? "FANTACLUB" : "LEGHE FANTACALCIO") + " (piattaforma attiva: " + (pfAtt === "fantaclub" ? "Fantaclub" : "Leghe Fantacalcio") + ")."
      : "Piattaforma attiva: " + (pfAtt === "fantaclub" ? "FANTACLUB" : "LEGHE FANTACALCIO") + ". Le consegne dell'altra piattaforma si vedono solo dall'Area Admin, in una vista separata.") + "</div>";
    if (pfU === "fantacalcio") {
    // --- Leghe Fantacalcio
    h += "<div class='cd'><div class='lb'>LEGHE FANTACALCIO</div>" + selUff("fvm-uff-lega", leghe.map(function (l) { return [l.slug, l.nome]; }), slug);
    if (R && R.competizioni && R.competizioni.length) h += selUff("fvm-uff-comp", R.competizioni.map(function (c) { return [c.id, c.nome]; }), R.comp);
    if (R && R.turni && R.turni.length) h += selUff("fvm-uff-turno", R.turni.map(function (t) { return [t.g, t.g + "ª giornata (Serie A " + t.sa + ")"]; }), R.turno);
    h += "<button class='bt oro' data-a='uff_leghe'>" + (R ? "AGGIORNA" : "CONTROLLA") + "</button>";
    if (R) {
      var S = R.stato || {}, reg = R.regola || leggi("uff_regola_" + slug, null);
      h += "<div style='margin-top:10px;font-weight:800'>" + esc(R.lega) + (R.competizione ? " · " + esc(R.competizione) : "") + (S.giornataLega ? " · " + S.giornataLega + "ª giornata (Serie A " + S.giornataSerieA + ")" : "") + "</div>" +
        "<div class='mu'>Stato della giornata: " + esc(FASI_UFF[S.fase] || FVM_ND) + (S.inizio ? " · inizio " + esc(S.inizio) : "") + "</div>" +
        "<div class='mu'>Controllo: " + esc(new Date(R.quando).toLocaleString("it-IT")) + " · strumenti admin nella pagina: " + (R.admin ? "sì (corona)" : "non rilevati") + "</div>" +
        "<div class='mu'>Regola per formazione non schierata (Opzioni di Lega → Calcolo): <b>" + esc(fvmTestoRegola(reg)) + "</b> · è la regola configurata, non un esito</div>";
      if (R.nota) h += "<div class='mu' style='color:#fbbf24'>" + esc(R.nota) + "</div>";
      if (R.perPartita) h += "<div class='mu'>Letta partita per partita (account non amministratore della lega): solo i dati visibili al tuo account.</div>";
      (R.errori || []).forEach(function (e) { h += "<div style='color:#f87171;font-size:13px'>" + esc(e) + "</div>"; });
      var cn = S.conta || {};
      if (S.dettaglio) h += "<div class='mu' style='margin-top:4px'>Formazione non inserita (" + (cn.assente || 0) + ") · Recuperata dal Server (" + (cn.recuperata || 0) + ") · Sconfitta a tavolino (" + (cn.tavolino || 0) + ")</div>";
      h += listaUff(S.righe, "leghe"); // RC3 (come Android): riepilogo colorato, squadre dietro MOSTRA SQUADRE
      h += "<div class='mu' style='font-size:11px;margin-top:8px'>" + (S.dettaglio
        ? "Orari: ora italiana (dati ufficiali in UTC convertiti con Europe/Rome). Stato di ogni formazione come indicato da Leghe Fantacalcio. In rosso tenue: recuperi dal server, formazioni non inserite (giornata calcolata), sconfitte a tavolino. Nessun calcolo di jolly, penalità o regolamento."
        : "Orari: ora italiana (dati ufficiali in UTC convertiti con Europe/Rome). Canale di invio, recupero dal server e interventi admin: " + FVM_ND + " (i dati letti non li indicano)." + (S.tipoGioco === "mantra" ? " Lega Mantra: stati dettagliati rimandati a un prossimo aggiornamento." : "")) + "</div>";
      if (S.righe && S.righe.length) h += "<button class='bt' style='border-color:#22c55e;color:#4ade80' data-a='uff_leghe_wa'>CONDIVIDI SU WHATSAPP</button>";
    }
    h += "</div>";
    } // 1.3.5-RC: fine della sezione Leghe Fantacalcio
    if (pfU === "fantaclub") {
    // --- Fantaclub
    var lfc = legheFcControllabili(), nl = sel.nl || ((legaFc() || {}).nl || "").toLowerCase() || (lfc[0] || {}).nl, F = nl ? leggi("uff_fc_" + nl, null) : null;
    if (nl && !lfc.some(function (l) { return l.nl === nl; })) lfc.push({ nl: nl, nome: F && F.lega ? F.lega : String(nl).toUpperCase() });
    // PROVA13 B3: LEGA → (COMPETIZIONE) → GIORNATA con le opzioni REALI lette dal sito (selettore «giornata» di Formazioni passate);
    // finche la lega non e stata controllata una volta resta il campo numerico di prima
    var giornateFc = F && Array.isArray(F.giornate) ? F.giornate : [];
    // PROVA15: LEGA → COMPETIZIONE (motore generico: pagina «Tornei» del sito, nome + tipologia ufficiale) → GIORNATA; con la consegna
    // unica la scelta NON crea consegne, stati o invii separati
    var CF = F ? fvmFcCompetizioni(F.regola, F.competizioni, sel.compFc || "") : null;
    h += "<div class='cd'><div class='lb'>FANTACLUB</div>" + selUff("fvm-uff-fc", lfc.map(function (l) { return [l.nl, l.nome]; }), nl) +
      (CF && CF.voci.length ? selUff("fvm-uff-cfc", [["", CF.unica ? "Tutte le competizioni (consegna unica)" : "Tutte le competizioni"]].concat(CF.voci.map(function (v) { return [v.chiave, v.nome.toUpperCase() + " · " + fvmFcTipologia(v)]; })), sel.compFc || "") : "") +
      (giornateFc.length ? selUff("fvm-uff-gfc", [["", "Giornata corrente (consegne in corso)"]].concat(giornateFc.map(function (g) { return [g, fvmFcEtichettaGiornata(g)]; })), sel.giornataFc || "")
        : "<input id='fvm-uff-gfc' inputmode='numeric' placeholder='Giornata precedente (facoltativa, numero del sito)' value='" + esc(sel.giornataFc || "") + "' style='width:100%;margin-top:6px;padding:10px;border-radius:10px;background:#0a1524;color:#fff;border:1px solid #2a4370;font-size:15px'>") +
      "<button class='bt oro' data-a='uff_fc'>" + (F ? "AGGIORNA" : "CONTROLLA") + " SU FANTACLUB</button>";
    if (F) {
      var SF = F.stato || {}, rg = F.regola || {};
      // PROVA14 (punto 4): l'intestazione dice la giornata del RISULTATO mostrato (prima: sempre la giornata corrente, anche con
      // una giornata passata scelta); avvisi se la scelta attuale o la pagina del sito non corrispondono alla richiesta
      var AG = fvmFcAllineamentoGiornata(sel.giornataFc || "", F);
      h += "<div style='margin-top:10px;font-weight:800'>" + esc(F.lega) + " · " + esc(AG.titolo) + " · numerazione del sito</div>";
      AG.avvisi.forEach(function (t) { h += "<div style='color:#fbbf24;font-size:13px;font-weight:800;margin-top:4px'>⚠️ " + esc(t) + "</div>"; });
      h += "<div class='mu'>Controllo: " + esc(new Date(F.quando).toLocaleString("it-IT")) + (F.account ? " · account collegato: " + esc(F.account) : "") + (F.gestore === true ? " · gestore o amministratore della lega (pagina Info)" : F.gestore === false ? " · non risulti gestore (pagina Info)" : " · ruolo nella lega (gestore o partecipante): non indicato nelle pagine lette") + "</div>" +
        "<div class='mu'>" + esc(CF.testo) + "</div>" + (CF.principale ? "<div class='mu'>" + esc(CF.principale) + "</div>" : "") + (CF.nota ? "<div class='mu'>" + esc(CF.nota) + "</div>" : "") +
        "<div class='mu'>Regole (Info → Consegna e sostituzioni): mancata consegna: <b>" + esc(rg.mancataConsegna || FVM_ND) + "</b> · formazioni nascoste: " + esc(rg.nascoste || FVM_ND) + " · scadenza: " + esc(rg.scadenza || FVM_ND) + (rg.fonte ? " · fonte: " + esc(rg.fonte) : "") + "</div>";
      (F.errori || []).forEach(function (e) { h += "<div style='color:#f87171;font-size:13px'>" + esc(e) + "</div>"; });
      // giornata passata scelta: PRIMA il suo elenco (e quello richiesto), poi la giornata corrente con il suo titolo
      if (AG.richiesta) {
        var GP = F.giornataPrecedente;
        h += "<div class='lb' style='margin-top:10px'>GIORNATA " + esc(AG.richiesta) + " (GIORNATA PASSATA SCELTA)</div>";
        if (GP) {
          (GP.consegnate || []).forEach(function (c) { h += rigaUff({ squadra: c.squadra, stato: "consegnata", ora: c.ora, account: c.account }); });
          h += "<div class='mu' style='font-size:12px'>Squadre elencate nella pagina «Formazioni» di quella giornata, con l'orario mostrato dal sito. Le squadre non elencate: " + FVM_ND + ". Se l'elenco comprenda anche formazioni recuperate automaticamente non è ancora verificato (serve una giornata con una squadra senza consegna).</div>";
        } else h += "<div class='mu' style='font-size:12px'>Elenco della giornata scelta non letto: " + FVM_ND + ".</div>";
        h += "<div class='lb' style='margin-top:10px'>GIORNATA CORRENTE " + esc(SF.giornata || "?") + " (CONSEGNE IN CORSO)</div>";
      }
      h += listaUff(SF.righe, "fc"); // RC3 (come Android): riepilogo colorato, squadre dietro MOSTRA SQUADRE
      // PROVA13 B2: «senza formazione» resta tale anche se la regola della lega usera la formazione precedente (recupero ≠ consegna)
      if (fvmFcRecuperoAutomatico(rg) && (SF.righe || []).some(function (r) { return r.stato === "non_consegnata"; }))
        h += "<div class='mu' style='font-size:12px;color:#fbbf24'>Regola della lega: alle squadre senza formazione Fantaclub assegna l'ultima formazione consegnata in precedenza. È un recupero automatico, NON una consegna: restano «senza formazione».</div>";
      if (F.log && F.log.length) h += "<div class='mu' style='font-size:12px;margin-top:6px'>Log consegne: " + F.log.length + " invii letti" + (F.logRidotto ? " (su " + F.logRidotto + ")" : "") + "; l'ultimo per squadra vale come consegna.</div>";
      // PROVA13 B4: legenda di FVM (fonte di ogni stato); la legenda ufficiale di Fantaclub non e presente nelle pagine lette
      h += "<div class='mu' style='font-size:11px;margin-top:8px'>🟢 consegnata = presente in «Formazioni consegnate» (orario del sito) · 🔴 senza formazione = elenco ufficiale «Report non consegnate» · ❔ non verificabile = dato non mostrato dal sito (es. formazioni nascoste fino alla scadenza). Legenda ufficiale di Fantaclub: non presente nelle pagine lette.</div>";
      if (SF.righe && SF.righe.length) h += "<button class='bt' style='border-color:#22c55e;color:#4ade80' data-a='uff_fc_wa'>CONDIVIDI SU WHATSAPP</button>";
    }
    h += "</div>";
    } // 1.3.5-RC: fine della sezione Fantaclub
    // RC3 (come Android): vista separata dell'altra piattaforma ultima, staccata dal pulsante WhatsApp con un divisore
    if (altraV || adminSbloccato()) h += "<div style='border-top:1px solid #1f3354;margin-top:18px'></div>";
    if (altraV) h += "<button class='bt' data-a='uff_propria'>TORNA ALLE CONSEGNE DELLA PIATTAFORMA ATTIVA</button>";
    else if (adminSbloccato()) h += "<button class='bt' data-a='uff_altra'>CONSEGNE DELL'ALTRA PIATTAFORMA (vista separata)</button>";
    h += "<button class='bt' data-a='indietro'>INDIETRO</button>";
    pannello.innerHTML = h;
    var val = function (id) { var e = pannello.querySelector("#" + id); return e ? e.value : ""; };
    Array.prototype.forEach.call(pannello.querySelectorAll("select"), function (s) {
      s.addEventListener("change", function () {
        var v = sLeggi("uff_sel") || {};
        if (s.id === "fvm-uff-lega") { v.slug = s.value; v.comp = 0; v.turno = 0; }
        if (s.id === "fvm-uff-comp") { v.comp = Number(s.value) || 0; v.turno = 0; }
        if (s.id === "fvm-uff-turno") v.turno = Number(s.value) || 0;
        if (s.id === "fvm-uff-fc") { v.nl = s.value; v.giornataFc = ""; v.compFc = ""; } // PROVA14: nessuna scelta trascinata in un'altra lega
        if (s.id === "fvm-uff-gfc") v.giornataFc = s.value; // PROVA14: la scelta e ricordata subito (avviso se il risultato e di un'altra richiesta)
        if (s.id === "fvm-uff-cfc") v.compFc = s.value;
        sScrivi("uff_sel", v);
        if (s.id === "fvm-uff-lega" || s.id === "fvm-uff-fc" || s.id === "fvm-uff-gfc" || s.id === "fvm-uff-cfc") disegnaUfficiale();
      });
    });
    Array.prototype.forEach.call(pannello.querySelectorAll("[data-a]"), function (el) {
      el.addEventListener("click", function (ev) {
        ev.stopPropagation();
        var a = el.getAttribute("data-a");
        if (a === "indietro") { sScrivi("uff_altra", null); apriPannello(); }
        // 1.3.5-RC: vista separata dell'altra piattaforma, solo con l'Area Admin sbloccata (richiesta esplicita, registrata in diagnosi)
        if (a === "uff_altra") { if (adminSbloccato()) { sScrivi("uff_altra", true); log("CONSEGNE UFFICIALI", { vista: "altra piattaforma", attiva: piattaformaScelta() }); } disegnaUfficiale(); return; }
        if (a === "uff_propria") { sScrivi("uff_altra", null); disegnaUfficiale(); return; }
        if (a === "uff_det") { var ud = pannello.querySelector("#fvm-uffdet-" + el.getAttribute("data-c")); if (ud) { ud.classList.toggle("aperta"); el.textContent = ud.classList.contains("aperta") ? "NASCONDI SQUADRE ▴" : "MOSTRA SQUADRE ▾"; } return; }
        if (a === "uff_leghe") avviaControlloLega(val("fvm-uff-lega"), val("fvm-uff-comp") || (sLeggi("uff_sel") || {}).comp, val("fvm-uff-turno") || 0);
        if (a === "uff_fc") avviaControlloFcUff(val("fvm-uff-fc"), String(val("fvm-uff-gfc") || "").trim());
        if (a === "uff_leghe_wa") { var Rw = leggi("uff_leghe_" + val("fvm-uff-lega"), null); if (Rw) condividiTesto(fvmReportLeghe({ lega: Rw.lega, competizione: Rw.competizione, stato: Rw.stato, regola: Rw.regola || leggi("uff_regola_" + Rw.slug, null), quando: new Date(Rw.quando).toLocaleString("it-IT") }) +
            (Rw.perPartita ? "\nℹ️ Letta partita per partita (account non amministratore della lega): solo i dati visibili a questo account." : "")); }
        if (a === "uff_fc_wa") { var Fw = leggi("uff_fc_" + val("fvm-uff-fc"), null); if (Fw) condividiTesto(fvmReportFc({ lega: Fw.lega, stato: Fw.stato, regola: Fw.regola, quando: new Date(Fw.quando).toLocaleString("it-IT"),
            giornataRichiesta: Fw.giornataRichiesta || "", giornataPrecedente: Fw.giornataPrecedente || null, competizioni: Fw.competizioni || null, competizione: (sLeggi("uff_sel") || {}).compFc || "" })); }
      });
    });
  }

  // ---------------------------------------------------------------- area admin
  // PROVA14 (sicurezza): lo sblocco dell'Area Admin vale SOLO nel contesto in cui e stato fatto: stessa scheda di Safari
  // (memoria di sessione), stessa piattaforma, stessa lega FLE, stessa lega di lavoro, stessa lega Fantaclub, stessa epoca
  // dell'account, al massimo 60 minuti. Cambia uno di questi = Area Admin di nuovo bloccata (serve il codice). Il vecchio
  // sblocco permanente (admin = true, versioni precedenti) NON vale piu e non viene cancellato. Il codice apre solo le funzioni
  // di FVM: non da permessi sui siti (restano quelli dell'account collegato) e non identifica la persona.
  var ADMIN_MAX_MS = 60 * 60000;
  // 1.3.5-RC: anche l'identità dell'account (impronta) della scheda: account diverso o non riconosciuto = contesto diverso
  function contestoAdmin() { return [piattaformaScelta(), leggi("lega_sorgente", "") || "", legaLavoro() || "", ((legaFc() || {}).nl || "").toLowerCase(), epocaAccount(), identitaAttuale() || "nessuna"].join("|"); }
  function adminSbloccato() {
    var a = sLeggi("admin_sessione");
    if (!a) return false;
    var motivo = !(Date.now() - Number(a.at || 0) <= ADMIN_MAX_MS) ? "scaduto (60 minuti)" : a.contesto !== contestoAdmin() ? "contesto cambiato (piattaforma, lega o account)" : "";
    if (!motivo) return true;
    sScrivi("admin_sessione", null);
    log("ADMIN", { esito: "bloccata di nuovo", motivo: motivo });
    return false;
  }
  function dataFle(s) {
    var m = String(s || "").match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/);
    if (!m) return null;
    return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]));
  }
  // Controllo FLE dell'Area Admin (come Android 1.3.0): VALIDO solo se completo (giornata letta, tutte le competizioni
  // lette, nessun errore). Solo un controllo valido sostituisce "admin_fle"; gli altri restano in "admin_fle_tentativo".
  function fleControlloValido(r) {
    if (!r || !(Number(r.mday) > 0)) return false;
    var comps = Array.isArray(r.comps) ? r.comps : [];
    if (!comps.length || (r.errors || []).length) return false;
    if (r.completo === false) return false;
    return comps.every(function (c) { return Array.isArray(c.lineups); });
  }
  // ultimo controllo valido e ultimo tentativo non valido. Migrazione: un risultato delle versioni precedenti non valido
  // e mostrato come "ultimo tentativo" (la chiave "admin_fle" non viene cancellata: la sostituisce il primo controllo valido)
  // PROVA15 (sicurezza): contesto di un controllo FLE = epoca dell'account + lega FLE (squadra) dell'accesso che l'ha letto
  // 1.3.5-RC: contesto = IDENTITÀ dell'account (impronta) + lega FLE; senza identità valida nessun contesto (nessun dato FLE mostrato)
  function contestoFle() { var id = identitaAttuale(); return id ? id + "|" + (leggi("lega_sorgente", "") || "") : ""; }
  // ruolo FLE dimostrato dal sito in un controllo: lettura riservata agli amministratori accettata (competizioni lette per intero,
  // nessuna letta partita per partita) = amministratore; anche una sola competizione letta partita per partita = partecipante
  function ruoloFleDaComps(comps) {
    comps = Array.isArray(comps) ? comps : [];
    if (comps.some(function (c) { return c && c.partite; })) return "partecipante";
    return comps.some(function (c) { return c && Array.isArray(c.lineups); }) ? "amministratore" : "non_verificato";
  }
  function ruoloFleDi(r) { return r && (r.ruoloFle === "amministratore" || r.ruoloFle === "partecipante") ? r.ruoloFle : "non_verificato"; }
  // ADM1: il ruolo FLE NON decide piu cosa si vede nell'Area Admin (basta il codice Admin FVM): indica solo COME e stato letto
  function testoRuoloFle(ruolo, DF) {
    var n = DF && DF.nascosti || 0, altri = n ? " (" + n + " controlli di altri accessi o versioni precedenti non mostrati, non cancellati)" : "";
    return ruolo === "amministratore" ? "Lettura FLE completa: il sito concede a questo account la lettura riservata agli amministratori FLE (ultimo controllo di questo accesso)." + altri
      : ruolo === "partecipante" ? "Lettura FLE partita per partita: il sito non concede a questo account la lettura riservata agli amministratori FLE. Riepilogo con i soli dati visibili al tuo account: ⚪ = non verificabile, mai mancante." + altri
      : "Nessun controllo FLE di questo accesso: premi CONTROLLA SU FLE (sola lettura)." + altri;
  }
  function datiFle() {
    var v = leggi("admin_fle", null), t = leggi("admin_fle_tentativo", null), ms = function (x) { return x ? Date.parse(x.at || "") || 0 : 0; };
    // PROVA15: solo i controlli di QUESTO accesso e contesto; gli altri restano in memoria ma non si mostrano
    var cx = contestoFle(), nascosti = 0;
    if (v && (!cx || v.fvmContesto !== cx)) { v = null; nascosti++; } // 1.3.5-RC: senza identita nessun risultato
    if (t && (!cx || t.fvmContesto !== cx)) { t = null; nascosti++; }
    if (v && !fleControlloValido(v)) { if (!t || ms(v) > ms(t)) t = v; v = null; }
    return { valido: v, tentativo: t, mostrato: v || t, recente: v && t && ms(t) > ms(v) ? t : null, ultimo: Math.max(ms(v), ms(t)), nascosti: nascosti };
  }
  // Stati per squadra: lu = formazione presente su FLE · gioca senza lu = competizione LETTA, nessuna formazione ·
  // nonLetta = competizione NON letta (errore): "non verificata", mai "non schierata" · gioca=false = non gioca.
  // Competizioni senza turno nella giornata (fuori) non rendono "in gioco" le loro squadre.
  // PROVA5: competizione letta PARTITA PER PARTITA: squadre senza dati prima dell'inizio o di partite non lette -> motivo
  // del DA VERIFICARE (mai "mancante"); vuoto per la lettura cumulativa e per i controlli delle versioni precedenti
  function motiviNonVisibiliFle(c) {
    var m = {};
    if (!c || !c.partite) return m;
    (c.nascoste || []).forEach(function (t) { m[Number(t)] = "formazione non visibile al tuo account prima dell'inizio"; });
    (c.partiteNonLette || []).forEach(function (t) { m[Number(t)] = "partita non letta"; });
    return m;
  }
  // A1: squadra in gioco con la sola formazione "Recuperata dal Server" (nessuna consegna del partecipante)
  function fleRecuperata(x) { return !!(x && x.info && x.info.gioca && !x.info.lu && x.info.rec); }
  function riepilogoFle(r) {
    if (!r) return null;
    var perTid = {}, classifiche = [];
    (r.comps || []).forEach(function (c) {
      // 1.3.5: Ranking e competizioni di natura da verificare esclusi SEMPRE, anche nei controlli salvati dalla 1.3.4
      var nat = c.natura || naturaCompetizione(c);
      if (nat !== "obbligo") { classifiche.push({ id: Number(c.id), nome: String(c.name || c.id), natura: nat }); return; }
      if (c.fuori) return;
      var letta = Array.isArray(c.lineups);
      // non letta solo se marcata "errore"; nei risultati delle versioni precedenti lineups null = competizione senza turno
      if (!letta && !c.errore) return;
      // 1.3.5 (collaudo XR): calendario incerto (turno senza partite) o squadra senza avversario: "non verificata", mai mancante
      var soli = (c.soli || []).map(Number), nv = motiviNonVisibiliFle(c);
      (c.tmids || []).forEach(function (t) {
        var k = String(t), x = perTid[k], dubbio = !letta || !!c.calIncerto || soli.indexOf(Number(t)) >= 0 || !!nv[Number(t)];
        if (!x) { perTid[k] = { gioca: true, lu: null, nonLetta: dubbio }; if (letta && dubbio) perTid[k].incerta = true; if (letta && nv[Number(t)]) perTid[k].motivoNV = nv[Number(t)]; }
        else if (dubbio && !x.lu) { x.nonLetta = true; if (letta) x.incerta = true; if (letta && nv[Number(t)] && !x.motivoNV) x.motivoNV = nv[Number(t)]; }
      });
      // 1.3.5: "Sconfitta a tavolino" (act 3, stato ufficiale) non e una formazione presente
      // A1: "Recuperata dal Server" (act 4) = formazione NON consegnata dal partecipante: mai contata tra le consegnate
      // (stato RECUPERATA, rosso, conteggio separato); una formazione consegnata in un'altra competizione resta la consegna
      if (letta) c.lineups.forEach(function (l) {
        if (l.act === 3) return;
        var k = String(l.tid);
        if (l.act === 4) { if (!(perTid[k] && perTid[k].lu)) perTid[k] = { gioca: true, lu: null, rec: l, nonLetta: false }; return; }
        perTid[k] = { gioca: true, lu: l, nonLetta: false };
      });
    });
    var leghe = {};
    SQUADRE.forEach(function (t) {
      var x = perTid[String(t[2])] || { gioca: false, lu: null, nonLetta: false };
      (leghe[t[0]] = leghe[t[0]] || []).push({ squadra: t[1], info: x });
    });
    function rango(x) { return fleRecuperata(x) || (x.info.gioca && !x.info.lu && !x.info.nonLetta) ? 0 : x.info.nonLetta && !x.info.lu ? 1 : x.info.lu ? 2 : 3; }
    var lista = Object.keys(leghe).sort().map(function (L) {
      return { lega: L, squadre: leghe[L].sort(function (a, b) { return rango(a) - rango(b) || String(a.squadra).localeCompare(String(b.squadra)); }) };
    });
    var tutte = [].concat.apply([], lista.map(function (L) { return L.squadre; }));
    var giocano = tutte.filter(function (x) { return x.info.gioca; }).length;
    var nonVerificate = tutte.filter(function (x) { return x.info.gioca && !x.info.lu && !fleRecuperata(x) && x.info.nonLetta; }).length;
    return { mday: r.mday, inizio: inizioGiornataFle(r.mstr), lista: lista, giocano: giocano, consegnate: tutte.filter(function (x) { return x.info.lu; }).length,
      recuperate: tutte.filter(fleRecuperata).length,
      nonVerificate: nonVerificate, mancanti: tutte.filter(function (x) { return x.info.gioca && !x.info.lu && !fleRecuperata(x) && !x.info.nonLetta; }).length, lette: giocano - nonVerificate,
      completo: fleControlloValido(r), errori: r.errors || [], at: r.at, classifiche: classifiche };
  }
  // 1.3.5: nomi SOLO delle squadre iscritte su FLE che non sono nella tabella delle 80 (una lettura, solo se servono;
  // mai le squadre-lega note); un errore non cambia l'esito del controllo
  function nomiSconosciute(r) {
    var tab = SQUADRE.map(function (t) { return Number(t[2]); }), extra = [];
    (r.iscrittePerComp || []).forEach(function (c) {
      if (!c.tmids.some(function (t) { return tab.indexOf(t) >= 0; })) return;
      c.tmids.forEach(function (t) { if (tab.indexOf(t) < 0 && squadreLegaFle().indexOf(t) < 0 && extra.indexOf(t) < 0) extra.push(t); });
    });
    if (!extra.length) return Promise.resolve();
    // al massimo 8 s: i nomi sono solo un aiuto, il controllo non deve mai scadere per loro
    var limiteNomi = new Promise(function (ok, no) { setTimeout(function () { no(new Error("tempo scaduto")); }, 8000); });
    return Promise.race([getApi("/onboarding/v1/invitation/participants?pageNumber=1&pageSize=1000", true), limiteNomi]).then(function (j) {
      var nomi = {};
      (Array.isArray(j) ? j : []).forEach(function (x) { if (x && extra.indexOf(Number(x.teamId)) >= 0) nomi[Number(x.teamId)] = String(x.teamName || "").slice(0, 60); });
      r.nomiFle = nomi;
    }).catch(function (e) { r.nomiFle = {}; log("FLE CHECK STEP", { stage: "partecipanti", esito: "errore", http: e && e.http || 0 }); });
  }
  // 1.3.5: squadre-lega FLE (una per lega, "sourceLeagueFleTid" della tabella Android 1.3.1): partecipano al Ranking di
  // Lega, non sono squadre dei giocatori. TOTA ITALIA: campo vuoto nella tabella, come su Android (non aggiunto).
  function squadreLegaFle() { return [7983281, 7983232, 7983133, 7983387, 7983483, 7983326, 7984246]; }
  // 1.3.5 CONTROLLO TABELLA (come Android 1.3.1 controlloTabella): squadre della tabella ISCRITTE alle competizioni FLE
  // attive, che NON e la consegna. Confronto solo tra squadre partecipanti:
  //  - competizione TRA SQUADRE-LEGA (Ranking di Lega): nessuna squadra della tabella e almeno meta degli identificativi
  //    gia noti come squadre-lega -> esclusa, riga informativa;
  //  - ogni altra competizione: i suoi identificativi sconosciuti sono differenze reali (mai nascoste);
  //  - le squadre-lega note non sono mai "squadre sconosciute". La tabella non viene MAI corretta in automatico.
  // I controlli salvati prima della 1.3.5 (senza iscrittePerComp) non sono confrontabili: "premi AGGIORNA".
  function controlloTabella(r) {
    if (!r || !Array.isArray(r.iscrittePerComp) || !r.iscrittePerComp.length) return { disponibile: false };
    var tab = SQUADRE.map(function (t) { return Number(t[2]); }), leghe = squadreLegaFle(), isc = [], extra = [], visti = {}, compLeghe = [], nomi = r.nomiFle || {};
    r.iscrittePerComp.forEach(function (c) {
      var ids = (c && Array.isArray(c.tmids) ? c.tmids : []).map(Number).filter(Boolean);
      if (!ids.length) return;
      var inTab = ids.filter(function (x) { return tab.indexOf(x) >= 0; }).length, noteLeghe = ids.filter(function (x) { return leghe.indexOf(x) >= 0; }).length;
      if (!inTab && noteLeghe * 2 >= ids.length) { compLeghe.push({ id: Number(c.id), nome: String(c.nome || "competizione " + c.id), n: ids.length }); return; }
      ids.forEach(function (x) {
        if (tab.indexOf(x) >= 0) { if (isc.indexOf(x) < 0) isc.push(x); }
        else if (leghe.indexOf(x) < 0 && !visti[x]) { visti[x] = true; extra.push({ fleTid: x, nome: String(nomi[x] || ""), comp: String(c.nome || "") }); }
      });
    });
    var mancanti = SQUADRE.filter(function (t) { return isc.indexOf(Number(t[2])) < 0; }).map(function (t) { return { squadra: t[1], lega: t[0], fleTid: Number(t[2]) }; });
    return { disponibile: true, totale: SQUADRE.length, presenti: SQUADRE.length - mancanti.length, mancanti: mancanti, extra: extra, competizioniLeghe: compLeghe };
  }
  // 1.3.5: riquadro dell'Area Admin per il controllo della tabella (dettagli dietro MOSTRA DETTAGLI)
  function cartaTabella(CT) {
    var h = "<div class='cd'><div class='lb'>SQUADRE DELLA TABELLA ISCRITTE SU FLE</div>";
    if (!CT || !CT.disponibile) return h + "<div class='mu' style='margin-top:6px'>Dato non disponibile per questo controllo: premi AGGIORNA.</div></div>";
    var tutto = !CT.mancanti.length && !CT.extra.length;
    h += "<div style='font-size:18px;font-weight:900;margin-top:6px;color:" + (tutto ? "#4ade80" : "#fbbf24") + "'>" + CT.presenti + "/" + CT.totale + " iscritte" + (tutto ? " ✓" : "") + "</div>" +
      "<div class='mu'>Iscrizione alle competizioni FLE attive: NON è la consegna della formazione (quella è nel conteggio delle consegnate).</div>";
    if (CT.mancanti.length) h += "<div style='color:#fbbf24;margin-top:6px;font-size:13px'>" + CT.mancanti.length + " squadre della tabella non risultano iscritte su FLE.</div>";
    if (CT.extra.length) h += "<div style='color:#fbbf24;margin-top:6px;font-size:13px'>" + CT.extra.length + " squadre iscritte su FLE non sono nella tabella delle 80.</div>";
    if (CT.competizioniLeghe.length) h += "<div class='mu' style='margin-top:6px'>ℹ️ " + esc(CT.competizioniLeghe.map(function (c) { return c.nome; }).join(", ")) + ": competizione tra squadre-lega (una per lega), esclusa dal confronto.</div>";
    if (CT.mancanti.length || CT.extra.length) {
      h += "<button class='bt' data-a='tab_dettagli'>MOSTRA DETTAGLI ▾</button><div id='fvm-tabdet' class='panchinaDet'>";
      CT.mancanti.forEach(function (x) { h += "<div class='mu' style='margin-top:4px'>• Non iscritta: " + esc(x.squadra) + " (" + esc(x.lega) + ", FLE " + x.fleTid + ")</div>"; });
      CT.extra.forEach(function (x) { h += "<div class='mu' style='margin-top:4px'>• Non in tabella: " + esc(x.nome || "squadra FLE " + x.fleTid) + " (FLE " + x.fleTid + (x.comp ? ", " + esc(x.comp) : "") + ")</div>"; });
      h += "<div class='mu' style='margin-top:6px'>Le differenze vengono solo segnalate: la tabella non viene mai corretta in automatico.</div></div>";
    }
    return h + "</div>";
  }
  // ================================================================ 1.3.5 (collaudo XR) CONSEGNE FLE PER COMPETIZIONE
  // Solo i dati dell'ultimo controllo dell'Area Admin (nessuna lettura in piu). Una squadra puo avere da 0 a piu competizioni
  // nella stessa giornata ed essere eliminata da una e continuare nelle altre. Per ogni competizione e squadra:
  //  consegnata    = formazione presente su FLE (stato ufficiale dal campo act, come Android 1.3.1)
  //  mancante      = squadra in campo nel turno (partite del calendario), nessuna formazione al momento del controllo,
  //                  oppure "Sconfitta a tavolino" (act 3) / giornata calcolata senza formazione (stati ufficiali)
  //  non_in_gioco  = iscritta alla competizione ma senza partita nel turno (eliminata, non partecipante) o competizione
  //                  senza turno in questa giornata: MAI una mancata consegna
  //  da_verificare = competizione non letta, turno senza partite (calendario incerto), squadra senza avversario, stato
  //                  non determinabile: MAI "mancante"
  // Stati ufficiali con fvmStatoLeghe (identica ad Android 1.3.1; FLE e una lega Classic: ruoli P/D/C/A). Ranking esclusi.
  function consegnePerCompetizione(r) {
    if (!r || !Array.isArray(r.comps) || !r.comps.length) return null;
    var nomi = {}, extraNomi = r.nomiFle || {};
    SQUADRE.forEach(function (t) { nomi[Number(t[2])] = { squadra: t[1], lega: t[0] }; });
    var nome = function (tid) { return nomi[tid] ? nomi[tid].squadra : extraNomi[tid] ? String(extraNomi[tid]) : "squadra FLE " + tid; };
    var iscr = null;
    if (Array.isArray(r.iscrittePerComp)) { iscr = {}; r.iscrittePerComp.forEach(function (c) { iscr[Number(c.id)] = (c.tmids || []).map(Number).filter(Boolean); }); }
    var mday = Number(r.mday || 0), ora = Date.parse(r.at || "") || Date.now(), inizioG = inizioGiornataFle(r.mstr); // RC3 (come Android): inizio ufficiale della giornata
    var comps = [], classifiche = [], perSq = {};
    function segna(tid, stato, C) {
      var x = perSq[tid] = perSq[tid] || { tid: tid, squadra: nome(tid), lega: nomi[tid] ? nomi[tid].lega : "", consegnata: [], mancante: [], in_attesa: [], recuperata: [], da_verificare: [], non_in_gioco: [] };
      x[stato].push(C.nome);
    }
    r.comps.forEach(function (c) {
      var id = Number(c.id), nat = c.natura || naturaCompetizione(c);
      if (nat !== "obbligo") { classifiche.push({ id: id, nome: String(c.name || id), natura: nat }); return; }
      var C = { id: id, nome: String(c.name || "competizione " + id), turno: Number(c.round || 0), calcolato: c.calc === true, ufficiali: Array.isArray(c.matches),
        iscritte: iscr && iscr[id] ? iscr[id].length : null, righe: [], conta: { consegnata: 0, mancante: 0, in_attesa: 0, recuperata: 0, da_verificare: 0, non_in_gioco: 0 }, nota: "", fase: "",
        partite: !!c.partite }; // PROVA5: competizione letta partita per partita
      var inTurno = {}, nvC = motiviNonVisibiliFle(c);
      if (c.fuori) C.nota = "nessun turno in questa giornata";
      else {
        var letta = Array.isArray(c.lineups), incerto = !!c.calIncerto, soli = (c.soli || []).map(Number), squadre = {};
        (c.tmids || []).forEach(function (t) { squadre[Number(t)] = { nome: nome(Number(t)) }; });
        var S = fvmStatoLeghe({ turno: { matchDay: C.turno, championshipMatchDay: mday, matches: incerto || !C.ufficiali ? [] : c.matches.map(function (m) { return { tIdH: m[0], tIdA: m[1] }; }) },
          formazioni: letta ? c.lineups : null, formazioniErrore: letta ? "" : "competizione non letta" + (c.http ? " (HTTP " + c.http + ")" : ""), squadre: squadre,
          nonCalcolate: C.calcolato ? [] : [C.turno], giornataSerieA: mday, inizioGiornata: r.mstr || "", ora: ora, tipoGioco: C.ufficiali ? "classic" : "" });
        C.fase = S.fase;
        if (!letta) C.nota = "competizione non letta: stato delle squadre da verificare";
        else if (incerto) C.nota = "turno senza partite nel calendario: chi deve giocare non è certo";
        S.righe.forEach(function (x) {
          var tid = Number(x.tid), st, det = "";
          inTurno[tid] = true;
          if (x.stato === "tavolino") { st = "mancante"; det = x.statoUfficiale || "Sconfitta a tavolino"; }
          // A1: "Recuperata dal Server" = nessuna consegna del partecipante: stato RECUPERATA (rosso), mai CONSEGNATA
          else if (x.stato === "recuperata") { st = "recuperata"; det = (x.ora || "") + " · " + (x.statoUfficiale || "Recuperata dal Server"); }
          else if (x.stato === "presente") {
            st = "consegnata"; det =(x.ora || "") + (x.statoUfficiale && C.ufficiali ? " · " + x.statoUfficiale : "") + (x.salvataggi > 1 ? " · " + x.salvataggi + " salvataggi" : "") + (x.invisibile ? " · invisibile" : "");
          }
          else if (incerto || soli.indexOf(tid) >= 0) { st = "da_verificare"; det = incerto ? "calendario incerto" : "senza avversario nel turno"; }
          else if (nvC[tid]) { st = "da_verificare"; det = nvC[tid]; } // PROVA5: lettura per partita, dati non sufficienti
          else if (x.stato === "assente") { st = "mancante"; det = x.statoUfficiale || "nessuna formazione (turno calcolato)"; }
          // RC3 (come Android): senza formazione PRIMA dell'inizio ufficiale (o con inizio non letto) = IN ATTESA, mai mancata consegna
          else if (x.stato === "in_attesa") { if (inizioG && ora >= inizioG.getTime()) { st = "mancante"; det = "nessuna formazione al momento del controllo (giornata iniziata)"; } else { st = "in_attesa"; det = inizioG ? "non ancora consegnata (giornata non iniziata)" : "inizio della giornata non letto: non ancora verificabile"; } }
          else { st = "da_verificare"; det = x.nota || FVM_ND; }
          C.righe.push({ tid: tid, squadra: nome(tid), lega: nomi[tid] ? nomi[tid].lega : "", stato: st, det: det, evidenzia: !!x.evidenzia || x.stato === "recuperata" });
          C.conta[st]++; segna(tid, st, C);
        });
      }
      // iscritte senza partita nel turno (o competizione senza turno): non tenute a consegnare
      if (iscr && iscr[id]) iscr[id].forEach(function (tid) {
        if (inTurno[tid]) return;
        C.righe.push({ tid: tid, squadra: nome(tid), lega: nomi[tid] ? nomi[tid].lega : "", stato: "non_in_gioco", det: c.fuori ? "competizione senza turno in questa giornata" : "iscritta, senza partita in questo turno" });
        C.conta.non_in_gioco++; segna(tid, "non_in_gioco", C);
      });
      var P = { mancante: 0, recuperata: 1, in_attesa: 2, da_verificare: 3, consegnata: 4, non_in_gioco: 5 };
      C.righe.sort(function (a, b) { return P[a.stato] - P[b.stato] || String(a.squadra).localeCompare(String(b.squadra)); });
      C.tenute = C.conta.consegnata + C.conta.mancante + C.conta.in_attesa + C.conta.recuperata + C.conta.da_verificare;
      comps.push(C);
    });
    comps.sort(function (a, b) { return a.nome.localeCompare(b.nome); });
    var squadre = Object.keys(perSq).map(function (k) { var x = perSq[k]; x.tenuta = x.consegnata.length + x.mancante.length + x.in_attesa.length + x.recuperata.length + x.da_verificare.length; return x; });
    // consegnata in almeno una competizione e mancante, recuperata dal server (A1) o da verificare in un'altra della stessa giornata
    var parziali = squadre.filter(function (x) { return x.consegnata.length && (x.mancante.length || x.in_attesa.length || x.recuperata.length || x.da_verificare.length); })
      .sort(function (a, b) { return (b.mancante.length + b.recuperata.length) - (a.mancante.length + a.recuperata.length) || String(a.squadra).localeCompare(String(b.squadra)); });
    return { mday: mday, at: r.at, comps: comps, classifiche: classifiche, squadre: perSq, parziali: parziali, ufficiali: comps.some(function (C) { return C.ufficiali; }),
      iscritteNote: !!iscr, adminPagina: r.adminPagina };
  }
  // riquadro dell'Area Admin: un blocco per competizione (dettagli dietro MOSTRA), poi le consegne parziali
  // RC3 (come Android): opz.compatto = una riga per competizione (Area Admin); opz.soloComp = dettaglio di UNA competizione (schermata turni)
  function cartaCompetizioni(CC, opz) {
    opz = opz || {};
    // A1: "recuperata" con simbolo e colore della legenda gia esistente delle CONSEGNE UFFICIALI (🔴 Recuperata dal Server)
    var STATI_COMP = { consegnata: ["🟢", "CONSEGNATA", "#4ade80"], mancante: ["🔴", "MANCANTE", "#f87171"], in_attesa: ["⏳", "IN ATTESA", "#fbbf24"], recuperata: ["🔴", "RECUPERATA DAL SERVER", "#f87171"], da_verificare: ["⚪", "DA VERIFICARE", "#aab3c2"], non_in_gioco: ["·", "NON IN GIOCO", "#7d8799"] };
    var h = "<div class='cd'><div class='lb'>CONSEGNE FLE PER COMPETIZIONE</div>";
    if (!CC || !CC.comps.length) return h + "<div class='mu' style='margin-top:6px'>" + (CC && CC.classifiche.length ? "Nessuna competizione con formazioni da consegnare." : "Dato non disponibile: premi AGGIORNA.") + "</div></div>";
    h += "<div class='mu' style='margin-top:4px'>" + esc(CC.mday) + "ª giornata di Serie A — giornata generale FLE · solo i dati dell'ultimo controllo. Una squadra può giocare più competizioni nello stesso turno: ognuna ha la sua consegna.</div>";
    if (!CC.ufficiali) h += "<div style='color:#fbbf24;margin-top:6px;font-size:13px'>Controllo salvato da una versione precedente: stati ufficiali e partite del turno non disponibili, premi AGGIORNA.</div>";
    if (!CC.iscritteNote) h += "<div class='mu' style='margin-top:4px'>Squadre iscritte non disponibili per questo controllo: le NON IN GIOCO non sono elencate.</div>";
    if (CC.adminPagina === false) h += "<div style='color:#fbbf24;margin-top:6px;font-size:13px'>Pagina FLE letta senza l'icona admin: prima della scadenza le formazioni delle altre squadre potrebbero non essere visibili. Conferma le mancanti dopo l'inizio della giornata.</div>";
    CC.comps.filter(function (C) { return !opz.soloComp || Number(C.id) === Number(opz.soloComp); }).forEach(function (C) {
      var col = C.nota && !C.tenute ? "#aab3c2" : C.conta.mancante || C.conta.recuperata ? "#f87171" : C.conta.in_attesa || C.conta.da_verificare ? "#fbbf24" : "#4ade80";
      h += "<div style='border-top:1px solid #1f3354;margin-top:10px;padding-top:8px'>" +
        "<div style='display:flex;justify-content:space-between;gap:8px'><span style='font-weight:800'>" + esc(C.nome) + (C.turno ? " <span class='mu'>— " + esc(C.turno) + "° turno FLE" + (C.calcolato ? " (calcolato)" : "") + "</span>" : "") + "</span>" +
        "<span style='font-weight:900;color:" + col + "'>" + (C.tenute ? C.conta.consegnata + "/" + C.tenute : "—") + "</span></div>" +
        "<div class='mu' style='font-size:12px'>" + (C.iscritte != null ? "iscritte " + C.iscritte + " · " : "") + "in gioco " + C.tenute + " · consegnate " + C.conta.consegnata + " · mancanti " + C.conta.mancante +
        (C.conta.in_attesa ? " · in attesa " + C.conta.in_attesa : "") + (C.conta.recuperata ? " · recuperate dal server " + C.conta.recuperata : "") + (C.conta.da_verificare ? " · da verificare " + C.conta.da_verificare : "") + (C.conta.non_in_gioco ? " · non in gioco " + C.conta.non_in_gioco : "") + "</div>" +
        (C.nota ? "<div style='color:#fbbf24;font-size:12px'>" + esc(C.nota) + "</div>" : "") +
        (C.partite ? "<div class='mu' style='font-size:12px'>Letta partita per partita (account senza privilegi admin FLE): solo i dati visibili al tuo account.</div>" : "");
      if (!opz.compatto && C.righe.length) {
        h += "<button class='bt' style='margin-top:6px;padding:8px' data-a='comp_det' data-c='" + C.id + "'>MOSTRA SQUADRE ▾</button><div id='fvm-comp-" + C.id + "' class='panchinaDet'>";
        C.righe.forEach(function (x) {
          var e = STATI_COMP[x.stato];
          h += "<div style='display:flex;justify-content:space-between;gap:8px;margin-top:5px;font-size:13px'><span style='color:" + e[2] + ";font-weight:700'>" + e[0] + " " + esc(x.squadra) +
            (x.lega ? "<span class='mu' style='font-weight:400'> · " + esc(x.lega) + "</span>" : "") + "</span><span class='mu' style='text-align:right" + (x.stato === "recuperata" ? ";color:" + e[2] : x.evidenzia ? ";color:#fbbf24" : "") + "'>" + e[1] + (x.det ? " · " + esc(x.det) : "") + "</span></div>";
        });
        // 1.3.5 (2° collaudo XR): riepilogo di QUESTA competizione, stesso meccanismo di CONSEGNE UFFICIALI (condividiTesto)
        h += "<button class='bt' style='border-color:#22c55e;color:#4ade80' data-a='comp_wa' data-c='" + C.id + "'>CONDIVIDI SU WHATSAPP</button>";
        h += "</div>";
      }
      h += "</div>";
    });
    if (opz.compatto) h += "<button class='bt' style='margin-top:10px' data-a='turni'>SQUADRE PER COMPETIZIONE E TURNO ›</button>";
    if (!opz.soloComp && CC.parziali.length) {
      h += "<div style='border-top:1px solid #1f3354;margin-top:10px;padding-top:8px'><div style='color:#fbbf24;font-weight:800'>⚠️ CONSEGNE PARZIALI · " + CC.parziali.length + " squadre</div>" +
        "<div class='mu' style='font-size:12px'>Formazione presente in una competizione ma non in un'altra della stessa giornata.</div>";
      CC.parziali.forEach(function (x) {
        h += "<div style='margin-top:5px;font-size:13px'><b>" + esc(x.squadra) + "</b>" + (x.lega ? "<span class='mu'> · " + esc(x.lega) + "</span>" : "") + "<br><span style='color:#4ade80'>✓ " + esc(x.consegnata.join(", ")) + "</span>" +
          (x.mancante.length ? " <span style='color:#f87171'>✗ " + esc(x.mancante.join(", ")) + "</span>" : "") + (x.in_attesa && x.in_attesa.length ? " <span style='color:#fbbf24'>⏳ in attesa: " + esc(x.in_attesa.join(", ")) + "</span>" : "") +
          (x.recuperata.length ? " <span style='color:#f87171'>🔴 recuperata dal server: " + esc(x.recuperata.join(", ")) + "</span>" : "") + (x.da_verificare.length ? " <span style='color:#aab3c2'>? " + esc(x.da_verificare.join(", ")) + "</span>" : "") + "</div>";
      });
      h += "</div>";
    }
    if (CC.classifiche.length) h += "<div class='mu' style='margin-top:8px'>ℹ️ " + esc(testoClassifiche(CC.classifiche)) + "</div>";
    return h + "<div class='mu' style='font-size:11px;margin-top:8px'>🟢 consegnata · 🔴 mancante (in campo nel turno, giornata iniziata, nessuna formazione) · ⏳ in attesa (prima dell'inizio: non è una mancata consegna) · 🔴 recuperata dal server (non consegnata dal partecipante) · ⚪ da verificare · NON IN GIOCO = senza partita nel turno, mai una mancata consegna.</div></div>";
  }
  // ================================================================ RC3 · CONSEGNE FLE PER COMPETIZIONE E TURNO (come Android 1.3.5)
  // Funzioni con testo IDENTICO ad Android (fleCheckDiag.js, vistaConsegne.js): selettore, stati del turno, riepilogo, testo WhatsApp.
  function fleSelettore(r, letture) {
    const mday = Number(r && r.mday || 0), L = letture || {};
    return (r && Array.isArray(r.comps) ? r.comps : []).filter(c => c && Number(c.id) && !c.del).map(c => {
      const turni = (Array.isArray(L[c.id]) && L[c.id].length ? L[c.id] : Array.isArray(c.turni) ? c.turni : []).filter(t => t && Number(t.g)).slice().sort((a, b) => a.g - b.g);
      const prop = turni.find(t => mday && t.sa === mday) || turni.filter(t => mday && t.sa < mday).slice(-1)[0] || turni[0] || null;
      return {id: Number(c.id), nome: String(c.name || c.nome || c.id), turni, proposto: prop ? prop.g : 0, natura: c.ranking ? (c.natura || "ranking") : naturaCompetizione(c)};
    });
  }
  function fleStatoTurno(res, teamMap, statoLeghe, ora) {
    if (!res || !res.turno || typeof statoLeghe !== "function") return null;
    // 1.3.1: Ranking (o natura da verificare): nessuno stato di consegna, solo le informazioni di calendario
    const nat = naturaCompetizione({id: res.comp, name: res.nomeComp || ""});
    if (nat !== "obbligo" || res.ranking) return {fase: "ranking", natura: res.ranking ? (res.natura || "ranking") : nat, ranking: true, giornataLega: Number(res.turno.matchDay || 0), giornataSerieA: Number(res.turno.championshipMatchDay || 0), inizio: "", righe: [], conta: {}, squadre: 0, dettaglio: false, formazioniLette: false, turniTotali: (res.turni || []).length};
    const t = res.turno, nomi = {};
    (teamMap || []).forEach(x => { nomi[Number(x.fleTid)] = x; });
    const squadre = {};
    (t.matches || []).forEach(m => [m && m.tIdH, m && m.tIdA].forEach(x => {
      const id = Number(x); if (!id) return; // posti vuoti (Ranking) ignorati
      const n = nomi[id];
      squadre[id] = {nome: n ? String(n.sourceTeam) : "squadra FLE " + id, allenatori: []};
    }));
    const nonCalcolate = (res.turni || []).filter(x => !x.calc).map(x => x.g);
    if (!t.calculated && nonCalcolate.indexOf(Number(t.matchDay)) < 0) nonCalcolate.push(Number(t.matchDay));
    const st = res.status || {};
    const formazioniLette = Array.isArray(res.formazioni) && !res.formazioniErrore;
    const S = statoLeghe({turno: t, formazioni: formazioniLette ? res.formazioni : null, formazioniErrore: res.formazioniErrore || "", tipoGioco: res.tipoGioco || "",
      squadre, nonCalcolate, giornataSerieA: Number(st.mday || 0), inizioGiornata: st.mstr || "", regola: null, ora});
    S.righe.forEach(x => { const n = nomi[Number(x.tid)]; x.lega = n ? String(n.sourceLeague || "") : ""; });
    // ADM1: turno letto partita per partita (account senza lettura completa): dopo il motore degli stati (NON modificato) le squadre
    // senza dati per lettura non possibile diventano non verificabili con il motivo, mai mancanti; conteggi ricalcolati
    if (res.perPartita) {
      const mot = {};
      (res.nascoste || []).forEach(x => { mot[Number(x)] = "formazione non visibile al tuo account prima dell'inizio: non verificabile, mai mancante"; });
      (res.soli || []).forEach(x => { mot[Number(x)] = "senza avversario nel turno: non letta per partita"; });
      (res.partiteNonLette || []).forEach(x => { mot[Number(x)] = "partita non letta"; });
      S.righe.forEach(x => {
        const m = mot[Number(x.tid)];
        if (!m || ["presente", "recuperata", "tavolino", "futura"].indexOf(x.stato) >= 0) return;
        x.stato = "non_verificabile"; x.nota = m; delete x.statoUfficiale; delete x.evidenzia; delete x.scaduta;
      });
      const cn = {}; S.righe.forEach(x => { cn[x.stato] = (cn[x.stato] || 0) + 1; }); S.conta = cn;
      S.perPartita = true;
    }
    // ordine: problemi prima (assenti, recuperate, tavolino), poi provvisori, attese, non verificabili, presenti, future
    const P = {assente: 0, recuperata: 1, tavolino: 2, assente_provvisorio: 3, non_verificabile: 4, in_attesa: 5, presente: 6, futura: 7};
    S.righe.sort((a, b) => ((a.stato in P ? P[a.stato] : 9) - (b.stato in P ? P[b.stato] : 9)) || String(a.squadra).localeCompare(String(b.squadra)));
    S.turniTotali = (res.turni || []).length;
    return S;
  }
  const STATI_RIEPILOGO = {
    presente: ["🟢", "presenti", "#4ade80"],
    consegnata: ["🟢", "consegnate", "#4ade80"],
    in_attesa: ["⏳", "in attesa", "#fbbf24"],
    assente_provvisorio: ["🟠", "senza formazione (provvisorio)", "#fbbf24"],
    assente: ["🔴", "senza formazione", "#f87171"],
    non_consegnata: ["🔴", "senza formazione (elenco ufficiale)", "#f87171"],
    recuperata: ["🔴", "recuperate dal server", "#f87171"],
    tavolino: ["🔴", "a tavolino", "#f87171"],
    non_verificabile: ["❔", "non verificabili", "#aab3c2"],
    futura: ["·", "turno futuro", "#7d8799"]
  };
  const ORDINE = ["presente", "consegnata", "in_attesa", "assente_provvisorio", "assente", "non_consegnata", "recuperata", "tavolino", "non_verificabile", "futura"];
  function riepilogoStati(righe) {
    const n = {};
    (Array.isArray(righe) ? righe : []).forEach(r => { const k = r && STATI_RIEPILOGO[r.stato] ? r.stato : "non_verificabile"; n[k] = (n[k] || 0) + 1; });
    return ORDINE.filter(k => n[k]).map(k => ({stato: k, n: n[k], simbolo: STATI_RIEPILOGO[k][0], etichetta: STATI_RIEPILOGO[k][1], colore: STATI_RIEPILOGO[k][2]}));
  }
  const FASI_TURNO = {calcolata: "turno calcolato", da_calcolare: "turno passato, non ancora calcolato", consegna_aperta: "consegna aperta (prima della scadenza)",
    in_corso: "giornata in corso o scadenza non indicata", futura: "turno futuro"};
  function testoWhatsappTurnoFle({C, S, R, quando, nd}) {
    if (!C || !S || S.ranking) return "";
    const ND = nd || "DATO NON DISPONIBILE";
    const el = st => (S.righe || []).filter(r => r.stato === st);
    const det = r => [r.ora && r.ora !== ND ? (r.stato === "presente" || r.stato === "recuperata" ? "salvata " : "") + r.ora : "", r.invisibile ? "invisibile" : "",
      r.modulo ? "modulo " + String(r.modulo).split("").join("-") : "", r.statoUfficiale && r.stato !== "assente" ? r.statoUfficiale : ""].filter(Boolean).join(" · ");
    const voce = r => "• " + r.squadra + (r.lega ? " (" + r.lega + ")" : "") + (det(r) ? " · " + det(r) : "") + (r.nota ? " · " + r.nota : "");
    const righe = ["📋 CONSEGNE FLE · " + C.nome,
      (S.giornataLega || "?") + "° turno FLE · giornata di Serie A " + (S.giornataSerieA || "?") + " · " + (FASI_TURNO[S.fase] || ND) + (S.inizio ? " · inizio " + S.inizio : ""),
      "Controllo: " + (quando || ND) + " · fonte: FantaLegaEuropa-FLE"];
    if (S.perPartita) righe.push("ℹ️ Letta partita per partita (account senza privilegi admin FLE): solo i dati visibili a questo account; non verificabili = mai mancanti."); // ADM1
    ((R && R.errori) || []).forEach(e => righe.push("⚠️ " + e));
    if (R && R.formazioniErrore) righe.push("⚠️ formazioni del turno non lette: " + R.formazioniErrore);
    const rie = riepilogoStati(S.righe);
    righe.push("", rie.length ? rie.map(x => x.simbolo + " " + x.n + " " + x.etichetta).join(" · ") : "nessuna squadra nel turno", "");
    [["presente", "🟢 FORMAZIONE PRESENTE"], ["in_attesa", "⏳ IN ATTESA / NON ANCORA VISIBILI"], ["assente_provvisorio", "🟠 SENZA FORMAZIONE · TURNO DA CALCOLARE (PROVVISORIO)"],
      ["assente", "🔴 SENZA FORMAZIONE · SCADENZA SUPERATA"], ["recuperata", "🔴 RECUPERATE DAL SERVER"], ["tavolino", "🔴 SCONFITTA A TAVOLINO"],
      ["non_verificabile", "❔ NON VERIFICABILI"], ["futura", "· TURNO FUTURO"]].forEach(([st, tit]) => {
      const l = el(st); if (!l.length) return;
      righe.push(tit + " (" + l.length + ")"); l.forEach(r => righe.push(voce(r))); righe.push("");
    });
    righe.push("Orari: ora italiana. «In attesa» prima della scadenza non è una mancata consegna; «senza formazione» solo dopo la scadenza (inizio ufficiale della giornata) con le formazioni lette; " +
      "«recuperata dal server» = formazione non consegnata dal partecipante. Nessun calcolo di jolly o penalità.");
    return righe.join("\n");
  }
  // tabella delle 80 squadre nella forma di Android (fleStatoTurno)
  function teamMapSafari() { return SQUADRE.map(function (x) { return { sourceLeague: x[0], sourceTeam: x[1], fleTid: x[2], sourceTid: x[3] }; }); }
  // ultima lettura di OGNI turno letto ("comp:turno" -> risultato), solo dell'account che l'ha letta; al massimo 40 turni
  var TURNI_ARCH = "fle_turni_arch";
  function archivioTurni() {
    var o = leggi(TURNI_ARCH, {}) || {}, n = {}, id = identitaAttuale();
    if (!id) return n;
    Object.keys(o).forEach(function (k) { if (o[k] && o[k].turno && o[k].fvmId === id) n[k] = o[k]; });
    return n;
  }
  function archiviaTurno(res) {
    if (!res || !res.turno || !Number(res.comp)) return;
    var o = leggi(TURNI_ARCH, {}) || {}, n = {};
    o[Number(res.comp) + ":" + Number(res.turno.matchDay)] = res;
    Object.keys(o).sort(function (a, b) { return (Date.parse(o[b].at) || 0) - (Date.parse(o[a].at) || 0); }).slice(0, 40).forEach(function (k) { n[k] = o[k]; });
    scrivi(TURNI_ARCH, n);
  }
  function apriTurni() {
    monta();
    chiudiPannello();
    pannelloPrincipale = false;
    pannello = document.createElement("div");
    pannello.className = "ov";
    radice.appendChild(pannello);
    disegnaTurni();
  }
  function disegnaTurni() {
    if (!pannello) return;
    var am = controlloFleAdminAmmesso(), DF = am.ok ? datiFle() : null, r = DF && DF.mostrato, ruolo = r ? ruoloFleDi(r) : "";
    var h = "<div class='cd'><button class='x' data-a='admin'>INDIETRO</button><div class='lb'>AREA ADMIN · FLE</div><div class='t1'>Consegne FLE</div>" +
      "<div class='mu'>Competizione e turno a scelta · sola lettura, con l'accesso FLE di questo dispositivo.</div></div>";
    var fine = function () { pannello.innerHTML = h; eventiTurni(null); };
    // stesse condizioni dei dati FLE dell'Area Admin (pertinenti); ADM1: nessun requisito sul ruolo FLE
    if (!am.ok) { h += "<div class='cd'><div class='mu'>" + esc(am.testo) + "</div></div>"; return fine(); }
    if (!r) { h += "<div class='cd'><div class='mu'>" + esc(testoRuoloFle("", DF)) + "</div></div>"; return fine(); } // ADM1: prima serve un controllo FLE
    var arch = archivioTurni(), lett = {};
    Object.keys(arch).forEach(function (k) { var x = arch[k]; if (Array.isArray(x.turni) && x.turni.length) lett[x.comp] = x.turni; });
    // RC6: giornata corrente = la più recente conosciuta (controllo generale o letture dei turni): il turno proposto passa da solo alla nuova giornata
    var mdayNoto = Number(r.mday || 0);
    Object.keys(arch).forEach(function (k) { var x = arch[k]; if (x.status && Number(x.status.mday) > mdayNoto) mdayNoto = Number(x.status.mday); });
    var sel = fleSelettore(Object.assign({}, r, { mday: mdayNoto }), lett);
    if (!sel.length) { h += "<div class='cd'><div style='color:#fbbf24'>Elenco delle competizioni FLE non ancora disponibile: torna all'Area Admin, premi AGGIORNA (controllo FLE) e torna qui.</div></div>"; return fine(); }
    var scelta = sLeggi("turni_sel") || {};
    var C = sel.filter(function (c) { return c.id === Number(scelta.comp); })[0] || sel[0];
    var turno = (Number(scelta.comp) === C.id && Number(scelta.turno)) || C.proposto;
    var R = turno ? arch[C.id + ":" + turno] || null : null;
    // RC6: il controllo generale vale solo per il turno della SUA giornata (mai mostrato per il turno di una giornata successiva)
    var saTurno = Number((C.turni.filter(function (t) { return t.g === turno; })[0] || {}).sa || 0);
    var CC = consegneSicure(r), CG = !R && turno && turno === C.proposto && saTurno && saTurno === Number(r.mday || 0) && CC && CC.comps.some(function (x) { return Number(x.id) === C.id; }) ? CC : null;
    var obblighi = sel.filter(function (c) { return c.natura === "obbligo"; }), mday = mdayNoto, err = sLeggi("turni_err") || "", tutti = leggi("fle_turni_tutti", null);
    if (tutti && tutti.fvmId !== identitaAttuale()) tutti = null;
    h += "<div class='cd'><div class='lb'>COMPETIZIONE (" + sel.length + " attive)</div>" +
      selUff("fvm-tu-comp", sel.map(function (c) { return [c.id, (c.natura === "ranking" ? "RANKING · " : c.natura === "da_verificare" ? "DA VERIFICARE · " : "") + c.nome]; }), C.id) +
      "<div class='lb' style='margin-top:8px'>TURNO FLE (giornata di Serie A)</div>" +
      (C.turni.length ? selUff("fvm-tu-turno", C.turni.map(function (t) { return [t.g, t.g + "° turno · Serie A " + (t.sa || "?") + (mday && t.sa === mday ? " · attuale" : "")]; }), turno)
        : "<div class='mu' style='color:#fbbf24'>Turni di questa competizione non letti nell'ultimo controllo: AGGIORNA QUESTO TURNO legge il turno della giornata attuale e l'elenco completo dei turni.</div>");
    if (obblighi.length) h += "<button class='bt' style='border-color:#e2b33c;color:#e2b33c' data-a='tu_tutti'>AGGIORNA TUTTI I TURNI DELLE COMPETIZIONI</button>" +
      "<div class='mu' style='font-size:11px;margin-top:2px'>Un comando: turno corrente di " + obblighi.length + " competizioni con consegna (Ranking esclusi), una lettura alla volta; letture di meno di 5 minuti riutilizzate. Sola lettura.</div>";
    if (tutti && Array.isArray(tutti.esiti)) {
      h += "<div style='border-top:1px solid #1f3354;margin-top:8px;padding-top:6px'><div style='font-weight:800;font-size:13px'>Ultimo AGGIORNA TUTTI: " + esc(dataCompleta(new Date(tutti.at))) + "</div>";
      tutti.esiti.forEach(function (e) {
        var col = e.esito === "letto" ? "#4ade80" : e.esito === "riusato" ? "#93c5fd" : e.esito === "annullato" || e.esito === "nessun_turno" ? "#7d8799" : "#f87171";
        h += "<div class='mu' style='font-size:12px;color:" + col + "'>" + (e.esito === "letto" ? "✓ " : e.esito === "riusato" ? "↺ " : e.esito === "annullato" || e.esito === "nessun_turno" ? "· " : "✗ ") + esc(e.nome) + (e.turno ? " · " + esc(e.turno) + "° turno" : "") + " — " + esc(e.testo || e.esito) + "</div>";
      });
      h += "</div>";
    }
    if (C.natura !== "obbligo") {
      h += "<div class='cd' style='margin-top:10px'><div class='lb'>" + (C.natura === "ranking" ? "RANKING · Classifica a punti: nessuna formazione da consegnare" : "NATURA DA VERIFICARE") + "</div><div class='mu'>" +
        (C.natura === "ranking" ? "Nessuna formazione mancante o in ritardo viene segnalata per questa competizione; i turni sopra sono solo informazioni di calendario."
          : "Nome o identificativo non corrispondono a un Ranking noto: finché non è verificata non viene trattata come competizione con obbligo di consegna.") + "</div></div>";
    } else h += "<button class='bt oro' data-a='tu_uno'>AGGIORNA QUESTO TURNO</button>";
    if (err && C.natura === "obbligo") h += "<div style='color:#f87171;font-size:13px;margin-top:6px'>" + esc(err) + "</div>";
    // RC5 + RC6: classificazione all'ora EFFETTIVA della lettura (una lettura fatta prima della scadenza resta «in attesa»: va riletta)
    var S = R ? fleStatoTurno(R, teamMapSafari(), function (I) { return fvmStatoLeghe(Object.assign({}, I, { avvioDistinto: true })); }, Date.parse(R.at) || undefined) : null;
    if (C.natura === "obbligo" && R && S && !S.ranking) {
      var ETI = { presente: ["🟢", "Formazione presente", "#4ade80"], assente: ["🔴", "Senza formazione", "#f87171"], recuperata: ["🔴", "Recuperata dal Server", "#f87171"], tavolino: ["🔴", "Sconfitta a tavolino", "#f87171"],
        assente_provvisorio: ["🟠", "Nessuna formazione · turno non ancora calcolato (provvisorio)", "#fbbf24"], in_attesa: ["⏳", "In attesa / non ancora visibile", "#fbbf24"], futura: ["·", "Turno futuro", "#7d8799"], non_verificabile: ["❔", FVM_ND, "#aab3c2"] };
      h += "<div style='margin-top:10px;font-weight:800;font-size:15px'>" + esc(C.nome) + " · " + esc(S.giornataLega) + "° turno FLE · giornata Serie A " + esc(S.giornataSerieA) + "</div>" +
        "<div class='mu'>Stato del turno: " + esc(FASI_TURNO[S.fase] || FVM_ND) + (S.inizio ? " · inizio giornata " + esc(S.inizio) : "") + " · " + esc(S.squadre) + " squadre</div>" +
        "<div class='mu'>Lettura: " + esc(dataCompleta(new Date(R.at))) + " · strumenti admin nella pagina: " + (R.admin ? "sì (corona)" : "non rilevati") + "</div>" +
        (S.perPartita ? "<div class='mu' style='font-size:12px'>Letta partita per partita (account senza privilegi admin FLE): solo i dati visibili al tuo account.</div>" : ""); // ADM1
      (R.errori || []).concat(R.formazioniErrore ? ["formazioni del turno non lette: " + R.formazioniErrore] : []).forEach(function (e) { h += "<div style='color:#f87171;font-size:13px'>" + esc(e) + "</div>"; });
      var rie = riepilogoStati(S.righe);
      h += "<div style='margin-top:6px;font-size:14px;font-weight:800'>" + (rie.length ? rie.map(function (x) { return "<span style='color:" + x.colore + "'>" + x.simbolo + " " + x.n + " " + esc(x.etichetta) + "</span>"; }).join(" · ") : "nessuna squadra nel turno") + "</div>";
      if ((S.righe || []).length) {
        h += "<button class='bt' style='margin-top:6px;padding:8px' data-a='tu_det'>MOSTRA SQUADRE ▾</button><div id='fvm-tu-det' class='panchinaDet'>";
        S.righe.forEach(function (x) {
          var e = ETI[x.stato] || ETI.non_verificabile, testo = x.statoUfficiale ? (x.stato === "assente" ? x.statoUfficiale + " (turno calcolato)" : x.statoUfficiale) : e[1];
          var det = [x.ora && x.ora !== FVM_ND ? "salvata " + x.ora : "", x.invisibile ? "invisibile" : "", x.modulo ? "modulo " + String(x.modulo).split("").join("-") : "", x.lega ? x.lega : ""].filter(Boolean).join(" · ");
          h += "<div style='margin-top:8px;font-size:14px" + (x.evidenzia ? ";background:rgba(248,113,113,0.12);border-radius:8px;padding:4px 6px" : "") + "'><span style='color:" + e[2] + ";font-weight:800'>" + e[0] + " " + esc(x.squadra) + "</span>" +
            "<div class='mu' style='font-size:12px'>" + esc(testo) + (det ? " · " + esc(det) : "") + (x.nota ? " · " + esc(x.nota) : "") + "</div></div>";
        });
        h += "</div><button class='bt' style='border-color:#22c55e;color:#4ade80' data-a='tu_wa'>CONDIVIDI SU WHATSAPP</button>";
      }
      h += "<div class='mu' style='font-size:11px;margin-top:8px'>Orari: ora italiana (dati ufficiali in UTC). «Senza formazione» solo dopo la scadenza (inizio ufficiale della giornata) con le formazioni lette correttamente; turni futuri, in consegna o con scadenza non indicata e letture non riuscite non diventano mai mancate consegne.</div>";
    } else if (C.natura === "obbligo" && CG) {
      h += "<div style='margin-top:10px;font-weight:800;font-size:13px'>Ultimo risultato valido · controllo generale FLE del " + esc(dataCompleta(new Date(r.at))) + "</div>" + cartaCompetizioni(CG, { soloComp: C.id });
    } else if (C.natura === "obbligo") {
      h += "<div class='mu' style='margin-top:8px;color:#fbbf24'>Nessuna lettura di questo turno salvata su questo dispositivo: premi AGGIORNA QUESTO TURNO. Esito NON DISPONIBILE finché non viene letto (mai ricostruito dalle formazioni).</div>";
    }
    h += "</div>";
    pannello.innerHTML = h;
    eventiTurni({ C: C, turno: turno, R: R, S: S, sel: sel });
  }
  function eventiTurni(x) {
    var ammesso = function () { return controlloFleAdminAmmesso().ok; }; // ADM1: nessun requisito sul ruolo FLE
    Array.prototype.forEach.call(pannello.querySelectorAll("select"), function (s) {
      s.addEventListener("change", function () {
        if (s.id === "fvm-tu-comp") sScrivi("turni_sel", { comp: Number(s.value), turno: 0 });
        if (s.id === "fvm-tu-turno" && x) sScrivi("turni_sel", { comp: x.C.id, turno: Number(s.value) });
        sScrivi("turni_err", null);
        disegnaTurni();
      });
    });
    Array.prototype.forEach.call(pannello.querySelectorAll("[data-a]"), function (el) {
      el.addEventListener("click", function (ev) {
        if (ev && ev.stopPropagation) ev.stopPropagation();
        var a = el.getAttribute("data-a");
        if (a === "admin") { apriAdmin(); return; }
        if (!x) return;
        if (a === "tu_det" || a === "comp_det") {
          var cd = pannello.querySelector(a === "tu_det" ? "#fvm-tu-det" : "#fvm-comp-" + Number(el.getAttribute("data-c")));
          if (cd) { cd.classList.toggle("aperta"); el.textContent = cd.classList.contains("aperta") ? "NASCONDI SQUADRE ▴" : "MOSTRA SQUADRE ▾"; }
          return;
        }
        // condivisione e letture FLE solo nelle stesse condizioni della visualizzazione (pertinenti e ruolo confermato)
        if (!ammesso()) { log("CONDIVIDI FLE", { esito: "non consentita", motivo: "dati FLE non pertinenti o ruolo non confermato" }); disegnaTurni(); return; }
        if (a === "tu_wa" && x.R && x.S) {
          var t = testoWhatsappTurnoFle({ C: x.C, S: x.S, R: x.R, quando: dataCompleta(new Date(x.R.at)), nd: FVM_ND });
          log("FLE TURNO WHATSAPP", { comp: x.C.id, turno: x.S.giornataLega, squadre: (x.S.righe || []).length, caratteri: t.length });
          if (t) condividiTesto(t);
        }
        if (a === "comp_wa") {
          var DFw = datiFle(), tw = testoWhatsappComp(consegneSicure(DFw.mostrato), Number(el.getAttribute("data-c")), inizioGiornataFle(DFw.mostrato && DFw.mostrato.mstr));
          if (tw) condividiTesto(tw); else avviso("Dato non disponibile: premi AGGIORNA.", true);
        }
        if (a === "tu_uno" && x.C.natura === "obbligo") avviaLetturaTurni([{ comp: x.C.id, turno: x.turno || 0, nome: x.C.nome }], false, []);
        if (a === "tu_tutti") {
          // UN comando: il turno CORRENTE di ogni competizione con consegna (mai i Ranking, mai i turni precedenti).
          // RC6: il turno corrente lo ricava la lettura stessa dalla giornata FLE APPENA LETTA (turno 0), non l'ultimo controllo generale;
          // la selezione dell'utente (anche un turno storico) non cambia: per un turno storico c'è AGGIORNA QUESTO TURNO
          var arch = archivioTurni(), ora = Date.now(), voci = [], esiti = [];
          x.sel.forEach(function (c) {
            if (c.natura !== "obbligo") return;
            // riuso: lettura di meno di 5 minuti del turno che ERA il corrente al momento della lettura
            var y = null;
            Object.keys(arch).forEach(function (k) { var z = arch[k]; if (Number(z.comp) === c.id && z.turno && z.status && Number(z.status.mday) === Number(z.turno.championshipMatchDay) && (!y || (Date.parse(z.at) || 0) > (Date.parse(y.at) || 0))) y = z; });
            var eta = y ? ora - (Date.parse(y.at) || 0) : Infinity;
            if (y && eta >= 0 && eta < 5 * 60000) esiti.push({ comp: c.id, nome: c.nome, turno: y.turno.matchDay, esito: "riusato", testo: "lettura di " + Math.max(1, Math.round(eta / 60000)) + " min fa riutilizzata" });
            else voci.push({ comp: c.id, nome: c.nome, turno: 0 });
          });
          if (!voci.length) { scrivi("fle_turni_tutti", { at: new Date().toISOString(), esiti: esiti, fvmId: identitaAttuale() }); disegnaTurni(); return; }
          avviaLetturaTurni(voci, true, esiti);
        }
      });
    });
  }
  // avvio: la lettura si fa nella pagina FLE (stessa sessione e stesse intestazioni del sito), poi si torna qui
  function avviaLetturaTurni(voci, tutti, esiti) {
    var t = sLeggi("task");
    if (t && Date.now() - Number(t.inizio || 0) < 180000) { avviso("Attendi la fine dell'attività in corso.", true); return; }
    var run = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    sScrivi("turni_err", null);
    log("FLE TURNI START", { run: run, comando: tutti ? "AGGIORNA TUTTI I TURNI" : "AGGIORNA QUESTO TURNO", daLeggere: voci.map(function (v) { return v.comp + ":" + v.turno; }).join(","), riusati: (esiti || []).filter(function (e) { return e.esito === "riusato"; }).length });
    sScrivi("task", { tipo: "turno", run: run, inizio: Date.now(), ritorno: location.href, voci: voci, esiti: esiti || [], tutti: !!tutti });
    location.assign(fleDashboardUrl());
  }
  // lettura di UN turno (come Android FLE_TURNO_INJECT): giornata, calendario della competizione, formazioni del turno; solo GET
  function leggiTurnoFle(comp, turnoChiesto, tipoGioco, soloCorrente) {
    var out = { comp: Number(comp) || 0, turnoChiesto: Number(turnoChiesto) || 0, errori: [], hdrFrom: ctl.hdrFrom || "", admin: (function () { try { return !!document.querySelector(".admin-icon, nz-icon.anticon-crown"); } catch (e) { return null; } })() };
    var msg = function (e) { return String(e && e.message || e).slice(0, 140); };
    var riprova = function (p) { return getApi(p, true).catch(function () { return new Promise(function (ok) { setTimeout(ok, 1500); }).then(function () { return getApi(p, true); }); }); };
    var stP = ctl.status && Number(ctl.status.mday) > 0 ? Promise.resolve(ctl.status) : riprova("/onboarding/v1/league/status").catch(function (e) { out.errori.push("giornata di Serie A non letta: " + msg(e)); return null; });
    var calP = riprova("/onboarding/v1/league/competition/calendar/" + out.comp).catch(function (e) { out.calErrore = msg(e); return null; });
    var roP = tipoGioco ? Promise.resolve(null) : getApi("/onboarding/v1/league/settings/rosters", true).catch(function () { return null; });
    return Promise.all([stP, calP, roP]).then(function (v) {
      var s = v[0] && v[0].data && typeof v[0].data === "object" && !Number(v[0].mday) ? v[0].data : v[0];
      out.status = s ? { mday: Number(s.mday || 0), mstr: String(s.mstr || "") } : null;
      var ro = v[2] && typeof v[2] === "object" ? (v[2].sroles != null ? v[2] : v[2].data && v[2].data.sroles != null ? v[2].data : null) : null;
      out.tipoGioco = tipoGioco || (ro ? (Number(ro.sroles) === 2 ? "mantra" : "classic") : "");
      if (!Array.isArray(v[1])) { out.errori.push("calendario della competizione non letto" + (out.calErrore ? ": " + out.calErrore : " (risposta non valida)")); return out; }
      var cal = v[1].filter(function (r) { return r && Number(r.matchDay); });
      out.turni = cal.map(function (r) { return { g: Number(r.matchDay), sa: Number(r.championshipMatchDay) || 0, calc: r.calculated === true }; });
      var mday = out.status ? out.status.mday : 0;
      if (!out.turnoChiesto && soloCorrente) {
        // RC6 (AGGIORNA TUTTI): turno CORRENTE dalla giornata appena letta; nessun turno in questa giornata = nessuna lettura (mai un turno vecchio)
        if (!mday) { out.errori.push("giornata di Serie A non letta: turno corrente non determinabile"); return out; }
        if (!cal.some(function (r) { return Number(r.championshipMatchDay) === mday; })) { out.nessunTurno = true; out.nota = "nessun turno di questa competizione nella giornata di Serie A " + mday; return out; }
      }
      var t = out.turnoChiesto ? cal.filter(function (r) { return Number(r.matchDay) === out.turnoChiesto; })[0] :
        (cal.filter(function (r) { return mday && Number(r.championshipMatchDay) === mday; })[0] || cal.filter(function (r) { return mday && Number(r.championshipMatchDay) < mday; }).slice(-1)[0] || cal[0]);
      if (!t) { out.errori.push(out.turnoChiesto ? "turno " + out.turnoChiesto + " non presente nel calendario" : "calendario senza turni"); return out; }
      out.turno = { matchDay: Number(t.matchDay), championshipMatchDay: Number(t.championshipMatchDay) || 0, calculated: t.calculated === true,
        matches: (t.matches || []).map(function (m) { return { tIdH: Number(m && m.tIdH) || 0, tIdA: Number(m && m.tIdA) || 0 }; }) };
      return riprova("/gaming/v1/teamLineup/" + out.comp + "/" + t.matchDay + "/" + t.championshipMatchDay).then(function (lu) {
        if (!Array.isArray(lu)) { out.formazioni = null; out.formazioniErrore = "risposta delle formazioni non valida"; return out; }
        // solo i campi che servono (niente giocatori)
        out.formazioni = lu.filter(function (l) { return l && Number(l.tid); }).map(function (l) { return { tid: Number(l.tid), ldate: String(l.ldate || ""), visb: l.visb, mdl: String(l.nmdl || l.mdl || ""), act: typeof l.act === "number" ? l.act : null, lucnt: typeof l.lucnt === "number" ? l.lucnt : null }; });
        return out;
      }, function (e) {
        // ADM1: lettura cumulativa rifiutata (HTTP 400, riservata agli amministratori FLE) -> lettura PER PARTITA come il controllo
        // generale (PROVA5): stessa funzione, stesse regole. Altri errori: come prima (formazioni non lette = non verificabili)
        if (!(e && e.http === 400)) { out.formazioni = null; out.formazioniErrore = msg(e); out.http = e && e.http || 0; return out; }
        return turnoPerPartitaFle(out, t, e);
      });
    }).catch(function (e) { out.errori.push(msg(e)); return out; });
  }
  // ADM1: un turno letto partita per partita. Squadre senza dati PRIMA dell'inizio (+2 minuti, come PROVA5) o con inizio non letto =
  // non visibili al tuo account (non verificabili, mai mancanti); partite non lette e squadre senza avversario = non verificabili
  function turnoPerPartitaFle(out, t, e) {
    var sa = Number(t.championshipMatchDay) || 0, cond = { fermata: "" };
    out.perPartita = { motivo: "lettura cumulativa rifiutata (HTTP 400)", server: e && e.msg || "" };
    log("FLE TURNO STEP", { stage: "per partita", comp: out.comp, turno: Number(t.matchDay), http: 400 });
    return letturaPartiteFle({ id: out.comp }, t, sa, function () { return true; }, cond).then(function (P) {
      var mday = out.status ? out.status.mday : 0, inizio = mday && sa === mday ? dataFle(out.status.mstr) : null;
      var prima = !mday || sa > mday || (sa === mday && (!inizio || Date.now() < inizio.getTime() + 2 * 60000));
      var conDati = {}, nonLette = {}, soli = [];
      P.lineups.forEach(function (l) { conDati[Number(l.tid)] = true; });
      P.nonLette.forEach(function (x) { nonLette[Number(x)] = true; });
      (t.matches || []).forEach(function (m) { var h = Number(m && m.tIdH) || 0, a = Number(m && m.tIdA) || 0; if ((h > 0) !== (a > 0)) soli.push(h > 0 ? h : a); });
      out.formazioni = P.lineups.map(function (l) { return { tid: Number(l.tid), ldate: l.ldate, visb: l.visb, mdl: "", act: l.act, lucnt: l.lucnt }; });
      out.partiteNonLette = Object.keys(nonLette).map(Number);
      out.soli = soli.filter(function (x) { return !conDati[x]; });
      out.nascoste = [];
      if (prima) (t.matches || []).forEach(function (m) { [Number(m && m.tIdH) || 0, Number(m && m.tIdA) || 0].forEach(function (x) { if (x > 0 && !conDati[x] && !nonLette[x] && soli.indexOf(x) < 0 && out.nascoste.indexOf(x) < 0) out.nascoste.push(x); }); });
      out.perPartita.letture = P.letture; out.perPartita.fallite = P.fallite;
      if (P.fallite || P.nonLette.length) out.errori.push((P.nonLette.length / 2) + " partite non lette" + (P.messaggio ? " (" + P.messaggio + ")" : "") + ": le loro squadre sono non verificabili");
      log("FLE TURNO STEP", { stage: "partite", comp: out.comp, letture: P.letture, fallite: P.fallite, formazioni: P.lineups.length, nonVisibili: out.nascoste.length, fermata: P.fermata || "" });
      return out;
    }, function (e2) { out.formazioni = null; out.formazioniErrore = "lettura partita per partita non riuscita: " + String(e2 && e2.message || e2).slice(0, 100); return out; });
  }
  // sulla pagina FLE: una lettura alla volta con 1,5 s di pausa; 30 s per lettura, 170 s in tutto; poi ritorno alla schermata
  function eseguiTurni(task) {
    var w = lavoro("Consegne FLE: lettura dei turni…"), chiuso = false, atteso = 0, i = 0, esiti = (task.esiti || []).slice(), voci = task.voci || [], tipo = "";
    var fine = function () {
      if (chiuso) return;
      chiuso = true; clearTimeout(limite);
      var att = sLeggi("task");
      if (!att || att.tipo !== "turno" || String(att.run || "") !== String(task.run || "")) { log("FLE TURNI IGNORATO", { run: task.run || "" }); try { w.chiudi(); } catch (e) {} return; }
      var n = function (e) { return esiti.filter(function (x) { return x.esito === e; }).length; };
      log("FLE TURNI FINE", { letti: n("letto"), riusati: n("riusato"), errori: n("errore"), durata: Math.round((Date.now() - Number(task.inizio || Date.now())) / 1000) + " s" });
      if (task.tutti) scrivi("fle_turni_tutti", { at: new Date().toISOString(), esiti: esiti, fvmId: identitaAttuale() });
      else {
        var e0 = esiti[0];
        sScrivi("turni_err", e0 && e0.esito === "errore" ? "Lettura non riuscita: " + e0.testo + ". Resta visibile l'ultima lettura." : null);
        if (e0 && e0.esito === "letto") sScrivi("turni_sel", { comp: e0.comp, turno: e0.turnoLetto || e0.turno });
      }
      sScrivi("task", null);
      sScrivi("apri", "turni");
      if (task.ritorno && task.ritorno.indexOf("/" + FLE_SLUG + "/") < 0) location.assign(task.ritorno);
      else { try { w.chiudi(); } catch (e) {} apriTurni(); }
    };
    var limite = setTimeout(function () {
      voci.slice(i).forEach(function (v) { esiti.push({ comp: v.comp, nome: v.nome, turno: v.turno, esito: "errore", testo: "tempo massimo superato: resta l'ultima lettura" }); });
      i = voci.length; fine();
    }, Math.max(5000, 170000 - (Date.now() - Number(task.inizio || Date.now()))));
    var una = function () {
      if (chiuso) return;
      var v = voci[i];
      if (!v) { fine(); return; }
      w.stato((voci.length > 1 ? "Aggiorno tutti i turni · " + (i + 1) + "/" + voci.length + " · " : "Leggo ") + v.nome + "…");
      var scaduta = false, t30 = setTimeout(function () { scaduta = true; esiti.push({ comp: v.comp, nome: v.nome, turno: v.turno, esito: "errore", testo: "tempo scaduto (30 s): resta l'ultima lettura" }); avanti(); }, 30000);
      var avanti = function () { i++; if (i < voci.length) setTimeout(una, 1500); else fine(); };
      leggiTurnoFle(v.comp, v.turno, tipo, !v.turno).then(function (res) {
        if (scaduta || chiuso) return;
        clearTimeout(t30);
        res.at = new Date().toISOString(); res.fvmId = identitaAttuale() || ""; res.nomeComp = v.nome; res.run = task.run || "";
        if (res.tipoGioco) tipo = res.tipoGioco;
        if (res.turno && res.fvmId) archiviaTurno(res);
        esiti.push(res.nessunTurno ? { comp: v.comp, nome: v.nome, turno: 0, esito: "nessun_turno", testo: res.nota } : !res.turno ? { comp: v.comp, nome: v.nome, turno: v.turno, esito: "errore", testo: ((res.errori || []).join(" · ") || "dati FLE non letti").slice(0, 120) }
          : res.formazioniErrore ? { comp: v.comp, nome: v.nome, turno: res.turno.matchDay, esito: "errore", testo: "formazioni del turno non lette: " + String(res.formazioniErrore).slice(0, 100) }
          : { comp: v.comp, nome: v.nome, turno: res.turno.matchDay, turnoLetto: res.turno.matchDay, esito: "letto", testo: res.turno.matchDay + "° turno · Serie A " + (res.turno.championshipMatchDay || "?") });
        log("FLE TURNO RESULT", { comp: res.comp, turno: res.turno ? res.turno.matchDay : 0, serieA: res.turno ? res.turno.championshipMatchDay : 0, formazioni: Array.isArray(res.formazioni) ? res.formazioni.length : "non lette", errori: (res.errori || []).length, http: res.http || 0 });
        avanti();
      });
    };
    var tick = setInterval(function () {
      atteso += 500;
      if ((ctl.hdr && ctl.hdrScore >= 2) || (ctl.hdr && atteso >= 6000)) { clearInterval(tick); una(); }
      else if (atteso >= 20000) {
        clearInterval(tick);
        voci.forEach(function (v) { esiti.push({ comp: v.comp, nome: v.nome, turno: v.turno, esito: "errore", testo: "pagina FLE non letta (accesso a Leghe Fantacalcio non attivo?)" }); });
        i = voci.length; fine();
      }
    }, 500);
  }
  // la vista per competizione non deve MAI impedire l'Area Admin o il riepilogo: un errore = vista assente (con diagnosi)
  function consegneSicure(r) {
    try { return consegnePerCompetizione(r); } catch (e) { log("CONSEGNE PER COMPETIZIONE", { esito: "errore", motivo: String(e && e.message || e).slice(0, 80) }); return null; }
  }
  // consegne della squadra nelle competizioni del turno, se non tutte complete (es. "consegnata in 1 di 2 competizioni")
  function testoParziale(CC, tid) {
    var x = CC && CC.squadre[Number(tid)];
    if (!x || x.tenuta < 2 || x.consegnata.length === x.tenuta) return "";
    return "consegnata in " + x.consegnata.length + " di " + x.tenuta + " competizioni";
  }
  // conteggio di una lega: consegnate / squadre lette (+ non verificate)
  function contaLegaFle(L) {
    var nv = L.squadre.filter(function (x) { return x.info.gioca && !x.info.lu && !fleRecuperata(x) && x.info.nonLetta; }).length;
    return { nv: nv, lette: L.squadre.filter(function (x) { return x.info.gioca; }).length - nv, fatte: L.squadre.filter(function (x) { return x.info.lu; }).length,
      rec: L.squadre.filter(fleRecuperata).length };
  }
  function testoIncompleto(R) { return "⚠️ CONTROLLO INCOMPLETO" + (R.nonVerificate ? " · " + R.nonVerificate + " squadre non verificate (competizioni non lette)" : " · dati FLE non letti per intero") + ". Il conteggio vale solo per le competizioni lette."; }
  // S4: inizio della giornata FLE letto da league/status (mstr, ora UTC come nell'app Android); null se non letto
  function inizioGiornataFle(mstr) {
    try { if (!mstr) return null; var d = new Date(String(mstr).slice(-1) === "Z" ? mstr : mstr + "Z"); return isNaN(d.getTime()) ? null : d; } catch (e) { return null; }
  }
  function dataBreve(d) { return d ? d.toLocaleDateString("it-IT", { weekday: "short", day: "2-digit", month: "2-digit", timeZone: "Europe/Rome" }) + " " + d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Rome" }) : ""; }
  function dataCompleta(d) { return d ? d.toLocaleDateString("it-IT", { timeZone: "Europe/Rome" }) + " " + d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Rome" }) : ""; }
  // tempo che manca all'inizio della giornata (solo se l'inizio e stato letto e non e ancora passato)
  function mancaAllInizio(d, ora) {
    var ms = d ? d.getTime() - (ora || Date.now()) : -1;
    if (ms <= 0) return "";
    var m = Math.floor(ms / 60000), g = Math.floor(m / 1440), o = Math.floor((m % 1440) / 60);
    return (g ? g + "g " : "") + (g || o ? o + "h " : "") + (m % 60) + "m";
  }
  // ora del salvataggio (ldate, UTC) in ora italiana; cdate NON e la consegna (uguale per tutte: momento del calcolo)
  function oraConsegna(lu) { var d = fvmDataUtc(lu && lu.ldate); return d ? fvmOraRoma(d) : ""; }
  // S4: report come l'app Android 1.2.3 (verde/rosso per squadra) con ora di consegna, inizio giornata e momento
  // del controllo. Solo cio che FLE riporta: rosso = nessuna formazione presente su FLE AL MOMENTO DEL CONTROLLO.
  // Controllo incompleto: dichiarato in testa; le squadre delle competizioni non lette sono ⚪ "non verificate", mai 🔴.
  function testoWhatsapp(R, CC) {
    var at = R.at ? new Date(R.at) : null, prima = R.inizio && at && at.getTime() < R.inizio.getTime();
    var righe = ["📊 FLE · " + (R.mday ? R.mday + "ª giornata di Serie A — giornata generale FLE" : "giornata non letta") + (R.inizio ? " · inizio " + dataBreve(R.inizio) : "")];
    if (!R.completo) righe.push(testoIncompleto(R));
    // ADM1: riepilogo di un account senza lettura completa: dichiarato nel messaggio
    var nPart = CC && CC.comps ? CC.comps.filter(function (C) { return C.partite; }).length : 0;
    if (nPart) righe.push("ℹ️ Letta partita per partita (" + nPart + " competizioni, account senza privilegi admin FLE): solo i dati visibili a questo account; ⚪ non verificate = mai mancanti.");
    righe.push("Consegnate: " + R.consegnate + "/" + R.lette + (R.recuperate ? " · Recuperate dal server: " + R.recuperate : "") + (R.nonVerificate ? " (+" + R.nonVerificate + " non verificate)" : ""), "Ultimo controllo: " + (at ? dataCompleta(at) : "non disponibile"), "");
    // 1.3.5 (collaudo XR): significato del numero generale e consegne per competizione (stessi dati dell'Area Admin)
    if (CC && CC.comps.length) {
      righe.splice(righe.length - 1, 0, "(squadre con almeno una formazione rilevata, non per forza in tutte le competizioni)");
      righe.push("📋 Per competizione");
      CC.comps.forEach(function (C) {
        righe.push("• " + C.nome + (C.turno ? " (turno " + C.turno + ")" : "") + ": " + (C.tenute ? C.conta.consegnata + "/" + C.tenute : "—") +
          (C.conta.mancante ? " · mancano " + C.conta.mancante : "") + (C.conta.recuperata ? " · recuperate dal server " + C.conta.recuperata : "") +
          (C.conta.da_verificare ? " · da verificare " + C.conta.da_verificare : "") + (C.nota && !C.tenute ? " · " + C.nota : ""));
        C.righe.filter(function (x) { return x.stato === "mancante"; }).forEach(function (x) { righe.push("   🔴 " + x.squadra + (x.lega ? " (" + x.lega + ")" : "")); });
        C.righe.filter(function (x) { return x.stato === "recuperata"; }).forEach(function (x) { righe.push("   🔴 " + x.squadra + (x.lega ? " (" + x.lega + ")" : "") + " · recuperata dal server"); });
      });
      if (CC.parziali.length) {
        righe.push("⚠️ Consegne parziali: " + CC.parziali.length);
        CC.parziali.forEach(function (x) { righe.push("   " + x.squadra + ": ✓ " + x.consegnata.join(", ") + (x.mancante.length ? " · ✗ " + x.mancante.join(", ") : "") +
          (x.recuperata.length ? " · 🔴 recuperata dal server: " + x.recuperata.join(", ") : "") + (x.da_verificare.length ? " · ? " + x.da_verificare.join(", ") : "")); });
      }
      righe.push("");
    }
    R.lista.forEach(function (L) {
      var gioc = L.squadre.filter(function (x) { return x.info.gioca; });
      if (!gioc.length) return;
      var n = contaLegaFle(L);
      righe.push("🏆 " + L.lega + " · " + n.fatte + "/" + n.lette + (n.rec ? " · recuperate dal server " + n.rec : "") + (n.nv ? " (+" + n.nv + " non verificate)" : ""));
      gioc.forEach(function (x) {
        // A1: recuperata dal server = rossa, mai tra le consegnate
        if (fleRecuperata(x)) { righe.push("🔴 " + x.squadra + " · recuperata dal server" + (oraConsegna(x.info.rec) ? " " + oraConsegna(x.info.rec) : "")); return; }
        righe.push((x.info.lu ? "🟢 " : x.info.nonLetta ? "⚪ " : "🔴 ") + x.squadra + (x.info.lu && oraConsegna(x.info.lu) ? " · " + oraConsegna(x.info.lu) : "") + (!x.info.lu && x.info.nonLetta ? " · non verificata" : ""));
      });
      righe.push("");
    });
    if (R.errori.length) { righe.push("⚠️ Non lette: " + R.errori.join(" · ")); righe.push(""); }
    if ((R.classifiche || []).length) { righe.push("ℹ️ " + testoClassifiche(R.classifiche)); righe.push(""); }
    righe.push("🟢 = formazione presente su FLE (ora di consegna) · 🔴 = nessuna formazione su FLE al momento del controllo" + (prima ? " (giornata non ancora iniziata)" : "") +
      (R.recuperate ? " · 🔴 recuperata dal server = formazione non consegnata dal partecipante" : "") + (R.nonVerificate ? " · ⚪ = competizione non letta: stato non verificato" : ""));
    righe.push("Fonte: FantaLegaEuropa-FLE su Leghe Fantacalcio");
    return righe.join("\n");
  }
  // 1.3.5 (2° collaudo XR): riepilogo WhatsApp di UNA competizione (pulsante alla fine del suo elenco nell'Area Admin).
  // Solo i dati del controllo: stati CONSEGNATA / MANCANTE / DA VERIFICARE / NON IN GIOCO separati, ora di salvataggio e
  // stati ufficiali solo se FLE li ha restituiti (nessun modulo, orario o salvataggio inventato). Ranking mai qui.
  function testoWhatsappComp(CC, id, inizio) {
    var C = CC && CC.comps.filter(function (x) { return Number(x.id) === Number(id); })[0];
    if (!C) return "";
    var at = CC.at ? new Date(CC.at) : null, prima = inizio && at && at.getTime() < inizio.getTime();
    var righe = ["📋 CONSEGNE FLE · " + C.nome,
      (C.turno ? C.turno + "° turno FLE" + (C.calcolato ? " (calcolato)" : "") + " · " : "") + (CC.mday ? CC.mday + "ª giornata di Serie A — giornata generale FLE" : "giornata non letta") + (inizio ? " · inizio " + dataBreve(inizio) : ""),
      "Controllo: " + (at ? dataCompleta(at) : "non disponibile") + " · fonte: FantaLegaEuropa-FLE"];
    if (C.nota) righe.push("⚠️ " + C.nota);
    if (C.partite) righe.push("ℹ️ Letta partita per partita (account senza privilegi admin FLE): solo i dati visibili a questo account.");
    if (!CC.ufficiali) righe.push("⚠️ Controllo di una versione precedente: stati ufficiali e partite del turno non disponibili.");
    if (CC.adminPagina === false) righe.push("⚠️ Pagina FLE letta senza l'icona admin: prima della scadenza le formazioni delle altre squadre potrebbero non essere visibili.");
    righe.push("", (C.iscritte != null ? "Iscritte: " + C.iscritte + " · " : "") + "In gioco: " + C.tenute + " · Consegnate: " + C.conta.consegnata + " · Mancanti: " + C.conta.mancante + (C.conta.in_attesa ? " · In attesa: " + C.conta.in_attesa : "") +
      (C.conta.recuperata ? " · Recuperate dal server: " + C.conta.recuperata : "") + (C.conta.da_verificare ? " · Da verificare: " + C.conta.da_verificare : "") + (C.conta.non_in_gioco ? " · Non in gioco: " + C.conta.non_in_gioco : ""), "");
    [["consegnata", "🟢 CONSEGNATE"], ["mancante", "🔴 MANCANTI"], ["in_attesa", "⏳ IN ATTESA (prima dell'inizio: non è una mancata consegna)"], ["recuperata", "🔴 RECUPERATE DAL SERVER"], ["da_verificare", "⚪ DA VERIFICARE"], ["non_in_gioco", "▫️ NON IN GIOCO"]].forEach(function (g) {
      var el = C.righe.filter(function (x) { return x.stato === g[0]; });
      if (!el.length) return;
      righe.push(g[1] + " (" + el.length + ")");
      el.forEach(function (x) { righe.push("• " + x.squadra + (x.lega ? " (" + x.lega + ")" : "") + (x.det ? " · " + x.det : "")); });
      righe.push("");
    });
    righe.push("🟢 = formazione presente su FLE · 🔴 = in campo nel turno, nessuna formazione su FLE al momento del controllo" + (C.conta.in_attesa ? " · ⏳ in attesa = nessuna formazione prima dell'inizio della giornata, non è una mancata consegna" : "") +
      (C.conta.recuperata ? " · 🔴 recuperata dal server = formazione non consegnata dal partecipante" : "") + " · ⚪ = non verificabile con certezza · NON IN GIOCO = senza partita nel turno, non è una mancata consegna.");
    return righe.join("\n");
  }
  // 1.3.5: competizioni escluse dalle consegne (classifiche a punti e competizioni di natura da verificare)
  function testoClassifiche(lista) {
    var rk = (lista || []).filter(function (c) { return c.natura === "ranking"; }), dv = (lista || []).filter(function (c) { return c.natura !== "ranking"; });
    return (rk.length ? rk.map(function (c) { return c.nome; }).join(", ") + ": classifiche a punti, nessuna formazione da consegnare." : "") +
      (dv.length ? (rk.length ? " " : "") + dv.map(function (c) { return c.nome; }).join(", ") + ": natura da verificare, nessun obbligo di consegna considerato." : "");
  }
  // condivisione: foglio di condivisione di iOS (WhatsApp); se non disponibile, testo copiato
  function condividiTesto(t) {
    if (navigator.share) { navigator.share({ text: t }).catch(function () {}); return; }
    try { navigator.clipboard.writeText(t).then(function () { avviso("Riepilogo copiato: incollalo su WhatsApp."); }, function () { avviso("Condivisione non disponibile.", true); }); }
    catch (e) { avviso("Condivisione non disponibile.", true); }
  }
  // PROVA14 (sicurezza): NESSUN controllo FLE automatico (prima partiva entrando nell'Area Admin o allo sblocco, in qualsiasi
  // contesto, anche con una lega Fantaclub fuori dal circuito FLE). Il controllo FLE di tutte le squadre parte SOLO con
  // CONTROLLA / AGGIORNA premuto dall'utente, e mai con Fantaclub scelto su una lega fuori circuito o non riconosciuta.
  function controlloFleAdminAmmesso() {
    // 1.3.5-RC: nessuna funzione FLE riservata senza l'account di Leghe Fantacalcio riconosciuto in questa scheda (FLE sta su Leghe)
    if (!identitaAttuale()) return { ok: false, motivo: "identita", testo: testoIdentita() };
    if (piattaformaScelta() !== "fantaclub") return { ok: true };
    var lf = legaFc();
    if (lf && inCircuitoFc(lf.nl)) return { ok: true };
    return { ok: false, testo: lf ? "La lega Fantaclub in uso (" + lf.nome + ") non è nel circuito FLE: nessun controllo FLE. Le CONSEGNE UFFICIALI Fantaclub restano consultabili."
      : "Nessuna lega Fantaclub del circuito FLE riconosciuta: nessun controllo FLE. Le CONSEGNE UFFICIALI Fantaclub restano consultabili." };
  }
  // AGGIORNA: identificativo per ogni controllo (i risultati di controlli precedenti o arrivati dopo il tempo massimo
  // vengono ignorati); doppia pressione ignorata; tempo massimo 70 s; letture sempre dal server.
  var FLE_MAX_MS = 70000;
  function avviaControlloConsegne(perche) {
    if (!adminSbloccato()) { log("CONTROLLO CONSEGNE", { avvio: perche, esito: "non avviato", motivo: "Area Admin non sbloccata in questo contesto" }); return; }
    var am = controlloFleAdminAmmesso();
    if (!am.ok) { log("CONTROLLO CONSEGNE", { avvio: perche, esito: "non avviato", motivo: am.testo }); avviso(am.testo, true); return; }
    var t = sLeggi("task");
    if (t && t.tipo === "admin" && Date.now() - Number(t.inizio || 0) < FLE_MAX_MS) { log("FLE CHECK", "controllo gia in corso: non ripetuto"); return; }
    var run = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    log("CONTROLLO CONSEGNE", { avvio: perche, run: run });
    sScrivi("task", { tipo: "admin", run: run, inizio: Date.now(), ritorno: location.href });
    location.assign(fleDashboardUrl());
  }
  function apriAdmin(ingresso) {
    try { verificaIdentita("Area Admin"); } catch (e) {} // 1.3.5-RC: se manca, lettura dell'account (sola lettura, una per pagina)
    monta();
    chiudiPannello();
    pannelloPrincipale = false;
    pannello = document.createElement("div");
    pannello.className = "ov";
    radice.appendChild(pannello);
    if (ingresso) log("ADMIN", { ingresso: "Home", sbloccato: adminSbloccato(), controlloAutomatico: "no (PROVA14)" });
    disegnaAdmin(null, false);
  }
  function disegnaAdmin(errore, avvio) {
    if (!pannello) return;
    var h = "<div class='cd'><button class='x' data-a='indietro'>INDIETRO</button><div class='t1'>AREA ADMIN</div><div class='mu'>Fanta Vice Mister Safari " + VERSIONE_VISIBILE + "</div></div>";
    if (!adminSbloccato()) {
      h += "<div class='cd'><div class='lb'>CODICE ADMIN</div><input id='fvm-codice' autocomplete='off' autocapitalize='characters' style='width:100%;margin-top:10px;padding:12px;border-radius:12px;border:1px solid #2a4370;background:#0a1524;color:#fff;font-size:16px'>" +
        (errore ? "<div style='color:#f87171;margin-top:8px'>" + esc(errore) + "</div>" : "") +
        "<button class='bt oro' data-a='sblocca'>SBLOCCA</button><div class='mu' style='margin-top:8px'>Il codice non va condiviso con i partecipanti. Apre le funzioni di FVM: i permessi sui siti restano quelli del tuo account.</div></div>";
    } else {
      // PROVA15 (sicurezza): dati e comandi FLE SOLO se pertinenti (Leghe Fantacalcio, o Fantaclub con lega del circuito) e SOLO con il
      // ruolo di amministratore FLE CONFERMATO dal sito per questo accesso (lettura riservata agli amministratori accettata nell'ultimo
      // controllo dello stesso contesto). Ruolo non verificabile = nessun riepilogo amministrativo. Il codice FVM NON da questo ruolo.
      // ADM1: il codice Admin FVM basta per il riepilogo; il ruolo FLE sceglie solo la lettura (cumulativa o partita per partita)
      var am = controlloFleAdminAmmesso(), DF0 = am.ok ? datiFle() : null, ruolo = DF0 && DF0.mostrato ? ruoloFleDi(DF0.mostrato) : "";
      var DF = DF0 || { mostrato: null }, R = am.ok ? riepilogoFle(DF.mostrato) : null, ora = Date.now(), CC = R ? consegneSicure(DF.mostrato) : null;
      if (!am.ok) h += "<div class='cd'><div class='lb'>FUNZIONI FLE NON DISPONIBILI</div><div class='mu' style='margin-top:6px'>" + esc(am.testo) + "</div></div>";
      if (am.ok) {
      h += "<div class='lb' style='margin:4px 0 6px'>CONTROLLO FLE (TUTTE LE SQUADRE)</div>";
      h += "<div class='mu' style='margin:0 2px 8px'>" + esc(testoRuoloFle(ruolo, DF0)) + "</div>";
      if (avvio) h += "<div class='cd' style='border-color:#e2b33c'><div style='font-weight:800'>Avvio del controllo FLE…</div><div class='mu'>Apro FantaLegaEuropa-FLE e leggo le formazioni consegnate di tutte le competizioni.</div></div>";
      if (errore) h += "<div class='cd' style='border-color:#e2333b;margin-top:10px'><div style='color:#f87171'>" + esc(errore) + "</div></div>";
      if (R) {
        var at = R.at ? new Date(R.at) : null, prima = R.inizio && ora < R.inizio.getTime(), manca = mancaAllInizio(R.inizio, ora);
        if (DF.recente) h += "<div class='cd' style='border-color:#fbbf24;margin-top:4px'><div style='color:#fbbf24;font-size:13px'>⚠️ Ultimo tentativo " + esc(dataCompleta(new Date(DF.recente.at))) + " non valido: " + esc((DF.recente.errors || []).length ? DF.recente.errors.join(" · ") : "dati FLE incompleti") + ".<br>Sotto: l'ultimo controllo valido.</div></div>";
        h += "<div class='cd' style='margin-top:4px'><div class='lb'>" + (R.mday ? esc(R.mday) + "ª GIORNATA DI SERIE A — GIORNATA GENERALE FLE" : "GIORNATA FLE NON LETTA") + "</div>" +
          (!R.completo ? "<div style='color:#fbbf24;margin-top:6px;font-size:13px;font-weight:800'>" + esc(testoIncompleto(R)) + "</div>" : "") +
          (R.inizio ? "<div class='mu'>Inizio: " + esc(dataBreve(R.inizio)) + (manca ? " · mancano " + esc(manca) : prima ? "" : " · iniziata") + "</div>" : "<div class='mu'>Inizio della giornata: DATO NON DISPONIBILE</div>") +
          "<div style='font-size:20px;font-weight:900;margin-top:6px'>" + R.consegnate + "/" + R.lette + " consegnate" + (R.nonVerificate ? "<span class='mu' style='font-size:14px'> (+" + R.nonVerificate + " non verificate)</span>" : "") + "</div>" +
          // A1: formazioni recuperate dal server = non consegnate dal partecipante (rosse, fuori dalle consegnate)
          (R.recuperate ? "<div style='color:#f87171;font-size:14px;font-weight:800'>🔴 " + R.recuperate + " recuperate dal server (non consegnate dal partecipante)</div>" : "") +
          // 1.3.5 (collaudo XR): significato del numero generale; il dettaglio e in CONSEGNE FLE PER COMPETIZIONE
          "<div class='mu' style='font-size:12px'>Squadre con almeno una formazione rilevata: non significa che tutte le loro competizioni siano complete (vedi CONSEGNE FLE PER COMPETIZIONE).</div>" +
          (CC && CC.parziali.length ? "<div style='color:#fbbf24;margin-top:4px;font-size:13px;font-weight:800'>⚠️ " + CC.parziali.length + " squadre con consegne parziali</div>" : "") +
          "<div class='mu'>Ultimo controllo: " + esc(at ? dataCompleta(at) : "non disponibile") + "</div>" +
          (R.errori.length ? "<div style='color:#fbbf24;margin-top:6px;font-size:13px'>" + esc(R.errori.join(" · ")) + "</div>" : "") +
          ((R.classifiche || []).length ? "<div class='mu' style='margin-top:6px'>ℹ️ " + esc(testoClassifiche(R.classifiche)) + "</div>" : "") + "</div>";
        h += "<div style='display:flex;gap:8px'><button class='bt oro' style='flex:1' data-a='controlla'>AGGIORNA</button><button class='bt' style='flex:1;border-color:#22c55e;color:#4ade80' data-a='whatsapp'>CONDIVIDI SU WHATSAPP</button></div>";
        h += cartaTabella(controlloTabella(DF.mostrato)); // 1.3.5: iscritte su FLE (non e la consegna)
        h += cartaCompetizioni(CC, { compatto: true }); // RC3 (come Android): riepilogo compatto, dettaglio nella schermata per competizione e turno
        R.lista.forEach(function (L) {
          var n = contaLegaFle(L), gioca = n.lette + n.nv;
          h += "<div class='cd'><div class='lb'>" + esc(L.lega) + (gioca ? " · " + n.fatte + "/" + n.lette + (n.rec ? " · recuperate " + n.rec : "") + (n.nv ? " (+" + n.nv + " non verificate)" : "") : "") + "</div>";
          L.squadre.forEach(function (x) {
            var rec = fleRecuperata(x); // A1: rossa, "Recuperata dal Server", mai consegnata
            var nonVer = !x.info.lu && !rec && x.info.gioca && x.info.nonLetta;
            var col = x.info.lu ? "#4ade80" : nonVer ? "#aab3c2" : x.info.gioca ? "#f87171" : "#7d8799";
            var det = rec ? "Recuperata dal Server" + (oraConsegna(x.info.rec) ? " · " + oraConsegna(x.info.rec) : "")
              : x.info.lu ? oraConsegna(x.info.lu) + (x.info.lu.visb === false || x.info.lu.visb === 0 ? " · invisibile" : "")
              : nonVer ? "non verificata (" + (x.info.motivoNV ? x.info.motivoNV : x.info.incerta ? "calendario incerto o senza avversario" : "competizione non letta") + ")" : x.info.gioca ? (prima ? "in attesa" : "non schierata (al controllo)") : "non gioca questa giornata";
            var pz = x.info.lu ? testoParziale(CC, x.info.lu.tid) : ""; // 1.3.5: consegna parziale tra le competizioni
            if (pz) { det += " · " + pz; col = "#fbbf24"; }
            h += "<div style='display:flex;justify-content:space-between;gap:8px;margin-top:6px;font-size:14px'><span style='color:" + col + ";font-weight:700'>" + (nonVer ? "⚪ " : "") + (rec ? "🔴 " : "") + esc(x.squadra) + "</span><span class='mu'" + (rec ? " style='color:#f87171'" : "") + ">" + esc(det) + "</span></div>";
          });
          h += "</div>";
        });
        h += "<div class='mu' style='font-size:11px;margin:4px 2px 8px'>Fonte: FantaLegaEuropa-FLE (league/status, competizioni, calendario, formazioni). Nessun calcolo di jolly o penalità.</div>";
        h += "<button class='bt' data-a='turni'>CONSEGNE FLE PER COMPETIZIONE E TURNO</button>";
      } else if (!avvio) h += "<button class='bt oro' data-a='controlla'>CONTROLLA SU FLE (TUTTE LE SQUADRE)</button><div class='mu' style='font-size:12px;margin:4px 2px'>Sola lettura: lettura completa se il sito la concede a questo account, altrimenti partita per partita con i soli dati visibili al tuo account.</div>";
      } // PROVA15: fine della parte FLE (solo se pertinente)
      // PROVA14: tolto il pulsante di prova PROVA PASSAGGIO FANTACLUB (1.1.0, dati fittizi): il passaggio vero resta per il controllo Fantaclub
      h += "<button class='bt' data-a='ufficiale'>CONSEGNE UFFICIALI DELLE LEGHE</button>";
      h += "<div class='mu' style='font-size:12px;margin:6px 2px'>Area Admin sbloccata solo in questa scheda, per questa piattaforma e questa lega (al massimo 60 minuti). I permessi sui siti restano quelli dell'account collegato.</div>";
      h += "<button class='bt' style='color:#aab3c2' data-a='esci'>ESCI DA ADMIN</button>";
    }
    pannello.innerHTML = h;
    Array.prototype.forEach.call(pannello.querySelectorAll("[data-a]"), function (el) {
      el.addEventListener("click", function () {
        var a = el.getAttribute("data-a");
        if (a === "indietro") apriPannello();
        if (a === "sblocca") {
          var v = String((pannello.querySelector("#fvm-codice") || {}).value || "").trim().toUpperCase();
          sha256Hex(v).then(function (hx) {
            if (hx === CODICE_ADMIN_SHA256) {
              sScrivi("admin_sessione", { at: Date.now(), contesto: contestoAdmin() });
              log("ADMIN", { esito: "sbloccato", piattaforma: piattaformaScelta(), epoca: epocaAccount(), controlloAutomatico: "no (PROVA14)" });
              disegnaAdmin(null, false);
            } else disegnaAdmin("Codice non valido.");
          }).catch(function () { disegnaAdmin("Verifica del codice non riuscita."); });
        }
        if (a === "esci") { sScrivi("admin_sessione", null); log("ADMIN", "uscito"); disegnaAdmin(); }
        if (a === "controlla") avviaControlloConsegne("AGGIORNA");
        if (a === "comp_det") {
          var cd = pannello && pannello.querySelector("#fvm-comp-" + Number(el.getAttribute("data-c")));
          if (cd) { cd.classList.toggle("aperta"); el.textContent = cd.classList.contains("aperta") ? "NASCONDI SQUADRE ▴" : "MOSTRA SQUADRE ▾"; }
        }
        // PROVA15: condivisione dei dati FLE solo nelle stesse condizioni della loro visualizzazione (pertinenti e ruolo confermato)
        if ((a === "comp_wa" || a === "whatsapp") && !controlloFleAdminAmmesso().ok) { log("CONDIVIDI FLE", { esito: "non consentita", motivo: "dati FLE non pertinenti" }); return; } // ADM1: nessun requisito sul ruolo FLE
        if (a === "comp_wa") {
          var DFw = datiFle(), tw = testoWhatsappComp(consegneSicure(DFw.mostrato), Number(el.getAttribute("data-c")), inizioGiornataFle(DFw.mostrato && DFw.mostrato.mstr));
          log("CONDIVIDI COMPETIZIONE", { comp: Number(el.getAttribute("data-c")), esito: tw ? "foglio di condivisione" : "dato non disponibile" });
          if (tw) condividiTesto(tw); else avviso("Dato non disponibile: premi AGGIORNA.", true);
        }
        if (a === "turni") { apriTurni(); return; } // RC3
        if (a === "tab_dettagli") {
          var td = pannello && pannello.querySelector("#fvm-tabdet");
          if (td) { td.classList.toggle("aperta"); el.textContent = td.classList.contains("aperta") ? "NASCONDI DETTAGLI ▴" : "MOSTRA DETTAGLI ▾"; }
        }
        if (a === "ufficiale") apriUfficiale();
        if (a === "whatsapp") {
          var R2 = riepilogoFle(datiFle().mostrato);
          if (R2) condividiTesto(testoWhatsapp(R2, consegneSicure(datiFle().mostrato)));
        }
      });
    });
  }
  // ================================================================ PROVA5: lettura PER PARTITA (partecipanti non amministratori FLE)
  // La lettura cumulativa teamLineup/<comp>/<turno>/<giornata> e quella che il sito riserva agli amministratori della lega
  // ("teamLineup ADMIN" nel codice del sito): per un partecipante normale il server risponde HTTP 400. Per i partecipanti il
  // sito legge UNA partita alla volta (teamLineup/<comp>/<turno>/<giornata>/<casa>/<ospite>, 4 alla volta): FVM fa lo stesso,
  // con la sessione e le intestazioni del sito, SOLO quando la lettura cumulativa e rifiutata. Nessun giocatore salvato.
  // Regola del sito: formazione presente se c'e la data di consegna OPPURE ci sono i giocatori (invisibile = consegnata).
  // costanti: 4 partite alla volta, 250 ms di pausa tra un gruppo e l'altro, 2 minuti di margine sull'inizio della giornata
  // stessa richiesta di getApi(path, true); in caso di errore anche il breve messaggio del server (mai intestazioni o cookie)
  function apiFleLettura(path) {
    return fetchOriginale(API + path, { headers: senzaConvalida(ctl.hdr), credentials: "include", cache: "no-store" }).then(function (r) {
      if (r.ok) return r.json();
      return (typeof r.text === "function" ? r.text() : Promise.resolve("")).catch(function () { return ""; }).then(function (t) { var e = new Error("HTTP " + r.status + " " + path); e.http = r.status; e.msg = messaggioServerFle(t); throw e; });
    });
  }
  function messaggioServerFle(t) {
    var s = String(t || ""), m = "";
    try {
      var j = JSON.parse(s), x = j && (j.error_msgs || j.errors || j.error || j.message || j.descrizione || j.msg);
      m = typeof x === "string" ? x : Array.isArray(x) ? x.map(function (e) { return typeof e === "string" ? e : e && (e.descrizione || e.message || e.msg || e.code) || ""; }).join(" · ")
        : x && typeof x === "object" ? String(x.descrizione || x.message || x.msg || "") : "";
    } catch (e) { m = s.replace(/<[^>]*>/g, " "); }
    // nessun codice lungo (token, chiavi): solo il testo breve
    return String(m || "").replace(/[A-Za-z0-9_\-.]{24,}/g, "…").replace(/\s+/g, " ").trim().slice(0, 100);
  }
  function fleDataValida(v) { var s = String(v == null ? "" : v).trim(); return !!s && !/^0+$/.test(s); }
  // una squadra della risposta della partita -> riga nello STESSO formato della lettura cumulativa (null = nessuna formazione)
  function rigaPartitaFle(p) {
    if (!p || typeof p !== "object") return null;
    var gioc = (Array.isArray(p.starts) && p.starts.length > 0) || (Array.isArray(p.bench) && p.bench.length > 0);
    if (!fleDataValida(p.ldate) && !gioc) return null;
    return { tid: Number(p.tid) || 0, ldate: fleDataValida(p.ldate) ? String(p.ldate) : "", visb: p.visb, act: typeof p.act === "number" ? p.act : null, lucnt: typeof p.lucnt === "number" ? p.lucnt : null };
  }
  // tutte le partite del turno, PARTITE_INSIEME alla volta con una pausa; al primo 429 o errore del server il controllo
  // intero smette di leggere (condiviso.fermata): le partite rimaste diventano "non lette" (DA VERIFICARE)
  function letturaPartiteFle(c, turno, mday, attivo, condiviso) {
    var PARTITE_INSIEME = 4, PARTITE_PAUSA_MS = 250;
    var coppie = (turno.matches || []).filter(function (m) { return m && Number(m.tIdH) > 0 && Number(m.tIdA) > 0; });
    var R = { lineups: [], nonLette: [], letture: 0, fallite: 0, fermata: condiviso.fermata || "", messaggio: "" }, i = 0;
    function gruppo() {
      if (i >= coppie.length) return Promise.resolve(R);
      if (!attivo() || condiviso.fermata) { R.fermata = condiviso.fermata || R.fermata; coppie.slice(i).forEach(function (m) { R.nonLette.push(Number(m.tIdH), Number(m.tIdA)); }); i = coppie.length; return Promise.resolve(R); }
      var g = coppie.slice(i, i + PARTITE_INSIEME); i += g.length;
      return Promise.all(g.map(function (m) {
        var h = Number(m.tIdH), a = Number(m.tIdA);
        R.letture++;
        return apiFleLettura("/gaming/v1/teamLineup/" + c.id + "/" + turno.matchDay + "/" + mday + "/" + h + "/" + a).then(function (j) {
          if (j && typeof j === "object" && !Array.isArray(j) && !("home" in j) && !("away" in j) && j.data && typeof j.data === "object") j = j.data;
          if (!j || typeof j !== "object" || Array.isArray(j)) throw new Error("risposta della partita non valida");
          [[j.home, h], [j.away, a]].forEach(function (x) {
            var r = rigaPartitaFle(x[0]);
            if (!r) return;
            if (!r.tid) r.tid = x[1];
            if (r.tid === x[1]) R.lineups.push(r); else R.nonLette.push(x[1]); // squadra diversa da quella del calendario: non verificata
          });
        }).catch(function (e) { // errore HTTP o risposta non valida: le due squadre della partita restano DA VERIFICARE
          R.fallite++; R.nonLette.push(h, a);
          if (!R.messaggio) R.messaggio = (e && e.http ? "HTTP " + e.http : String(e && e.message || e).slice(0, 40)) + (e && e.msg ? " · " + e.msg : "");
          if (e && (e.http === 429 || e.http >= 500)) R.fermata = condiviso.fermata = "HTTP " + e.http;
        });
      })).then(function () { return new Promise(function (ok) { setTimeout(ok, PARTITE_PAUSA_MS); }); }).then(gruppo);
    }
    return gruppo();
  }
  function eseguiConsegne(task) {
    var w = lavoro("Controllo consegne FLE in corso…"), chiuso = false, out = null, timer = null, limite = null;
    w.stato("Apro FLE…");
    log("FLE CHECK STEP", { stage: "start", run: task.run || "" });
    function finisci(risultato) {
      if (chiuso) return;
      chiuso = true; clearInterval(timer); clearTimeout(limite);
      var att = sLeggi("task");
      // risultato di un controllo superato (nuovo AGGIORNA, attivita cambiata o scaduta): ignorato
      if (!att || att.tipo !== "admin" || String(att.run || "") !== String(task.run || "")) { log("FLE CHECK IGNORATO", { run: task.run || "", atteso: att && att.run || "" }); try { w.chiudi(); } catch (e) {} return; }
      risultato.at = new Date().toISOString();
      risultato.run = task.run || "";
      // PROVA15 (sicurezza): il risultato appartiene a QUESTO accesso e contesto (mai mostrato a un altro account) e porta il ruolo FLE
      // dimostrato dal sito: lettura cumulativa accettata = amministratore; lettura partita per partita = partecipante
      risultato.fvmContesto = contestoFle();
      risultato.ruoloFle = ruoloFleDaComps(risultato.comps);
      var valido = fleControlloValido(risultato);
      // solo un controllo VALIDO sostituisce l'ultimo controllo valido; gli altri restano "ultimo tentativo"
      if (valido) { scrivi("admin_fle", risultato); scrivi("admin_fle_tentativo", null); } else scrivi("admin_fle_tentativo", risultato);
      log("FLE CHECK RESULT", { valido: valido, giornata: risultato.mday, inizio: risultato.mstr || "", adminPagina: risultato.adminPagina, primaInizio: risultato.primaInizio, hdrFrom: risultato.hdrFrom || "",
        competizioni: (risultato.comps || []).map(function (c) { return c.id + ":" + (c.natura && c.natura !== "obbligo" ? "classifica" : c.fuori ? "fuori" : Array.isArray(c.lineups) ? c.lineups.length : "non letta"); }).join(","),
        // 1.3.4: forma breve (la riga di diagnosi ha un limite di 450 caratteri): competizione:fase:codice HTTP
        nonLette: (risultato.dettagli || []).map(function (d) { return d.comp + ":" + d.fase + ":" + (d.http || 0); }).join(","), errori: (risultato.errors || []).length,
        calIncerti: (risultato.comps || []).filter(function (c) { return c.calIncerto; }).map(function (c) { return c.id; }).join(","), // 1.3.5: turni senza partite
        perPartita: (risultato.comps || []).filter(function (c) { return c.partite; }).map(function (c) { return c.id; }).join(","), // PROVA5: competizioni lette partita per partita
        primoErrore: String((risultato.errors || [])[0] || "").slice(0, 90), durata: Math.round((Date.now() - Number(task.inizio || Date.now())) / 1000) + " s" });
      log("CONTROLLO CONSEGNE", { giornata: risultato.mday, competizioni: (risultato.comps || []).length, errori: risultato.errors, valido: valido });
      sScrivi("task", null);
      sScrivi("apri", "admin");
      if (task.ritorno && task.ritorno.indexOf("/" + FLE_SLUG + "/") < 0) location.assign(task.ritorno);
      else { w.chiudi(); apriAdmin(); }
    }
    // un solo nuovo tentativo dopo 1,5 s (credenziali eventualmente aggiornate dalle richieste del sito nel frattempo)
    function getRiprova(path) {
      return getApi(path, true).catch(function (e1) {
        if (chiuso) throw e1;
        log("FLE CHECK STEP", { stage: "riprova", http: e1 && e1.http || 0, hdrFrom: ctl.hdrFrom || "" });
        return new Promise(function (ok) { setTimeout(ok, 1500); }).then(function () { return getApi(path, true); });
      });
    }
    function esegui() {
      ctl.inCorso = true;
      var mday = Number(ctl.status && ctl.status.mday || 0);
      var comps = (Array.isArray(ctl.comps) ? ctl.comps : []).filter(function (c) { return c && !c.del; });
      var mstr = String(ctl.status && ctl.status.mstr || ""), inizio = inizioGiornataFle(mstr);
      var admin = null; try { admin = !!document.querySelector(".admin-icon, nz-icon.anticon-crown"); } catch (e) {}
      var perPartita = false; // PROVA5: diventa vero alla prima lettura cumulativa rifiutata (HTTP 400)
      out = { mday: mday, mstr: mstr, comps: [], errors: [], dettagli: [], hdrFrom: ctl.hdrFrom || "", adminPagina: admin, primaInizio: inizio ? Date.now() < inizio.getTime() : null };
      // 1.3.5 (come Android 1.3.1): squadre ISCRITTE, separate per competizione (dati gia letti: nessuna richiesta in piu)
      out.iscrittePerComp = comps.map(function (c) { return { id: Number(c.id), nome: String(c.name || "").slice(0, 60), type: Number(c.type) || 0, tmids: (Array.isArray(c.tmids) ? c.tmids : []).map(Number).filter(Boolean) }; });
      log("FLE CHECK STEP", { stage: "hdr", hdrKeys: Object.keys(ctl.hdr || {}), hdrFrom: ctl.hdrFrom || "", giornata: mday, competizioni: comps.length });
      function errore(c, fase, e) {
        var http = e && e.http || 0;
        out.errors.push(c.name + ": " + String(e && e.message || e));
        out.dettagli.push({ comp: c.id, nome: c.name, fase: fase, http: http });
        log("FLE CHECK STEP", { stage: "errore", comp: c.id, fase: fase, http: http, hdrFrom: ctl.hdrFrom || "", admin: admin });
      }
      // competizione non letta: squadre "non verificate" (lineups null + errore), MAI "non schierate"
      function nonLetta(c, tmids, round, fase, e) { out.comps.push({ id: c.id, name: c.name, tmids: tmids, round: round, lineups: null, errore: true, http: e && e.http || 0 }); errore(c, fase, e); }
      w.stato("Giornata " + mday + ": controllo " + comps.length + " competizioni…");
      var i = 0;
      (function prossima() {
        if (chiuso) return;
        if (i >= comps.length) { out.completo = mday > 0 && comps.length > 0 && !out.errors.length; nomiSconosciute(out).then(function () { finisci(out); }); return; }
        var c = comps[i++];
        // 1.3.5: Ranking (classifiche a punti) e competizioni di natura da verificare: nessuna lettura delle formazioni,
        // mai obblighi di consegna (le loro squadre non diventano "non schierate")
        var natC = naturaCompetizione(c);
        if (natC !== "obbligo") {
          out.comps.push({ id: c.id, name: c.name, tmids: [], round: 0, lineups: [], fuori: true, natura: natC });
          log("FLE CHECK STEP", { stage: "classifica", comp: c.id, natura: natC });
          prossima(); return;
        }
        getRiprova("/onboarding/v1/league/competition/calendar/" + c.id).then(function (cal) {
          if (!Array.isArray(cal)) { nonLetta(c, c.tmids || [], 0, "calendario", new Error("risposta del calendario non valida")); return null; }
          var turno = cal.filter(function (r) { return r && Number(r.championshipMatchDay) === mday; })[0];
          // RC3 (come Android): elenco dei turni della competizione per CONSEGNE FLE PER COMPETIZIONE E TURNO (stessa risposta)
          var turniC = cal.filter(function (r) { return r && Number(r.matchDay); }).map(function (r) { return { g: Number(r.matchDay), sa: Number(r.championshipMatchDay) || 0, calc: r.calculated === true }; });
          // competizione senza turno in questa giornata: le sue squadre NON giocano qui (mai contate come "non schierate")
          if (!turno) { out.comps.push({ id: c.id, name: c.name, tmids: [], round: 0, lineups: [], fuori: true, turni: turniC }); return null; }
          var squadre = [], soli = [];
          // 1.3.5 (collaudo XR): squadra SENZA avversario nel turno (riposo?): mai "mancante", resta da verificare
          (turno.matches || []).forEach(function (m) { if (!m) return; if (m.tIdH) squadre.push(m.tIdH); if (m.tIdA) squadre.push(m.tIdA); if (!m.tIdH !== !m.tIdA) soli.push(Number(m.tIdH || m.tIdA)); });
          var tmids = squadre.length ? squadre : (c.tmids || []);
          // 1.3.5 (collaudo XR): dati per CONSEGNE FLE PER COMPETIZIONE dalle STESSE risposte (nessuna lettura in piu):
          // partite del turno, turno calcolato, calendario incerto (turno senza partite: chi deve giocare non e certo)
          var datiTurno = { matches: (turno.matches || []).filter(Boolean).map(function (m) { return [Number(m.tIdH) || 0, Number(m.tIdA) || 0]; }),
            calc: turno.calculated === true, calIncerto: !squadre.length, soli: soli };
          // PROVA5: prima la lettura cumulativa (amministratori: invariata, un nuovo tentativo dopo 1,5 s come prima);
          // HTTP 400 = lettura riservata agli amministratori -> lettura PER PARTITA, per questa e per le competizioni seguenti
          var pathG = "/gaming/v1/teamLineup/" + c.id + "/" + turno.matchDay + "/" + mday;
          var cumulativa = perPartita ? Promise.reject({ partite: true }) : apiFleLettura(pathG).catch(function (e1) {
            if (chiuso) throw e1;
            // come prima: un solo nuovo tentativo dopo 1,5 s; se anche questo e un 400 -> lettura per partita
            log("FLE CHECK STEP", { stage: "riprova", http: e1 && e1.http || 0, hdrFrom: ctl.hdrFrom || "" });
            return new Promise(function (ok) { setTimeout(ok, 1500); }).then(function () { return apiFleLettura(pathG); }).catch(function (e2) {
              if (chiuso || !(e1 && e1.http === 400 && e2 && e2.http === 400)) throw e2;
              perPartita = true; out.perPartita = { motivo: "lettura cumulativa rifiutata (HTTP 400)", server: e2.msg || e1.msg || "" };
              log("FLE CHECK STEP", { stage: "per partita", comp: c.id, http: 400, server: e2.msg || e1.msg || "", admin: admin });
              throw { partite: true };
            });
          });
          return cumulativa.then(function (lu) {
            if (!Array.isArray(lu)) { nonLetta(c, tmids, turno.matchDay, "formazioni", new Error("risposta delle formazioni non valida")); return; }
            // stati ufficiali come Android 1.3.1: act (canale / admin / tavolino / recuperata) e lucnt (salvataggi), niente giocatori
            out.comps.push({ id: c.id, name: c.name, tmids: tmids, round: turno.matchDay, turni: turniC, matches: datiTurno.matches, calc: datiTurno.calc, calIncerto: datiTurno.calIncerto, soli: datiTurno.soli,
              lineups: lu.filter(function (l) { return l && l.tid; }).map(function (l) { return { tid: l.tid, ldate: l.ldate || "", visb: l.visb, act: typeof l.act === "number" ? l.act : null, lucnt: typeof l.lucnt === "number" ? l.lucnt : null }; }) });
          }, function (e) {
            if (!(e && e.partite)) { nonLetta(c, tmids, turno.matchDay, "formazioni", e); return; }
            w.stato("Giornata " + mday + ": " + c.name + ", lettura partita per partita…");
            var registrata = false;
            return letturaPartiteFle(c, turno, mday, function () { return !chiuso; }, out.perPartita).then(function (P) {
              // prima dell'inizio (con 2 minuti di margine) una squadra SENZA dati nella risposta non e verificabile da
              // un partecipante: DA VERIFICARE, mai "mancante". Dopo l'inizio: stessa regola della lettura cumulativa.
              var prima = !inizio || Date.now() < inizio.getTime() + 2 * 60000, conDati = {}, nonLetteN = {};
              P.lineups.forEach(function (l) { conDati[Number(l.tid)] = true; });
              P.nonLette.forEach(function (t) { nonLetteN[Number(t)] = true; });
              var nascoste = [];
              if (prima) datiTurno.matches.forEach(function (m) { m.forEach(function (t) { if (t > 0 && !conDati[t] && !nonLetteN[t] && nascoste.indexOf(t) < 0) nascoste.push(t); }); });
              out.comps.push({ id: c.id, name: c.name, tmids: tmids, round: turno.matchDay, turni: turniC, matches: datiTurno.matches, calc: datiTurno.calc, calIncerto: datiTurno.calIncerto, soli: datiTurno.soli,
                lineups: P.lineups, partite: true, nascoste: nascoste, partiteNonLette: Object.keys(nonLetteN).map(Number) });
              registrata = true;
              log("FLE CHECK STEP", { stage: "partite", comp: c.id, letture: P.letture, fallite: P.fallite, formazioni: P.lineups.length, nonVisibili: nascoste.length, fermata: P.fermata || "" });
              // partite non lette: controllo NON valido (resta "ultimo tentativo"), le loro squadre DA VERIFICARE
              if (P.fallite || P.nonLette.length) errore(c, "partite", { http: P.fermata ? Number(P.fermata.replace(/\D/g, "")) : 0, message: (P.nonLette.length / 2) + " partite non lette" + (P.messaggio ? " (" + P.messaggio + ")" : "") });
            }).catch(function (e3) { if (registrata) errore(c, "partite", e3); else nonLetta(c, tmids, turno.matchDay, "partite", e3); }); // imprevisto: squadre DA VERIFICARE, mai sparite o mancanti
          });
        }, function (e) { nonLetta(c, c.tmids || [], 0, "calendario", e); })
          .catch(function (e) { errore(c, "lettura", e); })
          .then(function () { if (!chiuso) w.stato("Controllate " + i + "/" + comps.length + " competizioni…"); prossima(); });
      })();
    }
    // tempo massimo dall'avvio (AGGIORNA): oltre, il controllo resta "tentativo" con i dati letti fino a quel momento
    limite = setTimeout(function () {
      var r = out || { mday: 0, comps: [], errors: [] };
      r.completo = false; r.errors = (r.errors || []).concat(["Tempo massimo del controllo superato (" + Math.round(FLE_MAX_MS / 1000) + " s)"]);
      log("FLE CHECK STEP", { stage: "tempo scaduto", run: task.run || "" });
      finisci(r);
    }, Math.max(0, FLE_MAX_MS - (Date.now() - Number(task.inizio || Date.now()))));
    var atteso = 0, compsChieste = 0, compsInCorso = false, compsErrore = "";
    // 1.3.4: ricaricando la pagina FLE (AGGIORNA) il sito puo non richiedere di nuovo l'elenco delle competizioni
    // (lo tiene in memoria): dopo 6 s, con accesso e giornata gia letti, FVM lo chiede con le stesse intestazioni (senza convalida).
    // RC4: fino a 3 tentativi (6, 12, 18 s); risposta accettata anche come testo JSON; il motivo dell'ultimo errore resta per il messaggio
    function chiediCompetizioni() {
      compsChieste++; compsInCorso = true;
      var tentativo = compsChieste;
      getApi("/onboarding/v1/league/competitions", true).then(function (j) {
        if (typeof j === "string" && /^\s*[\[{]/.test(j)) { try { j = JSON.parse(j); } catch (e) {} }
        var l = listaCompetizioni(j);
        if (!l.length) throw new Error("risposta non valida");
        if (!ctl.comps) ctl.comps = l;
        log("FLE CHECK STEP", { stage: "competizioni", da: "FVM", esito: "lette", n: l.length, tentativo: tentativo });
      }).catch(function (e) {
        compsErrore = String(e && e.message || e).replace(/ \/onboarding.*$/, "").slice(0, 60);
        log("FLE CHECK STEP", { stage: "competizioni", da: "FVM", esito: "errore", http: e && e.http || 0, motivo: compsErrore, tentativo: tentativo });
      }).then(function () { compsInCorso = false; });
    }
    timer = setInterval(function () {
      atteso += 500;
      if (atteso % 5000 === 0) log("FLE CHECK STEP", { stage: "wait", waited: atteso, has: { hdr: !!ctl.hdr, comps: !!ctl.comps, status: !!ctl.status } });
      if (!ctl.comps && !compsInCorso && compsChieste < 3 && ctl.hdr && ctl.status && atteso >= 6000 * (compsChieste + 1)) chiediCompetizioni();
      if (ctl.comps && ctl.status && ((ctl.hdr && ctl.hdrScore >= 2) || atteso >= 6000)) { clearInterval(timer); esegui(); }
      else if (atteso >= 25000) {
        clearInterval(timer);
        finisci({ mday: 0, comps: [], completo: false, errors: ["Pagina FLE non letta (accesso: " + (ctl.hdr ? "si" : "no") + ", competizioni: " + (ctl.comps ? "si" : "no") + ", giornata: " + (ctl.status ? "si" : "no") + ")" +
          (!ctl.comps && compsErrore ? " · elenco delle competizioni: " + compsErrore + " (" + compsChieste + " tentativi)" : "")] });
      }
    }, 500);
  }

  // ---------------------------------------------------------------- diagnosi condivisa
  // 1.1.0: nel limite di ~3300 caratteri entrano PRIMA le righe di controllo/invio FLE ed errori, poi le altre piu recenti
  // (navigazione, lega sorgente, modalita); tutto in ordine cronologico, con l'indicazione delle righe omesse.
  // PROVA9: con priorita anche Switch (decisione, scrittura, verifica, scelte) e verifica delle competizioni FLE
  var DIAG_PRIORITA = /FLE CHECK|CONTROLLO CONSEGNE|LEGA DI LAVORO|AGGIORNAMENTI|CONTROLLO FLE|INVIO FLE|INVIO CORPO|INVIO FORMATO|INVIO INTESTAZIONI|ESITO|ERRORE|SCADUTA|SALVATAGGIO|TID DIVERSO|PASSAGGIO|FANTACLUB|SWITCH|VERIFICA COMPETIZIONI/;
  var DIAG_PRIORITA_ALTA = /IDENTITA|VERIFICA SQUADRA FLE|VERIFICA FLE|FLE NON AUTORIZZATO|GUARDIA FLE|SELETTORE FLE/; // 1.3.5-RC2
  var DIAG_LIMITE = 3300;
  // niente collegamenti nel testo condiviso: chi lo riceve (es. WhatsApp) non deve ridurlo al solo link dell'API
  function testoDiagnosi(s) {
    return String(s).replace(/https?:\/\//gi, "").replace(/\b(?:[a-z0-9-]+\.)+(?:it|io|com|net|org)\b/gi, function (m) { return m.replace(/\./g, "[.]"); });
  }
  function condividiDiagnosi() {
    var righe = leggi("diag", []).map(testoDiagnosi);
    var testo = "Fanta Vice Mister Safari " + etichettaVersione(VERSIONE) + " (" + VERSIONE + ") · diagnosi\n" + navigator.userAgent.replace(/\s+/g, " ").slice(0, 160) + "\n";
    var spazio = DIAG_LIMITE - testo.length - 300; // margine per le righe "… omesse"
    var scelte = {}, usato = 0, i;
    // 0) 1.3.5-RC2: identita dell'account, verifica della squadra e autorizzazione FLE per prime (fino a circa un terzo dello spazio)
    for (i = righe.length - 1; i >= 0 && usato < spazio * 0.35; i--) {
      if (DIAG_PRIORITA_ALTA.test(righe[i]) && usato + righe[i].length + 1 <= spazio) { scelte[i] = true; usato += righe[i].length + 1; }
    }
    // 1) righe prioritarie, dalle piu recenti, fino a circa due terzi dello spazio
    for (i = righe.length - 1; i >= 0 && usato < spazio * 0.65; i--) {
      if (!scelte[i] && DIAG_PRIORITA.test(righe[i]) && usato + righe[i].length + 1 <= spazio) { scelte[i] = true; usato += righe[i].length + 1; }
    }
    // 2) le altre righe piu recenti, consecutive, nello spazio rimasto
    for (i = righe.length - 1; i >= 0; i--) {
      if (scelte[i]) continue;
      if (usato + righe[i].length + 1 > spazio) break;
      scelte[i] = true; usato += righe[i].length + 1;
    }
    // 3) ordine cronologico originale
    var corpo = [], saltate = 0;
    for (i = 0; i < righe.length; i++) {
      if (!scelte[i]) { saltate++; continue; }
      if (saltate) { corpo.push("· … " + saltate + " righe omesse"); saltate = 0; }
      corpo.push(righe[i]);
    }
    testo += corpo.join("\n");
    if (navigator.share) {
      navigator.share({ title: "Diagnosi Fanta Vice Mister", text: testo }).catch(function () {});
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(testo).then(function () { avviso("Diagnosi copiata: incollala su WhatsApp."); }).catch(function () {});
    }
  }

  // ================================================================ MODIFICHE ESTERNE (logica COMUNE Safari/Android)
  // Formazione UFFICIALE salvata sul server di Leghe Fantacalcio: risposta teamLineup/visualizza/<divisione>/<competizione>,
  // la stessa che la pagina formazione del sito (e ACQUISISCI) riceve. NON e la bozza dell'editor: le modifiche non salvate
  // restano solo nel browser. Confronto con l'ultima formazione conosciuta da FVM per la STESSA lega, competizione, squadra
  // e giornata: titolari, modulo e ordine esatto della panchina. Solo lettura: nessun salvataggio, nessun invio.
  // ldate (ora del salvataggio, UTC) serve solo come informazione e per scartare letture piu vecchie; cdate mai usato.
  var FVM_ME_INTERVALLO = 5 * 60000;      // al massimo un controllo ogni 5 minuti per lega
  var FVM_ME_FINESTRA_FVM = 10 * 60000;   // salvataggio fatto da FVM: ora del server entro 10 minuti
  var FVM_ME_MAX_RIF = 40;                // riferimenti conservati (i piu recenti)
  function fvmMeIds(a) {
    return (Array.isArray(a) ? a : []).map(function (v) {
      if (v && typeof v === "object") return Number(v.pid != null ? v.pid : v.playerId != null ? v.playerId : v.id || 0);
      return Number(v || 0);
    }).filter(function (x) { return x > 0; });
  }
  function fvmMeModulo(m) { return String(m == null ? "" : m).replace(/\D/g, ""); }
  function fvmMeData(v) {
    var s = String(v == null ? "" : v).trim(), m = s.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/);
    if (m) return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0)));
    m = s.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/);
    if (m) return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]));
    return null;
  }
  function fvmMeOra(v) {
    var d = fvmMeData(v);
    if (!d) return "";
    try { return d.toLocaleString("it-IT", { timeZone: "Europe/Rome", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).replace(",", ""); }
    catch (e) { var z = function (x) { return (x < 10 ? "0" : "") + x; }; return z(d.getDate()) + "/" + z(d.getMonth() + 1) + " " + z(d.getHours()) + ":" + z(d.getMinutes()) + ":" + z(d.getSeconds()); }
  }
  // risposta del sito -> formazione ufficiale (ok solo se completa e della squadra/competizione attese)
  function fvmMeLeggiUfficiale(j, atteso) {
    atteso = atteso || {};
    if (typeof j === "string") { try { j = JSON.parse(j); } catch (e) { j = null; } }
    var dto = j && typeof j === "object" ? (j.teamLineupDto && typeof j.teamLineupDto === "object" ? j.teamLineupDto : j) : null;
    if (!dto || !Array.isArray(dto.starts) || !Array.isArray(dto.bench)) return { ok: false, motivo: "risposta del sito senza formazione", titolari: [], panchina: [], nomi: {} };
    var t = fvmMeIds(dto.starts), p = fvmMeIds(dto.bench);
    var r = { ok: false, tid: Number(dto.tid || 0), comp: Number(dto.idcomp || dto.comp || 0), giornata: Number(dto.mday || 0), giornataSA: Number(dto.cmday || 0),
      modulo: fvmMeModulo(dto.mdl), titolari: t, panchina: p, ldate: String(dto.ldate || ""), capt: dto.capt == null ? null : dto.capt, nomi: {} };
    (j && Array.isArray(j.lineUpInfo) ? j.lineUpInfo : []).forEach(function (x) {
      var pid = Number(x && x.pid || 0);
      if (!pid) return;
      var ro = x.role, ruolo = Number(Array.isArray(ro) ? ro[0] : ro || 0);
      r.nomi[pid] = { n: String(x.plyr || x.playerName || x.name || x.n || "").trim().slice(0, 40), r: ruolo || Number(x.r || 0) };
    });
    var tutti = t.concat(p), doppi = tutti.filter(function (x, i) { return tutti.indexOf(x) !== i; }).length;
    var motivo = !r.tid || !r.comp || !r.giornata ? "squadra, competizione o giornata non indicate dal sito"
      : t.length !== 11 ? "nessuna formazione completa salvata per questa giornata (titolari " + t.length + "/11)"
      : !p.length ? "panchina vuota"
      : t.length !== dto.starts.length || p.length !== dto.bench.length || doppi ? "giocatori non riconosciuti o ripetuti"
      : !/^\d{3,4}$/.test(r.modulo) ? "modulo non indicato"
      : atteso.tid && Number(atteso.tid) !== r.tid ? "squadra diversa da quella attesa"
      : atteso.comp && Number(atteso.comp) !== r.comp ? "competizione diversa da quella attesa" : "";
    r.ok = !motivo;
    if (motivo) r.motivo = motivo;
    return r;
  }
  function fvmMeChiave(lega, x) { return [String(lega || "").toLowerCase(), Number(x && x.comp || 0), Number(x && x.tid || 0), Number(x && x.giornata || 0)].join("|"); }
  function fvmMeImpronta(x) {
    var t = fvmMeIds(x && x.titolari).sort(function (a, b) { return a - b; });
    return fvmMeModulo(x && x.modulo) + "|T:" + t.join(",") + "|P:" + fvmMeIds(x && x.panchina).join(",");
  }
  // riferimento = formazione conosciuta da FVM (acquisita o salvata con FVM). Null se incompleto: nessun confronto possibile.
  function fvmMeRiferimento(lega, x, fonte, ora, account) {
    if (!lega || !x) return null;
    var r = { lega: String(lega).toLowerCase(), comp: Number(x.comp || 0), tid: Number(x.tid || 0), giornata: Number(x.giornata || 0), modulo: fvmMeModulo(x.modulo),
      titolari: fvmMeIds(x.titolari), panchina: fvmMeIds(x.panchina), ldate: String(x.ldate || ""), fonte: String(fonte || ""), at: Number(ora || Date.now()) };
    if (account) r.account = String(account).slice(0, 60);
    if (!r.comp || !r.tid || !r.giornata || r.titolari.length !== 11 || !r.panchina.length || !/^\d{3,4}$/.test(r.modulo)) return null;
    r.k = fvmMeChiave(r.lega, r);
    r.impronta = fvmMeImpronta(r);
    return r;
  }
  // archivio dei riferimenti: uno per chiave, i piu recenti
  function fvmMeArchivia(archivio, rif) {
    var a = {}, k, ordine = [];
    for (k in (archivio || {})) if (Object.prototype.hasOwnProperty.call(archivio, k) && archivio[k] && archivio[k].k === k) { a[k] = archivio[k]; ordine.push(k); }
    if (rif && rif.k) { a[rif.k] = rif; ordine = ordine.filter(function (x) { return x !== rif.k; }).concat([rif.k]); }
    // piu recenti prima; a parita di ora vale l'ordine di registrazione (l'ultimo registrato e il piu recente)
    var chiavi = ordine.slice().sort(function (x, y) { return Number(a[y].at || 0) - Number(a[x].at || 0) || ordine.indexOf(y) - ordine.indexOf(x); });
    chiavi.slice(FVM_ME_MAX_RIF).forEach(function (x) { delete a[x]; });
    return a;
  }
  // ultimo riferimento della lega (serve solo a sapere QUALE competizione leggere)
  function fvmMeUltimoDellaLega(archivio, lega) {
    var l = String(lega || "").toLowerCase(), best = null;
    Object.keys(archivio || {}).forEach(function (k) { var r = archivio[k]; if (r && r.lega === l && (!best || Number(r.at || 0) > Number(best.at || 0))) best = r; });
    return best;
  }
  function fvmMeAmmesso(ultimo, ora) { return !Number(ultimo || 0) || Number(ora || Date.now()) - Number(ultimo) >= FVM_ME_INTERVALLO; }
  function fvmMeConfronta(rif, uff) {
    if (!uff || !uff.ok) return { esito: "non_confrontabile", motivo: (uff && uff.motivo) || "lettura non riuscita" };
    if (!rif) return { esito: "non_confrontabile", motivo: "nessuna formazione conosciuta da FVM per questa lega, competizione, squadra e giornata" };
    if (Number(rif.tid) !== uff.tid || Number(rif.comp) !== uff.comp) return { esito: "non_confrontabile", motivo: "squadra o competizione diverse dal riferimento" };
    if (Number(rif.giornata) !== uff.giornata) return { esito: "non_confrontabile", motivo: "giornata diversa (FVM " + rif.giornata + ", sito " + uff.giornata + "): nessun confronto" };
    if (rif.account && uff.account && rif.account !== uff.account) return { esito: "non_confrontabile", motivo: "account diverso dal riferimento" };
    var dR = fvmMeData(rif.ldate), dU = fvmMeData(uff.ldate);
    if (dR && dU && dU.getTime() < dR.getTime()) return { esito: "non_confrontabile", motivo: "lettura piu vecchia della formazione conosciuta (copia non aggiornata)" };
    if (fvmMeImpronta(rif) === fvmMeImpronta(uff)) return { esito: "uguale", motivo: "formazione ufficiale uguale a quella conosciuta da FVM" };
    var rt = fvmMeIds(rif.titolari), ut = uff.titolari, rp = fvmMeIds(rif.panchina), up = uff.panchina;
    var fuori = function (a, b) { return a.filter(function (x) { return b.indexOf(x) < 0; }); };
    var d = { moduloPrima: fvmMeModulo(rif.modulo), moduloDopo: uff.modulo, entrati: fuori(ut, rt), usciti: fuori(rt, ut), panchinaEntrati: fuori(up, rp), panchinaUsciti: fuori(rp, up) };
    d.panchinaCambiata = rp.join(",") !== up.join(",");
    d.soloOrdinePanchina = d.moduloPrima === d.moduloDopo && !d.entrati.length && !d.usciti.length && !d.panchinaEntrati.length && !d.panchinaUsciti.length && d.panchinaCambiata;
    return { esito: "diversa", diff: d };
  }
  // o: {attiva, rif (SOLO quello della stessa chiave), uff, ignorata (impronta gia rifiutata con NON ORA), circuito (squadra nel circuito FLE)}
  function fvmMeDecidi(o) {
    o = o || {};
    if (!o.attiva) return { mostra: false, azione: "nessuna", motivo: "funzione disattivata" };
    // prima lettura valida per questa lega/competizione/squadra/giornata: la formazione ufficiale diventa il riferimento,
    // SENZA avviso (non si sa cosa ci fosse prima). Le modifiche successive vengono confrontate con questa.
    if (!o.rif && o.uff && o.uff.ok) return { mostra: false, azione: "inizializza", motivo: "prima lettura per questa lega, competizione, squadra e giornata: formazione ufficiale registrata come riferimento, nessun avviso", impronta: fvmMeImpronta(o.uff) };
    var c = fvmMeConfronta(o.rif, o.uff);
    if (c.esito !== "diversa") return { mostra: false, azione: c.esito === "uguale" ? "uguale" : "nessuna", motivo: c.motivo, confronto: c };
    var imp = fvmMeImpronta(o.uff), dU = fvmMeData(o.uff.ldate);
    // salvataggio fatto da FVM pochi minuti prima: l'unica differenza ammessa e l'ordine della panchina (riordino al salvataggio)
    if (o.rif.fonte === "salvataggio_fvm" && c.diff.soloOrdinePanchina && dU && Math.abs(dU.getTime() - Number(o.rif.at || 0)) <= FVM_ME_FINESTRA_FVM)
      return { mostra: false, azione: "adotta", motivo: "stesso salvataggio fatto da FVM: ordine della panchina come registrato dal sito", confronto: c, impronta: imp };
    if (o.ignorata && o.ignorata === imp) return { mostra: false, azione: "ignorata", motivo: "gia segnalata e rimandata con NON ORA", confronto: c, impronta: imp };
    return { mostra: true, azione: "avviso", tipo: o.circuito ? "fle" : "lega", motivo: "formazione ufficiale diversa da quella conosciuta da FVM", confronto: c, impronta: imp };
  }
  function fvmMeNome(nomi, pid) { var x = nomi && nomi[pid]; return x && x.n ? x.n : "#" + pid; }
  function fvmMeNomi(nomi, ids) { return (ids || []).map(function (p) { return fvmMeNome(nomi, p); }).join(", "); }
  function fvmMeTesti(dec, uff, legaNome) {
    var d = (dec && dec.confronto && dec.confronto.diff) || {}, N = (uff && uff.nomi) || {}, fle = dec && dec.tipo === "fle";
    var righe = ["Abbiamo rilevato una modifica alla formazione ufficiale della tua lega" + (legaNome ? " " + legaNome : "") + (uff && uff.giornata ? " (giornata " + uff.giornata + ")" : "") + "."];
    var ora = fvmMeOra(uff && uff.ldate);
    if (ora) righe.push("Ultimo salvataggio sul sito: " + ora + " (ora italiana).");
    var det = [];
    if (d.moduloPrima && d.moduloDopo && d.moduloPrima !== d.moduloDopo) det.push("Modulo: " + d.moduloPrima.split("").join("-") + " → " + d.moduloDopo.split("").join("-"));
    if (d.entrati && d.entrati.length) det.push("Entrano tra i titolari: " + fvmMeNomi(N, d.entrati));
    if (d.usciti && d.usciti.length) det.push("Escono dai titolari: " + fvmMeNomi(N, d.usciti));
    if (d.panchinaCambiata) det.push("Panchina sul sito, in ordine: " + (uff.panchina || []).map(function (p, i) { return (i + 1) + ". " + fvmMeNome(N, p); }).join(", "));
    return {
      titolo: "Modifica alla formazione ufficiale",
      righe: righe,
      dettagli: det,
      domanda: fle ? "La formazione presente su FantaLegaEuropa potrebbe non essere aggiornata. Vuoi acquisire la formazione e verificare FLE?" : "Vuoi acquisire la nuova formazione in Fanta Vice Mister?",
      pulsante: fle ? "ACQUISISCI E CONTROLLA FLE" : "ACQUISISCI FORMAZIONE",
      nonOra: "NON ORA",
      nota: "Nessun invio automatico: " + (fle ? "l'invio a FLE resta da confermare con il PASSO 3." : "la formazione viene solo letta.")
    };
  }
  // righe di diagnosi (solo dati della formazione: mai intestazioni, cookie o token)
  function fvmMeDiag(uff, lega) {
    if (!uff || !uff.ok) return ["lega " + (lega || "?") + " · formazione ufficiale non utilizzabile: " + ((uff && uff.motivo) || "lettura non riuscita")];
    return [
      "lega " + (lega || "?") + " · comp " + uff.comp + " · giornata " + uff.giornata + (uff.giornataSA ? " (Serie A " + uff.giornataSA + ")" : "") + " · squadra " + uff.tid + " · modulo " + uff.modulo.split("").join("-") + " · salvata " + (fvmMeOra(uff.ldate) || "ora non indicata"),
      "titolari: " + fvmMeNomi(uff.nomi, uff.titolari),
      "panchina: " + uff.panchina.map(function (p, i) { return (i + 1) + "." + fvmMeNome(uff.nomi, p); }).join(" ")
    ];
  }

  // ---------------------------------------------------------------- MODIFICHE ESTERNE · Safari (Leghe Fantacalcio, sola lettura)
  // All'apertura (caricamento di una pagina della lega) e al ritorno in primo piano, al massimo ogni 5 minuti per lega:
  // GET della formazione salvata sul server (stesso indirizzo usato dalla pagina formazione del sito), confronto con
  // l'ultima formazione conosciuta da FVM (salvata con FVM, acquisita, oppure osservata alla prima lettura della giornata:
  // in quel caso diventa il riferimento SENZA avviso) per la stessa lega/competizione/squadra/giornata.
  // Se diversa: avviso con ACQUISISCI (E CONTROLLA FLE) / NON ORA. Nessun salvataggio, nessun invio: l'invio FLE resta
  // il PASSO 3 con conferma. Fantaclub escluso. Interruttore: ME_PREDEFINITA, oppure #fvm-me=0 / #fvm-me=1 / #fvm-me=stato;
  // per il collaudo #fvm-me=controlla (controllo subito sulla lega aperta).
  // Apertura: il primo controllo di ogni lega nella sessione di Safari si fa sempre (anche entro 5 minuti dall'ultimo);
  // controlla anche quando si entra nella lega senza ricaricare la pagina. Pagina formazione: solo all'arrivo e solo se
  // l'utente non ha ancora toccato nulla; se la compilazione inizia durante la lettura l'avviso e rimandato.
  var ME_PREDEFINITA = true;
  var meInCorso = false, meAttese = 0, meSenzaRif = {};
  var mePaginaDa = Date.now(), meToccoAt = 0, meUltimoSalto = "";
  // 1.3.3: attesa dell'accesso del sito (intestazioni delle sue richieste all'API). UNA sola attesa per pagina, fino a
  // 45 s, con un solo timer; azzerata dopo successo o rinuncia; interrotta se si lascia la pagina. Dopo una rinuncia, per
  // 5 minuti dall'apertura, la prima richiesta del sito con l'accesso avvia UN controllo, solo sulla stessa pagina.
  var ME_ATTESA_MS = 45000, ME_TARDIVO_MS = 5 * 60000, meApertoDa = Date.now(), meAttesa = null, meTardivo = null;
  function meAttiva() {
    if (!ME_PREDEFINITA) return false;
    try { return localStorage.getItem(PREFISSO + "me_spenta") !== "1"; } catch (e) { return true; }
  }
  function meLog(tag, dati) { try { log("MODIFICHE ESTERNE " + tag, dati); } catch (e) {} }
  // controllo saltato: una riga di diagnosi con il motivo (la stessa riga non si ripete sulla stessa pagina)
  function meSalta(perche, motivo) {
    var c = perche + "|" + motivo + "|" + location.pathname;
    if (c === meUltimoSalto) return;
    meUltimoSalto = c;
    meLog("CONTROLLO", { perche: perche, esito: "saltato", motivo: motivo });
  }
  // pagina formazione gia toccata dall'utente dopo l'arrivo: compilazione possibile, nessun avviso sopra
  function meCompilazione() { return suFormazione() && meToccoAt >= mePaginaDa; }
  // avviso non mostrato ora: la lega torna "da controllare" (si ricontrolla alla prossima apertura o cambio pagina)
  function meRimanda(slug) {
    var u = leggi("me_ultimo", {}) || {}; delete u[slug]; scrivi("me_ultimo", u);
    var v = sLeggi("me_viste") || {}; delete v[slug]; sScrivi("me_viste", v);
  }
  function meRegistra(lega, x, fonte) {
    var rif = fvmMeRiferimento(lega, x, fonte, Date.now());
    if (!rif) { meLog("RIFERIMENTO", { fonte: fonte, lega: lega, esito: "incompleto: nessun riferimento (manca squadra, competizione, giornata o formazione completa)" }); return null; }
    scrivi("me_rif", fvmMeArchivia(leggi("me_rif", {}), rif));
    var ign = leggi("me_ign", {});
    if (ign[rif.k]) { delete ign[rif.k]; scrivi("me_ign", ign); }
    meLog("RIFERIMENTO", { fonte: fonte, chiave: rif.k, modulo: rif.modulo, titolari: rif.titolari.length, panchina: rif.panchina.length });
    return rif;
  }
  // salvataggio nella lega fatto con FVM (LEGA + FLE o SOLO LEGA): diventa la formazione conosciuta. Mai FLE.
  function meDopoSalvataggio(dati, ok, testo) {
    if (!dati || !ok || dati.tipo === "fle" || dati.suFle || !dati.lega || dati.lega === FLE_SLUG) return;
    var corpo = null, srv = null;
    try { corpo = trovaFormazione(JSON.parse(dati.corpo || "null"), 0); } catch (e) {}
    try { srv = trovaFormazione(JSON.parse(testo || "null"), 0); } catch (e) {}
    // risposta del server completa = cio che il sito ha registrato; altrimenti il corpo inviato da FVM
    var s = srv && fvmMeIds(srv.starts).length === 11 && fvmMeIds(srv.bench).length ? srv : null;
    var x = {
      tid: Number((s && s.tid) || dati.tid || (corpo && corpo.tid) || 0),
      comp: Number((s && s.idcomp) || dati.comp || (corpo && corpo.idcomp) || (location.pathname.match(/\/competition\/(\d+)\//) || [])[1] || 0),
      giornata: Number((s && s.mday) || (corpo && corpo.mday) || 0),
      modulo: s ? s.mdl : dati.modulo, titolari: s ? s.starts : dati.titolari, panchina: s ? s.bench : dati.panchina,
      ldate: (s && s.ldate) || ""
    };
    meRegistra(dati.lega, x, "salvataggio_fvm");
    // PROVA8: Switch conosciuto per la stessa chiave (risposta del server se ha i campi, altrimenti il corpo inviato)
    var swS = s ? fvmSwLeggi(s, "salvataggio_fvm") : null;
    if (!swS || swS.stato === "sconosciuto") swS = dati.sw || swS;
    swRegistra(fvmMeChiave(dati.lega, x), swS, "salvataggio_fvm");
  }
  // divisione della squadra (lettera nell'indirizzo del sito): imparata dalle richieste del sito, altrimenti "A".
  // Una divisione sbagliata non puo dare un falso avviso: la risposta deve avere la squadra e la competizione attese.
  function meDivisione(slug) {
    var mem = leggi("me_divisione", {}) || {};
    try {
      var vista = (performance.getEntriesByType("resource") || []).map(function (e) { return String(e.name || ""); })
        .map(function (u) { return u.match(/\/gaming\/v\d+\/teamLineup\/visualizza\/([A-Za-z])\/\d+(?:[?#]|$)/); }).filter(Boolean).pop();
      if (vista && mem[slug] !== vista[1].toUpperCase()) { mem[slug] = vista[1].toUpperCase(); scrivi("me_divisione", mem); }
    } catch (e) {}
    return /^[A-Z]$/.test(mem[slug] || "") ? mem[slug] : "A";
  }
  // prima volta su una lega: competizione (e squadra, se nota) da cio che FVM sa gia, mai indovinata a caso
  function meBaseIniziale(slug) {
    var u = leggi("ultima", null);
    if (u && u.lega === slug && Number(u.comp)) return { comp: Number(u.comp), tid: Number(u.tid || 0) };
    var sl = leggi("solo_lega_salvata", null);
    if (sl && sl.lega === slug && Number(sl.comp)) return { comp: Number(sl.comp), tid: 0 };
    var cl = (leggi("comps_" + slug, []) || []).filter(function (c) { return c && Number(c.id); });
    var c = cl.filter(function (x) { return /campionato/i.test(String(x.name || "")); })[0] || (cl.length === 1 ? cl[0] : null);
    return c ? { comp: Number(c.id), tid: 0 } : null;
  }
  function meControlla(perche) {
    try {
      if (meInCorso || !meAttiva()) return;
      if (piattaformaScelta() !== "fantacalcio") return meSalta(perche, "piattaforma Fantaclub: controllo solo per Leghe Fantacalcio");
      if (suFle() || suLogin() || suLogout()) return;
      if (sLeggi("task") || window.__fvmInvio || (radice && radice.querySelector && radice.querySelector("#fvm-me"))) return;
      var slug = slugDaPagina();
      if (!slug) return meSalta(perche, "pagina senza lega: il controllo parte appena entri nella lega");
      if (slug === FLE_SLUG) return;
      // pagina formazione: mai al ritorno in primo piano e mai se l'utente ha gia iniziato a toccare la pagina
      if (suFormazione() && perche === "ritorno in primo piano") return meSalta(perche, "pagina formazione: al ritorno non controllo, per non interrompere la compilazione");
      if (meCompilazione()) return meSalta(perche, "pagina formazione gia in uso: controllo alla prossima apertura");
      // competizione da leggere: quella dell'ultimo riferimento della lega; altrimenti (prima volta) quella nota a FVM
      var archivio = leggi("me_rif", {}) || {}, base = fvmMeUltimoDellaLega(archivio, slug) || meBaseIniziale(slug);
      if (!base) { if (!meSenzaRif[slug]) { meSenzaRif[slug] = 1; meLog("CONTROLLO", { perche: perche, lega: slug, esito: "competizione della lega non ancora nota a FVM: nessun controllo" }); } return; }
      // primo controllo della lega in questa sessione di Safari: sempre; poi al massimo ogni 5 minuti
      var ult = leggi("me_ultimo", {}) || {}, viste = sLeggi("me_viste") || {};
      if (viste[slug] && !fvmMeAmmesso(ult[slug], Date.now())) return;
      if (!ctl.hdr) {
        // accesso del sito non ancora visto: UNA sola attesa (un solo timer) fino a 45 s; un altro controllo che arriva
        // nel frattempo si aggancia a questa invece di aprirne una seconda
        var oraA = Date.now();
        if (meAttesa && meAttesa.pagina !== location.pathname) meAttesa = null;
        if (!meAttesa) meAttesa = { da: oraA, perche: perche, pagina: location.pathname, timer: 0 };
        if (oraA - meAttesa.da < ME_ATTESA_MS) {
          if (!meAttesa.timer) meAttesa.timer = setTimeout(meAttesaPasso, 1000);
          return;
        }
        meLog("CONTROLLO", { perche: meAttesa.perche, lega: slug, esito: "accesso del sito non ancora pronto dopo " + Math.round((oraA - meAttesa.da) / 1000) + " s: nessun controllo per ora", recupero: "alla prima richiesta del sito, entro 5 minuti dall'apertura" });
        meTardivo = { pagina: location.pathname, perche: meAttesa.perche };
        meAttesa = null;
        return;
      }
      if (meAttesa) { meLog("ACCESSO", { esito: "accesso del sito pronto dopo " + Math.round((Date.now() - meAttesa.da) / 1000) + " s", perche: meAttesa.perche }); if (meAttesa.timer) clearTimeout(meAttesa.timer); meAttesa = null; }
      meTardivo = null;
      meInCorso = true;
      ult[slug] = Date.now(); scrivi("me_ultimo", ult);
      viste[slug] = Date.now(); sScrivi("me_viste", viste);
      var div = meDivisione(slug), path = "/gaming/v1/teamLineup/visualizza/" + div + "/" + Number(base.comp);
      fetchOriginale(API + path, { headers: ctl.hdr || {}, credentials: "include", cache: "no-store" })
        .then(function (r) { return r.text().then(function (t) { return { ok: r.ok, stato: r.status, testo: t }; }); })
        .then(function (x) {
          meInCorso = false;
          if (x.ok) meSegnaAccesso(true);
          if (x.stato === 401 || x.stato === 403) { meSegnaAccesso(false, "risposta " + x.stato + " del sito"); try { if (pannello && pannelloPrincipale) aggiornaPannello(); } catch (e) {} }
          if (!x.ok) { meLog("CONTROLLO", { perche: perche, lega: slug, comp: base.comp, divisione: div, esito: "formazione non leggibile (stato " + x.stato + "): nessun avviso" }); return; }
          var uff = fvmMeLeggiUfficiale(x.testo, { tid: base.tid, comp: base.comp });
          fvmMeDiag(uff, slug).forEach(function (riga) { meLog("LETTA", riga); });
          if (!uff.ok) { meLog("CONTROLLO", { perche: perche, esito: "nessun avviso", motivo: uff.motivo }); return; }
          // solo il riferimento della STESSA chiave (lega, competizione, squadra, giornata); se manca: prima lettura, nessun avviso
          var k = fvmMeChiave(slug, uff), rif = (leggi("me_rif", {}) || {})[k], ign = leggi("me_ign", {}) || {};
          var dec = fvmMeDecidi({ attiva: meAttiva(), rif: rif, uff: uff, ignorata: ign[k], circuito: !!trovaFleTid(uff.tid) });
          meLog("CONTROLLO", { perche: perche, chiave: k, divisione: div, esito: dec.azione, motivo: dec.motivo, riferimento: rif ? rif.fonte : "nessuno" });
          // PROVA8: Switch della formazione ufficiale (stessa risposta), portato con la formazione in ACQUISISCI
          uff.sw = fvmSwDaTesto(x.testo, "ufficiale");
          if (dec.azione === "adotta") { meRegistra(slug, uff, "adottata"); swRegistra(k, uff.sw, "adottata"); }
          if (dec.azione === "inizializza") { meRegistra(slug, uff, "osservata"); swRegistra(k, uff.sw, "osservata"); }
          if (!dec.mostra && dec.azione !== "adotta" && dec.azione !== "inizializza") meControllaSwitch(slug, uff, k);
          if (dec.mostra) {
            // compilazione iniziata mentre si leggeva: nessun avviso sopra la formazione, si ricontrolla piu tardi
            if (meCompilazione()) { meRimanda(slug); meLog("AVVISO", { chiave: k, esito: "rimandato: compilazione della formazione in corso" }); return; }
            meMostraAvviso(slug, uff, dec);
          }
        })
        .catch(function (e) { meInCorso = false; meLog("CONTROLLO", { perche: perche, lega: slug, esito: "lettura non riuscita: nessun avviso", errore: String(e && e.message || e).slice(0, 80) }); });
    } catch (e) { meInCorso = false; }
  }
  // un passo dell'attesa: si interrompe se la pagina e cambiata; se il controllo si ferma per una protezione
  // (compilazione, attivita FVM, finestra aperta...) l'attesa finisce li, senza altri tentativi
  function meAttesaPasso() {
    var a = meAttesa;
    if (!a) return;
    a.timer = 0;
    if (location.pathname !== a.pagina) { meAttesa = null; meLog("CONTROLLO", { perche: a.perche, esito: "attesa dell'accesso interrotta: pagina lasciata" }); return; }
    meControlla(a.perche);
    if (meAttesa === a && !a.timer) meAttesa = null;
  }
  // accesso del sito arrivato DOPO la rinuncia: un solo controllo, solo sulla stessa pagina ed entro 5 minuti dall'apertura.
  // Aggancio a tieniIntestazioni SENZA toccarla (resta identica e viene sempre chiamata per prima).
  function meAgganciaIntestazioni() {
    if (tieniIntestazioni.__fvmMe) return;
    var originale = tieniIntestazioni;
    tieniIntestazioni = function () {
      var r = originale.apply(this, arguments);
      try {
        if (meTardivo && ctl.hdr) {
          var t = meTardivo, sec = Math.round((Date.now() - meApertoDa) / 1000);
          meTardivo = null;
          if (Date.now() - meApertoDa > ME_TARDIVO_MS) meLog("CONTROLLO", { perche: t.perche, esito: "accesso del sito arrivato dopo " + sec + " s dall'apertura (oltre 5 minuti): nessun controllo" });
          else if (location.pathname !== t.pagina) meLog("CONTROLLO", { perche: t.perche, esito: "accesso del sito arrivato in ritardo su un'altra pagina: nessun controllo" });
          else { meLog("ACCESSO", { esito: "accesso del sito arrivato in ritardo (" + sec + " s dall'apertura): controllo" }); setTimeout(function () { meControlla("accesso del sito arrivato in ritardo"); }, 300); }
        }
      } catch (e) {}
      return r;
    };
    tieniIntestazioni.__fvmMe = true;
  }
  function meMostraAvviso(slug, uff, dec) {
    monta();
    if (!radice) return;
    var vecchio = radice.querySelector("#fvm-me");
    if (vecchio) vecchio.remove();
    var T = fvmMeTesti(dec, uff, nomeLega(slug)), k = fvmMeChiave(slug, uff);
    var box = document.createElement("div");
    box.className = "ov";
    box.id = "fvm-me";
    var h = "<div class='cd' style='margin-top:18%;border:2px solid #e2b33c'><div class='lb' style='color:#e2b33c'>FANTA VICE MISTER</div>" +
      "<div class='t2' style='margin-top:6px'>" + esc(T.titolo) + "</div>";
    T.righe.forEach(function (r) { h += "<div class='mu' style='margin-top:6px'>" + esc(r) + "</div>"; });
    T.dettagli.forEach(function (r) { h += "<div class='mu' style='margin-top:4px'>• " + esc(r) + "</div>"; });
    h += "<div class='mu' style='margin-top:8px;color:#fbbf24;font-weight:700'>" + esc(T.domanda) + "</div>" +
      "<button class='bt oro' data-me='acquisisci'>" + esc(T.pulsante) + "</button>" +
      "<button class='bt' data-me='nonora'>" + esc(T.nonOra) + "</button>" +
      "<div class='mu' style='margin-top:6px;font-size:11px'>" + esc(T.nota) + "</div></div>";
    box.innerHTML = h;
    radice.appendChild(box);
    meLog("AVVISO", { chiave: k, tipo: dec.tipo, differenze: T.dettagli.length });
    Array.prototype.forEach.call(box.querySelectorAll("[data-me]"), function (el) {
      el.addEventListener("click", function (ev) {
        ev.stopPropagation();
        var a = el.getAttribute("data-me");
        box.remove();
        if (a === "nonora") {
          var ign = leggi("me_ign", {}) || {};
          ign[k] = dec.impronta; scrivi("me_ign", ign);
          meLog("NON ORA", { chiave: k, nota: "stessa formazione non piu segnalata; una nuova modifica si" });
          return;
        }
        meAcquisisci(slug, uff, dec.tipo === "fle");
      });
    });
  }
  // PROVA8 · MODIFICHE ESTERNE dello SWITCH (formazione invariata): Switch aggiunto, cambiato o tolto fuori da FVM per
  // la stessa lega/competizione/squadra/giornata. Prima lettura = riferimento senza avviso; NON ORA per quella situazione.
  function meControllaSwitch(slug, uff, k) {
    var s = uff && uff.sw;
    if (!s || s.stato === "sconosciuto") return;
    var r = (leggi("sw_rif", {}) || {})[k];
    if (!r) { swRegistra(k, s, "osservata"); meLog("SWITCH", { chiave: k, esito: "prima lettura: riferimento registrato, nessun avviso" }); return; }
    if (r.stato !== "presente" && r.stato !== "assente") return;
    var imp = fvmSwImpronta(s);
    if (r.imp === imp) return;
    var ign = leggi("sw_ign", {}) || {};
    if (ign[k] === imp) { meLog("SWITCH", { chiave: k, esito: "gia segnalato e rimandato con NON ORA" }); return; }
    if (meCompilazione()) { meRimanda(slug); meLog("SWITCH", { chiave: k, esito: "avviso rimandato: compilazione della formazione in corso" }); return; }
    meMostraAvvisoSwitch(slug, uff, r, k);
  }
  function meMostraAvvisoSwitch(slug, uff, r, k) {
    monta();
    if (!radice) return;
    var vecchio = radice.querySelector("#fvm-me");
    if (vecchio) vecchio.remove();
    var s = uff.sw, imp = fvmSwImpronta(s), um = { nomi: uff.nomi || {} };
    var prima = r.stato === "presente" ? swCoppia({ stato: "presente", a: r.a, b: r.b }, um) : "nessuno";
    var titolo = r.stato === "assente" ? "Switch aggiunto fuori da FVM" : s.stato === "assente" ? "Switch tolto fuori da FVM" : "Switch cambiato fuori da FVM";
    var circuito = !!trovaFleTid(uff.tid);
    var box = document.createElement("div");
    box.className = "ov";
    box.id = "fvm-me";
    box.innerHTML = "<div class='cd' style='margin-top:18%;border:2px solid #e2b33c'><div class='lb' style='color:#e2b33c'>FANTA VICE MISTER</div>" +
      "<div class='t2' style='margin-top:6px'>" + esc(titolo) + "</div>" +
      "<div class='mu' style='margin-top:6px'>" + esc(nomeLega(slug)) + (uff.giornata ? " · " + uff.giornata + "ª giornata" : "") + ": la formazione è la stessa, lo Switch no.</div>" +
      "<div class='mu' style='margin-top:4px'>• Prima: " + esc(prima) + "</div><div class='mu'>• Ora: " + esc(swCoppia(s, um)) + "</div>" +
      "<div class='mu' style='margin-top:8px;color:#fbbf24;font-weight:700'>Vuoi usare lo Switch attuale" + (circuito ? " anche per FLE?" : "?") + "</div>" +
      "<button class='bt oro' data-me='acquisisci'>" + (circuito ? "ACQUISISCI E CONTROLLA FLE" : "ACQUISISCI") + "</button>" +
      "<button class='bt' data-me='nonora'>NON ORA</button>" +
      "<div class='mu' style='margin-top:6px;font-size:11px'>Nessun invio: l'invio su FLE resta il PASSO 3 con conferma.</div></div>";
    radice.appendChild(box);
    meLog("AVVISO", { chiave: k, tipo: "switch", prima: r.imp, ora: imp });
    Array.prototype.forEach.call(box.querySelectorAll("[data-me]"), function (el) {
      el.addEventListener("click", function (ev) {
        ev.stopPropagation();
        var a = el.getAttribute("data-me");
        box.remove();
        if (a === "nonora") {
          var ign = leggi("sw_ign", {}) || {};
          ign[k] = imp; scrivi("sw_ign", ign);
          meLog("NON ORA", { chiave: k, tipo: "switch", nota: "stesso Switch non piu segnalato; un nuovo cambio si" });
          return;
        }
        meAcquisisci(slug, uff, circuito);
      });
    });
  }
  // ACQUISISCI: la formazione ufficiale letta diventa la formazione della lega in FVM (come dopo Salva formazione).
  // Poi, solo per le squadre del circuito, il normale controllo FLE. Nessun invio: il PASSO 3 resta da confermare.
  function meAcquisisci(slug, uff, controllaFle) {
    var nomi = {};
    uff.titolari.concat(uff.panchina).forEach(function (pid) { var x = uff.nomi[pid] || info[pid]; if (x) nomi[pid] = { n: x.n || "", r: Number(x.r || 0) }; });
    var corpo = { idcomp: uff.comp, tid: uff.tid, mday: uff.giornata, cmday: uff.giornataSA, mdl: uff.modulo, starts: uff.titolari.slice(), bench: uff.panchina.slice(), capt: uff.capt };
    var dati = { at: Date.now(), lega: slug, suFle: false, modulo: uff.modulo, titolari: uff.titolari.slice(), panchina: uff.panchina.slice(), cambiata: false,
      tid: uff.tid, comp: uff.comp, capt: uff.capt, corpo: JSON.stringify(corpo), nomi: nomi, ok: true, fonte: "acquisizione",
      sw: uff.sw || null }; // PROVA8: Switch della formazione ufficiale acquisita
    if (uff.sw) swRegistra(fvmMeChiave(slug, uff), uff.sw, "acquisizione");
    var map = trovaFleTid(uff.tid);
    if (map) { dati.fleTid = map.fleTid; dati.squadra = map.squadra; }
    scrivi("ultima", dati);
    var flePrima = leggi("fle", {}) || {};
    scrivi("fle", { stato: "attesa", comp: Number(flePrima.comp || 0), compName: flePrima.compName || "", tid: Number(flePrima.tid || 0), squadra: flePrima.squadra || "" });
    if (leggi("modo", "lega_fle") !== "lega_fle") { scrivi("modo", "lega_fle"); log("MODO", { a: "lega_fle", perche: "acquisizione modifica esterna" }); }
    meRegistra(slug, uff, "acquisizione");
    fvmMeDiag(uff, slug).forEach(function (riga) { meLog("ACQUISITA", riga); });
    apriPannello();
    avviso("Formazione ufficiale acquisita ✓");
    if (controllaFle && map) setTimeout(function () { avviaControlloFle("modifica esterna"); }, 1400);
  }
  function meComando() {
    try {
      var m = String(location.hash || "").match(/fvm-me=(0|1|stato|controlla)/);
      if (!m) return;
      if (m[1] === "0") localStorage.setItem(PREFISSO + "me_spenta", "1");
      if (m[1] === "1") localStorage.removeItem(PREFISSO + "me_spenta");
      // per il collaudo: controllo subito sulla lega aperta, senza attendere i 5 minuti
      if (m[1] === "controlla") { var u = leggi("me_ultimo", {}) || {}, sl = slugDaPagina(); if (sl) { delete u[sl]; scrivi("me_ultimo", u); } setTimeout(function () { meControlla("comando di prova"); }, 1500); }
      var stato = meAttiva() ? "ATTIVO" : "SPENTO";
      meLog("INTERRUTTORE", { comando: m[1], stato: stato, predefinito: ME_PREDEFINITA });
      avviso("Controllo modifiche esterne: " + stato);
    } catch (e) {}
  }
  // aggancio al salvataggio SENZA toccare il motore: salvataggioRiuscito resta identica e viene sempre chiamata,
  // prima si registra (isolato) la formazione conosciuta da FVM
  function meAgganciaSalvataggio() {
    if (salvataggioRiuscito.__fvmMe) return;
    var originale = salvataggioRiuscito;
    salvataggioRiuscito = function (dati, ok, stato, testo) {
      try { meDopoSalvataggio(dati, ok, testo); } catch (e) {}
      return originale.apply(this, arguments);
    };
    salvataggioRiuscito.__fvmMe = true;
  }
  // lega da controllare all'apertura: la lega in uso in FVM se FVM ne conosce la competizione, altrimenti
  // l'ultima lega di cui FVM conosce la formazione (salvata, acquisita o osservata)
  // (all'apertura FVM riparte da LEGA + FLE, che resta sulla lega in uso: si apre sempre quella, se c'e)
  function meLegaDaAprire() {
    var archivio = leggi("me_rif", {}) || {}, lc = String(legaCorrente() || "").toLowerCase(), piu = null;
    if (lc && lc !== FLE_SLUG) return lc;
    Object.keys(archivio).forEach(function (k) { var r = archivio[k]; if (r && r.lega && r.lega !== FLE_SLUG && (!piu || Number(r.at || 0) > Number(piu.at || 0))) piu = r; });
    return piu ? piu.lega : "";
  }
  // APERTURA DALL'ICONA SU UNA PAGINA SENZA LEGA (leghe.fantacalcio.it/ o "Scegli una lega"): solo sulla PRIMA pagina
  // della sessione di Safari, la pagina sotto la Home di FVM passa alla bacheca della lega da controllare, cosi il
  // controllo parte senza toccare nulla. Mai durante accesso, uscita, scelta della lega o altre attivita di FVM.
  function meAvvioSenzaLega() {
    try {
      if (!meAttiva() || piattaformaScelta() !== "fantacalcio") return;
      if (slugDaPagina() || suFle() || meSuLoginVero() || suLogout()) return;
      if (sLeggi("task") || sLeggi("ritorno_login") || sLeggi("uscita") || vaiLegaAttivo() || sLeggi("apro_formazione") || sLeggi("apri_formazione_dopo"))
        return meSalta("apertura", "pagina senza lega durante un'attivita di FVM: nessun cambio di pagina");
      // altre finestre di FVM aperte (es. scelta della lega FLE dell'account): non tocco nulla
      var aperte = radice && radice.querySelectorAll ? Array.prototype.filter.call(radice.querySelectorAll(".ov"), function (e) { return e !== pannello && e.id !== "fvm-me"; }) : [];
      if (aperte.length) return meSalta("apertura", "pagina senza lega con una scelta di FVM aperta: nessun cambio di pagina");
      // la pagina pubblica puo mostrare "Accedi" anche con l'accesso attivo: lo stato vero si vede nella pagina della lega
      // (se la sessione e scaduta il sito chiede il login e, dopo l'accesso, torna la Home di FVM con i dati intatti)
      var conAccedi = !!elementoTesto(/^accedi$/i);
      var lega = meLegaDaAprire();
      if (!lega) return meSalta("apertura", "pagina senza lega e nessuna lega conosciuta da FVM: nessun controllo");
      if ((sLeggi("me_viste") || {})[lega]) return;
      meLog("APERTURA", { lega: lega, azione: "pagina senza lega: apro la bacheca della lega per il controllo (sola lettura)", accediSulSito: conAccedi });
      location.assign("https://leghe.fantacalcio.it/" + lega + "/view/dashboard");
    } catch (e) {}
  }
  // APERTURA DALL'ICONA (o da una scheda nuova): prima pagina della sessione di Safari, senza pagina di provenienza.
  // Deve comparire la Home di FVM, MAI il campo. Se l'apertura arriva su una pagina formazione che FVM non ha chiesto
  // (icona creata sul campo, oppure ritorno a LEGA + FLE che porta alla formazione della lega in uso), la pagina passa
  // subito alla bacheca della lega in uso, dove si apre la Home (e il controllo delle modifiche esterne).
  // Il campo resta per FAI O MODIFICA, SOLO LEGA, SOLO FLE, accesso e passaggi da Fantaclub (che hanno una provenienza).
  var ME_APERTURA_MS = 60000;
  function meCampoChiesto() {
    return !!(sLeggi("apro_formazione") || sLeggi("apri_formazione_dopo") || sLeggi("vai_lega") || sLeggi("vai_campo_fle") || sLeggi("vai") || sLeggi("task") || sLeggi("ritorno_login"));
  }
  function meAvvioIcona(primaPagina) {
    try {
      if (primaPagina) iconaHomeDaIcona(document.referrer); // G1
      if (primaPagina && (!document.referrer || meDaPagineFvm(document.referrer))) { sScrivi("apertura_icona", { at: Date.now(), n: 0 }); log("APERTURA", { pagina: location.pathname, da: document.referrer ? "icona FVM (pagina dell'icona)" : "icona o scheda nuova" }); }
      var a = sLeggi("apertura_icona");
      if (!a) return false;
      if (Date.now() - Number(a.at || 0) > ME_APERTURA_MS) { sScrivi("apertura_icona", null); return false; }
      if (suLogin() || suLogout()) return false;
      // arrivati su una pagina della lega che non e il campo: apertura conclusa (la Home si apre qui)
      if (!suFormazione()) { if (slugDaPagina()) sScrivi("apertura_icona", null); return false; }
      // campo chiesto davvero (FAI O MODIFICA, SOLO LEGA, SOLO FLE, attivita FVM, accesso): nessun intervento
      if (meCampoChiesto()) { sScrivi("apertura_icona", null); return false; }
      if (Number(a.n || 0) >= 2) { sScrivi("apertura_icona", null); return false; } // mai piu di due passaggi
      a.n = Number(a.n || 0) + 1; sScrivi("apertura_icona", a);
      var lc = String(legaCorrente() || "").toLowerCase(), sl = slugDaPagina(), dest = lc && lc !== FLE_SLUG ? lc : sl && sl !== FLE_SLUG ? sl : "";
      log("APERTURA", { da: location.pathname, a: dest ? "/" + dest + "/view/dashboard" : "/", motivo: "apertura dall'icona: Home di FVM, non il campo" });
      location.replace("https://leghe.fantacalcio.it/" + (dest ? dest + "/view/dashboard" : ""));
      return true;
    } catch (e) { return false; }
  }
  // ---------------------------------------------------------------- ICONA FVM E ACCESSO A LEGHE (1.3.1)
  // Pagine FVM (guida e pagina dell'icona) su GitHub Pages. La copia per il collaudo LAN cambia SOLO questa riga.
  var FVM_PAGINE = "https://fabrizioercole70.github.io/FantaViceMister/";
  function meOrigine(u) { try { return new URL(u).origin; } catch (e) { return ""; } }
  // aperta da una pagina FVM (pagina dell'icona app.html o guida): vale come apertura dall'icona
  function meDaPagineFvm(rif) { var o = meOrigine(rif); return !!o && (o === meOrigine(FVM_PAGINE) || o === "https://fabrizioercole70.github.io"); }
  // METTI FVM SULLA HOME: pagina dell'icona con la lega in uso. Nell'indirizzo va SOLO il nome della lega (gia
  // presente in ogni indirizzo del sito): nessun dato personale, nessun accesso. L'icona poi apre la bacheca della lega.
  function meIconaHome() {
    var lega = piattaformaScelta() === "fantacalcio" ? String(legaCorrente() || "").toLowerCase() : "";
    if (!/^[a-z0-9-]{1,100}$/.test(lega) || lega === FLE_SLUG) lega = "";
    var url = FVM_PAGINE + "app.html" + (lega ? "?lega=" + encodeURIComponent(lega) : "");
    log("ICONA HOME", { lega: lega || "nessuna (apre leghe.fantacalcio.it)", pagina: url });
    chiudiPannello();
    location.assign(url + "#prepara");
  }
  // ---------------------------------------------------------------- G1 COMPLETA L'INSTALLAZIONE (icona sulla Home)
  // iOS non fa sapere a una pagina se la sua icona e sulla Home: FVM decide SOLO da fatti certi, memorizzati su questo
  // iPhone (memoria di leghe.fantacalcio.it, dove l'icona riporta sempre). Stato "icona_home":
  //  - da_fare: prima installazione (nessun dato FVM precedente) -> messaggio sotto CONNESSO;
  //  - aperta: premuto METTI FVM SULLA HOME (pagina dell'icona aperta) -> messaggio ridotto, finche non arriva la prova;
  //  - fatta: FVM aperto dall'icona (pagina dell'icona app.html -> Leghe, prima pagina della scheda) oppure conferma
  //    esplicita HO GIA L'ICONA FVM SULLA HOME;
  //  - gia_presente: FVM era gia in uso su questo iPhone prima di questa versione -> nessun messaggio.
  // Nessun dato personale, nessuna lettura di cookie; il pulsante METTI FVM SULLA HOME fa esattamente quello di prima.
  var ICONA_PROVA = /-G\d/.test(VERSIONE); // solo copie private di collaudo: pulsante per rivedere il messaggio
  var ICONA_DATI_PRIMA = ["versione_usata", "benvenuto_ok", "lega_sorgente", "ultima", "fc_lega", "agg_info", "invii"];
  function iconaHomeInizio() {
    if (location.hostname !== DOMINI_FVM.leghe || leggi("icona_home", null)) return;
    var prima = ICONA_DATI_PRIMA.filter(function (k) { return leggi(k, null) != null; });
    scrivi("icona_home", { stato: prima.length ? "gia_presente" : "da_fare", at: Date.now() });
    log("ICONA HOME", { stato: prima.length ? "gia_presente" : "da_fare", motivo: prima.length ? "FVM gia usato su questo iPhone (" + prima.slice(0, 3).join(", ") + "): nessun messaggio" : "prima installazione: messaggio COMPLETA L'INSTALLAZIONE" });
  }
  function iconaHomeStato() { var s = leggi("icona_home", null); return s && s.stato || ""; }
  function iconaHomeDaCompletare() { var st = iconaHomeStato(); return location.hostname === DOMINI_FVM.leghe && (st === "da_fare" || st === "aperta"); }
  function iconaHomeSegna(stato, come) {
    var s = leggi("icona_home", null) || {};
    if (s.stato === stato) return;
    scrivi("icona_home", { stato: stato, at: Date.now(), come: String(come || "").slice(0, 60), prima: s.stato || "" });
    log("ICONA HOME", { stato: stato, da: s.stato || "nessuno", come: come || "" });
  }
  // prima pagina della scheda arrivata dalla pagina dell'icona: app.html (indirizzo completo) in ogni caso; dalle pagine FVM
  // in genere (solo l'origine) soltanto dopo METTI FVM SULLA HOME. Un indirizzo digitato (nessuna provenienza) non basta.
  function iconaHomeDaIcona(rif) {
    try {
      var st = iconaHomeStato();
      if (location.hostname !== DOMINI_FVM.leghe || (st !== "da_fare" && st !== "aperta") || !rif || !meDaPagineFvm(rif)) return;
      var daApp = /\/app\.html(\?|#|$)/.test(new URL(rif).pathname + "");
      if (daApp || st === "aperta") iconaHomeSegna("fatta", daApp ? "aperto dall'icona (app.html)" : "aperto dalle pagine FVM dopo METTI FVM SULLA HOME");
    } catch (e) {}
  }
  // messaggio sotto CONNESSO: solo prima configurazione, solo con l'accesso attivo, solo su Leghe Fantacalcio
  function iconaHomeMessaggio(connessoOra) {
    if (!connessoOra || !iconaHomeDaCompletare()) return "";
    var aperta = iconaHomeStato() === "aperta";
    var lega = piattaformaScelta() === "fantacalcio" ? String(legaCorrente() || "").toLowerCase() : "x";
    return "<div class='cd' style='border:2px solid #e2b33c'><div class='lb' style='color:#e2b33c'>COMPLETA L'INSTALLAZIONE</div>" +
      (aperta
        ? "<div class='mu' style='margin-top:6px'>Hai già aggiunto l'icona? Apri Fanta Vice Mister toccando l'icona <b>FVM</b> sulla Home del tuo iPhone: questo messaggio sparisce da solo.</div>" +
          "<div class='mu' style='margin-top:6px'>Non l'hai ancora aggiunta? Scorri verso il basso e premi <b>METTI FVM SULLA HOME</b>, sotto <b>CONDIVIDI DIAGNOSI</b>.</div>"
        : "<div class='mu' style='margin-top:6px;font-size:15px;color:#fff'>Completa l'installazione sul tuo iPhone. Scorri verso il basso e premi <b>METTI FVM SULLA HOME</b>, sotto <b>CONDIVIDI DIAGNOSI</b>.</div>") +
      (!lega || lega === FLE_SLUG ? "<div class='mu' style='margin-top:6px'>Consiglio: prima entra nella tua lega con <b>CAMBIA LEGA</b>, così l'icona aprirà direttamente la tua lega.</div>" : "") +
      "<button class='bt' style='font-size:13px;color:#aab3c2' data-a='icona_gia'>HO GIÀ L'ICONA FVM SULLA HOME</button></div>";
  }
  // Stato dell'accesso a Leghe, ricavato SOLO da risposte reali del sito (mai cookie o token):
  // - accesso verificato: una lettura della formazione con risposta 2xx;
  // - sessione scaduta: risposta 401/403, oppure il sito porta a /login dalla pagina di una lega.
  var ME_SCADUTA_MS = 30 * 60000, ME_ACCESSO_OK_MS = 12 * 3600000;
  // 1.3.2: pagina di login VERA = indirizzo di login oppure un campo password VISIBILE. La pagina pubblica di Leghe
  // (leghe.fantacalcio.it/) inserisce da sola, dopo ~2 s, un modulo di login NASCOSTO (form#formLogin in una finestra
  // chiusa): per suLogin() di base diventava "pagina di login" (falsa disconnessione). suLogin() resta invariata.
  function meSuLoginVero() {
    if (/login|accedi|registr|password/i.test(location.pathname)) return true;
    try { return Array.prototype.some.call(document.querySelectorAll('input[type="password"]'), function (e) { return e.offsetParent !== null; }); } catch (e) { return false; }
  }
  function meSegnaAccesso(ok, motivo) {
    if (ok) { scrivi("leghe_ok_at", Date.now()); if (leggi("sessione_scaduta", null)) scrivi("sessione_scaduta", null); return; }
    scrivi("sessione_scaduta", { at: Date.now(), motivo: String(motivo || "").slice(0, 80) });
    log("ACCESSO", { esito: "sessione scaduta", motivo: motivo, dati: "i dati FVM restano (lega, formazioni, storico)" });
  }
  function meSessioneScaduta() {
    var s = leggi("sessione_scaduta", null), at = Number(s && s.at || 0);
    return !!at && Date.now() - at < ME_SCADUTA_MS && at > Number(leggi("leghe_ok_at", 0) || 0);
  }
  function meAccessoRecente() { var t = Number(leggi("leghe_ok_at", 0) || 0); return !!t && Date.now() - t < ME_ACCESSO_OK_MS && !meSessioneScaduta(); }
  // il sito porta a /login dalla pagina di una lega (sessione scaduta): dopo l'accesso torna la Home di FVM, dati intatti.
  // Esclusi: uscita voluta (CHIUDI, DISCONNETTI, /logout) e accesso gia avviato da FVM.
  function meRimbalzoLogin() {
    try {
      if (!meSuLoginVero()) { sScrivi("me_pagina_prec", { p: location.pathname, at: Date.now() }); return; }
      var u = sLeggi("me_pagina_prec");
      sScrivi("me_pagina_prec", null);
      if (!u || Date.now() - Number(u.at || 0) > 120000 || !/^\/[^\/]+\/view\//.test(String(u.p || "")) || /^\/logout/i.test(String(u.p || ""))) return;
      if (sLeggi("uscita") || sLeggi("ritorno_login")) return;
      meSegnaAccesso(false, "il sito ha chiesto l'accesso dalla pagina della lega");
      sScrivi("ritorno_login", { daFvm: true, at: Date.now(), motivo: "sessione scaduta" });
    } catch (e) {}
  }
  // Aggancio a connesso() e accedi() SENZA toccarle (restano identiche e vengono sempre usate):
  // - pagina della lega con sessione scaduta: non connesso (prima risultava sempre connesso);
  // - pagina pubblica di Leghe (es. leghe.fantacalcio.it/) con il pulsante "Accedi" del sito, ma accesso verificato
  //   nelle ultime 12 ore e nessuna scadenza: connesso (niente falsa disconnessione);
  // - ACCEDI con sessione scaduta: nuovo accesso SENZA cancellare i dati di FVM (stesso account). In tutti gli altri
  //   casi ACCEDI resta quello di sempre (con l'azzeramento dei dati per un possibile altro account).
  function meAgganciaAccesso() {
    if (connesso.__fvmMe) return;
    var cOrig = connesso, aOrig = accedi;
    connesso = function () {
      if (slugDaPagina() && meSessioneScaduta()) return false;
      var c = cOrig.apply(this, arguments);
      if (!c && !slugDaPagina() && !meSuLoginVero() && meAccessoRecente()) return true;
      return c;
    };
    connesso.__fvmMe = true;
    accedi = function () {
      if (!meSessioneScaduta()) return aOrig.apply(this, arguments);
      chiudiPannello();
      sScrivi("ritorno_login", { daFvm: true, at: Date.now(), motivo: "sessione scaduta" });
      log("ACCESSO", "sessione scaduta: apro /login, dati FVM conservati");
      location.assign("https://leghe.fantacalcio.it/login");
    };
  }
  function meInstalla() {
    if (location.hostname !== "leghe.fantacalcio.it") return;
    meRimbalzoLogin();
    meAgganciaAccesso();
    meAgganciaIntestazioni();
    // prima pagina di questa sessione di Safari (apertura dall'icona o da una scheda nuova)
    var primaPagina = !sLeggi("me_avvio");
    if (primaPagina) sScrivi("me_avvio", Date.now());
    if (meAvvioIcona(primaPagina)) return; // la pagina sta passando alla bacheca: nient'altro qui
    if (primaPagina) setTimeout(meAvvioSenzaLega, 2500);
    meAgganciaSalvataggio();
    meComando();
    window.addEventListener("hashchange", meComando);
    setTimeout(function () { meControlla("apertura"); }, 4000);
    document.addEventListener("visibilitychange", function () { if (document.visibilityState === "visible") setTimeout(function () { meControlla("ritorno in primo piano"); }, 1500); });
    window.addEventListener("pageshow", function (ev) { if (ev && ev.persisted) setTimeout(function () { meControlla("ritorno in primo piano"); }, 1500); });
    // tocchi e tasti dell'utente (solo l'ora, mai cosa): servono a non mettere l'avviso sopra una compilazione
    ["pointerdown", "touchstart", "keydown", "input"].forEach(function (t) {
      document.addEventListener(t, function () { meToccoAt = Date.now(); }, { capture: true, passive: true });
    });
    // ingresso in una lega (o cambio pagina) senza ricaricare: il sito cambia pagina come SPA
    var meUltimaPagina = location.pathname;
    setInterval(function () {
      if (location.pathname === meUltimaPagina) return;
      meUltimaPagina = location.pathname;
      mePaginaDa = Date.now();
      meRimbalzoLogin();
      setTimeout(function () { meControlla("cambio pagina"); }, 4000);
    }, 1000);
  }

  // ---------------------------------------------------------------- avvio
  var avviato = false;
  function avvia() {
    iconaHomeInizio(); // G1: prima di qualsiasi scrittura dell'avvio
    monta();
    // 1.1.0: a ogni nuova sessione di Safari si riparte da LEGA + FLE (come l'app),
    // salvo un'attivita FLE gia in corso in questa scheda.
    if (!sLeggi("sessione")) {
      sScrivi("sessione", Date.now());
      if (piattaformaScelta() === "fantaclub") {
        if (!sLeggi("task") && leggi("modo", "lega_fle") !== "lega_fle" && !legaLavoro() && !fleNonAssociata()) { scrivi("modo", "lega_fle"); log("MODO", { a: "lega_fle", perche: "nuova sessione" }); }
      } else if (!sLeggi("task") && !legaLavoro()) {
        // 1.3.5 (Leghe Fantacalcio): LEGA + FLE solo con la squadra FLE verificata, altrimenti SOLO LEGA
        var mI = modoInizialeLeghe();
        if (leggi("modo", "lega_fle") !== mI) { scrivi("modo", mI); log("MODO", { a: mI, perche: "nuova sessione" + (mI === "solo_lega" ? " (squadra FLE non verificata)" : "") }); }
        if (mI === "solo_lega" && fleAutorizzatoLeghe().motivo === "identita") sScrivi("modo_attesa_identita", { at: Date.now() }); // 1.3.6-G2
      }
    }
    controllaPagina();
    homeDopoLega(); // 1.3.5 (2° collaudo XR): CAMBIA LEGA senza lega FLE nota
    riconosciSorgente();
    if (applicaBloccoModo("avvio")) return;
    aggiornaFab();
    aggiornaBarra();
    if (avviato || !document.body) return;
    avviato = true;
    setTimeout(function () { aggControlla(false); }, 3000); // 1.3.4: aggiornamento.json (al massimo ogni 6 ore)
    setTimeout(aggiornaPartecipanti, 8000); // S5: squadre e allenatori della lega aperta (max 1 volta al giorno)
    // 1.1.0: uscita in corso: su /logout non si apre nulla; su /login si registra la fine dell'uscita
    uscitaCompletata();
    if (suLogout()) return;
    var task = sLeggi("task");
    if (task && Date.now() - Number(task.inizio || 0) > 180000) { log("ATTIVITA SCADUTA", task.tipo); sScrivi("task", null); task = null; }
    // S6: controllo ufficiale di una lega Leghe Fantacalcio (dati della lega, poi regola in Opzioni di Lega)
    if (task && task.tipo === "lega") {
      var pzL = location.pathname.split("/");
      if (task.fase === "dati" && pzL[1] === task.slug && !/\/settings/.test(location.pathname)) { eseguiControlloLega(task); return; }
      if (task.fase === "regole" && pzL[1] === task.slug && /\/settings/.test(location.pathname)) { leggiRegolaLega(task); return; }
    }
    // 1.3.5: VERIFICA SQUADRA FLE (sola lettura): pagina formazione della lega, poi FLE (competizioni, pagina formazione)
    if (task && task.tipo === "verifica") {
      if (suFle()) {
        if (task.fase === "select_fle") { task.fase = "dash"; sScrivi("task", task); log("SELETTORE FLE", { azione: "FLE raggiunta · verifica", url: location.pathname }); }
        eseguiVerificaFle(task); return;
      }
      var mV = location.pathname.match(/^\/([^\/]+)\/view\/competition\/(\d+)\/lineup/);
      if (task.fase === "lega" && mV && mV[1] === task.lega) { eseguiVerificaLega(task); return; }
      if (task.fase === "select_fle") { selezionaFleNelSelettore(task); return; }
      if (task.fase === "lega" && !suLogin()) return; // pagina della lega: si apre da sola la sua formazione (controllaPagina)
    }
    if (task && suFle()) {
      if (task.tipo === "admin") { eseguiConsegne(task); return; }
      if (task.tipo === "turno") { eseguiTurni(task); return; } // RC3: CONSEGNE FLE PER COMPETIZIONE E TURNO (sola lettura)
      if (task.tipo === "check") {
        // Safari puo completare il cambio lega con una navigazione prima che il timer
        // del selettore riesca a cambiare fase. Se siamo gia dentro FLE, il cambio
        // e riuscito: passa sempre alla fase di discovery delle competizioni.
        if (task.fase === "select_fle") {
          task.fase = "dash"; sScrivi("task", task);
          log("SELETTORE FLE", { azione: "FLE raggiunta · avvio discovery", url: location.href });
        }
        eseguiControllo(task); return;
      }
      if (task.tipo === "invio") { eseguiInvio(task); return; }
      if (task.tipo === "riverifica") { eseguiRiverifica(task); return; } // PROVA11: RIPROVA VERIFICA, solo letture
    }
    // Rientro automatico dopo il login: Leghe Fantacalcio porta normalmente
    // al selettore delle leghe; se l'accesso era stato avviato da FVM,
    // copriamo quel selettore riaprendo subito la home di Fanta Vice Mister.
    var ritornoLogin = sLeggi("ritorno_login");
    if (ritornoLogin && !suLogin() && !elementoTesto(/^accedi$/i)) {
      sScrivi("ritorno_login", null);
      log("ACCESSO", "login riuscito · ritorno automatico a FVM");
      apriPannello();
      return;
    }
    // 1.1.0 Fantaclub: formazione consegnata in LEGA + FLE -> Home, poi controllo FLE da solo (come dopo Salva formazione)
    var fcDopo = sLeggi("fc_controllo_dopo");
    if (fcDopo) {
      sScrivi("fc_controllo_dopo", null);
      if (Date.now() - Number(fcDopo) < 60000 && piattaformaScelta() === "fantaclub") {
        var flashFc = sLeggi("flash");
        sScrivi("apri", null); sScrivi("flash", null);
        apriPannello();
        if (flashFc) avviso(flashFc);
        setTimeout(function () { avviaControlloFc("dopo la consegna"); }, 1400);
        return;
      }
    }
    var apri = sLeggi("apri"), flash = sLeggi("flash");
    sScrivi("apri", null); sScrivi("flash", null);
    if (apri === "admin") { apriAdmin(); return; }
    if (apri === "turni") { apriTurni(); return; } // RC3
    if (apri === "ufficiale") { apriUfficiale(); return; }
    if (apri === "main") { apriPannello(); if (flash) avviso(flash); return; }
    if (suFle() && sLeggi("vai_campo_fle")) { controllaPagina(); return; }
    // 1.1.0: SOLO LEGA · ALTRA LEGA…: lascio libero il selettore leghe del sito.
    if (vaiLegaAttivo() && !suFormazione()) { avviso("Scegli la lega: poi apro la sua formazione."); return; }
    if (!suFormazione() && !suLogin()) apriPannello();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", avvia); else avvia();
  window.addEventListener("load", avvia);
  try { meInstalla(); } catch (e) {} // modifiche esterne: controllo all'apertura e al ritorno in primo piano
  var ultimaPagina = location.pathname;
  setInterval(function () {
    if (!host || !host.isConnected) { host = null; radice = null; pannello = null; fab = null; barra = null; fascia = null; monta(); }
    aggiornaFab();
    aggiornaBarra();
    // 1.1.0: pagina "Scegli una lega": lega sorgente dall'account collegato (si attiva solo su quella pagina)
    riconosciSorgente();
    // 1.0.1: se lo stato di accesso cambia dopo il caricamento della pagina, aggiorna la schermata
    if (pannello && pannelloPrincipale && ultimoConn !== null && connesso() !== ultimoConn) aggiornaPannello();
    if (location.pathname !== ultimaPagina) {
      ultimaPagina = location.pathname;
      log("PAGINA", ultimaPagina);
      uscitaCompletata();
      controllaPagina();
      homeDopoLega();
      if (sLeggi("ritorno_login") && !suLogin() && !elementoTesto(/^accedi$/i)) {
        sScrivi("ritorno_login", null);
        log("ACCESSO", "gia collegato · ritorno automatico a FVM");
        apriPannello();
      }
      // 0.3.7: il selettore di Leghe Fantacalcio cambia pagina come SPA.
      // Il blocco modalita deve quindi scattare anche dopo un cambio manuale
      // effettuato mentre il pannello FVM e chiuso, non solo all'avvio/FVM.
      if (applicaBloccoModo("cambio manuale selettore")) return;
    } else {
      // Copre anche i cambi del selettore che aggiornano lo stato della SPA
      // prima/oltre il pathname. Nessun effetto durante i task FLE autorizzati.
      if (applicaBloccoModo("sorveglianza selettore")) return;
    }
  }, 500);
})();
