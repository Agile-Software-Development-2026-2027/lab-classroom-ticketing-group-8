import { useState } from "react";
import CalendarToolbar from "./toolbar/CalendarToolBar";

export default function Calendar() {
  const [referenceDate, setReferenceDate] = useState(
    () => new Date()
  );

  //associo la funzione al pulsante e aumento di 1 o -1 per il mese, con today restituisco il mese impostando la data su oggi
  function changeMonth(amount) {
    setReferenceDate((currentDate) => {
      return new Date(
        currentDate.getFullYear(),
        currentDate.getMonth() + amount,
        1
      );
    });
  }

  function goToToday() {
    setReferenceDate(new Date());
  }

  return (
    <section aria-label="Calendario delle aule">
      <CalendarToolbar
        referenceDate={referenceDate}
        onPrevious={() => changeMonth(-1)}
        onToday={goToToday}
        onNext={() => changeMonth(1)}
      />
    </section>
  );
}