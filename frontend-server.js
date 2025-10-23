const express = require('express');
const path = require('path');
const app = express();
const port = process.env.PORT || 8080;

// Set the API URL for the frontend
process.env.REACT_APP_API_URL = 'https://vibesdk-control-plane-2pklfi2owa-uc.a.run.app';

// Serve static files from the dist/client directory
app.use(express.static(path.join(__dirname, 'dist/client')));

// Handle client-side routing - serve index.html for all routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist/client/index.html'));
});

app.listen(port, () => {
  console.log(`Frontend server running on port ${port}`);
});
