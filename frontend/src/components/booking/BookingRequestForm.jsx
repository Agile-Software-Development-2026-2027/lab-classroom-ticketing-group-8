import { useState } from "react";
import { useAuth } from "../../contexts/useAuth";
import { createBookingRequest } from "../../services/bookingService";
import useCalendarCatalog from "../../hooks/useCalendarCatalog";
import "./BookingRequestForm.css";

const AVAILABLE_EQUIPMENT = [
  "Computer d'aula",
  "Amplificazione audio",
  "Videoproiettore / Presentazione",
  "Connessione per gli ospiti",
  "Videoconferenza",
  "Lavagna in ardesia",
  "Tavoletta grafica",
  "Puntatore laser",
];

function getTomorrowDateString() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow.toISOString().split("T")[0];
}

export default function BookingRequestForm() {
  const { user, profile } = useAuth();
  const { classrooms, loading: catalogLoading, error: catalogError } = useCalendarCatalog();

  // Stati per i campi del modulo
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [selectedClassroomId, setSelectedClassroomId] = useState("");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [selectedEquipment, setSelectedEquipment] = useState([]);

  // Stati per messaggi di feedback e caricamento
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const minDate = getTomorrowDateString();

  function handleEquipmentToggle(item) {
    setSelectedEquipment((prev) =>
      prev.includes(item) ? prev.filter((i) => i !== item) : [...prev, item]
    );
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    if (!user) {
      setErrorMessage("Devi essere autenticato come professore.");
      return;
    }

    if (!selectedClassroomId) {
      setErrorMessage("Seleziona un'aula o laboratorio.");
      return;
    }

    // Trova l'aula selezionata per ricavarne il dipartimento
    const selectedRoom = classrooms.find((room) => room.id === selectedClassroomId);
    const departmentId = selectedRoom?.departmentId || "demacs";

    try {
      setIsSubmitting(true);

      const bookingData = {
        date,
        startTime,
        endTime,
        classroomId: selectedClassroomId,
        departmentId,
        subject: subject || "Prenotazione aula e laboratori",
        description,
        equipment: selectedEquipment,
        professorId: user.uid,
        professorName: profile?.displayName || user.email || "Docente",
      };

      await createBookingRequest(bookingData);

      setSuccessMessage("Richiesta di prenotazione inviata con successo!");
      setDate("");
      setStartTime("");
      setEndTime("");
      setSelectedClassroomId("");
      setSubject("");
      setDescription("");
      setSelectedEquipment([]);
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
          <label htmlFor="subject">Oggetto Richiesta</label>
          <input
            id="subject"
            type="text"
            placeholder="es. Prenotazione aule e laboratori"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          />
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

        <div className="form-group">
          <label htmlFor="classroom">Aula / Laboratorio *</label>
          <select
            id="classroom"
            required
            value={selectedClassroomId}
            disabled={catalogLoading}
            onChange={(e) => setSelectedClassroomId(e.target.value)}
          >
            <option value="">
              {catalogLoading
                ? "-- Caricamento aule dal database... --"
                : "-- Seleziona un'aula o laboratorio --"}
            </option>
            {classrooms.map((room) => (
              <option key={room.id} value={room.id}>
                {room.name} {room.cubo ? `(Cubo ${room.cubo})` : ""}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label>Attrezzature richieste</label>
          <div className="equipment-grid">
            {AVAILABLE_EQUIPMENT.map((item) => (
              <label key={item} className="equipment-checkbox-label">
                <input
                  type="checkbox"
                  checked={selectedEquipment.includes(item)}
                  onChange={() => handleEquipmentToggle(item)}
                />
                <span>{item}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="description">Note all'evento / Richieste particolari</label>
          <textarea
            id="description"
            rows="3"
            placeholder="Indicare eventuali richieste straordinarie o note per il personale..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <button type="submit" className="submit-btn" disabled={isSubmitting || catalogLoading}>
          {isSubmitting ? "Invio in corso..." : "Invia richiesta"}
        </button>
      </form>
    </div>
  );
}
