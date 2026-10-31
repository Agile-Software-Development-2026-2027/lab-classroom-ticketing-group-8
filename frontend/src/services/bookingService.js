import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase/client";


export function validateBookingData(data) {
    if (!data) {
        throw new Error("I dati della richiesta sono obbligatori.");
    }

    const { date, startTime, endTime, classroom, professorId } = data;

    if (!date || !startTime || !endTime || !classroom || !professorId) {
        throw new Error("Tutti i campi obbligatori devono essere compilati.");
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