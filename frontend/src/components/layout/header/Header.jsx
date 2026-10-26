import { Link } from "react-router";

import unicalLogo from "../../../assets/app-header-logo.png"
import "./Header.css";
import HeaderNav from "../nav/HeaderNav";

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

          <span className="app-header-title">UniRoom</span>
        </Link>

        <HeaderNav/>
      </div>
    </header>
  );
}
