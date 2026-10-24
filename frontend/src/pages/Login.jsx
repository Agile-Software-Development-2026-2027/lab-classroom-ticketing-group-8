import { useState } from "react";
import { loginWithUniversityId, logout } from "../services/authService";
import { getUserProfile } from "../services/userService";

export default function Login() {
  const [universityId, setUniversityId] = useState("");
  const [password, setPassword] = useState("");
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const id = universityId.trim();
      const user = await loginWithUniversityId(id, password);
      const data = await getUserProfile(user.uid);

      if (data.role !== "PROFESSOR" || data.universityId !== id) {
        throw new Error("Accesso non consentito.");
      }

      setProfile(data);
      setPassword("");
    } catch (err) {
      await logout().catch(() => {});
      setError(
        err.message === "La matricola deve contenere 6 cifre."
          ? err.message
          : "Accesso non riuscito. Controlla le credenziali o i permessi."
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    try {
      await logout();
      setProfile(null);
    } catch {
      setError("Logout non riuscito.");
    }
  }

  if (profile) {
    return (
      <main>
        <h1>Benvenuto, {profile.displayName}</h1>
        <p>Ruolo: {profile.role}</p>
        <button onClick={handleLogout}>Logout</button>
        {error && <p role="alert">{error}</p>}
      </main>
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
            onChange={(e) => setUniversityId(e.target.value)}
            placeholder="6 cifre"
            maxLength={6}
            required
          />
        </label>

        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
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