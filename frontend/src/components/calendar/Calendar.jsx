import { useState } from "react";
import CalendarToolbar from "./toolbar/CalendarToolbar";

export default function Calendar() {
  const [referenceDate, setReferenceDate] = useState(
    () => new Date()
  );

  function changeMonth(amount) {
    setReferenceDate((currentDate) => {
      const nextDate = new Date(currentDate);

      // Usiamo il primo giorno come riferimento del nuovo mese.
      nextDate.setDate(1);
      nextDate.setMonth(nextDate.getMonth() + amount);

      return nextDate;
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
        onDateChange={setReferenceDate}
      />
    </section>
  );
}