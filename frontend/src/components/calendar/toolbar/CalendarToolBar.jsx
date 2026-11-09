import CalendarNavigation from "../navigation/CalendarNavigaton";

import TypePicker from "../typePicker/TypePicker"
import DatePicker from "../datePicker/DatePicker";
import "./CalendarToolBar.css";

export default function CalendarToolbar({
  periodLabel,
  onPrevious,
  onToday,
  onNext,
  onDateChange,
  referenceDate,
  onTypeChange
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

      <TypePicker
        onTypeChange={onTypeChange}      
      />
      
    </div>
  );
}