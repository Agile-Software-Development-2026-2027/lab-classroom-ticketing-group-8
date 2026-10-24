
import { useState } from "react";
import { useAuth } from "../contexts/useAuth";
import { loginWithUniversityId, logout } from "../services/authService";

export default function Login() {
  const { user, profile, loading: sessionLoading } = useAuth();

  const [universityId, setUniversityId] = useState("");
  const [password, setPassword] = useState("");
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
    } catch {
      setError("Logout non riuscito.");
    }
  }

  if (sessionLoading) {
    return (
      <section>
        <p>Verifica della sessione...</p>
      </section>
    );
  }

  if (user && profile) {
    return (
      <section>
        {profile.role === "PROFESSOR" ? (
          <>
            <h1>Benvenuto, {profile.displayName}</h1>
            <p>Matricola: {profile.universityId}</p>
            <p>Ruolo: {profile.role}</p>
          </>
        ) : (
          <p>Questa area è riservata ai professori.</p>
        )}

        <button type="button" onClick={handleLogout}>
          Logout
        </button>

        {error && <p role="alert">{error}</p>}
      </section>
    );
  }

  return (
    <section>
      <h1>UniRoom - Login professore</h1>

      <form onSubmit={handleSubmit}>
        <label>
          Matricola
          <input
            value={universityId}
            onChange={(event) => setUniversityId(event.target.value)}
            placeholder="6 cifre"
            inputMode="numeric"
            maxLength={6}
            autoComplete="username"
            required
          />
        </label>

        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            required
          />
        </label>

        <button type="submit" disabled={loading}>
          {loading ? "Accesso in corso..." : "Accedi"}
        </button>

        {error && <p role="alert">{error}</p>}
      </form>
    </section>
  );
}
