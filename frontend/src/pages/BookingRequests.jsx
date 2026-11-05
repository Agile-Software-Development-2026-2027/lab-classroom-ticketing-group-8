
import { useEffect, useState } from "react";
import { useAuth } from "../contexts/useAuth";
import { getAssignedDepartmentId } from "../services/userService";
import {
  getPendingBookingRequests,
  approveBookingRequest,
  rejectBookingRequest,
} from "../services/bookingService";
import "./BookingRequests.css";

export default function BookingRequests() {
  const { profile } = useAuth();
  const departmentId = getAssignedDepartmentId(profile);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingRequestId, setProcessingRequestId] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  useEffect(() => {
    let isMounted = true;

    async function loadRequests() {
      try {
        setLoading(true);
        setError(null);
        setRequests([]);

        if (profile?.role !== "ADMIN" || !departmentId) {
          throw new Error("Dipartimento amministratore non assegnato.");
        }

        const data = await getPendingBookingRequests(departmentId);

        if (isMounted) {
          setRequests(data);
        }
      } catch (err) {
        if (isMounted) {
          setError(
            err.message || "Impossibile caricare le richieste."
          );
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
  }, [departmentId, profile?.role]);

  async function handleBookingAction(requestId, action) {
    try {
      setProcessingRequestId(requestId);
      setError(null);
      setSuccess(null);

      if (action === "approve") {
        await approveBookingRequest(requestId);
      } else {
        await rejectBookingRequest(requestId);
      }

      setRequests((currentRequests) =>
        currentRequests.filter((request) => request.id !== requestId)
      );

      setSuccess(
        action === "approve"
          ? "Richiesta approvata con successo."
          : "Richiesta rifiutata con successo."
      );
    } catch (err) {
      setError(
        err.message || "Impossibile modificare la richiesta. Riprova."
      );
    } finally {
      setProcessingRequestId(null);
    }
  }

  return (
    <div className="ur-booking-container">
      <header className="ur-booking-header">
        <h1>Richieste di Prenotazione</h1>
        <p className="ur-booking-subtitle">
          Elenco delle richieste di prenotazione aule in attesa di revisione
          per il tuo dipartimento.
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

      {success && (
        <div className="ur-message ur-message-success" role="status">
          {success}
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

              <div className="ur-request-actions">
                <button
                  type="button"
                  className="ur-button ur-button-approve"
                  disabled={processingRequestId !== null}
                  onClick={() => handleBookingAction(request.id, "approve")}
                >
                  {processingRequestId === request.id
                    ? "Elaborazione..."
                    : "Approva"}
                </button>
                <button
                  type="button"
                  className="ur-button ur-button-reject"
                  disabled={processingRequestId !== null}
                  onClick={() => handleBookingAction(request.id, "reject")}
                >
                  {processingRequestId === request.id
                    ? "Elaborazione..."
                    : "Rifiuta"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
