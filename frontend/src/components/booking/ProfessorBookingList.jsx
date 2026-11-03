import { useEffect, useState } from "react";
import { useAuth } from "../../contexts/useAuth";
import { getProfessorBookingRequests } from "../../services/bookingService";
import "./ProfessorBookingList.css";

const STATUS_LABELS = {
  PENDING: "In attesa",
  APPROVED: "Approvata",
  REJECTED: "Rifiutata",
};

const STATUS_CLASSES = {
  PENDING: "ur-badge-pending",
  APPROVED: "ur-badge-approved",
  REJECTED: "ur-badge-rejected",
};

export default function ProfessorBookingList() {
  const { user } = useAuth();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;

    async function loadRequests() {
      if (!user?.uid) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const data = await getProfessorBookingRequests(user.uid);
        if (isMounted) {
          setRequests(data);
        }
      } catch (err) {
        if (isMounted) {
          setError("Impossibile caricare le tue richieste di prenotazione.");
          console.error("Errore nel caricamento delle richieste:", err);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadRequests();

    return () => {
      isMounted = false;
    };
  }, [user?.uid]);

  return (
    <div className="ur-professor-bookings-section">
      <div className="ur-professor-bookings-header">
        <h2>Le Mie Richieste di Prenotazione</h2>
        <p className="ur-professor-bookings-subtitle">
          Consulta lo stato delle tue richieste di assegnazione aula.
        </p>
      </div>

      {loading && (
        <div className="ur-loading-state" role="status" aria-live="polite">
          <div className="ur-loader" aria-hidden="true" />
          <span>Caricamento delle tue richieste in corso...</span>
        </div>
      )}

      {error && !loading && (
        <div className="ur-message ur-message-error" role="alert">
          {error}
        </div>
      )}

      {!loading && !error && requests.length === 0 && (
        <div className="ur-empty-state">
          <p>Non hai ancora inviato nessuna richiesta di prenotazione.</p>
        </div>
      )}

      {!loading && !error && requests.length > 0 && (
        <ul className="ur-requests-list" aria-label="Elenco delle mie richieste">
          {requests.map((request) => {
            const statusKey = request.status?.toUpperCase() || "PENDING";
            const statusLabel = STATUS_LABELS[statusKey] || request.status;
            const badgeClass = STATUS_CLASSES[statusKey] || "ur-badge-pending";

            return (
              <li key={request.id} className="ur-request-card">
                <div className="ur-request-card-header">
                  <span className="ur-request-classroom">
                    {request.classroom}
                  </span>
                  <span className={`ur-badge ${badgeClass}`}>
                    {statusLabel}
                  </span>
                </div>

                <div className="ur-request-details">
                  <div className="ur-detail-row">
                    <span className="ur-detail-label">Data:</span>
                    <span className="ur-detail-value">{request.date}</span>
                  </div>

                  <div className="ur-detail-row">
                    <span className="ur-detail-label">Orario:</span>
                    <span className="ur-detail-value">
                      {request.startTime} - {request.endTime}
                    </span>
                  </div>

                  <div className="ur-detail-row">
                    <span className="ur-detail-label">Stato:</span>
                    <span className="ur-detail-value">{statusLabel}</span>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

