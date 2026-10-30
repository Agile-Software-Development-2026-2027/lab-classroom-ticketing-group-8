import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase/client";


export function validateBookingData(data) {
    if (!data) {
        throw new Error("I dati della richiesta sono obbligatori.");
    }

    const { date, startTime, endTime, room, professorId } = data;

    if (!date || !startTime || !endTime || !room || !professorId) {
        throw new Error("Tutti i campi obbligatori devono essere compilati.");
    }

    if (startTime >= endTime) {
        throw new Error("L'orario di fine deve essere successivo all'orario di inizio.");
    }
}

export async function createBookingRequest(bookingData) {
    validateBookingData(bookingData);

    // 2. Prepariamo l'oggetto definitivo da salvare su Firestore
    // impostando lo stato obbligatorio "PENDING" richiesto da Jira\
    const newBooking = {
        ...bookingData,
        status: "PENDING",
        createdAt: serverTimestamp(),
    };

    // 3. Salviamo su Firestore nella collezione "bookings"
    const docRef = await addDoc(collection(db, "bookings"), newBooking);

    // Restituiamo l'ID del documento creato (utile per conferme a schermo)
    return docRef.id;
}