const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");
const { generateSoftwareUpdates, summarizeCommit, nextVersion, italianDate } = require("../scripts/generate-software-updates.cjs");

const fixture = (t) => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "hlc-release-test-"));
  t.after(() => {
    const target = path.resolve(cwd);
    assert.equal(path.dirname(target), path.resolve(os.tmpdir()));
    assert.ok(path.basename(target).startsWith("hlc-release-test-"));
    fs.rmSync(target, { recursive: true, force: true });
  });
  const git = (...args) => execFileSync("git", ["-c", "core.hooksPath=.no-hooks", ...args], {
    cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, GIT_AUTHOR_NAME: "Test", GIT_AUTHOR_EMAIL: "test@example.com", GIT_COMMITTER_NAME: "Test", GIT_COMMITTER_EMAIL: "test@example.com" },
  }).trim();
  const write = (name, value) => {
    const file = path.join(cwd, name);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, value, "utf8");
  };
  const commit = (message) => { git("add", "."); git("commit", "-m", message); return git("rev-parse", "HEAD"); };
  git("init", "-b", "main");
  write("README.md", "Test application\n");
  write("server/softwareUpdateHistory.json", JSON.stringify({ lastProcessedCommit: null, updates: [{ version: "1.0.0", releaseNumber: 0, date: "2026-11-06", summary: "Initial", changes: ["Initial"] }] }));
  write("imports/constants/softwareVersion.js", 'export const SOFTWARE_VERSION = "1.0.0";\n');
  const history = () => JSON.parse(fs.readFileSync(path.join(cwd, "server/softwareUpdateHistory.json"), "utf8"));
  return { cwd, git, write, commit, history };
};

test("descriptive messages are preserved and dot messages summarize changed areas", () => {
  assert.deepEqual(summarizeCommit("Avvisa i GVP alla dimissione\n\nEvita visite in ospedale non necessarie", ["server/main.js"]), {
    summary: "Avvisa i GVP alla dimissione",
    changes: ["Avvisa i GVP alla dimissione", "Evita visite in ospedale non necessarie"],
  });
  assert.deepEqual(summarizeCommit(".", ["client/templates/Patients.js", "imports/api/patientFollowUp.js", "client/templates/Calendar.js"]).changes, [
    "Aggiornata la gestione dei pazienti.", "Aggiornato il calendario.",
  ]);
  assert.ok(!summarizeCommit("Merge pull request #12 from feature", ["client/templates/Patients.js"]).summary.includes("Merge"));
  const withBody = summarizeCommit(".\n\nAvvisa i GVP delle dimissioni\n\nCo-authored-by: Test <test@example.com>", ["server/main.js"]);
  assert.equal(withBody.summary, "Avvisa i GVP delle dimissioni");
  assert.deepEqual(withBody.changes, ["Avvisa i GVP delle dimissioni"]);
});

test("versions increment numerically and dates follow Europe/Rome", () => {
  assert.equal(nextVersion("1.0.9"), "1.0.10");
  assert.equal(italianDate("2026-11-06T23:30:00Z"), "2026-11-07");
  assert.equal(italianDate("2026-07-06T22:30:00Z"), "2026-07-07");
  assert.throws(() => nextVersion("invalid"));
});

test("first run starts at HEAD, redeploys are idempotent, generated commits do not loop", (t) => {
  const f = fixture(t);
  f.commit("Vecchio commit storico da non importare");
  f.write("client/templates/Patients.js", "// patient change");
  const sourceCommit = f.commit(".");
  assert.equal(generateSoftwareUpdates({ cwd: f.cwd }), 1);
  assert.equal(f.history().updates.length, 2);
  assert.equal(f.history().updates[0].version, "1.0.1");
  assert.equal(f.history().updates[0].sourceCommit, sourceCommit);
  assert.equal(f.history().updates[0].releaseNumber, 1);
  assert.equal(generateSoftwareUpdates({ cwd: f.cwd }), 0);
  f.commit("chore(updates): aggiorna lo storico del software");
  assert.equal(generateSoftwareUpdates({ cwd: f.cwd }), 0);
  f.write("client/templates/Calendar.js", "// calendar change");
  f.commit("Migliora il calendario delle visite");
  assert.equal(generateSoftwareUpdates({ cwd: f.cwd }), 1);
  assert.equal(f.history().updates[0].version, "1.0.2");
  assert.match(fs.readFileSync(path.join(f.cwd, "imports/constants/softwareVersion.js"), "utf8"), /1\.0\.2/);
});

test("multiple commits in one push each receive a release without overwriting previous entries", (t) => {
  const f = fixture(t);
  f.commit("Prima versione del gestionale");
  generateSoftwareUpdates({ cwd: f.cwd });
  f.commit("chore(updates): aggiorna lo storico del software");
  f.write("client/templates/Patients.js", "// patients");
  f.commit("Notifiche per i pazienti dimessi");
  f.write("client/templates/Users.js", "// users");
  f.commit("Aggiorna i permessi degli utenti");
  assert.equal(generateSoftwareUpdates({ cwd: f.cwd }), 2);
  assert.deepEqual(f.history().updates.map((update) => update.version), ["1.0.3", "1.0.2", "1.0.1", "1.0.0"]);
  assert.equal(f.history().updates[0].summary, "Aggiorna i permessi degli utenti");
});

test("merged feature branches generate one release with all merged areas", (t) => {
  const f = fixture(t);
  f.commit("Prima versione del gestionale");
  generateSoftwareUpdates({ cwd: f.cwd });
  f.commit("chore(updates): aggiorna lo storico del software");
  f.git("checkout", "-b", "feature");
  f.write("client/templates/Patients.js", "// patients");
  f.commit("Nuova gestione dei pazienti");
  f.write("client/templates/Calendar.js", "// calendar");
  f.commit("Nuovo calendario delle visite");
  f.git("checkout", "main");
  f.git("merge", "--no-ff", "feature", "-m", "Merge branch feature");
  assert.equal(generateSoftwareUpdates({ cwd: f.cwd }), 1);
  assert.deepEqual(f.history().updates[0].changes, ["Aggiornato il calendario.", "Aggiornata la gestione dei pazienti."]);
});

test("missing checkpoints fail without rewriting release data", (t) => {
  const f = fixture(t);
  f.commit("Prima versione del gestionale");
  const history = f.history();
  history.lastProcessedCommit = "0000000000000000000000000000000000000001";
  const before = JSON.stringify(history);
  f.write("server/softwareUpdateHistory.json", before);
  assert.throws(() => generateSoftwareUpdates({ cwd: f.cwd }));
  assert.equal(fs.readFileSync(path.join(f.cwd, "server/softwareUpdateHistory.json"), "utf8"), before);
});
