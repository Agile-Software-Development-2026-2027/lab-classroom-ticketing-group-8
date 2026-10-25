import { Link } from "react-router";

import unicalLogo from "../../../assets/app-header-logo.png"
import AuthButton from "../authButton/AuthButtun";
import PersonalAreaButton from "../personalAreaButton/PersonalAreaButton"
import "./Header.css";

export default function Header() {
  return (
    <header className="app-header">
      <div className="app-header-inner">
        <Link className="app-header-brand" to="/">
          <img
            className="app-header-logo"
            src={unicalLogo}
            alt="Università della Calabria"
          />

          <span>UniRoom</span>
        </Link>

        <nav
          className="app-header-nav"
          aria-label="Navigazione utente"
        >
          <PersonalAreaButton />
          <AuthButton />
        </nav>
      </div>
    </header>
  );
}
