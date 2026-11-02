import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockDoc,
  mockRunTransaction,
  mockTransactionGet,
  mockTransactionUpdate,
} = vi.hoisted(() => ({
  mockDoc: vi.fn(),
  mockRunTransaction: vi.fn(),
  mockTransactionGet: vi.fn(),
  mockTransactionUpdate: vi.fn(),
}));

vi.mock("firebase/firestore", () => ({
  collection: vi.fn(),
  addDoc: vi.fn(),
  serverTimestamp: vi.fn(),
  doc: mockDoc,
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  runTransaction: mockRunTransaction,
}));

vi.mock("../firebase/client", () => ({
  db: {},
}));

import {
  approveBookingRequest,
  rejectBookingRequest,
} from "../services/bookingService";

const bookingRef = { id: "booking-123" };

function createSnapshot(status, exists = true) {
  return {
    exists: () => exists,
    data: () => ({ status }),
  };
}

const transaction = {
  get: mockTransactionGet,
  update: mockTransactionUpdate,
};

describe("UNITICKET3-23 - Booking approval and rejection", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockDoc.mockReturnValue(bookingRef);

    // Simula l'esecuzione della transazione Firestore
    mockRunTransaction.mockImplementation(async (db, callback) => {
      return callback(transaction);
    });
  });

  describe("approveBookingRequest", () => {
    it("approves a pending booking request", async () => {
      mockTransactionGet.mockResolvedValue(createSnapshot("PENDING"));

      await approveBookingRequest("booking-123");

      expect(mockDoc).toHaveBeenCalledWith(
        {},
        "bookingRequest",
        "booking-123"
      );

      expect(mockTransactionUpdate).toHaveBeenCalledWith(
        bookingRef,
        { status: "APPROVED" }
      );
    });

    it("uses runTransaction to approve a booking request", async () => {
      mockTransactionGet.mockResolvedValue(createSnapshot("PENDING"));

      await approveBookingRequest("booking-123");

      expect(mockRunTransaction).toHaveBeenCalledTimes(1);

      expect(mockTransactionGet).toHaveBeenCalledWith(bookingRef);

      expect(mockTransactionUpdate).toHaveBeenCalledWith(
        bookingRef,
        { status: "APPROVED" }
      );
    });

    it("throws an error if the booking request does not exist", async () => {
      mockTransactionGet.mockResolvedValue(
        createSnapshot(undefined, false)
      );

      await expect(
        approveBookingRequest("booking-123")
      ).rejects.toThrow("Richiesta di prenotazione non trovata.");

      expect(mockTransactionUpdate).not.toHaveBeenCalled();
    });

    it("throws an error if the booking request is not pending", async () => {
      mockTransactionGet.mockResolvedValue(createSnapshot("REJECTED"));

      await expect(
        approveBookingRequest("booking-123")
      ).rejects.toThrow(
        "È possibile approvare solo richieste in attesa."
      );

      expect(mockTransactionUpdate).not.toHaveBeenCalled();
    });

    it("throws an error if the request ID is missing", async () => {
      await expect(approveBookingRequest("")).rejects.toThrow(
        "ID della richiesta obbligatorio."
      );

      expect(mockRunTransaction).not.toHaveBeenCalled();
    });
  });

  describe("rejectBookingRequest", () => {
    it("rejects a pending booking request", async () => {
      mockTransactionGet.mockResolvedValue(createSnapshot("PENDING"));

      await rejectBookingRequest("booking-123");

      expect(mockTransactionUpdate).toHaveBeenCalledWith(
        bookingRef,
        { status: "REJECTED" }
      );
    });

    it("throws an error if the booking request does not exist", async () => {
      mockTransactionGet.mockResolvedValue(
        createSnapshot(undefined, false)
      );

      await expect(
        rejectBookingRequest("booking-123")
      ).rejects.toThrow("Richiesta di prenotazione non trovata.");

      expect(mockTransactionUpdate).not.toHaveBeenCalled();
    });

    it("throws an error if the booking request is not pending", async () => {
      mockTransactionGet.mockResolvedValue(createSnapshot("APPROVED"));

      await expect(
        rejectBookingRequest("booking-123")
      ).rejects.toThrow(
        "È possibile rifiutare solo richieste in attesa."
      );

      expect(mockTransactionUpdate).not.toHaveBeenCalled();
    });

    it("throws an error if the request ID is missing", async () => {
      await expect(rejectBookingRequest("")).rejects.toThrow(
        "ID della richiesta obbligatorio."
      );

      expect(mockRunTransaction).not.toHaveBeenCalled();
    });
  });
});