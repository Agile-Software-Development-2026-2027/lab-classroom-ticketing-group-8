import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase/client";

import { calendarBookingsMock } from "../data/calendarMock";

export async function getCalendarCatalog() {

  //individua legge e aspetta il risultato di una colezione
  //nel nostro cso i dipartimenti e le clssi e le salva
  const departmentsSnapshot = await getDocs(
    collection(db, "departments")
  );

  const classroomsSnapshot = await getDocs(
    collection(db, "classrooms")
  );

  //dal salvataggio della collezione estraplo id e nome per avere la "variabile"
  // dipartimenti disponibile
  const departments = departmentsSnapshot.docs.map((document) => {
    return {
      id: document.id,
      name: document.data().name,
    };
  });

  //stessa cosa per le classi li mappiamo in ogetti
  const classrooms = classroomsSnapshot.docs.map((document) => {

    return {
      id: document.id,
      name: document.data().name,
      cubo: document.data().cubo,
      departmentId: document.data().department.id,
    };
  });

  return {
    departments,
    classrooms,
  };
}

// Per questo passaggio le prenotazioni usano ancora i mock.
export async function getCalendarBookings(filters) {
  const {
    fromDate,
    toDateExclusive,
    departmentId,
    classroomId,
  } = filters;

  if (!departmentId) return [];

  return calendarBookingsMock.filter((booking) => {
    return (
      booking.status === "APPROVED" &&
      booking.date >= fromDate &&
      booking.date < toDateExclusive &&
      booking.departmentId === departmentId &&
      (!classroomId || booking.classroomId === classroomId)
    );
  });
}