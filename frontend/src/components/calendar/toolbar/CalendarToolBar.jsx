import CalendarNavigation from "../navigation/CalendarNavigaton";
import "./CalendarToolbar.css";

export default function CalendarToolbar({
  referenceDate,
  onPrevious,
  onToday,
  onNext,
}) {
  const monthLabel = referenceDate.toLocaleDateString("it-IT", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="calendar-toolbar">
      <CalendarNavigation
        onPrevious={onPrevious}
        onToday={onToday}
        onNext={onNext}
      />

      <h2 className="calendar-toolbar-title" aria-live="polite">
        {monthLabel}
      </h2>
    </div>
  );
}