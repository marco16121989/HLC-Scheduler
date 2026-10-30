import { getPagePermission } from "./pagePermissions.js";

export const MANUAL_ROLES = ["Presidente", "CAS", "GVP"];
const coordination = ["Presidente", "CAS"];

export const MANUAL_PROFILES = {
  Presidente: {
    summary: "Organizza il CAS, gestisci la squadra e i permessi, coordina pazienti e attività della tua organizzazione.",
    steps: ["Verifica il tuo Profilo e i riferimenti dell'organizzazione.", "Controlla CAS, GVP e associazioni a ospedali e reparti.", "Definisci i permessi e le informazioni dei pazienti da condividere con i GVP.", "Consulta Pazienti, Calendario e Notifiche per coordinare le attività.", "Controlla Report e Rapporto annuale CAS quando devi riepilogare l'attività."],
  },
  CAS: {
    summary: "Gestisci i pazienti e le assegnazioni, collabora con i GVP e registra attività e comunicazioni del tuo CAS.",
    steps: ["Verifica Profilo, contatti e reparti di riferimento.", "Controlla Calendario e Notifiche prima delle attività.", "Apri Pazienti e verifica i casi, le date e le persone assegnate.", "Usa Note CAS e Note GVP scegliendo il canale adatto ai destinatari.", "Registra la tua disponibilità nei Periodi di assenza e consulta gli eventi."],
  },
  GVP: {
    summary: "Consulta i pazienti assegnati, organizza le attività dal calendario e comunica con il CAS attraverso le Note GVP.",
    steps: ["Verifica nel Profilo i tuoi recapiti e le associazioni disponibili.", "Apri Calendario e controlla i casi assegnati e gli eventi.", "Consulta Pazienti: le informazioni mostrate dipendono dalla condivisione impostata dall'organizzazione.", "Usa Note GVP per comunicare gli aggiornamenti sul caso.", "Rispondi agli inviti e registra i periodi in cui non sei disponibile."],
  },
};

