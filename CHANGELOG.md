# Fanta Vice Mister — CHANGELOG

Per ogni versione: numero, data, novità, correzioni, limitazioni note.
iPhone (Safari): il riepilogo breve della versione più recente è anche in `aggiornamento.json` (riquadro AGGIORNA ORA).

## iPhone (Safari) 1.3.4 — 11 ottobre 2026
**Novità**
- Consegne ufficiali Leghe Fantacalcio Classic con gli stati del sito (campo `act`): Formazione inviata via web / via app,
  Formazione modificata dall'admin, Recuperata dal Server, Sconfitta a tavolino, Formazione non inserita.
- Rosso tenue per recuperi dal server, sconfitte a tavolino e formazioni non inserite (giornata calcolata); contatori come il sito.
- Riquadro aggiornamenti nella Home: versione installata, nuova versione, «Cosa cambia», AGGIORNA ORA, NON ORA.
  AGGIORNA ORA guida l'aggiornamento con Userscripts; «completato» solo quando la nuova versione è davvero attiva.
- SOLO LEGA: cambiando lega dal sito, PASSO 1, LA MIA SQUADRA e FAI O MODIFICA seguono la lega scelta (resta SOLO LEGA);
  i dati della lega precedente non vengono trascinati; le Consegne ufficiali non cambiano la lega di lavoro.

**Correzioni**
- Area Admin FLE: competizioni senza partite nella giornata escluse dal conteggio (niente falso «0/80»); competizioni non
  lette = squadre «non verificate», mai «non schierate»; avviso CONTROLLO INCOMPLETO anche su WhatsApp.
- Area Admin FLE: un nuovo tentativo dopo 1,5 s in caso di errore (es. HTTP 400); conservato l'ultimo controllo valido;
  AGGIORNA con identificativo, doppia pressione ignorata, tempo massimo 70 s, letture sempre dal server.
- Consegne ufficiali: errori del server e risposte non valide non diventano mai «formazione non inserita».
- Area Admin FLE: AGGIORNA subito dopo il primo controllo non si blocca più (elenco delle competizioni letto da FVM se il sito
  non lo richiede di nuovo).
- LEGA + FLE solo per la lega FLE associata all'account (squadra verificata su FLE): appartenere al circuito non basta;
  con una squadra FLE diversa FAI O MODIFICA parte in SOLO LEGA.
- Diagnosi `FLE CHECK STEP/RESULT` senza valori delle intestazioni.

**Limitazioni note**
- L'aggiornamento lo installa Userscripts (menu dell'estensione): FVM non può aggiornarsi da solo.
- Chi ha la 1.3.3 non vede il riquadro: passa alla 1.3.4 dal menu di Userscripts o reinstallando dalla guida.
- Leghe Mantra: stati dettagliati delle consegne non ancora disponibili.

## iPhone (Safari) 1.3.3 — 10 ottobre 2026
- Attesa affidabile dell'accesso del sito all'apertura (recupero tardivo fino a 5 minuti); avviso modifiche esterne.

## Android 1.3.0 — 10 ottobre 2026 (OTA)
- Area Admin FLE e Consegne ufficiali Leghe Classic (stati `act`), migliorie Safari 1.3.3 portate su Android.
- Prossimo aggiornamento Android: riquadro con versione installata, nuova versione e «Cosa cambia» accanto ad AGGIORNA ORA.
