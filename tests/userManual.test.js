import assert from "assert";
import { getPagePermission } from "../imports/constants/pagePermissions.js";
import { MANUAL_PROFILES, getManualChapters, filterManualChapters } from "../imports/constants/userManual.js";

describe("manuale d'uso per ruolo", function () {
  const chaptersFor = user => getManualChapters(user);
  const idsFor = user => chaptersFor(user).map(chapter => chapter.id);

  it("abilita il manuale solo per Presidente, CAS e GVP", function () {
    for (const role of ["Presidente", "CAS", "GVP"]) {
      assert.deepStrictEqual(getPagePermission({ role }, "manual"), { view: true, edit: false });
      assert.ok(MANUAL_PROFILES[role].steps.length);
    }
    for (const user of [null, {}, { role: "Admin" }, { role: "altro" }]) {
      assert.deepStrictEqual(getPagePermission(user, "manual"), { view: false, edit: false });
      assert.deepStrictEqual(chaptersFor(user), []);
    }
  });

  it("mostra al Presidente il percorso di coordinamento e i permessi", function () {
    const ids = idsFor({ role: "Presidente" });
    for (const id of ["squadra", "permessi", "pazienti-gestione", "condivisione", "rapporto-annuale"]) assert.ok(ids.includes(id), id);
    assert.ok(!ids.includes("pazienti-gvp"));
    assert.ok(!ids.includes("report-cas"));
  });

  it("distingue CAS ordinario e Segretario CAS", function () {
    assert.ok(!idsFor({ role: "CAS" }).includes("rapporto-annuale"));
    assert.ok(idsFor({ role: "CAS", isSecretary: true }).includes("rapporto-annuale"));
    assert.ok(idsFor({ role: "CAS" }).includes("report-cas"));
    const team = chaptersFor({ role: "CAS" }).find(chapter => chapter.id === "squadra");
    assert.ok(!team.blocks.some(block => block.editOnly));
  });

  it("mostra al GVP consultazione e comunicazioni senza funzioni del CAS", function () {
    const user = { role: "GVP" };
    const chapters = chaptersFor(user);
    const ids = chapters.map(chapter => chapter.id);
    assert.ok(ids.includes("pazienti-gvp"));
    for (const id of ["pazienti-gestione", "squadra", "permessi", "condivisione", "follow-up", "rapporto-annuale", "assistenza"]) assert.ok(!ids.includes(id), id);
    const notes = chapters.find(chapter => chapter.id === "note");
    assert.ok(!notes.blocks.some(block => block.title === "Note CAS"));
    assert.ok(!chapters.find(chapter => chapter.id === "eventi").blocks.some(block => block.title === "Creare un evento"));
    assert.ok(chapters.find(chapter => chapter.id === "report").blocks.some(block => block.paragraphs?.some(text => text.includes("statistiche aggregate"))));
  });

  it("adatta i capitoli e i passi di modifica ai permessi effettivi", function () {
    const user = { role: "Presidente", pagePermissions: {
      events: { view: false, edit: false }, patients: { view: true, edit: false },
    } };
    assert.ok(!idsFor(user).includes("eventi"));
    const patient = chaptersFor(user).find(chapter => chapter.id === "pazienti-gestione");
    assert.ok(patient);
    assert.ok(!patient.blocks.some(block => block.editOnly));
    const cas = { role: "CAS", pagePermissions: { cas: { view: true, edit: true } } };
    const team = chaptersFor(cas).find(chapter => chapter.id === "squadra");
    assert.ok(team.blocks.some(block => block.title === "Gestire gli account CAS"));
    assert.ok(!team.blocks.some(block => block.title === "Gestire gli account GVP"));
  });

  it("ha identificativi univoci, contenuti per ogni capitolo e ricerca senza distinzione di accenti", function () {
    for (const role of ["Presidente", "CAS", "GVP"]) {
      const chapters = chaptersFor({ role });
      assert.strictEqual(new Set(chapters.map(chapter => chapter.id)).size, chapters.length);
      assert.ok(chapters.every(chapter => chapter.blocks.length > 0));
      assert.ok(filterManualChapters(chapters, "NOTIFICHE").length > 0);
      assert.ok(filterManualChapters(chapters, "attivita").length > 0);
      assert.strictEqual(filterManualChapters(chapters, "  ").length, chapters.length);
      assert.deepStrictEqual(filterManualChapters(chapters, "parola-inesistente-123"), []);
    }
  });
});
