import {  Outlet } from "react-router";
import Header from "./header/Header"

export default function MainLayout() {
  return (
    <>
      <Header/>

      <main>
        <Outlet/>
      </main>
    </>
  );
}