
// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { useAuth } from "../contexts/useAuth";
import useCalendarCatalog from "../hooks/useCalendarCatalog";
import useDepartmentAccessRequests from "../hooks/useDepartmentAccessRequests";
import {
    watchAdminAccessRequests,
    decideDepartmentAccessRequest,
} from "../services/departmentAccessService";

import DepartmentAccessAdmin from "../components/booking/DepartmentAccessAdmin";
import BookingRequestForm from "../components/booking/BookingRequestForm";

// Correzione della CI 43: mai inizializzare Firebase reale.
vi.mock("../firebase/client", () => ({
    auth: {},
    db: {},
}));

vi.mock("../contexts/useAuth", () => ({
    useAuth: vi.fn(),
}));

vi.mock("../hooks/useCalendarCatalog", () => ({
    default: vi.fn(),
}));

vi.mock("../hooks/useDepartmentAccessRequests", () => ({
    default: vi.fn(),
}));

vi.mock("../services/departmentAccessService", () => ({
    watchAdminAccessRequests: vi.fn(),
    decideDepartmentAccessRequest: vi.fn(),
}));

vi.mock("../services/bookingService", () => ({
    createBookingRequest: vi.fn(),
}));

beforeEach(() => {
    vi.clearAllMocks();

    useAuth.mockReturnValue({
        user: { uid: "admin1" },
        profile: {
            role: "ADMIN",
            department: { id: "dispes" },
        },
    });

    useCalendarCatalog.mockReturnValue({
        departments: [
            { id: "demacs", name: "DeMaCS" },
            { id: "dispes", name: "DiSPeS" },
        ],
        classrooms: [
            { id: "aula1", name: "Aula DeMaCS", departmentId: "demacs" },
            { id: "aula2", name: "Aula DiSPeS", departmentId: "dispes" },
        ],
        loading: false,
        error: "",
    });

    useDepartmentAccessRequests.mockReturnValue({
        requests: [],
        loading: false,
        error: "",
    });

    watchAdminAccessRequests.mockImplementation(
        (_departmentId, onChange) => {
            onChange([{
                id: "prof1_dispes",
                professorName: "Docente Test",
                universityId: "100001",
                status: "PENDING",
            }]);

            return vi.fn();
        }
    );

    decideDepartmentAccessRequest.mockResolvedValue();
});

afterEach(cleanup);

describe("UNITICKET3-52 - Frontend", () => {
    it("l'admin vede e approva una richiesta", async () => {
        render(<DepartmentAccessAdmin />);

        expect(await screen.findByText("Docente Test")).toBeTruthy();

        expect(watchAdminAccessRequests).toHaveBeenCalledWith(
            "dispes",
            expect.any(Function),
            expect.any(Function)
        );

        fireEvent.click(screen.getByText("Approva accesso"));

        await waitFor(() => {
            expect(decideDepartmentAccessRequest).toHaveBeenCalledWith(
                "prof1_dispes",
                "dispes",
                "APPROVED"
            );
        });
    });

    it("il professore può selezionare il dipartimento APPROVED", () => {
        useAuth.mockReturnValue({
            user: { uid: "prof1" },
            profile: {
                role: "PROFESSOR",
                department: { id: "demacs" },
            },
        });

        useDepartmentAccessRequests.mockReturnValue({
            requests: [
                { departmentId: "dispes", status: "APPROVED" },
            ],
            loading: false,
            error: "",
        });

        render(<BookingRequestForm />);

        const department = screen.getByLabelText("Dipartimento *");

        expect(department.value).toBe("demacs");

        fireEvent.change(department, {
            target: { value: "dispes" },
        });

        expect(department.value).toBe("dispes");
        expect(screen.getByRole("option", {
            name: "Aula DiSPeS",
        })).toBeTruthy();
    });
});
