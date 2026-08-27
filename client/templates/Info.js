export const Info = () => (
  <>
    <div className="app-content-header">
      <div className="container-fluid">
        <h1 className="mb-1">Info</h1>
        <p className="text-secondary mb-0">Consulta le informazioni sul software e sulla versione in uso.</p>
      </div>
    </div>
    <div className="app-content">
      <div className="container-fluid">
        <div className="row justify-content-center">
          <div className="col-12 col-xl-9">
            <section className="card">
              <div className="card-header">
                <h2 className="card-title">HLC Scheduler</h2>
              </div>
              <div className="card-body">
                <h3 className="h5">Scopo del gestionale</h3>
                <p>
                  HLC Scheduler nasce per offrire uno strumento semplice e ordinato con cui
                  gestire attività, strutture, medici, pazienti, collaboratori, documenti e
                  comunicazioni utili al lavoro quotidiano.
                </p>
                <p>
                  L’obiettivo è facilitare l’organizzazione e la condivisione delle informazioni,
                  riducendo le attività manuali e rendendo più immediata la collaborazione tra
                  CAS e GVP.
                </p>

                <hr className="my-4" />

                <h3 className="h5">Un progetto gratuito</h3>
                <p>
                  Il gestionale è gratuito e vuole rimanere accessibile senza costi obbligatori
                  per chi lo utilizza. Lo sviluppo, la manutenzione e l’evoluzione del progetto
                  si baseranno su contribuzioni volontarie.
                </p>
                <p>
                  Ogni contributo sarà libero e servirà a sostenere il tempo, le risorse tecniche
                  e i servizi necessari per mantenere il gestionale affidabile e continuare a
                  migliorarlo.
                </p>

                <hr className="my-4" />

                <h3 className="h5">Chi sono</h3>
                <p>
                  Mi chiamo <strong>Marco Mattiazzo</strong>, sono un fratello, un anziano di
                  congregazione e mi occupo di ingegneria informatica. Ho realizzato questo progetto mettendo le mie competenze
                  a disposizione con l’intento di creare uno strumento concretamente utile,
                  semplice da usare e capace di crescere nel tempo.
                </p>
                <p className="mb-0">
                  Email: <a href="mailto:info.hlcscheduler@gmail.com">info.hlcscheduler@gmail.com</a>
                </p>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  </>
);
