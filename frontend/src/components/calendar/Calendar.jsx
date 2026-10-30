import { useRef, useState } from "react";
import { calendarBookingsMock } from "../../data/calendarMock";
import "./Calendar.css";

import CalendarToolbar from "./toolbar/CalendarToolBar";
import CalendarDayDetails from "./grid/calendarDayDetails/CalendarDayDetails";
import CalendarGrid from "./grid/CalendarGrid"
// Funzione usata solo qui: restituisce una data locale YYYY-MM-DD.
function dateKey(date) {
return [
String(date.getFullYear()).padStart(4, "0"),
String(date.getMonth() + 1).padStart(2, "0"),
String(date.getDate()).padStart(2, "0"),
].join("-");
}
export default function Calendar() {
  const [referenceDate, setReferenceDate] = useState(() => new Date());
  const [today, setToday] = useState(() => new Date());
  const [selectedDay, setSelectedDay] = useState(null);
  const lastDayButton = useRef(null);
  const firstDate = new Date(referenceDate);
  firstDate.setHours(0, 0, 0, 0);
  firstDate.setDate(1);
  // getDay usa domenica=0; trasformiamo lunedi nel primo giorno.
  firstDate.setDate(firstDate.getDate() - (firstDate.getDay() + 6) % 7);
  const days = Array.from({ length: 42 }, (_, index) => {
    const date = new Date(firstDate);
    date.setDate(date.getDate() + index);
    return { date, dateKey: dateKey(date) };
  });
  const bookings = calendarBookingsMock
    .filter((booking) => booking.status === "APPROVED")
    .sort((a, b) => a.date.localeCompare(b.date) || a.startsAt.localeCompare(b.startsAt));
  function changeDate(date) {
    setToday(new Date());
    setReferenceDate(date);
    setSelectedDay(null);
  }
  function changeMonth(amount) {
    const next = new Date(referenceDate);
    next.setDate(1);
    next.setMonth(next.getMonth() + amount);
    changeDate(next);
  }
  function openDay(day, button) {
    lastDayButton.current = button;
    setSelectedDay(day);
  }
  function closeDay() {
    setSelectedDay(null);
    lastDayButton.current?.focus();
  }
  return (
    <section className="classroom-calendar" aria-label="Calendario delle aule">
      <CalendarToolbar
        referenceDate={referenceDate}
        onPrevious={() => changeMonth(-1)} onNext={() => changeMonth(1)}
        onToday={() => changeDate(new Date())} onDateChange={changeDate}
      />
      {selectedDay && <CalendarDayDetails day={selectedDay}
        bookings={bookings.filter((booking) => booking.date === selectedDay.dateKey)}
        message="" onClose={closeDay}
      />}
      <CalendarGrid days={days} today={today} view="month"
referenceDate={referenceDate} bookings={bookings}
selectedDay={selectedDay} showCounts={true} onSelectDay={openDay}
/>
</section>
);
}