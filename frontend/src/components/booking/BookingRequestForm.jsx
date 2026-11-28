
import { useState } from "react";

import { useAuth } from "../../contexts/useAuth";
import { createBookingRequest } from "../../services/bookingService";
import useCalendarCatalog from "../../hooks/useCalendarCatalog";
import useDepartmentAccessRequests from "../../hooks/useDepartmentAccessRequests";
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

  const {
    requests: accessRequests,
    loading: accessLoading,
    error: accessError,
  } = useDepartmentAccessRequests(
    user,
    profile,
    departments
  );

  const assignedDepartmentId =
    getAssignedDepartmentId(profile);

  const [chosenDepartmentId, setChosenDepartmentId] =
    useState("");

  const [selectedClassroomId, setSelectedClassroomId] =
    useState("");

  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");

  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const minDate = getTomorrowDateString();

  // Solo APPROVED concede accesso aggiuntivo.
  const approvedDepartmentIds = new Set(
    accessRequests
      .filter((request) => request.status === "APPROVED")
      .map((request) => request.departmentId)
  );

  const visibleDepartments = departments.filter(
    (department) =>
      department.id === assignedDepartmentId ||
      approvedDepartmentIds.has(department.id)
  );

  // Story 29: il dipartimento principale è preselezionato.
  const selectedDepartmentId =
    visibleDepartments.some(
      (department) =>
        department.id === chosenDepartmentId
    )
      ? chosenDepartmentId
      : assignedDepartmentId;

  const departmentExists = visibleDepartments.some(
    (department) =>
      department.id === selectedDepartmentId
  );

  const availableClassrooms = classrooms.filter(
    (room) => room.departmentId === selectedDepartmentId
  );

  async function handleSubmit(event) {
    event.preventDefault();

    setErrorMessage("");
    setSuccessMessage("");

    if (!user || profile?.role !== "PROFESSOR") {
      setErrorMessage(
        "Devi essere autenticato come professore."
      );
      return;
    }

    if (!assignedDepartmentId) {
      setErrorMessage(
        "Dipartimento non assegnato al professore."
      );
      return;
    }

    if (!departmentExists) {
      setErrorMessage(
        "Dipartimento non disponibile."
      );
      return;
    }

    if (!selectedClassroomId) {
      setErrorMessage(
        "Seleziona un'aula o laboratorio."
      );
      return;
    }

    if (
      !availableClassrooms.some(
        (room) => room.id === selectedClassroomId
      )
    ) {
      setErrorMessage(
        "L'aula non appartiene al dipartimento selezionato."
      );
      return;
    }

    try {
      setIsSubmitting(true);

      const professorName =
        profile?.displayName ||
        user.displayName ||
        user.email ||
        "Docente";

      await createBookingRequest({
        departmentId: selectedDepartmentId,
        classroomId: selectedClassroomId,
        date,
        startTime,
        endTime,
        professorId: user.uid,
        professorName,
      });

      setSuccessMessage(
        "Richiesta di prenotazione inviata con successo!"
      );

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
          Compila il modulo per richiedere
          l'assegnazione di un'aula o laboratorio didattico.
        </p>
      </div>

      {catalogError && (
        <div className="feedback-error" role="alert">
          {catalogError}
        </div>
      )}

      {accessError && (
        <div className="feedback-error" role="alert">
          Impossibile verificare gli accessi aggiuntivi.
          Il dipartimento principale resta disponibile.
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

      <form
        onSubmit={handleSubmit}
        className="booking-form"
      >
        <div className="form-group">
          <label htmlFor="department">
            Dipartimento *
          </label>

          <select
            id="department"
            required
            value={selectedDepartmentId}
            disabled={
              catalogLoading ||
              accessLoading ||
              visibleDepartments.length <= 1
            }
            onChange={(event) => {
              setChosenDepartmentId(event.target.value);
              setSelectedClassroomId("");
            }}
          >
            <option value="">
              {catalogLoading
                ? "-- Caricamento dipartimento... --"
                : "-- Dipartimento non assegnato --"}
            </option>

            {visibleDepartments.map((department) => (
              <option
                key={department.id}
                value={department.id}
              >
                {department.name}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="classroom">
            Aula / Laboratorio *
          </label>

          <select
            id="classroom"
            required
            value={
              availableClassrooms.some(
                (room) => room.id === selectedClassroomId
              )
                ? selectedClassroomId
                : ""
            }
            disabled={
              catalogLoading ||
              accessLoading ||
              !selectedDepartmentId ||
              !departmentExists
            }
            onChange={(event) =>
              setSelectedClassroomId(event.target.value)
            }
          >
            <option value="">
              {!selectedDepartmentId
                ? "-- Dipartimento non assegnato --"
                : catalogLoading || accessLoading
                  ? "-- Caricamento aule... --"
                  : availableClassrooms.length === 0
                    ? "-- Nessuna aula disponibile --"
                    : "-- Seleziona un'aula o laboratorio --"}
            </option>

            {availableClassrooms.map((room) => (
              <option key={room.id} value={room.id}>
                {room.name}
                {room.cubo
                  ? ` (Cubo ${room.cubo})`
                  : ""}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="date">
            Giorno * (minimo 1 giorno di preavviso)
          </label>

          <input
            id="date"
            type="date"
            min={minDate}
            required
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="startTime">
              Ora inizio *
            </label>

            <input
              id="startTime"
              type="time"
              required
              value={startTime}
              onChange={(event) =>
                setStartTime(event.target.value)
              }
            />
          </div>

          <div className="form-group">
            <label htmlFor="endTime">
              Ora fine *
            </label>

            <input
              id="endTime"
              type="time"
              required
              value={endTime}
              onChange={(event) =>
                setEndTime(event.target.value)
              }
            />
          </div>
        </div>

        <button
          type="submit"
          className="submit-btn"
          disabled={
            isSubmitting ||
            catalogLoading ||
            accessLoading ||
            !departmentExists
          }
        >
          {isSubmitting
            ? "Invio in corso..."
            : "Invia richiesta"}
        </button>
      </form>
    </div>
  );
}
