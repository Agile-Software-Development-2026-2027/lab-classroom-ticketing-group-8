
import { useEffect, useState } from "react";
import { useAuth } from "../contexts/useAuth";
import { getAssignedDepartmentId } from "../services/userService";
import {
  getPendingBookingRequests,
  getDepartmentBookingRequests,
  approveBookingRequest,
  rejectBookingRequest,
  isBookingOverlapping,
} from "../services/bookingService";
import "./BookingRequests.css";

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

const FILTER_OPTIONS = [
  { id: "PENDING", label: "Richieste in attesa" },
  { id: "ALL", label: "Tutte le richieste" },
  { id: "APPROVED", label: "Approvate" },
  { id: "REJECTED", label: "Rifiutate" },
];

export default function BookingRequests() {
  const { profile } = useAuth();
  const departmentId = getAssignedDepartmentId(profile);
  const [requests, setRequests] = useState([]);
  const [statusFilter, setStatusFilter] = useState("PENDING");
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

        let data;
        if (statusFilter === "PENDING" && typeof getPendingBookingRequests === "function") {
          data = await getPendingBookingRequests(departmentId);
        } else if (typeof getDepartmentBookingRequests === "function") {
          data = await getDepartmentBookingRequests(departmentId, statusFilter);
        } else {
          data = [];
        }

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
  }, [departmentId, profile?.role, statusFilter]);

  async function handleBookingAction(requestId, action, reason ) {
    try {
      setProcessingRequestId(requestId);
      setError(null);
      setRejectionError(null);
      setSuccess(null);

      if (action === "approve") {
        await approveBookingRequest(requestId);
      } else {
        await rejectBookingRequest(requestId, reason);
        setRequestToRejectId(null);
      }

      setRequests((currentRequests) =>
        statusFilter === "PENDING"
          ? currentRequests.filter((request) => request.id !== requestId)
          : currentRequests.map((request) =>
              request.id === requestId
                ? {
                    ...request,
                    status: action === "approve" ? "APPROVED" : "REJECTED",
                    ...(action === "reject" ? { rejectionReason: reason } : {}),
                  }
                : request
            )
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
  const pendingRequests = requests.filter((r) => r.status === "PENDING");
  for (let i = 0; i < pendingRequests.length; i++) {
    for (let j = i + 1; j < pendingRequests.length; j++) {
      if (isBookingOverlapping(pendingRequests[i], pendingRequests[j])) {
        conflictingRequestIds.add(pendingRequests[i].id);
        conflictingRequestIds.add(pendingRequests[j].id);
      }
    }
  }

  return (
    <div className="ur-booking-container">
      <header className="ur-booking-header">
        <h1>Richieste di Prenotazione</h1>
        <p className="ur-booking-subtitle">
          Elenco delle richieste di prenotazione aule per il tuo dipartimento.
        </p>
      </header>

      <div className="ur-filter-tabs" role="tablist" aria-label="Filtra richieste per stato">
        {FILTER_OPTIONS.map((filter) => (
          <button
            key={filter.id}
            type="button"
            role="tab"
            aria-selected={statusFilter === filter.id}
            className={`ur-filter-tab ${statusFilter === filter.id ? "active" : ""}`}
            onClick={() => {
              setStatusFilter(filter.id);
              setError(null);
              setSuccess(null);
              setRequestToRejectId(null);
            }}
          >
            {filter.label}
          </button>
        ))}
      </div>

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
          <p>
            {statusFilter === "PENDING"
              ? "Nessuna richiesta di prenotazione in attesa."
              : statusFilter === "APPROVED"
              ? "Nessuna richiesta di prenotazione approvata."
              : statusFilter === "REJECTED"
              ? "Nessuna richiesta di prenotazione rifiutata."
              : "Nessuna richiesta di prenotazione trovata."}
          </p>
        </div>
      )}

      {!loading && !error && requests.length > 0 && (
        <ul
          className="ur-requests-list"
          aria-label={statusFilter === "PENDING" ? "Elenco richieste pendenti" : "Elenco richieste di prenotazione"}
        >
          {requests.map((request) => {
            const isPending = request.status === "PENDING";
            const statusKey = request.status?.toUpperCase() || "PENDING";
            const statusLabel = STATUS_LABELS[statusKey] || request.status;
            const badgeClass = STATUS_CLASSES[statusKey] || "ur-badge-pending";

            return (
              <li key={request.id} className="ur-request-card">
                <div className="ur-request-card-header">
                  <span className="ur-request-classroom">
                    {request.classroom}
                  </span>
                  <div className="ur-badge-group">
                    {isPending && conflictingRequestIds.has(request.id) && (
                      <span className="ur-badge ur-badge-conflict">
                        Conflitto orario
                      </span>
                    )}
                    <span className={`ur-badge ${badgeClass}`}>
                      {statusLabel}
                    </span>
                  </div>
                </div>

                {isPending && conflictingRequestIds.has(request.id) && (
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
                  {request.status === "REJECTED" && request.rejectionReason && (
                    <div className="ur-detail-row ur-rejection-detail">
                      <span className="ur-detail-label">Motivazione rifiuto:</span>
                      <span className="ur-detail-value ur-rejection-text">
                        {request.rejectionReason}
                      </span>
                    </div>
                  )}
                </div>

                {isPending && (
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
                      onClick={() => {
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
                )}

                {requestToRejectId === request.id && (
                  <form
                    className="ur-rejection-form"
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
                          onChange={(event) => {
                            setRejectionReason(event.target.value);
                            setRejectionError(null);
                          }}
                          maxLength={500}
                          aria-describedby={`rejection-counter-${request.id}`}
                          required
                        />
                      </label>

                      <p
                        id={`rejection-counter-${request.id}`}
                        className="ur-rejection-counter"
                      >
                        {rejectionReason.length}/500 caratteri
                      </p>

                      {rejectionError && (
                        <p className="ur-message ur-message-error" role="alert">
                          {rejectionError}
                        </p>
                      )}

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
            );
          })}
        </ul>
      )}
    </div>
  );
}
