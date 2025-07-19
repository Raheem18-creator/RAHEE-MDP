// server.js
const express = require('express');
const app = express();
const path = require('path');
const cors = require('cors'); // Import cors for cross-origin requests
const pairCodeRouter = require('./routes/pairCode'); // Our Baileys pairing logic

// --- Middleware Setup ---
// Enable CORS for all routes - important if your frontend and backend are on different domains
app.use(cors()); 
// Parse JSON request bodies
app.use(express.json()); 
// Parse URL-encoded request bodies (for form submissions)
app.use(express.urlencoded({ extended: true }));

// --- Static Files Serving ---
// Serve static files (HTML, CSS, JS) from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// --- API Routes ---
// All requests to /api/pair-code will be handled by pairCodeRouter
app.use('/api/pair-code', pairCodeRouter);

// --- Catch-all Route ---
// For any other GET request not matched above, serve the main HTML page.
// This is useful for single-page applications (SPAs) or if you want direct access to the HTML.
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// --- Server Startup ---
const PORT = process.env.PORT || 3000; // Use environment variable PORT or default to 3000
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`Open your browser at http://localhost:${PORT}`);
});
