// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";

import ProfessorBookingList from "../components/booking/ProfessorBookingList";
import { AuthContext } from "../contexts/AuthContextValue";
import {
  cancelBookingRequest,
  isFutureBooking,
} from "../services/bookingService";
import * as bookingService from "../services/bookingService";
import { deleteDoc, doc, getDoc } from "firebase/firestore";

vi.mock("../firebase/client", () => ({
  auth: {},
  db: { test: "firestore" },
}));

vi.mock("firebase/firestore", () => ({
  collection: vi.fn(),
  doc: vi.fn((_db, collectionName, id) => ({
    id,
    path: `${collectionName}/${id}`,
  })),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  runTransaction: vi.fn(),
  serverTimestamp: vi.fn(() => ({ type: "serverTimestamp" })),
  deleteDoc: vi.fn(),
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const professorSession = {
  user: { uid: "prof-123" },
  profile: {
    role: "PROFESSOR",
    email: "docente@uniroom.test",
    universityId: "100001",
    displayName: "Prof. Test",
    department: { id: "demacs" },
  },
  loading: false,
};

function renderComponent(session = professorSession) {
  return render(
    <AuthContext.Provider value={session}>
      <MemoryRouter>
        <ProfessorBookingList />
      </MemoryRouter>
    </AuthContext.Provider>
  );
}

describe("UNITICKET3-35 - Service cancelBookingRequest & isFutureBooking", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("isFutureBooking riconosce correttamente date future e passate", () => {
    const fixedNow = new Date("2026-11-17T10:00:00.000Z");

    const futureBooking = {
      date: "2026-11-20",
      startTime: "11:00",
      endsAt: new Date("2026-11-20T13:00:00.000Z"),
      startsAt: new Date("2026-11-20T11:00:00.000Z"),
    };

    const pastBooking = {
      date: "2026-11-10",
      startTime: "09:00",
      endsAt: new Date("2026-11-10T11:00:00.000Z"),
      startsAt: new Date("2026-11-10T09:00:00.000Z"),
    };

    expect(isFutureBooking(futureBooking, fixedNow)).toBe(true);
    expect(isFutureBooking(pastBooking, fixedNow)).toBe(false);
    expect(isFutureBooking(null, fixedNow)).toBe(false);
  });

  it("blocca la cancellazione se requestId non è specificato", async () => {
    await expect(cancelBookingRequest("")).rejects.toThrow(
      "ID della richiesta obbligatorio."
    );
  });

  it("blocca la cancellazione se la richiesta non esiste su Firestore", async () => {
    vi.mocked(getDoc).mockResolvedValueOnce({
      exists: () => false,
    });

    await expect(cancelBookingRequest("req-404", "prof-123")).rejects.toThrow(
      "Richiesta di prenotazione non trovata."
    );
  });

  it("blocca la cancellazione se la richiesta appartiene a un altro professore", async () => {
    vi.mocked(getDoc).mockResolvedValueOnce({
      exists: () => true,
      data: () => ({
        professor: { id: "other-prof" },
        status: "PENDING",
        date: "2026-11-25",
        startsAt: new Date("2026-11-25T10:00:00Z"),
      }),
    });

    await expect(cancelBookingRequest("req-1", "prof-123")).rejects.toThrow(
      "Non sei autorizzato a cancellare questa richiesta."
    );
  });

  it("blocca la cancellazione se lo stato non è PENDING o APPROVED (es. REJECTED)", async () => {
    vi.mocked(getDoc).mockResolvedValueOnce({
      exists: () => true,
      data: () => ({
        professor: { id: "prof-123" },
        status: "REJECTED",
        date: "2026-11-25",
        startsAt: new Date("2026-11-25T10:00:00Z"),
      }),
    });

    await expect(cancelBookingRequest("req-1", "prof-123")).rejects.toThrow(
      "È possibile cancellare solo richieste in attesa o approvate."
    );
  });

  it("blocca la cancellazione se la prenotazione è nel passato", async () => {
    vi.mocked(getDoc).mockResolvedValueOnce({
      exists: () => true,
      data: () => ({
        professor: { id: "prof-123" },
        status: "APPROVED",
        date: "2020-01-01",
        startsAt: new Date("2020-01-01T10:00:00Z"),
      }),
    });

    await expect(cancelBookingRequest("req-1", "prof-123")).rejects.toThrow(
      "Non è possibile cancellare prenotazioni passate."
    );
  });

  it("cancella con successo con deleteDoc se la richiesta è futura e appartiene al professore", async () => {
    vi.mocked(getDoc).mockResolvedValueOnce({
      exists: () => true,
      data: () => ({
        professor: { id: "prof-123" },
        status: "PENDING",
        date: "2099-12-01",
        startsAt: new Date("2099-12-01T10:00:00Z"),
      }),
    });
    vi.mocked(deleteDoc).mockResolvedValueOnce();

    await cancelBookingRequest("req-1", "prof-123");

    expect(doc).toHaveBeenCalledWith({ test: "firestore" }, "bookingRequest", "req-1");
    expect(deleteDoc).toHaveBeenCalled();
  });
});

describe("UNITICKET3-35 - UI ProfessorBookingList Cancellazione", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("mostra il pulsante di cancellazione solo per richieste future in stato PENDING o APPROVED", async () => {
    const mockBookings = [
      {
        id: "future-pending",
        classroom: "Aula 1",
        date: "2099-11-20",
        startTime: "10:00",
        endTime: "12:00",
        status: "PENDING",
        startsAt: new Date("2099-11-20T10:00:00Z"),
      },
      {
        id: "future-approved",
        classroom: "Aula 2",
        date: "2099-11-21",
        startTime: "14:00",
        endTime: "16:00",
        status: "APPROVED",
        startsAt: new Date("2099-11-21T14:00:00Z"),
      },
      {
        id: "rejected",
        classroom: "Aula 3",
        date: "2099-11-22",
        startTime: "09:00",
        endTime: "11:00",
        status: "REJECTED",
        reason: "Non disponibile",
        startsAt: new Date("2099-11-22T09:00:00Z"),
      },
      {
        id: "past-approved",
        classroom: "Aula 4",
        date: "2020-01-01",
        startTime: "10:00",
        endTime: "12:00",
        status: "APPROVED",
        startsAt: new Date("2020-01-01T10:00:00Z"),
      },
    ];

    vi.spyOn(bookingService, "getProfessorBookingRequests").mockResolvedValue(
      mockBookings
    );

    renderComponent();

    // Attendiamo il rendering dei dati
    expect(await screen.findByText("Aula 1")).toBeTruthy();
    expect(screen.getByText("Aula 2")).toBeTruthy();
    expect(screen.getByText("Aula 3")).toBeTruthy();
    expect(screen.getByText("Aula 4")).toBeTruthy();

    const cancelButtons = screen.getAllByRole("button", {
      name: /cancella prenotazione/i,
    });
    // Solo per Aula 1 e Aula 2
    expect(cancelButtons).toHaveLength(2);
  });

  it("mostra il messaggio di conferma (simple y/n) al click su cancella e permette di annullare con No", async () => {
    const mockBookings = [
      {
        id: "future-pending",
        classroom: "Aula Magna",
        date: "2099-11-20",
        startTime: "10:00",
        endTime: "12:00",
        status: "PENDING",
        startsAt: new Date("2099-11-20T10:00:00Z"),
      },
    ];

    vi.spyOn(bookingService, "getProfessorBookingRequests").mockResolvedValue(
      mockBookings
    );

    renderComponent();

    const cancelBtn = await screen.findByRole("button", {
      name: /cancella prenotazione/i,
    });
    fireEvent.click(cancelBtn);

    // Box di conferma visibile con messaggio e pulsanti Sì / No
    expect(
      screen.getByText(/sei sicuro di voler cancellare questa richiesta di prenotazione\? \(sì \/ no\)/i)
    ).toBeTruthy();
    const yesButton = screen.getByRole("button", { name: "Sì" });
    const noButton = screen.getByRole("button", { name: "No" });
    expect(yesButton).toBeTruthy();
    expect(noButton).toBeTruthy();

    // Cliccando su No si chiude la conferma senza cancellare
    fireEvent.click(noButton);
    expect(
      screen.queryByText(/sei sicuro di voler cancellare questa richiesta/i)
    ).toBeNull();
    expect(screen.getByRole("button", { name: /cancella prenotazione/i })).toBeTruthy();
  });

  it("esegue la cancellazione con Sì e rimuove la card dalla lista aggiornando la vista", async () => {
    const mockBookings = [
      {
        id: "future-pending-to-delete",
        classroom: "Aula Convegni",
        date: "2099-11-20",
        startTime: "10:00",
        endTime: "12:00",
        status: "PENDING",
        startsAt: new Date("2099-11-20T10:00:00Z"),
      },
    ];

    vi.spyOn(bookingService, "getProfessorBookingRequests").mockResolvedValue(
      mockBookings
    );
    const cancelSpy = vi
      .spyOn(bookingService, "cancelBookingRequest")
      .mockResolvedValue();

    renderComponent();

    const cancelBtn = await screen.findByRole("button", {
      name: /cancella prenotazione/i,
    });
    fireEvent.click(cancelBtn);

    const yesBtn = screen.getByRole("button", { name: "Sì" });
    fireEvent.click(yesBtn);

    expect(cancelSpy).toHaveBeenCalledWith("future-pending-to-delete", "prof-123");

    await waitFor(() => {
      expect(
        screen.getByText("Richiesta di prenotazione cancellata con successo.")
      ).toBeTruthy();
    });

    // La card Aula Convegni non deve più essere presente nella lista
    expect(screen.queryByText("Aula Convegni")).toBeNull();
  });

  it("mostra un messaggio di errore se la cancellazione fallisce", async () => {
    const mockBookings = [
      {
        id: "future-fail",
        classroom: "Aula Rossa",
        date: "2099-11-20",
        startTime: "10:00",
        endTime: "12:00",
        status: "PENDING",
        startsAt: new Date("2099-11-20T10:00:00Z"),
      },
    ];

    vi.spyOn(bookingService, "getProfessorBookingRequests").mockResolvedValue(
      mockBookings
    );
    vi.spyOn(bookingService, "cancelBookingRequest").mockRejectedValue(
      new Error("Errore di rete durante la cancellazione.")
    );

    renderComponent();

    const cancelBtn = await screen.findByRole("button", {
      name: /cancella prenotazione/i,
    });
    fireEvent.click(cancelBtn);

    const yesBtn = screen.getByRole("button", { name: "Sì" });
    fireEvent.click(yesBtn);

    expect(
      await screen.findByText("Errore di rete durante la cancellazione.")
    ).toBeTruthy();
    // La card rimane visibile
    expect(screen.getByText("Aula Rossa")).toBeTruthy();
  });
});
