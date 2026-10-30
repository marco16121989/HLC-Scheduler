import { useMemo, useState } from "react";
import { MANUAL_PROFILES, getManualChapters, filterManualChapters } from "../../imports/constants/userManual.js";

const Block = ({ block }) => <section className="user-manual-block">
  {block.title && <h3>{block.title}</h3>}
  {block.paragraphs?.map(text => <p key={text}>{text}</p>)}
  {block.steps && <ol>{block.steps.map(text => <li key={text}>{text}</li>)}</ol>}
</section>;

export const UserManual = ({ currentUser, onOpenView }) => {
  const [search, setSearch] = useState("");
  const profile = MANUAL_PROFILES[currentUser?.role];
  const chapters = useMemo(() => getManualChapters(currentUser), [currentUser]);
  const results = useMemo(() => filterManualChapters(chapters, search), [chapters, search]);
  if (!profile) return <div className="app-content"><p role="alert">Il manuale è disponibile per Presidente, CAS e GVP.</p></div>;
  const goToChapter = (id) => {
    const heading = document.getElementById(`manual-${id}`);
    heading?.scrollIntoView({ block: "start" });
    heading?.focus({ preventScroll: true });
  };

  return <div className="user-manual">
    <div className="app-content-header"><div className="container-fluid">
      <h1 className="mb-1">Manuale d'uso <span className="user-manual-role">{currentUser.role}</span></h1>
      <p className="text-secondary mb-0">Istruzioni passo per passo per il tuo ruolo e le sezioni abilitate al tuo account.</p>
    </div></div>
    <div className="app-content"><div className="container-fluid">
      <section className="card user-manual-intro">
        <div className="card-body">
          <h2 className="h4">Da dove iniziare</h2>
          <p>{profile.summary}</p>
          <ol>{profile.steps.map(step => <li key={step}>{step}</li>)}</ol>
          <p className="text-secondary mb-0">Questa guida descrive l'uso del software. Le azioni disponibili dipendono anche dai permessi, dalle assegnazioni e dai dati registrati. Se una funzione non è abilitata, chiedi al referente dell'organizzazione.</p>
        </div>
      </section>
      <div className="row g-4">
        <aside className="col-lg-4 col-xl-3">
          <nav className="card user-manual-index" aria-label={`Indice del manuale ${currentUser.role}`}>
            <div className="card-body">
              <label className="form-label fw-semibold" htmlFor="user-manual-search">Cerca nel manuale</label>
              <input id="user-manual-search" className="form-control mb-2" type="search" placeholder="Es. pazienti, inviti, note…" value={search} onChange={event => setSearch(event.target.value)} />
              <p className="small text-secondary" role="status">{results.length} capitoli disponibili{search.trim() ? " per questa ricerca" : ""}</p>
              <ol>{results.map(chapter => <li key={chapter.id}><button className="btn btn-link text-start" type="button" onClick={() => goToChapter(chapter.id)}>{chapter.title}</button></li>)}</ol>
              {search && <button className="btn btn-outline-secondary btn-sm" type="button" onClick={() => setSearch("")}>Azzera ricerca</button>}
            </div>
          </nav>
        </aside>
        <div className="col-lg-8 col-xl-9">
          {!results.length && <div className="alert alert-info">Nessun capitolo trovato. Prova un'altra parola oppure azzera la ricerca.</div>}
          {results.map(chapter => <article className="card user-manual-chapter" key={chapter.id}>
            <div className="card-header"><h2 className="card-title" id={`manual-${chapter.id}`} tabIndex={-1}>{chapter.title}</h2></div>
            <div className="card-body">
              {chapter.blocks.map((block, index) => <Block key={index} block={block} />)}
              {(chapter.target || chapter.page) && onOpenView && <button type="button" className="btn btn-outline-primary btn-sm mt-2" onClick={() => onOpenView(chapter.target || chapter.page)}>Apri la sezione nel gestionale</button>}
            </div>
          </article>)}
        </div>
      </div>
    </div></div>
  </div>;
};
