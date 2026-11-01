// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";

import App from "../App";
import { AuthContext } from "../contexts/AuthContextValue";
import { getPendingBookingRequests } from "../services/bookingService";

vi.mock("../services/bookingService", () => ({
  getPendingBookingRequests: vi.fn(),
}));
vi.mock("../services/authService", () => ({
  loginWithUniversityId: vi.fn(),
  logout: vi.fn(),
}));

vi.mock("../services/calendarService", () => ({
  getCalendarCatalog: async () => ({
    departments: [],
    classrooms: [],
  }),
  getCalendarBookings: async () => [],
}));

const guestSession = {
  user: null,
  profile: null,
  loading: false,
};

const professorSession = {
  user: { uid: "prof-test", email: "100001@uniroom.test" },
  profile: {
    universityId: "100001",
    email: "100001@uniroom.test",
    displayName: "Professore Test",
    role: "PROFESSOR",
  },
  loading: false,
};

const adminSession = {
  user: { uid: "admin-test", email: "900001@uniroom.test" },
  profile: {
    universityId: "900001",
    email: "900001@uniroom.test",
    displayName: "Amministratore Test",
    role: "ADMIN",
  },
  loading: false,
};

function renderPage(path = "/booking-requests", session = adminSession) {
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

describe("UNITICKET3-20 - Visualizzazione richieste di prenotazione per l'amministratore", () => {
  it("reindirizza al login un visitatore non autenticato che tenta di accedere", async () => {
    renderPage("/booking-requests", guestSession);

    expect(await screen.findByRole("heading", { name: "Login" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Richieste di Prenotazione" })).toBeNull();
  });

  it("nega l'accesso a un docente autenticato (ruolo PROFESSOR)", async () => {
    renderPage("/booking-requests", professorSession);

    expect((await screen.findByRole("alert")).textContent).toContain("Accesso non autorizzato.");
    expect(screen.queryByRole("heading", { name: "Richieste di Prenotazione" })).toBeNull();
  });

  it("consente l'accesso a un utente con ruolo ADMIN", async () => {
    vi.mocked(getPendingBookingRequests).mockResolvedValue([]);

    renderPage("/booking-requests", adminSession);

    expect(
      await screen.findByRole("heading", { name: "Richieste di Prenotazione" })
    ).toBeTruthy();
  });

  it("recupera e visualizza le richieste pendenti con tutti i dettagli richiesti", async () => {
    const mockRequests = [
      {
        id: "req-1",
        classroom: "inf-1",
        professorName: "Docente Demo 1",
        professorUniversityId: "100001",
        date: "2026-10-26",
        startTime: "10:00",
        endTime: "11:00",
        status: "PENDING",
      },
    ];

    vi.mocked(getPendingBookingRequests).mockResolvedValue(mockRequests);

    renderPage("/booking-requests", adminSession);

    expect(getPendingBookingRequests).toHaveBeenCalledTimes(1);

    expect(await screen.findByText("inf-1")).toBeTruthy();
    expect(screen.getByText("Docente Demo 1")).toBeTruthy();
    expect(screen.getByText("100001")).toBeTruthy();
    expect(screen.getByText("2026-10-26")).toBeTruthy();
    expect(screen.getByText("10:00 - 11:00")).toBeTruthy();

    expect(screen.getByText("In attesa")).toBeTruthy();
  });

  it("mostra un messaggio appropriato quando non ci sono richieste pendenti", async () => {
    vi.mocked(getPendingBookingRequests).mockResolvedValue([]);

    renderPage("/booking-requests", adminSession);

    expect(
      await screen.findByText("Nessuna richiesta di prenotazione in attesa.")
    ).toBeTruthy();
    expect(screen.queryByRole("list", { name: "Elenco richieste pendenti" })).toBeNull();
  });

  it("mostra un messaggio di errore nel caso in cui il recupero dei dati fallisca", async () => {
    vi.mocked(getPendingBookingRequests).mockRejectedValue(new Error("Errore di rete"));

    renderPage("/booking-requests", adminSession);

    expect(
      await screen.findByText("Impossibile caricare le richieste. Riprova più tardi.")
    ).toBeTruthy();
  });
});