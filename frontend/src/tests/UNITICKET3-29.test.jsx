
// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AuthContext } from "../contexts/AuthContextValue";
import BookingRequestForm from "../components/booking/BookingRequestForm";
import Calendar from "../components/calendar/Calendar";
import BookingRequests from "../pages/BookingRequests";
import { getPendingBookingRequests } from "../services/bookingService";

vi.mock("../services/calendarService", () => ({
  getCalendarCatalog: vi.fn(async () => ({
    departments: [
      { id: "demacs", name: "DeMaCS" },
      { id: "dispes", name: "DiSPeS" },
    ],
    classrooms: [
      { id: "aula1", name: "Aula DeMaCS", departmentId: "demacs" },
      { id: "aula2", name: "Aula DiSPeS", departmentId: "dispes" },
    ],
  })),
  getCalendarBookings: vi.fn(async () => []),
}));

vi.mock("../services/bookingService", () => ({
  createBookingRequest: vi.fn(),
  getPendingBookingRequests: vi.fn(async () => []),
  approveBookingRequest: vi.fn(),
  rejectBookingRequest: vi.fn(),
}));

function makeSession(role) {
  if (!role) {
    return { user: null, profile: null, loading: false };
  }
  return {
    user: { uid: "user-test" },
    profile: {
      role,
      displayName: "Utente Test",
      department: { id: "demacs" },
    },
    loading: false,
  };
}

function renderWithSession(component, role) {
  return render(
    <AuthContext.Provider value={makeSession(role)}>
      {component}
    </AuthContext.Provider>
  );
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("UNITICKET3-29 - Frontend", () => {
  it("il professore vede solo il proprio dipartimento nel form", async () => {
    renderWithSession(<BookingRequestForm />, "PROFESSOR");

    const department = screen.getByLabelText(/Dipartimento/);

    await waitFor(() => {
      expect(department.value).toBe("demacs");
      expect(screen.getByRole("option", { name: "DeMaCS" })).toBeTruthy();
    });

    expect(department.disabled).toBe(true);
    expect(screen.queryByRole("option", { name: "DiSPeS" })).toBeNull();

    expect(
      await screen.findByRole("option", { name: "Aula DeMaCS" })
    ).toBeTruthy();

    expect(
      screen.queryByRole("option", { name: "Aula DiSPeS" })
    ).toBeNull();
  });

  it.each(["PROFESSOR", "ADMIN"])(
    "il calendario limita il dipartimento per %s",
    async (role) => {
      renderWithSession(<Calendar />, role);

      const department = screen.getByLabelText("Dipartimento");

      await waitFor(() => {
        expect(department.value).toBe("demacs");
      });

      expect(department.disabled).toBe(true);
      expect(screen.getByRole("option", { name: "DeMaCS" })).toBeTruthy();
      expect(screen.queryByRole("option", { name: "DiSPeS" })).toBeNull();

      expect(
        screen.getByRole("option", { name: "Aula DeMaCS" })
      ).toBeTruthy();

      expect(
        screen.queryByRole("option", { name: "Aula DiSPeS" })
      ).toBeNull();
    }
  );

  it("il visitatore può scegliere tutti i dipartimenti", async () => {
    renderWithSession(<Calendar />, null);

    const department = screen.getByLabelText("Dipartimento");

    expect(
      await screen.findByRole("option", { name: "DeMaCS" })
    ).toBeTruthy();

    expect(screen.getByRole("option", { name: "DiSPeS" })).toBeTruthy();
    expect(department.disabled).toBe(false);

    fireEvent.change(department, { target: { value: "dispes" } });

    expect(department.value).toBe("dispes");
    expect(
      screen.getByRole("option", { name: "Aula DiSPeS" })
    ).toBeTruthy();
  });

  it("l'amministratore carica le richieste del proprio dipartimento", async () => {
    renderWithSession(<BookingRequests />, "ADMIN");

    await waitFor(() => {
      expect(getPendingBookingRequests).toHaveBeenCalledWith("demacs");
    });

    expect(
      await screen.findByText("Nessuna richiesta di prenotazione in attesa.")
    ).toBeTruthy();
  });
});
