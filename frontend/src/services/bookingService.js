
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
  serverTimestamp,
  deleteDoc,
} from "firebase/firestore";
import { db } from "../firebase/client";
import { sendEmailService } from "./emailService";

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

export function isBookingOverlapping(bookingA, bookingB) {
  if (!bookingA || !bookingB) return false;

  if (bookingA.id && bookingB.id && bookingA.id === bookingB.id) {
    return false;
  }

  const classroomA =
    bookingA.classroom?.id ||
    (typeof bookingA.classroom === "string" ? bookingA.classroom : null);
  const classroomB =
    bookingB.classroom?.id ||
    (typeof bookingB.classroom === "string" ? bookingB.classroom : null);

  if (classroomA && classroomB && classroomA !== classroomB) {
    return false;
  }

  if (bookingA.date && bookingB.date && bookingA.date !== bookingB.date) {
    return false;
  }

  const rawStartA = bookingA.startsAt || bookingA.startTime;
  const rawEndA = bookingA.endsAt || bookingA.endTime;
  const rawStartB = bookingB.startsAt || bookingB.startTime;
  const rawEndB = bookingB.endsAt || bookingB.endTime;

  if (!rawStartA || !rawEndA || !rawStartB || !rawEndB) {
    return false;
  }

  const startA = toMinutes(formatTime(rawStartA));
  const endA = toMinutes(formatTime(rawEndA));
  const startB = toMinutes(formatTime(rawStartB));
  const endB = toMinutes(formatTime(rawEndB));

  return startA < endB && endA > startB;
}

function formatSlot(booking) {
  const start = formatTime(booking?.startsAt || booking?.startTime);
  const end = formatTime(booking?.endsAt || booking?.endTime);
  return start && end ? `${start}-${end}` : "";
}

function getStartMinutes(booking) {
  const rawStart = booking?.startsAt || booking?.startTime;
  const formatted = formatTime(rawStart);
  return /^\d{1,2}:\d{2}$/.test(formatted)
    ? toMinutes(formatted)
    : Number.MAX_SAFE_INTEGER;
}

