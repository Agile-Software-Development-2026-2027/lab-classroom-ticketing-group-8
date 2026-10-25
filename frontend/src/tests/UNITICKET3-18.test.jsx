// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

import { auth } from "../firebase/client";
import { AuthProvider } from "../contexts/AuthContext";
import Login from "../pages/Login";
import ProtectedRoute from "../components/auth/ProtectedRoute";

// Questi test non si collegano al progetto Firebase reale.
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

const administrator = {
  uid: "uid-administrator-test",
  email: "200001@uniroom.test",
};

const adminProfile = {
  universityId: "200001",
  email: "200001@uniroom.test",
  displayName: "Amministratore Test",
  role: "ADMIN",
};

let emitAuthState;

function renderApp({ path = "/login", currentUser = null, profile = adminProfile } = {}) {
  vi.mocked(getDoc).mockResolvedValue({
    exists: () => true,
    data: () => profile,
  });

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
          <Route element={<ProtectedRoute allowedRoles={["ADMIN"]} />}>
            <Route
              path="/administration"
              element={<h1>Area amministrativa di test</h1>}
            />
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
  vi.mocked(signOut).mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("UNITICKET3-18 - Login as Administrator", () => {
  it("permette il login e riconosce il ruolo ADMIN", async () => {
    vi.mocked(signInWithEmailAndPassword).mockImplementation(async () => {
      await emitAuthState(administrator);
      return { user: administrator };
    });

    renderApp();

    fireEvent.change(await screen.findByRole("textbox", { name: "Matricola" }), {
      target: { value: "200001" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "password-fittizia" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Accedi" }));

    expect(await screen.findByText("Benvenuto, Amministratore Test")).toBeTruthy();
    expect(screen.getByText("Ruolo: Amministratore")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Logout" })).toBeTruthy();
    expect(signInWithEmailAndPassword).toHaveBeenCalledWith(
      auth,
      "200001@uniroom.test",
      "password-fittizia"
    );
  });

  it("rifiuta credenziali errate", async () => {
    vi.mocked(signInWithEmailAndPassword).mockRejectedValue(
      new Error("auth/invalid-credential")
    );

    renderApp();

    fireEvent.change(await screen.findByRole("textbox", { name: "Matricola" }), {
      target: { value: "200001" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "password-errata" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Accedi" }));

    expect((await screen.findByRole("alert")).textContent).toContain(
      "Accesso non riuscito. Controlla le credenziali."
    );
    expect(screen.queryByRole("button", { name: "Logout" })).toBeNull();
  });

  it("ripristina una sessione ADMIN già esistente", async () => {
    renderApp({ currentUser: administrator });

    expect(await screen.findByText("Benvenuto, Amministratore Test")).toBeTruthy();
    expect(screen.getByText("Ruolo: Amministratore")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Logout" })).toBeTruthy();
    expect(getDoc).toHaveBeenCalled();
  });

  it("esegue il logout e torna al form", async () => {
    vi.mocked(signOut).mockImplementation(async () => {
      await emitAuthState(null);
    });

    renderApp({ currentUser: administrator });
    fireEvent.click(await screen.findByRole("button", { name: "Logout" }));

    expect(await screen.findByRole("button", { name: "Accedi" })).toBeTruthy();
    await waitFor(() => expect(signOut).toHaveBeenCalledWith(auth));
  });

  it("permette a ADMIN di entrare in una route riservata", async () => {
    renderApp({ path: "/administration", currentUser: administrator });

    expect(
      await screen.findByRole("heading", { name: "Area amministrativa di test" })
    ).toBeTruthy();
  });

  it("nega la route ADMIN a un professore", async () => {
    const professor = { uid: "uid-professor-test", email: "100001@uniroom.test" };
    const professorProfile = {
      universityId: "100001",
      email: "100001@uniroom.test",
      displayName: "Professore Test",
      role: "PROFESSOR",
    };

    renderApp({
      path: "/administration",
      currentUser: professor,
      profile: professorProfile,
    });

    expect((await screen.findByRole("alert")).textContent).toContain(
      "Accesso non autorizzato."
    );
    expect(screen.queryByText("Area amministrativa di test")).toBeNull();
  });

  it("reindirizza al login un utente non autenticato", async () => {
    renderApp({ path: "/administration" });

    expect(await screen.findByRole("button", { name: "Accedi" })).toBeTruthy();
    expect(screen.queryByText("Area amministrativa di test")).toBeNull();
  });
});
