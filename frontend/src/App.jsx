import { Routes, Route } from "react-router";

import MainLayout from "./components/layout/MainLayout"

import Home from "./pages/Home";
import Login from "./pages/Login";

export default function App() {
  return (
    <Routes>
      <Route element={<MainLayout />}>
        <Route path="/" element={<Home />} />
      </Route>

     <Route path="/login" element={<Login />} />

      <Route
        path="*"
        element={<h1>404 - Page not found</h1>}
      />
    </Routes>
  );
}