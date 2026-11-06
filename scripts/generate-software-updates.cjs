const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const HISTORY_PATH = "server/softwareUpdateHistory.json";
const VERSION_PATH = "imports/constants/softwareVersion.js";
const GENERATED_PATHS = new Set([HISTORY_PATH, VERSION_PATH]);

const AREAS = [
  [/softwareUpdate|softwareVersion|templates\/Updates\.js/i, "Aggiornata la sezione Aggiornamenti."],
  [/notif|push|emailTemplate|AdminEmailSettings/i, "Aggiornata la gestione delle notifiche e delle comunicazioni."],
  [/patient|pazient/i, "Aggiornata la gestione dei pazienti."],
  [/calendar/i, "Aggiornato il calendario."],
  [/annualReport/i, "Aggiornato il rapporto annuale CAS."],
  [/report|casActivity/i, "Aggiornati i report e le statistiche."],
  [/presentation|presentazion/i, "Aggiornata la gestione delle presentazioni."],
  [/hospitality/i, "Aggiornata la gestione dell’ospitalità."],
  [/hospital|department|doctor|coverage/i, "Aggiornate le sezioni ospedali, reparti e medici."],
  [/user|profile|permission|admin|access|login/i, "Aggiornata la gestione degli utenti e dei permessi."],
  [/event|absence/i, "Aggiornata la gestione degli eventi e delle assenze."],
  [/UsefulFiles|SupportRequests/i, "Aggiornate le sezioni dei file utili e delle segnalazioni."],
  [/client\//, "Aggiornata l’interfaccia del gestionale."],
  [/server\//, "Aggiornate le funzionalità del gestionale."],
  [/README|\.md$/i, "Aggiornata la documentazione."],
  [/^tests\//, "Aggiornati i controlli automatici del software."],
];

const cleanMessage = (message) => String(message).replace(/\s+/g, " ").trim();
const isDescriptive = (message) => {
  const text = cleanMessage(message);
  return text.length >= 12 && /\p{L}{3}/u.test(text) &&
    !/^(merge\b|update(s)?[.!\s]*$|aggiornament[oi][.!\s]*$|fix(es)?[.!\s]*$|wip\b|test[.!\s]*$)/i.test(text);
};

const summarizeCommit = (message, files) => {
  const lines = message.split(/\r?\n/).map(cleanMessage)
    .filter((line) => !/^(co-authored-by|signed-off-by|reviewed-by|tested-by|acked-by):/i.test(line))
    .filter(isDescriptive);
  const subject = cleanMessage(message.split(/\r?\n/)[0]);
  // Prefer the author's description. File-based fallback identifies areas only.
  if (lines.length) {
    return { summary: (isDescriptive(subject) ? subject : lines[0]).slice(0, 200), changes: [...new Set(lines)].slice(0, 50).map((line) => line.slice(0, 5000)) };
  }
  const changes = [];
  for (const file of files) {
    const area = AREAS.find(([pattern]) => pattern.test(file));
    if (area && !changes.includes(area[1])) changes.push(area[1]);
  }
  if (!changes.length) changes.push("Aggiornata la configurazione del software.");
  return { summary: changes.length === 1 ? changes[0] : "Aggiornamenti alle funzionalità del gestionale", changes };
};

const nextVersion = (version) => {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  if (!match) throw new Error(`Versione non valida: ${version}`);
  return `${match[1]}.${match[2]}.${Number(match[3]) + 1}`;
};

const italianDate = (timestamp) => {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date(timestamp));
  const get = (type) => parts.find((part) => part.type === type).value;
  return `${get("year")}-${get("month")}-${get("day")}`;
};

const generateSoftwareUpdates = ({ cwd = path.resolve(__dirname, "..") } = {}) => {
  const git = (...args) => execFileSync("git", args, { cwd, encoding: "utf8", maxBuffer: 20 * 1024 * 1024 }).trim();
  const historyFile = path.join(cwd, HISTORY_PATH);
  const history = JSON.parse(fs.readFileSync(historyFile, "utf8"));
  const head = git("rev-parse", "HEAD");
  if (history.lastProcessedCommit === head) return 0;
  if (history.lastProcessedCommit) {
    // Never replay old history after a force push or an incomplete checkout.
    git("merge-base", "--is-ancestor", history.lastProcessedCommit, head);
  }
  const commits = history.lastProcessedCommit
    ? git("log", "--first-parent", "--reverse", "--format=%H", `${history.lastProcessedCommit}..${head}`).split(/\r?\n/).filter(Boolean)
    : [head];
  let version = history.updates[0].version;
  let releaseNumber = Math.max(0, ...history.updates.map((update) => update.releaseNumber || 0));
  let added = 0;
  for (const commit of commits) {
    const message = git("show", "-s", "--format=%B", commit);
    const files = git("diff-tree", "--no-commit-id", "--name-only", "-r", "--root", "-m", "--first-parent", commit)
      .split(/\r?\n/).filter(Boolean);
    if (!files.length || files.every((file) => GENERATED_PATHS.has(file))) continue;
    if (history.updates.some((update) => update.sourceCommit === commit)) continue;
    version = nextVersion(version);
    releaseNumber += 1;
    history.updates.unshift({
      version,
      releaseNumber,
      sourceCommit: commit,
      date: italianDate(git("show", "-s", "--format=%cI", commit)),
      ...summarizeCommit(message, files.filter((file) => !GENERATED_PATHS.has(file))),
    });
    added += 1;
  }
  // No source changes: no generated commit and no deployment loop.
  if (!added) return 0;
  history.lastProcessedCommit = head;
  fs.writeFileSync(historyFile, `${JSON.stringify(history, null, 2)}\n`, "utf8");
  fs.writeFileSync(path.join(cwd, VERSION_PATH), `export const SOFTWARE_VERSION = ${JSON.stringify(version)};\n`, "utf8");
  return added;
};

if (require.main === module) {
  try {
    const added = generateSoftwareUpdates();
    console.log(`Aggiornamenti generati: ${added}.`);
  } catch (error) {
    console.error("Generazione degli aggiornamenti non riuscita:", error.message);
    process.exitCode = 1;
  }
}

module.exports = { generateSoftwareUpdates, summarizeCommit, nextVersion, italianDate };
