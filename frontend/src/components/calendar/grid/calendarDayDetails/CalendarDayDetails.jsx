import { useEffect, useRef } from "react";
import BookingItem from "../bookingItem/BookingItem";
import "./CalendarDayDetails.css";
export default function CalendarDayDetails({ day, bookings, message, onClose }) {
  const panelRef = useRef(null);
  useEffect(() => { panelRef.current?.focus(); }, [day.dateKey]);
  const label = day.date.toLocaleDateString("it-IT", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
  return (
    <section ref={panelRef} tabIndex={-1} className="calendar-day-details"
      aria-label={"Prenotazioni del " + label}>
      <div className="calendar-details-heading">
        <h3>{label}</h3>
        <button type="button" onClick={onClose}>Chiudi dettaglio</button>
      </div>
      {message ? <p>{message}</p> : bookings.length === 0 ? (
        <p>Nessuna prenotazione per questo giorno.</p>
      ) : (
        <ol className="calendar-booking-list">
          {bookings.map((booking) => <BookingItem key={booking.id} booking={booking} />)}
        </ol>
      )}
    </section>
  );
}