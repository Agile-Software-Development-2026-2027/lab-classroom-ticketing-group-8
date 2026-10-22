import { Routes, Route } from "react-router";

import MainLayout from "./components/layout/MainLayout"

import Home from "./pages/Home";

export default function App() {
  return (
    <Routes>
      <Route element={<MainLayout />}>
        <Route path="/" element={<Home />} />
      </Route>

      <Route
        path="*"
        element={<h1>404 - Page not found</h1>}
      />
    </Routes>
  );
}