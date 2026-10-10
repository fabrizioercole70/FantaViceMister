// ==UserScript==
// @name         Fanta Vice Mister
// @description  Fanta Vice Mister per Safari (iPhone e Mac) e browser PC: ordine della panchina, controllo e invio su FLE, area admin.
// @version      1.3.3
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
    try { document.documentElement.setAttribute("data-fvm-versione", "1.3.3"); } catch (e) {}
    return;
  }
  if (window.__FVM_SAFARI__) return;
  window.__FVM_SAFARI__ = true;

  var VERSIONE = "1.3.3";
  var PREFISSO = "fvm_";

  // ---------------------------------------------------------------- 1.1.0 Fantaclub · fase 2: passaggio tra domini
  // Safari tiene separati i dati di leghe.fantacalcio.it e www.fantaclub.it. FVM passa SOLO i propri dati
  // nel frammento #fvm=… dell'indirizzo (il frammento non viene mai inviato ai server): chi riceve lo legge
  // all'avvio (prima del sito), lo cancella subito dall'indirizzo e lo valida (versione, tipo, origine,
  // destinazione, eta, chiavi). Mai credenziali, cookie, token o dati di sessione.
  var DOMINI_FVM = { leghe: "leghe.fantacalcio.it", fantaclub: "www.fantaclub.it" };
  // tipo -> unico dominio che puo riceverlo (fase 3: richiesta di accesso Fantaclub e conferma di accesso riuscito;
  // fase 4: uscita da Fantaclub e suo esito)
  var TIPI_PASSAGGIO = { "prova": "fantaclub", "prova-ritorno": "leghe", "accedi": "fantaclub", "login-ok": "leghe",
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
  //  - Leghe: canale ("inviata via app"), recupero dal server e intervento admin NON hanno un campo dimostrato:
  //    DATO NON DISPONIBILE. "coaches[].admin" non indica l'amministratore (vale 0 per un admin reale): non usato.
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

  // ---- LEGHE: stato di ogni squadra in una giornata (solo cio che i dati dimostrano)
  // input: { turno:{matchDay, championshipMatchDay, matches:[{tIdH,tIdA}]}, formazioni:[righe teamLineup],
  //          squadre:{tid:{nome, allenatori:[...]}}, nonCalcolate:[matchDay...], giornataSerieA (status.mday),
  //          inizioGiornata (status.mstr, solo per la giornata corrente), regola, ora }
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
    var righe = ids.map(function (tid) {
      var s = (I.squadre || {})[tid] || {}, l = per[tid], r = { tid: tid, squadra: s.nome || FVM_ND, allenatori: (s.allenatori || []).slice(0, 3) };
      if (l) {
        var d = fvmDataUtc(l.ldate);
        r.stato = "presente";
        r.ora = d ? fvmOraRoma(d, true) : FVM_ND;
        r.modulo = String(l.mdl || l.nmdl || "").replace(/\D/g, "");
        r.invisibile = l.visb === false;
        // provenienza: con la regola "Recupera formazione precedente" una formazione presente puo essere recuperata dal server
        r.provenienza = recupero ? "consegnata o recuperata dal server: " + FVM_ND + " (i dati letti non lo distinguono)" : FVM_ND + " (canale e intervento admin non indicati nei dati letti)";
      } else if (fase === "calcolata") { r.stato = "assente"; r.nota = "nessuna formazione nei dati ufficiali della giornata calcolata"; }
      else if (fase === "da_calcolare") { r.stato = "assente_provvisorio"; r.nota = "giornata non ancora calcolata: dato provvisorio"; }
      else if (fase === "consegna_aperta" || fase === "in_corso") { r.stato = "in_attesa"; r.nota = "formazioni altrui visibili solo dopo la scadenza o con l'area admin"; }
      else if (fase === "futura") { r.stato = "futura"; }
      else { r.stato = "non_verificabile"; r.nota = FVM_ND; }
      return r;
    });
    var conta = {}; righe.forEach(function (r) { conta[r.stato] = (conta[r.stato] || 0) + 1; });
    return { fase: fase, giornataLega: Number(t.matchDay || 0), giornataSerieA: sa, inizio: inizio ? fvmOraRoma(inizio) : "", righe: righe, conta: conta, squadre: ids.length };
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
    Object.keys(voci).forEach(function (k) { var i = (righe || []).indexOf(voci[k]); if (i >= 0 && righe[i + 1] != null) V[k] = String(righe[i + 1]); });
    V.letta = !!V.mancataConsegna;
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
    var p = el("presente"); if (p.length) { righe.push("🟢 Formazione presente (" + p.length + ")"); p.forEach(function (r) { righe.push("• " + r.squadra + " · salvata " + r.ora + (r.invisibile ? " · invisibile" : "")); }); righe.push(""); }
    var a = el("assente"); if (a.length) { righe.push("🔴 Nessuna formazione (giornata calcolata) (" + a.length + ")"); a.forEach(function (r) { righe.push("• " + r.squadra); }); righe.push(""); }
    var ap = el("assente_provvisorio"); if (ap.length) { righe.push("🟠 Nessuna formazione, giornata da calcolare (" + ap.length + ")"); ap.forEach(function (r) { righe.push("• " + r.squadra); }); righe.push(""); }
    var w = el("in_attesa"); if (w.length) { righe.push("⏳ In attesa / non ancora visibili (" + w.length + ")"); w.forEach(function (r) { righe.push("• " + r.squadra); }); righe.push(""); }
    var n = el("non_verificabile").concat(el("futura")); if (n.length) { righe.push("❔ Non verificabili (" + n.length + ")"); n.forEach(function (r) { righe.push("• " + r.squadra); }); righe.push(""); }
    righe.push("Canale di invio, recupero dal server e interventi admin: " + FVM_ND + ".");
    return righe.join("\n");
  }
  function fvmReportFc(R) {
    var S = R.stato || {}, el = function (st) { return (S.righe || []).filter(function (r) { return r.stato === st; }); };
    var righe = ["📋 CONTROLLO CONSEGNE · " + R.lega + " (Fantaclub)", "Giornata " + (S.giornata || "?") + " (numerazione del sito)",
      "Controllo: " + (R.quando || "") + " · fonte: pagine ufficiali della lega", "Mancata consegna (regola della lega): " + (R.regola && R.regola.mancataConsegna ? R.regola.mancataConsegna : FVM_ND), ""];
    var c = el("consegnata"); if (c.length) { righe.push("🟢 Consegnate (" + c.length + ")"); c.forEach(function (r) { righe.push("• " + r.squadra + " (" + r.account + ") · " + r.ora + (r.canale && r.canale !== FVM_ND ? " · tramite " + r.canale : "")); }); righe.push(""); }
    var nc = el("non_consegnata"); if (nc.length) { righe.push("🔴 Senza formazione, elenco ufficiale (" + nc.length + ")"); nc.forEach(function (r) { righe.push("• " + r.squadra + " (" + r.account + ")"); }); righe.push(""); }
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
  function eseguiControlloFc(msg) {
    var dati = msg.dati || {}, nl = NL_VALIDO.test(String(dati.nl || "")) ? String(dati.nl) : "";
    var giornata = /^\d{1,2}$/.test(String(dati.giornata || "")) ? String(dati.giornata) : "";
    var esito = { richiesta: msg.id, nl: nl, quando: Date.now(), errori: [] };
    var box = null;
    function stato(t) {
      try {
        if (!box && document.body) { box = document.createElement("div"); box.style.cssText = "position:fixed;left:0;right:0;top:0;z-index:2147483647;background:#0b1730;color:#fff;font:600 15px -apple-system,Arial;padding:18px;border-bottom:3px solid #e2b33c;text-align:center"; document.body.appendChild(box); }
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
    setTimeout(function () {
      stato("leggo le regole della lega…");
      pagina("/servlet/Informazioni" + q).then(function (p) {
        var I = fvmRigheHtml(p.testo);
        if (I.righe.indexOf("Informazioni generali") < 0) throw new Error("accesso a Fantaclub non attivo o lega non accessibile con questo account");
        esito.regola = fvmFcInfo(I.righe);
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
        if (!giornata) return null;
        stato("leggo la giornata " + giornata + "…");
        return pagina("/servlet/FormazioniPassate" + q + "&giornata=" + giornata);
      }).then(function (p) {
        if (p) { var Pa = fvmRigheHtml(p.testo); esito.giornataPrecedente = fvmFcPassate(Pa.righe, (esito.squadre || []).map(function (x) { return x.squadra; })); esito.giornataRichiesta = giornata; }
        stato("leggo l'account collegato…");
        return pagina("/servlet/FormazioniReport");
      }).then(function (p) {
        var t = fvmRigheHtml(p.testo).titolo, m = /Report formazioni di (.+)$/.exec(t);
        if (m) esito.account = m[1].trim().slice(0, 40);
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
          if (!m.paused && !gestoSu(m)) { m.pause(); conta.play++; logAudio("partenza automatica impedita"); }
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
            if (mediaPub(this)) { fermaMedia(this); conta.play++; logAudio("pubblicita fermata"); return bloccato(); }
            preparaLettore(this);
            // partenza automatica (nessun tocco su questo lettore): non parte, come la politica autoplay di Safari
            // (dopo un Play dell'utente il lettore puo richiamare play() poco dopo: caricamento, pre-roll; vale finche
            // l'utente non preme Pausa)
            if (gestoSu(this)) this.__fvmUtente = true;
            if (!this.__fvmUtente) { try { this.pause(); } catch (e) {} conta.play++; logAudio("partenza automatica impedita"); return bloccato(); }
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
          if (mediaPub(m)) { fermaMedia(m); conta.play++; logAudio("pubblicita fermata"); return; }
          preparaLettore(m);
          if (gestoSu(m)) m.__fvmUtente = true;
          if (!m.__fvmUtente) { m.pause(); conta.play++; logAudio("partenza automatica impedita"); return; }
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
          if (!mediaPub(m) && gestoVolume(m)) { m.__fvmAudioOk = true; logAudio("audio attivato dall'utente"); return; }
          m.muted = true; logAudio("audio non richiesto rimesso muto");
        } catch (e) {}
      };
      var audioLoggato = {};
      var logAudio = function (cosa) { if (audioLoggato[cosa]) return; audioLoggato[cosa] = 1; logFc("FANTACLUB AUDIO", { esito: cosa }); };
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
        righe.push("FVM " + VERSIONE + " · ANALISI " + new Date().toLocaleTimeString("it-IT") + " · " + location.hostname + location.pathname);
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
        } catch (e) {}
      }, 4000);
    }
    var arrivo = riceviPassaggio();
    var prova = null;
    if (arrivo) {
      if (arrivo.ok && arrivo.msg.tipo === "prova") prova = { id: arrivo.msg.id };
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
      logFc("PASSAGGIO", arrivo.ok ? { tipo: arrivo.msg.tipo, esito: "ricevuto", ms: arrivo.eta } : { tipo: arrivo.tipo || "", esito: "scartato", motivo: arrivo.motivo });
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
      if (!c || statoLegaFc(c) !== "fuori" || c.modo === "solo_lega") return;
      c.modo = "solo_lega"; salvaConsegna(c);
      logFc("FANTACLUB MODO", { modo: "solo_lega", perche: "lega fuori dal circuito FLE" });
    }
    function fineConsegna() { try { sessionStorage.removeItem(PREFISSO + "fc_consegna"); } catch (e) {} }
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
      // lega effettiva = _nl della pagina Consegna ufficiale aperta: diventa la lega di questa consegna
      // (niente squadre, letture o sid della lega precedente)
      (function adottaLega() {
        var c = consegnaInCorso(), qui = paginaConsegna() ? parametro("_nl") : "";
        if (!c || !NL_VALIDO.test(qui) || qui === c.nl) return;
        logFc("FANTACLUB LEGA", { da: c.nl || "nessuna", a: qui, come: "pagina Consegna aperta" });
        // passaggio da un'altra lega: modalita predefinita (LEGA + FLE) e verifica da rifare
        if (c.nl) { c.modo = "lega_fle"; c.nlVerificata = false; }
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
        c.modo = "lega_fle";
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
        "<div class='b'><span class='t'>FVM</span>" + (prova ? "<span class='ok'>Prova ricevuta ✓</span>" : "") +
        (accessoInCorso() ? "<span>Accedi nella finestra di Fantaclub</span>" : "") +
        (uscitaInCorso() ? "<span>Esco da Fantaclub…</span>" : "") + "<span class='chiudi' id='torna'>CHIUDI</span></div>";
      r.getElementById("torna").addEventListener("click", function () {
        // CHIUDI durante l'accesso: annulla la richiesta (nessun cambio di stato in FVM)
        if (accessoInCorso()) { fineAccesso(); logFc("FANTACLUB ACCESSO", { esito: "annullato con CHIUDI" }); }
        if (uscitaInCorso()) { try { sessionStorage.removeItem(PREFISSO + "fc_esci"); } catch (e) {} logFc("FANTACLUB USCITA", { esito: "annullata con CHIUDI" }); }
        if (prova) {
          // prova di andata e ritorno: rimando a FVM solo l'id della prova e l'esito (dati fittizi)
          logFc("PASSAGGIO", { tipo: "prova-ritorno", esito: "inviato" });
          inviaPassaggio("leghe", "prova-ritorno", { idProva: prova.id, esito: "ricevuta su Fantaclub" }, "/");
        } else ritornaAFvm();
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
            : "<div class='nota'>Apri la pagina Consegna formazione della tua lega: la riconosco da lì.</div>")
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
  var LOGO_FVM = "data:image/jpeg;base64,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";
  // 1.1.0: logo FantaLegaEuropa per il piede della Home (copia ridotta 200x200 di "logo FLE.png", proporzioni originali)
  var LOGO_FLE = "data:image/jpeg;base64,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";
  // Le 80 squadre: [lega, squadra, tid FLE, tid nella lega]
  var SQUADRE = [["LEGA DEL PIANTO","Ideale Bari",4583705,1011789],["LEGA DEL PIANTO","SCHALKE 104",4288743,1013377],["LEGA DEL PIANTO","Zenith Bari",4289115,1017567],["LEGA DEL PIANTO","Ass Paoloneculone",4290965,1037009],["LEGA DEL PIANTO","ANV Football Club 1990",4463113,1744019],["LEGA DEL PIANTO","REPUBBLICA DI GILEAD",4290230,1744043],["LEGA DEL PIANTO","U.S. TICCHIU",4661797,1744087],["LEGA DEL PIANTO","Lino Banfield",4583348,2623328],["LEGA DEL PIANTO","A.S. Vitin",4670912,3252428],["LEGA DEL PIANTO","Frosinone Culone - Sion",4836989,4837414],["TOTA ITALIA AD VICTORIAM","I CAZZARI",3883604,2997692],["TOTA ITALIA AD VICTORIAM","JUVENTUS MANIA",3890986,4629196],["TOTA ITALIA AD VICTORIAM","Real Banana",3856689,4681538],["TOTA ITALIA AD VICTORIAM","Mer Dal",3871740,4700229],["TOTA ITALIA AD VICTORIAM","Mai Una Gioia",7872699,8423265],["TOTA ITALIA AD VICTORIAM","Baker Street",3883077,8426062],["TOTA ITALIA AD VICTORIAM","BAR SPORT UNITED",3881411,15110114],["TOTA ITALIA AD VICTORIAM","FC Boga Juniors",3883797,19074198],["TOTA ITALIA AD VICTORIAM","SALERNO COSTAS",3871852,19092346],["TOTA ITALIA AD VICTORIAM","Fc Er Duce è Laziale",7784769,19191477],["FANTA FOCOLARE 2","Gin toNico",3856500,2583475],["FANTA FOCOLARE 2","Olympique Sartiglia",3876596,2583889],["FANTA FOCOLARE 2","Gol D. Roggero",3874629,2584018],["FANTA FOCOLARE 2","Rutti di Boskov",3872392,2584170],["FANTA FOCOLARE 2","Lokomotiv Sant€Orsola",3874451,2584516],["FANTA FOCOLARE 2","Real MaiPiu",3876601,2586324],["FANTA FOCOLARE 2","Il Santo Osso Sacro Graal Rotto DC",3883257,2589897],["FANTA FOCOLARE 2","La grande fuga di Lameck Banda",3883293,2592285],["FANTA FOCOLARE 2","atlmalitti",3883308,2618905],["FANTA FOCOLARE 2","Ufficio Sinistri zero",3880147,3617383],["FANTAPINTUS LO SCOPRITORE DI BIDONI","I TALENTI DEL PINTO",4186117,1593677],["FANTAPINTUS LO SCOPRITORE DI BIDONI","SS BARLETTA 1922",4192061,1593795],["FANTAPINTUS LO SCOPRITORE DI BIDONI","AS FAL",4189376,1594454],["FANTAPINTUS LO SCOPRITORE DI BIDONI","Companeros FC",4195025,1595003],["FANTAPINTUS LO SCOPRITORE DI BIDONI","Dos Desperados",4189377,1595777],["FANTAPINTUS LO SCOPRITORE DI BIDONI","Piu KOLO che MUANIma",4198164,1596701],["FANTAPINTUS LO SCOPRITORE DI BIDONI","FC INSIEME SI VOLA",4197802,1600002],["FANTAPINTUS LO SCOPRITORE DI BIDONI","Cuesta non e ibiza",4193606,1600221],["FANTAPINTUS LO SCOPRITORE DI BIDONI","AC MILAN",7680238,1604113],["FANTAPINTUS LO SCOPRITORE DI BIDONI","FC CALL OF DIOUF",6716524,6700723],["POLFER","FC R4iNbow",6706486,996915],["POLFER","Cassiopea",6747402,999334],["POLFER","TSN Kawa",6866666,1035252],["POLFER","napoleon",6752548,1039096],["POLFER","A.C. Avanti Cristo",6893193,1193823],["POLFER","Timberwolves",6866782,1632331],["POLFER","AC Devilteam",7262923,1635839],["POLFER","Piotr",6933887,1639195],["POLFER","Stocastico",6716135,6626512],["POLFER","Dinamo Losca",11753918,6626869],["FANTAROCCOLEGENDSPORT","Fellatium",3857314,2070261],["FANTAROCCOLEGENDSPORT","Buon 65 e mezzo",3892660,2072798],["FANTAROCCOLEGENDSPORT","DOFLAMENGO",3892533,2072867],["FANTAROCCOLEGENDSPORT","MANK TOMINAY",3892600,2072884],["FANTAROCCOLEGENDSPORT","AS PILICUETA",3892591,2073171],["FANTAROCCOLEGENDSPORT","Phramba",3894924,2073184],["FANTAROCCOLEGENDSPORT","LOFFENHEIM",3892674,2074942],["FANTAROCCOLEGENDSPORT","No Mercy",3892932,2077210],["FANTAROCCOLEGENDSPORT","DEJAVU",3892726,2079015],["FANTAROCCOLEGENDSPORT","AC Pappo",3894883,5323275],["LEGA DE NOANTRI","Acr Messina",11776923,10224048],["LEGA DE NOANTRI","FLAMENGO",11691923,10225644],["LEGA DE NOANTRI","Barcelona F.C.",11776908,10225765],["LEGA DE NOANTRI","Pennic Hellas",11822953,10227289],["LEGA DE NOANTRI","Super Santos",11708505,10237038],["LEGA DE NOANTRI","Si Puo Fare",6895801,10244150],["LEGA DE NOANTRI","Gingiskan",11858486,10288764],["LEGA DE NOANTRI","Virtus Roma FC",11838514,10374684],["LEGA DE NOANTRI","Boca Junior",11776593,14854829],["LEGA DE NOANTRI","Temptation Haaland",11733123,18944612],["FANTAVALDINIEVOLE","Big Ramblas",7790602,0],["FANTAVALDINIEVOLE","DieghINDA",7794941,0],["FANTAVALDINIEVOLE","Gli Ingiocabili",7784659,0],["FANTAVALDINIEVOLE","MisterTrip",7845790,0],["FANTAVALDINIEVOLE","Never give up",7789410,0],["FANTAVALDINIEVOLE","Press Team",7785027,0],["FANTAVALDINIEVOLE","Real Gongolo",7784760,0],["FANTAVALDINIEVOLE","Sabonis",7802493,0],["FANTAVALDINIEVOLE","The miraculous",7867526,0],["FANTAVALDINIEVOLE","The Rookie",7802273,0]];
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
  // 1.1.0 Fantaclub fase 2: passaggio arrivato da Fantaclub (letto e cancellato dall'indirizzo prima del sito).
  // Per ora solo la prova di andata e ritorno: nella diagnosi va soltanto l'esito, mai i dati.
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
      var esS = nlS && dC.nlVerificata ? fleFantaclubAmmesso(nlS) : fleFantaclubAmmesso("");
      if (!esS.ok) {
        scrivi("modo", "lega_fle");
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
    var attesa = sLeggi("passaggio_prova");
    sScrivi("passaggio_prova", null);
    var giusta = !!(attesa && arrivo.msg.dati && arrivo.msg.dati.idProva === attesa.id);
    log("PASSAGGIO", { tipo: arrivo.msg.tipo, esito: giusta ? "andata e ritorno OK" : "prova non riconosciuta", ms: attesa ? Date.now() - Number(attesa.at || 0) : null });
    sScrivi("apri", "main");
    sScrivi("flash", giusta ? "Prova Fantaclub riuscita ✓ (andata e ritorno)" : "Prova Fantaclub non riconosciuta");
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
  var DATI_ACCOUNT = ["lega_sorgente", "lega", "lega_uso", "ultima", "fle", "solo_lega_salvata", "fle_fantacalcio", "fle_fantaclub"];
  function azzeraDatiAccount(motivo) {
    DATI_ACCOUNT.forEach(function (k) { try { localStorage.removeItem(PREFISSO + k); } catch (e) {} });
    log("LEGA SORGENTE", { azione: "dati account azzerati", motivo: motivo });
  }
  function impostaSorgente(slug, motivo) {
    var prima = leggi("lega_sorgente", "");
    if (prima && prima !== slug) azzeraDatiAccount("lega sorgente cambiata");
    scrivi("lega_sorgente", slug); scrivi("lega", slug);
    log("LEGA SORGENTE", { lega: slug, motivo: motivo, prima: prima || "" });
  }
  function impostaLega(slug) {
    if (!slug || slug === FLE_SLUG) return;
    // 1.1.0: elenco delle leghe dell'account gia visitate (per SOLO LEGA).
    var note = leggi("leghe_note", []);
    if (note.indexOf(slug) < 0) { note.push(slug); scrivi("leghe_note", note.slice(-12)); log("LEGA NOTA", slug); }
    var sorgente = leggi("lega_sorgente", "");
    // La prima lega PREVISTA riconosciuta diventa la sorgente stabile (1.1.0: mai una lega fuori da LEGHE_FONTE).
    // Da qui in poi i passaggi temporanei del selettore non possono sostituirla.
    if (!sorgente) { if (legaPrevista(slug)) impostaSorgente(slug, "prima lega prevista vista"); return; }
    if (sorgente === slug && leggi("lega", "") !== slug) scrivi("lega", slug);
  }
  function taskAttivoFle() {
    var t = sLeggi("task");
    return !!(t && (t.tipo === "check" || t.tipo === "invio" || t.tipo === "admin"));
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
  function applicaBloccoModo(perche) {
    if (suLogin()) return false;
    var modo = leggi("modo", "lega_fle");
    var slugPagina = slugDaPagina();
    var sorgente = legaCorrente();
    // Durante controllo/invio LEGA+FLE FVM deve poter lavorare dentro FLE.
    if (modo === "lega_fle" && taskAttivoFle()) return false;
    if (modo === "solo_fle") {
      if (!suFle()) { log("BLOCCO MODO", { modo: modo, perche: perche || "pagina", da: location.pathname, a: "FLE" }); location.assign(urlFleFissa()); return true; }
      return false;
    }
    // 1.1.0: SOLO LEGA naviga liberamente tra le leghe dell'account.
    if (modo === "solo_lega") return false;
    // LEGA+FLE, quando non sta eseguendo un task FLE, resta sulla lega associata a FLE (sicurezza).
    if (modo === "lega_fle" && sorgente && slugPagina && slugPagina !== sorgente) {
      log("BLOCCO MODO", { modo: modo, perche: perche || "pagina", da: slugPagina, a: sorgente });
      sScrivi("avviso_blocco", "LEGA + FLE usa solo la tua lega FLE. Per un'altra lega scegli SOLO LEGA.");
      location.assign(urlLegaSorgente()); return true;
    }
    return false;
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
      sScrivi("apro_formazione", null); // la formazione si e aperta davvero
      if (!leggi("comp_" + m[1], 0)) { scrivi("comp_" + m[1], Number(m[2])); log("COMPETIZIONE", { lega: m[1], comp: Number(m[2]), da: "pagina" }); }
    } else {
      var s = slugDaPagina();
      if (s) impostaLega(s);
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
    var s = String(u);
    var punti = (s.indexOf("/league/competition") >= 0 || s.indexOf("/league/status") >= 0 || s.indexOf("/gaming/") >= 0) ? 3 : s.indexOf("/league/") >= 0 ? 2 : 1;
    if (!ctl.hdr || punti >= ctl.hdrScore) { ctl.hdr = h; ctl.hdrScore = punti; }
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
          ctl.payload = { comp: Number(dto.idcomp || 0), tid: Number(dto.tid || 0), mday: dto.mday, cmday: dto.cmday, ids: (pl.lineUpInfo || []).map(function (x) { return Number(x && x.pid); }).filter(Boolean) };
          var fNota = leggi("fle", {}) || {};
          if (!Number(fNota.comp || 0) && ctl.payload.comp) { fNota.comp = ctl.payload.comp; scrivi("fle", fNota); log("COMPETIZIONE FLE", { comp: ctl.payload.comp, da: "campo FLE" }); }
        }
      }
    } catch (e) {}
  }

  // ---------------------------------------------------------------- formazione FLE (stesse regole dell'app)
  function sorgente(u) {
    function pl(pid, i, k) { var x = (u.nomi && u.nomi[pid]) || {}; return { pid: pid, flePid: pid, name: x.n || String(pid), role: Number(x.r || 0), key: k + ":" + pid }; }
    return { module: u.modulo, starts: u.titolari.map(function (p, i) { return pl(p, i, "s"); }), bench: u.panchina.map(function (p, i) { return pl(p, i, "b"); }) };
  }
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
      items.push(item);
    });
    var startIds = {};
    starts.forEach(function (p) { if (p) startIds[p.pid] = true; });
    var got = { 1: [], 2: [], 3: [], 4: [] };
    source.bench.forEach(function (sp, i) {
      var mapped = byPid[sp.flePid];
      if (mapped) {
        if (used[mapped.pid]) return;
        var r = Number(mapped.role);
        if (NEED[r] && got[r].length < NEED[r]) { got[r].push(asFle(mapped.pid, { from: sp.name, ord: i })); used[mapped.pid] = true; }
        return;
      }
      var r2 = Number(sp.role || 0);
      if (r2 && got[r2].length >= NEED[r2]) return;
      var chosen = Number(choices[sp.key] || 0);
      var item = { key: sp.key, kind: "bench", index: i, role: r2, source: sp, chosen: 0, required: false };
      if (chosen && valid(chosen, r2, used)) {
        var rr = Number(byPid[chosen].role);
        if (got[rr].length < NEED[rr]) { got[rr].push(asFle(chosen, { sub: true, from: sp.name, ord: i })); used[chosen] = true; item.chosen = chosen; }
      }
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
    return {
      module: source.module, starts: finalStarts, bench: bench, items: items, pending: pending, missing: missing, moduleProblem: moduleProblem,
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
    return costruisciFle(u.fonte === "fantaclub" ? sorgenteFc(u, f.roster) : sorgente(u), f.roster, Object.assign({}, sceltePerTid(f.tid), f.choices || {}));
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
    ["swtcA", "swtcB", "swtc"].forEach(function (k) { if (k in o) o[k] = 0; });
    if ("swtcMdl" in o) o.swtcMdl = typeof o.swtcMdl === "number" ? Number(inv.mdl) : String(inv.mdl);
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
      // 1.1.0: un salvataggio SOLO LEGA (anche di un'altra lega) non sostituisce la richiesta modello usata per FLE.
      if (!suFle() && leggi("modo", "lega_fle") !== "solo_lega") scrivi("save_req", { url: String(url || ""), metodo: String(metodo || "PUT") });
      var ids = o.bench.map(idDi);
      var dati = {
        at: Date.now(), lega: suFle() ? FLE_SLUG : (slugDaPagina() || legaCorrente()), suFle: suFle(),
        modulo: String(o.mdl || o.module || ""), titolari: o.starts.map(idDi), panchina: ids, cambiata: false,
        tid: Number(o.tid || 0), comp: Number(o.idcomp || 0), capt: o.capt, corpo: raw
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
      if (f) { f.stato = "inviata"; f.manuale = Date.now(); scrivi("fle", f); }
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
          tieniIntestazioni(url, hh);
        }
      } catch (e) {}
      function esegui(prep) {
        return fetchOriginale.apply(self, args).then(function (risposta) {
          if (prep && prep.salvataggio) {
            try { risposta.clone().text().then(function (t) { salvataggioRiuscito(prep.salvataggio, risposta.ok, risposta.status, t); }); }
            catch (e) { salvataggioRiuscito(prep.salvataggio, risposta.ok, risposta.status, ""); }
          }
          if (metodo === "GET") { try { risposta.clone().text().then(function (t) { esaminaRisposta(t, url); }).catch(function () {}); } catch (e) {} }
          return risposta;
        });
      }
      if (metodo !== "GET" && metodo !== "HEAD" && typeof opzioni.body === "string" && opzioni.body.indexOf('"bench"') >= 0) {
        return preparaSalvataggio(opzioni.body, url, metodo).then(function (prep) {
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
    try { tieniIntestazioni(xhr.__fvmUrl, xhr.__fvmH); } catch (e) {}
    if (m === "GET" || m === "HEAD") {
      try { xhr.addEventListener("load", function () { try { if (!xhr.responseType || xhr.responseType === "text") esaminaRisposta(xhr.responseText, xhr.__fvmUrl); else if (xhr.responseType === "json") esaminaRisposta(JSON.stringify(xhr.response), xhr.__fvmUrl); } catch (e) {} }); } catch (e) {}
      return inviaOriginale.apply(xhr, arguments);
    }
    if (typeof corpo !== "string" || corpo.indexOf('"bench"') < 0 || corpo.indexOf('"starts"') < 0) return inviaOriginale.apply(xhr, arguments);
    preparaSalvataggio(corpo, xhr.__fvmUrl, m).then(function (prep) {
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
    scrivi("modo", "lega_fle");
    try { localStorage.removeItem(PREFISSO + "fc_errore"); } catch (e) {}
    var lg = legaFc(), circuito = {};
    Object.keys(FC_CIRCUITO).forEach(function (nl) { circuito[nl] = { nome: FC_CIRCUITO[nl], squadre: squadreFantaclub(nl).map(function (t) { return t[1]; }) }; });
    // lega nota: la sua pagina Consegna; lega non ancora nota: Fantaclub, dove l'utente apre la Consegna della sua lega
    var id = inviaPassaggio("fantaclub", "consegna", { nl: lg ? lg.nl : "", lega: lg ? lg.nome : "", modo: "lega_fle", circuito: circuito },
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
    var pulisci = function (arr) {
      return (Array.isArray(arr) ? arr : []).slice(0, 15).map(function (p) {
        return { n: String(p && p.n || "").slice(0, 40), c: String(p && p.c || "").replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase(), s: String(p && p.s || "").replace(/[^A-Za-z]/g, "").slice(0, 2).toUpperCase(), o: !!(p && p.o) };
      }).filter(function (p) { return p.n; });
    };
    var f = { at: Date.now(), come: consegna ? "consegna" : "lettura", nl: nl, lega: nl ? nomeLegaFc(nl) : "", modulo: String(d.modulo || "").replace(/\D/g, "").slice(0, 3),
      titolari: pulisci(d.titolari), panchina: pulisci(d.panchina), idSquadra: String(d.idSquadra || "").replace(/\D/g, "").slice(0, 12),
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
          if (n.esito === "confermata") { d.conferme = Number(d.conferme || 1) + 1; d.ultimaConferma = ora; }
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
      var tit = (dati.titolari || []).slice(0, 11), pan = (dati.panchina || []).slice(0, 15);
      var t = storicoNomiLeghe(tit), p = storicoNomiLeghe(pan);
      var formazione = t && p ? { titolari: t, panchina: p } : undefined;
      var imp = storicoImpronta(dati.modulo, tit, pan), comp = Number(dati.comp || 0);
      if (dati.suFle) {
        var mod = sLeggi("storico_modifica");
        var modalita = mod && Date.now() - Number(mod.at || 0) < 2 * 3600000 ? "modifica_fle" : "solo_fle";
        var f = leggi("fle", {}) || {}, sq = SQUADRE.filter(function (x) { return Number(x[2]) === Number(dati.tid); })[0];
        var nomeComp = (leggi("comps_" + FLE_SLUG, []).filter(function (c) { return Number(c.id) === comp; })[0] || {}).name || (Number(f.comp) === comp ? f.compName || "" : "");
        var esito = storicoRisposta(ok, stato, testo, "FLE");
        esito.competizioni = comp ? [{ id: comp, nome: String(nomeComp).slice(0, 60) }] : undefined;
        if (o && "allComp" in o) esito.tutte = o.allComp === true || o.allComp === 1;
        if (o && "visb" in o) esito.invisibile = o.visb === false || o.visb === 0;
        esito.giornata = storicoGiornataComp(o);
        var precF = storicoRecente(function (x) { return x.modalita === modalita && x.impronta === imp; });
        storicoAggiorna(precF ? precF.id : "fle-" + dati.at, { piattaforma: piattaformaScelta(), modalita: modalita, lega: { id: FLE_SLUG, nome: "FANTALEGAEUROPA (FLE)" }, legaOrigine: storicoLegaOrigineFle(dati.tid),
          squadra: { nome: sq ? sq[1] : String(f.squadra || ""), fleTid: Number(dati.tid) || 0 }, modulo: String(dati.modulo || ""), giornata: giornata || Number(f.mday) || 0, impronta: imp, formazione: formazione },
          { lega: { esito: "non_prevista", motivo: modalita === "solo_fle" ? "SOLO FLE" : "modifica della sola formazione FLE" }, fle: esito });
        return;
      }
      var slug = String(dati.lega || ""), solo = leggi("modo", "lega_fle") === "solo_lega", modo = solo ? "solo_lega" : "lega_fle";
      var map = trovaFleTid(dati.tid), lega = storicoRisposta(ok, stato, testo, "il sito della lega");
      var pzS = partecipantiLega(slug), psS = pzS && pzS[Number(dati.tid)];
      var nomeCompL = (leggi("comps_" + slug, []).filter(function (c) { return Number(c.id) === comp; })[0] || {}).name || "";
      lega.competizioni = comp ? [{ id: comp, nome: String(nomeCompL).slice(0, 60) }] : undefined;
      lega.giornata = storicoGiornataComp(o);
      var fle = solo ? { esito: "non_prevista", motivo: "SOLO LEGA" }
        : lega.esito !== "confermata" ? { esito: "non_inviata", motivo: "la lega non ha confermato il salvataggio" }
        : map ? { esito: "non_inviata" } : { esito: "non_prevista", motivo: "squadra non nel circuito FLE" };
      var prec = storicoRecente(function (x) { return x.piattaforma === "fantacalcio" && x.modalita === modo && x.lega && x.lega.id === slug && x.impronta === imp; });
      storicoAggiorna(prec ? prec.id : "lg-" + dati.at, { piattaforma: "fantacalcio", modalita: modo, lega: { id: slug, nome: nomeLega(slug) },
        squadra: { nome: map ? map.squadra : psS ? psS.nome : "", idSorgente: Number(dati.tid) || 0, fleTid: map ? map.fleTid : 0 }, modulo: String(dati.modulo || ""), giornata: giornata,
        account: psS && psS.allenatori && psS.allenatori.length ? { nome: psS.allenatori.join(", "), fonte: "allenatori della squadra (partecipanti della lega)" } : undefined,
        impronta: imp, formazione: formazione, rif: lega.esito === "confermata" && !solo ? "fantacalcio:" + dati.at : undefined }, { lega: lega, fle: fle });
    } catch (e) { try { log("STORICO", { esito: "non registrato", errore: String(e && e.message || e).slice(0, 120) }); } catch (x) {} }
  }
  // esito dell'invio FLE fatto da FVM (PASSO 3 / CONFERMA E INVIA): stessa voce della consegna nella lega
  function storicoInvioFle(ok, stato, testo) {
    try {
      var f = leggi("fle", {}) || {}, u = formazioneSorgente() || {};
      var piatt = u.fonte === "fantaclub" ? "fantaclub" : "fantacalcio", rif = piatt + ":" + Number(u.at || 0);
      var op = Number(u.at || 0) ? storicoTutto().filter(function (x) { return x.rif === rif; })[0] || null : null;
      var esito = storicoRisposta(ok, stato, testo, "FLE");
      if (!ok && !esito.motivo) esito.motivo = "FLE non ha confermato il salvataggio";
      if (!ok && testo && !storicoMessaggio(testo) && !/^\s*[{[]/.test(String(testo))) esito.motivo = "FLE: " + String(testo).replace(/[<>]/g, "").slice(0, 120);
      esito.competizioni = Number(f.comp) ? [{ id: Number(f.comp), nome: String(f.compName || "").slice(0, 60) }] : undefined;
      // FVM salva sempre su tutte le competizioni, invisibile (riscriviPerFle)
      esito.tutte = true; esito.invisibile = true;
      esito.giornata = storicoGiornataComp(f);
      var base = { giornata: Number(f.mday) || 0 };
      if (!op || !op.squadra || !op.squadra.nome) base.squadra = { nome: String(f.squadra || u.squadra || ""), fleTid: Number(f.tid) || 0 };
      if (op && op.modalita === "solo_lega") { base.modalita = "lega_fle"; base.nota = "SOLO LEGA, poi MANDA ANCHE A FLE"; }
      if (op) { storicoAggiorna(op.id, base, { fle: esito }); return; }
      var sl = String(u.nl || legaCorrente() || "");
      storicoAggiorna("fle-" + Date.now(), Object.assign(base, { piattaforma: piatt, modalita: "lega_fle", lega: sl ? { id: sl, nome: u.nl ? u.lega || nomeLegaFc(sl) : nomeLega(sl) } : undefined, modulo: String(u.modulo || "") }),
        { lega: { esito: "non_registrata", motivo: "consegna nella lega non presente nello storico" }, fle: esito });
    } catch (e) { try { log("STORICO", { esito: "non registrato", errore: String(e && e.message || e).slice(0, 120) }); } catch (x) {} }
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
    if (g === "g") return Number(x.giornata) > 0 ? [{ k: String(Number(x.giornata)), nome: "GIORNATA " + Number(x.giornata) + " SERIE A" }] : [];
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
        "<div class='mu'>" + esc(["stagione " + (x.stagione || storicoStagione(x.creato) || "?") + " (dalla data)", Number(x.giornata) > 0 ? "giornata " + Number(x.giornata) + " di Serie A" : ""].filter(Boolean).join(" · ")) + "</div>" +
        (x.nota ? "<div class='mu'>" + esc(x.nota) + "</div>" : "");
      ["lega", "fle"].forEach(function (dest) {
        var e = d[dest];
        if (!e) return;
        var det = [];
        if (Array.isArray(e.competizioni) && e.competizioni.length) det.push((dest === "fle" ? "ingresso: " : "") + e.competizioni.map(function (c) { return c.nome || "competizione " + c.id; }).join(", "));
        if (Number(e.giornata) > 0) det.push("giornata " + Number(e.giornata) + " della competizione");
        if (e.tutte === true) det.push("salvata per TUTTE LE COMPETIZIONI");
        if (e.invisibile === true) det.push("INVISIBILE");
        if (e.motivo) det.push(e.motivo);
        if (e.prova) det.push("prova: " + e.prova);
        if (Number(e.conferme) > 1) det.push("confermata " + Number(e.conferme) + " volte (stessa formazione)");
        if (e.tentativi && e.tentativi.length) det.push(e.tentativi.length + (e.tentativi.length === 1 ? " tentativo non riuscito" : " tentativi non riusciti") + (e.esito === "confermata" ? "" : " prima"));
        h += "<div style='margin-top:6px;font-size:13px;font-weight:800'>" + storicoChip(dest === "lega" ? "LEGA" : "FLE", e, true) + "</div>" +
          (det.length ? "<div class='mu' style='font-size:12px'>" + esc(det.join(" · ")) + "</div>" : "");
      });
      if (x.migrata) h += "<div class='mu' style='font-size:11px;margin-top:4px'>dalla versione precedente di FVM: i dati non registrati allora restano non disponibili</div>";
      if (x.formazione && x.formazione.titolari) {
        h += "<button class='bt' data-a='formazione_storico' data-i='" + i + "'>FORMAZIONE ▾</button><div id='fvm-sf-" + i + "' style='display:none;margin-top:6px'>" +
          "<div class='mu'><b>Titolari:</b> " + esc(x.formazione.titolari.join(", ")) + "</div>" +
          (x.formazione.panchina && x.formazione.panchina.length ? "<div class='mu' style='margin-top:4px'><b>Panchina:</b> " + esc(x.formazione.panchina.join(", ")) + "</div>" : "") + "</div>";
      }
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
      res.items.forEach(function (it) {
        var src = it.source ? (it.source.name + (it.source.club ? " " + it.source.club : "") + " (" + (RUOLI[it.role] || "?") + ")" + (it.source.nota ? " · " + it.source.nota : "")) : ("posto aggiunto in panchina (" + (RUOLI[it.role] || "?") + ")");
        var tit = it.kind === "start" ? "Titolare non nei tuoi 25 FLE: " + src : it.kind === "bench" ? "Panchinaro non nei tuoi 25 FLE: " + src : "Panchina FLE: manca un " + (RUOLI[it.role] || "?");
        if (!it.required && !it.chosen) return;
        h += "<div class='cd' style='margin-top:8px;padding:10px'><div class='mu' style='color:#fbbf24;font-weight:700'>" + esc(tit) + "</div>";
        if (it.chosen) {
          var ch = it.candidates.filter(function (c) { return c.pid === it.chosen; })[0] || { name: it.chosen, role: it.role };
          h += rigaGiocatore(0, ch, "<span class='mu' style='margin-left:auto'>scelto ✓</span>");
          h += "<button class='bt' data-a='annulla' data-k='" + esc(it.key) + "'>CAMBIA SCELTA</button>";
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
    }
    var pronto = res && res.complete && f.stato !== "errore";
    if (f.stato === "inviata") {
      if (f.compName) h += "<div class='mu'>• Destinazione FLE: " + esc(f.compName) + (f.squadra ? " · " + esc(f.squadra) : "") + "</div>";
      h += "<div class='mu' style='margin-top:6px'>Su FLE è salvata per tutte le competizioni a cui sei iscritto, <b>invisibile</b> agli avversari.</div>";
      h += "<button class='bt' data-a='modifica'>MODIFICA SU FLE</button>";
    } else {
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
    var h = "";
    h += "<div class='hero'><img src='" + LOGO_FVM + "' alt='FVM'><div style='flex:1'><button class='x' data-a='chiudi'>CHIUDI</button><div class='ht'>FANTA VICE<br>MISTER</div><div class='hs'>v" + VERSIONE + " · Stagione 2026/27</div></div></div>";
    // 1.0: riquadro di benvenuto alla prima apertura (sostituisce i passi login della guida)
    if (!leggi("benvenuto_ok", false)) {
      h += "<div class='cd' style='border:2px solid #3fae4a'><div class='lb' style='color:#4ade80'>BENVENUTO · INSTALLAZIONE COMPLETATA ✓</div>" +
        "<div class='t2'>Fanta Vice Mister è attivo su questo iPhone</div>" +
        (conn
          ? "<div class='mu'>• Sei connesso ✓</div><div class='mu'>• " + (slug ? "Lega riconosciuta: " + esc(nomeLega(slug)) : "Entra una volta nella tua lega con <b>CAMBIA LEGA</b>: poi la ricordo da solo.") + "</div>"
          : "<div class='mu'>• Ultimo passo: tocca <b>ACCEDI</b> qui sotto ed entra con username e password di Fantacalcio. Dopo il login torni qui da solo.</div>") +
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
    // 1.1.0 Fantaclub fasi 5-10: con Fantaclub scelto, carte Fantaclub (il ramo Leghe qui sotto resta invariato)
    if (piattaformaScelta() === "fantaclub") h += carteFantaclub();
    else {
    // 1.1.0: un solo comando. LEGA + FLE / SOLO LEGA / SOLO FLE si scelgono nella pagina formazione.
    h += "<div class='cd verde' data-a='formazione'><div class='lb' style='color:#cfe'>PASSO 1 · " + esc(slug ? nomeLega(slug) : "LA TUA LEGA") + "</div>" +
      "<div style='font-size:18px;font-weight:900;margin:4px 0'>FAI O MODIFICA LA FORMAZIONE</div>" +
      "<div class='mu' style='color:#cfe'>Premi Salva formazione: ordine della panchina, poi controllo per FLE da solo.</div>" +
      "<div class='mu' style='color:#cfe;margin-top:4px'>Nella pagina della formazione puoi scegliere <span style='white-space:nowrap'>LEGA + FLE</span>, <span style='white-space:nowrap'>SOLO LEGA</span> o <span style='white-space:nowrap'>SOLO FLE</span>.</div></div>";
    var sl = leggi("solo_lega_salvata", null);
    if (sl) {
      h += "<div class='cd' style='border-left:4px solid #e2b33c'><div class='lb'>SOLO LEGA</div>" +
        "<div class='t2' style='color:#4ade80'>Formazione salvata solo nella tua lega ✓</div>" +
        "<div class='mu'>" + esc(nomeLega(sl.lega)) + (sl.compName ? " · " + esc(sl.compName) : "") + "</div>" +
        "<div class='mu'>" + esc(new Date(sl.at).toLocaleString("it-IT")) + " · modulo " + esc(String(sl.modulo || "").split("").join("-")) + (sl.cambiata ? " · panchina nel tuo ordine" : "") + "</div>" +
        "<div class='mu' style='color:#fbbf24;font-weight:700;margin-top:4px'>Non è stata mandata a FLE.</div></div>";
    }
    h += cartaPasso2();
    // la mia squadra
    var squadra = u && u.squadra ? u.squadra : "Da rilevare";
    h += "<div class='cd'><div class='lb'>LA MIA SQUADRA</div><div class='t1' style='margin-top:6px'>" + esc(squadra) + "</div>" +
      "<div class='mu' style='font-weight:800;margin-top:4px'>" + esc(slug ? nomeLega(slug) : "") + "</div>" +
      "<button class='bt' data-a='leghe'>CAMBIA LEGA</button>" +
      (u && u.fleTid ? "<div style='color:#4ade80;font-weight:800;margin-top:10px'>✓ Squadra FLE riconosciuta</div>" : "<div style='color:#fbbf24;font-weight:700;margin-top:10px'>La squadra verrà riconosciuta dopo il salvataggio della formazione</div>") + "</div>";
    if (u && u.ok) {
      h += "<div class='cd'><div class='lb'>FORMAZIONE SALVATA IN LEGA</div><div class='mu' style='margin-top:6px'>" + esc(new Date(u.at).toLocaleString("it-IT")) + " · modulo " + esc(u.modulo) + " · " + u.titolari.length + " titolari · " + u.panchina.length + " panchinari</div>" +
        "<button class='bt' data-a='panchina'>MOSTRA PANCHINA ▾</button><div id='fvm-panchina' class='panchinaDet'>";
      u.panchina.forEach(function (id, i) { var p = (u.nomi && u.nomi[id]) || {}; h += rigaGiocatore(i + 1, { name: p.n || id, role: p.r }); });
      h += "</div></div>";
    }
    }
    // Fantaclub: RIPETI CONTROLLO FLE solo con lega del circuito FLE in uso e abbinamento valido (altrimenti assente).
    // Leghe Fantacalcio: invariato.
    if (piattaformaScelta() !== "fantaclub" || ricontrollaFcAmmesso()) h += "<button class='bt' data-a='ricontrolla'>RIPETI CONTROLLO FLE</button>";
    h += "<button class='bt' data-a='diagnosi'>CONDIVIDI DIAGNOSI</button>";
    h += "<button class='bt' data-a='icona'>METTI FVM SULLA HOME</button>"; // 1.3.3: icona FVM con la lega in uso
    h += "<div class='cd' style='margin-top:10px'><div class='lb'>STORICO INVII</div>";
    // storico unificato: ultima operazione (lega in uso, se presente) su una riga + esiti LEGA / FLE; elenco a parte
    try { h += cartaStorico(); } catch (e) { h += "<div class='mu' style='margin-top:6px'>Storico non disponibile.</div>"; }
    h += "<button class='bt' style='color:#aab3c2' data-a='admin'>AREA ADMIN</button></div>";
    // 1.1.0: piede come l'app Android: logo FantaLegaEuropa centrato + dicitura
    h += "<div style='display:flex;flex-direction:column;align-items:center;gap:6px;margin-top:14px'>" +
      "<img src='" + LOGO_FLE + "' alt='FantaLegaEuropa' style='width:86px;height:86px;object-fit:contain;display:block'>" +
      "<div class='mu' style='text-align:center;font-size:11px;font-weight:700'>Per le competizioni della FantaLegaEuropa</div></div>";
    h += "<div class='mu' style='text-align:center;margin-top:6px'>Fanta Vice Mister " + VERSIONE + " · Stagione 2026/27</div>";
    pannello.innerHTML = h;
    adattaUltimoInvio();
    var cb = pannello.querySelector("#fvm-ricorda");
    if (cb) cb.addEventListener("change", function () { scrivi("ricorda", !!cb.checked); });
    Array.prototype.forEach.call(pannello.querySelectorAll("[data-a]"), function (el) {
      el.addEventListener("click", function (ev) {
        ev.stopPropagation();
        var a = el.getAttribute("data-a");
        // 1.1.0: CHIUDI della Home = uscita completa, solo dopo conferma (Annulla: non succede nulla)
        if (a === "chiudi" && confirm("Vuoi chiudere Fanta Vice Mister e uscire da Leghe Fantacalcio su questo iPhone?")) esciDaFvm("chiudi");
        if (a === "benvenuto") { scrivi("benvenuto_ok", true); log("BENVENUTO", "chiuso"); aggiornaPannello(); }
        // storico: una nuova consegna non e piu una MODIFICA SU FLE
        if (a === "formazione" || a === "formazione_fc") { try { sScrivi("storico_modifica", null); } catch (e) {} }
        if (a === "storico") apriStorico();
        if (a === "ufficiale") apriUfficiale();
        if (a === "formazione") vaiAllaFormazione();
        if (a === "icona") meIconaHome();
        // 1.1.0: RIPETI CONTROLLO e INVIA lavorano sulla formazione LEGA + FLE: da SOLO LEGA si torna a LEGA + FLE.
        if ((a === "ricontrolla" || a === "invia") && leggi("modo", "lega_fle") === "solo_lega") { scrivi("modo", "lega_fle"); log("MODO", { a: "lega_fle", perche: a }); }
        if (a === "leghe") { chiudiPannello(); location.assign("https://leghe.fantacalcio.it/"); }
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
        // 1.1.0: MODIFICA SU FLE e lavoro solo sulla formazione FLE (modalita SOLO FLE nella barra).
        if (a === "modifica" && conFc && !fleFantaclubAmmesso().ok) { try { storicoBloccato("modifica_fle", (legaFc() || {}).nl || "", fleFantaclubAmmesso().testo); } catch (e) {} avviso(fleFantaclubAmmesso().testo, true); return; }
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
  function apriCampoFle(nlFc) {
    // Fantaclub scelto: blocco PRIMA di qualsiasi navigazione (quindi prima del login Leghe e della scelta di altre leghe)
    if (piattaformaScelta() === "fantaclub") {
      var esFle = fleFantaclubAmmesso(nlFc);
      if (!esFle.ok) {
        scrivi("modo", "lega_fle");
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
    // 1.1.0: come l'app, si parte sempre da LEGA + FLE.
    scrivi("modo", "lega_fle");
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
    scrivi("modo", m);
    log("MODO", { da: prima, a: m, pagina: location.pathname });
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
    if (modo === "lega_fle" && !suFle()) h += "<div class='regole' data-b='regole'>ⓘ Panchina FLE: almeno 2P · 3D · 3C · 3A dei 25 FLE, nel tuo ordine di entrata ›</div>";
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
    var inv = { starts: res.starts.map(function (p) { return p.pid; }), bench: res.bench.map(function (p) { return p.pid; }), mdl: u.modulo, capt: null };
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
  function getApi(path) {
    return fetchOriginale(API + path, { headers: ctl.hdr || {}, credentials: "include" }).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status + " " + path);
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
              task.lista = comps.map(function (c) { return { id: Number(c.id), name: c.name }; });
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
            w.chiudi();
            return erroreControllo("Squadra FLE diversa", ["In questa pagina FLE c'è la squadra " + pl.tid + ", non la tua (" + task.fleTid + ").", "Controlla di essere entrato in Leghe con il tuo account."], task);
          }
          // (1.1.0 Fantaclub: anche la squadra di Serie A, per l'abbinamento per nome + squadra + ruolo)
          var roster = pl.ids.map(function (pid) { var x = info[pid] || {}; return { pid: pid, name: x.n || String(pid), role: Number(x.r || 0), flag: x.f || "", club: x.c || "" }; });
          var f = leggi("fle", {}) || {};
          f.stato = "controllato"; f.comp = pl.comp; f.compName = task.compName || ""; f.tid = pl.tid || task.fleTid; f.squadra = task.squadra;
          f.roster = roster; f.mday = pl.mday; f.cmday = pl.cmday; f.choices = {}; f.ritorno = task.ritorno || f.ritorno || "";
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
  function scegliCompetizione(task, lista, w) {
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
    // capitano e vice: se uno dei due e stato sostituito su FLE, passa al suo sostituto (stessa posizione)
    var cambio = {};
    u.titolari.forEach(function (pid, i) { if (res.starts[i]) cambio[pid] = res.starts[i].pid; });
    var capt = Array.isArray(u.capt) ? u.capt.map(function (c) { var id = idDi(c); return cambio[id] || id; }) : (cambio[idDi(u.capt)] || u.capt);
    var inv = { starts: res.starts.map(function (p) { return p.pid; }), bench: res.bench.map(function (p) { return p.pid; }), mdl: u.modulo, capt: capt };
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
        invioDirettoSorgente(task);
      }
    }, 500);
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
    if (invioCorrente) { invioCorrente.finito = true; try { invioCorrente.w.chiudi(); } catch (e) {} }
    window.__fvmInvio = null;
    var esito = "";
    try { var j = JSON.parse(testo || "null"); esito = j && (j.success === false || j.error || j.errors) ? JSON.stringify(j).slice(0, 200) : ""; } catch (e) {}
    if (esito) ok = false;
    log("INVIO FLE ESITO", { ok: !!ok, stato: stato, risposta: String(testo || "").slice(0, 200) });
    try { storicoInvioFle(ok, stato, testo); } catch (e) {} // storico: solo registrazione, isolata
    var f = leggi("fle", {}) || {}, u = formazioneSorgente() || {};
    sScrivi("task", null);
    if (ok) {
      f.stato = "inviata"; f.inviataAt = Date.now();
      scrivi("fle", f);
      var invii = leggi("invii", []);
      invii.unshift({ at: Date.now(), comp: f.comp, compName: f.compName, squadra: f.squadra || u.squadra, modulo: u.modulo, fonte: u.fonte });
      scrivi("invii", invii.slice(0, 20));
      var modoFine = leggi("modo", "lega_fle");
      sScrivi("apri", "main");
      sScrivi("flash", "Formazione salvata su FLE ✓");
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
    } else {
      f.stato = "errore"; f.titolo = "Invio su FLE non riuscito";
      f.dettagli = ["Il sito FLE non ha confermato il salvataggio" + (stato ? " (stato " + stato + ")" : "") + ".", "Riprova con RIPETI CONTROLLO FLE oppure manda la diagnosi al tuo admin."];
      scrivi("fle", f);
      apriPannello();
    }
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
    return getApi(path).then(function (j) { if (typeof j === "string" && /^\s*[\[{]/.test(j)) { try { return JSON.parse(j); } catch (e) {} } return j; });
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
        comps = listaCompetizioni(j).filter(function (c) { return c && !c.del; }).map(function (c) { return { id: Number(c.id), nome: String(c.name || c.n || "").slice(0, 60) }; }).filter(function (c) { return c.id; });
        R.competizioni = comps;
        var c = comps.filter(function (x) { return x.id === Number(task.comp); })[0] || comps.filter(function (x) { return /campionato/i.test(x.nome); })[0] || comps[0];
        if (!c) throw new Error("nessuna competizione leggibile");
        R.comp = c.id; R.competizione = c.nome;
        return Promise.all([apiJson("/onboarding/v1/league/competition/calendar/" + c.id), apiJson("/onboarding/v1/league/status"), apiJson("/gaming/v1/lineup/notcalculated/" + c.id).catch(function () { return []; }),
          apiJson("/onboarding/v1/invitation/participants?pageNumber=1&pageSize=1000").catch(function () { return []; })]);
      }).then(function (v) {
        var cal = (Array.isArray(v[0]) ? v[0] : []).filter(function (r) { return r && Number(r.matchDay); });
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
        return apiJson("/gaming/v1/teamLineup/" + R.comp + "/" + turno.matchDay + "/" + turno.championshipMatchDay).catch(function () { return []; }).then(function (lu) {
          R.stato = fvmStatoLeghe({ turno: turno, formazioni: Array.isArray(lu) ? lu : [], squadre: sq, nonCalcolate: nc, giornataSerieA: mday, inizioGiornata: st.mstr, regola: leggi("uff_regola_" + task.slug, null) });
        });
      }).catch(function (e) { R.errori.push(String(e && e.message || e).slice(0, 160)); }).then(function () {
        salvaR();
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
  function riceviControlloFc(msg) {
    var att = sLeggi("uff_fc_atteso"), d = msg.dati || {};
    sScrivi("uff_fc_atteso", null);
    if (!att || d.richiesta !== att.id || String(d.nl || "") !== att.nl || Date.now() - Number(att.at || 0) > 10 * 60000) { log("PASSAGGIO", { tipo: "controllo-fc-esito", esito: "non richiesto da questa scheda" }); return; }
    var R = { nl: att.nl, lega: nomeLegaFc(att.nl), quando: Date.now(), account: d.account || "", regola: d.regola || null, squadre: d.squadre || [], log: d.log || [], giornataPrecedente: d.giornataPrecedente || null,
      giornataRichiesta: d.giornataRichiesta || "", errori: d.errori || [], logRidotto: d.logRidotto || 0 };
    R.stato = fvmStatoFc({ squadre: R.squadre, consegnate: d.consegnate || [], nonConsegnate: d.nonConsegnate || { letto: false, squadre: [] }, log: R.log, nascoste: !!(R.regola && /^si/i.test(R.regola.nascoste || "")) });
    R.gestore = R.regola && R.account ? (R.regola.gestore === R.account || String(R.regola.altriAdmin || "").split(/[,;]\s*/).indexOf(R.account) >= 0) : null;
    scrivi("uff_fc_" + att.nl, R);
    // S5: account delle squadre Fantaclub (per lo storico personale: solo come dato letto dalla pagina Squadre)
    var acc = {}; R.squadre.forEach(function (s) { if (s.account && s.account !== FVM_ND) acc[s.squadra] = s.account; });
    scrivi("fc_squadre_account_" + att.nl, { at: Date.now(), account: acc, mio: R.account || "" });
    var note = leggi("fc_leghe_note", []) || []; if (note.indexOf(att.nl) < 0) { note.push(att.nl); scrivi("fc_leghe_note", note.slice(-12)); }
    log("CONSEGNE UFFICIALI", { piattaforma: "fantaclub", lega: att.nl, squadre: R.squadre.length, errori: R.errori.length });
    sScrivi("apri", "ufficiale");
  }
  // ---- schermata CONSEGNE UFFICIALI (Leghe Fantacalcio e Fantaclub), separata dallo storico personale
  var ETICHETTE_UFF = { presente: ["🟢", "Formazione presente", "#4ade80"], assente: ["🔴", "Nessuna formazione (giornata calcolata)", "#f87171"], assente_provvisorio: ["🟠", "Nessuna formazione · giornata da calcolare", "#fbbf24"],
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
    var det = [r.ora && r.ora !== FVM_ND ? (r.stato === "presente" ? "salvata " : "") + r.ora : "", r.invisibile ? "invisibile" : "", r.modulo ? "modulo " + String(r.modulo).split("").join("-") : "", r.canale && r.canale !== FVM_ND ? "tramite " + r.canale : "", r.invii > 1 ? r.invii + " invii nel log" : "", r.account ? "account " + r.account : (r.allenatori && r.allenatori.length ? "allenatore " + r.allenatori.join(", ") : "")].filter(Boolean).join(" · ");
    return "<div style='margin-top:8px;font-size:14px'><span style='color:" + e[2] + ";font-weight:800'>" + e[0] + " " + esc(r.squadra) + "</span><div class='mu' style='font-size:12px'>" + esc(e[1]) + (det ? " · " + esc(det) : "") + (r.nota ? " · " + esc(r.nota) : "") + (r.provenienza && /recuperata/.test(r.provenienza) ? "<br>provenienza: " + esc(r.provenienza) : "") + "</div></div>";
  }
  function selUff(id, voci, scelto) { return "<select id='" + id + "' style='width:100%;margin-top:6px;padding:10px;border-radius:10px;background:#0a1524;color:#fff;border:1px solid #2a4370;font-size:15px'>" + voci.map(function (v) { return "<option value='" + esc(v[0]) + "'" + (String(v[0]) === String(scelto) ? " selected" : "") + ">" + esc(v[1]) + "</option>"; }).join("") + "</select>"; }
  function disegnaUfficiale() {
    if (!pannello) return;
    var sel = sLeggi("uff_sel") || {}, leghe = legheControllabili(), slug = sel.slug || (legaCorrente() && legaCorrente() !== FLE_SLUG ? legaCorrente() : (leghe[0] || {}).slug);
    var R = slug ? leggi("uff_leghe_" + slug, null) : null;
    if (slug && !leghe.some(function (l) { return l.slug === slug; })) leghe.push({ slug: slug, nome: R && R.lega ? R.lega : nomeLega(slug) });
    var h = "<div class='cd'><button class='x' data-a='indietro'>INDIETRO</button><div class='t1'>CONSEGNE UFFICIALI</div><div class='mu' style='margin-top:6px'>Registri ufficiali delle piattaforme, anche per consegne fatte fuori da FVM o prima della sua installazione. Sono separati dallo storico personale di FVM. Solo lettura, con i permessi del tuo account. Nessun calcolo di jolly o penalità.</div></div>";
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
      (R.errori || []).forEach(function (e) { h += "<div style='color:#f87171;font-size:13px'>" + esc(e) + "</div>"; });
      (S.righe || []).forEach(function (r) { h += rigaUff(r); });
      h += "<div class='mu' style='font-size:11px;margin-top:8px'>Orari: ora italiana (dati ufficiali in UTC convertiti con Europe/Rome). Canale di invio, recupero dal server e interventi admin: " + FVM_ND + " (i dati letti non li indicano).</div>";
      if (S.righe && S.righe.length) h += "<button class='bt' style='border-color:#22c55e;color:#4ade80' data-a='uff_leghe_wa'>CONDIVIDI SU WHATSAPP</button>";
    }
    h += "</div>";
    // --- Fantaclub
    var lfc = legheFcControllabili(), nl = sel.nl || ((legaFc() || {}).nl || "").toLowerCase() || (lfc[0] || {}).nl, F = nl ? leggi("uff_fc_" + nl, null) : null;
    if (nl && !lfc.some(function (l) { return l.nl === nl; })) lfc.push({ nl: nl, nome: F && F.lega ? F.lega : String(nl).toUpperCase() });
    h += "<div class='cd'><div class='lb'>FANTACLUB</div>" + selUff("fvm-uff-fc", lfc.map(function (l) { return [l.nl, l.nome]; }), nl) +
      "<input id='fvm-uff-gfc' inputmode='numeric' placeholder='Giornata precedente (facoltativa, numero del sito)' value='" + esc(sel.giornataFc || "") + "' style='width:100%;margin-top:6px;padding:10px;border-radius:10px;background:#0a1524;color:#fff;border:1px solid #2a4370;font-size:15px'>" +
      "<button class='bt oro' data-a='uff_fc'>" + (F ? "AGGIORNA" : "CONTROLLA") + " SU FANTACLUB</button>";
    if (F) {
      var SF = F.stato || {}, rg = F.regola || {};
      h += "<div style='margin-top:10px;font-weight:800'>" + esc(F.lega) + " · giornata " + esc(SF.giornata || "?") + " (numerazione del sito)</div>" +
        "<div class='mu'>Controllo: " + esc(new Date(F.quando).toLocaleString("it-IT")) + (F.account ? " · account collegato: " + esc(F.account) : "") + (F.gestore === true ? " · gestore o amministratore della lega (pagina Info)" : F.gestore === false ? " · non risulti gestore (pagina Info)" : "") + "</div>" +
        "<div class='mu'>Regole (Info → Consegna e sostituzioni): mancata consegna: <b>" + esc(rg.mancataConsegna || FVM_ND) + "</b> · formazioni nascoste: " + esc(rg.nascoste || FVM_ND) + " · scadenza: " + esc(rg.scadenza || FVM_ND) + "</div>";
      (F.errori || []).forEach(function (e) { h += "<div style='color:#f87171;font-size:13px'>" + esc(e) + "</div>"; });
      (SF.righe || []).forEach(function (r) { h += rigaUff(r); });
      if (F.giornataPrecedente) {
        var GP = F.giornataPrecedente;
        h += "<div class='lb' style='margin-top:10px'>GIORNATA " + esc(GP.giornata || F.giornataRichiesta) + " (giornate passate)</div>";
        (GP.consegnate || []).forEach(function (c) { h += rigaUff({ squadra: c.squadra, stato: "consegnata", ora: c.ora, account: c.account }); });
        h += "<div class='mu' style='font-size:12px'>Le squadre non elencate non risultano in questa pagina: " + FVM_ND + " (l'elenco delle giornate passate mostra solo le formazioni consegnate).</div>";
      }
      if (F.log && F.log.length) h += "<div class='mu' style='font-size:12px;margin-top:6px'>Log consegne: " + F.log.length + " invii letti" + (F.logRidotto ? " (su " + F.logRidotto + ")" : "") + "; l'ultimo per squadra vale come consegna.</div>";
      if (SF.righe && SF.righe.length) h += "<button class='bt' style='border-color:#22c55e;color:#4ade80' data-a='uff_fc_wa'>CONDIVIDI SU WHATSAPP</button>";
    }
    h += "</div><button class='bt' data-a='indietro'>INDIETRO</button>";
    pannello.innerHTML = h;
    var val = function (id) { var e = pannello.querySelector("#" + id); return e ? e.value : ""; };
    Array.prototype.forEach.call(pannello.querySelectorAll("select"), function (s) {
      s.addEventListener("change", function () {
        var v = sLeggi("uff_sel") || {};
        if (s.id === "fvm-uff-lega") { v.slug = s.value; v.comp = 0; v.turno = 0; }
        if (s.id === "fvm-uff-comp") { v.comp = Number(s.value) || 0; v.turno = 0; }
        if (s.id === "fvm-uff-turno") v.turno = Number(s.value) || 0;
        if (s.id === "fvm-uff-fc") v.nl = s.value;
        sScrivi("uff_sel", v);
        if (s.id === "fvm-uff-lega" || s.id === "fvm-uff-fc") disegnaUfficiale();
      });
    });
    Array.prototype.forEach.call(pannello.querySelectorAll("[data-a]"), function (el) {
      el.addEventListener("click", function (ev) {
        ev.stopPropagation();
        var a = el.getAttribute("data-a");
        if (a === "indietro") apriPannello();
        if (a === "uff_leghe") avviaControlloLega(val("fvm-uff-lega"), val("fvm-uff-comp") || (sLeggi("uff_sel") || {}).comp, val("fvm-uff-turno") || 0);
        if (a === "uff_fc") avviaControlloFcUff(val("fvm-uff-fc"), String(val("fvm-uff-gfc") || "").trim());
        if (a === "uff_leghe_wa") { var Rw = leggi("uff_leghe_" + val("fvm-uff-lega"), null); if (Rw) condividiTesto(fvmReportLeghe({ lega: Rw.lega, competizione: Rw.competizione, stato: Rw.stato, regola: Rw.regola || leggi("uff_regola_" + Rw.slug, null), quando: new Date(Rw.quando).toLocaleString("it-IT") })); }
        if (a === "uff_fc_wa") { var Fw = leggi("uff_fc_" + val("fvm-uff-fc"), null); if (Fw) condividiTesto(fvmReportFc({ lega: Fw.lega, stato: Fw.stato, regola: Fw.regola, quando: new Date(Fw.quando).toLocaleString("it-IT") })); }
      });
    });
  }

  // ---------------------------------------------------------------- area admin
  function adminSbloccato() { return leggi("admin", false) === true; }
  function dataFle(s) {
    var m = String(s || "").match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/);
    if (!m) return null;
    return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]));
  }
  function riepilogoFle(r) {
    if (!r) return null;
    var perTid = {};
    (r.comps || []).forEach(function (c) {
      (c.tmids || []).forEach(function (t) { var k = String(t); if (!perTid[k]) perTid[k] = { gioca: true, lu: null }; });
      (c.lineups || []).forEach(function (l) { perTid[String(l.tid)] = { gioca: true, lu: l }; });
    });
    var leghe = {};
    SQUADRE.forEach(function (t) {
      var x = perTid[String(t[2])] || { gioca: false, lu: null };
      (leghe[t[0]] = leghe[t[0]] || []).push({ squadra: t[1], info: x });
    });
    function rango(x) { return x.info.gioca && !x.info.lu ? 0 : x.info.lu ? 1 : 2; }
    var lista = Object.keys(leghe).sort().map(function (L) {
      return { lega: L, squadre: leghe[L].sort(function (a, b) { return rango(a) - rango(b) || String(a.squadra).localeCompare(String(b.squadra)); }) };
    });
    var tutte = [].concat.apply([], lista.map(function (L) { return L.squadre; }));
    return { mday: r.mday, inizio: inizioGiornataFle(r.mstr), lista: lista, giocano: tutte.filter(function (x) { return x.info.gioca; }).length, consegnate: tutte.filter(function (x) { return x.info.lu; }).length, errori: r.errors || [], at: r.at };
  }
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
  function testoWhatsapp(R) {
    var at = R.at ? new Date(R.at) : null, prima = R.inizio && at && at.getTime() < R.inizio.getTime();
    var righe = ["📊 FLE · " + R.mday + "ª giornata" + (R.inizio ? " · inizio " + dataBreve(R.inizio) : ""),
      "Consegnate: " + R.consegnate + "/" + R.giocano, "Ultimo controllo: " + (at ? dataCompleta(at) : "non disponibile"), ""];
    R.lista.forEach(function (L) {
      var gioc = L.squadre.filter(function (x) { return x.info.gioca; });
      if (!gioc.length) return;
      righe.push("🏆 " + L.lega + " · " + gioc.filter(function (x) { return x.info.lu; }).length + "/" + gioc.length);
      gioc.forEach(function (x) { righe.push((x.info.lu ? "🟢 " : "🔴 ") + x.squadra + (x.info.lu && oraConsegna(x.info.lu) ? " · " + oraConsegna(x.info.lu) : "")); });
      righe.push("");
    });
    if (R.errori.length) { righe.push("⚠️ Non lette: " + R.errori.join(" · ")); righe.push(""); }
    righe.push("🟢 = formazione presente su FLE (ora di consegna) · 🔴 = nessuna formazione su FLE al momento del controllo" + (prima ? " (giornata non ancora iniziata)" : ""));
    righe.push("Fonte: FantaLegaEuropa-FLE su Leghe Fantacalcio");
    return righe.join("\n");
  }
  // condivisione: foglio di condivisione di iOS (WhatsApp); se non disponibile, testo copiato
  function condividiTesto(t) {
    if (navigator.share) { navigator.share({ text: t }).catch(function () {}); return; }
    try { navigator.clipboard.writeText(t).then(function () { avviso("Riepilogo copiato: incollalo su WhatsApp."); }, function () { avviso("Condivisione non disponibile.", true); }); }
    catch (e) { avviso("Condivisione non disponibile.", true); }
  }
  // S4: controllo FLE automatico SOLO all'ingresso scelto dall'utente (AREA ADMIN, sblocco): mai al rientro dalla
  // pagina FLE, mai in ciclo, mai se l'ultimo controllo ha meno di 2 minuti (AGGIORNA resta sempre possibile)
  var ADMIN_AUTO_MS = 2 * 60000;
  function controlloAutoAmmesso() {
    var r = leggi("admin_fle", null), at = r && Date.parse(r.at || "");
    return adminSbloccato() && !taskAttivoFle() && !(at && Date.now() - at < ADMIN_AUTO_MS);
  }
  function avviaControlloConsegne(perche) {
    log("CONTROLLO CONSEGNE", { avvio: perche });
    sScrivi("task", { tipo: "admin", inizio: Date.now(), ritorno: location.href });
    location.assign(fleDashboardUrl());
  }
  function apriAdmin(ingresso) {
    monta();
    chiudiPannello();
    pannelloPrincipale = false;
    pannello = document.createElement("div");
    pannello.className = "ov";
    radice.appendChild(pannello);
    var auto = !!ingresso && controlloAutoAmmesso();
    disegnaAdmin(null, auto);
    if (auto) setTimeout(function () { if (pannello) avviaControlloConsegne("ingresso in Area Admin"); }, 600);
  }
  function disegnaAdmin(errore, avvio) {
    if (!pannello) return;
    var h = "<div class='cd'><button class='x' data-a='indietro'>INDIETRO</button><div class='t1'>AREA ADMIN</div><div class='mu'>Fanta Vice Mister Safari " + VERSIONE + "</div></div>";
    if (!adminSbloccato()) {
      h += "<div class='cd'><div class='lb'>CODICE ADMIN</div><input id='fvm-codice' autocomplete='off' autocapitalize='characters' style='width:100%;margin-top:10px;padding:12px;border-radius:12px;border:1px solid #2a4370;background:#0a1524;color:#fff;font-size:16px'>" +
        (errore ? "<div style='color:#f87171;margin-top:8px'>" + esc(errore) + "</div>" : "") +
        "<button class='bt oro' data-a='sblocca'>SBLOCCA</button><div class='mu' style='margin-top:8px'>Il codice non va condiviso con i partecipanti. Apre le funzioni di FVM: i permessi sui siti restano quelli del tuo account.</div></div>";
    } else {
      var R = riepilogoFle(leggi("admin_fle", null)), ora = Date.now();
      h += "<div class='lb' style='margin:4px 0 6px'>CONTROLLO FLE (TUTTE LE SQUADRE)</div>";
      if (avvio) h += "<div class='cd' style='border-color:#e2b33c'><div style='font-weight:800'>Avvio del controllo FLE…</div><div class='mu'>Apro FantaLegaEuropa-FLE e leggo le formazioni consegnate di tutte le competizioni.</div></div>";
      if (errore) h += "<div class='cd' style='border-color:#e2333b;margin-top:10px'><div style='color:#f87171'>" + esc(errore) + "</div></div>";
      if (R) {
        var at = R.at ? new Date(R.at) : null, prima = R.inizio && ora < R.inizio.getTime(), manca = mancaAllInizio(R.inizio, ora);
        h += "<div class='cd' style='margin-top:4px'><div class='lb'>" + esc(R.mday) + "ª GIORNATA FLE</div>" +
          (R.inizio ? "<div class='mu'>Inizio: " + esc(dataBreve(R.inizio)) + (manca ? " · mancano " + esc(manca) : prima ? "" : " · iniziata") + "</div>" : "<div class='mu'>Inizio della giornata: DATO NON DISPONIBILE</div>") +
          "<div style='font-size:20px;font-weight:900;margin-top:6px'>" + R.consegnate + "/" + R.giocano + " consegnate</div>" +
          "<div class='mu'>Ultimo controllo: " + esc(at ? dataCompleta(at) : "non disponibile") + "</div>" +
          (R.errori.length ? "<div style='color:#fbbf24;margin-top:6px;font-size:13px'>" + esc(R.errori.join(" · ")) + "</div>" : "") + "</div>";
        h += "<div style='display:flex;gap:8px'><button class='bt oro' style='flex:1' data-a='controlla'>AGGIORNA</button><button class='bt' style='flex:1;border-color:#22c55e;color:#4ade80' data-a='whatsapp'>CONDIVIDI SU WHATSAPP</button></div>";
        R.lista.forEach(function (L) {
          var gioc = L.squadre.filter(function (x) { return x.info.gioca; });
          h += "<div class='cd'><div class='lb'>" + esc(L.lega) + (gioc.length ? " · " + gioc.filter(function (x) { return x.info.lu; }).length + "/" + gioc.length : "") + "</div>";
          L.squadre.forEach(function (x) {
            var col = x.info.lu ? "#4ade80" : x.info.gioca ? "#f87171" : "#7d8799";
            var det = x.info.lu ? oraConsegna(x.info.lu) + (x.info.lu.visb === false || x.info.lu.visb === 0 ? " · invisibile" : "")
              : x.info.gioca ? (prima ? "in attesa" : "non schierata (al controllo)") : "non gioca questa giornata";
            h += "<div style='display:flex;justify-content:space-between;gap:8px;margin-top:6px;font-size:14px'><span style='color:" + col + ";font-weight:700'>" + esc(x.squadra) + "</span><span class='mu'>" + esc(det) + "</span></div>";
          });
          h += "</div>";
        });
        h += "<div class='mu' style='font-size:11px;margin:4px 2px 8px'>Fonte: FantaLegaEuropa-FLE (league/status, competizioni, calendario, formazioni). Nessun calcolo di jolly o penalità.</div>";
      } else if (!avvio) h += "<button class='bt oro' data-a='controlla'>CONTROLLA SU FLE (TUTTE LE SQUADRE)</button>";
      // 1.1.0 Fantaclub fase 2: prova del passaggio tra domini con dati fittizi (solo admin)
      h += "<button class='bt' data-a='ufficiale'>CONSEGNE UFFICIALI DELLE LEGHE</button>";
      h += "<button class='bt' data-a='prova_fantaclub'>PROVA PASSAGGIO FANTACLUB</button>";
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
              scrivi("admin", true); log("ADMIN", "sbloccato");
              var auto = controlloAutoAmmesso();
              disegnaAdmin(null, auto);
              if (auto) setTimeout(function () { if (pannello) avviaControlloConsegne("sblocco Area Admin"); }, 600);
            } else disegnaAdmin("Codice non valido.");
          }).catch(function () { disegnaAdmin("Verifica del codice non riuscita."); });
        }
        if (a === "esci") { scrivi("admin", false); log("ADMIN", "uscito"); disegnaAdmin(); }
        if (a === "prova_fantaclub") {
          // andata verso Fantaclub con dati fittizi; il ritorno arriva con TORNA A FVM dalla barra su Fantaclub
          var at = Date.now();
          var id = inviaPassaggio("fantaclub", "prova", { prova: "dati fittizi", numero: 42, testo: "Fanta Vice Mister" }, "/");
          if (id) { sScrivi("passaggio_prova", { id: id, at: at }); log("PASSAGGIO", { tipo: "prova", esito: "inviato" }); }
          else log("PASSAGGIO", { tipo: "prova", esito: "non inviato" });
        }
        if (a === "controlla") avviaControlloConsegne("AGGIORNA");
        if (a === "ufficiale") apriUfficiale();
        if (a === "whatsapp") {
          var R2 = riepilogoFle(leggi("admin_fle", null));
          if (R2) condividiTesto(testoWhatsapp(R2));
        }
      });
    });
  }
  function eseguiConsegne(task) {
    var w = lavoro("Controllo consegne FLE in corso…");
    w.stato("Apro FLE…");
    function finisci(risultato) {
      risultato.at = new Date().toISOString();
      scrivi("admin_fle", risultato);
      log("CONTROLLO CONSEGNE", { giornata: risultato.mday, competizioni: (risultato.comps || []).length, errori: risultato.errors });
      sScrivi("task", null);
      sScrivi("apri", "admin");
      if (task.ritorno && task.ritorno.indexOf("/" + FLE_SLUG + "/") < 0) location.assign(task.ritorno);
      else { w.chiudi(); apriAdmin(); }
    }
    function esegui() {
      ctl.inCorso = true;
      var mday = Number(ctl.status && ctl.status.mday || 0);
      var comps = (ctl.comps || []).filter(function (c) { return c && !c.del; });
      var out = { mday: mday, mstr: String(ctl.status && ctl.status.mstr || ""), comps: [], errors: [] };
      w.stato("Giornata " + mday + ": controllo " + comps.length + " competizioni…");
      var i = 0;
      (function prossima() {
        if (i >= comps.length) { finisci(out); return; }
        var c = comps[i++];
        getApi("/onboarding/v1/league/competition/calendar/" + c.id).then(function (cal) {
          var turno = (cal || []).filter(function (r) { return Number(r.championshipMatchDay) === mday; })[0];
          if (!turno) { out.comps.push({ id: c.id, name: c.name, tmids: c.tmids || [], lineups: null }); return null; }
          return getApi("/gaming/v1/teamLineup/" + c.id + "/" + turno.matchDay + "/" + mday).then(function (lu) {
            var squadre = [];
            (turno.matches || []).forEach(function (m) { if (m.tIdH) squadre.push(m.tIdH); if (m.tIdA) squadre.push(m.tIdA); });
            out.comps.push({ id: c.id, name: c.name, tmids: squadre.length ? squadre : (c.tmids || []),
              lineups: (lu || []).map(function (l) { return { tid: l.tid, ldate: l.ldate || "", visb: l.visb }; }) });
          });
        }).catch(function (e) { out.errors.push(c.name + ": " + String(e && e.message || e)); })
          .then(function () { w.stato("Controllate " + i + "/" + comps.length + " competizioni…"); prossima(); });
      })();
    }
    var atteso = 0;
    var timer = setInterval(function () {
      atteso += 500;
      if (ctl.comps && ctl.status && ((ctl.hdr && ctl.hdrScore >= 2) || atteso >= 6000)) { clearInterval(timer); esegui(); }
      else if (atteso >= 25000) {
        clearInterval(timer);
        finisci({ mday: 0, comps: [], errors: ["Pagina FLE non letta (accesso: " + (ctl.hdr ? "si" : "no") + ", competizioni: " + (ctl.comps ? "si" : "no") + ", giornata: " + (ctl.status ? "si" : "no") + ")"] });
      }
    }, 500);
  }

  // ---------------------------------------------------------------- diagnosi condivisa
  // 1.1.0: nel limite di ~3300 caratteri entrano PRIMA le righe di controllo/invio FLE ed errori, poi le altre piu recenti
  // (navigazione, lega sorgente, modalita); tutto in ordine cronologico, con l'indicazione delle righe omesse.
  var DIAG_PRIORITA = /CONTROLLO FLE|INVIO FLE|INVIO CORPO|INVIO FORMATO|INVIO INTESTAZIONI|ESITO|ERRORE|SCADUTA|SALVATAGGIO|TID DIVERSO|PASSAGGIO|FANTACLUB/;
  var DIAG_LIMITE = 3300;
  // niente collegamenti nel testo condiviso: chi lo riceve (es. WhatsApp) non deve ridurlo al solo link dell'API
  function testoDiagnosi(s) {
    return String(s).replace(/https?:\/\//gi, "").replace(/\b(?:[a-z0-9-]+\.)+(?:it|io|com|net|org)\b/gi, function (m) { return m.replace(/\./g, "[.]"); });
  }
  function condividiDiagnosi() {
    var righe = leggi("diag", []).map(testoDiagnosi);
    var testo = "Fanta Vice Mister Safari " + VERSIONE + " · diagnosi\n" + navigator.userAgent.replace(/\s+/g, " ").slice(0, 160) + "\n";
    var spazio = DIAG_LIMITE - testo.length - 300; // margine per le righe "… omesse"
    var scelte = {}, usato = 0, i;
    // 1) righe prioritarie, dalle piu recenti, fino a circa due terzi dello spazio
    for (i = righe.length - 1; i >= 0 && usato < spazio * 0.65; i--) {
      if (DIAG_PRIORITA.test(righe[i]) && usato + righe[i].length + 1 <= spazio) { scelte[i] = true; usato += righe[i].length + 1; }
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
          if (dec.azione === "adotta") meRegistra(slug, uff, "adottata");
          if (dec.azione === "inizializza") meRegistra(slug, uff, "osservata");
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
  // ACQUISISCI: la formazione ufficiale letta diventa la formazione della lega in FVM (come dopo Salva formazione).
  // Poi, solo per le squadre del circuito, il normale controllo FLE. Nessun invio: il PASSO 3 resta da confermare.
  function meAcquisisci(slug, uff, controllaFle) {
    var nomi = {};
    uff.titolari.concat(uff.panchina).forEach(function (pid) { var x = uff.nomi[pid] || info[pid]; if (x) nomi[pid] = { n: x.n || "", r: Number(x.r || 0) }; });
    var corpo = { idcomp: uff.comp, tid: uff.tid, mday: uff.giornata, cmday: uff.giornataSA, mdl: uff.modulo, starts: uff.titolari.slice(), bench: uff.panchina.slice(), capt: uff.capt };
    var dati = { at: Date.now(), lega: slug, suFle: false, modulo: uff.modulo, titolari: uff.titolari.slice(), panchina: uff.panchina.slice(), cambiata: false,
      tid: uff.tid, comp: uff.comp, capt: uff.capt, corpo: JSON.stringify(corpo), nomi: nomi, ok: true, fonte: "acquisizione" };
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
    monta();
    // 1.1.0: a ogni nuova sessione di Safari si riparte da LEGA + FLE (come l'app),
    // salvo un'attivita FLE gia in corso in questa scheda.
    if (!sLeggi("sessione")) {
      sScrivi("sessione", Date.now());
      if (!sLeggi("task") && leggi("modo", "lega_fle") !== "lega_fle") { scrivi("modo", "lega_fle"); log("MODO", { a: "lega_fle", perche: "nuova sessione" }); }
    }
    controllaPagina();
    riconosciSorgente();
    if (applicaBloccoModo("avvio")) return;
    aggiornaFab();
    aggiornaBarra();
    if (avviato || !document.body) return;
    avviato = true;
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
    if (task && suFle()) {
      if (task.tipo === "admin") { eseguiConsegne(task); return; }
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
