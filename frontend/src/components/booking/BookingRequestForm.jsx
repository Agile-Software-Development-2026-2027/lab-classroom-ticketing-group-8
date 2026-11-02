import { useState } from "react";
import { useAuth } from "../../contexts/useAuth";
import { createBookingRequest } from "../../services/bookingService";
import useCalendarCatalog from "../../hooks/useCalendarCatalog";
import "./BookingRequestForm.css";

function getTomorrowDateString() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow.toISOString().split("T")[0];
}

export default function BookingRequestForm() {
  const { user, profile } = useAuth();
  const {
    departments,
    classrooms,
    loading: catalogLoading,
    error: catalogError,
  } = useCalendarCatalog();

  // Stati per i campi del modulo
  const [selectedDepartmentId, setSelectedDepartmentId] = useState("");
  const [selectedClassroomId, setSelectedClassroomId] = useState("");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");

  // Stati per messaggi di feedback e caricamento
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const minDate = getTomorrowDateString();

  // Filtra le aule appartenenti al dipartimento selezionato
  const availableClassrooms = selectedDepartmentId
    ? classrooms.filter((room) => room.departmentId === selectedDepartmentId)
    : [];

  async function handleSubmit(event) {
    event.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    if (!user) {
      setErrorMessage("Devi essere autenticato come professore.");
      return;
    }

    if (!selectedDepartmentId) {
      setErrorMessage("Seleziona un dipartimento.");
      return;
    }

    if (!selectedClassroomId) {
      setErrorMessage("Seleziona un'aula o laboratorio.");
      return;
    }

    try {
      setIsSubmitting(true);

      // professorName ricavato automaticamente dalla sessione/profilo collegato
      const professorName =
        profile?.displayName || user.displayName || user.email || "Docente";

      const bookingData = {
        departmentId: selectedDepartmentId,
        classroomId: selectedClassroomId,
        date,
        startTime,
        endTime,
        professorId: user.uid,
        professorName,
      };

      await createBookingRequest(bookingData);

      setSuccessMessage("Richiesta di prenotazione inviata con successo!");
      setSelectedDepartmentId("");
      setSelectedClassroomId("");
      setDate("");
      setStartTime("");
      setEndTime("");
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="ur-booking-form-card">
      <div className="ur-form-header">
        <h2>Nuova Richiesta di Prenotazione</h2>
        <p className="ur-form-subtitle">
          Compila il modulo per richiedere l'assegnazione di un'aula o laboratorio didattico.
        </p>
      </div>

      {catalogError && (
        <div className="feedback-error" role="alert">
          {catalogError}
        </div>
      )}

      {errorMessage && (
        <div className="feedback-error" role="alert">
          {errorMessage}
        </div>
      )}

      {successMessage && (
        <div className="feedback-success" role="status">
          {successMessage}
        </div>
      )}

      <form onSubmit={handleSubmit} className="booking-form">
        <div className="form-group">
          <label htmlFor="department">Dipartimento *</label>
          <select
            id="department"
            required
            value={selectedDepartmentId}
            disabled={catalogLoading}
            onChange={(e) => {
              setSelectedDepartmentId(e.target.value);
              setSelectedClassroomId("");
            }}
          >
            <option value="">
              {catalogLoading
                ? "-- Caricamento dipartimenti... --"
                : "-- Seleziona un dipartimento --"}
            </option>
            {departments.map((dept) => (
              <option key={dept.id} value={dept.id}>
                {dept.name}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="classroom">Aula / Laboratorio *</label>
          <select
            id="classroom"
            required
            value={selectedClassroomId}
            disabled={catalogLoading || !selectedDepartmentId}
            onChange={(e) => setSelectedClassroomId(e.target.value)}
          >
            <option value="">
              {!selectedDepartmentId
                ? "-- Seleziona prima un dipartimento --"
                : catalogLoading
                ? "-- Caricamento aule... --"
                : availableClassrooms.length === 0
                ? "-- Nessuna aula disponibile per questo dipartimento --"
                : "-- Seleziona un'aula o laboratorio --"}
            </option>
            {availableClassrooms.map((room) => (
              <option key={room.id} value={room.id}>
                {room.name} {room.cubo ? `(Cubo ${room.cubo})` : ""}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="date">Giorno * (minimo 1 giorno di preavviso)</label>
          <input
            id="date"
            type="date"
            min={minDate}
            required
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="startTime">Ora inizio *</label>
            <input
              id="startTime"
              type="time"
              required
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label htmlFor="endTime">Ora fine *</label>
            <input
              id="endTime"
              type="time"
              required
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
            />
          </div>
        </div>

        <button
          type="submit"
          className="submit-btn"
          disabled={isSubmitting || catalogLoading}
        >
          {isSubmitting ? "Invio in corso..." : "Invia richiesta"}
        </button>
      </form>
    </div>
  );
}
