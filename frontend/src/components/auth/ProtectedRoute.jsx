
import { Navigate, Outlet } from "react-router";
import { useAuth } from "../../contexts/useAuth";

export default function ProtectedRoute({ allowedRoles }) {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return <p>Verifica della sessione...</p>;
  }

  if (!user || !profile) {
    return <Navigate to="/login" replace />;
  }

  if (!allowedRoles.includes(profile.role)) {
    return <p role="alert">Accesso non autorizzato.</p>;
  }

  return <Outlet />;
}
