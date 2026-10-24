
import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";

import { auth } from "../firebase/client";
import { getUserProfile } from "../services/userService";
import { AuthContext } from "./AuthContextValue";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    let requestId = 0;

    const unsubscribe = onAuthStateChanged(
      auth,
      async (firebaseUser) => {
        const currentRequest = ++requestId;

        setLoading(true);
        setUser(null);
        setProfile(null);

        if (firebaseUser) {
          try {
            const data = await getUserProfile(firebaseUser.uid);

            if (!active || currentRequest !== requestId) {
              return;
            }

            const expectedEmail = `${data.universityId}@uniroom.test`;
            const validRole = ["PROFESSOR", "ADMIN"].includes(data.role);

            if (
              !validRole ||
              !/^\d{6}$/.test(data.universityId) ||
              data.email !== firebaseUser.email ||
              firebaseUser.email !== expectedEmail
            ) {
              throw new Error("Profilo non valido.");
            }

            setUser(firebaseUser);
            setProfile(data);
          } catch (error) {
            if (active && currentRequest === requestId) {
              console.error(
                "Errore nel caricamento del profilo:",
                error.code ?? error.message
              );
            }
          }
        }

        if (active && currentRequest === requestId) {
          setLoading(false);
        }
      },
      (error) => {
        if (!active) return;

        console.error("Errore Firebase Auth:", error.code);

        setUser(null);
        setProfile(null);
        setLoading(false);
      }
    );

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, profile, loading }}>
      {children}
    </AuthContext.Provider>
  );
}
