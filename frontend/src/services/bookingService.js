
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
      timeZone: "Europe/Rome",
    });
  }
  if (val instanceof Date) {
    return val.toLocaleTimeString("it-IT", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Europe/Rome",
    });
  }
  return String(val);
}

function toMinutes(time) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function toRomeDate(date, time) {
  const [year, month, day] = date.split("-").map(Number);
  const [hours, minutes] = time.split(":").map(Number);
  const utcGuess = Date.UTC(year, month - 1, day, hours, minutes);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Rome",
    timeZoneName: "shortOffset",
  }).formatToParts(new Date(utcGuess));
  const zone = parts.find((part) => part.type === "timeZoneName")?.value;
  const match = /^GMT([+-])(\d{1,2})(?::(\d{2}))?$/.exec(zone ?? "");
  if (!match) {
    throw new Error("Impossibile determinare il fuso orario.");
  }
  const direction = match[1] === "+" ? 1 : -1;
  const offsetMinutes = direction * (
    Number(match[2]) * 60 + Number(match[3] ?? 0)
  );
  return new Date(utcGuess - offsetMinutes * 60000);
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
  const resolvedClassroomId =
    classroomId || (typeof classroom === "string" ? classroom : classroom?.id);
  const resolvedDepartmentId =
    departmentId || (typeof department === "string" ? department : department?.id);
  const resolvedProfessorId =
    professorId || (typeof professor === "string" ? professor : professor?.id);
  if (!resolvedDepartmentId) {
    throw new Error("Il dipartimento è obbligatorio.");
  }
  if (!resolvedClassroomId) {
    throw new Error("L'aula o laboratorio è obbligatoria.");
  }
  if (!date || !startTime || !endTime || !resolvedProfessorId) {
    throw new Error("Tutti i campi obbligatori devono essere compilati.");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error("Formato data non valido.");
  }
  const bookingDate = new Date(`${date}T00:00:00`);
  if (
    Number.isNaN(bookingDate.getTime()) ||
    bookingDate.getFullYear() !== Number(date.slice(0, 4)) ||
    bookingDate.getMonth() + 1 !== Number(date.slice(5, 7)) ||
    bookingDate.getDate() !== Number(date.slice(8, 10))
  ) {
    throw new Error("Formato data non valido.");
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (bookingDate <= today) {
    throw new Error(
      "La richiesta deve essere inoltrata con almeno un giorno di preavviso."
    );
  }
  const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;
  if (!timePattern.test(startTime) || !timePattern.test(endTime)) {
    throw new Error("Formato orario non valido.");
  }
  const start = toMinutes(startTime);
  const end = toMinutes(endTime);
  if (start >= end) {
    throw new Error(
      "L'orario di fine deve essere successivo all'orario di inizio."
    );
  }
  if (start < 510) {
    throw new Error("La prenotazione non può iniziare prima delle 08:30.");
  }
  if (start > 1110) {
    throw new Error("La prenotazione non può iniziare dopo le 18:30.");
  }
  if (end > 1170) {
    throw new Error("La prenotazione non può terminare dopo le 19:30.");
  }
  if (end - start < 60) {
    throw new Error("La prenotazione deve durare almeno un'ora.");
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
  const resolvedClassroomId =
    classroomId || (typeof classroom === "string" ? classroom : classroom?.id);
  const resolvedDepartmentId =
    departmentId || (typeof department === "string" ? department : department?.id);
  const resolvedProfessorId =
    professorId || (typeof professor === "string" ? professor : professor?.id);
  const startsAt = Timestamp.fromDate(toRomeDate(date, startTime));
  const endsAt = Timestamp.fromDate(toRomeDate(date, endTime));
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

export async function getPendingBookingRequests(departmentId) {
  if (!departmentId) {
    throw new Error("Dipartimento amministratore non assegnato.");
  }
  const requestsCollection = collection(db, "bookingRequest");
  const pendingQuery = query(
    requestsCollection,
    where("status", "==", "PENDING"),
    where("department", "==", doc(db, "departments", departmentId))
  );
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
            professorUniversityId =
              profSnapshot.data().universityId || "";
          }
        } catch {
          professorUniversityId = data.professor?.id || "";
        }
      }
      return {
        id: docSnapshot.id,
        classroom,
        date: data.date || "",
        professorName: data.professorName || "Docente",
        professorUniversityId: professorUniversityId || "N/D",
        startTime: formatTime(data.startsAt || data.startTime),
        endTime: formatTime(data.endsAt || data.endTime),
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

export async function rejectBookingRequest(requestId, rejectReason) {
  if (!requestId) {
    throw new Error("ID della richiesta obbligatorio.");
  }

  if(typeof rejectReason != 'string'){
      throw new Error("Per favore inserisci una stringa di testo valida");
  }

  rejectReason = rejectReason.trim();

  if(!rejectReason){
    throw new Error("Motivazione del rifiuto richiesta.");
  }

  //apro il doc delle request dal fire store e prendo quella con l'id passato alla funzione
  const bookingRef = doc(db, "bookingRequest", requestId);

  //avvio una transaction per la modifica dei campi del documento
  await runTransaction(db, async (transaction) => {
    //la attivo sulla request ottenuta tramite doc
    const bookingSnapshot = await transaction.get(bookingRef);
    if (!bookingSnapshot.exists()) {
      throw new Error("Richiesta di prenotazione non trovata.");
    }
    if (bookingSnapshot.data().status !== "PENDING") {
      throw new Error("È possibile rifiutare solo richieste in attesa.");
    }

    transaction.update(bookingRef, {
      rejectionReason: rejectReason,
      status: "REJECTED",
    });
  });
}

export async function getProfessorBookingRequests(professorId) {
  if (!professorId) return [];
  const requestsCollection = collection(db, "bookingRequest");
  const profRef = doc(db, "users", professorId);
  const professorQuery = query(
    requestsCollection,
    where("professor", "==", profRef)
  );
  const snapshot = await getDocs(professorQuery);
  const docs = snapshot?.docs || [];
  const requests = await Promise.all(
    docs.map(async (docSnapshot) => {
      const data = docSnapshot.data();
      let classroom = "Aula";
      if (data.classroom) {
        if (typeof data.classroom === "string") {
          classroom = data.classroom;
        } else if (data.classroom.id) {
          try {
            const classroomDoc = await getDoc(data.classroom);
            if (classroomDoc.exists()) {
              const cData = classroomDoc.data();
              classroom = cData.name
                ? `${cData.name}${cData.cubo ? ` (Cubo ${cData.cubo})` : ""}`
                : data.classroom.id;
            } else {
              classroom = data.classroom.id;
            }
          } catch {
            classroom = data.classroom.id;
          }
        }
      }
      return {
        id: docSnapshot.id,
        classroom,
        date: data.date || "",
        startTime: formatTime(data.startsAt || data.startTime),
        endTime: formatTime(data.endsAt || data.endTime),
        status: data.status || "PENDING",
        reason: data.rejectionReason,
      };
    })
  );
  return requests.sort((a, b) => (
    (b.date || "").localeCompare(a.date || "") ||
    (b.startTime || "").localeCompare(a.startTime || "")
  ));
}
