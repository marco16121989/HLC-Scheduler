import { Meteor } from "meteor/meteor";

const DEFAULT_DONATION_PAYMENT_LINK = "https://buy.stripe.com/3cI9AL3422wxaID9xj1gs00";

export const Donations = () => {
  const paymentLink = Meteor.settings?.public?.donationPaymentLink || DEFAULT_DONATION_PAYMENT_LINK;
  const paymentReady = /^https:\/\//i.test(paymentLink);

  return <>
    <div className="app-content-header">
      <div className="container-fluid">
        <h1 className="mb-1">Sostieni il progetto</h1>
        <p className="text-secondary mb-0">Contribuisci volontariamente allo sviluppo e al mantenimento di HLC Scheduler.</p>
      </div>
    </div>
    <div className="app-content donation-page">
      <div className="container-fluid">
        <section className="donation-hero card">
          <div className="card-body">
            <span className="donation-heart" aria-hidden="true">♥</span>
            <p className="donation-eyebrow">Contributo volontario</p>
            <h2>Aiutaci a migliorare HLC Scheduler</h2>
            <p>Il tuo contributo aiuta a sostenere lo sviluppo, la sicurezza e il miglioramento continuo del software.</p>
            <div className="donation-points">
              <span>Donazione singola</span>
              <span>Importo libero</span>
              <span>Pagamento esterno sicuro</span>
            </div>
            <p className="donation-fee-note"><strong>Ogni contributo per noi è prezioso, grazie di cuore.</strong> Se ti è possibile, ti consigliamo una donazione da 5 € in su, così le commissioni di Stripe incidono meno e una parte maggiore del tuo sostegno può essere dedicata al progetto. In ogni caso, ogni donazione è importante e ti ringraziamo di cuore ❤️</p>
            {paymentReady ? <a className="btn btn-primary btn-lg donation-cta" href={paymentLink} target="_blank" rel="noreferrer">Fai una donazione</a> : <button className="btn btn-primary btn-lg donation-cta" type="button" disabled>Donazioni presto disponibili</button>}
            {!paymentReady && <small className="donation-configuration-note">La pagina è pronta. Il pagamento verrà attivato dopo la configurazione del collegamento sicuro.</small>}
          </div>
        </section>
      </div>
    </div>
  </>;
};
