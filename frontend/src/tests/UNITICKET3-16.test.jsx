// @vitest-environment jsdom

import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

import { AuthProvider } from "../contexts/AuthContext";
import App from "../App";

// Simuliamo Firebase: i test non usano account o database reali.
vi.mock("../firebase/client", () => ({ auth: {}, db: {} }));
vi.mock("firebase/auth", () => ({
  onAuthStateChanged: vi.fn(),
  signInWithEmailAndPassword: vi.fn(),
  signOut: vi.fn(),
}));
vi.mock("firebase/firestore", () => ({ doc: vi.fn(), getDoc: vi.fn() }));

const professor = { uid: "prof-test", email: "100001@uniroom.test" };
const professorProfile = {
  universityId: "100001",
  email: "100001@uniroom.test",
  displayName: "Professore Test",
  role: "PROFESSOR",
};

let changeAuthState;

// Apre l'app con o senza una sessione gia' esistente.
function openPage(user = null, path = "/login") {
  vi.mocked(getDoc).mockResolvedValue({
    exists: () => true,
    data: () => professorProfile,
  });

  vi.mocked(onAuthStateChanged).mockImplementation((_auth, callback) => {
    changeAuthState = callback;
    void callback(user);
    return vi.fn();
  });

  render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </MemoryRouter>
  );
}

// Compila il form e preme Accedi.
async function submitLogin() {
  fireEvent.change(await screen.findByLabelText("Matricola"), {
    target: { value: "100001" },
  });
  fireEvent.change(screen.getByLabelText("Password"), {
    target: { value: "password-test" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Accedi" }));
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(doc).mockReturnValue({});
  vi.mocked(signOut).mockResolvedValue(undefined);
});

afterEach(cleanup);

describe("UNITICKET3-16 - Login professore", () => {
  it("1. Dopo il login mostra la Home e i pulsanti dell'utente", async () => {
    vi.mocked(signInWithEmailAndPassword).mockImplementation(async () => {
      await changeAuthState(professor);
      return { user: professor };
    });

    openPage();
    await submitLogin();

    expect(await screen.findByRole("heading", { name: "Calendario aule" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Logout" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Area personale" })).toBeTruthy();
  });

  it("2. Mostra un errore per credenziali sbagliate", async () => {
    vi.mocked(signInWithEmailAndPassword).mockRejectedValue(
      new Error("auth/invalid-credential")
    );

    openPage();
    await submitLogin();

    expect((await screen.findByRole("alert")).textContent).toContain(
      "Accesso non riuscito"
    );
  });

  it("3. Ripristina una sessione e mostra la Home", async () => {
    openPage(professor);

    expect(await screen.findByRole("heading", { name: "Calendario aule" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Logout" })).toBeTruthy();
  });

  it("4. Dopo il logout resta sulla Home pubblica", async () => {
    vi.mocked(signOut).mockImplementation(async () => {
      await changeAuthState(null);
    });

    openPage(professor, "/");
    fireEvent.click(await screen.findByRole("button", { name: "Logout" }));

    expect(await screen.findByRole("link", { name: "Login" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Calendario aule" })).toBeTruthy();
    expect(signOut).toHaveBeenCalledOnce();
  });

  it("5. Il professore autenticato puo' aprire l'Area Personale", async () => {
    openPage(professor, "/personal-area");

    expect(
      await screen.findByRole("heading", { name: "Area Personale" })
    ).toBeTruthy();
  });
});
