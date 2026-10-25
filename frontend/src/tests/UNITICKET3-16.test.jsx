// @vitest-environment jsdom

import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

import { AuthProvider } from "../contexts/AuthContext";
import Login from "../pages/Login";
import ProtectedRoute from "../components/auth/ProtectedRoute";

// Nessuna connessione a Firebase reale.
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
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<ProtectedRoute allowedRoles={["PROFESSOR"]} />}>
            <Route path="/professor" element={<h1>Area professore</h1>} />
          </Route>
        </Routes>
      </AuthProvider>
    </MemoryRouter>
  );
}

async function fillForm() {
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
  it("1. Permette il login del professore", async () => {
    vi.mocked(signInWithEmailAndPassword).mockImplementation(async () => {
      await changeAuthState(professor);
      return { user: professor };
    });
    openPage();
    await fillForm();

    expect(await screen.findByText("Benvenuto, Professore Test")).toBeTruthy();
  });

  it("2. Rifiuta le credenziali errate", async () => {
    vi.mocked(signInWithEmailAndPassword).mockRejectedValue(
      new Error("auth/invalid-credential")
    );
    openPage();
    await fillForm();

    expect((await screen.findByRole("alert")).textContent).toContain(
      "Accesso non riuscito"
    );
  });

  it("3. Ripristina una sessione già esistente", async () => {
    openPage(professor);

    expect(await screen.findByRole("button", { name: "Logout" })).toBeTruthy();
  });

  it("4. Esegue il logout", async () => {
    vi.mocked(signOut).mockImplementation(async () => {
      await changeAuthState(null);
    });
    openPage(professor);
    fireEvent.click(await screen.findByRole("button", { name: "Logout" }));

    expect(await screen.findByRole("button", { name: "Accedi" })).toBeTruthy();
    expect(signOut).toHaveBeenCalledOnce();
  });

  it("5. Permette al professore l'accesso alla sua route", async () => {
    openPage(professor, "/professor");

    expect(await screen.findByText("Area professore")).toBeTruthy();
  });
});
