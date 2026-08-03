const net = require("node:net");
const { spawn } = require("node:child_process");

const APP_PORT = 3000;
const TEST_PORT = 3107;

const isPortInUse = (port) => new Promise((resolve) => {
  const socket = net.createConnection({ host: "127.0.0.1", port });
  const finish = (inUse) => {
    socket.destroy();
    resolve(inUse);
  };

  socket.setTimeout(800);
  socket.once("connect", () => finish(true));
  socket.once("timeout", () => finish(false));
  socket.once("error", () => finish(false));
});

const run = async () => {
  if (await isPortInUse(APP_PORT)) {
    console.error(
      `\nTest annullati: il gestionale e attivo su localhost:${APP_PORT}.\n` +
      "Meteor non puo eseguire app e test contemporaneamente nella stessa cartella.\n" +
      "Arresta prima il gestionale oppure usa una copia separata del progetto.\n",
    );
    process.exitCode = 2;
    return;
  }

  if (await isPortInUse(TEST_PORT)) {
    console.error(`\nTest annullati: la porta dedicata ${TEST_PORT} e gia occupata.\n`);
    process.exitCode = 2;
    return;
  }

  const fullApp = process.argv.includes("--full-app");
  const meteorArgs = fullApp
    ? ["test", "--full-app", "--driver-package", "meteortesting:mocha", "--port", String(TEST_PORT)]
    : ["test", "--once", "--driver-package", "meteortesting:mocha", "--port", String(TEST_PORT)];
  const command = process.platform === "win32" ? "meteor.cmd" : "meteor";
  const child = spawn(command, meteorArgs, {
    stdio: "inherit",
    env: fullApp ? { ...process.env, TEST_WATCH: "1" } : process.env,
  });

  child.once("error", (error) => {
    console.error(`Impossibile avviare Meteor: ${error.message}`);
    process.exitCode = 1;
  });
  child.once("exit", (code, signal) => {
    process.exitCode = code ?? (signal ? 1 : 0);
  });
};

void run();
