// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AuthContext } from "../contexts/AuthContextValue";

const {
  mockCollection,
  mockAddDoc,
  mockDoc,
  mockGetDocs,
  mockQuery,
  mockWhere,
} = vi.hoisted(() => ({
  mockCollection: vi.fn((_db, name) => ({ name })),
  mockAddDoc: vi.fn(),
  mockDoc: vi.fn((_db, col, id) => ({ collection: col, id })),
  mockGetDocs: vi.fn(),
  mockQuery: vi.fn((...args) => ({ args })),
  mockWhere: vi.fn((field, op, val) => ({ field, op, val })),
}));

vi.mock("firebase/firestore", () => ({
  collection: mockCollection,
  addDoc: mockAddDoc,
  doc: mockDoc,
  getDoc: vi.fn(),
  getDocs: mockGetDocs,
  query: mockQuery,
  where: mockWhere,
  runTransaction: vi.fn(),
  serverTimestamp: vi.fn(),
  Timestamp: {
    fromDate: vi.fn((date) => ({ toDate: () => date })),
  },
}));

vi.mock("../firebase/client", () => ({
  auth: {},
  db: { test: "firestore" },
}));

vi.mock("../services/calendarService", () => ({
  getCalendarCatalog: async () => ({
    departments: [{ id: "demacs", name: "DeMaCS" }],
    classrooms: [
      { id: "mt1", name: "Aula MT1", cubo: "22B", departmentId: "demacs" },
    ],
  }),
  getCalendarBookings: async () => [],
}));

import { createBookingRequest } from "../services/bookingService";
import BookingRequestForm from "../components/booking/BookingRequestForm";

function makeTimestamp(timeStr) {
  return {
    toDate: () => ({
      toLocaleTimeString: () => timeStr,
    }),
  };
}

function getFutureDate(daysInAdvance = 5) {
  const date = new Date();
  date.setDate(date.getDate() + daysInAdvance);
  return date.toISOString().split("T")[0];
}

const professorSession = {
  user: { uid: "prof-123", email: "100001@uniroom.test" },
  profile: {
    universityId: "100001",
    email: "100001@uniroom.test",
    displayName: "Prof. Mario Rossi",
    role: "PROFESSOR",
    department: { id: "demacs" },
  },
  loading: false,
};

