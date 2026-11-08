
import { describe, expect, it, vi } from "vitest";
import { validateBookingData } from "../services/bookingService";

vi.mock("../firebase/client", () => ({
  db: {},
}));

const validBooking = {
  departmentId: "demacs",
  classroomId: "aula1",
  professorId: "prof1",
  date: "2099-01-12",
  startTime: "10:00",
  endTime: "11:00",
};

function booking(startTime, endTime) {
  return {
    ...validBooking,
    startTime,
    endTime,
  };
}

describe("UNITICKET3-34 - University Operating Hours", () => {
  it.each([
    ["08:30", "09:30"],
    ["09:00", "10:00"],
    ["10:00", "12:00"],
    ["18:30", "19:30"],
  ])("accetta %s - %s", (start, end) => {
    expect(() => validateBookingData(booking(start, end))).not.toThrow();
  });

  it("rifiuta un inizio prima delle 08:30", () => {
    expect(() => validateBookingData(booking("08:29", "09:30")))
      .toThrow("La prenotazione non può iniziare prima delle 08:30.");
  });

  it("rifiuta un inizio dopo le 18:30", () => {
    expect(() => validateBookingData(booking("18:31", "19:30")))
      .toThrow("La prenotazione non può iniziare dopo le 18:30.");
  });

  it("rifiuta una fine dopo le 19:30", () => {
    expect(() => validateBookingData(booking("18:00", "19:31")))
      .toThrow("La prenotazione non può terminare dopo le 19:30.");
  });

  it("rifiuta una durata inferiore a 60 minuti", () => {
    expect(() => validateBookingData(booking("10:00", "10:59")))
      .toThrow("La prenotazione deve durare almeno un'ora.");
  });

  it("rifiuta una fine uguale all'inizio", () => {
    expect(() => validateBookingData(booking("10:00", "10:00")))
      .toThrow("L'orario di fine deve essere successivo all'orario di inizio.");
  });

  it("rifiuta un formato orario non valido", () => {
    expect(() => validateBookingData(booking("25:00", "26:00")))
      .toThrow("Formato orario non valido.");
  });
});
