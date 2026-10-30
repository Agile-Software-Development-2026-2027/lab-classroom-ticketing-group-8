import {
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  where,
} from "firebase/firestore";

import { db } from "../firebase/client";

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

export async function getCalendarBookings(filters, catalog) {
  const {
    fromDate,
    toDateExclusive,
    departmentId,
  } = filters;

  if (!departmentId) return [];

  const bookingsQuery = query(
    collection(db, "bookingRequest"),
    where("status", "==", "APPROVED"),
    where(
      "department",
      "==",
      doc(db, "departments", departmentId)
    ),
    where("date", ">=", fromDate),
    where("date", "<", toDateExclusive),
    orderBy("date")
  );

  const snapshot = await getDocs(bookingsQuery);

  const department = catalog.departments.find(
    (item) => item.id === departmentId
  );

  const timeOptions = {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Rome",
  };

  const bookings = snapshot.docs.map((document) => {
    const data = document.data();

    const classroom = catalog.classrooms.find(
      (item) => item.id === data.classroom.id
    );

    return {
      id: document.id,
      date: data.date,

      startsAt: data.startsAt
        .toDate()
        .toLocaleTimeString("it-IT", timeOptions),

      endsAt: data.endsAt
        .toDate()
        .toLocaleTimeString("it-IT", timeOptions),

      departmentId: data.department.id,
      departmentName: department?.name ?? "Dipartimento non disponibile",

      classroomId: data.classroom.id,
      classroomName: classroom?.name ?? "Aula non disponibile",
      cubo: classroom?.cubo ?? "",

      professorName: data.professorName ?? "Nome non disponibile",
      status: data.status,
    };
  });

  return bookings.sort((a, b) => {
    return (
      a.date.localeCompare(b.date) ||
      a.startsAt.localeCompare(b.startsAt)
    );
  });
}