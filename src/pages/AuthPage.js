import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  RecaptchaVerifier,
  signInWithPhoneNumber,
} from "firebase/auth";
import { db } from "../firebase/firebaseConfig";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { Button, TextField, Box, Typography, Paper, Divider } from "@mui/material";
import { FcGoogle } from "react-icons/fc"; // Import Google Icon

const AuthPage = () => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [confirmationResult, setConfirmationResult] = useState(null);
  const navigate = useNavigate();
  const auth = getAuth();

  // Initialize Recaptcha on mount
  useEffect(() => {
    if (!window.recaptchaVerifier) {
      window.recaptchaVerifier = new RecaptchaVerifier(auth, "recaptcha-container", {
        size: "invisible",
      });
    }
  }, [auth]);

  // Save user details in Firestore
  const saveUserToFirestore = async (user, additionalData = {}) => {
    if (!user) return;
    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) {
      await setDoc(userRef, {
        name: user.displayName || additionalData.name || "Anonymous",
        email: user.email || "",
        phone: user.phoneNumber || additionalData.phone || "",
        createdAt: new Date(),
      });
    }
  };

  // Google Login
  const handleGoogleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      await saveUserToFirestore(result.user);
      navigate("/flavorbot");
    } catch (error) {
      console.error("Google login failed", error);
    }
  };

  // Email Authentication
  const handleAuth = async () => {
    try {
      if (isSignUp) {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await saveUserToFirestore(userCredential.user, { name: "Anonymous" });
      } else {
        const userSnap = await getDoc(doc(db, "users", auth.currentUser?.uid));
        if (userSnap.exists()) {
          await signInWithEmailAndPassword(auth, email, password);
        } else {
          console.error("User not found in Firestore. Please sign up first.");
          return;
        }
      }
      navigate("/flavorbot");
    } catch (error) {
      console.error("Authentication failed", error);
    }
  };

  // Format Phone Number to E.164
  const formatPhoneNumber = (phone) => {
    const cleaned = phone.replace(/\D/g, "");
    return cleaned.startsWith("1") ? `+${cleaned}` : `+1${cleaned}`;
  };

  // Phone Authentication (Send OTP)
  const handlePhoneLogin = async () => {
    try {
      const formattedPhone = formatPhoneNumber(phone);
      const userQuery = doc(db, "users", formattedPhone);
      const userSnap = await getDoc(userQuery);
      if (!userSnap.exists() && !isSignUp) {
        console.error("User not found in Firestore. Please sign up first.");
        return;
      }
      const confirmation = await signInWithPhoneNumber(auth, formattedPhone, window.recaptchaVerifier);
      setConfirmationResult(confirmation);
    } catch (error) {
      console.error("Phone authentication failed", error);
    }
  };

  // Verify OTP
  const verifyOtp = async () => {
    try {
      const result = await confirmationResult.confirm(otp);
      await saveUserToFirestore(result.user, { phone });
      navigate("/flavorbot");
    } catch (error) {
      console.error("OTP verification failed", error);
    }
  };

  return (
    <Box
      display="flex"
      justifyContent="center"
      alignItems="center"
      height="100vh"
      bgcolor="#A67C6E"
    >
      <Paper
        elevation={6}
        sx={{
          padding: 4,
          borderRadius: 3,
          width: 400,
          textAlign: "center",
        }}
      >
        <Typography variant="h5" fontWeight="bold" gutterBottom>
          {isSignUp ? "Sign Up" : "Login"}
        </Typography>

        {/* Email Authentication */}
        <TextField
          fullWidth
          type="email"
          label="Email"
          variant="outlined"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          margin="normal"
        />
        <TextField
          fullWidth
          type="password"
          label="Password"
          variant="outlined"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          margin="normal"
        />
        <Button
          variant="contained"
          fullWidth
          onClick={handleAuth}
          sx={{ mt: 2, bgcolor: "#A67C6E", "&:hover": { bgcolor: "#8B5E50" } }}
        >
          {isSignUp ? "Sign Up" : "Login"}
        </Button>

        {/* Google Login */}
        <Divider sx={{ my: 3 }}>OR</Divider>
        <Button
          fullWidth
          variant="outlined"
          onClick={handleGoogleLogin}
          sx={{
            textTransform: "none",
            fontSize: "1rem",
            padding: "12px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: "2px solid #ccc",
          }}
        >
          <FcGoogle size={24} style={{ marginRight: 10 }} />
          <Typography component="span" sx={{ color: "black", fontWeight: "bold" }}>
            Sign in with Google
          </Typography>{" "}
          
        </Button>

        {/* Phone Authentication */}
        <Divider sx={{ my: 3 }}>OR</Divider>
        <TextField
          fullWidth
          type="text"
          label="Phone Number (e.g. +1234567890)"
          variant="outlined"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          margin="normal"
        />
        <Button variant="contained" fullWidth onClick={handlePhoneLogin} sx={{ mt: 2, bgcolor: "#A67C6E" }}>
          Send OTP
        </Button>

        {confirmationResult && (
          <>
            <TextField
              fullWidth
              type="text"
              label="Enter OTP"
              variant="outlined"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              margin="normal"
            />
            <Button variant="contained" fullWidth onClick={verifyOtp} sx={{ mt: 2 }}>
              Verify OTP
            </Button>
          </>
        )}

        {/* Toggle Between Login and Signup */}
        <Typography variant="body2" sx={{ mt: 3 }}>
          {isSignUp ? "Already have an account?" : "Don't have an account?"}{" "}
          <span
            style={{ color: "#A67C6E", cursor: "pointer", fontWeight: "bold" }}
            onClick={() => setIsSignUp(!isSignUp)}
          >
            {isSignUp ? "Login" : "Sign Up"}
          </span>
        </Typography>
      </Paper>

      <div id="recaptcha-container"></div>
    </Box>
  );
};

export default AuthPage;
