import React, { useState } from 'react';
import { Box, Button, TextField, Typography, Paper } from '@mui/material';
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';
import AppleLogin from 'react-apple-login';
import { Player } from '@lottiefiles/react-lottie-player';

const LoginPage = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = () => {
    // Implement your login logic here
  };

  const handleGoogleSuccess = (response) => {
    console.log(response);
    onLogin({ email: response.profileObj.email });
  };

  const handleAppleSuccess = (response) => {
    console.log(response);
    onLogin({ email: response.email });
  };

  return (
    <GoogleOAuthProvider clientId="YOUR_GOOGLE_CLIENT_ID">
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          bgcolor: '#2c2c2c',
          px: 3,
        }}
      >
        {/* Animation */}
        <Player
          autoplay
          loop
          src="https://assets1.lottiefiles.com/packages/lf20_w4j2ewdv.json"
          style={{ height: '150px', width: '150px', marginBottom: '30px' }}
        />

        {/* Login Form */}
        <Paper
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: '20px',
            borderRadius: '8px',
            width: '100%',
            maxWidth: '400px',
            bgcolor: '#3a3a3a',
          }}
        >
          <Typography variant="h6" color="white" sx={{ marginBottom: '20px' }}>
            Welcome to FlavorBot
          </Typography>

          {/* Email and Password Inputs */}
          <TextField
            label="Email"
            variant="outlined"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            fullWidth
            sx={{ marginBottom: '15px' }}
            autoFocus
          />
          <TextField
            label="Password"
            type="password"
            variant="outlined"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            fullWidth
            sx={{ marginBottom: '15px' }}
          />

          {error && <Typography color="error" sx={{ marginBottom: '15px' }}>{error}</Typography>}

          <Button
            onClick={handleSubmit}
            variant="contained"
            color="primary"
            sx={{ marginBottom: '15px', width: '100%' }}
          >
            Login
          </Button>

          {/* Google Login */}
          <GoogleLogin
            onSuccess={handleGoogleSuccess}
            onError={(error) => console.error(error)}
            style={{ width: '100%', marginBottom: '15px' }}
          />

          {/* Apple Login */}
          <AppleLogin
            clientId="YOUR_APPLE_CLIENT_ID"
            redirectURI="YOUR_APPLE_REDIRECT_URI"
            usePopup={true}
            onSuccess={handleAppleSuccess}
            onError={(error) => console.error(error)}
            style={{ width: '100%' }}
          />
        </Paper>
      </Box>
    </GoogleOAuthProvider>
  );
};

export default LoginPage;
