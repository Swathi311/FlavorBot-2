import React, { useState } from 'react';
import { Box, Typography, IconButton, useMediaQuery, Popover, Button } from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import EmojiEmotionsIcon from '@mui/icons-material/EmojiEmotions';
import Picker from '@emoji-mart/react';
import data from '@emoji-mart/data';
import axios from 'axios';
import { getAuth, signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import Tooltip from '@mui/material/Tooltip';
import ReactDOM from "react-dom";



const FlavorBot = () => {
  const [messages, setMessages] = useState([]);
  const [userInput, setUserInput] = useState('');
  const [anchorEl, setAnchorEl] = useState(null);
  const [waitingForIngredients, setWaitingForIngredients] = useState(false);
  const isMobile = useMediaQuery('(max-width:600px)');
  const auth = getAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate("/"); // Redirect to login page
    } catch (error) {
      console.error("Logout failed", error);
    }
  };

  const handleCopy = (message) => {
    let textToCopy = "";
  
    if (typeof message === "string") {
      textToCopy = message; 
    } else if (typeof message === "object" && message !== null) {
     
      const extractText = (node) => {
        if (typeof node === "string") return node;
        if (Array.isArray(node)) return node.map(extractText).join(" ");
        if (React.isValidElement(node)) return extractText(node.props.children);
        return "";
      };
      textToCopy = extractText(message.text);
    }
  
    if (textToCopy.trim()) {
      navigator.clipboard.writeText(textToCopy)
        .then(() => console.log("Copied to clipboard:", textToCopy))
        .catch((err) => console.error("Failed to copy: ", err));
    } else {
      console.warn("Nothing to copy");
    }
  };
  
  
  
  

  const handleSend = async () => {
    if (userInput.trim() === "") return;

    const newMessage = { text: userInput, sender: "user" };
    setMessages([...messages, newMessage]);
    setUserInput("");

    if (waitingForIngredients) {
      console.log(userInput)
      fetchSubstitutes(userInput);
      setWaitingForIngredients(false);
      return;
    }

    try {
      const response = await axios.post("http://127.0.0.1:8000/process", { text: userInput });
      const responseData = response.data;
     
      let botResponse = responseData.message || "Sorry, there was an error processing your request.";

      if (responseData.recipes) {
        const responseRecipes = Object.values(responseData.recipes).flat();
        if (responseRecipes.length > 0) {
          botResponse = responseRecipes.slice(0, 1).map((recipe, index) => (
            <Box key={index} sx={{ mb: 2 }}>
              <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#3A3A3A' }}>
                {recipe.name}
              </Typography>
              {recipe.image_url && (
                <Box sx={{ display: 'flex', justifyContent: 'flex-start', mt: 1, mb:1 }}>
                  <img 
                    src={recipe.image_url} 
                    alt={recipe.name} 
                    style={{ 
                      width: '200px', 
                      height: '200px', 
                      objectFit: 'cover', 
                      borderRadius: '10px' 
                    }} 
                  />
                </Box>
              )}

              <Typography variant="body2" sx={{ fontStyle: 'italic', color: '#555' }}>
                {recipe.description}
              </Typography>

              <Typography variant="subtitle2" sx={{ mt: 1, color: '#666' }}>
                <strong>Prep Time:</strong> {recipe.prep_time} mins | <strong>Cook Time:</strong> {recipe.cook_time} mins
              </Typography>

              <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mt: 1, color: '#444' }}>
                Ingredients:
              </Typography>
              {recipe.ingredients.map((ing, i) => (
                <Typography key={i} variant="body2" sx={{ color: '#666' }}>
                  - {ing}
                </Typography>
              ))}

              <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mt: 1, color: '#444' }}>
                Instructions:
              </Typography>
              {recipe.instructions.map((step, idx) => (
                <Typography key={idx} variant="body2" sx={{ color: '#555' }}>
                  {idx + 1}. {step}
                </Typography>
              ))}
            </Box>
          ));
        }
      }

      const botMessage = { text: botResponse, sender: "bot" };
      setMessages((prev) => [...prev, botMessage]);
      
      // Ask if user has all ingredients
      setTimeout(() => {
        setMessages((prev) => [...prev, { text: "Do you have all the ingredients?", sender: "bot", options: true }]);
      }, 500);
    } catch (error) {
      console.error("Error processing text:", error);
      const botMessage = { text: "Sorry, there was an error processing your request.", sender: "bot" };
      setMessages((prev) => [...prev, botMessage]);
    }
  };
  const handleUserResponse = (response) => {
    setMessages((prev) => [...prev, { text: response, sender: "user" }]);
    // Further processing based on response
  };


  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSend();
    }
  };

  const handleEmojiSelect = (emoji) => {
    setUserInput((prev) => prev + emoji.native);
    setAnchorEl(null);
  };

  const handleOpenEmojiDialog = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleCloseEmojiDialog = () => {
    setAnchorEl(null);
  };

  const open = Boolean(anchorEl);

  const fetchSubstitutes = async (ingredients) => {
    try {
      const response = await axios.post("http://127.0.0.1:8000/get_substitutes", { ingredients });
      const substitutes = response.data.substitutes;
      const botMessage = substitutes.length > 0
        ? `Here are some substitutes: \n${substitutes.join("\n")}`
        : "Sorry, no substitutes found for the given ingredients.";

      setMessages((prev) => [...prev, { text: botMessage, sender: "bot" }]);
    } catch (error) {
      console.error("Error fetching substitutes:", error);
      setMessages((prev) => [...prev, { text: "Sorry, there was an error fetching substitutes.", sender: "bot" }]);
    }
  };

  const handleYesNoResponse = (response) => {
    if (response === "Yes") {
      setMessages((prev) => [...prev, { text: "Have a great time cooking! If you need any help, just ping me!", sender: "bot" }]);
    } else {
      setMessages((prev) => [...prev, { text: "Which ingredients are missing?", sender: "bot" }]);
      setWaitingForIngredients(true);
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', alignItems: 'center', justifyContent: messages.length === 0 ? 'center' : 'flex-start', bgcolor: '#F4EAE0', px: 2, pt: messages.length > 0 ? 2 : 0 }}>
      {/* Logout Button (Top-Right) */}
      <Box sx={{ position: 'absolute', top: 100, right: 20 }}>
        <Button
          onClick={handleLogout}
          variant="contained"
          sx={{
            backgroundColor: '#8B5E57',
            color: 'white',
            textTransform: 'none',
            borderRadius: '20px',
            px: 3,
            py: 1,
            fontWeight: 'bold',
            '&:hover': { backgroundColor: '#A67C6E' }
          }}
        >
          Logout
        </Button>
      </Box>

      {/* Logo Placement */}
      <Box sx={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: messages.length === 0 ? 'center' : 'flex-start', p: 0, transition: 'all 0.5s ease-in-out' }}>
        <img 
          src="/assets/logo.png" 
          alt="FlavorBot Logo" 
          style={{ height: messages.length === 0 ? '250px' : '200px', marginLeft: messages.length === 0 ? '0px' : '20px', transition: 'all 0.5s ease-in-out' }}
        />
      </Box>

      {/* Chat Window */}
      {messages.length > 0 && (
        <Box sx={{ flexGrow: 1, overflowY: 'auto', p: 2, border: '1px solid #A67C6E', bgcolor: '#FAF3EF', width: isMobile ? '95%' : '60%', borderRadius: '16px' }}>
        {messages.map((msg, index) => (
          <Box key={index} sx={{ display: 'flex', justifyContent: msg.sender === 'user' ? 'flex-end' : 'flex-start', mb: 1.5 }}>
          <Box sx={{
            p: 1.5,
            pr: 4.5, 
            borderRadius: 2,
            maxWidth: '70%',
            bgcolor: msg.sender === 'user' ? '#8B5E57' : '#F7D2C9', // Warm brown for user messages
            color: msg.sender === 'user' ? 'white' : '#3A3A3A',
            boxShadow: '0px 2px 5px rgba(0,0,0,0.2)',
            whiteSpace: 'pre-line',
            position: 'relative',
          }}>
            
            {/* Copy Button */}
            {msg.sender === 'bot' && (
              <Tooltip title="Copy">
                <IconButton 
                  onClick={() => handleCopy(msg)}
                  sx={{
                    position: 'absolute',
                    top: '5px',
                    right: '5px',
                    backgroundColor: '#8B5E57',
                    color: 'white',
                    '&:hover': { backgroundColor: '#A67C6E' },
                    fontSize: '12px',
                    padding: '4px',
                    zIndex: 10
                  }}
                >
                  <ContentCopyIcon sx={{ fontSize: '12px' }} />
                </IconButton>
              </Tooltip>
            )}

            {/* Message Text */}
            <Typography variant="body2" sx={{ wordBreak: 'break-word' }}>
              {msg.text}
            </Typography>

            {/* Yes/No Buttons (Only if options exist) */}
            {msg.options && (
              <Box sx={{ display: 'flex', gap: 2, mt: 1, justifyContent: 'center' }}>
                <Button 
                  variant="contained" 
                  sx={{
                    bgcolor: '#8B5E57', 
                    color: 'white', 
                    textTransform: 'none', 
                    borderRadius: '20px',
                    px: 3, py: 1,
                    '&:hover': { bgcolor: '#A67C6E' }
                  }}
                  onClick={() => handleYesNoResponse("Yes")}
                >
                  Yes
                </Button>
                <Button 
                  variant="contained" 
                  sx={{
                    bgcolor: '#8B5E57', 
                    color: 'white', 
                    textTransform: 'none', 
                    borderRadius: '20px',
                    px: 3, py: 1,
                    '&:hover': { bgcolor: '#A67C6E' }
                  }}
                  onClick={() => handleYesNoResponse("No")}
                >
                  No
                </Button>
              </Box>
            )}
            
          </Box>

              </Box>
            ))}

    </Box>
      )}
      {/* Input Box */}
      <Box sx={{
        display: 'flex',
        alignItems: 'center',
        borderRadius: '20px',
        bgcolor: '#A67C6E',
        p: 1,
        width: isMobile ? '95%' : '60%',
        mt: isMobile ? 3 : 2,  
        mb: isMobile ? 3 : 8  
      }}>
        <input
          type="text"
          value={userInput}
          onChange={(e) => setUserInput(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Type your message..."
          style={{
            flexGrow: 1,
            border: 'none',
            outline: 'none',
            borderRadius: '20px',
            padding: '10px 15px',
            fontSize: '16px',
            backgroundColor: '#F4EAE0',
            color: '#3A3A3A'
          }}
        />
        {!isMobile && (
          <IconButton
            sx={{ color: '#ddd', backgroundColor: '#8B5E57', ml: 1, '&:hover': { backgroundColor: '#A67C6E' } }}
            onClick={handleOpenEmojiDialog}
          >
            <EmojiEmotionsIcon />
          </IconButton>
        )}
        <IconButton
          sx={{ color: '#ddd', backgroundColor: '#8B5E57', ml: 1, '&:hover': { backgroundColor: '#A67C6E' } }}
          onClick={handleSend}
        >
          <SendIcon />
        </IconButton>
      </Box>

      {/* Emoji Picker */}
      <Popover open={open} anchorEl={anchorEl} onClose={handleCloseEmojiDialog} anchorOrigin={{ vertical: 'top', horizontal: 'left' }} transformOrigin={{ vertical: 'bottom', horizontal: 'left' }}>
        <Picker data={data} onEmojiSelect={handleEmojiSelect} />
      </Popover>
     
    </Box>
  );
};

export default FlavorBot;