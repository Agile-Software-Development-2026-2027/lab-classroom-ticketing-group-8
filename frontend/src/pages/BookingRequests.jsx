import { useState } from "react";

const mockRequests = [
  {
    id: "1",
    classroom: "Aula MT11",
    professorName: "Mario Rossi",
    professorUniversityId: "123456",
    date: "30/10/2026",
    startTime: "09:00",
    endTime: "11:00",
    status: "PENDING",
  },
  {
    id: "2",
    classroom: "Aula MT5",
    professorName: "Mario Bianchi",
    professorUniversityId: "654321",
    date: "31/10/2026",
    startTime: "14:00",
    endTime: "16:00",
    status: "PENDING",
  },
];

export default function BookingRequests() {
  const [requests] = useState(mockRequests);

  return (
    <div className="ur-booking-container">
      <header className="ur-booking-header">
        <h1>Richieste di Prenotazione</h1>
        <p className="ur-booking-subtitle">
          Elenco delle richieste di prenotazione aule in attesa di revisione.
        </p>
      </header>

      {requests.length === 0 ? (
        <div className="ur-empty-state">
          <p>Nessuna richiesta di prenotazione in attesa.</p>
        </div>
      ) : (
        <ul className="ur-requests-list" aria-label="Elenco richieste pendenti">
          {requests.map((request) => (
            <li key={request.id} className="ur-request-card">
              <div className="ur-request-card-header">
                <span className="ur-request-classroom">
                  {request.classroom}
                </span>
                <span className="ur-badge ur-badge-pending">
                  In attesa
                </span>
              </div>

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
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}