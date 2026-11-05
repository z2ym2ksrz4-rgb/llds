import React from "react";
import ReactDOM from "react-dom/client";
import App from "./app/App";
import { useSettings } from "@/core/settings";
import { initI18n } from "@/core/i18n";
import { useAuth } from "@/core/auth";
import "./styles.css";

async function boot() {
  useSettings.getState().load();
  await initI18n(useSettings.getState().language);
  void useAuth.getState().boot();
  ReactDOM.createRoot(document.getElementById("root")!).render(<React.StrictMode><App /></React.StrictMode>);
}
void boot();
