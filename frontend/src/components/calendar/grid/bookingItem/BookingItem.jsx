import "./BookingItem.css";
export default function BookingItem({ booking }) {
return (
    <li className="calendar-booking">
        <h4>{booking.classroomName}</h4>
        <p>{booking.departmentName}{booking.cubo ? " · Cubo " + booking.cubo : ""}</p>
        <p>Professore: {booking.professorName}</p>
        <p>
            <time dateTime={booking.date}>{booking.date.split("-").reverse().join("/")}</time>
            {" · "}{booking.startsAt}–{booking.endsAt}
        </p>
        <p className="calendar-booking-status">Aula occupata in questa fascia oraria</p>
    </li>
);
}