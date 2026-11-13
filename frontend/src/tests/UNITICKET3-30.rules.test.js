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

describe.skipIf(!emulatorHost)("UNITICKET3-30 - Firestore Rules", () => {
  let testEnv;

  const rules = readFileSync(
    new URL("../../../firestore.rules", import.meta.url),
    "utf8"
  );

  beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: "demo-uniticket30",
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
        db.doc("users/prof1").set({
          role: "PROFESSOR",
          department: db.doc("departments/demacs"),
        }),
        db.doc("users/adminDemacs").set({
          role: "ADMIN",
          department: db.doc("departments/demacs"),
        }),
        db.doc("users/adminDispes").set({
          role: "ADMIN",
          department: db.doc("departments/dispes"),
        }),
        db.doc("classrooms/aula1").set({
          name: "Aula 1",
          department: db.doc("departments/demacs"),
        }),
      ]);
    });
  });

  afterAll(async () => {
    await testEnv?.cleanup();
  });

  it("consente all'admin del dipartimento assegnato di aggiornare l'aula (concurrency lock)", async () => {
    const db = testEnv.authenticatedContext("adminDemacs").firestore();
    await assertSucceeds(
      db.doc("classrooms/aula1").update({
        lastBookingApproval: new Date(),
      })
    );
  });

  it("impedisce all'admin di un altro dipartimento di aggiornare l'aula", async () => {
    const db = testEnv.authenticatedContext("adminDispes").firestore();
    await assertFails(
      db.doc("classrooms/aula1").update({
        lastBookingApproval: new Date(),
      })
    );
  });

  it("impedisce a un professore di aggiornare l'aula", async () => {
    const db = testEnv.authenticatedContext("prof1").firestore();
    await assertFails(
      db.doc("classrooms/aula1").update({
        lastBookingApproval: new Date(),
      })
    );
  });

  it("impedisce all'admin di modificare campi protetti dell'aula (es. name o department)", async () => {
    const db = testEnv.authenticatedContext("adminDemacs").firestore();
    await assertFails(
      db.doc("classrooms/aula1").update({
        name: "Nome Modificato",
      })
    );
  });

  it("impedisce a un utente non autenticato di aggiornare l'aula", async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(
      db.doc("classrooms/aula1").update({
        lastBookingApproval: new Date(),
      })
    );
  });
});