const CHAPTERS = [
  { id: "accesso", title: "Accesso, menu e regole di utilizzo", blocks: [
    { steps: ["Accedi con le credenziali del tuo account. Se compare una comunicazione iniziale, leggila e prosegui.", "Apri il menu laterale; sul telefono usa il pulsante in alto per mostrarlo o chiuderlo.", "Seleziona la sezione che ti serve. Il menu mostra le pagine abilitate per il tuo account.", "Nei moduli compila i campi richiesti e premi Inserisci, Salva o Salva modifiche. Attendi l'esito prima di chiudere.", "Al termine apri il menu Account in alto e premi Esci, soprattutto su un dispositivo condiviso."] },
    { paragraphs: ["Visualizzare una sezione e modificarne i dati sono permessi distinti. Un pulsante assente o un campo in sola lettura può dipendere dal ruolo o dai permessi configurati. I capitoli di questa guida seguono le pagine abilitate al tuo account; non assegnano nuove autorizzazioni.", "Il pulsante i accanto al titolo di molte pagine apre una guida rapida. Questo Manuale d'uso raccoglie invece il percorso completo del tuo ruolo.", "Il gestionale serve a organizzare informazioni e attività: inserisci dati verificati, usa il canale di note corretto e non condividere credenziali o documenti con persone non autorizzate."] },
  ] },
  { id: "profilo", title: "Profilo: dati personali, recapiti e password", page: "profile", blocks: [
    { steps: ["Apri Profilo dal menu e verifica nome, cognome, email e telefono.", "Correggi i campi modificabili. Se disponibili, controlla le associazioni a ospedali e reparti.", "Per cambiare password compila password e conferma. Non inserire valori se non intendi cambiarla.", "Salva e attendi la conferma. Se un dato non è modificabile, chiedi a chi gestisce il tuo account."] },
    { paragraphs: ["Le associazioni a strutture e reparti sono utilizzate nei suggerimenti e nell'organizzazione delle attività. Non costituiscono da sole l'assegnazione a un singolo paziente. Verifica sempre le persone selezionate nella scheda del caso."] },
  ] },
  { id: "squadra", title: "CAS e GVP: organizzare la squadra", roles: coordination, anyPages: ["cas", "gvp"], blocks: [
    { paragraphs: ["Le pagine CAS e GVP raccolgono i collaboratori della tua organizzazione. Cerca il nominativo, apri la scheda e controlla recapiti, collegamenti e strutture di riferimento. Le pagine visibili e le possibilità di modifica dipendono dai permessi dell'account."] },
    { title: "Gestire gli account CAS", page: "cas", editOnly: true, steps: ["Apri CAS e scegli l'inserimento di un nuovo collaboratore o apri una scheda esistente.", "Compila i dati dell'utente e verifica l'appartenenza alla tua organizzazione.", "Associa ospedali e reparti di competenza. Se previsto, indica l'incarico di Segretario CAS.", "Salva e controlla il nominativo nell'elenco. L'incarico di Segretario abilita anche il Rapporto annuale CAS."] },
    { title: "Gestire gli account GVP", page: "gvp", editOnly: true, steps: ["Apri GVP e inserisci o seleziona il collaboratore.", "Controlla i CAS collegati e gli eventuali ospedali e reparti.", "Salva la scheda e verifica le associazioni. Le proposte nella gestione pazienti si basano anche su questi collegamenti."] },
    { paragraphs: ["Per un account CAS queste pagine sono inizialmente in consultazione. Se il Presidente abilita la modifica, compaiono anche le funzioni di gestione. Per correggere un account senza il permesso adatto, contatta il Presidente."] },
  ] },
  { id: "permessi", title: "Permessi: visualizzazione e modifica delle sezioni", page: "permissions", roles: coordination, blocks: [
    { paragraphs: ["Il Presidente dispone della sezione Permessi; un CAS può utilizzarla solo se gli è stata abilitata. Le autorizzazioni indicano quali pagine un utente può vedere e, separatamente, quali può modificare. Alcune operazioni conservano comunque vincoli specifici di ruolo, assegnazione o autore."] },
    { editOnly: true, steps: ["Apri Permessi e seleziona l'utente o il gruppo CAS/GVP su cui intervenire.", "Leggi la descrizione di ciascuna sezione prima di cambiare i flag.", "Abilita Visualizza per la consultazione. Abilita Modifica solo quando serve anche la gestione dei dati.", "Controlla l'ambito selezionato: una modifica di gruppo riguarda più persone.", "Salva con il comando della pagina e verifica l'esito. Per controllare la vista dell'utente, usa il suo ruolo effettivo come riferimento."] },
    { paragraphs: ["Il Rapporto annuale CAS rimane legato al ruolo Presidente o all'incarico di Segretario CAS. La scheda paziente del GVP resta limitata ai casi assegnati e ai dati condivisi. Abilitare una pagina non rende disponibili i dati di altre organizzazioni."] },
  ] },
  { id: "strutture", title: "Ospedali e reparti: elenco generale e copertura", page: "hospitals", blocks: [
    { steps: ["Apri Ospedali e cerca la struttura interessata.", "Consulta i riferimenti e usa Visualizza reparti per controllare i reparti presenti nella struttura.", "Controlla i CAS incaricati e le eventuali segnalazioni di reparti scoperti."] },
    { editOnly: true, steps: ["Per una nuova struttura usa il comando di inserimento e compila i dati richiesti.", "Aggiungi alla struttura i reparti realmente presenti, scegliendoli dall'elenco delle tipologie.", "Salva e verifica la struttura e i reparti nell'elenco."] },
    { title: "A cosa serve la pagina Reparti", page: "departments", paragraphs: ["Reparti contiene le denominazioni generali, come Chirurgia o Cardiologia. Una voce in questo elenco non è ancora un reparto di un ospedale: occorre associarla alla struttura in Ospedali. Usa nomi coerenti per non creare doppioni."] },
    { paragraphs: ["La copertura CAS deriva dalle associazioni dei collaboratori. Se un reparto risulta scoperto, verifica gli incarichi nella squadra invece di considerare la sola esistenza dell'anagrafica del reparto."] },
  ] },
  { id: "medici", title: "Medici e note operative", page: "doctors", blocks: [
    { steps: ["Apri Medici e usa ricerca e filtri per tipologia o reparto.", "Apri il nominativo per consultare la scheda e verifica ospedale, reparto, recapiti e luogo in cui riceve.", "Distingui le Note generali dell'anagrafica dalle Note operative, che formano uno storico separato.", "Apri il comando delle Note operative per leggere le voci o aggiungerne una. Controlla autore, data e ora."] },
    { editOnly: true, steps: ["Per inserire un medico compila almeno nome, cognome e reparto.", "Specifica la tipologia disponibile, per esempio medico, chirurgo o anestesista, e le associazioni alla struttura.", "Completa i recapiti e salva. Per modificare un'anagrafica esistente apri la sua riga."] },
    { paragraphs: ["Anche in consultazione dell'anagrafica, le Note operative permettono la collaborazione prevista dalla pagina. Ogni utente può eliminare soltanto le proprie note operative. Non modificare il medico assegnato a un paziente senza verificare la scheda del caso."] },
  ] },
  { id: "pazienti-gestione", title: "Pazienti: inserimento, assegnazioni e percorso", page: "patients", roles: coordination, blocks: [
    { steps: ["Apri Pazienti. Usa ricerca, filtri e paginazione per trovare un caso prima di crearne uno nuovo.", "Apri la scheda per verificare dati principali, stato, date, persone assegnate e storico."] },
    { title: "Inserire o aggiornare un caso", editOnly: true, steps: ["Usa il comando di inserimento oppure apri il paziente da modificare.", "Compila i dati identificativi e il tipo di accesso, scegliendo tra le opzioni presenti: emergenza, ricovero programmato o consulto.", "Seleziona struttura e reparto prima delle persone: il gestionale propone CAS, GVP e medici coerenti con le associazioni.", "Controlla e conferma le persone corrette. I suggerimenti non equivalgono ad assegnazioni automatiche; usa la libera scelta quando necessario.", "Completa date di accesso, informazioni di ricovero, camera, letto e visita con l'anestesista quando disponibili.", "Premi Inserisci o Salva modifiche e attendi l'esito. Riapri il caso per controllare dati e assegnazioni."] },
    { title: "Cambio ospedale e stato del caso", editOnly: true, steps: ["Quando cambi ospedale, indica se stai correggendo un dato errato oppure registrando un trasferimento reale.", "In un trasferimento segui le domande della finestra e verifica destinazione e persone di riferimento.", "Consulta la scheda Trasferimenti per lo storico.", "Quando imposti uno stato di chiusura, completa le informazioni richieste nella conferma. Controlla date ed eventuale follow up prima di salvare."] },
    { paragraphs: ["Il calendario utilizza le date registrate nella scheda: un'informazione temporale sbagliata può far comparire l'attività nel giorno errato. Gli stati di chiusura possono mascherare alcuni dati nelle viste ordinarie: non confondere un'informazione non mostrata con un dato da reinserire."] },
    { title: "Documenti HLC-7-I", editOnly: true, paragraphs: ["I comandi Salva e apri HLC-7-I e Salva e apri HLC-7-I semplificato salvano la scheda e preparano il relativo documento. Controlla i dati prima di condividerlo; il PDF va gestito con la stessa attenzione riservata alla scheda paziente."] },
  ] },
  { id: "pazienti-gvp", title: "Pazienti GVP: consultare i casi assegnati", page: "patients", roles: ["GVP"], blocks: [
    { steps: ["Apri Pazienti e cerca il caso nell'elenco a te disponibile.", "Apri il paziente e controlla le informazioni condivise, la struttura, il reparto e i CAS di riferimento quando presenti.", "Consulta le date e i dettagli organizzativi utili all'attività. Le informazioni facoltative dipendono dallo schema di condivisione della tua organizzazione.", "Se un campo manca o non è modificabile, chiedi al CAS di verificarlo. Non creare una seconda scheda per aggirare un dato non visibile."] },
    { paragraphs: ["Il GVP non dispone della gestione completa della scheda paziente. L'accesso si basa sull'assegnazione al caso e sulle informazioni condivise. Un paziente non assegnato non diventa consultabile scegliendo un filtro più ampio.", "I contatti telefonici hanno comandi dedicati. Apri il nominativo o l'icona prevista per consultare il numero; usa soltanto i comandi di modifica disponibili e conferma il salvataggio. Il numero dell'anagrafica del medico rimane in consultazione nel pannello contatti del paziente."] },
  ] },
  { id: "note", title: "Comunicare sul paziente: Note GVP e Note CAS", page: "patients", blocks: [
    { title: "Note GVP", steps: ["Individua il paziente corretto e apri Note GVP.", "Leggi lo storico prima di aggiungere un aggiornamento, controllando autore e data.", "Scrivi la nuova nota nel campo dedicato e premi Aggiungi nota.", "Attendi il salvataggio e verifica che la voce sia presente. I contatori aiutano a individuare gli aggiornamenti non letti."] },
    { paragraphs: ["Le Note GVP sono il canale di collaborazione tra i GVP assegnati e il CAS. Usa messaggi chiari e pertinenti; un aggiornamento scritto in una nota non modifica automaticamente date, stato o assegnazioni della scheda."] },
    { title: "Note CAS", roles: coordination, steps: ["Apri Note CAS sul paziente.", "Consulta lo storico riservato al CAS e al Presidente.", "Inserisci l'aggiornamento e premi Aggiungi nota CAS.", "Se un'informazione deve essere letta anche dai GVP, scegli invece il canale Note GVP appropriato."] },
    { roles: coordination, paragraphs: ["Le Note CAS non sono visibili ai GVP. La scelta dei campi condivisi nella scheda paziente non trasforma lo storico Note CAS in uno storico visibile al GVP."] },
    { roles: ["GVP"], paragraphs: ["Le Note CAS sono riservate a CAS e Presidente e non sono disponibili al GVP. Per una comunicazione sul caso usa Note GVP o contatta il CAS di riferimento."] },
  ] },
  { id: "condivisione", title: "Scegliere le informazioni condivise con i GVP", page: "patient-gvp-sharing", target: "patients", roles: coordination, blocks: [
    { steps: ["Apri Pazienti e il comando Scegli info da condividere con GVP, quando abilitato.", "Leggi l'elenco dei campi e lo schema attualmente in uso."] },
    { editOnly: true, steps: ["Seleziona le informazioni che i GVP devono poter consultare.", "Verifica la scelta nel suo insieme: lo schema è valido per i pazienti e i GVP assegnati dell'organizzazione, non soltanto per la riga aperta.", "Premi Salva e attendi la conferma."] },
    { paragraphs: ["Alcune informazioni necessarie al calendario, ai collegamenti e ai contatti rimangono gestite dal sistema. La condivisione dei campi non assegna un nuovo GVP al paziente e non concede la modifica completa della scheda."] },
  ] },
  { id: "follow-up", title: "Follow up dei pazienti dimessi", page: "follow-up", roles: coordination, blocks: [
    { paragraphs: ["La sezione Follow up raccoglie i pazienti Dimessi per i quali è attivo il follow up. Il Presidente vede i casi della propria organizzazione; il CAS vede quelli che gli sono assegnati. Per i GVP questa sezione non è disponibile."] },
    { steps: ["Apri Follow up e individua il paziente.", "Consulta dati, assegnazioni e storico; controlla la data di attivazione riportata quando disponibile.", "Se devi interromperlo e il comando è disponibile, premi Interrompi follow-up, leggi la conferma e conferma l'operazione.", "Il paziente rimane Dimesso nella lista Pazienti. L'interruzione del follow up non elimina la scheda."] },
    { paragraphs: ["La vista Follow up serve alla consultazione e alla gestione dell'interruzione prevista, non alla modifica libera di tutti i campi. L'attivazione si gestisce nel percorso di dimissione della scheda paziente quando hai i relativi permessi."] },
  ] },
  { id: "calendario", title: "Calendario: trovare attività e appuntamenti", page: "calendar", blocks: [
    { steps: ["Apri Calendario e scegli il mese, il periodo o la vista che ti serve.", "Seleziona il giorno per leggere le attività disponibili.", "Usa i filtri per restringere la vista e apri un elemento per consultarne i dettagli.", "Controlla ricoveri, dimissioni, visite con l'anestesista, presentazioni ed eventi che risultano disponibili per il tuo ruolo."] },
    { roles: ["GVP"], paragraphs: ["Per il GVP il filtro iniziale privilegia i casi assegnati. Anche quando cambi filtro restano validi i limiti sui pazienti e sui campi condivisi. I nomi non disponibili possono essere mascherati. Per correggere le date della scheda chiedi al CAS."] },
    { roles: coordination, paragraphs: ["Il calendario deriva dalle date delle schede e dalle attività registrate. Per correggere un ricovero o una dimissione aggiorna il caso in Pazienti; per modificare una presentazione apri Presentazioni. La semplice consultazione di un giorno non salva nuove attività."] },
  ] },
  { id: "eventi", title: "Eventi: inviti e partecipazione", page: "events", blocks: [
    { steps: ["Apri Eventi e usa i filtri di periodo e risposta per trovare gli inviti.", "Apri l'evento e leggi titolo, luogo e orari.", "Se sei invitato, usa la risposta disponibile per accettare o rifiutare e controlla lo stato risultante."] },
    { roles: coordination, editOnly: true, title: "Creare un evento", steps: ["Usa il comando di creazione e compila titolo, luogo, inizio e fine.", "Seleziona i CAS e i GVP da invitare; controlla l'elenco prima di salvare.", "Salva e verifica l'evento. Gli invitati ricevono una notifica.", "Apri il riepilogo per leggere accettazioni e rifiuti; espandi gli invitati per i nominativi e i dettagli delle risposte."] },
    { roles: ["GVP"], paragraphs: ["Il GVP partecipa agli eventi disponibili e risponde agli inviti. La creazione degli eventi è riservata a Presidente e CAS autorizzati, anche se altre opzioni di visualizzazione sono state abilitate."] },
  ] },
  { id: "assenze", title: "Registrare i periodi di assenza", page: "absences", blocks: [
    { steps: ["Apri Periodi di assenza e consulta gli intervalli già presenti.", "Inserisci data iniziale e finale ed eventuale nota nel modulo.", "Salva e controlla il periodo nell'elenco.", "Per un inserimento errato usa il comando consentito sul tuo periodo, leggi la conferma di eliminazione e registra l'intervallo corretto."] },
    { paragraphs: ["Le assenze aiutano a valutare la disponibilità prima di assegnare attività. Non riassegnano automaticamente i pazienti e non cancellano gli inviti già ricevuti. Avvisa il referente se occorre cambiare una responsabilità."] },
  ] },
  { id: "presentazioni", title: "Programmare le presentazioni", page: "presentations", roles: coordination, blocks: [
    { steps: ["Apri Presentazioni e cerca l'attività con i filtri o la paginazione.", "Apri il dettaglio per leggere data, struttura e informazioni disponibili, compreso il documento HLC-33-I quando previsto."] },
    { editOnly: true, steps: ["Usa il comando di inserimento e compila data, informazioni dell'attività e riferimenti richiesti.", "Salva e verifica la voce nell'elenco.", "Controlla la presenza della presentazione nel Calendario. Per correggerla riapri la scheda e salva le modifiche."] },
    { paragraphs: ["Le presentazioni contribuiscono anche ai riepiloghi e al rapporto annuale: verifica la data e l'appartenenza all'organizzazione prima di salvare."] },
  ] },
  { id: "report", title: "Report: leggere i dati senza confondere gli indicatori", page: "reports", blocks: [
    { steps: ["Apri Report e seleziona l'anno di accesso oppure Tutti gli anni.", "Controlla l'ambito dei casi disponibile per il tuo ruolo.", "Leggi i totali e le quattro serie: totale pazienti, dimessi, trasferiti e deceduti.", "Seleziona un mese sul grafico per i dettagli oppure apri la tabella sottostante."] },
    { paragraphs: ["I valori mensili raggruppano i pazienti per data di accesso e stato attuale. Non indicano che la dimissione o un altro esito siano avvenuti in quel mese. Tutti gli anni comprende nei totali anche i pazienti privi di data di accesso. Confronta periodi e filtri uguali."] },
    { roles: ["GVP"], paragraphs: ["Nel report il GVP può scegliere Tutti i casi per le statistiche aggregate dell'organizzazione oppure I miei casi per quelli assegnati. Le statistiche aggregate non concedono l'accesso alle schede nominative degli altri pazienti."] },
  ] },
  { id: "report-cas", title: "Report pazienti e report presentazioni", roles: ["CAS"], anyPages: ["patient-reports", "presentation-reports"], blocks: [
    { page: "patient-reports", title: "Report pazienti", steps: ["Apri Report pazienti e scegli CAS e anno nei filtri disponibili.", "Consulta gli indicatori e le distribuzioni riferiti ai dati autorizzati.", "Prima di confrontare due risultati verifica che i filtri siano gli stessi."] },
    { page: "presentation-reports", title: "Report presentazioni", steps: ["Apri Report presentazioni e seleziona l'anno.", "Leggi conteggi e distribuzioni delle presentazioni dell'organizzazione.", "Se manca un'attività, controlla la data registrata nella scheda Presentazioni."] },
  ] },
  { id: "rapporto-annuale", title: "Rapporto annuale CAS", page: "annual-report", roles: coordination, blocks: [
    { paragraphs: ["Questa pagina è disponibile al Presidente e ai CAS con incarico di Segretario. Conserva l'archivio dei rapporti annuali dell'organizzazione, un rapporto per anno."] },
    { steps: ["Apri Rapporto annuale CAS e premi Crea rapporto.", "Scegli l'anno solare e controlla i conteggi proposti per presentazioni, membri e medici. I medici vengono raggruppati per specializzazione.", "Completa questioni significative, data e membro CAS nel modulo.", "Premi Salva e scarica per registrare il rapporto e ottenere il PDF.", "Per una verifica successiva apri il rapporto dall'archivio e scaricalo di nuovo quando serve.", "Quando hai effettivamente eseguito l'invio con il canale previsto, usa l'eventuale comando per contrassegnarlo come inviato. La marcatura non è l'invio automatico del PDF."] },
    { paragraphs: ["Aprendo o scaricando un rapporto non ancora inviato, i conteggi dei medici possono aggiornarsi. Controlla il PDF definitivo prima della consegna. Prima di eliminare un rapporto leggi la conferma e verifica l'anno."] },
  ] },
  { id: "ospitalita", title: "Ospitalità: consultare e aggiornare le disponibilità", page: "hospitality", blocks: [
    { steps: ["Apri Ospitalità e consulta nominativi, contatti e località.", "Controlla numero di persone ospitabili, destinatari della disponibilità e stato della proposta.", "Verifica i riferimenti prima di coordinare un'ospitalità."] },
    { editOnly: true, steps: ["Inserisci o apri la disponibilità e compila contatti, luogo e capacità.", "Specifica se riguarda pazienti, familiari o entrambi.", "Salva; se la disponibilità è sospesa, disattivala invece di cancellare informazioni che servono ancora."] },
  ] },
  { id: "file", title: "File Utili: aprire, scaricare e condividere documenti", page: "useful-files", blocks: [
    { steps: ["Apri File Utili e individua il documento dal titolo.", "Usa i comandi disponibili per aprirlo o scaricarlo.", "Se il browser avvia un download invece dell'anteprima, cerca il file nella cartella dei download."] },
    { editOnly: true, steps: ["Scegli il file dal dispositivo e inserisci un titolo riconoscibile.", "Rispetta il limite di 6 MB e i formati accettati dalla pagina, come PDF, immagini, documenti Office e ZIP.", "Avvia il caricamento e attendi la conferma prima di uscire.", "Per eliminare un documento usa il comando disponibile e verifica il titolo nella conferma. L'autore e il Presidente hanno regole di eliminazione diverse."] },
    { paragraphs: ["L'archivio è separato per organizzazione. Il permesso di lettura non comprende automaticamente quello di caricamento o eliminazione. Se un file non si apre, annota titolo ed errore prima di chiedere assistenza."] },
  ] },
  { id: "notifiche", title: "Notifiche, email e leggibilità", target: "settings", blocks: [
    { steps: ["Apri la campanella per gli avvisi recenti. Seleziona una notifica per raggiungere il contenuto collegato.", "Consulta il riepilogo delle notifiche e i contrassegni di lettura; controlla comunque il contenuto effettivo, per esempio la risposta a un evento.", "Apri Impostazioni per cambiare tema, dimensione del testo, alto contrasto o grassetto.", "Per le notifiche sul dispositivo premi Attiva notifiche e conferma la richiesta del browser.", "Se il browser le ha già bloccate, cambia prima l'autorizzazione nelle sue impostazioni.", "Per gli avvisi via email verifica l'indirizzo nel Profilo e abilita Notifiche via email in Impostazioni."] },
    { paragraphs: ["Le preferenze di leggibilità sono applicate al dispositivo o browser utilizzato. Le notifiche push dipendono dal supporto e dalle autorizzazioni del dispositivo. Una notifica ricevuta non salva modifiche al modulo e non sostituisce una risposta a un invito."] },
  ] },
  { id: "assistenza", title: "Segnalazioni e richieste di assistenza", page: "support", roles: ["CAS"], blocks: [
    { steps: ["Apri Segnalazioni e avvia una nuova richiesta.", "Descrivi la pagina, l'operazione che stavi eseguendo e il risultato atteso.", "Riporta il testo dell'errore e, quando utile, data, ora, dispositivo e browser.", "Invia e controlla lo stato della richiesta nell'elenco."] },
    { paragraphs: ["Non inserire password o dati sanitari non necessari alla riproduzione del problema. Se manca una sezione o un pulsante, verifica prima con il Presidente i permessi del tuo account."] },
  ] },
  { id: "routine", title: "Controlli quotidiani e problemi frequenti", blocks: [
    { roles: ["Presidente"], title: "Percorso quotidiano del Presidente", steps: ["Controlla notifiche e calendario.", "Verifica i casi e le assegnazioni che richiedono coordinamento.", "Controlla disponibilità della squadra, copertura dei reparti ed eventi.", "Rivedi permessi e condivisione delle informazioni quando cambiano gli incarichi.", "Usa i report per il quadro d'insieme e prepara il rapporto annuale quando necessario."] },
    { roles: ["CAS"], title: "Percorso quotidiano del CAS", steps: ["Leggi notifiche e attività del giorno.", "Aggiorna i casi di competenza e verifica date, contatti e assegnazioni.", "Consulta Note CAS e Note GVP e usa il canale corretto per gli aggiornamenti.", "Controlla dimissioni e follow up assegnati, eventi e periodi di assenza.", "Se sei Segretario, verifica anche l'archivio del rapporto annuale quando serve."] },
    { roles: ["GVP"], title: "Percorso quotidiano del GVP", steps: ["Controlla calendario e notifiche.", "Apri i pazienti assegnati e leggi gli aggiornamenti nelle Note GVP.", "Verifica riferimenti e contatti prima dell'attività.", "Aggiungi gli aggiornamenti nel canale Note GVP e rispondi agli inviti ricevuti.", "Registra le tue assenze e segnala al CAS informazioni mancanti o assegnazioni da rivedere."] },
    { title: "Non vedo una pagina o un paziente", paragraphs: ["Controlla il ruolo mostrato nel tuo account. Una pagina può essere disabilitata nei Permessi; un caso può appartenere a un'altra organizzazione o non essere assegnato a te. Verifica inoltre ricerca, filtri e paginazione. Per i GVP alcuni campi sono intenzionalmente esclusi dalla condivisione."] },
    { title: "Non riesco a salvare", paragraphs: ["Leggi il messaggio, completa i campi richiesti e controlla date e selezioni. Attendi l'esito prima di chiudere. Se la pagina è in consultazione, chiedi il permesso corretto al Presidente anziché creare copie del dato."] },
    { title: "Non ricevo notifiche", paragraphs: ["Controlla prima la campanella nel gestionale. Per le push verifica supporto e autorizzazione del browser; per le email controlla indirizzo, attivazione dell'opzione e spam. Le email dipendono anche dal servizio configurato dall'amministrazione."] },
    { title: "Devo chiedere aiuto", paragraphs: ["Comunica ruolo, pagina, operazione, ora e testo dell'errore. Usa solo i riferimenti strettamente necessari e non inviare password. CAS e GVP possono rivolgersi al Presidente per le autorizzazioni; per un problema tecnico usa il canale di assistenza disponibile."] },
  ] },
];

export const getManualChapters = (user) => {
  if (!MANUAL_ROLES.includes(user?.role)) return [];
  const visible = (item) => (!item.roles || item.roles.includes(user.role)) &&
    (!item.page || getPagePermission(user, item.page).view) &&
    (!item.anyPages || item.anyPages.some(page => getPagePermission(user, page).view));
  return CHAPTERS.filter(visible).map(chapter => ({
    ...chapter,
    blocks: chapter.blocks.filter(block => visible(block) &&
      (!block.editOnly || getPagePermission(user, block.page || chapter.page).edit)),
  }));
};

export const filterManualChapters = (chapters, search) => {
  const normalize = text => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const query = normalize(search.trim());
  return query ? chapters.filter(chapter => normalize([chapter.title, ...chapter.blocks.flatMap(block =>
    [block.title || "", ...(block.paragraphs || []), ...(block.steps || [])])].join(" ")).includes(query)) : chapters;
};
