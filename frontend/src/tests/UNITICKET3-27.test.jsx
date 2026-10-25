// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen,} from "@testing-library/react";
import { MemoryRouter } from "react-router";

import App from "../App";
import { AuthContext } from "../contexts/AuthContextValue";
import { logout } from "../services/authService";


// servizi mockati per non collegarci a Firebase.
vi.mock("../services/authService", () => ({
  loginWithUniversityId: vi.fn(),
  logout: vi.fn(),
}));

const guestSession = {
  user: null,
  profile: null,
  loading: false,
};
//al momento unico ruolo presente ma con permessi pari al ruolo admin per il mio singolo caso
//il mio interesse è sul cosa accade quando logga, la gestione del contenuto dell'area personale, 
//inclusa la esclusione di "PROFESSOR" dall'area admin rientra nei task delle storie successive
//la story del calendario/home "verifica" entrambi i ruoli siccome in questa area hanno gli stessi permessi
//ovvero poter fare il logout e il permesso di accedere ad un area personale
const professorSession = { 
  user: { uid: "professor-test" },
  profile: { role: "PROFESSOR" },
  loading: false,
};

// Apre una pagina con una sessione simulata.
// loggedIn = true significa professore autenticato.
function renderPage(path = "/", loggedIn = false) {
  const session = loggedIn ? professorSession : guestSession;

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

  // Normalmente simuliamo un logout riuscito.
  vi.mocked(logout).mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
});

describe("UNITICKET3-27 - Header e navigazione", () => {
  it("mostra la home pubblica con il pulsante Login", () => {
    renderPage("/");

    expect(
      screen.getByRole("heading", { name: "Home" })
    ).toBeTruthy();

    expect( //se entra senza log ci si aspetta l'href alla pagina di login
      screen.getByRole("link", { name: "Login" })
        .getAttribute("href")
    ).toBe("/login");

    expect(//non devono essere presenti gli altri elementi
      screen.queryByRole("button", { name: "Logout" })
    ).toBeNull();

    expect(
      screen.queryByRole("link", { name: "Area personale" })
    ).toBeNull();
  });

  it("apre il login senza mostrare l'header, elemento solo delle pagine di navigazione al moemnto", async () => {
    renderPage("/");

    fireEvent.click(
      screen.getByRole("link", { name: "Login" })
    );

    expect(
      await screen.findByRole("heading", { name: "Login" })
    ).toBeTruthy();

    expect(
      screen.queryByRole("banner")
    ).toBeNull();
  });

  //test logged
  it("permette al professore di aprire l'area personale", async () => {
    renderPage("/", true);

    expect(
      screen.getByRole("button", { name: "Logout" })
    ).toBeTruthy();

    fireEvent.click(
      screen.getByRole("link", { name: "Area personale" })
    );

    expect(
      await screen.findByRole("heading", { name: "Area Personale" })
    ).toBeTruthy();

    // Dopo la navigazione l'header riconosce ancora la sessione.
    expect(
      screen.getByRole("button", { name: "Logout" })
    ).toBeTruthy();

    expect(
      screen.getByRole("banner")
    ).toBeTruthy();
  });

  it("rimanda al login un visitatore che apre l'area personale", async () => {
    renderPage("/personal-area");

    expect(
      await screen.findByRole("heading", { name: "Login" })
    ).toBeTruthy();

    expect(
      screen.queryByRole("heading", { name: "Area Personale" })
    ).toBeNull();
  });

  it("chiama il servizio di logout dalla home rimane nella home(accesso consentito)", async () =>{
    renderPage("/", true);

    fireEvent.click(
      screen.getByRole("button", {name:"Logout"})
    );
    expect(
      await screen.findByRole("heading", { name: "Home" })
    ).toBeTruthy();
  });

  it("chiama il servizio di logout dall'area personale e torna alla home", async () => {
    renderPage("/personal-area", true);

    fireEvent.click(
      screen.getByRole("button", { name: "Logout" })
    );

    expect(
      await screen.findByRole("heading", { name: "Home" })
    ).toBeTruthy();

    expect(logout).toHaveBeenCalledTimes(1);
  });
});