async function findOverlappingApprovedBookings({
  classroomRef,
  date,
  candidateBooking,
  excludeId = null,
}) {
  const requestsCollection = collection(db, "bookingRequest");
  const approvedQuery = date
    ? query(
      requestsCollection,
      where("status", "==", "APPROVED"),
      where("classroom", "==", classroomRef),
      where("date", "==", date)
    )
    : query(
      requestsCollection,
      where("status", "==", "APPROVED"),
      where("classroom", "==", classroomRef)
    );

  const approvedSnapshot = await getDocs(approvedQuery);
  const docs = approvedSnapshot?.docs || [];

  const conflicts = [];
  for (const docSnapshot of docs) {
    if (excludeId && docSnapshot.id === excludeId) continue;
    const approvedData = docSnapshot.data();
    if (
      isBookingOverlapping(candidateBooking, {
        id: docSnapshot.id,
        ...approvedData,
      })
    ) {
      conflicts.push({ id: docSnapshot.id, ...approvedData });
    }
  }

  return conflicts.sort((a, b) => getStartMinutes(a) - getStartMinutes(b));
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

  const classroomRef = doc(db, "classrooms", resolvedClassroomId);

  const conflicts = await findOverlappingApprovedBookings({
    classroomRef,
    date,
    candidateBooking: {
      classroom: resolvedClassroomId,
      date,
      startTime,
      endTime,
    },
  });

  if (conflicts.length > 0) {
    const occupiedSlots = [
      ...new Set(conflicts.map(formatSlot).filter(Boolean)),
    ];
    if (occupiedSlots.length > 0) {
      const slotLabel =
        occupiedSlots.length === 1
          ? `nella fascia oraria ${occupiedSlots[0]}`
          : `nelle fasce orarie ${occupiedSlots.join(", ")}`;
      throw new Error(
        `Richiesta rifiutata: l'aula è già prenotata il ${date} ${slotLabel}.`
      );
    }
    throw new Error(
      `Richiesta rifiutata: l'aula è già prenotata il ${date} nella fascia oraria richiesta.`
    );
  }

  const startsAt = Timestamp.fromDate(toRomeDate(date, startTime));
  const endsAt = Timestamp.fromDate(toRomeDate(date, endTime));
  const newBooking = {
    classroom: classroomRef,
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

export async function getDepartmentBookingRequests(departmentId, statusFilter = null) {
  if (!departmentId) {
    throw new Error("Dipartimento amministratore non assegnato.");
  }
  const requestsCollection = collection(db, "bookingRequest");
  const deptRef = doc(db, "departments", departmentId);

  let q;
  if (statusFilter && statusFilter !== "ALL") {
    q = query(
      requestsCollection,
      where("department", "==", deptRef),
      where("status", "==", statusFilter)
    );
  } else {
    q = query(
      requestsCollection,
      where("department", "==", deptRef)
    );
  }

  const snapshot = await getDocs(q);
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
            if (classroomDoc && classroomDoc.exists()) {
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

      let professorUniversityId = data.professorUniversityId || "";
      if (!professorUniversityId && data.professor) {
        try {
          const profDocRef =
            typeof data.professor === "string"
              ? doc(db, "users", data.professor)
              : data.professor;
          const profSnapshot = await getDoc(profDocRef);
          if (profSnapshot && profSnapshot.exists()) {
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
        status: data.status || "PENDING",
        rejectionReason: data.rejectionReason || "",
      };
    })
  );

  return requests.sort((a, b) => (
    (a.date || "").localeCompare(b.date || "") ||
    (a.startTime || "").localeCompare(b.startTime || "")
  ));
}

export async function getPendingBookingRequests(departmentId) {
  return getDepartmentBookingRequests(departmentId, "PENDING");
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
    const bookingData = bookingSnapshot.data();
    if (bookingData.status !== "PENDING") {
      throw new Error("È possibile approvare solo richieste in attesa.");
    }

    if (bookingData.classroom && (bookingData.startsAt || bookingData.startTime)) {
      const classroomRef =
        typeof bookingData.classroom === "string"
          ? doc(db, "classrooms", bookingData.classroom)
          : bookingData.classroom;

      let classroomSnapshot = null;
      if (classroomRef && typeof classroomRef === "object") {
        try {
          classroomSnapshot = await transaction.get(classroomRef);
        } catch {
          // Nel caso in cui classroomRef non sia configurato per la get nei mock di test
        }
      }

      const conflicts = await findOverlappingApprovedBookings({
        classroomRef,
        date: bookingData.date,
        candidateBooking: { id: requestId, ...bookingData },
        excludeId: requestId,
      });

      if (conflicts.length > 0) {
        throw new Error(
          "Impossibile approvare la richiesta: l'aula è già prenotata nella fascia oraria richiesta."
        );
      }

      if (
        classroomSnapshot &&
        typeof classroomSnapshot.exists === "function" &&
        classroomSnapshot.exists()
      ) {
        transaction.update(classroomRef, {
          lastBookingApproval: serverTimestamp(),
        });
      }
    }

    transaction.update(bookingRef, {
      status: "APPROVED",
    });
  });
  // creiamo l'ogettto per inviare l'email dai dati ottenuti tramite ref e snapshot
  const bookingSnapshot = await getDoc(bookingRef);//fuori da callback bisogna usare getDoc
  if (!bookingSnapshot.exists()) {
      throw new Error("Richiesta di prenotazione non trovata.");
  }
  const bookingData = bookingSnapshot.data();

  // RIFERIMENTO->SNAPSHOT->DATA, se avessi avuto l'id il ref si trovava con doc(db, nomeDocumento, id)
  const professorSnapshot= await getDoc( bookingData.professor);
  if (!professorSnapshot.exists()) {
      throw new Error("Professore non trovato.");
  }
  const professorData=professorSnapshot.data();

  const classroomSnapshot= await getDoc(bookingData.classroom);
  if (!classroomSnapshot.exists()) {
      throw new Error("Aula non trovata.");
  }

  const classroomData=classroomSnapshot.data();

  await sendEmailService(import.meta.env.VITE_EMAILJS_TEMPLATE_ACCEPTANCE_ID,
    bookingData.professorName, 
    classroomData.name, 
    bookingData.date, 
    formatTime(bookingData.startsAt), 
    formatTime(bookingData.endsAt), 
    professorData.contactEmail)
}

