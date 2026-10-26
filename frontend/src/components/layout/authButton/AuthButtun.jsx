import { useState } from "react";
import { Link, useNavigate } from "react-router";

import { useAuth } from "../../../contexts/useAuth"
import { logout } from "../../../services/authService";

import "./AuthButton.css"

export default function AuthButton() {
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();

  const [loggingOut, setLoggingOut] = useState(false);
  const [error, setError] = useState("");

  async function handleLogout() {
    if (loggingOut) return;

    setLoggingOut(true);
    setError("");

    try {
      await logout();
      navigate("/", { replace: true });
    } catch {
      setError("Logout non riuscito. Riprova.");
    } finally {
      setLoggingOut(false);
    }
  }

  if (loading) {
    return (
      <span className="app-header-status" role="status">
        Verifica della sessione...
      </span>
    );
  }

  if (!user || !profile) {
    return (
      <Link className="app-header-button" to="/login">
        Login
      </Link>
    );
  }

  return (
    <div className="app-header-auth">
      <button
        className="app-header-button"
        type="button"
        onClick={handleLogout}
        disabled={loggingOut}
      >
        {loggingOut ? "Uscita..." : "Logout"}
      </button>

      {error && (
        <p className="app-header-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}