// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import Calendar from "../components/calendar/Calendar";
import {
  getCalendarCatalog,
  getCalendarBookings,
} from "../services/calendarService";

// Simuliamo il servizio per non usare Firestore.
vi.mock("../services/calendarService", () => ({
  getCalendarCatalog: vi.fn(),
  getCalendarBookings: vi.fn(),
}));

const catalog = {
  departments: [
    { id: "fis", name: "FiS" },
    { id: "demacs", name: "DeMaCS" },
  ],
  classrooms: [
    { id: "a", name: "Aula A", departmentId: "fis" },
    { id: "b", name: "Aula B", departmentId: "fis" },
    { id: "c", name: "Aula C", departmentId: "demacs" },
  ],
};

const firstBooking = {
  id: "first",
  date: "2026-10-26",
  startsAt: "09:00",
  endsAt: "11:00",
  departmentId: "fis",
  departmentName: "FiS",
  classroomId: "a",
  classroomName: "Aula A",
  professorName: "Docente Uno",
  status: "APPROVED",
};

const exampleBookings = [
  firstBooking,
  {
    ...firstBooking,
    id: "second",
    startsAt: "14:00",
    endsAt: "16:00",
    classroomId: "b",
    classroomName: "Aula B",
    professorName: "Docente Due",
  },
];

beforeEach(() => {
  vi.resetAllMocks();

  // Fissiamo la data per rendere i test uguali ogni giorno.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 9, 26, 12));

  vi.mocked(getCalendarCatalog).mockResolvedValue(catalog);

  vi.mocked(getCalendarBookings).mockImplementation(
    async ({ departmentId }) =>
      departmentId === "fis" ? exampleBookings : []
  );
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

// Apre il calendario e aspetta il catalogo.
async function openCalendar() {
  render(<Calendar />);
  await screen.findByRole("option", { name: "FiS" });
}

// Seleziona FiS e aspetta le due prenotazioni di esempio.
async function selectDepartment() {
  fireEvent.change(screen.getByLabelText("Dipartimento"), {
    target: { value: "fis" },
  });

  await screen.findByText("2 pren.");
}

describe("UNITICKET3-19 - Calendario aule", () => {
  it("senza dipartimento non mostra prenotazioni e disabilita il filtro aula", async () => {
    await openCalendar();

    expect(
      screen.getByLabelText("Aula (facoltativa)").disabled
    ).toBe(true);

    expect(screen.queryByText(/pren\./)).toBeNull();
  });

  it("mostra conteggio, prima prenotazione e dettagli del giorno", async () => {
    await openCalendar();
    await selectDepartment();

    const day = screen.getByRole("button", {
      name: /26 ottobre 2026/,
    });

    expect(day.textContent).toContain("2 pren.");
    expect(day.textContent).toContain("09:00");
    expect(day.textContent).not.toContain("14:00");

    fireEvent.click(day);

    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByText("Professore: Docente Uno")).toBeTruthy();
    expect(screen.getByText("Professore: Docente Due")).toBeTruthy();
  });

  it("mostra soltanto le prenotazioni dell'aula selezionata", async () => {
    await openCalendar();
    await selectDepartment();

    fireEvent.change(screen.getByLabelText("Aula (facoltativa)"), {
      target: { value: "b" },
    });

    expect(await screen.findByText("1 pren.")).toBeTruthy();

    fireEvent.click(
      screen.getByRole("button", { name: /26 ottobre 2026/ })
    );

    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    expect(screen.getByText("Professore: Docente Due")).toBeTruthy();
  });

  it("apre anche un giorno privo di prenotazioni", async () => {
    await openCalendar();
    await selectDepartment();

    fireEvent.click(
      screen.getByRole("button", { name: /27 ottobre 2026/ })
    );

    expect(
      screen.getByRole("region", {
        name: /Prenotazioni del.*27 ottobre 2026/,
      })
    ).toBeTruthy();

    expect(screen.queryByRole("listitem")).toBeNull();
  });

  it("cambia mese con le frecce e torna al mese corrente con Oggi", async () => {
    await openCalendar();

    fireEvent.click(
      screen.getByRole("button", { name: "Periodo successivo" })
    );

    expect(
      screen.getByRole("heading", { name: /novembre 2026/i })
    ).toBeTruthy();

    fireEvent.click(
      screen.getByRole("button", { name: "Periodo precedente" })
    );

    expect(
      screen.getByRole("heading", { name: /ottobre 2026/i })
    ).toBeTruthy();

    fireEvent.click(
      screen.getByRole("button", { name: "Periodo precedente" })
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Oggi" })
    );

    expect(
      screen.getByRole("heading", { name: /ottobre 2026/i })
    ).toBeTruthy();
  });
});