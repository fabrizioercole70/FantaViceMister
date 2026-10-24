# Fanta Vice Mister — CHANGELOG

Per ogni versione: numero, data, novità, correzioni, limitazioni note.
iPhone (Safari): il riepilogo breve della versione più recente è anche in `aggiornamento.json` (riquadro AGGIORNA ORA).

## iPhone (Safari) 1.3.5 — ottobre 2026
**Novità**
- Account riconosciuto dal sito: la verifica della squadra FLE, l'Area Admin e i dati FLE valgono solo per l'account collegato;
  cambiando account si verifica di nuovo (nulla viene cancellato).
- VERIFICA SQUADRA FLE nella Home: LEGA + FLE, SOLO FLE e MODIFICA SU FLE solo con la squadra FLE verificata; SOLO LEGA funziona sempre.
- SWITCH: scelta esplicita tra quello della lega e quello di FLE, verifica dopo il salvataggio, storico per giornata e competizione.
- Confronto con i 25 FLE: moduli ammessi, rosa non conforme bloccata, esclusi dalla panchina con il motivo, scelte ricordate annullabili.
- Fantaclub: guardia della squadra FLE, competizioni lette dal sito (campionati, punti, coppe), giornate reali, regola di mancata
  consegna e recupero automatico distinti dalla consegna; CAMBIA LEGA con accesso diretto alla pagina Consegna.
- Area Admin: sblocco valido solo nella scheda in uso, nessun controllo FLE automatico, dati FLE solo con il ruolo di amministratore
  confermato dal sito; consegne FLE per competizione e turno con AGGIORNA TUTTI I TURNI DELLE COMPETIZIONI.
- Consegne ufficiali per piattaforma (Leghe Fantacalcio o Fantaclub); l'altra piattaforma in una vista separata.
- Niente audio delle pagine del sito durante le schermate e le letture di FVM; diagnosi più chiara.
- Dopo un aggiornamento, anche fatto direttamente da Userscripts, compare una volta il riepilogo delle novità.

**Correzioni**
- Area Admin, controllo generale: AGGIORNA non si blocca più su «Pagina FLE non letta». Il sito rispondeva «nessuna novità» (HTTP 304)
  senza dati, perché FVM copiava dalle richieste del sito anche la convalida della cache; ora le letture non la inviano più e l'elenco
  delle competizioni viene richiesto fino a 3 volte (se resta illeggibile il motivo compare sullo schermo).
- Consegne FLE per competizione e turno e Consegne ufficiali delle leghe: dopo l'inizio ufficiale della giornata (`mstr` di FLE), con i dati
  letti e nessuna formazione, la squadra è rossa «Senza formazione · scadenza superata»; prima dell'inizio resta «in attesa».
- Le giornate già passate senza formazione restano rosse anche prima del calcolo ufficiale; il messaggio WhatsApp distingue
  «scadenza superata» da «giornata calcolata».
- Inizio della giornata non letto o lettura incompleta: «non verificabile», mai «mancante».
- AGGIORNA TUTTI I TURNI DELLE COMPETIZIONI usa la giornata FLE appena letta; le competizioni senza partite in quella giornata risultano
  «nessun turno»; la selezione del turno resta quella scelta.
- Il controllo generale delle 80 squadre non cambia.

**Limitazioni note**
- Scadenza: FVM usa l'inizio ufficiale della giornata indicato da FLE (`mstr`). I termini anticipati delle singole leghe (timeout di
  inserimento della formazione) non sono ancora gestiti e saranno verificati in seguito; non c'è un countdown per singola lega.
- Dopo l'aggiornamento può essere chiesta di nuovo VERIFICA SQUADRA FLE (la verifica ora vale per l'account collegato).
- Leghe Mantra: stati dettagliati delle consegne non ancora disponibili.
- L'aggiornamento lo installa Userscripts (menu dell'estensione): FVM non può aggiornarsi da solo.

## Android 1.3.5 — 23 ottobre 2026 (OTA)
- Account riconosciuto dal sito: VERIFICA SQUADRA FLE vale per l'account collegato (dopo l'aggiornamento ripetila una volta).
- SWITCH: scegli se usare quello della lega o quello di FLE; l'invio si ferma se lo Switch su FLE cambia; verifica dopo il salvataggio.
- Confronto con i 25 FLE più chiaro: moduli ammessi, esclusi dalla panchina con il motivo.
- Area Admin: riepilogo per competizione, consegne parziali, «in attesa» prima dell'inizio; consegne per competizione e turno con
  AGGIORNA TUTTI I TURNI DELLE COMPETIZIONI.
- Consegne ufficiali compatte con MOSTRA SQUADRE; storico con giornate, Switch e numero d'ordine.
- CAMBIA LEGA Fantaclub guidato: tocca il nome della lega, poi CONSEGNA.

## Android 1.3.1 — 14 ottobre 2026 (OTA)
- Nuovo pulsante VERIFICA SQUADRA FLE: controlla, senza inviare nulla, che il tuo account gestisca su FLE la squadra della tua lega.
- LEGA + FLE si attiva solo dopo la verifica riuscita; senza verifica la formazione si salva in SOLO LEGA, che funziona sempre.
- SOLO FLE si usa subito dopo la verifica riuscita, senza dover prima inviare con LEGA + FLE.
- Cambio lega con SOLO LEGA: PASSO 1 e FAI O MODIFICA seguono la lega su cui stai lavorando.
- Area Admin: consegne FLE per competizione e turno, Ranking come classifiche a punti, controllo delle 80 squadre iscritte.

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
