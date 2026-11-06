
 // @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
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


vi.mock("../firebase/client", () => ({
  auth: {},
  db: {},
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
    department: { id: "demacs" },
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
    department: { id: "demacs" },
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
describe("UNITICKET3-20 - Richieste di prenotazione amministratore", () => {
  it("reindirizza al login un visitatore non autenticato", async () => {
    renderPage("/booking-requests", guestSession);
    expect(
      await screen.findByRole("heading", { name: "Login" })
    ).toBeTruthy();
    expect(
      screen.queryByRole("heading", {
        name: "Richieste di Prenotazione",
      })
    ).toBeNull();
  });
  it("nega l'accesso a un professore", async () => {
    renderPage("/booking-requests", professorSession);
    expect(
      (await screen.findByRole("alert")).textContent
    ).toContain("Accesso non autorizzato.");
    expect(
      screen.queryByRole("heading", {
        name: "Richieste di Prenotazione",
      })
    ).toBeNull();
  });
  it("consente l'accesso a un amministratore", async () => {
    vi.mocked(getPendingBookingRequests).mockResolvedValue([]);
    renderPage("/booking-requests", adminSession);
    expect(
      await screen.findByRole("heading", {
        name: "Richieste di Prenotazione",
      })
    ).toBeTruthy();
    await waitFor(() => {
      expect(getPendingBookingRequests).toHaveBeenCalledWith("demacs");
    });
  });
  it("visualizza le richieste pendenti del dipartimento assegnato", async () => {
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
    await waitFor(() => {
      expect(getPendingBookingRequests).toHaveBeenCalledWith("demacs");
    });
    expect(await screen.findByText("inf-1")).toBeTruthy();
    expect(screen.getByText("Docente Demo 1")).toBeTruthy();
    expect(screen.getByText("100001")).toBeTruthy();
    expect(screen.getByText("2026-10-26")).toBeTruthy();
    expect(screen.getByText("10:00 - 11:00")).toBeTruthy();
    expect(screen.getByText("In attesa")).toBeTruthy();
  });
  it("mostra un messaggio quando non ci sono richieste pendenti", async () => {
    vi.mocked(getPendingBookingRequests).mockResolvedValue([]);
    renderPage("/booking-requests", adminSession);
    expect(
      await screen.findByText(
        "Nessuna richiesta di prenotazione in attesa."
      )
    ).toBeTruthy();
    expect(
      screen.queryByRole("list", {
        name: "Elenco richieste pendenti",
      })
    ).toBeNull();
  });
  it("mostra un messaggio se il caricamento fallisce", async () => {
    vi.mocked(getPendingBookingRequests).mockRejectedValue(
      new Error("Errore di rete")
    );
    renderPage("/booking-requests", adminSession);
    expect(
      await screen.findByText("Errore di rete")
    ).toBeTruthy();
  });
});
