import { createRoot } from "react-dom/client";
import { Meteor } from "meteor/meteor";
import { App } from "./templates/App.js";
import { InstallAppPrompt } from "./templates/InstallAppPrompt.js";
import "admin-lte/dist/css/adminlte.min.css";
import "./templates/styles.css";

const htmlModuleRecoveryKey = "hlc-html-module-recovery";
const recoverFromHtmlModuleError = (error) => {
  const message = String(error?.message || error?.reason?.message || error?.reason || "");
  if (!message.includes("Unexpected token '<'") || globalThis.sessionStorage?.getItem(htmlModuleRecoveryKey) === "reloading") return;
  globalThis.sessionStorage?.setItem(htmlModuleRecoveryKey, "reloading");
  globalThis.location.reload();
};

globalThis.addEventListener("error", (event) => recoverFromHtmlModuleError(event.error || event.message));
globalThis.addEventListener("unhandledrejection", (event) => recoverFromHtmlModuleError(event.reason));

Meteor.startup(() => {
  document.body.classList.remove("sidebar-open", "sidebar-collapse");
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/service-worker.js").catch(() => {});
  }
  const container = document.getElementById("react-target");
  const root =
    globalThis.__hlcSchedulerReactRoot ||
    (globalThis.__hlcSchedulerReactRoot = createRoot(container));

  root.render(<App />);
  const installPromptRoot =
    globalThis.__hlcSchedulerInstallPromptRoot ||
    (globalThis.__hlcSchedulerInstallPromptRoot = (() => {
      const installPromptContainer = document.createElement("div");
      document.body.append(installPromptContainer);
      return createRoot(installPromptContainer);
    })());
  installPromptRoot.render(<InstallAppPrompt />);
  globalThis.setTimeout(() => globalThis.sessionStorage?.removeItem(htmlModuleRecoveryKey), 5000);
});
