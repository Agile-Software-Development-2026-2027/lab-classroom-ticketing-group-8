// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";

import App from "../App";
import { AuthContext } from "../contexts/AuthContextValue";
import {
  createBookingRequest,
  validateBookingData,
} from "../services/bookingService";
import { addDoc, collection } from "firebase/firestore";

// Mock di Firestore e dei servizi
vi.mock("../firebase/client", () => ({
  auth: {},
  db: { test: "firestore" },
}));

vi.mock("firebase/firestore", () => ({
  collection: vi.fn((_db, name) => ({ name })),
  addDoc: vi.fn(),
  Timestamp: {
    fromDate: vi.fn((date) => ({ toDate: () => date })),
  },
  doc: vi.fn((_db, col, id) => ({ collection: col, id })),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
}));

const mockClassrooms = [
  { id: "mt1", name: "Aula MT1", cubo: "22B", departmentId: "demacs" },
  { id: "mt23", name: "Aula MT23", cubo: "22B", departmentId: "demacs" },
  { id: "other1", name: "Aula DISP", cubo: "14C", departmentId: "dispes" },
];

vi.mock("../services/calendarService", () => ({
  getCalendarCatalog: async () => ({
    departments: [
      { id: "demacs", name: "DeMaCS" },
      { id: "dispes", name: "DiSPeS" },
    ],
    classrooms: mockClassrooms,
  }),
  getCalendarBookings: async () => [],
}));

vi.mock("../services/authService", () => ({
  loginWithUniversityId: vi.fn(),
  logout: vi.fn(),
}));

const professorSession = {
  user: { uid: "prof-123", email: "100001@uniroom.test" },
  profile: {
    universityId: "100001",
    email: "100001@uniroom.test",
    displayName: "Prof. Mario Rossi",
    role: "PROFESSOR",
  },
  loading: false,
};

const adminSession = {
  user: { uid: "admin-456", email: "200001@uniroom.test" },
  profile: {
    universityId: "200001",
    email: "200001@uniroom.test",
    displayName: "Admin Demo",
    role: "ADMIN",
  },
  loading: false,
};

function renderApp(path = "/personal-area", session = professorSession) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthContext.Provider value={session}>
        <App />
      </AuthContext.Provider>
    </MemoryRouter>
  );
}

function getFutureDate(daysInAdvance = 2) {
  const date = new Date();
  date.setDate(date.getDate() + daysInAdvance);
  return date.toISOString().split("T")[0];
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(addDoc).mockResolvedValue({ id: "new-booking-id" });
});

afterEach(() => {
  cleanup();
});

describe("UNITICKET3-21 - Service bookingService", () => {
  it("valida con successo una richiesta corretta", () => {
    const validData = {
      date: getFutureDate(3),
      startTime: "09:30",
      endTime: "11:30",
      classroomId: "mt1",
      departmentId: "demacs",
      professorId: "prof-123",
    };

    expect(() => validateBookingData(validData)).not.toThrow();
  });

  it("rifiuta richieste con dipartimento o aula mancanti", () => {
    expect(() => validateBookingData(null)).toThrow(
      "I dati della richiesta sono obbligatori."
    );

    expect(() =>
      validateBookingData({
        date: getFutureDate(3),
        startTime: "09:30",
        endTime: "11:30",
        classroomId: "mt1",
        departmentId: "",
        professorId: "prof-123",
      })
    ).toThrow("Il dipartimento è obbligatorio.");

    expect(() =>
      validateBookingData({
        date: getFutureDate(3),
        startTime: "09:30",
        endTime: "11:30",
        classroomId: "",
        departmentId: "demacs",
        professorId: "prof-123",
      })
    ).toThrow("L'aula o laboratorio è obbligatoria.");
  });

  it("rifiuta date nel passato o per il giorno stesso (preavviso minimo)", () => {
    const today = new Date().toISOString().split("T")[0];

    expect(() =>
      validateBookingData({
        date: today,
        startTime: "09:00",
        endTime: "11:00",
        classroomId: "mt1",
        departmentId: "demacs",
        professorId: "prof-123",
      })
    ).toThrow("La richiesta deve essere inoltrata con almeno un giorno di preavviso.");
  });

  it("rifiuta se l'orario di fine è precedente o uguale all'orario di inizio", () => {
    expect(() =>
      validateBookingData({
        date: getFutureDate(3),
        startTime: "11:00",
        endTime: "09:00",
        classroomId: "mt1",
        departmentId: "demacs",
        professorId: "prof-123",
      })
    ).toThrow("L'orario di fine deve essere successivo all'orario di inizio.");
  });

  it("createBookingRequest salva in Firestore solo gli 8 campi previsti con DocumentReference, Timestamp e status PENDING", async () => {
    const bookingData = {
      date: getFutureDate(2),
      startTime: "14:00",
      endTime: "16:00",
      classroomId: "mt1",
      departmentId: "demacs",
      professorId: "prof-123",
      professorName: "Prof. Mario Rossi",
    };

    const docId = await createBookingRequest(bookingData);

    expect(docId).toBe("new-booking-id");
    expect(collection).toHaveBeenCalledWith({ test: "firestore" }, "bookingRequest");
    expect(addDoc).toHaveBeenCalledWith(
      { name: "bookingRequest" },
      {
        classroom: expect.objectContaining({ collection: "classrooms", id: "mt1" }),
        date: bookingData.date,
        department: expect.objectContaining({ collection: "departments", id: "demacs" }),
        endsAt: expect.anything(),
        professor: expect.objectContaining({ collection: "users", id: "prof-123" }),
        professorName: "Prof. Mario Rossi",
        startsAt: expect.anything(),
        status: "PENDING",
      }
    );
  });
});

