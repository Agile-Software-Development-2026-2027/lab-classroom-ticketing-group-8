import { useState } from "react";
import { useAuth } from "../../contexts/useAuth";
import { createBookingRequest } from "../../services/bookingService";
import "./BookingRequestForm.css";

const CLASSROOMS = [
  { id: "MT1", name: "Aula MT1 (144 posti)" },
  { id: "MT23", name: "Aula MT23 (169 posti)" },
  { id: "MT4", name: "Aula MT4 (54 posti)" },
  { id: "MT5", name: "Aula MT5 (158 posti)" },
  { id: "MT5bis", name: "Aula MT5bis (94 posti)" },
  { id: "MT6", name: "Aula MT6 (72 posti)" },
  { id: "MTB", name: "Aula MTB (28 posti)" },
  { id: "MT13", name: "Aula MT13 (32 posti)" },
  { id: "MT14", name: "Aula MT14 (24 posti)" },
  { id: "MT15", name: "Aula MT15 (45 posti)" },
  { id: "A", name: "Aula A (126 posti)" },
  { id: "DEA", name: "Aula DEA (26 posti)" },
  { id: "Turing", name: "Aula Turing - ex MT10 (64 posti)" },
  { id: "Pitagora", name: "Aula Pitagora - ex MT11 (64 posti)" },
  { id: "Godel", name: "Aula Gödel - ex MT12 (32 posti)" },
  { id: "Collaborativa", name: "Aula Collaborativa (36 posti)" },
  { id: "LAB-30A", name: "Laboratorio LAB-30A (14 posti)" },
  { id: "LAB-31A", name: "Laboratorio LAB-31A (44 posti)" },
  { id: "LAB-31B", name: "Laboratorio LAB-31B (50 posti)" },
  { id: "LAB-16C", name: "Laboratorio LAB-16C (60 posti)" },
];

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

  // Stati per i campi del modulo
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [classroom, setClassroom] = useState("");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [selectedEquipment, setSelectedEquipment] = useState([]);

  // Stati per messaggi di errore, successo e caricamento
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

    try {
      setIsSubmitting(true);

      const bookingData = {
        date,
        startTime,
        endTime,
        classroom,
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
      setClassroom("");
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
    <div className="booking-form-container">
      <h2>Nuova Richiesta di Prenotazione</h2>

      {errorMessage && (
        <p className="feedback-error" role="alert">
          {errorMessage}
        </p>
      )}
      {successMessage && (
        <p className="feedback-success" role="status">
          {successMessage}
        </p>
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
            value={classroom}
            onChange={(e) => setClassroom(e.target.value)}
          >
            <option value="">-- Seleziona un'aula o laboratorio --</option>
            {CLASSROOMS.map((room) => (
              <option key={room.id} value={room.name}>
                {room.name}
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

        <button type="submit" className="submit-btn" disabled={isSubmitting}>
          {isSubmitting ? "Invio in corso..." : "Invia richiesta"}
        </button>
      </form>
    </div>
  );
}
