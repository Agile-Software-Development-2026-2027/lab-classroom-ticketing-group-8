import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
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
export async function getPendingBookingRequests() {
  const requestsCollection = collection(db, "bookingRequest");
  const pendingQuery = query(requestsCollection, where("status", "==", "PENDING"));
  const snapshot = await getDocs(pendingQuery);

  const requests = await Promise.all(
    snapshot.docs.map(async (docSnapshot) => {
      const data = docSnapshot.data();

      const classroom = data.classroom?.id || (typeof data.classroom === "string" ? data.classroom : "Aula");

      let professorUniversityId = data.professorUniversityId || "";

      if (!professorUniversityId && data.professor) {
        try {
          const profDocRef = typeof data.professor === "string" 
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