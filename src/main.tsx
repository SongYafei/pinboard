import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { installFileLogger } from "./utils/fileLogger";
import "./styles/global.css";

// DEV 模式下把 console 日志镜像到 APPDATA/com.pinboard.app/pinboard-dev.log
if (import.meta.env.DEV) {
  installFileLogger();
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