export async function rejectBookingRequest(requestId, rejectReason) {
  if (!requestId) {
    throw new Error("ID della richiesta obbligatorio.");
  }

  if (typeof rejectReason !== "string") {
    throw new Error("Per favore inserisci una stringa di testo valida.");
  }

  const reason = rejectReason.trim();

  if (!reason) {
    throw new Error("Motivazione del rifiuto richiesta.");
  }

  if (reason.length > 500) {
    throw new Error(
      "La motivazione del rifiuto non può superare 500 caratteri."
    );
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
      rejectionReason: reason,
      status: "REJECTED",
    });
  });

  // creiamo l'ogettto per inviare l'email dai dati ottenuti tramite ref e snapshot
  const bookingSnapshot = await getDoc(bookingRef);//fuori da callback bisogna usare getDoc
  if (!bookingSnapshot.exists()) {
      throw new Error("Richiesta di prenotazione non trovata.");
  }
  const bookingData = bookingSnapshot.data();

  // RIFERIMENTO->SNAPSHOT->DATA, se avessi avuto l'id il ref si trovava con doc(db, nomeDocumento, id)
  const professorSnapshot= await getDoc( bookingData.professor);
  if (!professorSnapshot.exists()) {
      throw new Error("Professore non trovato.");
  }
  const professorData=professorSnapshot.data();

  const classroomSnapshot= await getDoc(bookingData.classroom);
  if (!classroomSnapshot.exists()) {
      throw new Error("Aula non trovata.");
  }

  const classroomData=classroomSnapshot.data();

  await sendEmailService(import.meta.env.VITE_EMAILJS_TEMPLATE_REJECTION_ID,
    bookingData.professorName, 
    classroomData.name, 
    bookingData.date, 
    formatTime(bookingData.startsAt), 
    formatTime(bookingData.endsAt), 
    professorData.contactEmail)
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
        startsAt: data.startsAt || null,
        endsAt: data.endsAt || null,
      };
    })
  );
  return requests.sort((a, b) => (
    (b.date || "").localeCompare(a.date || "") ||
    (b.startTime || "").localeCompare(a.startTime || "")
  ));
}

export function isFutureBooking(booking, now = new Date()) {
  if (!booking) return false;

  const nowMs = now instanceof Date ? now.getTime() : Number(now);

  if (booking.startsAt?.toDate) {
    return booking.startsAt.toDate().getTime() > nowMs;
  }
  if (booking.startsAt instanceof Date) {
    return booking.startsAt.getTime() > nowMs;
  }
  if (typeof booking.startsAt === "number") {
    return booking.startsAt > nowMs;
  }

  const rawStart = booking.startsAt || booking.startTime;
  if (booking.date && rawStart) {
    const timeStr = formatTime(rawStart);
    try {
      const dt = toRomeDate(booking.date, timeStr);
      return dt.getTime() > nowMs;
    } catch {
      const dt = new Date(`${booking.date}T${timeStr}:00`);
      return dt.getTime() > nowMs;
    }
  }

  return false;
}

export async function cancelBookingRequest(requestId, professorId = null) {
  if (!requestId) {
    throw new Error("ID della richiesta obbligatorio.");
  }

  const bookingRef = doc(db, "bookingRequest", requestId);
  const bookingSnapshot = await getDoc(bookingRef);

  if (!bookingSnapshot.exists()) {
    throw new Error("Richiesta di prenotazione non trovata.");
  }

  const data = bookingSnapshot.data();

  if (professorId && data.professor) {
    const profId =
      data.professor.id ||
      (typeof data.professor === "string" ? data.professor : null);
    if (profId && profId !== professorId) {
      throw new Error("Non sei autorizzato a cancellare questa richiesta.");
    }
  }

  if (data.status !== "PENDING" && data.status !== "APPROVED") {
    throw new Error(
      "È possibile cancellare solo richieste in attesa o approvate."
    );
  }

  if (!isFutureBooking(data)) {
    throw new Error("Non è possibile cancellare prenotazioni passate.");
  }

  await deleteDoc(bookingRef);
}
