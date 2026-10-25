import AuthButton from "../authButton/AuthButtun";
import PersonalAreaButton from "../personalAreaButton/PersonalAreaButton"
import "./HeaderNav.css";
export default function HeaderNav() {
  return (
    <nav
      className="app-header-nav"
      aria-label="Navigazione utente"
    >
    <AuthButton/>
    <PersonalAreaButton/>
    </nav>
  );
}