describe("UNITICKET3-21 - Interfaccia BookingRequestForm e Navigazione", () => {
  it("mostra il link per nuova richiesta nell'Area Personale del professore", async () => {
    renderApp("/personal-area", professorSession);

    expect(await screen.findByRole("heading", { name: "Area Personale" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "+ Nuova richiesta di prenotazione" })).toBeTruthy();
  });

  it("non mostra il link per nuova richiesta docente a un utente ADMIN", async () => {
    renderApp("/personal-area", adminSession);

    expect(await screen.findByRole("heading", { name: "Area Personale" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: "+ Nuova richiesta di prenotazione" })).toBeNull();
    expect(screen.getByRole("link", { name: "Visualizza richieste di prenotazione" })).toBeTruthy();
  });

  it("mostra il form e carica dinamicamente dipartimenti e aule nella pagina dedicata", async () => {
    renderApp("/new-booking-request", professorSession);

    expect(await screen.findByRole("heading", { name: "Nuova Richiesta di Prenotazione" })).toBeTruthy();
    expect(await screen.findByRole("option", { name: "DeMaCS" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "DiSPeS" })).toBeTruthy();

    // Seleziona il dipartimento
    fireEvent.change(screen.getByLabelText(/Dipartimento \*/), {
      target: { value: "demacs" },
    });

    // Le aule del dipartimento vengono mostrate
    expect(await screen.findByRole("option", { name: /Aula MT1/ })).toBeTruthy();
    expect(screen.getByRole("option", { name: /Aula MT23/ })).toBeTruthy();
    // Non mostra aule di altri dipartimenti
    expect(screen.queryByRole("option", { name: /Aula DISP/ })).toBeNull();
  });

  it("mostra un messaggio di errore se l'orario di fine è errato", async () => {
    renderApp("/new-booking-request", professorSession);

    await screen.findByRole("heading", { name: "Nuova Richiesta di Prenotazione" });
    await screen.findByRole("option", { name: "DeMaCS" });

    fireEvent.change(screen.getByLabelText(/Dipartimento \*/), {
      target: { value: "demacs" },
    });

    fireEvent.change(screen.getByLabelText(/Aula \/ Laboratorio \*/), {
      target: { value: "mt1" },
    });

    fireEvent.change(screen.getByLabelText(/Giorno \*/), {
      target: { value: getFutureDate(3) },
    });
    fireEvent.change(screen.getByLabelText(/Ora inizio \*/), {
      target: { value: "15:00" },
    });
    fireEvent.change(screen.getByLabelText(/Ora fine \*/), {
      target: { value: "14:00" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Invia richiesta" }));

    expect((await screen.findByRole("alert")).textContent).toContain(
      "L'orario di fine deve essere successivo all'orario di inizio."
    );
    expect(addDoc).not.toHaveBeenCalled();
  });

  it("invia con successo la richiesta ricavando professorName automaticamente dalla sessione", async () => {
    renderApp("/new-booking-request", professorSession);

    await screen.findByRole("heading", { name: "Nuova Richiesta di Prenotazione" });
    await screen.findByRole("option", { name: "DeMaCS" });

    fireEvent.change(screen.getByLabelText(/Dipartimento \*/), {
      target: { value: "demacs" },
    });

    fireEvent.change(screen.getByLabelText(/Aula \/ Laboratorio \*/), {
      target: { value: "mt1" },
    });

    fireEvent.change(screen.getByLabelText(/Giorno \*/), {
      target: { value: getFutureDate(4) },
    });
    fireEvent.change(screen.getByLabelText(/Ora inizio \*/), {
      target: { value: "10:00" },
    });
    fireEvent.change(screen.getByLabelText(/Ora fine \*/), {
      target: { value: "12:00" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Invia richiesta" }));

    await waitFor(() => {
      expect(addDoc).toHaveBeenCalledTimes(1);
    });

    expect(addDoc).toHaveBeenCalledWith(
      expect.anything(),
      {
        classroom: expect.objectContaining({ id: "mt1" }),
        date: getFutureDate(4),
        department: expect.objectContaining({ id: "demacs" }),
        endsAt: expect.anything(),
        professor: expect.objectContaining({ id: "prof-123" }),
        professorName: "Prof. Mario Rossi",
        startsAt: expect.anything(),
        status: "PENDING",
      }
    );

    expect((await screen.findByRole("status")).textContent).toContain(
      "Richiesta di prenotazione inviata con successo!"
    );
  });
});
