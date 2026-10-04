// ==UserScript==
// @name         Fanta Vice Mister
// @description  Fanta Vice Mister per Safari (iPhone e Mac) e browser PC: ordine della panchina, controllo e invio su FLE, area admin.
// @version      0.4.0
// @updateURL    https://raw.githubusercontent.com/fabrizioercole70/FantaViceMister/main/FantaViceMister.user.js
// @downloadURL  https://raw.githubusercontent.com/fabrizioercole70/FantaViceMister/main/FantaViceMister.user.js
// @match        https://leghe.fantacalcio.it/*
// @run-at       document-start
// @inject-into  page
// ==/UserScript==

(function () {
  "use strict";
  if (window.top !== window) return;
  if (window.__FVM_SAFARI__) return;
  window.__FVM_SAFARI__ = true;

  var VERSIONE = "0.4.0";
  var PREFISSO = "fvm_";
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
  // Le 80 squadre: [lega, squadra, tid FLE, tid nella lega]
  var SQUADRE = [["LEGA DEL PIANTO","Ideale Bari",4583705,1011789],["LEGA DEL PIANTO","SCHALKE 104",4288743,1013377],["LEGA DEL PIANTO","Zenith Bari",4289115,1017567],["LEGA DEL PIANTO","Ass Paoloneculone",4290965,1037009],["LEGA DEL PIANTO","ANV Football Club 1990",4463113,1744019],["LEGA DEL PIANTO","REPUBBLICA DI GILEAD",4290230,1744043],["LEGA DEL PIANTO","U.S. TICCHIU",4661797,1744087],["LEGA DEL PIANTO","Lino Banfield",4583348,2623328],["LEGA DEL PIANTO","A.S. Vitin",4670912,3252428],["LEGA DEL PIANTO","Frosinone Culone - Sion",4836989,4837414],["FANTALEGAVALDINIEVOLE","I BASTARDI SENZA GLORIA",3856689,1627218],["FANTALEGAVALDINIEVOLE","Hard Head",3871740,1627343],["FANTALEGAVALDINIEVOLE","R-P-G",3890986,1627818],["FANTALEGAVALDINIEVOLE","Maremmagnuda",3883077,1629612],["FANTALEGAVALDINIEVOLE","Berlusca Dortmund",3883604,1636612],["FANTALEGAVALDINIEVOLE","€ORCO DIA",3883797,5749060],["FANTALEGAVALDINIEVOLE","Minnesota",3881411,6081131],["FANTALEGAVALDINIEVOLE","Deportivo la Carogna",7872699,13929457],["FANTALEGAVALDINIEVOLE","Troopers",7784769,16654231],["FANTALEGAVALDINIEVOLE","Ruotino di Scorta",3871852,16661644],["FANTA FOCOLARE 2","Gin toNico",3856500,2583475],["FANTA FOCOLARE 2","Olympique Sartiglia",3876596,2583889],["FANTA FOCOLARE 2","Gol D. Roggero",3874629,2584018],["FANTA FOCOLARE 2","Rutti di Boskov",3872392,2584170],["FANTA FOCOLARE 2","Lokomotiv Sant€Orsola",3874451,2584516],["FANTA FOCOLARE 2","Real MaiPiu",3876601,2586324],["FANTA FOCOLARE 2","Il Santo Osso Sacro Graal Rotto DC",3883257,2589897],["FANTA FOCOLARE 2","La grande fuga di Lameck Banda",3883293,2592285],["FANTA FOCOLARE 2","atlmalitti",3883308,2618905],["FANTA FOCOLARE 2","Ufficio Sinistri zero",3880147,3617383],["FANTAPINTUS LO SCOPRITORE DI BIDONI","I TALENTI DEL PINTO",4186117,1593677],["FANTAPINTUS LO SCOPRITORE DI BIDONI","SS BARLETTA 1922",4192061,1593795],["FANTAPINTUS LO SCOPRITORE DI BIDONI","AS FAL",4189376,1594454],["FANTAPINTUS LO SCOPRITORE DI BIDONI","Companeros FC",4195025,1595003],["FANTAPINTUS LO SCOPRITORE DI BIDONI","Dos Desperados",4189377,1595777],["FANTAPINTUS LO SCOPRITORE DI BIDONI","Piu KOLO che MUANIma",4198164,1596701],["FANTAPINTUS LO SCOPRITORE DI BIDONI","FC INSIEME SI VOLA",4197802,1600002],["FANTAPINTUS LO SCOPRITORE DI BIDONI","Cuesta non e ibiza",4193606,1600221],["FANTAPINTUS LO SCOPRITORE DI BIDONI","AC MILAN",7680238,1604113],["FANTAPINTUS LO SCOPRITORE DI BIDONI","FC CALL OF DIOUF",6716524,6700723],["POLFER","FC R4iNbow",6706486,996915],["POLFER","Cassiopea",6747402,999334],["POLFER","TSN Kawa",6866666,1035252],["POLFER","napoleon",6752548,1039096],["POLFER","A.C. Avanti Cristo",6893193,1193823],["POLFER","Timberwolves",6866782,1632331],["POLFER","AC Devilteam",7262923,1635839],["POLFER","Piotr",6933887,1639195],["POLFER","Stocastico",6716135,6626512],["POLFER","Dinamo Losca",11753918,6626869],["FANTAROCCOLEGENDSPORT","Fellatium",3857314,2070261],["FANTAROCCOLEGENDSPORT","Buon 65 e mezzo",3892660,2072798],["FANTAROCCOLEGENDSPORT","DOFLAMENGO",3892533,2072867],["FANTAROCCOLEGENDSPORT","MANK TOMINAY",3892600,2072884],["FANTAROCCOLEGENDSPORT","AS PILICUETA",3892591,2073171],["FANTAROCCOLEGENDSPORT","Phramba",3894924,2073184],["FANTAROCCOLEGENDSPORT","LOFFENHEIM",3892674,2074942],["FANTAROCCOLEGENDSPORT","No Mercy",3892932,2077210],["FANTAROCCOLEGENDSPORT","DEJAVU",3892726,2079015],["FANTAROCCOLEGENDSPORT","AC Pappo",3894883,5323275],["LEGA DE NOANTRI","Acr Messina",11776923,10224048],["LEGA DE NOANTRI","FLAMENGO",11691923,10225644],["LEGA DE NOANTRI","Barcelona F.C.",11776908,10225765],["LEGA DE NOANTRI","Pennic Hellas",11822953,10227289],["LEGA DE NOANTRI","Super Santos",11708505,10237038],["LEGA DE NOANTRI","Si Puo Fare",6895801,10244150],["LEGA DE NOANTRI","Gingiskan",11858486,10288764],["LEGA DE NOANTRI","Virtus Roma FC",11838514,10374684],["LEGA DE NOANTRI","Boca Junior",11776593,14854829],["LEGA DE NOANTRI","Temptation Haaland",11733123,18944612],["FANTAVALDINIEVOLE","Big Ramblas",7790602,0],["FANTAVALDINIEVOLE","DieghINDA",7794941,0],["FANTAVALDINIEVOLE","Gli Ingiocabili",7784659,0],["FANTAVALDINIEVOLE","MisterTrip",7845790,0],["FANTAVALDINIEVOLE","Never give up",7789410,0],["FANTAVALDINIEVOLE","Press Team",7785027,0],["FANTAVALDINIEVOLE","Real Gongolo",7784760,0],["FANTAVALDINIEVOLE","Sabonis",7802493,0],["FANTAVALDINIEVOLE","The miraculous",7867526,0],["FANTAVALDINIEVOLE","The Rookie",7802273,0]];
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
  function impostaLega(slug) {
    if (!slug || slug === FLE_SLUG) return;
    var sorgente = leggi("lega_sorgente", "");
    // La prima lega reale riconosciuta diventa la sorgente stabile.
    // Da qui in poi i passaggi temporanei del selettore non possono sostituirla.
    if (!sorgente) { scrivi("lega_sorgente", slug); scrivi("lega", slug); log("LEGA SORGENTE", slug); return; }
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
    // SOLO LEGA e LEGA+FLE, quando non stanno eseguendo un task FLE, restano sulla sorgente.
    if ((modo === "solo_lega" || modo === "lega_fle") && sorgente && slugPagina && slugPagina !== sorgente) {
      log("BLOCCO MODO", { modo: modo, perche: perche || "pagina", da: slugPagina, a: sorgente });
      location.assign(urlLegaSorgente()); return true;
    }
    return false;
  }
  function urlFormazione(slug) {
    var comp = leggi("comp_" + slug, 0);
    return comp ? "https://leghe.fantacalcio.it/" + slug + "/view/competition/" + comp + "/lineup" : "";
  }
  function controllaPagina() {
    if (suFle()) return;
    var m = location.pathname.match(/^\/([^\/]+)\/view\/competition\/(\d+)\/lineup/);
    if (m) {
      impostaLega(m[1]);
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
  function competizioniDaApi(j) {
    try {
      if (suFle()) return;
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
      if (/league\/competitions$/i.test(p)) { if (suFle()) ctl.comps = listaCompetizioni(j).concat([]); else competizioniDaApi(j); }
      if (/league\/status$/i.test(p) && suFle()) ctl.status = j && j.data ? j.data : j;
      if (suFle() && testo.indexOf("teamLineupDto") >= 0) {
        var pl = trovaPayload(j, 0);
        if (pl) {
          var dto = pl.teamLineupDto || {};
          ctl.payload = { comp: Number(dto.idcomp || 0), tid: Number(dto.tid || 0), mday: dto.mday, cmday: dto.cmday, ids: (pl.lineUpInfo || []).map(function (x) { return Number(x && x.pid); }).filter(Boolean) };
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
    var u = leggi("ultima", null), f = leggi("fle", null);
    if (!u || !u.titolari || !f || !f.roster) return null;
    return costruisciFle(sorgente(u), f.roster, Object.assign({}, sceltePerTid(f.tid), f.choices || {}));
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
      if (!suFle()) scrivi("save_req", { url: String(url || ""), metodo: String(metodo || "PUT") });
      var ids = o.bench.map(idDi);
      var dati = {
        at: Date.now(), lega: suFle() ? FLE_SLUG : (legaCorrente() || slugDaPagina()), suFle: suFle(),
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
    ".panchinaDet.aperta{display:block}";

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
  function aggiornaFab() { if (fab) fab.style.display = suLogin() ? "none" : "block"; }

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
    if (elementoTesto(/^accedi$/i)) return false;
    // Se non siamo nella pagina di login e il sito non mostra piu "ACCEDI",
    // consideriamo la sessione autenticata anche nella pagina selettore leghe.
    return true;
  }
  function accedi() {
    chiudiPannello();
    // Ricorda che il login e partito da Fanta Vice Mister: dopo l'autenticazione
    // riapriremo automaticamente la home FVM invece di lasciare il selettore leghe.
    sScrivi("ritorno_login", { daFvm: true, at: Date.now() });
    var a = elementoTesto(/^accedi$/i);
    log("ACCESSO", a ? "apro login" : "vado alla home");
    if (a) a.click(); else location.assign("https://leghe.fantacalcio.it/");
  }
  function disconnetti() {
    if (!confirm("Vuoi uscire da Leghe Fantacalcio su questo iPhone?")) return;
    var e = elementoTesto(/^(esci|logout|disconnetti)$/i);
    log("DISCONNETTI", e ? "pulsante del sito" : "pulizia dati sito");
    if (e) { chiudiPannello(); e.click(); return; }
    try {
      Object.keys(localStorage).forEach(function (k) { if (k.indexOf(PREFISSO) !== 0) localStorage.removeItem(k); });
      sessionStorage.clear();
      document.cookie.split(";").forEach(function (c) {
        var n = c.split("=")[0].trim();
        if (!n) return;
        document.cookie = n + "=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
        document.cookie = n + "=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; domain=.fantacalcio.it";
      });
    } catch (x) {}
    location.assign("https://leghe.fantacalcio.it/");
  }

  // ---------------------------------------------------------------- schermata principale
  var pannello = null;
  function chiudiPannello() { if (pannello) { pannello.remove(); pannello = null; } }
  function apriPannello() {
    monta();
    if (!radice) return;
    chiudiPannello();
    pannello = document.createElement("div");
    pannello.className = "ov";
    radice.appendChild(pannello);
    aggiornaPannello();
  }
  function rigaGiocatore(num, p, extra) {
    return "<div class='riga' style='cursor:default'>" + (num ? "<span class='num on'>" + num + "</span>" : "") + badge(p.role || p.r) + "<span class='nm'>" + esc(p.name || p.n || "") + "</span>" + (extra || "") + "</div>";
  }
  function cartaPasso2() {
    var u = leggi("ultima", null), f = leggi("fle", null) || {};
    var h = "<div class='cd' style='border-left:4px solid #2f6fe0'><div class='lb'>PASSO 2 · CONTROLLO FLE</div>";
    var mod = u && u.ok ? String(u.modulo || "").split("").join("-") : "—";
    var nt = u && u.ok ? u.titolari.length : "—", np = "—";
    var res = null;
    if (f.roster && u && u.ok) res = risultatoFle();
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
      if (res.moduleProblem) h += "<div class='mu' style='color:#f87171'>• " + esc(res.moduleProblem) + "</div>";
      res.items.forEach(function (it) {
        var src = it.source ? (it.source.name + " (" + (RUOLI[it.role] || "?") + ")") : ("posto aggiunto in panchina (" + (RUOLI[it.role] || "?") + ")");
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
  function aggiornaPannello() {
    if (!pannello) return;
    var slug = legaCorrente();
    var u = leggi("ultima", null);
    var invii = leggi("invii", []);
    var conn = connesso();
    var modo = leggi("modo", "lega_fle");
    var h = "";
    h += "<div class='hero'><img src='" + LOGO_FVM + "' alt='FVM'><div style='flex:1'><button class='x' data-a='chiudi'>CHIUDI</button><div class='ht'>FANTA VICE<br>MISTER</div><div class='hs'>v" + VERSIONE + " · Stagione 2026/27</div></div></div>";
    h += "<div class='cd'><div class='lb'>ACCESSO PIATTAFORMA</div>" +
      (conn ? "<div style='color:#4ade80;font-size:20px;font-weight:900;margin-top:6px'>● Connesso ✓</div>" : "<div style='color:#fbbf24;font-size:20px;font-weight:900;margin-top:6px'>● Non connesso</div>") +
      "<div style='color:#e2b33c;font-weight:800'>Leghe Fantacalcio</div>" +
      "<div class='mu'>Username e password vengono inseriti esclusivamente nella pagina ufficiale della piattaforma.</div>" +
      (conn ? "<button class='bt rosso' data-a='disconnetti'>DISCONNETTI</button>" : "<button class='bt oro' data-a='accedi'>ACCEDI</button>") + "</div>";
    h += "<div class='cd verde'><div data-a='formazione'><div class='lb' style='color:#cfe'>PASSO 1 · " + esc(slug ? nomeLega(slug) : "LA TUA LEGA") + "</div>" +
      "<div style='font-size:18px;font-weight:900;margin:4px 0'>FAI O MODIFICA LA FORMAZIONE</div>" +
      "<div class='mu' style='color:#cfe'>" + (modo === "lega_fle" ? "Premi Salva formazione: ordine della panchina, poi controllo per FLE da solo." : modo === "solo_fle" ? "Usa la formazione acquisita come sorgente e prosegui con controllo e invio su FLE." : "Premi Salva formazione: salvo solo nella tua lega.") + "</div></div>" +
      "<div class='modo'><div data-a='modo' data-m='lega_fle' class='" + (modo === "lega_fle" ? "on" : "") + "'>LEGA + FLE</div><div data-a='modo' data-m='solo_lega' class='" + (modo === "solo_lega" ? "on" : "") + "'>SOLO LEGA</div><div data-a='modo' data-m='solo_fle' class='" + (modo === "solo_fle" ? "on" : "") + "'>SOLO FLE</div></div></div>";
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
    h += "<button class='bt' data-a='ricontrolla'>RIPETI CONTROLLO FLE</button>";
    h += "<button class='bt' data-a='diagnosi'>CONDIVIDI DIAGNOSI</button>";
    h += "<div class='cd' style='margin-top:10px'><div class='lb'>STORICO INVII</div>";
    if (invii.length) {
      var ul = invii[0];
      h += "<div style='color:#4ade80;font-size:19px;font-weight:900;margin-top:6px'>Ultimo invio ✓</div>" +
        "<div style='font-weight:800'>" + esc(new Date(ul.at).toLocaleString("it-IT")) + " · " + esc(ul.squadra || "") + " · " + esc(String(ul.modulo || "").split("").join("-")) + "</div>" +
        "<div class='mu'>tutte le competizioni · invisibile</div>";
      invii.slice(1, 5).forEach(function (s) { h += "<div class='mu' style='margin-top:4px'>" + esc(new Date(s.at).toLocaleString("it-IT")) + " · " + esc(s.compName || "") + "</div>"; });
    } else {
      h += "<div class='mu' style='margin-top:6px'>Nessun invio su FLE ancora.</div>";
    }
    h += "<button class='bt' style='color:#aab3c2' data-a='admin'>AREA ADMIN</button></div>";
    h += "<div class='mu' style='text-align:center;margin-top:14px'>Per le competizioni della FantaLegaEuropa<br>Fanta Vice Mister " + VERSIONE + " · Stagione 2026/27</div>";
    pannello.innerHTML = h;
    var cb = pannello.querySelector("#fvm-ricorda");
    if (cb) cb.addEventListener("change", function () { scrivi("ricorda", !!cb.checked); });
    Array.prototype.forEach.call(pannello.querySelectorAll("[data-a]"), function (el) {
      el.addEventListener("click", function (ev) {
        ev.stopPropagation();
        var a = el.getAttribute("data-a");
        if (a === "chiudi") chiudiPannello();
        if (a === "formazione") vaiAllaFormazione();
        if (a === "modo") {
          var nuovoModo = el.getAttribute("data-m");
          var qui = slugDaPagina();
          if (nuovoModo !== "solo_fle" && qui && qui !== FLE_SLUG && !leggi("lega_sorgente", "")) { scrivi("lega_sorgente", qui); scrivi("lega", qui); }
          scrivi("modo", nuovoModo); log("MODO", nuovoModo);
          chiudiPannello();
          if (!applicaBloccoModo("selezione")) apriPannello();
        }
        if (a === "leghe") { chiudiPannello(); location.assign("https://leghe.fantacalcio.it/"); }
        if (a === "accedi") accedi();
        if (a === "disconnetti") disconnetti();
        if (a === "diagnosi") condividiDiagnosi();
        if (a === "admin") apriAdmin();
        if (a === "ricontrolla") avviaControlloFle("pulsante");
        if (a === "panchina") {
          var pd = pannello && pannello.querySelector("#fvm-panchina");
          if (pd) { pd.classList.toggle("aperta"); el.textContent = pd.classList.contains("aperta") ? "NASCONDI PANCHINA ▴" : "MOSTRA PANCHINA ▾"; }
        }
        if (a === "invia") avviaInvioFle();
        if (a === "modifica") { var f = leggi("fle", {}); if (f.comp) { chiudiPannello(); location.assign(fleLineupUrl(f.comp)); } }
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

  function vaiAllaFormazione() {
    var modo = leggi("modo", "lega_fle");
    if (modo === "solo_fle") {
      // 0.3.9: SOLO FLE significa lavorare direttamente sul campo FLE.
      // Non avviare il controllo automatico: l'utente deve poter vedere,
      // modificare e salvare la formazione FLE normalmente.
      var fSolo = leggi("fle", {}) || {};
      var destinazioneFle = Number(fSolo.comp || 0) ? fleLineupUrl(Number(fSolo.comp)) : fleDiscoveryUrl();
      log("PASSO 1 SOLO FLE", { comp: Number(fSolo.comp || 0), diretto: !!Number(fSolo.comp || 0) });
      chiudiPannello();
      location.assign(destinazioneFle);
      return;
    }
    var slug = legaCorrente();
    if (!slug) { avviso("Entra prima nella tua lega dal sito: poi la riconosco da sola.", true); return; }
    var u = urlFormazione(slug);
    log("PASSO 1", { lega: slug, diretto: !!u });
    chiudiPannello();
    if (u) { location.assign(u); return; }
    try { sessionStorage.setItem(PREFISSO + "vai", "1"); } catch (e) {}
    location.assign("https://leghe.fantacalcio.it/" + slug);
    setTimeout(function () { avviso("Se non si apre da sola, tocca \"Inserisci formazione\" nella pagina della lega."); }, 8000);
  }

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
      // Apri il selettore partendo dalla lega sorgente mostrata in alto.
      if (!aperto) {
        var slug = legaCorrente();
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
          var roster = pl.ids.map(function (pid) { var x = info[pid] || {}; return { pid: pid, name: x.n || String(pid), role: Number(x.r || 0), flag: x.f || "" }; });
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
          if (invioCorrente && !invioCorrente.finito && window.__fvmInvio && !window.__fvmInvio.inviato) invioDiretto(task);
        }, 7000);
      } else if (atteso >= 20000) {
        clearInterval(t);
        invioDiretto(task);
      }
    }, 500);
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
    var h = Object.assign({ "content-type": "application/json" }, ctl.hdr || {});
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
    var f = leggi("fle", {}) || {}, u = leggi("ultima", {}) || {};
    sScrivi("task", null);
    if (ok) {
      f.stato = "inviata"; f.inviataAt = Date.now();
      scrivi("fle", f);
      var invii = leggi("invii", []);
      invii.unshift({ at: Date.now(), comp: f.comp, compName: f.compName, squadra: f.squadra || u.squadra, modulo: u.modulo });
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
    return { mday: r.mday, lista: lista, giocano: tutte.filter(function (x) { return x.info.gioca; }).length, consegnate: tutte.filter(function (x) { return x.info.lu; }).length, errori: r.errors || [], at: r.at };
  }
  function oraConsegna(lu) {
    var d = dataFle(lu && lu.cdate);
    return d ? d.toLocaleDateString("it-IT", { weekday: "short", day: "2-digit", month: "2-digit" }) + " " + d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }) : "";
  }
  function testoWhatsapp(R) {
    var t = "📋 CONSEGNE FLE · giornata " + R.mday + "\n" + R.consegnate + "/" + R.giocano + " formazioni consegnate\n";
    R.lista.forEach(function (L) {
      var mancano = L.squadre.filter(function (x) { return x.info.gioca && !x.info.lu; });
      t += "\n" + L.lega + ": " + (mancano.length ? "mancano " + mancano.map(function (x) { return x.squadra; }).join(", ") : "tutte consegnate ✅");
    });
    return t;
  }
  function apriAdmin() {
    monta();
    chiudiPannello();
    pannello = document.createElement("div");
    pannello.className = "ov";
    radice.appendChild(pannello);
    disegnaAdmin();
  }
  function disegnaAdmin(errore) {
    if (!pannello) return;
    var h = "<div class='cd'><button class='x' data-a='indietro'>INDIETRO</button><div class='t1'>AREA ADMIN</div><div class='mu'>Fanta Vice Mister Safari " + VERSIONE + "</div></div>";
    if (!adminSbloccato()) {
      h += "<div class='cd'><div class='lb'>CODICE ADMIN</div><input id='fvm-codice' autocomplete='off' autocapitalize='characters' style='width:100%;margin-top:10px;padding:12px;border-radius:12px;border:1px solid #2a4370;background:#0a1524;color:#fff;font-size:16px'>" +
        (errore ? "<div style='color:#f87171;margin-top:8px'>" + esc(errore) + "</div>" : "") +
        "<button class='bt oro' data-a='sblocca'>SBLOCCA</button><div class='mu' style='margin-top:8px'>Il codice non va condiviso con i partecipanti.</div></div>";
    } else {
      var R = riepilogoFle(leggi("admin_fle", null));
      h += "<button class='bt oro' data-a='controlla'>CONTROLLA SU FLE (TUTTE LE SQUADRE)</button>";
      if (errore) h += "<div class='cd' style='border-color:#e2333b;margin-top:10px'><div style='color:#f87171'>" + esc(errore) + "</div></div>";
      if (R) {
        h += "<div class='cd' style='margin-top:10px'><div class='lb'>GIORNATA " + esc(R.mday) + "</div><div style='font-size:20px;font-weight:900;margin-top:6px'>" + R.consegnate + "/" + R.giocano + " consegnate</div>" +
          "<div class='mu'>Controllato il " + esc(new Date(R.at).toLocaleString("it-IT")) + "</div>" +
          (R.errori.length ? "<div style='color:#fbbf24;margin-top:6px;font-size:13px'>" + esc(R.errori.join(" · ")) + "</div>" : "") + "</div>";
        R.lista.forEach(function (L) {
          h += "<div class='cd'><div class='lb'>" + esc(L.lega) + "</div>";
          L.squadre.forEach(function (x) {
            var col = x.info.lu ? "#4ade80" : x.info.gioca ? "#f87171" : "#7d8799";
            var det = x.info.lu ? oraConsegna(x.info.lu) + (x.info.lu.visb === false || x.info.lu.visb === 0 ? " · invisibile" : "") : x.info.gioca ? "non ancora schierata" : "non gioca questa giornata";
            h += "<div style='display:flex;justify-content:space-between;gap:8px;margin-top:6px;font-size:14px'><span style='color:" + col + ";font-weight:700'>" + esc(x.squadra) + "</span><span class='mu'>" + esc(det) + "</span></div>";
          });
          h += "</div>";
        });
        h += "<button class='bt' data-a='whatsapp'>CONDIVIDI SU WHATSAPP</button>";
      }
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
            if (hx === CODICE_ADMIN_SHA256) { scrivi("admin", true); log("ADMIN", "sbloccato"); disegnaAdmin(); } else disegnaAdmin("Codice non valido.");
          }).catch(function () { disegnaAdmin("Verifica del codice non riuscita."); });
        }
        if (a === "esci") { scrivi("admin", false); log("ADMIN", "uscito"); disegnaAdmin(); }
        if (a === "controlla") {
          log("CONTROLLO CONSEGNE", "avvio");
          sScrivi("task", { tipo: "admin", inizio: Date.now(), ritorno: location.href });
          location.assign(fleDashboardUrl());
        }
        if (a === "whatsapp") {
          var R2 = riepilogoFle(leggi("admin_fle", null));
          if (R2 && navigator.share) navigator.share({ text: testoWhatsapp(R2) }).catch(function () {});
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
      var out = { mday: mday, comps: [], errors: [] };
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
              lineups: (lu || []).map(function (l) { return { tid: l.tid, cdate: l.cdate || l.ldate || "", visb: l.visb }; }) });
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
  function condividiDiagnosi() {
    var righe = leggi("diag", []);
    var testo = "Fanta Vice Mister Safari " + VERSIONE + " · diagnosi\n" + navigator.userAgent.replace(/\s+/g, " ").slice(0, 160) + "\n";
    var corpo = righe.slice();
    while (corpo.length && (testo + corpo.join("\n")).length > 3300) corpo.shift();
    testo += corpo.join("\n");
    if (navigator.share) {
      navigator.share({ title: "Diagnosi Fanta Vice Mister", text: testo }).catch(function () {});
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(testo).then(function () { avviso("Diagnosi copiata: incollala su WhatsApp."); }).catch(function () {});
    }
  }

  // ---------------------------------------------------------------- avvio
  var avviato = false;
  function avvia() {
    monta();
    controllaPagina();
    if (applicaBloccoModo("avvio")) return;
    aggiornaFab();
    if (avviato || !document.body) return;
    avviato = true;
    var task = sLeggi("task");
    if (task && Date.now() - Number(task.inizio || 0) > 180000) { log("ATTIVITA SCADUTA", task.tipo); sScrivi("task", null); task = null; }
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
    var apri = sLeggi("apri"), flash = sLeggi("flash");
    sScrivi("apri", null); sScrivi("flash", null);
    if (apri === "admin") { apriAdmin(); return; }
    if (apri === "main") { apriPannello(); if (flash) avviso(flash); return; }
    if (!suFormazione() && !suLogin()) apriPannello();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", avvia); else avvia();
  window.addEventListener("load", avvia);
  var ultimaPagina = location.pathname;
  setInterval(function () {
    if (!host || !host.isConnected) { host = null; radice = null; pannello = null; fab = null; monta(); }
    aggiornaFab();
    if (location.pathname !== ultimaPagina) {
      ultimaPagina = location.pathname;
      log("PAGINA", ultimaPagina);
      controllaPagina();
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
