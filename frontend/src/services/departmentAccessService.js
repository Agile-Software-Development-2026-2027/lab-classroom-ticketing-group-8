import {
    collection,
    doc,
    getDoc,
    onSnapshot,
    query,
    runTransaction,
    serverTimestamp,
    setDoc,
    where,
} from "firebase/firestore";

import { db } from "../firebase/client";

const COLLECTION = "departmentAccessRequests";

function getAccessRequestId(professorId, departmentId) {
    return `${professorId}_${departmentId}`;
}

function mapRequest(snapshot) {
    const data = snapshot.data();

    return {
        id: snapshot.id,
        professorId: data.professor?.id ?? "",
        departmentId: data.department?.id ?? "",
        professorName: data.professorName ?? "Docente",
        status: data.status,
        createdAt: data.createdAt ?? null,
        decidedAt: data.decidedAt ?? null,
    };
}

// Story 43: crea una nuova richiesta PENDING.
export async function createDepartmentAccessRequest({
    professorId,
    departmentId,
    professorName,
}) {
    if (!professorId || !departmentId) {
        throw new Error(
            "Professore e dipartimento sono obbligatori."
        );
    }

    const requestId = getAccessRequestId(
        professorId,
        departmentId
    );

    await setDoc(doc(db, COLLECTION, requestId), {
        professor: doc(db, "users", professorId),
        department: doc(db, "departments", departmentId),
        professorName: professorName || "Docente",
        status: "PENDING",
        createdAt: serverTimestamp(),
    });

    return requestId;
}

// Story 43: il professore osserva le proprie richieste.
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

        return onSnapshot(
            doc(db, COLLECTION, requestId),
            (snapshot) => {
                received.add(departmentId);

                if (snapshot.exists()) {
                    results.set(departmentId, mapRequest(snapshot));
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
        unsubscribes.forEach((unsubscribe) => unsubscribe());
    };
}

export function watchAdminAccessRequests(
    departmentId,
    onChange,
    onError
) {
    if (!departmentId) {
        onChange([]);
        return () => { };
    }

    const requestsQuery = query(
        collection(db, COLLECTION),
        where(
            "department",
            "==",
            doc(db, "departments", departmentId)
        )
    );

    let active = true;
    let latestUpdate = 0;

    const unsubscribe = onSnapshot(
        requestsQuery,
        async (snapshot) => {
            const updateId = ++latestUpdate;

            try {
                // La query è limitata al dipartimento;
                // mostriamo solo le richieste ancora PENDING.
                const pending = snapshot.docs.filter(
                    (item) => item.data().status === "PENDING"
                );

                const requests = await Promise.all(
                    pending.map(async (item) => {
                        const request = mapRequest(item);
                        let universityId = "N/D";

                        if (request.professorId) {
                            const professor = await getDoc(
                                doc(db, "users", request.professorId)
                            );

                            if (professor.exists()) {
                                universityId =
                                    professor.data().universityId || "N/D";
                            }
                        }

                        return {
                            ...request,
                            universityId,
                        };
                    })
                );

                if (active && updateId === latestUpdate) {
                    onChange(requests);
                }
            } catch (error) {
                if (active && updateId === latestUpdate) {
                    onError(error);
                }
            }
        },
        (error) => {
            if (active) onError(error);
        }
    );

    return () => {
        active = false;
        unsubscribe();
    };
}

export async function decideDepartmentAccessRequest(
    requestId,
    departmentId,
    decision
) {
    if (!requestId || !departmentId) {
        throw new Error("Richiesta o dipartimento non valido.");
    }

    if (!["APPROVED", "REJECTED"].includes(decision)) {
        throw new Error("Decisione non valida.");
    }

    const requestRef = doc(db, COLLECTION, requestId);

    await runTransaction(db, async (transaction) => {
        const snapshot = await transaction.get(requestRef);

        if (!snapshot.exists()) {
            throw new Error("Richiesta non trovata.");
        }

        const data = snapshot.data();

        if (data.department?.id !== departmentId) {
            throw new Error(
                "La richiesta non appartiene al tuo dipartimento."
            );
        }

        if (data.status !== "PENDING") {
            throw new Error(
                "Questa richiesta è già stata gestita."
            );
        }

        transaction.update(requestRef, {
            status: decision,
            decidedAt: serverTimestamp(),
        });
    });
}
