import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase/client";


export async function createBookingRequest(date, time_start, time_end, room, professor) {
    if (!date || !time_start || !time_end || !room || !professor || time_start >= time_end) {
        throw new Error("Tutti i campi sono obbligatori e la data di fine deve essere maggiore di quella d'inizio")
    }

}
