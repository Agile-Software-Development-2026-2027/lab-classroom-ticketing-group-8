// @vitest-environment node

import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { doc, getDoc, runTransaction, Timestamp } from "firebase/firestore";
import { approveBookingRequest } from "../services/bookingService";
import { sendEmailService } from "../services/emailService";

// Intercettiamo la richiesta di invio: EmailJS non viene contattato.
vi.mock("../services/emailService", () => ({
  sendEmailService: vi.fn(),
}));

// Evitiamo l'inizializzazione del vero client Firebase.
vi.mock("../firebase/client", () => ({
  db: {},
}));

// Conserviamo gli altri export, compreso Timestamp,
// e sostituiamo le operazioni usate da questi due test.
vi.mock("firebase/firestore", async (importOriginal) => {
  const originalModule = await importOriginal();

  return {
    ...originalModule,
    doc: vi.fn(),
    getDoc: vi.fn(),
    runTransaction: vi.fn(),
  };
});

beforeEach(() => {
  // Ogni test parte senza chiamate o risposte dei test precedenti.
  vi.resetAllMocks();

  // Configurazione finta: non servono gli ID reali del tuo account.
  vi.stubEnv(
    "VITE_EMAILJS_TEMPLATE_ACCEPTANCE_ID",
    "template-acceptance-test"
  );

  // doc() restituisce un riferimento finto, identificato dal percorso.
  vi.mocked(doc).mockImplementation((_db, collectionName, id) => ({
    path: collectionName + "/" + id,
  }));

  // Simuliamo un invio concluso positivamente.
  vi.mocked(sendEmailService).mockResolvedValue({
    status: 200,
    text: "OK",
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("UNITICKET3-51 - Email di conferma", () => {
  it("passa i dati corretti al servizio email dopo l'approvazione", async () => {
    const professorRef = { path: "users/prof1" };
    const classroomRef = { path: "classrooms/aula1" };

    // Documenti finti che il servizio leggerà dopo l'approvazione.
    const documents = {
      "bookingRequest/request1": {
        status: "APPROVED",
        professor: professorRef,
        classroom: classroomRef,
        professorName: "Professore Test",
        date: "2027-01-12",

        // A gennaio, 09:00 UTC corrisponde alle 10:00 a Roma.
        startsAt: Timestamp.fromDate(new Date("2027-01-12T09:00:00Z")),
        endsAt: Timestamp.fromDate(new Date("2027-01-12T10:00:00Z")),
      },
      "users/prof1": {
        email: "100001@uniroom.test",
        contactEmail: "professore@example.com",
      },
      "classrooms/aula1": {
        name: "Aula 1",
      },
    };

    // Simuliamo soltanto l'esito positivo della transazione.
    vi.mocked(runTransaction).mockResolvedValue(undefined);

    // Ogni lettura riceve lo snapshot del documento richiesto.
    vi.mocked(getDoc).mockImplementation(async (reference) => {
      const data = documents[reference.path];

      return {
        exists: () => data !== undefined,
        data: () => data,
      };
    });

    // Eseguiamo la tua funzione reale.
    await approveBookingRequest("request1");

    // Una sola richiesta di invio, con i dati dello scenario.
    expect(sendEmailService).toHaveBeenCalledTimes(1);

    expect(sendEmailService).toHaveBeenCalledWith(
      "template-acceptance-test",
      "Professore Test",
      "Aula 1",
      "2027-01-12",
      "10:00",
      "11:00",
      "professore@example.com"
    );
  });

  it("non invia email se l'approvazione fallisce", async () => {
    // La transazione restituisce un errore invece di completarsi.
    vi.mocked(runTransaction).mockRejectedValue(
      new Error("Approvazione fallita")
    );

    // Il servizio deve propagare quell'errore.
    await expect(
      approveBookingRequest("request1")
    ).rejects.toThrow("Approvazione fallita");

    // Il codice di invio non deve essere stato raggiunto.
    expect(sendEmailService).not.toHaveBeenCalled();
  });
});