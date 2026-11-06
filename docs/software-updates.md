# Aggiornamenti da GitHub e Galaxy

Il workflow `.github/workflows/software-updates.yml` parte a ogni push su `main`.
Legge i commit non ancora elaborati, assegna a ciascuno una versione progressiva
(`1.0.1`, `1.0.2`, …), usa la data del commit nel fuso Europe/Rome e registra il
riepilogo in `server/softwareUpdateHistory.json`. Il file
`imports/constants/softwareVersion.js` viene aggiornato alla versione più recente.

Il messaggio descrittivo del commit costituisce il riepilogo. Il corpo del messaggio
può contenere ulteriori punti. Con messaggi generici come `.` o `fix`, il generatore
indica le aree toccate in base ai file modificati: non interpreta semanticamente il
diff e non usa servizi AI. Per esempio `Avvisa i GVP quando un paziente viene dimesso`
produce una descrizione più utile di `.`.

Il primo avvio importa soltanto l'ultimo commit, senza pubblicare l'intera storia
precedente. Da quel momento ogni nuovo commit su main viene elaborato; per i merge
viene creata una voce per il commit di merge, includendo le aree modificate nel ramo.

## Attivazione

1. Pubblicare questi file nel repository GitHub sul ramo `main`.
2. Verificare che GitHub Actions sia abilitato e che le regole del repository
   consentano al workflow di scrivere sul ramo `main` (`contents: write`).
3. Galaxy deve continuare a seguire lo stesso ramo tramite Push to Deploy.

Il workflow crea un ulteriore commit tecnico con i due file generati. Anche questo
push deve essere pubblicato da Galaxy: può quindi esserci una seconda build dopo
quella del codice sorgente. I soli file generati non producono altre voci né cicli.
Non servono token aggiuntivi o modifiche ai comandi di build di Galaxy.
Se arriva un altro push mentre il workflow salva lo storico, Git rifiuta la scrittura
concorrente; la successiva esecuzione rielabora tutti i commit ancora da registrare.
Un workflow fallito si può rilanciare da Actions o tramite Run workflow.

Le voci entrano nel database all'avvio del codice pubblicato. Il salvataggio
`$setOnInsert` mantiene le correzioni e le eliminazioni fatte dall'Admin, anche dopo
un nuovo deploy. Ogni nuova voce viene inserita con `approved: false`: soltanto gli
Admin ricevono le bozze e vedono il pulsante Approva. Anche le vecchie voci prive di
approvazione restano riservate agli Admin fino all'approvazione esplicita.

L'Admin può modificare il testo prima di approvarlo. Approva registra l'Admin e la
data di approvazione e rende la voce visibile a tutti. Soltanto le voci approvate
vengono inviate agli altri utenti e contribuiscono al loro badge dei non letti.
Per l'Admin il badge include anche le voci in attesa, che non vengono segnate come
lette prima dell'approvazione. Modificare una voce già approvata ne aggiorna il testo.
Il riepilogo resta sui file server e non viene incluso nel codice client.

In caso di force push che rimuove il commit già elaborato, il generatore si ferma:
va verificata la storia prima di aggiornare `lastProcessedCommit` nel file JSON.

## Verifica locale

Eseguire `npm run test:updates` per i test di approvazione e quelli isolati con repository
temporanei. `node scripts/generate-software-updates.cjs` genera realmente i file a
partire dai commit locali: non include le modifiche ancora da committare.
