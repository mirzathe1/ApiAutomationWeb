import express from 'express';
import { TherapClient } from './api/TherapClient.js';

const app = express();
const PORT = 3000;
const BASE_URL = 'https://billing.therapdev.net'; // Change this if you use a different base URL

// Middleware to parse JSON payloads from the frontend
app.use(express.json());
app.use(express.static('public'));

// Hold the active client session in memory for this local tool
let activeSession = null;

// --- API ROUTE 1: Authentication ---
app.post('/api/auth', async (req, res) => {
    try {
        const credentials = req.body;
        
        // Initialize a fresh client and authenticate
        activeSession = new TherapClient(BASE_URL);
        await activeSession.authenticate(credentials);
        
        res.status(200).json({ 
            success: true, 
            message: "Token Generated & Active",
            tokenPreview: activeSession.authToken.substring(0, 20) + "..."
        });
    } catch (error) {
        console.error("Auth Error:", error.message);
        activeSession = null;
        res.status(401).json({ error: "Authentication Failed. Check credentials." });
    }
});

// --- API ROUTE 2: Submit Payload ---
app.post('/api/submit', async (req, res) => {
    if (!activeSession || !activeSession.authToken) {
        return res.status(401).json({ error: "No active token. Please complete Step 1 first." });
    }

    try {
        const payload = req.body;
        // Submit the raw payload sent from the UI directly to Therap
        const response = await activeSession.submitAttendance(payload);
        
        res.status(200).json({
            status: response.status,
            data: response.data
        });
    } catch (error) {
        // If Therap throws a 422 or 500, we want to send that exact JSON back to the UI terminal
        const errorData = error.response ? error.response.data : { message: error.message };
        const statusCode = error.response ? error.response.status : 500;
        
        res.status(statusCode).json(errorData);
    }
});

app.listen(PORT, () => {
    console.log(`🚀 API Tester running on http://localhost:${PORT}`);
});