
// @vitest-environment jsdom

import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";

import { useAuth } from "../contexts/useAuth";
import useCalendarCatalog from "../hooks/useCalendarCatalog";
import useDepartmentAccessRequests from "../hooks/useDepartmentAccessRequests";
import { createDepartmentAccessRequest } from "../services/departmentAccessService";
import DepartmentAccessProfessor from "../components/booking/DepartmentAccessProfessor";
vi.mock("../firebase/client", () => ({
    auth: {},
    db: {},
}));
vi.mock("../contexts/useAuth", () => ({ useAuth: vi.fn() }));
vi.mock("../hooks/useCalendarCatalog", () => ({ default: vi.fn() }));
vi.mock("../hooks/useDepartmentAccessRequests", () => ({ default: vi.fn() }));
vi.mock("../services/departmentAccessService", () => ({
    createDepartmentAccessRequest: vi.fn(),
}));

beforeEach(() => {
    vi.clearAllMocks();

    useAuth.mockReturnValue({
        user: { uid: "prof1" },
        profile: {
            role: "PROFESSOR",
            displayName: "Docente Test",
            department: { id: "demacs" },
        },
    });

    useCalendarCatalog.mockReturnValue({
        departments: [
            { id: "demacs", name: "DeMaCS" },
            { id: "dispes", name: "DiSPeS" },
        ],
        loading: false,
        error: null,
    });

    useDepartmentAccessRequests.mockReturnValue({
        requests: [],
        loading: false,
        error: "",
    });

    createDepartmentAccessRequest.mockResolvedValue("prof1_dispes");
});

afterEach(cleanup);

describe("UNITICKET3-43 - Frontend", () => {
    it("il professore può inviare una richiesta", async () => {
        render(<DepartmentAccessProfessor />);

        fireEvent.change(screen.getByLabelText("Dipartimento aggiuntivo"), {
            target: { value: "dispes" },
        });

        fireEvent.click(screen.getByText("Richiedi accesso"));

        await waitFor(() => {
            expect(createDepartmentAccessRequest).toHaveBeenCalledWith({
                professorId: "prof1",
                departmentId: "dispes",
                professorName: "Docente Test",
            });
        });
    });

    it("il professore visualizza la richiesta PENDING", () => {
        useDepartmentAccessRequests.mockReturnValue({
            requests: [
                { id: "prof1_dispes", departmentId: "dispes", status: "PENDING" },
            ],
            loading: false,
            error: "",
        });

        render(<DepartmentAccessProfessor />);

        expect(screen.getByText("In attesa")).toBeTruthy();
    });
});
