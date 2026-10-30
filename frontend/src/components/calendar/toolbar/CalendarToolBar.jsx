import CalendarNavigation from "../navigation/CalendarNavigaton";

// TODO: Da riattivare nello sprint dedicato alle altre viste.
// import DatePicker from "../datePicker/DatePicker";

import "./CalendarToolBar.css";

export default function CalendarToolbar({
  periodLabel,
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

      {/* 
        Da riattivare insieme alle props referenceDate e onDateChange:

        <DatePicker
          referenceDate={referenceDate}
          onDateChange={onDateChange}
        />
      */}
    </div>
  );
}