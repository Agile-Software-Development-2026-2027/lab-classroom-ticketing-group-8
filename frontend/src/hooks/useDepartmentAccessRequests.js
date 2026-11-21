
import { useEffect, useState } from "react";

import {
    watchProfessorAccessRequests,
} from "../services/departmentAccessService";

export default function useDepartmentAccessRequests(
    user,
    profile,
    departments = []
) {
    const [state, setState] = useState({
        userId: null,
        requests: [],
        loading: false,
        error: "",
    });

    const primaryId = profile?.department?.id ?? "";

    const departmentIdsKey = JSON.stringify(
        departments
            .filter(
                (department) =>
                    department.id &&
                    department.id !== primaryId
            )
            .map((department) => department.id)
            .sort()
    );

    useEffect(() => {
        if (!user?.uid || profile?.role !== "PROFESSOR") {
            setState({
                userId: null,
                requests: [],
                loading: false,
                error: "",
            });
            return;
        }

        let active = true;

        setState({
            userId: user.uid,
            requests: [],
            loading: true,
            error: "",
        });

        const departmentIds = JSON.parse(departmentIdsKey);

        const unsubscribe = watchProfessorAccessRequests(
            user.uid,
            departmentIds,
            (requests) => {
                if (!active) return;

                setState({
                    userId: user.uid,
                    requests,
                    loading: false,
                    error: "",
                });
            },
            (error) => {
                if (!active) return;

                console.error(
                    "Story 43 - Lettura richieste:",
                    error.code,
                    error.message
                );

                setState({
                    userId: user.uid,
                    requests: [],
                    loading: false,
                    error: error.message,
                });
            }
        );

        return () => {
            active = false;
            unsubscribe();
        };
    }, [
        user?.uid,
        profile?.role,
        departmentIdsKey,
    ]);

    const sameUser = state.userId === user?.uid;
    const isProfessor = profile?.role === "PROFESSOR";

    const requests = isProfessor && sameUser
        ? state.requests
        : [];

    return {
        requests,
        loading: isProfessor && (!sameUser || state.loading),
        error: sameUser ? state.error : "",
    };
}
