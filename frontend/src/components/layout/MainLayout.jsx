import {  Outlet } from "react-router";

export default function MainLayout() {
  return (
    <>
      <header>
        <nav>
        </nav>
      </header>

      <main>
        <Outlet/>
      </main>
    </>
  );
}