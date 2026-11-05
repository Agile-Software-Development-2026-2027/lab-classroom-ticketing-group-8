
import { useState } from "react";
import { useAuth } from "../../contexts/useAuth";
import { createBookingRequest } from "../../services/bookingService";
import useCalendarCatalog from "../../hooks/useCalendarCatalog";
import { getAssignedDepartmentId } from "../../services/userService";
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
  const assignedDepartmentId = getAssignedDepartmentId(profile);
  const [selectedClassroomId, setSelectedClassroomId] = useState("");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const minDate = getTomorrowDateString();
  const visibleDepartments = departments.filter(
    (dept) => dept.id === assignedDepartmentId
  );
  const departmentExists = visibleDepartments.length > 0;
  const availableClassrooms = classrooms.filter(
    (room) => room.departmentId === assignedDepartmentId
  );
  async function handleSubmit(event) {
    event.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");
    if (!user) {
      setErrorMessage("Devi essere autenticato come professore.");
      return;
    }
    if (profile?.role !== "PROFESSOR" || !assignedDepartmentId) {
      setErrorMessage("Dipartimento non assegnato al professore.");
      return;
    }
    if (!departmentExists) {
      setErrorMessage("Dipartimento assegnato non disponibile.");
      return;
    }
    if (!selectedClassroomId) {
      setErrorMessage("Seleziona un'aula o laboratorio.");
      return;
    }
    if (!availableClassrooms.some((room) => room.id === selectedClassroomId)) {
      setErrorMessage("L'aula non appartiene al tuo dipartimento.");
      return;
    }
    try {
      setIsSubmitting(true);
      const professorName =
        profile?.displayName ||
        user.displayName ||
        user.email ||
        "Docente";
      const bookingData = {
        departmentId: assignedDepartmentId,
        classroomId: selectedClassroomId,
        date,
        startTime,
        endTime,
        professorId: user.uid,
        professorName,
      };
      await createBookingRequest(bookingData);
      setSuccessMessage("Richiesta di prenotazione inviata con successo!");
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
          <select id="department" required value={assignedDepartmentId} disabled>
            <option value="">
              {catalogLoading
                ? "-- Caricamento dipartimento... --"
                : "-- Dipartimento non assegnato --"}
            </option>
            {visibleDepartments.map((dept) => (
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
            disabled={catalogLoading || !assignedDepartmentId || !departmentExists}
            onChange={(e) => setSelectedClassroomId(e.target.value)}
          >
            <option value="">
              {!assignedDepartmentId
                ? "-- Dipartimento non assegnato --"
                : catalogLoading
                ? "-- Caricamento aule... --"
                : availableClassrooms.length === 0
                ? "-- Nessuna aula disponibile --"
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
          disabled={
            isSubmitting ||
            catalogLoading ||
            !assignedDepartmentId ||
            !departmentExists
          }
        >
          {isSubmitting ? "Invio in corso..." : "Invia richiesta"}
        </button>
      </form>
    </div>
  );
}
