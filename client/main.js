import { createRoot } from "react-dom/client";
import { Meteor } from "meteor/meteor";
import { App } from "./templates/App.js";
import "admin-lte/dist/css/adminlte.min.css";
import "./templates/styles.css";

Meteor.startup(() => {
  document.body.classList.remove("sidebar-open", "sidebar-collapse");
  const container = document.getElementById("react-target");
  const root =
    globalThis.__hlcSchedulerReactRoot ||
    (globalThis.__hlcSchedulerReactRoot = createRoot(container));

  root.render(<App />);
});
