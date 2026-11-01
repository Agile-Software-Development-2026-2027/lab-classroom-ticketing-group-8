import "./DatePicker.css";

export default function DatePicker({
  referenceDate,
  onDateChange,
}) {
  // L'input date richiede un valore nel formato YYYY-MM-DD.
  const year = String(referenceDate.getFullYear()).padStart(4, "0");
  const month = String(referenceDate.getMonth() + 1).padStart(2, "0");
  const day = String(referenceDate.getDate()).padStart(2, "0");

  const inputValue = `${year}-${month}-${day}`;

  function handleChange(event) {
    const value = event.target.value;

    // Manteniamo la data precedente se il campo viene svuotato.
    if (!value) return;

    const [selectedYear, selectedMonth, selectedDay] = value
      .split("-")
      .map(Number);

    // Copiamo la data per non modificare direttamente lo stato.
    const selectedDate = new Date(referenceDate);

    selectedDate.setFullYear(
      selectedYear,
      selectedMonth - 1,
      selectedDay
    );

    onDateChange(selectedDate);
  }

  return (
    <label className="calendar-date-picker">
      <span>Vai alla data</span>

      <input
        type="date"
        value={inputValue}
        onChange={handleChange}
      />
    </label>
  );
}