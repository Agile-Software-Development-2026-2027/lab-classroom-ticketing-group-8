
import { useContext, useEffect, useRef, useState } from "react";
import "./Calendar.css";
import CalendarToolbar from "./toolbar/CalendarToolBar";
import CalendarDayDetails from "./grid/calendarDayDetails/CalendarDayDetails";
import CalendarGrid from "./grid/CalendarGrid";
import useCalendarBookings from "../../hooks/useCalendarBookings";
import CalendarFilters from "./filters/CalendarFilters";
import useCalendarCatalog from "../../hooks/useCalendarCatalog";
import { AuthContext } from "../../contexts/AuthContextValue";
import { getAssignedDepartmentId } from "../../services/userService";
function dateKey(date) {
  return [
    String(date.getFullYear()).padStart(4, "0"),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}
export default function Calendar() {
  const session = useContext(AuthContext);
  const authLoading = Boolean(session?.loading);
  const isRestricted = ["PROFESSOR", "ADMIN"].includes(session?.profile?.role);
  const assignedDepartmentId = getAssignedDepartmentId(session?.profile);
  const {
    departments,
    classrooms,
    loading: catalogLoading,
    error: catalogError,
  } = useCalendarCatalog();
  const [referenceDate, setReferenceDate] = useState(() => new Date());
  const [today, setToday] = useState(() => new Date());
  const [selectedDay, setSelectedDay] = useState(null);
  const [guestDepartmentId, setGuestDepartmentId] = useState("");
  const [classroomId, setClassroomId] = useState("");
  const lastDayButton = useRef(null);
  const visibleDepartments = authLoading
    ? []
    : isRestricted
    ? departments.filter((dept) => dept.id === assignedDepartmentId)
    : departments;
  const departmentId = authLoading
    ? ""
    : isRestricted
    ? visibleDepartments[0]?.id ?? ""
    : guestDepartmentId;
  const visibleClassrooms = authLoading
    ? []
    : isRestricted
    ? classrooms.filter((room) => room.departmentId === departmentId)
    : classrooms;
  const activeClassroomId = visibleClassrooms.some(
    (room) => room.id === classroomId && room.departmentId === departmentId
  )
    ? classroomId
    : "";
  useEffect(() => {
    setGuestDepartmentId("");
    setClassroomId("");
    setSelectedDay(null);
  }, [isRestricted, assignedDepartmentId]);
  const firstDate = new Date(referenceDate);
  const hasDepartment = departmentId !== "";
  const filterMessage = hasDepartment
    ? ""
    : authLoading || catalogLoading
    ? "Caricamento dipartimenti..."
    : isRestricted
    ? "Dipartimento assegnato non disponibile."
    : "Seleziona un dipartimento per visualizzare le prenotazioni.";
  firstDate.setHours(0, 0, 0, 0);
  firstDate.setDate(1);
  firstDate.setDate(firstDate.getDate() - (firstDate.getDay() + 6) % 7);
  const days = Array.from({ length: 42 }, (_, index) => {
    const date = new Date(firstDate);
    date.setDate(date.getDate() + index);
    return { date, dateKey: dateKey(date) };
  });
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
  const bookings = loadedBookings.filter(
    (booking) =>
      hasDepartment &&
      booking.departmentId === departmentId &&
      (!activeClassroomId || booking.classroomId === activeClassroomId)
  );
  
  function changeDate(date) {
    setToday(new Date());
    setReferenceDate(date);
    setSelectedDay(null);
  }

  function changeMonth(amount) {
    const next = new Date(referenceDate);//copiamo l'attuale cosi da non modificare il riferimento
    next.setDate(1);//la metto al primo giorno per evitare problemi qualsiasi
    next.setMonth(next.getMonth() + amount);//cambio solo il mese
    changeDate(next);//reimposto la reference con la date con il mese cambiato
  }

  function openDay(day, button) {
    lastDayButton.current = button;
    setSelectedDay(day);//se null non viene mostrtato nulla come da condizione jsx
  }

  function closeDay() {
    setSelectedDay(null);//imposta a null per chiudere la lista dettaglio
    lastDayButton.current?.focus();
  }

  function changeDepartment(nextDepartmentId) {
    if (isRestricted || authLoading) return;
    setGuestDepartmentId(nextDepartmentId);
    setClassroomId("");
    setSelectedDay(null);
  }

  const periodLabel = referenceDate.toLocaleDateString("it-IT", {
    month: "long",
    year: "numeric",
  });

  return (
    <section className="classroom-calendar" aria-label="Calendario delle aule">
      <CalendarToolbar
        periodLabel={periodLabel}
        onPrevious={() => changeMonth(-1)}//passo il risultato della funzione
        onNext={() => changeMonth(1)}
        onToday={() => changeDate(new Date())}
        referenceDate={referenceDate}
        onDateChange={changeDate}
      />
      <CalendarFilters
        departments={visibleDepartments}
        classrooms={visibleClassrooms}
        departmentId={departmentId}
        classroomId={activeClassroomId}
        departmentDisabled={authLoading || isRestricted}
        onDepartmentChange={changeDepartment}
        onClassroomChange={setClassroomId}
      />
      {selectedDay && (//mostra la lista solo se viene selezionato un giorno
        <CalendarDayDetails
          day={selectedDay}
          bookings={bookings.filter(
            (booking) => booking.date === selectedDay.dateKey
          )}
          message={bookingsLoading ? "Caricamento prenotazioni..." : message}
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
      <CalendarGrid
        days={days}
        today={today}
        view="month"
        referenceDate={referenceDate}
        bookings={bookings}
        selectedDay={selectedDay}
        showCounts={hasDepartment && !bookingsLoading && !bookingsError}
        onSelectDay={openDay}
      />
    </section>
  );
}
