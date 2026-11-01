import "./CalendarDay.css";
export default function CalendarDay({
  date, isToday = false, bookings = [], outsideMonth = false, selected = false,
  showCounts = true, onSelect,
}) {
  const label = date.toLocaleDateString("it-IT", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
  const firstBooking = bookings[0];
  const countLabel = showCounts
    ? " · " + bookings.length + " prenotazioni approvate"
    : " · apri i dettagli del giorno";
  const classes = ["calendar-day"];
  if (outsideMonth) classes.push("calendar-day-outside");
  if (selected) classes.push("calendar-day-selected");
  return (
    <button type="button" className={classes.join(" ")}
      aria-label={label + countLabel} aria-pressed={selected}
      aria-current={isToday ? "date" : undefined}
      onClick={(event) => onSelect(event.currentTarget)}>
      <span className="calendar-day-number">{date.getDate()}</span>
      {showCounts && bookings.length > 0 && (
        <span className="calendar-day-count">{bookings.length} pren.</span>
      )}
      {showCounts && firstBooking && (
        <span className="calendar-day-preview">
          {firstBooking.startsAt}–{firstBooking.endsAt} · {firstBooking.classroomName}
        </span>
      )}
    </button>
  );
}