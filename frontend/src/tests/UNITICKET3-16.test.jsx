// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
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
import Login from "../pages/Login";
import ProtectedRoute from "../components/auth/ProtectedRoute";

// Nessun accesso reale al progetto Firebase del team.
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

function renderWithAuth({ path = "/login", currentUser = null, profile = professorProfile } = {}) {
  vi.mocked(getDoc).mockResolvedValue(makeSnapshot(profile));

  vi.mocked(onAuthStateChanged).mockImplementation((_auth, onChange) => {
    emitAuthState = onChange;
    void onChange(currentUser);
    return vi.fn();
  });

  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<ProtectedRoute allowedRoles={["PROFESSOR"]} />}>
            <Route path="/professor" element={<h1>Area professore di test</h1>} />
          </Route>
        </Routes>
      </AuthProvider>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  emitAuthState = null;

  vi.mocked(doc).mockImplementation((_db, collection, uid) => ({ collection, uid }));
  vi.mocked(getDoc).mockResolvedValue(makeSnapshot(professorProfile));
  vi.mocked(signOut).mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("UNITICKET3-16 - authService", () => {
  it.each(["", "12345", "1234567", "12A456", " 100001 "])(
    "rifiuta la matricola non valida %j senza chiamare Firebase",
    async (universityId) => {
      await expect(loginWithUniversityId(universityId, "password-fittizia"))
        .rejects.toThrow("La matricola deve contenere 6 cifre.");

      expect(signInWithEmailAndPassword).not.toHaveBeenCalled();
    }
  );

  it("converte la matricola valida e autentica l'utente", async () => {
    vi.mocked(signInWithEmailAndPassword)
      .mockResolvedValue({ user: professorUser });

    const user = await loginWithUniversityId("100001", "password-fittizia");

    expect(signInWithEmailAndPassword).toHaveBeenCalledWith(
      auth,
      "100001@uniroom.test",
      "password-fittizia"
    );
    expect(user).toEqual(professorUser);
  });

  it("propaga il rifiuto delle credenziali da Firebase", async () => {
    vi.mocked(signInWithEmailAndPassword)
      .mockRejectedValue(new Error("auth/invalid-credential"));

    await expect(loginWithUniversityId("100001", "password-errata"))
      .rejects.toThrow("auth/invalid-credential");
  });

  it("effettua il logout tramite Firebase", async () => {
    await logout();
    expect(signOut).toHaveBeenCalledWith(auth);
  });
});

describe("UNITICKET3-16 - userService", () => {
  it("legge il profilo dell'UID autenticato", async () => {
    const profile = await getUserProfile(professorUser.uid);

    expect(doc).toHaveBeenCalledWith(db, "users", professorUser.uid);
    expect(getDoc).toHaveBeenCalledWith({
      collection: "users",
      uid: professorUser.uid,
    });
    expect(profile).toEqual(professorProfile);
  });

  it("rifiuta un profilo Firestore inesistente", async () => {
    vi.mocked(getDoc).mockResolvedValue(makeSnapshot(null));

    await expect(getUserProfile(professorUser.uid))
      .rejects.toThrow("Profilo non trovato.");
  });

  it("propaga un errore di autorizzazione Firestore", async () => {
    vi.mocked(getDoc).mockRejectedValue(new Error("permission-denied"));

    await expect(getUserProfile(professorUser.uid))
      .rejects.toThrow("permission-denied");
  });
});

describe("UNITICKET3-16 - Login e AuthContext", () => {
  it("mostra il form quando non esiste una sessione", async () => {
    renderWithAuth();

    expect(await screen.findByRole("button", { name: "Accedi" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Logout" })).toBeNull();
  });

  it("mostra un errore senza autenticare se le credenziali sono errate", async () => {
    vi.mocked(signInWithEmailAndPassword)
      .mockRejectedValue(new Error("auth/invalid-credential"));
    renderWithAuth();

    fireEvent.change(await screen.findByPlaceholderText("6 cifre"), {
      target: { value: "100001" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "password-errata" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Accedi" }));

    expect(await screen.findByRole("alert")).toHaveProperty(
      "textContent",
      "Accesso non riuscito. Controlla le credenziali."
    );
    expect(screen.queryByRole("button", { name: "Logout" })).toBeNull();
  });

  it("mostra Logout dopo un login valido", async () => {
    vi.mocked(signInWithEmailAndPassword).mockImplementation(async () => {
      await emitAuthState(professorUser);
      return { user: professorUser };
    });
    renderWithAuth();

    fireEvent.change(await screen.findByPlaceholderText("6 cifre"), {
      target: { value: "100001" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "password-fittizia" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Accedi" }));

    expect(await screen.findByRole("button", { name: "Logout" })).toBeTruthy();
    expect(screen.getByText("Ruolo: PROFESSOR")).toBeTruthy();
  });

  it("ripristina una sessione già esistente all'avvio del Context", async () => {
    renderWithAuth({ currentUser: professorUser });

    expect(await screen.findByRole("button", { name: "Logout" })).toBeTruthy();
    expect(screen.getByText("Ruolo: PROFESSOR")).toBeTruthy();
    expect(getDoc).toHaveBeenCalled();
  });

  it("ritorna al form dopo il logout", async () => {
    vi.mocked(signOut).mockImplementation(async () => {
      await emitAuthState(null);
    });
    renderWithAuth({ currentUser: professorUser });

    fireEvent.click(await screen.findByRole("button", { name: "Logout" }));

    expect(await screen.findByRole("button", { name: "Accedi" })).toBeTruthy();
    await waitFor(() => expect(signOut).toHaveBeenCalledWith(auth));
  });

  it("rifiuta un profilo professore con matricola non coerente", async () => {
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
    renderWithAuth({
      currentUser: professorUser,
      profile: { ...professorProfile, universityId: "999999" },
    });

    expect(await screen.findByRole("button", { name: "Accedi" })).toBeTruthy();
    expect(screen.queryByText("Ruolo: PROFESSOR")).toBeNull();
    expect(errorLog).toHaveBeenCalled();
  });

});

describe("UNITICKET3-16 - ProtectedRoute (test isolato)", () => {
  it("reindirizza un utente non autenticato verso il login", async () => {
    renderWithAuth({ path: "/professor" });
    expect(await screen.findByRole("button", { name: "Accedi" })).toBeTruthy();
  });

  it("permette l'accesso a un PROFESSOR", async () => {
    renderWithAuth({ path: "/professor", currentUser: professorUser });
    expect(await screen.findByRole("heading", { name: "Area professore di test" })).toBeTruthy();
  });

});
