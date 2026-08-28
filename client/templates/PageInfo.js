import { useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";

const PAGE_GUIDES = {
  home: { title: "Dashboard", intro: "La Dashboard riassume l’utilizzo del gestionale e permette di leggere rapidamente l’andamento degli accessi.", sections: [["Come usarla", ["Seleziona il CAS per limitare tutti i dati all’organizzazione desiderata.", "Scegli ultimo mese o ultimo anno: il periodo si applica a indicatori, grafici e accessi recenti.", "Gli accessi effettuati in modalità assistenza non vengono conteggiati."]]] },
  "admin-tools": { title: "Strumenti Admin", intro: "Raccoglie le funzioni di assistenza e le comunicazioni generali rivolte agli utenti.", sections: [["Modalità assistenza", ["Cerca un utente oppure scegli prima il CAS e poi il ruolo.", "Accedi senza conoscere o modificare la password dell’utente.", "Usa il comando in basso a destra per tornare all’account Admin."]], ["Messaggi al login", ["Imposta testo e periodo di validità.", "Il messaggio appare a Presidente, CAS e GVP a ogni login e refresh finché è attivo.", "I messaggi contemporanei vengono mostrati uno dopo l’altro."]]] },
  calendar: { title: "Calendario", intro: "Mostra in un’unica vista tutte le attività e le scadenze disponibili per l’utente.", sections: [["Contenuti", ["Consulta ricoveri, dimissioni, visite con l’anestesista, presentazioni ed eventi.", "Cambia periodo o vista per individuare più rapidamente una data.", "Seleziona un elemento per consultarne i dettagli."]]] },
  events: { title: "Eventi", intro: "Permette di organizzare eventi e gestire inviti e partecipazioni.", sections: [["Creazione e inviti", ["Inserisci titolo, luogo, data e orari di inizio e fine.", "Invita tutti o solo alcuni CAS e GVP.", "Gli invitati ricevono una notifica e possono accettare o rifiutare."]], ["Risposte", ["Apri il riepilogo grafico per vedere accettazioni e rifiuti.", "Espandi gli invitati per consultare i nominativi e lo stato di risposta."]]] },
  absences: { title: "Periodi di assenza", intro: "Registra e consulta i periodi nei quali un utente non è disponibile.", sections: [["Utilizzo", ["Aggiungi data iniziale, data finale ed eventuale nota.", "Consulta le assenze prima di effettuare assegnazioni o pianificare attività.", "Modifica o elimina soltanto i periodi per i quali disponi dei permessi."]]] },
  "useful-files": { title: "File Utili", intro: "È l’archivio condiviso dei documenti utili all’attività dell’organizzazione.", sections: [["Gestione documenti", ["Carica un file indicando un titolo riconoscibile.", "Apri o scarica i documenti già disponibili.", "I contenuti sono separati in base al CAS di appartenenza."]]] },
  settings: { title: "Impostazioni", intro: "Permette di adattare interfaccia, leggibilità e notifiche alle proprie esigenze.", sections: [["Personalizzazione", ["Scegli tema, dimensione del testo e opzioni di contrasto.", "Attiva o disattiva le notifiche del dispositivo.", "Le preferenze vengono applicate all’interfaccia dell’utente."]]] },
  info: { title: "Info", intro: "Raccoglie le informazioni generali sul software e sul suo utilizzo.", sections: [["Contenuto", ["Consulta versione, finalità e riferimenti del gestionale.", "Per un problema operativo usa la sezione Segnalazioni."]]] },
  profile: { title: "Il mio profilo", intro: "Permette di consultare e aggiornare i dati associati al proprio account.", sections: [["Dati personali", ["Verifica le informazioni anagrafiche e di contatto.", "Aggiorna, quando consentito, le strutture o i reparti di riferimento.", "Salva le modifiche prima di lasciare la pagina."]]] },
  notifications: { title: "Notifiche", intro: "Raccoglie inviti, aggiornamenti e comunicazioni che richiedono la tua attenzione.", sections: [["Consultazione", ["Apri una notifica per raggiungere l’attività collegata.", "Le notifiche non lette vengono evidenziate.", "La campanella mostra rapidamente gli aggiornamenti più recenti."]]] },
  support: { title: "Segnalazioni e richieste", intro: "Consente di chiedere assistenza e seguire la risoluzione dei problemi segnalati.", sections: [["Nuova richiesta", ["Descrivi il problema e inserisci le informazioni utili a riprodurlo.", "Consulta lo stato delle richieste già inviate.", "Evita di inserire dati sanitari non necessari alla segnalazione."]]] },
  donations: { title: "Sostieni il progetto", intro: "Permette di contribuire volontariamente allo sviluppo e al mantenimento di HLC Scheduler.", sections: [["Come donare", ["Seleziona il pulsante per aprire la pagina di pagamento sicura Stripe.", "La donazione è singola e l’importo è libero.", "Per ridurre l’incidenza delle commissioni è consigliato un importo da 5 € in su."]]] },
  users: { title: "Utenti", intro: "Consente all’Admin di creare e gestire gli account che possono accedere al gestionale.", sections: [["Gestione", ["Cerca un utente per nome e aprilo per modificarne dati, ruolo e associazioni.", "Verifica sempre il CAS di appartenenza prima di salvare.", "Disabilita un account quando non deve più accedere, senza perdere lo storico."]]] },
  cas: { title: "CAS", intro: "Gestisce gli operatori CAS appartenenti all’organizzazione del Presidente.", sections: [["Gestione", ["Inserisci o modifica i dati dell’operatore.", "Associa ospedali e reparti di competenza.", "Le associazioni determinano i suggerimenti mostrati durante la gestione dei pazienti."]]] },
  gvp: { title: "GVP", intro: "Gestisce i GVP e le loro associazioni con CAS e reparti.", sections: [["Gestione", ["Inserisci i dati dell’utente e definisci i CAS collegati.", "Puoi associare uno o più reparti per migliorare i suggerimenti nei pazienti.", "Controlla le autorizzazioni prima di salvare."]]] },
  hospitals: { title: "Ospedali", intro: "Gestisce le strutture ospedaliere disponibili per il CAS.", sections: [["Gestione", ["Aggiungi o modifica una struttura e i relativi riferimenti.", "Consulta e collega i reparti presenti nell’ospedale.", "Le strutture vengono usate nelle schede paziente, nei medici e nei trasferimenti."]], ["Copertura CAS", ["Apri Visualizza reparti per vedere rapidamente i CAS incaricati di ogni reparto.", "Le assegnazioni provengono automaticamente dalla sezione CAS.", "I reparti senza CAS vengono evidenziati come scoperti, insieme a un riepilogo complessivo dell’ospedale."]]] },
  permissions: { title: "Permessi", intro: "Consente al Presidente di stabilire quali sezioni ogni CAS o GVP può consultare o modificare.", sections: [["Gestione", ["Seleziona un utente e abilita la visualizzazione delle sezioni necessarie.", "Il permesso Modifica include automaticamente anche Visualizza.", "La sezione Permessi resta sempre riservata e disponibile al Presidente."]]] },
  departments: { title: "Reparti", intro: "Questa pagina non contiene i reparti già presenti nei singoli ospedali: serve a creare l’elenco generale delle tipologie di reparto utilizzabili nel gestionale.", sections: [["Come funziona", ["Inserisci qui le denominazioni generali dei reparti, per esempio Oncologia, Chirurgia o Cardiologia.", "Dopo aver creato una tipologia, apri la pagina Ospedali e inseriscila negli ospedali in cui quel reparto è realmente presente.", "La presenza di un reparto in questo elenco non significa quindi che sia già associato a un ospedale.", "Usa nomi chiari e coerenti per facilitare filtri, assegnazioni e suggerimenti nelle schede paziente."]]] },
  doctors: { title: "Medici", intro: "Raccoglie i medici utilizzabili nelle assegnazioni e nelle visite dei pazienti.", sections: [["Anagrafica", ["Nome, cognome e reparto sono i dati necessari.", "Specifica se si tratta di medico, chirurgo o anestesista.", "Indica ospedale, studio e informazioni utili su dove riceve.", "Clicca direttamente sulla riga per modificare l’anagrafica del medico."]], ["Note", ["Le Note generali fanno parte dell’anagrafica del medico e sono visibili nella colonna Note.", "Le Note operative sono uno storico separato: usa l’apposito pulsante per consultarle o aggiungerne una.", "Ogni nota operativa riporta autore, data e ora; ciascun utente può eliminare soltanto le proprie."]], ["Ricerca", ["Filtra per tipologia o reparto.", "Usa la ricerca testuale nelle selezioni per trovare rapidamente il nominativo."]]] },
  patients: { title: "Pazienti", intro: "È l’area principale per gestire dati, percorso, assegnazioni e attività del paziente.", sections: [["Inserimento", ["Seleziona prima il reparto per ottenere suggerimenti coerenti di CAS, GVP e medici.", "Le proposte non vengono assegnate automaticamente: conferma sempre le persone corrette.", "La libera scelta rimane disponibile nelle apposite schede dei modal."]], ["Percorso", ["Gestisci ricovero, dimissione, visita con l’anestesista, camera e letto.", "Per un cambio ospedale indica se si tratta di correzione o trasferimento.", "Consulta la scheda Trasferimenti per lo storico dei passaggi."]], ["Note", ["Le Note GVP gestiscono le comunicazioni collegate ai GVP assegnati.", "Le Note CAS sono riservate esclusivamente agli utenti CAS e al Presidente e non sono visibili ai GVP.", "Il contatore sul pulsante segnala la presenza di nuove note."]]] },
  "patient-reports": { title: "Report pazienti", intro: "Fornisce una lettura aggregata dei pazienti visibili nell’organizzazione.", sections: [["Analisi", ["Filtra per CAS e anno.", "Consulta indicatori e distribuzioni per individuare volumi e andamento.", "I dati rispettano la separazione per Presidente del CAS."]]] },
  presentations: { title: "Presentazioni", intro: "Permette di programmare e consultare le presentazioni dell’organizzazione.", sections: [["Gestione", ["Inserisci data, informazioni e riferimenti della presentazione.", "Le presentazioni salvate vengono riportate anche nel Calendario.", "Usa ricerca e paginazione per trovare rapidamente un elemento."]]] },
  "presentation-reports": { title: "Report presentazioni", intro: "Riepiloga l’andamento delle presentazioni dell’organizzazione.", sections: [["Analisi", ["Seleziona l’anno da analizzare.", "Consulta i conteggi e le distribuzioni disponibili.", "I risultati includono soltanto i dati del CAS autorizzato."]]] },
};

export const PageInfo = ({ activeView }) => {
  const [open, setOpen] = useState(false);
  const [host, setHost] = useState(null);
  const guide = PAGE_GUIDES[activeView];

  useLayoutEffect(() => {
    setOpen(false);
    const title = document.querySelector(".app-main .app-content-header h1, .app-main .admin-dashboard-header h1, .app-main .home-welcome h1");
    if (!title || !guide) {
      setHost(null);
      return undefined;
    }
    const target = document.createElement("span");
    target.className = "page-info-host";
    title.classList.add("has-page-info");
    title.insertAdjacentElement("afterend", target);
    setHost(target);
    return () => { title.classList.remove("has-page-info"); target.remove(); };
  }, [activeView, guide]);

  if (!guide || !host) return null;
  return <>{createPortal(<button className="page-info-button" type="button" aria-label={`Informazioni su ${guide.title}`} onClick={() => setOpen(true)}>i</button>, host)}{open && <>
    <button className="page-info-backdrop" type="button" aria-label="Chiudi informazioni" onClick={() => setOpen(false)} />
    <div className="page-info-shell" role="dialog" aria-modal="true" aria-labelledby="page-info-title">
      <section className="page-info-modal">
        <header><span className="page-info-symbol" aria-hidden="true">i</span><div><p>Guida alla pagina</p><h2 id="page-info-title">{guide.title}</h2></div><button className="btn-close" type="button" aria-label="Chiudi" onClick={() => setOpen(false)} /></header>
        <div className="page-info-body"><p className="page-info-intro">{guide.intro}</p>{guide.sections.map(([heading, items]) => <section key={heading}><h3>{heading}</h3><ul>{items.map((item) => <li key={item}>{item}</li>)}</ul></section>)}</div>
      </section>
    </div>
  </>}</>;
};
