
import { useEffect, useState } from "react";
import { useAuth } from "../contexts/useAuth";
import { getAssignedDepartmentId } from "../services/userService";
import {
  getPendingBookingRequests,
  approveBookingRequest,
  rejectBookingRequest,
  isBookingOverlapping,
} from "../services/bookingService";
import "./BookingRequests.css";

export default function BookingRequests() {
  const { profile } = useAuth();
  const departmentId = getAssignedDepartmentId(profile);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingRequestId, setProcessingRequestId] = useState(null);
  const [requestToRejectId, setRequestToRejectId] = useState(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [rejectionError, setRejectionError] = useState(null);
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

  async function handleBookingAction(requestId, action, reason ) {
    try {
      setProcessingRequestId(requestId);
      setError(null);
      setRejectionError(null);
      setSuccess(null);

      if (action === "approve") {
        await approveBookingRequest(requestId);
      } else {
        await rejectBookingRequest(requestId, reason)
        setRequestToRejectId(null);
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
      const message =
        err.message || "Impossibile modificare la richiesta. Riprova.";

      if (action === "reject") {
        setRejectionError(message);
      } else {
        setError(message);
      }
    }finally {
      setProcessingRequestId(null);
    }
  }

  const conflictingRequestIds = new Set();
  for (let i = 0; i < requests.length; i++) {
    for (let j = i + 1; j < requests.length; j++) {
      if (isBookingOverlapping(requests[i], requests[j])) {
        conflictingRequestIds.add(requests[i].id);
        conflictingRequestIds.add(requests[j].id);
      }
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
                <div className="ur-badge-group">
                  {conflictingRequestIds.has(request.id) && (
                    <span className="ur-badge ur-badge-conflict">
                      Conflitto orario
                    </span>
                  )}
                  <span className="ur-badge ur-badge-pending">
                    In attesa
                  </span>
                </div>
              </div>

              {conflictingRequestIds.has(request.id) && (
                <div className="ur-conflict-notice" role="note">
                  Attenzione: questa richiesta si sovrappone a un'altra richiesta in attesa per la stessa aula.
                </div>
              )}

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
                  disabled={processingRequestId !== null || requestToRejectId === request.id}
                  onClick={() =>{
                    setRequestToRejectId(request.id);
                    setRejectionReason("");
                    setRejectionError(null);
                  }}
                >
                  {processingRequestId === request.id
                    ? "Elaborazione..."
                    : "Rifiuta"}
                </button>
              </div>

              {requestToRejectId === request.id && (
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    handleBookingAction(request.id, "reject", rejectionReason);
                  }}
                >
                  <fieldset disabled={processingRequestId !== null}>
                    <label>
                      Motivazione del rifiuto
                      <textarea
                        value={rejectionReason}
                        onChange={(event) => setRejectionReason(event.target.value)}
                        required
                      />
                    </label>

                    {rejectionError && < p className="ur-message ur-message-error" role="alert">{rejectionError}</p>}

                    <div className="ur-request-actions">
                      <button
                        type="button"
                        className="ur-button ur-button-cancel"
                        onClick={() => setRequestToRejectId(null)}
                      >
                        Annulla
                      </button>
                      <button type="submit" className="ur-button ur-button-reject">
                        Conferma rifiuto
                      </button>
                    </div>
                  </fieldset>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
