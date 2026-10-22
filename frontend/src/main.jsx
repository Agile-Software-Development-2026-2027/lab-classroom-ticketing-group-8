import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router";

import "./index.css";
import "./firebase/client";

import App from "./App.jsx";

ReactDOM.createRoot(
  document.getElementById("root")
).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);