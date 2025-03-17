import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import AuthPage from "./pages/AuthPage";
import FlavorBot from "./pages/FlavorBot";
import { useState, useEffect } from "react";

const App = () => {
  const [user, setUser] = useState(null);
  const auth = getAuth();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, [auth]);

  return (
    <Router>
      <Routes>
        <Route path="/" element={user ? <Navigate to="/flavorbot" /> : <AuthPage />} />
        <Route path="/flavorbot" element={user ? <FlavorBot /> : <Navigate to="/" />} />
      </Routes>
    </Router>
  );
};

export default App;