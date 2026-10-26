import CalendarNavigation from "../navigation/CalendarNavigaton";
import DatePicker from "../datePicker/DatePicker";
import "./CalendarToolbar.css";

export default function CalendarToolbar({
  referenceDate,
  onDateChange,
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

      <DatePicker
        referenceDate={referenceDate}
        onDateChange={onDateChange}
      />
    </div>
  );
}