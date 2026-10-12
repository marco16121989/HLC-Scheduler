import assert from "assert";
import { confirmPatientClosure } from "../client/templates/patientStatusConfirmation.js";

describe("patient closure and follow up", function () {
  it("does not ask about follow up when discharge is cancelled", async function () {
    let calls = 0;
    const result = await confirmPatientClosure("Dimesso", async () => { calls += 1; return false; });
    assert.strictEqual(result, null);
    assert.strictEqual(calls, 1);
  });

  it("waits for discharge confirmation before asking about follow up", async function () {
    const calls = [];
    let confirmDischarge;
    const resultPromise = confirmPatientClosure("Dimesso", (message, options) => {
      calls.push(options);
      return calls.length === 1
        ? new Promise((resolve) => { confirmDischarge = resolve; })
        : Promise.resolve(true);
    });
    assert.strictEqual(calls.length, 1);
    assert.strictEqual(calls[0].title, "Conferma dimissioni");
    confirmDischarge(true);
    assert.deepStrictEqual(await resultPromise, { followUpEnabled: true });
    assert.strictEqual(calls.length, 2);
    assert.strictEqual(calls[1].confirmLabel, "Attiva follow up");
    assert.strictEqual(calls[1].cancelLabel, "No, grazie");
  });

  it("keeps discharge confirmed when follow up is declined", async function () {
    const answers = [true, false];
    assert.deepStrictEqual(
      await confirmPatientClosure("Dimesso", async () => answers.shift()),
      { followUpEnabled: false },
    );
    assert.strictEqual(answers.length, 0);
  });

  it("does not ask about follow up for a deceased patient", async function () {
    const calls = [];
    const result = await confirmPatientClosure("Deceduto", async (message, options) => {
      calls.push(options);
      return true;
    });
    assert.deepStrictEqual(result, { followUpEnabled: false });
    assert.strictEqual(calls.length, 1);
    assert.strictEqual(calls[0].title, "Conferma decesso");
    assert.strictEqual(calls[0].confirmLabel, "Conferma");
  });
});
