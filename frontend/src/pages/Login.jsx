import { useState } from "react";
import { useAuth } from "../contexts/useAuth";
import { loginWithUniversityId, logout } from "../services/authService";
import unicalLogo from "../assets/unical-logo.png";
import "./Login.css";

export default function Login() {
  const { user, profile, loading: sessionLoading } = useAuth();
  const [universityId, setUniversityId] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      await loginWithUniversityId(universityId.trim(), password);
      setPassword("");
    } catch (err) {
      setError(
        err.message === "La matricola deve contenere 6 cifre."
          ? err.message
          : "Accesso non riuscito. Controlla le credenziali."
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    setError("");
    try {
      await logout();
      setPassword("");
      setShowPassword(false);
    } catch {
      setError("Logout non riuscito.");
    }
  }

  return (
    <div className="ur-auth">
      <main className="ur-auth-layout">
        <section className="ur-identity" aria-label="Università della Calabria">
          <img
            className="ur-unical-logo"
            src={unicalLogo}
            alt="Università della Calabria"
          />
        </section>

        <section className="ur-panel" aria-labelledby="ur-panel-heading">
          <h1 id="ur-panel-heading">Login</h1>

          {sessionLoading ? (
            <div className="ur-loading" role="status" aria-live="polite">
              <span className="ur-loader" aria-hidden="true" />
              Caricamento...
            </div>
          ) : user && profile ? (
            <div className="ur-session">
              {profile.role === "PROFESSOR" ? (
                <div className="ur-session-details">
                  <p>Benvenuto, {profile.displayName}</p>
                  <p>Matricola: {profile.universityId}</p>
                </div>
              ) : (
                <p className="ur-message ur-message-error" role="alert">
                  Accesso non autorizzato.
                </p>
              )}

              <button
                className="ur-button ur-button-outline"
                type="button"
                onClick={handleLogout}
              >
                Logout
              </button>
              {error && (
                <p className="ur-message ur-message-error" role="alert">
                  {error}
                </p>
              )}
            </div>
          ) : (
            <form className="ur-login-form" onSubmit={handleSubmit}>
              <div className="ur-field">
                <label htmlFor="ur-university-id">Matricola</label>
                <input
                  id="ur-university-id"
                  name="universityId"
                  type="text"
                  inputMode="numeric"
                  autoComplete="username"
                  maxLength={6}
                  placeholder="6 cifre"
                  value={universityId}
                  onChange={(event) => setUniversityId(event.target.value)}
                  aria-invalid={Boolean(error)}
                  required
                />
              </div>

              <div className="ur-field">
                <label htmlFor="ur-password">Password</label>
                <div className="ur-password-wrap">
                  <input
                    id="ur-password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="Password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    aria-invalid={Boolean(error)}
                    required
                  />
                  <button
                    className="ur-password-toggle"
                    type="button"
                    aria-label={showPassword ? "Nascondi password" : "Mostra password"}
                    aria-pressed={showPassword}
                    onClick={() => setShowPassword((value) => !value)}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      width="22"
                      height="22"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.7"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M2 12s3.8-6.5 10-6.5S22 12 22 12s-3.8 6.5-10 6.5S2 12 2 12Z" />
                      <circle cx="12" cy="12" r="3" />
                      {showPassword && <path d="M3 21 21 3" />}
                    </svg>
                  </button>
                </div>
              </div>

              {error && (
                <p className="ur-message ur-message-error" role="alert">
                  {error}
                </p>
              )}

              <button className="ur-button ur-button-primary" type="submit" disabled={loading}>
                {loading ? "Accesso in corso..." : "Accedi"}
              </button>
            </form>
          )}
        </section>
      </main>
    </div>
  );
}
