import { Link } from "react-router";

import { useAuth } from "../../../contexts/useAuth";
import "./PersonalAreaButton.css"
export default function PersonalAreaButton() {
  const { user, profile, loading } = useAuth();

  if (loading || !user || !profile) {
    return null;
  }

  return (
    <Link className="app-header-link" to="/personal-area">
      Area personale
    </Link>
  );
}