import {
  collection,
  addDoc,
  Timestamp,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  runTransaction,
} from "firebase/firestore";
import { db } from "../firebase/client";

function formatTime(val) {
  if (!val) return "";
  if (typeof val === "string") return val;
  if (val && typeof val.toDate === "function") {
    return val.toDate().toLocaleTimeString("it-IT", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  if (val instanceof Date) {
    return val.toLocaleTimeString("it-IT", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  return String(val);
}

export function validateBookingData(data) {
  if (!data) {
    throw new Error("I dati della richiesta sono obbligatori.");
  }

  const {
    date,
    startTime,
    endTime,
    classroomId,
    classroom,
    departmentId,
    department,
    professorId,
    professor,
  } = data;

  const resolvedClassroomId = classroomId || (typeof classroom === "string" ? classroom : classroom?.id);
  const resolvedDepartmentId = departmentId || (typeof department === "string" ? department : department?.id);
  const resolvedProfessorId = professorId || (typeof professor === "string" ? professor : professor?.id);

  if (!resolvedDepartmentId) {
    throw new Error("Il dipartimento è obbligatorio.");
  }

  if (!resolvedClassroomId) {
    throw new Error("L'aula o laboratorio è obbligatoria.");
  }

  if (!date || !startTime || !endTime || !resolvedProfessorId) {
    throw new Error("Tutti i campi obbligatori devono essere compilati.");
  }

  // Verifica preavviso: la data deve essere dal giorno successivo in poi
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const bookingDate = new Date(date + "T00:00:00");
  if (isNaN(bookingDate.getTime()) || bookingDate <= today) {
    throw new Error("La richiesta deve essere inoltrata con almeno un giorno di preavviso.");
  }

  if (startTime >= endTime) {
    throw new Error("L'orario di fine deve essere successivo all'orario di inizio.");
  }
}

export async function createBookingRequest(bookingData) {
  validateBookingData(bookingData);

  const {
    date,
    startTime,
    endTime,
    classroomId,
    classroom,
    departmentId,
    department,
    professorId,
    professor,
    professorName,
  } = bookingData;

  const resolvedClassroomId = classroomId || (typeof classroom === "string" ? classroom : classroom?.id);
  const resolvedDepartmentId = departmentId || (typeof department === "string" ? department : department?.id);
  const resolvedProfessorId = professorId || (typeof professor === "string" ? professor : professor?.id);

  // Conversione orari in Timestamp Firestore
  const startsAt = Timestamp.fromDate(new Date(`${date}T${startTime}:00`));
  const endsAt = Timestamp.fromDate(new Date(`${date}T${endTime}:00`));

  // I campi salvati sono ESCLUSIVAMENTE quelli previsti dalla struttura Cloud Firestore
  const newBooking = {
    classroom: doc(db, "classrooms", resolvedClassroomId),
    date,
    department: doc(db, "departments", resolvedDepartmentId),
    endsAt,
    professor: doc(db, "users", resolvedProfessorId),
    professorName: professorName || "Docente",
    startsAt,
    status: "PENDING",
  };

  const docRef = await addDoc(collection(db, "bookingRequest"), newBooking);

  return docRef.id;
}

export async function getPendingBookingRequests() {
  const requestsCollection = collection(db, "bookingRequest");
  const pendingQuery = query(requestsCollection, where("status", "==", "PENDING"));
  const snapshot = await getDocs(pendingQuery);

  const requests = await Promise.all(
    snapshot.docs.map(async (docSnapshot) => {
      const data = docSnapshot.data();

      const classroom =
        data.classroom?.id ||
        (typeof data.classroom === "string" ? data.classroom : "Aula");

      let professorUniversityId = data.professorUniversityId || "";

      if (!professorUniversityId && data.professor) {
        try {
          const profDocRef =
            typeof data.professor === "string"
              ? doc(db, "users", data.professor)
              : data.professor;

          const profSnapshot = await getDoc(profDocRef);
          if (profSnapshot.exists()) {
            professorUniversityId = profSnapshot.data().universityId || "";
          }
        } catch {
          professorUniversityId = data.professor?.id || "";
        }
      }

      const startTime = formatTime(data.startsAt || data.startTime);
      const endTime = formatTime(data.endsAt || data.endTime);

      return {
        id: docSnapshot.id,
        classroom,
        date: data.date || "",
        professorName: data.professorName || "Docente",
        professorUniversityId: professorUniversityId || "N/D",
        startTime,
        endTime,
        status: data.status,
      };
    })
  );

  return requests;
}

export async function approveBookingRequest(requestId) {
  if (!requestId) {
    throw new Error("ID della richiesta obbligatorio.");
  }

  const bookingRef = doc(db, "bookingRequest", requestId);

  await runTransaction(db, async (transaction) => {
    const bookingSnapshot = await transaction.get(bookingRef);

    if (!bookingSnapshot.exists()) {
      throw new Error("Richiesta di prenotazione non trovata.");
    }

    if (bookingSnapshot.data().status !== "PENDING") {
      throw new Error("È possibile approvare solo richieste in attesa.");
    }

    transaction.update(bookingRef, {
      status: "APPROVED",
    });
  });
}


export async function rejectBookingRequest(requestId) {
  if (!requestId) {
    throw new Error("ID della richiesta obbligatorio.");
  }

  const bookingRef = doc(db, "bookingRequest", requestId);

  await runTransaction(db, async (transaction) => {
    const bookingSnapshot = await transaction.get(bookingRef);

    if (!bookingSnapshot.exists()) {
      throw new Error("Richiesta di prenotazione non trovata.");
    }

    if (bookingSnapshot.data().status !== "PENDING") {
      throw new Error("È possibile rifiutare solo richieste in attesa.");
    }

    transaction.update(bookingRef, {
      status: "REJECTED",
    });
  });
}