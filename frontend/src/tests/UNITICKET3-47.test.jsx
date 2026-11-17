// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import BookingRequests from "../pages/BookingRequests";
import { AuthContext } from "../contexts/AuthContextValue";
import * as bookingService from "../services/bookingService";

const {
  mockDoc,
  mockGetDocs,
  mockGetDoc,
  mockQuery,
  mockWhere,
  mockCollection,
} = vi.hoisted(() => ({
  mockDoc: vi.fn(),
  mockGetDocs: vi.fn(),
  mockGetDoc: vi.fn(),
  mockQuery: vi.fn(),
  mockWhere: vi.fn(),
  mockCollection: vi.fn(),
}));

vi.mock("firebase/firestore", () => ({
  collection: mockCollection,
  doc: mockDoc,
  getDoc: mockGetDoc,
  getDocs: mockGetDocs,
  query: mockQuery,
  where: mockWhere,
  serverTimestamp: vi.fn(),
  runTransaction: vi.fn(),
  Timestamp: {
    fromDate: (date) => ({
      toDate: () => date,
      toMillis: () => date.getTime(),
    }),
  },
}));

vi.mock("../firebase/client", () => ({
  db: {},
}));

import {
  getDepartmentBookingRequests,
  getPendingBookingRequests,
} from "../services/bookingService";

function makeTimestamp(timeStr) {
  return {
    toDate: () => ({
      toLocaleTimeString: () => timeStr,
    }),
  };
}

