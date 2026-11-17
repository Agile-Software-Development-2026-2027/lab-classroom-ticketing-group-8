// @vitest-environment node
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  deleteDoc,
  doc,
  setDoc,
  Timestamp,
} from "firebase/firestore";

const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST;

if (process.env.REQUIRE_FIRESTORE_RULES === "1" && !emulatorHost) {
  throw new Error("Firebase Emulator non avviato.");
}

describe.skipIf(!emulatorHost)("UNITICKET3-35 - Firestore Rules (Cancellazione)", () => {
  let testEnv;
  const [host, port] = emulatorHost
    ? emulatorHost.split(":")
    : ["127.0.0.1", "8080"];

  const rules = readFileSync(
    new URL("../../../firestore.rules", import.meta.url),
    "utf8"
  );

  beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: "demo-uniticket35",
      firestore: {
        host,
        port: Number(port),
        rules,
      },
    });
  });

  beforeEach(async () => {
    await testEnv.clearFirestore();

    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      const deptRef = doc(db, "departments", "demacs");
      const aulaRef = doc(db, "classrooms", "aula1");
      const prof1Ref = doc(db, "users", "prof1");
      const prof2Ref = doc(db, "users", "prof2");
      const adminRef = doc(db, "users", "admin1");

      const futureDate = "2099-12-01";
      const futureStart = Timestamp.fromDate(new Date("2099-12-01T10:00:00Z"));
      const futureEnd = Timestamp.fromDate(new Date("2099-12-01T12:00:00Z"));

      const pastDate = "2020-01-01";
      const pastStart = Timestamp.fromDate(new Date("2020-01-01T10:00:00Z"));
      const pastEnd = Timestamp.fromDate(new Date("2020-01-01T12:00:00Z"));

      await Promise.all([
        setDoc(deptRef, { name: "DeMaCS" }),
        setDoc(prof1Ref, { role: "PROFESSOR", department: deptRef }),
        setDoc(prof2Ref, { role: "PROFESSOR", department: deptRef }),
        setDoc(adminRef, { role: "ADMIN", department: deptRef }),
        setDoc(aulaRef, { name: "Aula 1", department: deptRef }),

        // prof1 - futura PENDING
        setDoc(doc(db, "bookingRequest", "prof1_future_pending"), {
          classroom: aulaRef,
          department: deptRef,
          professor: prof1Ref,
          professorName: "Prof. Uno",
          date: futureDate,
          startsAt: futureStart,
          endsAt: futureEnd,
          status: "PENDING",
        }),

        // prof1 - futura APPROVED
        setDoc(doc(db, "bookingRequest", "prof1_future_approved"), {
          classroom: aulaRef,
          department: deptRef,
          professor: prof1Ref,
          professorName: "Prof. Uno",
          date: futureDate,
          startsAt: futureStart,
          endsAt: futureEnd,
          status: "APPROVED",
        }),

        // prof1 - futura REJECTED
        setDoc(doc(db, "bookingRequest", "prof1_future_rejected"), {
          classroom: aulaRef,
          department: deptRef,
          professor: prof1Ref,
          professorName: "Prof. Uno",
          date: futureDate,
          startsAt: futureStart,
          endsAt: futureEnd,
          status: "REJECTED",
          rejectionReason: "Aula occupata",
        }),

        // prof1 - passata APPROVED
        setDoc(doc(db, "bookingRequest", "prof1_past_approved"), {
          classroom: aulaRef,
          department: deptRef,
          professor: prof1Ref,
          professorName: "Prof. Uno",
          date: pastDate,
          startsAt: pastStart,
          endsAt: pastEnd,
          status: "APPROVED",
        }),

        // prof2 - futura PENDING
        setDoc(doc(db, "bookingRequest", "prof2_future_pending"), {
          classroom: aulaRef,
          department: deptRef,
          professor: prof2Ref,
          professorName: "Prof. Due",
          date: futureDate,
          startsAt: futureStart,
          endsAt: futureEnd,
          status: "PENDING",
        }),
      ]);
    });
  });

  afterAll(async () => {
    if (testEnv) {
      await testEnv.cleanup();
    }
  });

  it("consente a un professore di cancellare la propria richiesta futura in stato PENDING", async () => {
    const profDb = testEnv.authenticatedContext("prof1").firestore();
    await assertSucceeds(
      deleteDoc(doc(profDb, "bookingRequest", "prof1_future_pending"))
    );
  });

  it("consente a un professore di cancellare la propria richiesta futura in stato APPROVED", async () => {
    const profDb = testEnv.authenticatedContext("prof1").firestore();
    await assertSucceeds(
      deleteDoc(doc(profDb, "bookingRequest", "prof1_future_approved"))
    );
  });

  it("impedisce a un professore di cancellare una propria richiesta in stato REJECTED", async () => {
    const profDb = testEnv.authenticatedContext("prof1").firestore();
    await assertFails(
      deleteDoc(doc(profDb, "bookingRequest", "prof1_future_rejected"))
    );
  });

  it("impedisce a un professore di cancellare una prenotazione passata", async () => {
    const profDb = testEnv.authenticatedContext("prof1").firestore();
    await assertFails(
      deleteDoc(doc(profDb, "bookingRequest", "prof1_past_approved"))
    );
  });

  it("impedisce a un professore di cancellare la richiesta di un altro professore", async () => {
    const profDb = testEnv.authenticatedContext("prof1").firestore();
    await assertFails(
      deleteDoc(doc(profDb, "bookingRequest", "prof2_future_pending"))
    );
  });

  it("impedisce a un utente non autenticato o admin di cancellare la richiesta", async () => {
    const anonDb = testEnv.unauthenticatedContext().firestore();
    await assertFails(
      deleteDoc(doc(anonDb, "bookingRequest", "prof1_future_pending"))
    );

    const adminDb = testEnv.authenticatedContext("admin1").firestore();
    await assertFails(
      deleteDoc(doc(adminDb, "bookingRequest", "prof1_future_pending"))
    );
  });
});
