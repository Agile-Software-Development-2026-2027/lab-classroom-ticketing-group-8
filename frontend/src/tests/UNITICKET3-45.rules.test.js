// @vitest-environment node

import { readFileSync } from "node:fs";
import { beforeAll, afterAll, beforeEach, it, expect, describe } from "vitest";
import { initializeTestEnvironment, assertSucceeds, assertFails } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, Timestamp, updateDoc } from "firebase/firestore";

const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST;

if (process.env.REQUIRE_FIRESTORE_RULES === "1" && !emulatorHost) {
  throw new Error("Firebase Emulator non avviato.");
}

describe.skipIf(!emulatorHost)("UNITICKET3-45 - Firestore Rules", () => {
  let testEnv;

  beforeAll(async () => {
    const [host, port] = emulatorHost ? emulatorHost.split(":") : ["127.0.0.1", "8080"];
    testEnv = await initializeTestEnvironment({
      projectId: "demo-uniticket45",
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

  //prepariamo uno scenario emulato prima di ogni set di test cosi ogni test si troa request1 pura anche se quelli prima l'hanno usata
  beforeEach(async () => {
    // Ogni test parte da un database di prova vuoto.
    await testEnv.clearFirestore();

    // Prepariamo i dati iniziali usando un contesto privilegiato.
    //disabilitiamo le regole cosi da poter fare ogni passaggio liberamente
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();

      //creiamo i riferimenti ai documenti che utilizzeremo
      const departmentRef = doc(db, "departments", "demacs");
      const professorRef = doc(db, "users", "prof1");
      const classroomRef = doc(db, "classrooms", "aula1");

      //settiamo i 5 documenti cosi l'emulatore si ritrova un set di dati pronti
      await setDoc(departmentRef, {
        name: "Dipartimento Test",
      });

      await setDoc(doc(db, "users", "admin1"), {
        role: "ADMIN",
        department: departmentRef,
      });

      await setDoc(professorRef, {
        role: "PROFESSOR",
        department: departmentRef,
      });

      await setDoc(classroomRef, {
        name: "Aula prova",
        department: departmentRef,
      });

      await setDoc(doc(db, "bookingRequest", "request1"), {
        classroom: classroomRef,
        department: departmentRef,
        professor: professorRef,
        professorName: "Professore Test",
        date: "2027-01-12",
        startsAt: Timestamp.fromDate(new Date("2027-01-12T10:00:00Z")),
        endsAt: Timestamp.fromDate(new Date("2027-01-12T11:00:00Z")),
        status: "PENDING",
      });
    });
  });

  afterAll(async () => {
    await testEnv?.cleanup();
  });

  it("salva lo stato REJECTED e la motivazione inserita dall'admin", async () => {
    //creiamoun client admin e una booking request di test con id request1  
    //entrambi saranno documenti emulati nel set up di questo test
    const adminDb = testEnv.authenticatedContext("admin1").firestore();
    const requestRef = doc(adminDb, "bookingRequest", "request1");

    await assertSucceeds(
      updateDoc(requestRef, {
        status: "REJECTED",
        rejectionReason: "Aula occupata",
      })
    );

    const savedRequest = await getDoc(requestRef);

    expect(savedRequest.data()).toMatchObject({
      status: "REJECTED",
      rejectionReason: "Aula occupata",
    });
  });

  it("Blocca un rifiuto con una motivazione vuota", async () => {
    const adminDb = testEnv.authenticatedContext("admin1").firestore();
    const requestRef = doc(adminDb, "bookingRequest", "request1");

    await assertFails(
      updateDoc(requestRef, {
        status: "REJECTED",
        rejectionReason: " ",
      })
    );

    const savedRequest = await getDoc(requestRef);

    expect(savedRequest.data()).toMatchObject({
      status: "PENDING",
    });
  });

  it(" Blocca la modifica della motivazione da parte di un prof", async () => {
    const profDb = testEnv.authenticatedContext("prof1").firestore();
    const requestRef = doc(profDb, "bookingRequest", "request1");

    await assertFails(
      updateDoc(requestRef, {
        status: "REJECTED",
        rejectionReason: " questa motivazione non dovrebbe esistere",
      })
    );

    const savedRequest = await getDoc(requestRef);
    expect(savedRequest.data()).toMatchObject({
      status: "PENDING",
    });

    expect(savedRequest.data()).not.toHaveProperty("rejectionReason");
  });

  it("permette al professore di leggere la motivazione del rifiuto della propria richiesta", async () => {
    const adminDb = testEnv.authenticatedContext("admin1").firestore();
    const requestRef = doc(adminDb, "bookingRequest", "request1");

    await assertSucceeds(
      updateDoc(requestRef, {
        status: "REJECTED",
        rejectionReason: "Aula occupata",
      })
    );

    const savedRequest = await getDoc(requestRef);

    expect(savedRequest.data()).toMatchObject({
      status: "REJECTED",
      rejectionReason: "Aula occupata",
    });

    const profDb = testEnv.authenticatedContext("prof1").firestore();
    const professorRequestRef = doc(profDb, "bookingRequest", "request1");

    const professorSnapshot = await assertSucceeds(
      getDoc(professorRequestRef)
    );

    expect(professorSnapshot.data()).toMatchObject({
      status: "REJECTED",
      rejectionReason: "Aula occupata",
    });
  });
});
