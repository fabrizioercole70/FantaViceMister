// ==UserScript==
// @name         FVM PROVA AGGIORNAMENTI
// @namespace    fvm-prova-aggiornamenti
// @description  Solo prova degli aggiornamenti Userscripts (nessun sito Fantacalcio). Da eliminare dopo la prova.
// @version      1.3.6.1
// @match        https://fabrizioercole70.github.io/FantaViceMister/prova/*
// @updateURL    https://raw.githubusercontent.com/fabrizioercole70/FantaViceMister/main/prova/FVM_prova_aggiornamenti.user.js
// @downloadURL  https://raw.githubusercontent.com/fabrizioercole70/FantaViceMister/main/prova/FVM_prova_aggiornamenti.user.js
// @run-at       document-end
// @inject-into  page
// ==/UserScript==
(function () {
  "use strict";
  var INSTALLATA = "1.3.6.1";
  function aggConfronta(a, b) {
    var x = String(a || "").split("-")[0].split("."), y = String(b || "").split("-")[0].split(".");
    for (var i = 0; i < Math.max(x.length, y.length); i++) { var p = parseInt(x[i], 10) || 0, q = parseInt(y[i], 10) || 0; if (p !== q) return p > q ? 1 : -1; }
    return 0;
  }
  var box = document.getElementById("esito");
  if (!box) return;
  box.innerHTML = "<b>Script di prova installato: " + INSTALLATA + "</b><br>Controllo dell'avviso FVM…";
  fetch("aggiornamento.json?t=" + Date.now(), { cache: "no-store" }).then(function (r) { return r.json(); }).then(function (j) {
    var c = aggConfronta(j.versione, INSTALLATA);
    box.innerHTML = "<b>Script di prova installato: " + INSTALLATA + "</b><br>Versione pubblicata (prova): " + j.versione +
      "<br>Avviso FVM: " + (c > 0 ? "<b style='color:#e2b33c'>AGGIORNAMENTO DISPONIBILE (" + INSTALLATA + " → " + j.versione + ")</b>" : "nessun aggiornamento (già alla versione pubblicata)");
  }).catch(function (e) { box.innerHTML += "<br>aggiornamento.json non letto: " + e; });
})();
