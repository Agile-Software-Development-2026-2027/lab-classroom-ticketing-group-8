import { Navigate } from "react-router";

import { useAuth } from "../../contexts/useAuth";
import Login from "../../pages/Login";

export default function LoginRoute() {
  const { user, profile, loading } = useAuth();

  if (
    !loading &&
    user &&
    profile?.role === "PROFESSOR"
  ) {
    return <Navigate to="/" replace />;
  }

  return <Login />;
}