
import { useContext } from "react";
import { AuthContext } from "./AuthContextValue";

export function useAuth() {
  const context = useContext(AuthContext);

  if (context === null) {
    throw new Error("useAuth richiede AuthProvider.");
  }

  return context;
}
