import CalendarNavigation from "../navigation/CalendarNavigaton";
import DatePicker from "../datePicker/DatePicker"

import "./CalendarToolBar.css";

export default function CalendarToolbar({
  referenceDate,
  periodLabel,
  onDateChange,
  onPrevious,
  onToday,
  onNext,
}) {

  return (
    <div className="calendar-toolbar">
      <CalendarNavigation
        onPrevious={onPrevious}
        onToday={onToday}
        onNext={onNext}
      />

      <h2 className="calendar-toolbar-title" aria-live="polite">
        {periodLabel}
      </h2>

      <DatePicker
        referenceDate={referenceDate}
        onDateChange={onDateChange}
      />
    </div>
  );
}