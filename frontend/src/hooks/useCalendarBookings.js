import { useEffect, useState } from "react";
import { getCalendarBookings } from "../services/calendarService";

export default function useCalendarBookings({
  fromDate,
  toDateExclusive,
  departmentId,
  departments,
  classrooms,
}) {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadBookings() {
      setBookings([]);
      setError("");
      setLoading(Boolean(departmentId));

      try {
        const result = await getCalendarBookings(
          { fromDate, toDateExclusive, departmentId },
          { departments, classrooms }
        );

        if (active) {
          setBookings(result);
        }
      } catch {
        if (active) {
          setError("Impossibile caricare le prenotazioni.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadBookings();

    return () => {
      active = false;
    };
  }, [
    fromDate,
    toDateExclusive,
    departmentId,
    departments,
    classrooms,
  ]);

  return { bookings, loading, error };
}