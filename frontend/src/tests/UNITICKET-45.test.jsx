// @vitest-environment jsdom
// jsdom fornisce un DOM con document e window per renderizzare React nel test.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// render monta i componenti.
// screen cerca gli elementi nel DOM.
// fireEvent simula le interazioni.
// cleanup smonta i componenti al termine del test.
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { MemoryRouter } from "react-router";

import App from "../App";
import { AuthContext } from "../contexts/AuthContextValue";
import {
  getPendingBookingRequests,
  rejectBookingRequest,
} from "../services/bookingService";

// Sostituiamo il service con funzioni di prova.
// vi.fn() registra le chiamate ricevute e permette di impostare una risposta.
// Vitest prepara questi mock prima di caricare i moduli importati.
vi.mock("../services/bookingService", () => ({
  getPendingBookingRequests: vi.fn(),
  rejectBookingRequest: vi.fn(),
}));

// App importa anche le funzionalità di autenticazione.
// Forniamo funzioni di prova per quelle dipendenze.
vi.mock("../services/authService", () => ({
  loginWithUniversityId: vi.fn(),
  logout: vi.fn(),
}));

// Gli oggetti Firebase di prova soddisfano le dipendenze dei moduli importati.
// Le richieste visualizzate arriveranno dal mock del bookingService.
vi.mock("../firebase/client", () => ({
  auth: {},
  db: {},
}));

// Forniamo risposte prevedibili anche alle dipendenze del calendario.
vi.mock("../services/calendarService", () => ({
  getCalendarCatalog: async () => ({
    departments: [],
    classrooms: [],
  }),
  getCalendarBookings: async () => [],
}));

// Questa sessione viene fornita ad AuthContext.Provider.
// useAuth() leggerà questi dati durante il test.
const adminSession = {
  user: { uid: "admin-test" },
  profile: {
    role: "ADMIN",
    department: { id: "demacs" },
  },
  // La sessione è già stata caricata, quindi ProtectedRoute può valutarla.
  loading: false,
};

// Una richiesta di prova nel formato che il service consegna a React.
// Aula, data e orari sono già pronti per essere visualizzati.
const pendingRequest = {
  id: "booking-123",
  classroom: "Aula prova",
  professorName: "Professore Test",
  professorUniversityId: "100001",
  date: "2026-11-13",
  startTime: "10:00",
  endTime: "11:00",
  status: "PENDING",
};

// Prima di ogni test azzeriamo le chiamate e le risposte impostate sui mock.
beforeEach(() => {
  vi.resetAllMocks();
});

// Dopo ogni test smontiamo i componenti e ripuliamo il DOM.
afterEach(() => {
  cleanup();
});

function openPage(session = adminSession, path = "/booking-requests") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthContext.Provider value={session}>
        <App />
      </AuthContext.Provider>
    </MemoryRouter>
  );
}

// describe raggruppa i test della storia nell'output di Vitest.
describe("UNITICKET3-45 - Rifiuto motivato", () => {
  // async permette di aspettare il caricamento delle richieste.
  it("apre il form e lo chiude con Annulla ", async () => {
    // PREPARAZIONE
    // Quando la pagina chiama getPendingBookingRequests, il mock restituisce
    // una Promise che si risolve con l'array contenente la richiesta di prova.
    vi.mocked(getPendingBookingRequests).mockResolvedValue([pendingRequest]);

    openPage();

    // APERTURA DEL FORM
    // findByRole aspetta che compaia il pulsante dopo il caricamento.
    // /^rifiuta$/i cerca il nome completo ignorando le maiuscole.
    // fireEvent.click attiva l'onClick del pulsante.
    fireEvent.click(
      await screen.findByRole("button", { name: /^rifiuta$/i })
    );

    // Una textarea ha ruolo accessibile "textbox".
    // Il suo nome deriva dalla label "Motivazione del rifiuto".
    // getByRole cerca subito il campo e fa fallire il test se è assente.
    expect(
      screen.getByRole("textbox", { name: /motivazione del rifiuto/i })
    ).toBeTruthy();

    // ANNULLAMENTO
    // Il pulsante è già visibile nel form, quindi usiamo getByRole.
    fireEvent.click(
      screen.getByRole("button", { name: /^annulla$/i })
    );

    // VERIFICHE FINALI
    // queryByRole restituisce null quando il campo è assente.
    // Verifichiamo quindi che il form si sia chiuso.
    expect(
      screen.queryByRole("textbox", { name: /motivazione del rifiuto/i })
    ).toBeNull();

  });

  it(" conferma del rifiuto con motivazione", async()=>{

    // Preparo la richiesta e una risposta positiva del service.
    vi.mocked(getPendingBookingRequests).mockResolvedValue([pendingRequest]);
    vi.mocked(rejectBookingRequest).mockResolvedValue(undefined);

    openPage();

    //apro il form
    fireEvent.click(
      await screen.findByRole("button", { name: /^rifiuta$/i })
    );

    //cerco la casella di testo
    const inputElement = screen.getByLabelText(/motivazione del rifiuto/i);

    // Simulo l’utente che scrive "Aula occupata".
    fireEvent.change(inputElement, {
    target: { value: "Aula occupata" },
    });

    // Controllo che la casella contenga il testo.
    expect(inputElement.value).toBe("Aula occupata");

     // Confermo il rifiuto.
    fireEvent.click(
        screen.getByRole("button", { name: /^conferma rifiuto$/i })
    );


    // Aspetto che la pagina mostri l'esito del salvataggio.
    expect(
        await screen.findByText("Richiesta rifiutata con successo.")
    ).toBeTruthy();

    // Verifico quali dati React ha passato al service.
    expect(rejectBookingRequest).toHaveBeenCalledWith(
        pendingRequest.id,
        "Aula occupata"
    );

    // La richiesta decisa viene rimossa dalla lista delle pendenti.
    expect(screen.queryByText(pendingRequest.classroom)).toBeNull();

  });
});