describe("UNITICKET3-44 - Blocco richieste su aule già prenotate", () => {
  const targetDate = getFutureDate(5);

  beforeEach(() => {
    vi.clearAllMocks();
    mockAddDoc.mockResolvedValue({ id: "new-booking-id" });
    mockGetDocs.mockResolvedValue({ docs: [] });
  });

  afterEach(() => {
    cleanup();
  });

  it("interroga solo prenotazioni APPROVED per aula e data e salva se non ci sono conflitti", async () => {
    const id = await createBookingRequest({
      departmentId: "demacs",
      classroomId: "mt1",
      professorId: "prof-123",
      professorName: "Prof. Mario Rossi",
      date: targetDate,
      startTime: "10:00",
      endTime: "12:00",
    });

    expect(id).toBe("new-booking-id");
    expect(mockWhere).toHaveBeenCalledWith("status", "==", "APPROVED");
    expect(mockWhere).toHaveBeenCalledWith(
      "classroom",
      "==",
      expect.objectContaining({ collection: "classrooms", id: "mt1" })
    );
    expect(mockWhere).toHaveBeenCalledWith("date", "==", targetDate);
    expect(mockAddDoc).toHaveBeenCalledTimes(1);
  });

  it("consente la prenotazione se esistono prenotazioni approvate solo adiacenti", async () => {
    mockGetDocs.mockResolvedValue({
      docs: [
        {
          id: "app-1",
          data: () => ({
            status: "APPROVED",
            classroom: { id: "mt1" },
            date: targetDate,
            startsAt: makeTimestamp("08:30"),
            endsAt: makeTimestamp("10:00"),
          }),
        },
        {
          id: "app-2",
          data: () => ({
            status: "APPROVED",
            classroom: { id: "mt1" },
            date: targetDate,
            startsAt: makeTimestamp("12:00"),
            endsAt: makeTimestamp("14:00"),
          }),
        },
      ],
    });

    const id = await createBookingRequest({
      departmentId: "demacs",
      classroomId: "mt1",
      professorId: "prof-123",
      date: targetDate,
      startTime: "10:00",
      endTime: "12:00",
    });

    expect(id).toBe("new-booking-id");
    expect(mockAddDoc).toHaveBeenCalledTimes(1);
  });

  it("rifiuta la richiesta senza scrivere su Firestore se c'è una prenotazione approvata sovrapposta", async () => {
    mockGetDocs.mockResolvedValue({
      docs: [
        {
          id: "app-1",
          data: () => ({
            status: "APPROVED",
            classroom: { id: "mt1" },
            date: targetDate,
            startsAt: makeTimestamp("10:30"),
            endsAt: makeTimestamp("12:30"),
          }),
        },
      ],
    });

    await expect(
      createBookingRequest({
        departmentId: "demacs",
        classroomId: "mt1",
        professorId: "prof-123",
        date: targetDate,
        startTime: "10:00",
        endTime: "11:30",
      })
    ).rejects.toThrow(
      `Richiesta rifiutata: l'aula è già prenotata il ${targetDate} nella fascia oraria 10:30-12:30.`
    );

    expect(mockAddDoc).not.toHaveBeenCalled();
  });

  it("rifiuta la richiesta ed elenca tutte le prenotazioni approvate che bloccano la fascia richiesta", async () => {
    mockGetDocs.mockResolvedValue({
      docs: [
        {
          id: "app-2",
          data: () => ({
            status: "APPROVED",
            classroom: { id: "mt1" },
            date: targetDate,
            startsAt: makeTimestamp("11:30"),
            endsAt: makeTimestamp("12:30"),
          }),
        },
        {
          id: "app-1",
          data: () => ({
            status: "APPROVED",
            classroom: { id: "mt1" },
            date: targetDate,
            startsAt: makeTimestamp("09:30"),
            endsAt: makeTimestamp("10:30"),
          }),
        },
        {
          id: "app-unrelated",
          data: () => ({
            status: "APPROVED",
            classroom: { id: "mt1" },
            date: targetDate,
            startsAt: makeTimestamp("15:00"),
            endsAt: makeTimestamp("16:00"),
          }),
        },
      ],
    });

    await expect(
      createBookingRequest({
        departmentId: "demacs",
        classroomId: "mt1",
        professorId: "prof-123",
        date: targetDate,
        startTime: "09:00",
        endTime: "13:00",
      })
    ).rejects.toThrow(
      `Richiesta rifiutata: l'aula è già prenotata il ${targetDate} nelle fasce orarie 09:30-10:30, 11:30-12:30.`
    );

    expect(mockAddDoc).not.toHaveBeenCalled();
  });

  it("mostra l'errore nel form e mantiene i campi compilati quando la richiesta viene rifiutata", async () => {
    mockGetDocs.mockResolvedValue({
      docs: [
        {
          id: "app-1",
          data: () => ({
            status: "APPROVED",
            classroom: { id: "mt1" },
            date: targetDate,
            startsAt: makeTimestamp("10:00"),
            endsAt: makeTimestamp("12:00"),
          }),
        },
      ],
    });

    render(
      <AuthContext.Provider value={professorSession}>
        <BookingRequestForm />
      </AuthContext.Provider>
    );

    await screen.findByRole("option", { name: /Aula MT1/ });

    const classroomSelect = screen.getByLabelText(/Aula \/ Laboratorio \*/);
    const dateInput = screen.getByLabelText(/Giorno \*/);
    const startInput = screen.getByLabelText(/Ora inizio \*/);
    const endInput = screen.getByLabelText(/Ora fine \*/);

    fireEvent.change(classroomSelect, { target: { value: "mt1" } });
    fireEvent.change(dateInput, { target: { value: targetDate } });
    fireEvent.change(startInput, { target: { value: "11:00" } });
    fireEvent.change(endInput, { target: { value: "13:00" } });

    fireEvent.click(screen.getByRole("button", { name: "Invia richiesta" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain(
      `Richiesta rifiutata: l'aula è già prenotata il ${targetDate} nella fascia oraria 10:00-12:00.`
    );

    await waitFor(() => {
      expect(mockAddDoc).not.toHaveBeenCalled();
    });
    expect(classroomSelect.value).toBe("mt1");
    expect(dateInput.value).toBe(targetDate);
    expect(startInput.value).toBe("11:00");
    expect(endInput.value).toBe("13:00");
  });
});
