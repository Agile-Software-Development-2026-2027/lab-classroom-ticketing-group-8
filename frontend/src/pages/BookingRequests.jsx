import { useEffect, useState } from "react";
import { getPendingBookingRequests } from "../services/bookingService";
import "./BookingRequests.css";

export default function BookingRequests() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;

    async function loadRequests() {
      try {
        setLoading(true);
        setError(null);
        const data = await getPendingBookingRequests();
        if (isMounted) {
          setRequests(data);
        }
      } catch (err) {
        if (isMounted) {
          setError("Impossibile caricare le richieste. Riprova più tardi.");
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
  }, []);

  return (
    <div className="ur-booking-container">
      <header className="ur-booking-header">
        <h1>Richieste di Prenotazione</h1>
        <p className="ur-booking-subtitle">
          Elenco delle richieste di prenotazione aule in attesa di revisione.
        </p>
      </header>

      {loading && (
        <div className="ur-loading-state" role="status" aria-live="polite">
          <div className="ur-loader" aria-hidden="true" />
          <span>Caricamento delle richieste in corso...</span>
        </div>
      )}

      {error && !loading && (
        <div className="ur-message ur-message-error" role="alert">
          {error}
        </div>
      )}

      {!loading && !error && requests.length === 0 && (
        <div className="ur-empty-state">
          <p>Nessuna richiesta di prenotazione in attesa.</p>
        </div>
      )}

      {!loading && !error && requests.length > 0 && (
        <ul className="ur-requests-list" aria-label="Elenco richieste pendenti">
          {requests.map((request) => (
            <li key={request.id} className="ur-request-card">
              <div className="ur-request-card-header">
                <span className="ur-request-classroom">
                  {request.classroom}
                </span>
                <span className="ur-badge ur-badge-pending">
                  In attesa
                </span>
              </div>

              <div className="ur-request-details">
                <div className="ur-detail-row">
                  <span className="ur-detail-label">Docente:</span>
                  <span className="ur-detail-value">
                    {request.professorName}
                  </span>
                </div>

                <div className="ur-detail-row">
                  <span className="ur-detail-label">Matricola:</span>
                  <span className="ur-detail-value">
                    {request.professorUniversityId}
                  </span>
                </div>

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
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}