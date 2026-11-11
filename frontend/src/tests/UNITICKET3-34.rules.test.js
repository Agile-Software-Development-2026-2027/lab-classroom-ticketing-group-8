
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

describe.skipIf(!emulatorHost)("UNITICKET3-34 - Firestore Rules", () => {
  let testEnv;
  const [host, port] = emulatorHost
    ? emulatorHost.split(":")
    : ["127.0.0.1", "8080"];

  const rules = readFileSync(
    new URL("../../../firestore.rules", import.meta.url),
    "utf8"
  );

  function toUtcDate(date, time, offsetHours) {
    const [year, month, day] = date.split("-").map(Number);
    const [hours, minutes] = time.split(":").map(Number);
    return new Date(
      Date.UTC(year, month - 1, day, hours - offsetHours, minutes)
    );
  }

  function booking(
    db,
    startTime,
    endTime,
    date = "2027-01-12",
    offsetHours = 1
  ) {
    return {
      classroom: db.doc("classrooms/aula1"),
      department: db.doc("departments/demacs"),
      professor: db.doc("users/prof1"),
      professorName: "Professore Test",
      date,
      startsAt: toUtcDate(date, startTime, offsetHours),
      endsAt: toUtcDate(date, endTime, offsetHours),
      status: "PENDING",
    };
  }

  beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: "demo-uniticket34",
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
      await Promise.all([
        db.doc("departments/demacs").set({ name: "DeMaCS" }),
        db.doc("departments/dispes").set({ name: "DiSPeS" }),
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
    });
  });

  afterAll(async () => {
    await testEnv?.cleanup();
  });

  it.each([
    ["08:30", "09:30"],
    ["09:00", "10:00"],
    ["10:00", "12:00"],
    ["18:30", "19:30"],
  ])("accetta %s - %s", async (start, end) => {
    const db = testEnv.authenticatedContext("prof1").firestore();
    await assertSucceeds(
      db.doc("bookingRequest/valid").set(
        booking(db, start, end)
      )
    );
  });

  it.each([
    ["08:29", "09:30"],
    ["18:31", "19:30"],
    ["18:00", "19:31"],
    ["10:00", "10:59"],
    ["10:00", "10:00"],
    ["11:00", "10:00"],
  ])("rifiuta %s - %s", async (start, end) => {
    const db = testEnv.authenticatedContext("prof1").firestore();
    await assertFails(
      db.doc("bookingRequest/invalid").set(
        booking(db, start, end)
      )
    );
  });

  it("rifiuta una data incoerente con i timestamp", async () => {
    const db = testEnv.authenticatedContext("prof1").firestore();
    const data = booking(db, "10:00", "11:00");
    data.date = "2027-01-13";
    await assertFails(
      db.doc("bookingRequest/wrong-date").set(data)
    );
  });

  it("accetta gli orari durante l'ora legale", async () => {
    const db = testEnv.authenticatedContext("prof1").firestore();
    await assertSucceeds(
      db.doc("bookingRequest/summer").set(
        booking(db, "08:30", "09:30", "2027-07-12", 2)
      )
    );
  });

  it("rifiuta un orario fuori limite durante l'ora legale", async () => {
    const db = testEnv.authenticatedContext("prof1").firestore();
    await assertFails(
      db.doc("bookingRequest/summer-invalid").set(
        booking(db, "08:29", "09:30", "2027-07-12", 2)
      )
    );
  });

  it("gestisce il cambio all'ora legale di marzo", async () => {
    const db = testEnv.authenticatedContext("prof1").firestore();
    await assertSucceeds(
      db.doc("bookingRequest/march").set(
        booking(db, "08:30", "09:30", "2027-03-28", 2)
      )
    );
  });

  it("gestisce il ritorno all'ora solare di ottobre", async () => {
    const db = testEnv.authenticatedContext("prof1").firestore();
    await assertSucceeds(
      db.doc("bookingRequest/october").set(
        booking(db, "08:30", "09:30", "2027-10-31", 1)
      )
    );
  });

  it("rifiuta una prenotazione di un altro dipartimento", async () => {
    const db = testEnv.authenticatedContext("prof1").firestore();
    const data = booking(db, "10:00", "11:00");
    data.department = db.doc("departments/dispes");
    data.classroom = db.doc("classrooms/aula2");
    await assertFails(
      db.doc("bookingRequest/other-department").set(data)
    );
  });

  it("consente all'admin di approvare una richiesta valida", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await db.doc("bookingRequest/pending").set(
        booking(db, "10:00", "11:00")
      );
    });
    const db = testEnv.authenticatedContext("admin1").firestore();
    await assertSucceeds(
      db.doc("bookingRequest/pending").update({
        status: "APPROVED",
      })
    );
  });
});
