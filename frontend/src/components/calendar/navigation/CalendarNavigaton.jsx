import "./CalendarNavigation.css";

export default function CalendarNavigation({
  onPrevious,
  onToday,
  onNext,
}) {
  return (
    <div
      className="calendar-navigation"
      role="group"
      aria-label="Spostamento nel calendario"
    >
      <button
        type="button"
        onClick={onPrevious}
        aria-label="Periodo precedente"
      >
        ←
      </button>

      <button type="button" onClick={onToday}>
        Oggi
      </button>

      <button
        type="button"
        onClick={onNext}
        aria-label="Periodo successivo"
      >
        →
      </button>
    </div>
  );
}