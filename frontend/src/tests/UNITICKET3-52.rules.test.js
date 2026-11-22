
// @vitest-environment node

import { readFileSync } from "node:fs";
import { beforeAll, beforeEach, afterAll, describe, it, expect } from "vitest";
import {
    initializeTestEnvironment,
    assertSucceeds,
    assertFails,
} from "@firebase/rules-unit-testing";
import {
    doc, setDoc, getDoc, updateDoc,
    serverTimestamp, Timestamp,
    collection, query, where, getDocs,
} from "firebase/firestore";

const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST;

if (process.env.REQUIRE_FIRESTORE_RULES === "1" && !emulatorHost) {
    throw new Error("Firebase Emulator non avviato.");
}

describe.skipIf(!emulatorHost)("UNITICKET3-52 - Firestore", () => {
    let env;

    beforeAll(async () => {
        const [host, port] = emulatorHost.split(":");

        env = await initializeTestEnvironment({
            projectId: "demo-uniticket52",
            firestore: {
                host,
                port: Number(port),
                rules: readFileSync(
                    new URL("../../../firestore.rules", import.meta.url),
                    "utf8"
                ),
            },
        });
    });

    beforeEach(async () => {
        await env.clearFirestore();

        await env.withSecurityRulesDisabled(async (context) => {
            const db = context.firestore();
            const demacs = doc(db, "departments/demacs");
            const dispes = doc(db, "departments/dispes");
            const professor = doc(db, "users/prof1");

            await Promise.all([
                setDoc(demacs, { name: "DeMaCS" }),
                setDoc(dispes, { name: "DiSPeS" }),
                setDoc(professor, {
                    role: "PROFESSOR",
                    displayName: "Docente Test",
                    department: demacs,
                }),
                setDoc(doc(db, "users/admin1"), {
                    role: "ADMIN",
                    department: dispes,
                }),
                setDoc(doc(db, "users/admin2"), {
                    role: "ADMIN",
                    department: demacs,
                }),
                setDoc(doc(db, "classrooms/aula2"), {
                    department: dispes,
                }),
                setDoc(doc(db, "departmentAccessRequests/prof1_dispes"), {
                    professor,
                    department: dispes,
                    professorName: "Docente Test",
                    status: "PENDING",
                    createdAt: Timestamp.fromDate(
                        new Date("2026-11-20T10:00:00Z")
                    ),
                }),
            ]);
        });
    });

    afterAll(async () => {
        await env?.cleanup();
    });

    function accessRequest(db) {
        return doc(db, "departmentAccessRequests/prof1_dispes");
    }

    function decide(db, status) {
        return updateDoc(accessRequest(db), {
            status,
            decidedAt: serverTimestamp(),
        });
    }

    function book(db, id) {
        return setDoc(doc(db, "bookingRequest", id), {
            professor: doc(db, "users/prof1"),
            department: doc(db, "departments/dispes"),
            classroom: doc(db, "classrooms/aula2"),
            professorName: "Docente Test",
            date: "2027-01-12",
            startsAt: Timestamp.fromDate(
                new Date("2027-01-12T09:00:00Z")
            ),
            endsAt: Timestamp.fromDate(
                new Date("2027-01-12T10:00:00Z")
            ),
            status: "PENDING",
        });
    }

    it("solo l'admin destinatario approva e abilita le prenotazioni", async () => {
        const admin = env.authenticatedContext("admin1").firestore();
        const otherAdmin = env.authenticatedContext("admin2").firestore();
        const professor = env.authenticatedContext("prof1").firestore();

        // L'admin vede le richieste del suo dipartimento.
        const requests = await assertSucceeds(getDocs(query(
            collection(admin, "departmentAccessRequests"),
            where("department", "==", doc(admin, "departments/dispes"))
        )));
        expect(requests.size).toBe(1);

        // Prima dell'approvazione non si può prenotare.
        await assertFails(book(professor, "booking-before"));

        // Un admin di un altro dipartimento non può decidere.
        await assertFails(decide(otherAdmin, "APPROVED"));

        await assertSucceeds(decide(admin, "APPROVED"));

        // Dopo l'approvazione la prenotazione è permessa.
        await assertSucceeds(book(professor, "booking-after"));

        const saved = await assertSucceeds(
            getDoc(accessRequest(professor))
        );
        expect(saved.data().status).toBe("APPROVED");

        // Il dipartimento principale non cambia.
        const profile = await assertSucceeds(
            getDoc(doc(professor, "users/prof1"))
        );
        expect(profile.data().department.id).toBe("demacs");
    });

    it("il rifiuto non concede permessi di prenotazione", async () => {
        const admin = env.authenticatedContext("admin1").firestore();
        const professor = env.authenticatedContext("prof1").firestore();

        await assertSucceeds(decide(admin, "REJECTED"));

        await assertFails(book(professor, "booking-rejected"));

        // Non è possibile approvare una richiesta già rifiutata.
        await assertFails(decide(admin, "APPROVED"));
    });
});
