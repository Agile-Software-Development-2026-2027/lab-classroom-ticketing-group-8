// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

import { auth } from "../firebase/client";
import { AuthProvider } from "../contexts/AuthContext";
import App from "../App";
import Login from "../pages/Login";
import ProtectedRoute from "../components/auth/ProtectedRoute";

// Simuliamo Firebase: i test non usano account o database reali.
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

const admin = {
  uid: "admin-test",
  email: "200001@uniroom.test",
};

const adminProfile = {
  universityId: "200001",
  email: "200001@uniroom.test",
  displayName: "Amministratore Test",
  role: "ADMIN",
};

let changeSession;

function renderWithAuth({ path = "/login", user = null, profile = adminProfile, adminOnly = false } = {}) {
  vi.mocked(getDoc).mockResolvedValue({
    exists: () => true,
    data: () => profile,
  });

  vi.mocked(onAuthStateChanged).mockImplementation((_auth, onChange) => {
    changeSession = onChange;
    void onChange(user);
    return vi.fn();
  });

  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        {adminOnly ? (
          // Route di prova: nel progetto non esiste ancora una pagina amministrativa.
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route element={<ProtectedRoute allowedRoles={["ADMIN"]} />}>
              <Route
                path="/administration"
                element={<h1>Area amministrativa di test</h1>}
              />
            </Route>
          </Routes>
        ) : (
          <App />
        )}
      </AuthProvider>
    </MemoryRouter>
  );
}

function fillLogin() {
  fireEvent.change(screen.getByRole("textbox", { name: "Matricola" }), {
    target: { value: "200001" },
  });
  fireEvent.change(screen.getByLabelText("Password"), {
    target: { value: "password-fittizia" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Accedi" }));
}

beforeEach(() => {
  vi.resetAllMocks();
  changeSession = null;
  vi.mocked(doc).mockImplementation((_db, collection, uid) => ({ collection, uid }));
  vi.mocked(signOut).mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("UNITICKET3-18 - Login amministratore", () => {
  it("autentica ADMIN e mostra la Home", async () => {
    vi.mocked(signInWithEmailAndPassword).mockImplementation(async () => {
      await changeSession(admin);
      return { user: admin };
    });

    renderWithAuth();
    await screen.findByRole("button", { name: "Accedi" });
    fillLogin();

    expect(await screen.findByRole("heading", { name: "Calendario aule" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Logout" })).toBeTruthy();
    expect(signInWithEmailAndPassword).toHaveBeenCalledWith(
      auth,
      "200001@uniroom.test",
      "password-fittizia"
    );
    expect(getDoc).toHaveBeenCalled();
  });

  it("rifiuta credenziali errate", async () => {
    vi.mocked(signInWithEmailAndPassword).mockRejectedValue(
      new Error("auth/invalid-credential")
    );

    renderWithAuth();
    await screen.findByRole("button", { name: "Accedi" });
    fillLogin();

    expect((await screen.findByRole("alert")).textContent).toContain(
      "Accesso non riuscito. Controlla le credenziali."
    );
  });

  it("ripristina la sessione ADMIN ed esegue il logout dalla Home", async () => {
    vi.mocked(signOut).mockImplementation(async () => {
      await changeSession(null);
    });

    renderWithAuth({ path: "/", user: admin });

    fireEvent.click(await screen.findByRole("button", { name: "Logout" }));

    expect(await screen.findByRole("link", { name: "Login" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Calendario aule" })).toBeTruthy();
    await waitFor(() => expect(signOut).toHaveBeenCalledWith(auth));
  });

  it("consente ad ADMIN di accedere a una route riservata", async () => {
    renderWithAuth({ path: "/administration", user: admin, adminOnly: true });

    expect(
      await screen.findByRole("heading", { name: "Area amministrativa di test" })
    ).toBeTruthy();
  });

  it("nega la route amministrativa al professore", async () => {
    const professor = { uid: "professor-test", email: "100001@uniroom.test" };
    const professorProfile = {
      universityId: "100001",
      email: "100001@uniroom.test",
      displayName: "Professore Test",
      role: "PROFESSOR",
    };

    renderWithAuth({
      path: "/administration",
      user: professor,
      profile: professorProfile,
      adminOnly: true,
    });

    expect((await screen.findByRole("alert")).textContent).toContain(
      "Accesso non autorizzato."
    );
    expect(screen.queryByText("Area amministrativa di test")).toBeNull();
  });
});
