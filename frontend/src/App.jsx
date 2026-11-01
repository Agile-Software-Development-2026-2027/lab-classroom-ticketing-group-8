import { Routes, Route } from "react-router";

import MainLayout from "./components/layout/MainLayout";

import Home from "./pages/Home";
import PersonalPage from "./pages/Personal-page";
import BookingRequests from "./pages/BookingRequests";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import LoginRoute from "./components/auth/LoginRoute";

export default function App() {
  return (
    <Routes>
      <Route element={<MainLayout />}>
        <Route path="/" element={<Home />} />

        <Route element={<ProtectedRoute allowedRoles={["PROFESSOR", "ADMIN"]}/>}>
          <Route path="/personal-area" element={<PersonalPage/>}/>
        </Route>

        <Route element={<ProtectedRoute allowedRoles={["ADMIN"]} />}>
          <Route path="/booking-requests" element={<BookingRequests />} />
        </Route>
      </Route>

      <Route path="/login" element={<LoginRoute />} />
      
      <Route
        path="*"
        element={<h1>404 - Page not found</h1>}
      />
    </Routes>
  );
}
