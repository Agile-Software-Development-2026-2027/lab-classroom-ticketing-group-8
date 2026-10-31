import { useEffect, useState } from "react";
import { getCalendarCatalog } from "../services/calendarService";

export default function useCalendarCatalog() {
  const [catalog, setCatalog] = useState({
    departments: [],
    classrooms: [],
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadCatalog() {
      try {
        //non sa se usa mock o firestore ma si aspetta lo stesso formato
        //quindi risulta utilizzabile con entrambi
        const result = await getCalendarCatalog();

        if (active) {
          setCatalog(result);
        }
      } catch {
        if (active) {
          setError("Impossibile caricare dipartimenti e aule.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadCatalog();

    return () => {
      active = false;
    };
  }, []);

  return {
    departments: catalog.departments,
    classrooms: catalog.classrooms,
    loading,
    error,
  };
}