
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router";

import "./index.css";
import "./firebase/client";

import App from "./App.jsx";
import { AuthProvider } from "./contexts/AuthContext";

ReactDOM.createRoot(
  document.getElementById("root")
).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
