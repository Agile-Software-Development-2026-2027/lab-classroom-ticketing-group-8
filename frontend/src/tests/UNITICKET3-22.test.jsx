// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";

import App from "../App";
import { AuthContext } from "../contexts/AuthContextValue";
import { getProfessorBookingRequests } from "../services/bookingService";
import { collection, doc, getDocs, where } from "firebase/firestore";

vi.mock("../firebase/client", () => ({
  auth: {},
  db: { test: "firestore" },
}));

vi.mock("firebase/firestore", () => ({
  collection: vi.fn((_db, name) => ({ name })),
  doc: vi.fn((_db, col, id) => ({ collection: col, id })),
  query: vi.fn((...args) => ({ queryArgs: args })),
  where: vi.fn((field, op, val) => ({ field, op, val })),
  getDocs: vi.fn(),
  getDoc: vi.fn(),
  Timestamp: {
    fromDate: vi.fn((date) => ({ toDate: () => date })),
  },
  addDoc: vi.fn(),
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

function renderApp(path = "/personal-area", session = professorSession) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthContext.Provider value={session}>
        <App />
      </AuthContext.Provider>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.resetAllMocks();
});

afterEach(() => {
  cleanup();
});

describe("UNITICKET3-22 - Service getProfessorBookingRequests", () => {
  it("restituisce un array vuoto se professorId non è specificato", async () => {
    const result = await getProfessorBookingRequests("");
    expect(result).toEqual([]);
    expect(getDocs).not.toHaveBeenCalled();
  });

  it("interroga Firestore filtrando esclusivamente per il DocumentReference del professore", async () => {
    vi.mocked(getDocs).mockResolvedValue({
      docs: [
        {
          id: "req-1",
          data: () => ({
            classroom: { id: "mt5" },
            date: "2026-11-20",
            startsAt: { toDate: () => new Date("2026-11-20T10:00:00") },
            endsAt: { toDate: () => new Date("2026-11-20T12:00:00") },
            status: "PENDING",
          }),
        },
      ],
    });

    const requests = await getProfessorBookingRequests("prof-123");

    expect(collection).toHaveBeenCalledWith({ test: "firestore" }, "bookingRequest");
    expect(doc).toHaveBeenCalledWith({ test: "firestore" }, "users", "prof-123");
    expect(where).toHaveBeenCalledWith(
      "professor",
      "==",
      expect.objectContaining({ collection: "users", id: "prof-123" })
    );

    expect(requests).toHaveLength(1);
    expect(requests[0]).toEqual(
      expect.objectContaining({
        id: "req-1",
        classroom: "mt5",
        date: "2026-11-20",
        status: "PENDING",
      })
    );
  });

  it("supporta e mappa correttamente i diversi stati (PENDING, APPROVED, REJECTED)", async () => {
    vi.mocked(getDocs).mockResolvedValue({
      docs: [
        {
          id: "req-p",
          data: () => ({
            classroom: { id: "mt1" },
            date: "2026-11-22",
            startsAt: { toDate: () => new Date("2026-11-22T09:00:00") },
            endsAt: { toDate: () => new Date("2026-11-22T11:00:00") },
            status: "PENDING",
          }),
        },
        {
          id: "req-a",
          data: () => ({
            classroom: { id: "mt2" },
            date: "2026-11-23",
            startsAt: { toDate: () => new Date("2026-11-23T14:00:00") },
            endsAt: { toDate: () => new Date("2026-11-23T16:00:00") },
            status: "APPROVED",
          }),
        },
        {
          id: "req-r",
          data: () => ({
            classroom: { id: "mt3" },
            date: "2026-11-24",
            startsAt: { toDate: () => new Date("2026-11-24T16:00:00") },
            endsAt: { toDate: () => new Date("2026-11-24T18:00:00") },
            status: "REJECTED",
          }),
        },
      ],
    });

    const requests = await getProfessorBookingRequests("prof-123");

    expect(requests).toHaveLength(3);
    const statuses = requests.map((r) => r.status);
    expect(statuses).toContain("PENDING");
    expect(statuses).toContain("APPROVED");
    expect(statuses).toContain("REJECTED");
  });
});

describe("UNITICKET3-22 - Visualizzazione stato richieste nell'Area Personale", () => {
  it("mostra stato vuoto quando il professore non ha richieste inviate", async () => {
    vi.mocked(getDocs).mockResolvedValue({ docs: [] });

    renderApp("/personal-area", professorSession);

    expect(await screen.findByRole("heading", { name: "Le Mie Richieste di Prenotazione" })).toBeTruthy();
    expect(
      await screen.findByText("Non hai ancora inviato nessuna richiesta di prenotazione.")
    ).toBeTruthy();
  });

  it("mostra l'elenco delle richieste con aula, data, orario e badge di stato", async () => {
    vi.mocked(getDocs).mockResolvedValue({
      docs: [
        {
          id: "b1",
          data: () => ({
            classroom: { id: "Aula Magna" },
            date: "2026-11-25",
            startTime: "09:00",
            endTime: "11:00",
            status: "PENDING",
          }),
        },
        {
          id: "b2",
          data: () => ({
            classroom: { id: "Laboratorio Turing" },
            date: "2026-11-26",
            startTime: "14:30",
            endTime: "16:30",
            status: "APPROVED",
          }),
        },
        {
          id: "b3",
          data: () => ({
            classroom: { id: "Aula Inf-1" },
            date: "2026-11-27",
            startTime: "11:00",
            endTime: "13:00",
            status: "REJECTED",
          }),
        },
      ],
    });

    renderApp("/personal-area", professorSession);

    expect(await screen.findByRole("heading", { name: "Le Mie Richieste di Prenotazione" })).toBeTruthy();

    expect(await screen.findByText("Aula Magna")).toBeTruthy();
    expect(screen.getByText("Laboratorio Turing")).toBeTruthy();
    expect(screen.getByText("Aula Inf-1")).toBeTruthy();

    expect(screen.getByText("2026-11-25")).toBeTruthy();
    expect(screen.getByText("09:00 - 11:00")).toBeTruthy();

    // Badge di stato per tutti e tre i valori supportati
    expect(screen.getAllByText("In attesa").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Approvata").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Rifiutata").length).toBeGreaterThan(0);
  });

  it("mostra un messaggio di errore se il caricamento da Firestore fallisce", async () => {
    vi.mocked(getDocs).mockRejectedValue(new Error("Errore di rete"));

    renderApp("/personal-area", professorSession);

    expect(
      await screen.findByText("Impossibile caricare le tue richieste di prenotazione.")
    ).toBeTruthy();
  });

  it("non mostra la sezione delle richieste del docente a un utente ADMIN", async () => {
    renderApp("/personal-area", adminSession);

    expect(await screen.findByRole("heading", { name: "Area Personale" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Le Mie Richieste di Prenotazione" })).toBeNull();
  });
});

