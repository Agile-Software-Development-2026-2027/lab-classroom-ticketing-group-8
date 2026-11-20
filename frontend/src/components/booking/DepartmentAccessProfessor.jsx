import { useState } from "react";
import { useAuth } from "../../contexts/useAuth";
import useCalendarCatalog from "../../hooks/useCalendarCatalog";
import useDepartmentAccessRequests from "../../hooks/useDepartmentAccessRequests";
import { getAssignedDepartmentId } from "../../services/userService";
import { createDepartmentAccessRequest } from "../../services/departmentAccessService";
import "./DepartmentAccess.css";

const STATUS_LABELS = {
    PENDING: "In attesa",
    APPROVED: "Approvata",
    REJECTED: "Rifiutata",
};

export default function DepartmentAccessProfessor() {
    const { user, profile } = useAuth();

    const {
        departments,
        loading: catalogLoading,
        error: catalogError,
    } = useCalendarCatalog();

    const {
        requests,
        loading: requestsLoading,
        error: requestsError,
    } = useDepartmentAccessRequests(user, profile, departments);

    const primaryDepartmentId = getAssignedDepartmentId(profile);

    const [departmentId, setDepartmentId] = useState("");
    const [sending, setSending] = useState(false);
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");

    // Impedisce la selezione di dipartimenti per cui esiste già una richiesta pendente o approvata
    const alreadyRequested = new Set(
        requests.map((request) => request.departmentId)
    );

    const availableDepartments = departments.filter(
        (dept) =>
            dept.id !== primaryDepartmentId && !alreadyRequested.has(dept.id)
    );

    async function handleRequest(event) {
        event.preventDefault();

        setMessage("");
        setError("");

        if (!user || profile?.role !== "PROFESSOR") {
            setError("Devi essere autenticato come professore.");
            return;
        }

        if (!departmentId || !primaryDepartmentId) {
            setError("Seleziona un dipartimento valido.");
            return;
        }

        if (!availableDepartments.some((dept) => dept.id === departmentId)) {
            setError("Dipartimento non disponibile.");
            return;
        }

        try {
            setSending(true);

            await createDepartmentAccessRequest({
                professorId: user.uid,
                departmentId,
                professorName: profile?.displayName || "Docente",
            });

            setDepartmentId("");
            setMessage("Richiesta inviata con successo. È in attesa di approvazione.");
        } catch (err) {
            setError(err.message || "Impossibile inviare la richiesta.");
        } finally {
            setSending(false);
        }
    }

    return (
        <section className="ur-dept-access-section" aria-labelledby="dept-access-title">
            <header className="ur-dept-access-header">
                <h2 id="dept-access-title">Accesso ad altri dipartimenti</h2>
                <p className="ur-dept-access-subtitle">
                    Puoi richiedere l'accesso a dipartimenti aggiuntivi per poter prenotare le loro aule
                    una volta autorizzato. L'invio della richiesta la imposta nello stato &ldquo;In attesa&rdquo; e non modifica i tuoi permessi di prenotazione attuali.
                </p>
            </header>

            {catalogError && (
                <div className="ur-dept-message-error" role="alert">
                    {catalogError}
                </div>
            )}

            {requestsError && (
                <div className="ur-dept-message-error" role="alert">
                    {requestsError}
                </div>
            )}

            {error && (
                <div className="ur-dept-message-error" role="alert">
                    {error}
                </div>
            )}

            {message && (
                <div className="ur-dept-message-success" role="status">
                    {message}
                </div>
            )}

            <form className="ur-dept-form" onSubmit={handleRequest}>
                <div className="ur-dept-field">
                    <label htmlFor="access-department">
                        Dipartimento aggiuntivo
                    </label>
                    <select
                        id="access-department"
                        className="ur-dept-select"
                        value={departmentId}
                        onChange={(event) => setDepartmentId(event.target.value)}
                        disabled={
                            sending ||
                            catalogLoading ||
                            requestsLoading
                        }
                    >
                        <option value="">-- Seleziona un dipartimento --</option>
                        {availableDepartments.map((dept) => (
                            <option key={dept.id} value={dept.id}>
                                {dept.name}
                            </option>
                        ))}
                    </select>
                </div>

                <button
                    type="submit"
                    className="ur-dept-submit-btn"
                    disabled={
                        sending ||
                        catalogLoading ||
                        requestsLoading ||
                        !departmentId
                    }
                >
                    {sending ? "Invio in corso..." : "Richiedi accesso"}
                </button>
            </form>

            <h3 className="ur-dept-list-title">Le mie richieste di accesso</h3>

            {requestsLoading ? (
                <div className="ur-dept-loading">
                    <div className="ur-dept-spinner" />
                    <span>Caricamento delle tue richieste...</span>
                </div>
            ) : requests.length === 0 ? (
                <p className="ur-dept-empty">
                    Non hai ancora inviato richieste di accesso ad altri dipartimenti.
                </p>
            ) : (
                <ul className="ur-dept-list">
                    {requests.map((request) => {
                        const department = departments.find(
                            (dept) => dept.id === request.departmentId
                        );
                        const statusClass = (request.status || "pending").toLowerCase();

                        return (
                            <li key={request.id} className="ur-dept-item">
                                <div className="ur-dept-item-info">
                                    <span className="ur-dept-item-name">
                                        {department?.name ?? request.departmentId}
                                    </span>
                                    <span className="ur-dept-item-sub">
                                        ID Dipartimento: {request.departmentId}
                                    </span>
                                </div>
                                <span className={`ur-dept-badge ${statusClass}`}>
                                    {STATUS_LABELS[request.status] ?? request.status}
                                </span>
                            </li>
                        );
                    })}
                </ul>
            )}
        </section>
    );
}
