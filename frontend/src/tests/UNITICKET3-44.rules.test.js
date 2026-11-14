// @vitest-environment node
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  collection,
  doc,
  getDocs,
  query,
  setDoc,
  Timestamp,
  where,
} from "firebase/firestore";

const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST;

if (process.env.REQUIRE_FIRESTORE_RULES === "1" && !emulatorHost) {
  throw new Error("Firebase Emulator non avviato.");
}

describe.skipIf(!emulatorHost)("UNITICKET3-44 - Firestore Rules", () => {
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
      projectId: "demo-uniticket44",
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

      await Promise.all([
        setDoc(deptRef, { name: "DeMaCS" }),
        setDoc(prof1Ref, { role: "PROFESSOR", department: deptRef }),
        setDoc(prof2Ref, { role: "PROFESSOR", department: deptRef }),
        setDoc(aulaRef, { name: "Aula 1", department: deptRef }),
      ]);

      await Promise.all([
        setDoc(doc(db, "bookingRequest", "approved-prof2"), {
          classroom: aulaRef,
          department: deptRef,
          professor: prof2Ref,
          professorName: "Prof. Bianchi",
          date: "2027-01-12",
          startsAt: Timestamp.fromDate(new Date("2027-01-12T09:00:00Z")),
          endsAt: Timestamp.fromDate(new Date("2027-01-12T11:00:00Z")),
          status: "APPROVED",
        }),
        setDoc(doc(db, "bookingRequest", "pending-prof2"), {
          classroom: aulaRef,
          department: deptRef,
          professor: prof2Ref,
          professorName: "Prof. Bianchi",
          date: "2027-01-12",
          startsAt: Timestamp.fromDate(new Date("2027-01-12T14:00:00Z")),
          endsAt: Timestamp.fromDate(new Date("2027-01-12T15:00:00Z")),
          status: "PENDING",
        }),
      ]);
    });
  });

  afterAll(async () => {
    await testEnv?.cleanup();
  });

  it("consente al professore la query sulle prenotazioni APPROVED di un'aula/data per rilevare conflitti", async () => {
    const profDb = testEnv.authenticatedContext("prof1").firestore();
    const q = query(
      collection(profDb, "bookingRequest"),
      where("status", "==", "APPROVED"),
      where("classroom", "==", doc(profDb, "classrooms", "aula1")),
      where("date", "==", "2027-01-12")
    );

    const snapshot = await assertSucceeds(getDocs(q));
    expect(snapshot.docs.map((d) => d.id)).toEqual(["approved-prof2"]);
  });

  it("nega al professore la query sulle richieste PENDING di altri docenti", async () => {
    const profDb = testEnv.authenticatedContext("prof1").firestore();
    const q = query(
      collection(profDb, "bookingRequest"),
      where("status", "==", "PENDING"),
      where("classroom", "==", doc(profDb, "classrooms", "aula1")),
      where("date", "==", "2027-01-12")
    );

    await assertFails(getDocs(q));
  });

  it("impedisce al professore di creare direttamente una prenotazione già in stato REJECTED", async () => {
    const profDb = testEnv.authenticatedContext("prof1").firestore();
    await assertFails(
      setDoc(doc(profDb, "bookingRequest", "self-rejected"), {
        classroom: doc(profDb, "classrooms", "aula1"),
        department: doc(profDb, "departments", "demacs"),
        professor: doc(profDb, "users", "prof1"),
        professorName: "Prof. Rossi",
        date: "2027-01-12",
        startsAt: Timestamp.fromDate(new Date("2027-01-12T09:00:00Z")),
        endsAt: Timestamp.fromDate(new Date("2027-01-12T10:00:00Z")),
        status: "REJECTED",
        rejectionReason: "Tentativo non consentito",
      })
    );
  });
});
