import CalendarDay from "./calendarDay/CalendaDay"
import "./CalendarGrid.css";
export default function CalendarGrid({
  days, today, view, referenceDate, bookings, selectedDay, showCounts, onSelectDay,
}) {
  const weekdays = view === "day"
    ? [referenceDate.toLocaleDateString("it-IT", { weekday: "long" })]
    : ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];
  return (
    <div className="calendar-grid-scroll">
      <div className={"calendar-grid calendar-grid-" + view}>
        <div className="calendar-grid-weekdays" aria-hidden="true">
          {weekdays.map((label) => <span key={label}>{label}</span>)}
        </div>
        <div className="calendar-grid-days">
          {days.map(({ date, dateKey }) => (
            <CalendarDay key={dateKey} date={date}
              isToday={date.toDateString() === today.toDateString()}
              bookings={bookings.filter((booking) => booking.date === dateKey)}
              outsideMonth={view === "month" && date.getMonth() !== referenceDate.getMonth()}
              selected={selectedDay?.dateKey === dateKey}
              showCounts={showCounts}
              onSelect={(button) => onSelectDay({ date, dateKey }, button)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}