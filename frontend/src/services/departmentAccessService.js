
import {
    doc,
    onSnapshot,
    serverTimestamp,
    setDoc,
} from "firebase/firestore";

import { db } from "../firebase/client";

const COLLECTION = "departmentAccessRequests";

function getAccessRequestId(professorId, departmentId) {
    return `${professorId}_${departmentId}`;
}

function mapRequest(document) {
    const data = document.data();

    return {
        id: document.id,
        professorId: data.professor?.id ?? "",
        departmentId: data.department?.id ?? "",
        professorName: data.professorName ?? "Docente",
        status: data.status,
        createdAt: data.createdAt ?? null,
        decidedAt: data.decidedAt ?? null,
    };
}

// il professore crea una richiesta PENDING.
export async function createDepartmentAccessRequest({
    professorId,
    departmentId,
    professorName,
}) {
    if (!professorId || !departmentId) {
        throw new Error("Professore e dipartimento sono obbligatori.");
    }

    const requestId = getAccessRequestId(
        professorId,
        departmentId
    );

    const requestRef = doc(db, COLLECTION, requestId);

    await setDoc(requestRef, {
        professor: doc(db, "users", professorId),
        department: doc(db, "departments", departmentId),
        professorName: professorName || "Docente",
        status: "PENDING",
        createdAt: serverTimestamp(),
    });

    return requestId;
}

//legge i documenti di accesso del professore.
// Ogni documento ha ID: UID_DIPARTIMENTO.
export function watchProfessorAccessRequests(
    professorId,
    departmentIds,
    onChange,
    onError
) {
    const ids = [...new Set(departmentIds)].filter(Boolean);

    if (ids.length === 0) {
        onChange([]);
        return () => { };
    }

    const results = new Map();
    const received = new Set();

    const unsubscribes = ids.map((departmentId) => {
        const requestId = getAccessRequestId(
            professorId,
            departmentId
        );

        const requestRef = doc(db, COLLECTION, requestId);

        return onSnapshot(
            requestRef,
            (snapshot) => {
                received.add(departmentId);

                if (snapshot.exists()) {
                    results.set(
                        departmentId,
                        mapRequest(snapshot)
                    );
                } else {
                    results.delete(departmentId);
                }

                if (received.size === ids.length) {
                    onChange([...results.values()]);
                }
            },
            onError
        );
    });

    return () => {
        unsubscribes.forEach(
            (unsubscribe) => unsubscribe()
        );
    };
}
