import {
  collection,
  addDoc,
  serverTimestamp,
  doc,
  getDoc,
  getDocs,
  query,
  where,
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

  const { date, startTime, endTime, classroom, professorId } = data;

  if (!date || !startTime || !endTime || !classroom || !professorId) {
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

  const newBooking = {
    ...bookingData,
    status: "PENDING",
    createdAt: serverTimestamp(),
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

