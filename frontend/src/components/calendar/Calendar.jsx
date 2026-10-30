import { useRef, useState } from "react";
import "./Calendar.css";

import CalendarToolbar from "./toolbar/CalendarToolBar";
import CalendarDayDetails from "./grid/calendarDayDetails/CalendarDayDetails";
import CalendarGrid from "./grid/CalendarGrid"

import useCalendarBookings from "../../hooks/useCalendarBookings";

import CalendarFilters from "./filters/CalendarFilters";

import useCalendarCatalog from "../../hooks/useCalendarCatalog";
// Funzione usata solo qui: restituisce una data locale YYYY-MM-DD.
function dateKey(date) {
  return [
  String(date.getFullYear()).padStart(4, "0"),
  String(date.getMonth() + 1).padStart(2, "0"),
  String(date.getDate()).padStart(2, "0"),
  ].join("-");
}
export default function Calendar() {
  
  const {
    departments,
    classrooms,
    error: catalogError,
  } = useCalendarCatalog();

  const [referenceDate, setReferenceDate] = useState(() => new Date());
  const [today, setToday] = useState(() => new Date());
  const [selectedDay, setSelectedDay] = useState(null);
  const [departmentId, setDepartmentId] = useState("");
  const [classroomId, setClassroomId] = useState("");
  const lastDayButton = useRef(null);
  const firstDate = new Date(referenceDate);

  const hasDepartment = departmentId !== "";
  const filterMessage = hasDepartment
  ? ""
  : "Seleziona un dipartimento per visualizzare le prenotazioni.";

  firstDate.setHours(0, 0, 0, 0);
  firstDate.setDate(1);
  // getDay usa domenica=0; trasformiamo lunedi nel primo giorno.
  firstDate.setDate(firstDate.getDate() - (firstDate.getDay() + 6) % 7);
  const days = Array.from({ length: 42 }, (_, index) => {
    const date = new Date(firstDate);
    date.setDate(date.getDate() + index);
    return { date, dateKey: dateKey(date) };
  });
  
  // Il periodo comprende tutte le 42 celle visibili.
  const endDate = new Date(firstDate);
  endDate.setDate(endDate.getDate() + days.length);

  const {
    bookings: loadedBookings,
    loading: bookingsLoading,
    error: bookingsError,
  } = useCalendarBookings({
    fromDate: days[0].dateKey,
    toDateExclusive: dateKey(endDate),
    departmentId,
    departments,
    classrooms,
  });

  const message = catalogError || bookingsError || filterMessage;

  // Manteniamo il filtro aula nell'interfaccia.
  const bookings = loadedBookings.filter((booking) => {
    return (
      hasDepartment &&
      booking.departmentId === departmentId &&
      (!classroomId || booking.classroomId === classroomId)
    );
  });

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
  function changeDepartment(nextDepartmentId) {
      setDepartmentId(nextDepartmentId);

      // L'aula precedente potrebbe appartenere a un altro dipartimento.
      setClassroomId("");
  }
  const periodLabel = referenceDate.toLocaleDateString("it-IT", {
      month: "long",
      year: "numeric",
  }
  ); 
  return (
    <section className="classroom-calendar" aria-label="Calendario delle aule">
      {/* TODO: ripristinare il passaggio dati al datepicker nel componente tool bar
      <CalendarToolbar
        referenceDate={referenceDate} periodLabel={periodLabel}
        onPrevious={() => changeMonth(-1)} onNext={() => changeMonth(1)}
        onToday={() => changeDate(new Date())} onDateChange={changeDate}
      />
      */}

      <CalendarToolbar
        periodLabel={periodLabel}
        onPrevious={() => changeMonth(-1)}
        onNext={() => changeMonth(1)}
        onToday={() => changeDate(new Date())}
      />
      <CalendarFilters
        departments={departments}
        classrooms={classrooms}
        departmentId={departmentId}
        classroomId={classroomId}
        onDepartmentChange={changeDepartment}
        onClassroomChange={setClassroomId}
      />
      {selectedDay && (
        <CalendarDayDetails
          day={selectedDay}
          bookings={bookings.filter(
            (booking) => booking.date === selectedDay.dateKey
          )}
          message={message}
          onClose={closeDay}
        />
      )}
      {message && (
        <p
          className="calendar-message"
          role={catalogError || bookingsError ? "alert" : undefined}
        >
          {message}
        </p>
      )}
      <CalendarGrid days={days} today={today} view="month"
        referenceDate={referenceDate} bookings={bookings}
        selectedDay={selectedDay} showCounts={ hasDepartment && !bookingsLoading && !bookingsError } onSelectDay={openDay}
      />
</section>
);
}