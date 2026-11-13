// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import BookingRequests from "../pages/BookingRequests";
import { AuthContext } from "../contexts/AuthContextValue";
import * as bookingService from "../services/bookingService";

const {
  mockDoc,
  mockRunTransaction,
  mockTransactionGet,
  mockTransactionUpdate,
  mockGetDocs,
  mockQuery,
  mockWhere,
  mockCollection,
} = vi.hoisted(() => ({
  mockDoc: vi.fn(),
  mockRunTransaction: vi.fn(),
  mockTransactionGet: vi.fn(),
  mockTransactionUpdate: vi.fn(),
  mockGetDocs: vi.fn(),
  mockQuery: vi.fn(),
  mockWhere: vi.fn(),
  mockCollection: vi.fn(),
}));

vi.mock("firebase/firestore", () => ({
  collection: mockCollection,
  addDoc: vi.fn(),
  serverTimestamp: vi.fn(),
  doc: mockDoc,
  getDoc: vi.fn(),
  getDocs: mockGetDocs,
  query: mockQuery,
  where: mockWhere,
  runTransaction: mockRunTransaction,
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
  approveBookingRequest,
  isBookingOverlapping,
} from "../services/bookingService";

function makeTimestamp(dateStr, timeStr) {
  return {
    toDate: () => ({
      toLocaleTimeString: () => timeStr,
    }),
  };
}

describe("UNITICKET3-30 - Prevent overlapping booking approvals", () => {
  describe("isBookingOverlapping - Helper di sovrapposizione oraria", () => {
    const baseBooking = {
      id: "req-1",
      classroom: { id: "aula-1" },
      date: "2027-01-12",
      startsAt: makeTimestamp("2027-01-12", "10:00"),
      endsAt: makeTimestamp("2027-01-12", "11:00"),
    };

    it("restituisce false se uno dei due argomenti è mancante", () => {
      expect(isBookingOverlapping(null, baseBooking)).toBe(false);
      expect(isBookingOverlapping(baseBooking, null)).toBe(false);
    });

    it("restituisce false se si confronta una prenotazione con se stessa (stesso id)", () => {
      expect(isBookingOverlapping(baseBooking, { ...baseBooking })).toBe(false);
    });

    it("restituisce false se le aule sono diverse", () => {
      const otherClassroom = {
        id: "req-2",
        classroom: { id: "aula-2" },
        date: "2027-01-12",
        startsAt: makeTimestamp("2027-01-12", "10:00"),
        endsAt: makeTimestamp("2027-01-12", "11:00"),
      };
      expect(isBookingOverlapping(baseBooking, otherClassroom)).toBe(false);
    });

    it("restituisce false se le date sono diverse", () => {
      const otherDate = {
        id: "req-2",
        classroom: { id: "aula-1" },
        date: "2027-01-13",
        startsAt: makeTimestamp("2027-01-13", "10:00"),
        endsAt: makeTimestamp("2027-01-13", "11:00"),
      };
      expect(isBookingOverlapping(baseBooking, otherDate)).toBe(false);
    });

    it("restituisce false per prenotazioni consecutive adiacenti (fine A == inizio B)", () => {
      const adjacentAfter = {
        id: "req-2",
        classroom: { id: "aula-1" },
        date: "2027-01-12",
        startsAt: makeTimestamp("2027-01-12", "11:00"),
        endsAt: makeTimestamp("2027-01-12", "12:00"),
      };
      expect(isBookingOverlapping(baseBooking, adjacentAfter)).toBe(false);

      const adjacentBefore = {
        id: "req-3",
        classroom: { id: "aula-1" },
        date: "2027-01-12",
        startsAt: makeTimestamp("2027-01-12", "09:00"),
        endsAt: makeTimestamp("2027-01-12", "10:00"),
      };
      expect(isBookingOverlapping(baseBooking, adjacentBefore)).toBe(false);
    });

    it("restituisce true per intervalli perfettamente coincidenti (10:00 - 11:00)", () => {
      const sameTime = {
        id: "req-2",
        classroom: { id: "aula-1" },
        date: "2027-01-12",
        startsAt: makeTimestamp("2027-01-12", "10:00"),
        endsAt: makeTimestamp("2027-01-12", "11:00"),
      };
      expect(isBookingOverlapping(baseBooking, sameTime)).toBe(true);
    });

    it("restituisce true per sovrapposizione parziale (es. 09:30 - 10:30)", () => {
      const overlapStart = {
        id: "req-2",
        classroom: { id: "aula-1" },
        date: "2027-01-12",
        startsAt: makeTimestamp("2027-01-12", "09:30"),
        endsAt: makeTimestamp("2027-01-12", "10:30"),
      };
      expect(isBookingOverlapping(baseBooking, overlapStart)).toBe(true);
    });

    it("restituisce true per sovrapposizione parziale (es. 10:30 - 11:30)", () => {
      const overlapEnd = {
        id: "req-2",
        classroom: { id: "aula-1" },
        date: "2027-01-12",
        startsAt: makeTimestamp("2027-01-12", "10:30"),
        endsAt: makeTimestamp("2027-01-12", "11:30"),
      };
      expect(isBookingOverlapping(baseBooking, overlapEnd)).toBe(true);
    });

    it("restituisce true se una prenotazione include interamente l'altra", () => {
      const enclosing = {
        id: "req-2",
        classroom: { id: "aula-1" },
        date: "2027-01-12",
        startsAt: makeTimestamp("2027-01-12", "09:00"),
        endsAt: makeTimestamp("2027-01-12", "12:00"),
      };
      expect(isBookingOverlapping(baseBooking, enclosing)).toBe(true);
    });

    it("funziona anche con orari in formato stringa HH:MM (startTime/endTime)", () => {
      const stringBookingA = {
        id: "req-1",
        classroom: "aula-1",
        date: "2027-01-12",
        startTime: "10:00",
        endTime: "11:00",
      };
      const stringBookingB = {
        id: "req-2",
        classroom: "aula-1",
        date: "2027-01-12",
        startTime: "10:30",
        endTime: "11:30",
      };
      expect(isBookingOverlapping(stringBookingA, stringBookingB)).toBe(true);
    });
  });

  describe("approveBookingRequest - Verifica e blocco in approvazione", () => {
    const bookingRef = { id: "req-pending" };
    const transaction = {
      get: mockTransactionGet,
      update: mockTransactionUpdate,
    };

    beforeEach(() => {
      vi.clearAllMocks();
      mockDoc.mockReturnValue(bookingRef);
      mockRunTransaction.mockImplementation(async (db, callback) => {
        return callback(transaction);
      });
    });

    it("approva regolarmente se non ci sono altre prenotazioni approvate", async () => {
      mockTransactionGet.mockResolvedValue({
        exists: () => true,
        data: () => ({
          status: "PENDING",
          classroom: { id: "aula-1" },
          date: "2027-01-12",
          startsAt: makeTimestamp("2027-01-12", "10:00"),
          endsAt: makeTimestamp("2027-01-12", "11:00"),
        }),
      });

      mockGetDocs.mockResolvedValue({ docs: [] });

      await approveBookingRequest("req-pending");

      expect(mockTransactionUpdate).toHaveBeenCalledWith(bookingRef, {
        status: "APPROVED",
      });
    });

    it("approva regolarmente se le prenotazioni approvate esistenti non sono sovrapposte (orario adiacente)", async () => {
      mockTransactionGet.mockResolvedValue({
        exists: () => true,
        data: () => ({
          status: "PENDING",
          classroom: { id: "aula-1" },
          date: "2027-01-12",
          startsAt: makeTimestamp("2027-01-12", "10:00"),
          endsAt: makeTimestamp("2027-01-12", "11:00"),
        }),
      });

      mockGetDocs.mockResolvedValue({
        docs: [
          {
            id: "req-approved-1",
            data: () => ({
              status: "APPROVED",
              classroom: { id: "aula-1" },
              date: "2027-01-12",
              startsAt: makeTimestamp("2027-01-12", "11:00"),
              endsAt: makeTimestamp("2027-01-12", "12:00"),
            }),
          },
        ],
      });

      await approveBookingRequest("req-pending");

      expect(mockTransactionUpdate).toHaveBeenCalledWith(bookingRef, {
        status: "APPROVED",
      });
    });

    it("blocca l'approvazione e solleva un errore se c'è una prenotazione approvata sovrapposta", async () => {
      mockTransactionGet.mockResolvedValue({
        exists: () => true,
        data: () => ({
          status: "PENDING",
          classroom: { id: "aula-1" },
          date: "2027-01-12",
          startsAt: makeTimestamp("2027-01-12", "10:00"),
          endsAt: makeTimestamp("2027-01-12", "11:00"),
        }),
      });

      mockGetDocs.mockResolvedValue({
        docs: [
          {
            id: "req-approved-conflict",
            data: () => ({
              status: "APPROVED",
              classroom: { id: "aula-1" },
              date: "2027-01-12",
              startsAt: makeTimestamp("2027-01-12", "10:30"),
              endsAt: makeTimestamp("2027-01-12", "11:30"),
            }),
          },
        ],
      });

      await expect(approveBookingRequest("req-pending")).rejects.toThrow(
        "Impossibile approvare la richiesta: l'aula è già prenotata nella fascia oraria richiesta."
      );

      expect(mockTransactionUpdate).not.toHaveBeenCalled();
    });

    it("impedisce la doppia approvazione in caso di approvazioni simultanee per la stessa aula", async () => {
      const dbState = {
        classroomVersion: 1,
        approvedRequests: [],
        requests: {
          "req-A": {
            status: "PENDING",
            classroom: { id: "aula-1" },
            date: "2027-01-12",
            startsAt: makeTimestamp("2027-01-12", "10:00"),
            endsAt: makeTimestamp("2027-01-12", "11:00"),
          },
          "req-B": {
            status: "PENDING",
            classroom: { id: "aula-1" },
            date: "2027-01-12",
            startsAt: makeTimestamp("2027-01-12", "10:30"),
            endsAt: makeTimestamp("2027-01-12", "11:30"),
          },
        },
      };

      mockDoc.mockImplementation((db, collectionName, id) => ({
        id,
        path: `${collectionName}/${id}`,
      }));

      mockRunTransaction.mockImplementation(async (db, callback) => {
        let attempts = 0;
        while (attempts < 5) {
          attempts++;
          let readClassroomVersion = dbState.classroomVersion;
          const pendingUpdates = [];

          const customTransaction = {
            get: vi.fn(async (docRef) => {
              if (docRef.id === "aula-1" || docRef.path?.includes("classrooms")) {
                readClassroomVersion = dbState.classroomVersion;
                return {
                  exists: () => true,
                  data: () => ({ version: readClassroomVersion }),
                };
              }
              const data = dbState.requests[docRef.id];
              return {
                exists: () => Boolean(data),
                data: () => data,
              };
            }),
            update: vi.fn((docRef, updateData) => {
              pendingUpdates.push({ docRef, updateData });
            }),
          };

          mockGetDocs.mockImplementation(async () => ({
            docs: dbState.approvedRequests.map((req) => ({
              id: req.id,
              data: () => req,
            })),
          }));

          try {
            await callback(customTransaction);

            if (readClassroomVersion !== dbState.classroomVersion) {
              continue;
            }

            dbState.classroomVersion++;
            for (const { docRef, updateData } of pendingUpdates) {
              if (docRef.id in dbState.requests) {
                dbState.requests[docRef.id] = {
                  ...dbState.requests[docRef.id],
                  ...updateData,
                };
                if (updateData.status === "APPROVED") {
                  dbState.approvedRequests.push({
                    id: docRef.id,
                    ...dbState.requests[docRef.id],
                  });
                }
              }
            }
            return;
          } catch (err) {
            throw err;
          }
        }
        throw new Error("Transazione fallita dopo tentativi massimi");
      });

      const results = await Promise.allSettled([
        approveBookingRequest("req-A"),
        approveBookingRequest("req-B"),
      ]);

      const fulfilled = results.filter((r) => r.status === "fulfilled");
      const rejected = results.filter((r) => r.status === "rejected");

      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect(rejected[0].reason.message).toContain(
        "Impossibile approvare la richiesta: l'aula è già prenotata"
      );
    });
  });

  describe("BookingRequests Component - Interfaccia grafica", () => {
    const adminSession = {
      user: { uid: "admin-1" },
      profile: {
        role: "ADMIN",
        department: { id: "demacs" },
      },
      loading: false,
    };

    const conflictingRequests = [
      {
        id: "req-1",
        classroom: "Aula 1",
        professorName: "Prof. Rossi",
        professorUniversityId: "100001",
        date: "2027-01-12",
        startTime: "10:00",
        endTime: "11:00",
        status: "PENDING",
      },
      {
        id: "req-2",
        classroom: "Aula 1",
        professorName: "Prof. Bianchi",
        professorUniversityId: "100002",
        date: "2027-01-12",
        startTime: "10:30",
        endTime: "11:30",
        status: "PENDING",
      },
    ];

    afterEach(() => {
      cleanup();
    });

    it("mostra il badge e la nota di conflitto per richieste pendenti sovrapposte", async () => {
      vi.spyOn(bookingService, "getPendingBookingRequests").mockResolvedValue(conflictingRequests);

      render(
        <AuthContext.Provider value={adminSession}>
          <BookingRequests />
        </AuthContext.Provider>
      );

      const badges = await screen.findAllByText("Conflitto orario");
      expect(badges).toHaveLength(2);

      const notices = screen.getAllByRole("note");
      expect(notices).toHaveLength(2);
      expect(notices[0].textContent).toContain(
        "Attenzione: questa richiesta si sovrappone a un'altra richiesta in attesa per la stessa aula."
      );
    });

    it("mostra il messaggio di errore se l'approvazione fallisce per conflitto orario", async () => {
      vi.spyOn(bookingService, "getPendingBookingRequests").mockResolvedValue([conflictingRequests[0]]);
      vi.spyOn(bookingService, "approveBookingRequest").mockRejectedValue(
        new Error("Impossibile approvare la richiesta: l'aula è già prenotata nella fascia oraria richiesta.")
      );

      render(
        <AuthContext.Provider value={adminSession}>
          <BookingRequests />
        </AuthContext.Provider>
      );

      const approveBtn = await screen.findByRole("button", { name: /^approva$/i });
      fireEvent.click(approveBtn);

      const errorAlert = await screen.findByRole("alert");
      expect(errorAlert.textContent).toContain(
        "Impossibile approvare la richiesta: l'aula è già prenotata nella fascia oraria richiesta."
      );
    });
  });
});
