import { useEffect, useState } from "react";
import { useAuth } from "../../contexts/useAuth";
import {
  getProfessorBookingRequests,
  cancelBookingRequest,
  isFutureBooking,
} from "../../services/bookingService";
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
  const [confirmingCancelId, setConfirmingCancelId] = useState(null);
  const [processingCancelId, setProcessingCancelId] = useState(null);
  const [cancelFeedback, setCancelFeedback] = useState(null);

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

  async function handleConfirmCancel(requestId) {
    try {
      setProcessingCancelId(requestId);
      setCancelFeedback(null);
      await cancelBookingRequest(requestId, user?.uid);
      setRequests((prev) => prev.filter((r) => r.id !== requestId));
      setConfirmingCancelId(null);
      setCancelFeedback({
        type: "success",
        message: "Richiesta di prenotazione cancellata con successo.",
      });
    } catch (err) {
      setCancelFeedback({
        type: "error",
        message:
          err.message || "Impossibile cancellare la richiesta di prenotazione.",
      });
    } finally {
      setProcessingCancelId(null);
    }
  }

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

      {cancelFeedback && (
        <div
          className={`ur-message ${
            cancelFeedback.type === "success"
              ? "ur-message-success"
              : "ur-message-error"
          }`}
          role="alert"
        >
          {cancelFeedback.message}
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
            const canCancel =
              (statusKey === "PENDING" || statusKey === "APPROVED") &&
              isFutureBooking(request);

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

                  {statusKey === "REJECTED" && (
                    <div className="ur-detail-row ur-rejection-detail">
                      <span className="ur-detail-label">
                        Motivazione rifiuto:
                      </span>

                      <span
                        className="ur-detail-value ur-rejection-text"
                        tabIndex={0}
                      >
                        {request.reason}
                      </span>
                    </div>
                  )}
                </div>

                {canCancel && (
                  <div className="ur-cancel-section">
                    {confirmingCancelId === request.id ? (
                      <div
                        className="ur-cancel-confirm-box"
                        role="alertdialog"
                        aria-labelledby={`confirm-title-${request.id}`}
                      >
                        <p
                          id={`confirm-title-${request.id}`}
                          className="ur-cancel-confirm-text"
                        >
                          Sei sicuro di voler cancellare questa richiesta di prenotazione? (Sì / No)
                        </p>
                        <div className="ur-cancel-confirm-actions">
                          <button
                            type="button"
                            className="ur-btn-confirm-delete"
                            disabled={processingCancelId === request.id}
                            onClick={() => handleConfirmCancel(request.id)}
                          >
                            {processingCancelId === request.id
                              ? "Cancellazione..."
                              : "Sì"}
                          </button>
                          <button
                            type="button"
                            className="ur-btn-dismiss-cancel"
                            disabled={processingCancelId === request.id}
                            onClick={() => {
                              setConfirmingCancelId(null);
                              setCancelFeedback(null);
                            }}
                          >
                            No
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="ur-btn-cancel-request"
                        disabled={processingCancelId !== null}
                        onClick={() => {
                          setConfirmingCancelId(request.id);
                          setCancelFeedback(null);
                        }}
                      >
                        Cancella prenotazione
                      </button>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

