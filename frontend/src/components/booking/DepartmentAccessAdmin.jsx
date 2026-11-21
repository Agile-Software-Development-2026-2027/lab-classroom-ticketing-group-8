
import { useEffect, useState } from "react";

import { useAuth } from "../../contexts/useAuth";
import { getAssignedDepartmentId } from "../../services/userService";

import {
    watchAdminAccessRequests,
    decideDepartmentAccessRequest,
} from "../../services/departmentAccessService";

import "./DepartmentAccess.css";

export default function DepartmentAccessAdmin() {
    const { profile } = useAuth();
    const departmentId = getAssignedDepartmentId(profile);

    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [processingId, setProcessingId] = useState(null);
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");

    useEffect(() => {
        if (profile?.role !== "ADMIN" || !departmentId) {
            return;
        }

        const unsubscribe = watchAdminAccessRequests(
            departmentId,
            (data) => {
                setRequests(data);
                setLoading(false);
                setError("");
            },
            (err) => {
                setError(
                    err.message || "Impossibile caricare le richieste."
                );
                setLoading(false);
            }
        );

        return unsubscribe;
    }, [profile?.role, departmentId]);

    async function handleDecision(requestId, decision) {
        setError("");
        setMessage("");
        setProcessingId(requestId);

        try {
            await decideDepartmentAccessRequest(
                requestId,
                departmentId,
                decision
            );

            setMessage(
                decision === "APPROVED"
                    ? "Accesso approvato con successo."
                    : "Richiesta rifiutata con successo."
            );
        } catch (err) {
            setError(
                err.message || "Impossibile gestire la richiesta."
            );
        } finally {
            setProcessingId(null);
        }
    }

    if (profile?.role !== "ADMIN") {
        return null;
    }

    return (
        <section
            className="ur-dept-access-section"
            aria-labelledby="admin-dept-access-title"
        >
            <header className="ur-dept-access-header">
                <h2 id="admin-dept-access-title">
                    Richieste di accesso al dipartimento
                </h2>

                <p className="ur-dept-access-subtitle">
                    Gestisci le richieste dei professori che
                    desiderano accedere al tuo dipartimento.
                </p>
            </header>

            {!departmentId && (
                <p className="ur-dept-message-error" role="alert">
                    Dipartimento amministratore non assegnato.
                </p>
            )}

            {error && (
                <p className="ur-dept-message-error" role="alert">
                    {error}
                </p>
            )}

            {message && (
                <p className="ur-dept-message-success" role="status">
                    {message}
                </p>
            )}

            {departmentId && loading && (
                <p className="ur-dept-loading">
                    Caricamento richieste di accesso...
                </p>
            )}

            {departmentId &&
                !loading &&
                !error &&
                requests.length === 0 && (
                    <p className="ur-dept-empty">
                        Nessuna richiesta di accesso in attesa.
                    </p>
                )}

            {departmentId && !loading && requests.length > 0 && (
                <ul className="ur-dept-list">
                    {requests.map((request) => (
                        <li
                            key={request.id}
                            className="ur-dept-item"
                        >
                            <div className="ur-dept-item-info">
                                <strong className="ur-dept-item-name">
                                    {request.professorName}
                                </strong>

                                <span className="ur-dept-item-sub">
                                    Matricola: {request.universityId}
                                </span>

                                <span className="ur-dept-badge pending">
                                    In attesa
                                </span>
                            </div>

                            <div className="ur-dept-actions">
                                <button
                                    type="button"
                                    className="ur-dept-btn-approve"
                                    disabled={processingId !== null}
                                    onClick={() =>
                                        handleDecision(
                                            request.id,
                                            "APPROVED"
                                        )
                                    }
                                >
                                    {processingId === request.id
                                        ? "Elaborazione..."
                                        : "Approva accesso"}
                                </button>

                                <button
                                    type="button"
                                    className="ur-dept-btn-reject"
                                    disabled={processingId !== null}
                                    onClick={() =>
                                        handleDecision(
                                            request.id,
                                            "REJECTED"
                                        )
                                    }
                                >
                                    Rifiuta accesso
                                </button>
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}
