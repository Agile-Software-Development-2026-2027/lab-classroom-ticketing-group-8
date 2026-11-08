
// @vitest-environment node
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from "@firebase/rules-unit-testing";

const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST;

if (process.env.REQUIRE_FIRESTORE_RULES === "1" && !emulatorHost) {
  throw new Error("Firebase Emulator non avviato.");
}

describe.skipIf(!emulatorHost)("UNITICKET3-29 - Firestore Rules", () => {
  let testEnv;

  const rules = readFileSync(
    new URL("../../../firestore.rules", import.meta.url),
    "utf8"
  );

  function booking(db, departmentId, classroomId) {
    return {
      classroom: db.doc(`classrooms/${classroomId}`),
      department: db.doc(`departments/${departmentId}`),
      professor: db.doc("users/prof1"),
      professorName: "Professore Test",
      date: "2027-01-12",
      startsAt: new Date("2027-01-12T10:00:00Z"),
      endsAt: new Date("2027-01-12T11:00:00Z"),
      status: "PENDING",
    };
  }

  beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: "demo-uniticket29",
      firestore: {
        host: "127.0.0.1",
        port: 8080,
        rules,
      },
    });
  });

  beforeEach(async () => {
    await testEnv.clearFirestore();

    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();

      await Promise.all([
        db.doc("departments/demacs").set({
          name: "DeMaCS",
        }),
        db.doc("departments/dispes").set({
          name: "DiSPeS",
        }),
        db.doc("users/prof1").set({
          role: "PROFESSOR",
          department: db.doc("departments/demacs"),
        }),
        db.doc("users/admin1").set({
          role: "ADMIN",
          department: db.doc("departments/demacs"),
        }),
        db.doc("classrooms/aula1").set({
          department: db.doc("departments/demacs"),
        }),
        db.doc("classrooms/aula2").set({
          department: db.doc("departments/dispes"),
        }),
      ]);

      await Promise.all([
        db.doc("bookingRequest/req-demacs").set(
          booking(db, "demacs", "aula1")
        ),
        db.doc("bookingRequest/req-dispes").set(
          booking(db, "dispes", "aula2")
        ),
      ]);
    });
  });

  afterAll(async () => {
    await testEnv?.cleanup();
  });

  it("consente al professore prenotazioni nel proprio dipartimento", async () => {
    const db = testEnv.authenticatedContext("prof1").firestore();

    await assertSucceeds(
      db.doc("bookingRequest/valid-request").set(
        booking(db, "demacs", "aula1")
      )
    );
  });

  it("nega prenotazioni del professore in altri dipartimenti", async () => {
    const db = testEnv.authenticatedContext("prof1").firestore();

    await assertFails(
      db.doc("bookingRequest/invalid-request").set(
        booking(db, "dispes", "aula2")
      )
    );
  });

  it("l'admin può gestire solo richieste del proprio dipartimento", async () => {
    const db = testEnv.authenticatedContext("admin1").firestore();

    const ownRequest = db.doc("bookingRequest/req-demacs");
    const otherRequest = db.doc("bookingRequest/req-dispes");

    await assertSucceeds(ownRequest.get());
    await assertFails(otherRequest.get());

    await assertSucceeds(
      ownRequest.update({ status: "APPROVED" })
    );

    await assertFails(
      otherRequest.update({ status: "APPROVED" })
    );
  });

  it("salva il rifiuto e permette al docente di leggee il motivo", async () =>{
    const adminDb = testEnv.authenticatedContext("admin1").firestore();
    const decision = {
      status: "REJECTED",
      rejectionReason: "Aula già occupata",
    };

    await assertSucceeds(
      adminDb.doc("bookingRequest/req-demacs").update(decision)
    );

    const professorDb = testEnv.authenticatedContext("prof1").firestore();
    const snapshot = await assertSucceeds(
      professorDb.doc("bookingRequest/req-demacs").get()
    );

    expect(snapshot.data()).toMatchObject(decision);
  });
});
