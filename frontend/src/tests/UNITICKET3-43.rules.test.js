
// @vitest-environment node

import { readFileSync } from "node:fs";
import { beforeAll, beforeEach, afterAll, describe, it } from "vitest";
import {
    initializeTestEnvironment,
    assertSucceeds,
    assertFails,
} from "@firebase/rules-unit-testing";
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";

const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST;

if (process.env.REQUIRE_FIRESTORE_RULES === "1" && !emulatorHost) {
    throw new Error("Firebase Emulator non avviato.");
}

describe.skipIf(!emulatorHost)("UNITICKET3-43 - Firestore", () => {
    let env;

    beforeAll(async () => {
        const [host, port] = emulatorHost.split(":");

        env = await initializeTestEnvironment({
            projectId: "demo-uniticket43",
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

            await Promise.all([
                setDoc(doc(db, "departments/demacs"), { name: "DeMaCS" }),
                setDoc(doc(db, "departments/dispes"), { name: "DiSPeS" }),
                setDoc(doc(db, "users/prof1"), {
                    role: "PROFESSOR",
                    displayName: "Docente Test",
                    department: doc(db, "departments/demacs"),
                }),
                setDoc(doc(db, "classrooms/aula2"), {
                    department: doc(db, "departments/dispes"),
                }),
            ]);
        });
    });

    afterAll(async () => {
        await env?.cleanup();
    });

    function request(db) {
        return {
            professor: doc(db, "users/prof1"),
            department: doc(db, "departments/dispes"),
            professorName: "Docente Test",
            status: "PENDING",
            createdAt: serverTimestamp(),
        };
    }

    it("crea e legge la propria richiesta PENDING", async () => {
        const db = env.authenticatedContext("prof1").firestore();
        const ref = doc(db, "departmentAccessRequests/prof1_dispes");

        await assertSucceeds(setDoc(ref, request(db)));
        await assertSucceeds(getDoc(ref));
    });

    it("impedisce richieste duplicate", async () => {
        const db = env.authenticatedContext("prof1").firestore();
        const ref = doc(db, "departmentAccessRequests/prof1_dispes");

        await assertSucceeds(setDoc(ref, request(db)));
        await assertFails(setDoc(ref, request(db)));
    });

    it("PENDING non autorizza prenotazioni in altri dipartimenti", async () => {
        const db = env.authenticatedContext("prof1").firestore();

        await assertSucceeds(
            setDoc(doc(db, "departmentAccessRequests/prof1_dispes"), request(db))
        );

        await assertFails(
            setDoc(doc(db, "bookingRequest/booking1"), {
                professor: doc(db, "users/prof1"),
                department: doc(db, "departments/dispes"),
                classroom: doc(db, "classrooms/aula2"),
                professorName: "Docente Test",
                date: "2027-01-12",
                startsAt: new Date("2027-01-12T09:00:00Z"),
                endsAt: new Date("2027-01-12T10:00:00Z"),
                status: "PENDING",
            })
        );
    });
});
