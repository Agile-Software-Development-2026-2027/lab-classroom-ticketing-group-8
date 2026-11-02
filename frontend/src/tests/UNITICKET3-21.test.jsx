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
  serverTimestamp: vi.fn(() => "TIMESTAMP_TEST"),
  doc: vi.fn(),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
}));

vi.mock("../services/calendarService", () => ({
  getCalendarCatalog: async () => ({
    departments: [],
    classrooms: [],
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

function renderPersonalArea(session = professorSession) {
  return render(
    <MemoryRouter initialEntries={["/personal-area"]}>
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
      classroom: "Aula MT1 (144 posti)",
      professorId: "prof-123",
    };

    expect(() => validateBookingData(validData)).not.toThrow();
  });

  it("rifiuta richieste con campi obbligatori mancanti", () => {
    expect(() => validateBookingData(null)).toThrow(
      "I dati della richiesta sono obbligatori."
    );

    expect(() =>
      validateBookingData({
        date: getFutureDate(3),
        startTime: "09:30",
        endTime: "11:30",
        classroom: "",
        professorId: "prof-123",
      })
    ).toThrow("Tutti i campi obbligatori devono essere compilati.");
  });

  it("rifiuta date nel passato o per il giorno stesso (preavviso minimo)", () => {
    const today = new Date().toISOString().split("T")[0];

    expect(() =>
      validateBookingData({
        date: today,
        startTime: "09:00",
        endTime: "11:00",
        classroom: "Aula MT1 (144 posti)",
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
        classroom: "Aula MT1 (144 posti)",
        professorId: "prof-123",
      })
    ).toThrow("L'orario di fine deve essere successivo all'orario di inizio.");

    expect(() =>
      validateBookingData({
        date: getFutureDate(3),
        startTime: "10:00",
        endTime: "10:00",
        classroom: "Aula MT1 (144 posti)",
        professorId: "prof-123",
      })
    ).toThrow("L'orario di fine deve essere successivo all'orario di inizio.");
  });

  it("createBookingRequest salva in Firestore con status PENDING e createdAt", async () => {
    const bookingData = {
      date: getFutureDate(2),
      startTime: "14:00",
      endTime: "16:00",
      classroom: "Aula MT23 (169 posti)",
      professorId: "prof-123",
      professorName: "Prof. Mario Rossi",
      equipment: ["Computer d'aula"],
    };

    const docId = await createBookingRequest(bookingData);

    expect(docId).toBe("new-booking-id");
    expect(collection).toHaveBeenCalledWith({ test: "firestore" }, "bookingRequest");
    expect(addDoc).toHaveBeenCalledWith(
      { name: "bookingRequest" },
      expect.objectContaining({
        ...bookingData,
        status: "PENDING",
        createdAt: "TIMESTAMP_TEST",
      })
    );
  });
});

describe("UNITICKET3-21 - Interfaccia BookingRequestForm", () => {
  it("mostra il modulo di prenotazione al professore nell'area personale", async () => {
    renderPersonalArea(professorSession);

    expect(await screen.findByRole("heading", { name: "Nuova Richiesta di Prenotazione" })).toBeTruthy();
    expect(screen.getByLabelText(/Giorno \*/)).toBeTruthy();
    expect(screen.getByLabelText(/Ora inizio \*/)).toBeTruthy();
    expect(screen.getByLabelText(/Ora fine \*/)).toBeTruthy();
    expect(screen.getByLabelText(/Aula \/ Laboratorio \*/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Invia richiesta" })).toBeTruthy();
  });

  it("non mostra il form di prenotazione docente a un utente ADMIN", async () => {
    renderPersonalArea(adminSession);

    expect(await screen.findByRole("heading", { name: "Area Personale" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Nuova Richiesta di Prenotazione" })).toBeNull();
    expect(screen.getByRole("link", { name: "Visualizza richieste di prenotazione" })).toBeTruthy();
  });

  it("mostra un messaggio di errore se l'orario di fine è errato", async () => {
    renderPersonalArea(professorSession);

    await screen.findByRole("heading", { name: "Nuova Richiesta di Prenotazione" });

    fireEvent.change(screen.getByLabelText(/Giorno \*/), {
      target: { value: getFutureDate(3) },
    });
    fireEvent.change(screen.getByLabelText(/Ora inizio \*/), {
      target: { value: "15:00" },
    });
    fireEvent.change(screen.getByLabelText(/Ora fine \*/), {
      target: { value: "14:00" },
    });
    fireEvent.change(screen.getByLabelText(/Aula \/ Laboratorio \*/), {
      target: { value: "Aula MT1 (144 posti)" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Invia richiesta" }));

    expect((await screen.findByRole("alert")).textContent).toContain(
      "L'orario di fine deve essere successivo all'orario di inizio."
    );
    expect(addDoc).not.toHaveBeenCalled();
  });

  it("invia con successo la richiesta e mostra il messaggio di conferma", async () => {
    renderPersonalArea(professorSession);

    await screen.findByRole("heading", { name: "Nuova Richiesta di Prenotazione" });

    fireEvent.change(screen.getByLabelText(/Giorno \*/), {
      target: { value: getFutureDate(4) },
    });
    fireEvent.change(screen.getByLabelText(/Ora inizio \*/), {
      target: { value: "10:00" },
    });
    fireEvent.change(screen.getByLabelText(/Ora fine \*/), {
      target: { value: "12:00" },
    });
    fireEvent.change(screen.getByLabelText(/Aula \/ Laboratorio \*/), {
      target: { value: "Aula MT1 (144 posti)" },
    });

    // Seleziona un'attrezzatura
    const computerCheckbox = screen.getByLabelText("Computer d'aula");
    fireEvent.click(computerCheckbox);

    fireEvent.click(screen.getByRole("button", { name: "Invia richiesta" }));

    await waitFor(() => {
      expect(addDoc).toHaveBeenCalledTimes(1);
    });

    expect(addDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        date: getFutureDate(4),
        startTime: "10:00",
        endTime: "12:00",
        classroom: "Aula MT1 (144 posti)",
        professorId: "prof-123",
        status: "PENDING",
        equipment: ["Computer d'aula"],
      })
    );

    expect((await screen.findByRole("status")).textContent).toContain(
      "Richiesta di prenotazione inviata con successo!"
    );
  });
});
