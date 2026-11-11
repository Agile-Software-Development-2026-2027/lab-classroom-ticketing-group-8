
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
  const [referenceDateDay, setReferenceDateDay]=useState(null);
  const [guestDepartmentId, setGuestDepartmentId] = useState("");
  const [classroomId, setClassroomId] = useState("");
  const lastDayButton = useRef(null);
  const [typeView, setTypeView] = useState("month");

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

  const hasDepartment = departmentId !== "";

  const firstDate = new Date(referenceDate);//mi serve per capire da dove far partire la vista, es mese-> 1 del mese e il lunedi di quella settimana, settimana->direttamente dal lunedi

  const filterMessage = hasDepartment
    ? ""
    : authLoading || catalogLoading
    ? "Caricamento dipartimenti..."
    : isRestricted
    ? "Dipartimento assegnato non disponibile."
    : "Seleziona un dipartimento per visualizzare le prenotazioni.";
  firstDate.setHours(0, 0, 0, 0);

  // Calcola quanti giorni sottrarre per tornare al lunedì precedente (considerando Lunedì=0 ... Domenica=6).
  // JavaScript usa Domenica=0. Aggiungendo 6 e usando il modulo (% 7), convertiamo la scala in modo che:
  // Lunedì dia 0 (0 giorni da togliere), Martedì dia 1, ..., Domenica dia 6.
  
  if(typeView=="month"){
    firstDate.setDate(1);
    firstDate.setDate(firstDate.getDate() - (firstDate.getDay() + 6) % 7);
  }else if(typeView=="week"){
    firstDate.setDate(firstDate.getDate() - (firstDate.getDay() + 6) % 7);
  }
  
  let l=42;
  if(typeView=="week"){
    l=7;//3 giorni prima la settimana e 3 giorni dopo
    //per il type view day non mi serve mostro direttamente solo daydetails
  }else if(typeView=="day"){
    l=1;
  }
  const days = Array.from({ length: l}, (_, index) => {
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
    if(typeView=="day"){
      setSelectedDay({date, dateKey: dateKey(date)})
    }
    
  }

  function changeMonth(amount) {//si continua a chiamre change month ma gestira il cambio giorno nel tipo di view

    if(typeView=="month"){
      const next = new Date(referenceDate);//copiamo l'attuale cosi da non modificare il riferimento
      next.setDate(1);//la metto al primo giorno per evitare problemi qualsiasi
      next.setMonth(next.getMonth() + amount);//cambio solo il mese
      changeDate(next);//reimposto la reference con la date con il mese cambiato
    }
    
    if(typeView=="week"){
      const next = new Date(referenceDate);//copiamo l'attuale cosi da non modificare il riferimento
      next.setDate(next.getDate() + (amount*7));//cambio solo il mese
      changeDate(next);//reimposto la reference con la date con il mese cambiato
    }

    if(typeView=="day"){
      const next=new Date(referenceDate);
      next.setDate(next.getDate()+amount);
      changeDate(next);
    }
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
    if(typeView!="day"){
      setSelectedDay(null);
    }

  }

  function changeView(type){
    if(type=="day"){
      const date = new Date(referenceDate);
      date.setDate(date.getDate());
      setSelectedDay({date, dateKey: dateKey(date)})
    }
    setTypeView(type);
  }

  let periodLabel = "";

  if (typeView === "month") {
    periodLabel = referenceDate.toLocaleDateString("it-IT", {
      month: "long",
      year: "numeric",
    });

  } else if (typeView === "day") {
    periodLabel = referenceDate.toLocaleDateString("it-IT", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });

  } else if (typeView === "week") {
    // Recuperiamo gli oggetti del primo e dell'ultimo giorno.
    const firstDay = days[0];
    const lastDay = days[days.length - 1];

    const options = {
      day: "numeric",
      month: "long",
      year: "numeric",
    };

    // Formattiamo il campo Date contenuto nei due oggetti.
    const startLabel = firstDay.date.toLocaleDateString("it-IT", options);
    const endLabel = lastDay.date.toLocaleDateString("it-IT", options);

    periodLabel = `${startLabel} – ${endLabel}`;
  }

  return (
    <section className="classroom-calendar" aria-label="Calendario delle aule">
      <CalendarToolbar
        periodLabel={periodLabel}
        onPrevious={() => changeMonth(-1)}//passo il risultato della funzione
        onNext={() => changeMonth(1)}
        onToday={() => changeDate(new Date())}
        referenceDate={referenceDate}
        onDateChange={changeDate}
        onTypeChange={changeView}
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
      {(selectedDay && (typeView!="day")) && (//mostra la lista solo se viene selezionato un giorno
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

      {(typeView=="month" || typeView=="week") &&(

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

      )}

      {typeView=="day" &&(
        
        <CalendarDayDetails
          type={typeView}
          day={selectedDay}
          bookings={bookings.filter(
            (booking) => booking.date === selectedDay.dateKey
          )}
          
          message={bookingsLoading ? "Caricamento prenotazioni..." : message}
        />

      )}

      
      
    </section>
  );
}
