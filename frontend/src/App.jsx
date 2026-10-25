import { Routes, Route } from "react-router";

import MainLayout from "./components/layout/MainLayout"

import Home from "./pages/Home";
import PersonalPage from "./pages/personal-page";
import Login from "./pages/Login";
import ProtectedRoute from "./components/auth/ProtectedRoute";

export default function App() {
  return (
    <Routes>
      <Route element={<MainLayout />}>
        <Route path="/" element={<Home />} />

        <Route element={<ProtectedRoute allowedRoles={["PROFESSOR", "ADMIN"]}/>}>
          <Route path="/personal-area" element={<PersonalPage/>}/>
        </Route>
        
      </Route>

      <Route path="/login" element={<Login />} />
      
      <Route
        path="*"
        element={<h1>404 - Page not found</h1>}
      />
    </Routes>
  );
}