describe("UNITICKET3-47 - View booking requests history for assigned department", () => {
  describe("getDepartmentBookingRequests Service", () => {
    beforeEach(() => {
      vi.clearAllMocks();
      mockDoc.mockImplementation((_db, coll, id) => ({
        id,
        path: `${coll}/${id}`,
      }));
      mockCollection.mockImplementation((_db, name) => ({ path: name }));
      mockWhere.mockImplementation((field, op, val) => ({ field, op, val }));
      mockQuery.mockImplementation((coll, ...clauses) => ({ coll, clauses }));
    });

    it("lancia un errore se il departmentId è assente o vuoto", async () => {
      await expect(getDepartmentBookingRequests(null)).rejects.toThrow(
        "Dipartimento amministratore non assegnato."
      );
      await expect(getDepartmentBookingRequests("")).rejects.toThrow(
        "Dipartimento amministratore non assegnato."
      );
    });

    it("filtra strettamente per il dipartimento assegnato", async () => {
      mockGetDocs.mockResolvedValue({ docs: [] });

      await getDepartmentBookingRequests("demacs", "ALL");

      expect(mockDoc).toHaveBeenCalledWith(expect.anything(), "departments", "demacs");
      expect(mockWhere).toHaveBeenCalledWith(
        "department",
        "==",
        expect.objectContaining({ id: "demacs" })
      );
    });

    it("filtra per stato se statusFilter è specificato (es. PENDING, APPROVED, REJECTED)", async () => {
      mockGetDocs.mockResolvedValue({ docs: [] });

      await getDepartmentBookingRequests("demacs", "APPROVED");

      expect(mockWhere).toHaveBeenCalledWith("status", "==", "APPROVED");
    });

    it("restituisce le richieste ordinate cronologicamente (dalla data e ora più vicina)", async () => {
      const mockRawDocs = [
        {
          id: "req-3",
          data: () => ({
            date: "2026-11-20",
            startsAt: makeTimestamp("14:00"),
            endsAt: makeTimestamp("16:00"),
            classroom: { id: "aula-3" },
            professorName: "Prof. Tre",
            status: "APPROVED",
          }),
        },
        {
          id: "req-1",
          data: () => ({
            date: "2026-10-15",
            startsAt: makeTimestamp("09:00"),
            endsAt: makeTimestamp("11:00"),
            classroom: { id: "aula-1" },
            professorName: "Prof. Uno",
            status: "PENDING",
          }),
        },
        {
          id: "req-2",
          data: () => ({
            date: "2026-10-15",
            startsAt: makeTimestamp("11:30"),
            endsAt: makeTimestamp("13:30"),
            classroom: { id: "aula-2" },
            professorName: "Prof. Due",
            status: "REJECTED",
            rejectionReason: "Aula occupata per esami",
          }),
        },
        {
          id: "req-0",
          data: () => ({
            date: "2026-10-01",
            startsAt: makeTimestamp("08:30"),
            endsAt: makeTimestamp("10:30"),
            classroom: { id: "aula-0" },
            professorName: "Prof. Zero",
            status: "APPROVED",
          }),
        },
      ];

      mockGetDocs.mockResolvedValue({ docs: mockRawDocs });
      mockGetDoc.mockResolvedValue({ exists: () => false });

      const results = await getDepartmentBookingRequests("demacs", "ALL");

      expect(results).toHaveLength(4);
      expect(results[0].id).toBe("req-0");
      expect(results[0].date).toBe("2026-10-01");
      expect(results[1].id).toBe("req-1");
      expect(results[1].date).toBe("2026-10-15");
      expect(results[1].startTime).toBe("09:00");
      expect(results[2].id).toBe("req-2");
      expect(results[2].date).toBe("2026-10-15");
      expect(results[2].startTime).toBe("11:30");
      expect(results[2].rejectionReason).toBe("Aula occupata per esami");
      expect(results[3].id).toBe("req-3");
      expect(results[3].date).toBe("2026-11-20");
    });

    it("getPendingBookingRequests delega a getDepartmentBookingRequests con filtro PENDING", async () => {
      mockGetDocs.mockResolvedValue({ docs: [] });

      await getPendingBookingRequests("demacs");

      expect(mockWhere).toHaveBeenCalledWith("status", "==", "PENDING");
      expect(mockWhere).toHaveBeenCalledWith(
        "department",
        "==",
        expect.objectContaining({ id: "demacs" })
      );
    });
  });

  describe("BookingRequests Component - Visualizzazione storico dipartimento", () => {
    const adminSession = {
      user: { uid: "admin-demacs" },
      profile: {
        role: "ADMIN",
        department: { id: "demacs" },
      },
      loading: false,
    };

    const departmentRequests = [
      {
        id: "req-1",
        classroom: "Aula Turing (Cubo 30B)",
        professorName: "Prof. Rossi",
        professorUniversityId: "100001",
        date: "2026-10-15",
        startTime: "09:00",
        endTime: "11:00",
        status: "PENDING",
      },
      {
        id: "req-2",
        classroom: "Aula Fermi (Cubo 31B)",
        professorName: "Prof. Bianchi",
        professorUniversityId: "100002",
        date: "2026-10-16",
        startTime: "11:00",
        endTime: "13:00",
        status: "APPROVED",
      },
      {
        id: "req-3",
        classroom: "Lab Inf 1 (Cubo 32C)",
        professorName: "Prof. Verdi",
        professorUniversityId: "100003",
        date: "2026-10-17",
        startTime: "14:00",
        endTime: "16:00",
        status: "REJECTED",
        rejectionReason: "Aula non disponibile per manutenzione straordinaria",
      },
    ];

    afterEach(() => {
      cleanup();
      vi.restoreAllMocks();
    });

    it("carica e mostra inizialmente le richieste pendenti del dipartimento", async () => {
      vi.spyOn(bookingService, "getPendingBookingRequests").mockResolvedValue([
        departmentRequests[0],
      ]);

      render(
        <AuthContext.Provider value={adminSession}>
          <BookingRequests />
        </AuthContext.Provider>
      );

      expect(await screen.findByText("Aula Turing (Cubo 30B)")).toBeTruthy();
      expect(screen.getByText("Prof. Rossi")).toBeTruthy();
      expect(screen.getByText("100001")).toBeTruthy();
      expect(screen.getByText("2026-10-15")).toBeTruthy();
      expect(screen.getByText("09:00 - 11:00")).toBeTruthy();

      const badgePending = screen.getByText("In attesa");
      expect(badgePending.classList.contains("ur-badge-pending")).toBe(true);

      expect(screen.getByRole("button", { name: /^approva$/i })).toBeTruthy();
      expect(screen.getByRole("button", { name: /^rifiuta$/i })).toBeTruthy();
    });

    it("permette di passare alla scheda 'Tutte le richieste' e mostra richieste attuali e precedenti", async () => {
      vi.spyOn(bookingService, "getPendingBookingRequests").mockResolvedValue([
        departmentRequests[0],
      ]);
      vi.spyOn(bookingService, "getDepartmentBookingRequests").mockResolvedValue(
        departmentRequests
      );

      render(
        <AuthContext.Provider value={adminSession}>
          <BookingRequests />
        </AuthContext.Provider>
      );

      await screen.findByText("Aula Turing (Cubo 30B)");

      const allTab = screen.getByRole("tab", { name: "Tutte le richieste" });
      fireEvent.click(allTab);

      await waitFor(() => {
        expect(bookingService.getDepartmentBookingRequests).toHaveBeenCalledWith(
          "demacs",
          "ALL"
        );
      });

      expect(await screen.findByText("Aula Fermi (Cubo 31B)")).toBeTruthy();
      expect(screen.getByText("Lab Inf 1 (Cubo 32C)")).toBeTruthy();

      const badgeApproved = screen.getByText("Approvata");
      expect(badgeApproved.classList.contains("ur-badge-approved")).toBe(true);

      const badgeRejected = screen.getByText("Rifiutata");
      expect(badgeRejected.classList.contains("ur-badge-rejected")).toBe(true);

      expect(
        screen.getByText("Aula non disponibile per manutenzione straordinaria")
      ).toBeTruthy();

      const approveButtons = screen.getAllByRole("button", { name: /^approva$/i });
      expect(approveButtons).toHaveLength(1);
    });

    it("permette di filtrare per richieste 'Approvate'", async () => {
      vi.spyOn(bookingService, "getPendingBookingRequests").mockResolvedValue([]);
      vi.spyOn(bookingService, "getDepartmentBookingRequests").mockResolvedValue([
        departmentRequests[1],
      ]);

      render(
        <AuthContext.Provider value={adminSession}>
          <BookingRequests />
        </AuthContext.Provider>
      );

      const approvedTab = screen.getByRole("tab", { name: "Approvate" });
      fireEvent.click(approvedTab);

      await waitFor(() => {
        expect(bookingService.getDepartmentBookingRequests).toHaveBeenCalledWith(
          "demacs",
          "APPROVED"
        );
      });

      expect(await screen.findByText("Aula Fermi (Cubo 31B)")).toBeTruthy();
      expect(screen.getByText("Approvata")).toBeTruthy();
      expect(screen.queryByRole("button", { name: /^approva$/i })).toBeNull();
      expect(screen.queryByRole("button", { name: /^rifiuta$/i })).toBeNull();
    });

    it("permette di filtrare per richieste 'Rifiutate' mostrando la motivazione", async () => {
      vi.spyOn(bookingService, "getPendingBookingRequests").mockResolvedValue([]);
      vi.spyOn(bookingService, "getDepartmentBookingRequests").mockResolvedValue([
        departmentRequests[2],
      ]);

      render(
        <AuthContext.Provider value={adminSession}>
          <BookingRequests />
        </AuthContext.Provider>
      );

      const rejectedTab = screen.getByRole("tab", { name: "Rifiutate" });
      fireEvent.click(rejectedTab);

      await waitFor(() => {
        expect(bookingService.getDepartmentBookingRequests).toHaveBeenCalledWith(
          "demacs",
          "REJECTED"
        );
      });

      expect(await screen.findByText("Lab Inf 1 (Cubo 32C)")).toBeTruthy();
      expect(screen.getByText("Rifiutata")).toBeTruthy();
      expect(
        screen.getByText("Aula non disponibile per manutenzione straordinaria")
      ).toBeTruthy();
      expect(screen.queryByRole("button", { name: /^approva$/i })).toBeNull();
    });

    it("mostra stato vuoto coerente con il filtro attivo", async () => {
      vi.spyOn(bookingService, "getPendingBookingRequests").mockResolvedValue([]);
      vi.spyOn(bookingService, "getDepartmentBookingRequests").mockResolvedValue([]);

      render(
        <AuthContext.Provider value={adminSession}>
          <BookingRequests />
        </AuthContext.Provider>
      );

      expect(
        await screen.findByText("Nessuna richiesta di prenotazione in attesa.")
      ).toBeTruthy();

      const approvedTab = screen.getByRole("tab", { name: "Approvate" });
      fireEvent.click(approvedTab);
      expect(
        await screen.findByText("Nessuna richiesta di prenotazione approvata.")
      ).toBeTruthy();

      const rejectedTab = screen.getByRole("tab", { name: "Rifiutate" });
      fireEvent.click(rejectedTab);
      expect(
        await screen.findByText("Nessuna richiesta di prenotazione rifiutata.")
      ).toBeTruthy();

      const allTab = screen.getByRole("tab", { name: "Tutte le richieste" });
      fireEvent.click(allTab);
      expect(
        await screen.findByText("Nessuna richiesta di prenotazione trovata.")
      ).toBeTruthy();
    });

    it("blocca la visualizzazione se l'amministratore non ha un dipartimento assegnato", async () => {
      const adminWithoutDept = {
        user: { uid: "admin-no-dept" },
        profile: {
          role: "ADMIN",
          department: null,
        },
        loading: false,
      };

      render(
        <AuthContext.Provider value={adminWithoutDept}>
          <BookingRequests />
        </AuthContext.Provider>
      );

      const alert = await screen.findByRole("alert");
      expect(alert.textContent).toContain("Dipartimento amministratore non assegnato.");
    });
  });
});
