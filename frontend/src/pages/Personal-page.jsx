import { Link } from "react-router";
import { useAuth } from "../contexts/useAuth";

export default function PersonalPage() {
  const { profile } = useAuth();

  return (
    <div style={{ maxWidth: "960px", margin: "0 auto", padding: "40px 24px", fontFamily: '"Segoe UI", sans-serif' }}>
      <h1>Area Personale</h1>
      {profile?.role === "ADMIN" && (
        <div style={{ marginTop: "24px" }}>
          <Link
            to="/booking-requests"
            style={{
              display: "inline-block",
              padding: "12px 20px",
              background: "#b71e24",
              color: "#ffffff",
              textDecoration: "none",
              borderRadius: "6px",
              fontWeight: 700,
            }}
          >
            Visualizza richieste di prenotazione
          </Link>
        </div>
      )}
    </div>
  );
}
