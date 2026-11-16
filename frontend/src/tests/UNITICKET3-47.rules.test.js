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

describe.skipIf(!emulatorHost)("UNITICKET3-47 - Firestore Rules", () => {
  let testEnv;

  const rules = readFileSync(
    new URL("../../../firestore.rules", import.meta.url),
    "utf8"
  );

  beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: "demo-uniticket47",
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
        db.doc("departments/demacs").set({ name: "DeMaCS" }),
        db.doc("departments/dispes").set({ name: "DiSPeS" }),

        db.doc("users/adminDemacs").set({
          role: "ADMIN",
          department: db.doc("departments/demacs"),
        }),
        db.doc("users/adminDispes").set({
          role: "ADMIN",
          department: db.doc("departments/dispes"),
        }),
        db.doc("users/prof1").set({
          role: "PROFESSOR",
          department: db.doc("departments/demacs"),
        }),
        db.doc("users/prof2").set({
          role: "PROFESSOR",
          department: db.doc("departments/demacs"),
        }),

        db.doc("classrooms/aulaDemacs").set({
          name: "Aula Demacs",
          department: db.doc("departments/demacs"),
        }),
        db.doc("classrooms/aulaDispes").set({
          name: "Aula Dispes",
          department: db.doc("departments/dispes"),
        }),

        // Demacs requests
        db.doc("bookingRequest/demacsPending").set({
          classroom: db.doc("classrooms/aulaDemacs"),
          department: db.doc("departments/demacs"),
          professor: db.doc("users/prof1"),
          professorName: "Prof. Uno",
          date: "2026-11-20",
          startsAt: new Date("2026-11-20T09:00:00Z"),
          endsAt: new Date("2026-11-20T11:00:00Z"),
          status: "PENDING",
        }),
        db.doc("bookingRequest/demacsApproved").set({
          classroom: db.doc("classrooms/aulaDemacs"),
          department: db.doc("departments/demacs"),
          professor: db.doc("users/prof1"),
          professorName: "Prof. Uno",
          date: "2026-11-20",
          startsAt: new Date("2026-11-20T11:00:00Z"),
          endsAt: new Date("2026-11-20T13:00:00Z"),
          status: "APPROVED",
        }),
        db.doc("bookingRequest/demacsRejected").set({
          classroom: db.doc("classrooms/aulaDemacs"),
          department: db.doc("departments/demacs"),
          professor: db.doc("users/prof1"),
          professorName: "Prof. Uno",
          date: "2026-11-20",
          startsAt: new Date("2026-11-20T14:00:00Z"),
          endsAt: new Date("2026-11-20T16:00:00Z"),
          status: "REJECTED",
          rejectionReason: "Aula occupata",
        }),

        // Dispes requests
        db.doc("bookingRequest/dispesPending").set({
          classroom: db.doc("classrooms/aulaDispes"),
          department: db.doc("departments/dispes"),
          professor: db.doc("users/prof2"),
          professorName: "Prof. Due",
          date: "2026-11-20",
          startsAt: new Date("2026-11-20T09:00:00Z"),
          endsAt: new Date("2026-11-20T11:00:00Z"),
          status: "PENDING",
        }),
        db.doc("bookingRequest/dispesRejected").set({
          classroom: db.doc("classrooms/aulaDispes"),
          department: db.doc("departments/dispes"),
          professor: db.doc("users/prof2"),
          professorName: "Prof. Due",
          date: "2026-11-20",
          startsAt: new Date("2026-11-20T14:00:00Z"),
          endsAt: new Date("2026-11-20T16:00:00Z"),
          status: "REJECTED",
          rejectionReason: "Non idonea",
        }),
      ]);
    });
  });

  afterAll(async () => {
    await testEnv?.cleanup();
  });

  describe("Criterio 1: Gli amministratori possono visualizzare le richieste del proprio dipartimento", () => {
    it("consente all'admin di leggere una richiesta in stato PENDING del proprio dipartimento", async () => {
      const db = testEnv.authenticatedContext("adminDemacs").firestore();
      await assertSucceeds(db.doc("bookingRequest/demacsPending").get());
    });

    it("consente all'admin di leggere una richiesta in stato APPROVED del proprio dipartimento", async () => {
      const db = testEnv.authenticatedContext("adminDemacs").firestore();
      await assertSucceeds(db.doc("bookingRequest/demacsApproved").get());
    });

    it("consente all'admin di leggere una richiesta in stato REJECTED del proprio dipartimento", async () => {
      const db = testEnv.authenticatedContext("adminDemacs").firestore();
      await assertSucceeds(db.doc("bookingRequest/demacsRejected").get());
    });
  });

  describe("Criterio 3: Gli amministratori NON possono visualizzare le richieste di altri dipartimenti", () => {
    it("impedisce all'admin di leggere una richiesta PENDING di un altro dipartimento", async () => {
      const db = testEnv.authenticatedContext("adminDispes").firestore();
      await assertFails(db.doc("bookingRequest/demacsPending").get());
    });

    it("impedisce all'admin di leggere una richiesta REJECTED di un altro dipartimento", async () => {
      const db = testEnv.authenticatedContext("adminDispes").firestore();
      await assertFails(db.doc("bookingRequest/demacsRejected").get());
    });

    it("impedisce all'admin di Demacs di leggere una richiesta PENDING di Dispes", async () => {
      const db = testEnv.authenticatedContext("adminDemacs").firestore();
      await assertFails(db.doc("bookingRequest/dispesPending").get());
    });

    it("impedisce all'admin di Demacs di leggere una richiesta REJECTED di Dispes", async () => {
      const db = testEnv.authenticatedContext("adminDemacs").firestore();
      await assertFails(db.doc("bookingRequest/dispesRejected").get());
    });

    it("impedisce a un utente non autenticato di leggere richieste PENDING o REJECTED", async () => {
      const db = testEnv.unauthenticatedContext().firestore();
      await assertFails(db.doc("bookingRequest/demacsPending").get());
      await assertFails(db.doc("bookingRequest/demacsRejected").get());
    });

    it("impedisce a un altro professore dello stesso dipartimento di leggere richieste PENDING o REJECTED non proprie", async () => {
      const db = testEnv.authenticatedContext("prof2").firestore();
      await assertFails(db.doc("bookingRequest/demacsPending").get());
      await assertFails(db.doc("bookingRequest/demacsRejected").get());
    });
  });
});
