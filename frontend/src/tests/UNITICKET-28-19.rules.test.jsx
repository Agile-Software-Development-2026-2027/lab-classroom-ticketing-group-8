// @vitest-environment node

import { readFileSync } from "node:fs";
import { beforeAll, afterAll, beforeEach, it, expect } from "vitest";
import { initializeTestEnvironment, assertSucceeds, assertFails } from "@firebase/rules-unit-testing";
import { collection, doc, getDoc, getDocs, setDoc, Timestamp, updateDoc, query, where } from "firebase/firestore";

let testEnv;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: "demo-uniticket28-19",
    firestore: {
      host: "127.0.0.1",
      port: 8080,
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
    const departmentRef2 = doc(db, "departments", "fis");
 
    const professorRef = doc(db, "users", "prof1");
    const professorRef2 = doc(db, "users", "prof2");
    const professorRef3 = doc(db, "users", "prof3");

    const classroomRef = doc(db, "classrooms", "aula1");
    const classroomRef2 = doc(db, "classrooms", "aula2");


    //settiamo i 5 documenti cosi l'emulatore si ritrova un set di dati pronti
    await setDoc(departmentRef, {
      name: "Dipartimento Test",
    });

    await setDoc(departmentRef2, {
      name: "Dipartimento Test2",
    });

    await setDoc(doc(db, "users", "admin1"), {
      role: "ADMIN",
      department: departmentRef,
    });

    await setDoc(professorRef, {
      role: "PROFESSOR",
      department: departmentRef,
    });
    await setDoc(professorRef2, {
      role: "PROFESSOR",
      department: departmentRef2,
    });

    await setDoc(professorRef3, {
      role: "PROFESSOR",
      department: departmentRef,
    });

    await setDoc(classroomRef, {
      name: "Aula prova",
      department: departmentRef,
    });

    await setDoc(classroomRef2, {
      name: "Aula prova2",
      department: departmentRef2,
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

    await setDoc(doc(db, "bookingRequest", "request2"), {
      classroom: classroomRef,
      department: departmentRef,
      professor: professorRef,
      professorName: "Professore Test",
      date: "2027-01-12",
      startsAt: Timestamp.fromDate(new Date("2027-01-12T10:00:00Z")),
      endsAt: Timestamp.fromDate(new Date("2027-01-12T11:00:00Z")),
      status: "REJECTED",
    });

    await setDoc(doc(db, "bookingRequest", "request3"), {
      classroom: classroomRef,
      department: departmentRef,
      professor: professorRef,
      professorName: "Professore Test",
      date: "2027-01-12",
      startsAt: Timestamp.fromDate(new Date("2027-01-12T10:00:00Z")),
      endsAt: Timestamp.fromDate(new Date("2027-01-12T11:00:00Z")),
      status: "APPROVED",
    });
    await setDoc(doc(db, "bookingRequest", "request4"), {
      classroom: classroomRef2,
      department: departmentRef2,
      professor: professorRef2,
      professorName: "Professore Test",
      date: "2027-01-12",
      startsAt: Timestamp.fromDate(new Date("2027-01-12T10:00:00Z")),
      endsAt: Timestamp.fromDate(new Date("2027-01-12T11:00:00Z")),
      status: "REJECTED",
    });
    await setDoc(doc(db, "bookingRequest", "request5"), {
      classroom: classroomRef,
      department: departmentRef,
      professor: professorRef3,
      professorName: "Professore Test",
      date: "2027-01-12",
      startsAt: Timestamp.fromDate(new Date("2027-01-12T10:00:00Z")),
      endsAt: Timestamp.fromDate(new Date("2027-01-12T11:00:00Z")),
      status: "APPROVED",
    });
  });
});

afterAll(async () => {
  await testEnv?.cleanup();
});

it("visualizza solo la richiesta accettata se ospite", async()=>{

  const unLoggedDb =testEnv.unauthenticatedContext().firestore();
  const guestRequestRefPending= doc(unLoggedDb, "bookingRequest", "request1");//riferimento sulla stesso documento ma da user diverso
  const guestRequestRefRejected= doc(unLoggedDb, "bookingRequest", "request2");//riferimento sulla stesso documento ma da user diverso
  const guestRequestRefAccepted= doc(unLoggedDb, "bookingRequest", "request3");//riferimento sulla stesso documento ma da user diverso


  const guestSnapshotPending= await assertFails(
    getDoc(guestRequestRefPending)
  );
  const guestSnapshotRejected= await assertFails(
    getDoc(guestRequestRefRejected)
  );
  const guestSnapshotAccepted= await assertSucceeds(
    getDoc(guestRequestRefAccepted)
  );


});

it("verifica visibilita richieste da parte del prof", async()=>{
  
  const profDb =testEnv.authenticatedContext("prof1").firestore();
  
  const professorRequestRef= doc(profDb, "bookingRequest", "request3");//sua approvata
  const professorRequestRef2= doc(profDb, "bookingRequest", "request4");//dip diverso approvata
  const professorRequestRef3= doc(profDb, "bookingRequest", "request5");//stesso dip non sua approvata
  const professorRequestRef4= doc(profDb, "bookingRequest", "request2");

  const guestSnapshot1= await assertSucceeds(
    getDoc( professorRequestRef)
  );
  const guestSnapshot2= await assertFails(
    getDoc( professorRequestRef2)
  );
  const guestSnapshot3= await assertSucceeds(
    getDoc( professorRequestRef3)
  );
  const guestSnapshot4= await assertSucceeds(
    getDoc( professorRequestRef4)
  );

  
});

