
 // @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter } from "react-router";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

import { auth, db } from "../firebase/client";
import { loginWithUniversityId, logout } from "../services/authService";
import { getUserProfile } from "../services/userService";
import { AuthProvider } from "../contexts/AuthContext";
import App from "../App";
// Firebase mock: nessuna connessione al database reale.
vi.mock("../firebase/client", () => ({
  auth: { test: "auth" },
  db: { test: "firestore" },
}));

vi.mock("firebase/auth", () => ({
  onAuthStateChanged: vi.fn(),
  signInWithEmailAndPassword: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("firebase/firestore", () => ({
  doc: vi.fn(),
  getDoc: vi.fn(),
}));

const professorUser = {
  uid: "uid-professor-test",
  email: "100001@uniroom.test",
};

const professorProfile = {
  universityId: "100001",
  email: "100001@uniroom.test",
  displayName: "Professore Test",
  role: "PROFESSOR",
};

let emitAuthState;

function makeSnapshot(profile) {
  return {
    exists: () => profile !== null,
    data: () => profile,
  };
}

function renderWithAuth({
  path = "/login",
  currentUser = null,
  profile = professorProfile,
  emitInitialState = true,
} = {}) {
  vi.mocked(getDoc).mockResolvedValue(makeSnapshot(profile));

  vi.mocked(onAuthStateChanged).mockImplementation((_auth, onChange) => {
    emitAuthState = onChange;

    if (emitInitialState) {
      void onChange(currentUser);
    }

    return vi.fn();
  });

  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </MemoryRouter>
  );
}

function fillLoginForm(
  universityId = "100001",
  password = "password-fittizia"
) {
  fireEvent.change(
    screen.getByRole("textbox", { name: "Matricola" }),
    { target: { value: universityId } }
  );

  fireEvent.change(screen.getByLabelText("Password"), {
    target: { value: password },
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  emitAuthState = null;

  vi.mocked(doc).mockImplementation(
    (_db, collection, uid) => ({ collection, uid })
  );

  vi.mocked(getDoc).mockResolvedValue(
    makeSnapshot(professorProfile)
  );

  vi.mocked(signOut).mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// TEST AUTH SERVICE

describe("UNITICKET3-16 - authService", () => {
  it.each([
    "",
    "12345",
    "1234567",
    "12A456",
    " 100001 ",
  ])(
    "rifiuta la matricola non valida %j senza chiamare Firebase",
    async (universityId) => {
      await expect(
        loginWithUniversityId(universityId, "password-fittizia")
      ).rejects.toThrow(
        "La matricola deve contenere 6 cifre."
      );

      expect(signInWithEmailAndPassword)
        .not.toHaveBeenCalled();
    }
  );

  it("converte la matricola in email e autentica", async () => {
    vi.mocked(signInWithEmailAndPassword)
      .mockResolvedValue({ user: professorUser });

    const user = await loginWithUniversityId(
      "100001",
      "password-fittizia"
    );

    expect(signInWithEmailAndPassword).toHaveBeenCalledWith(
      auth,
      "100001@uniroom.test",
      "password-fittizia"
    );

    expect(user).toEqual(professorUser);
  });

  it("rifiuta credenziali non valide", async () => {
    vi.mocked(signInWithEmailAndPassword)
      .mockRejectedValue(
        new Error("auth/invalid-credential")
      );

    await expect(
      loginWithUniversityId("100001", "password-errata")
    ).rejects.toThrow("auth/invalid-credential");
  });

  it("esegue il logout tramite Firebase", async () => {
    await logout();

    expect(signOut).toHaveBeenCalledWith(auth);
  });
});

// TEST USER SERVICE

describe("UNITICKET3-16 - userService", () => {
  it("recupera il profilo tramite UID", async () => {
    const profile = await getUserProfile(professorUser.uid);

    expect(doc).toHaveBeenCalledWith(
      db,
      "users",
      professorUser.uid
    );

    expect(getDoc).toHaveBeenCalledWith({
      collection: "users",
      uid: professorUser.uid,
    });

    expect(profile).toEqual(professorProfile);
  });

  it("rifiuta un profilo inesistente", async () => {
    vi.mocked(getDoc)
      .mockResolvedValue(makeSnapshot(null));

    await expect(
      getUserProfile(professorUser.uid)
    ).rejects.toThrow("Profilo non trovato.");
  });

  it("gestisce un errore Firestore", async () => {
    vi.mocked(getDoc)
      .mockRejectedValue(new Error("permission-denied"));

    await expect(
      getUserProfile(professorUser.uid)
    ).rejects.toThrow("permission-denied");
  });
});

// TEST LOGIN E AUTH CONTEXT

describe("UNITICKET3-16 - Login e sessione", () => {
  it("mostra il caricamento durante la verifica sessione", () => {
    renderWithAuth({ emitInitialState: false });

    expect(
      screen.getByRole("status").textContent
    ).toContain("Caricamento");

    expect(
      screen.queryByRole("button", { name: "Accedi" })
    ).toBeNull();
  });

  it("mostra logo, titolo Login e form", async () => {
    renderWithAuth();

    expect(
      screen.getByRole("img", {
        name: "Università della Calabria",
      })
    ).toBeTruthy();

    expect(
      screen.getByRole("heading", { name: "Login" })
    ).toBeTruthy();

    expect(
      await screen.findByRole("button", { name: "Accedi" })
    ).toBeTruthy();

    expect(
      screen.getByRole("textbox", { name: "Matricola" })
    ).toBeTruthy();

    expect(
      screen.getByLabelText("Password").type
    ).toBe("password");

    expect(
      screen.queryByRole("button", { name: "Logout" })
    ).toBeNull();
  });

  it("mostra e nasconde la password", async () => {
    renderWithAuth();

    await screen.findByRole("button", { name: "Accedi" });

    fireEvent.click(
      screen.getByRole("button", { name: "Mostra password" })
    );

    expect(
      screen.getByLabelText("Password").type
    ).toBe("text");

    expect(
      screen.getByRole("button", {
        name: "Nascondi password",
      })
    ).toBeTruthy();

    fireEvent.click(
      screen.getByRole("button", { name: "Nascondi password" })
    );

    expect(
      screen.getByLabelText("Password").type
    ).toBe("password");

    expect(signInWithEmailAndPassword)
      .not.toHaveBeenCalled();
  });

  it("rifiuta una matricola corta", async () => {
    renderWithAuth();

    await screen.findByRole("button", { name: "Accedi" });

    fillLoginForm("12345");

    fireEvent.click(
      screen.getByRole("button", { name: "Accedi" })
    );

    expect(
      (await screen.findByRole("alert")).textContent
    ).toContain("La matricola deve contenere 6 cifre.");

    expect(signInWithEmailAndPassword)
      .not.toHaveBeenCalled();
  });

  it("mostra errore per credenziali errate", async () => {
    vi.mocked(signInWithEmailAndPassword)
      .mockRejectedValue(
        new Error("auth/invalid-credential")
      );

    renderWithAuth();

    await screen.findByRole("button", { name: "Accedi" });

    fillLoginForm();

    fireEvent.click(
      screen.getByRole("button", { name: "Accedi" })
    );

    expect(
      (await screen.findByRole("alert")).textContent
    ).toContain(
      "Accesso non riuscito. Controlla le credenziali."
    );

    expect(
      screen.queryByRole("button", { name: "Logout" })
    ).toBeNull();
  });

  it("dopo il login torna alla home con Logout e Area personale", async () => {
    vi.mocked(signInWithEmailAndPassword)
      .mockImplementation(async () => {
        await emitAuthState(professorUser);
        return { user: professorUser };
      });

    renderWithAuth();

    await screen.findByRole("button", { name: "Accedi" });

    fillLoginForm();

    fireEvent.click(
      screen.getByRole("button", { name: "Accedi" })
    );

    expect(
      await screen.findByRole("heading", { name: "Home" })
    ).toBeTruthy();

    expect(
      screen.getByRole("button", { name: "Logout" })
    ).toBeTruthy();

    expect(
      screen.getByRole("link", { name: "Area personale" })
    ).toBeTruthy();

    expect(
      screen.queryByRole("button", { name: "Accedi" })
    ).toBeNull();
  });

  it("ripristina la sessione esistente", async () => {
    renderWithAuth({ currentUser: professorUser });

    expect(
      await screen.findByRole("heading", { name: "Home" })
    ).toBeTruthy();

    expect(
      screen.getByRole("button", { name: "Logout" })
    ).toBeTruthy();

    expect(getDoc).toHaveBeenCalled();
  });

  it("dopo il logout mostra la home(accesso publico)", async () => {
    vi.mocked(signOut).mockImplementation(async () => {
      await emitAuthState(null);
    });

    renderWithAuth({ currentUser: professorUser });

    fireEvent.click(
      await screen.findByRole("button", { name: "Logout" })
    );

    expect(
      await screen.findByRole("link", { name: "Login" })
    ).toBeTruthy();

    expect(
      screen.getByRole("heading", { name: "Home" })
    ).toBeTruthy();

    expect(
      screen.queryByRole("button", { name: "Logout" })
    ).toBeNull();

    await waitFor(() =>
      expect(signOut).toHaveBeenCalledWith(auth)
    );
  });

  it("mostra errore se il logout fallisce", async () => {
    vi.mocked(signOut)
      .mockRejectedValue(new Error("network-error"));

    renderWithAuth({ currentUser: professorUser });

    fireEvent.click(
      await screen.findByRole("button", { name: "Logout" })
    );

    expect(
      (await screen.findByRole("alert")).textContent
    ).toContain("Logout non riuscito.");

    expect(
      screen.getByRole("button", { name: "Logout" })
    ).toBeTruthy();
  });

  it("rifiuta un profilo con matricola non coerente", async () => {
    const errorLog = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    renderWithAuth({
      currentUser: professorUser,
      profile: {
        ...professorProfile,
        universityId: "999999",
      },
    });

    expect(
      await screen.findByRole("button", { name: "Accedi" })
    ).toBeTruthy();

    expect(
      screen.queryByRole("button", { name: "Logout" })
    ).toBeNull();

    expect(errorLog).toHaveBeenCalled();
  });

  it("rifiuta un profilo senza ruolo PROFESSOR", async () => {
    const errorLog = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    renderWithAuth({
      currentUser: professorUser,
      profile: {
        ...professorProfile,
        role: null,
      },
    });

    expect(
      await screen.findByRole("button", { name: "Accedi" })
    ).toBeTruthy();

    expect(
      screen.queryByRole("button", { name: "Logout" })
    ).toBeNull();

    expect(errorLog).toHaveBeenCalled();
  });
});

// TEST PROTECTED ROUTE

describe("UNITICKET3-16 - ProtectedRoute", () => {
  it("reindirizza al login chi non è autenticato", async () => {
    renderWithAuth({path: "/personal-area"});

    expect(
      await screen.findByRole("button", { name: "Accedi" })
    ).toBeTruthy();

    expect(
      screen.queryByRole("heading", {
        name: "Area Personale",
      })
    ).toBeNull();
  });

  it("consente l'accesso al professore autenticato", async () => {
    renderWithAuth({
      path: "/personal-area",
      currentUser: professorUser,
    });

    expect(
      await screen.findByRole("heading", {
        name: "Area Personale",
      })
    ).toBeTruthy();
  });
});
