import express from 'express';
import dotenv from 'dotenv';
import { TherapClient } from './api/TherapClient.js';
import { initializeDatabase, executeQuery } from './db.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000; 
const BASE_URL = 'https://billing.therapdev.net'; 

app.use(express.json());
app.use(express.static('public'));

let activeSession = null;

// --- API ROUTE 1: Authentication ---
app.post('/api/auth', async (req, res) => {
    try {
        const credentials = req.body;
        activeSession = new TherapClient(BASE_URL);
        activeSession.providerCode = credentials.providerCode; // Store provider code for future validation
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

// --- API ROUTE 1b: Check Auth Status ---
app.get('/api/auth/status', (req, res) => {
    if (activeSession && activeSession.authToken) {
        res.status(200).json({ authenticated: true, providerCode: activeSession.providerCode });
    } else {
        res.status(200).json({ authenticated: false });
    }
});

// --- API ROUTE 2: Submit Payload ---
app.post('/api/submit', async (req, res) => {
    if (!activeSession || !activeSession.authToken) {
        return res.status(401).json({ error: "No active token." });
    }

    try {
        const payload = req.body;
        const response = await activeSession.submitAttendance(payload);
        res.status(200).json({ status: response.status, data: response.data });
    } catch (error) {
        const errorData = error.response ? error.response.data : { message: error.message };
        const statusCode = error.response ? error.response.status : 500;
        res.status(statusCode).json(errorData);
    }
});

// --- API ROUTE 3: Logout ---
app.post('/api/logout', (req, res) => {
    activeSession = null; 
    res.status(200).json({ success: true, message: "Session destroyed." });
});

// --- API ROUTE 4: Fetch Individuals from DB ---
app.get('/api/individuals', async (req, res) => {
    try {
        const providerCode = req.query.providerCode || 'MIR-NY';
        const sql = `
            SELECT * FROM client 
            WHERE prov_id = (SELECT id FROM provider WHERE code = :providerCode)
        `;
        const result = await executeQuery(sql, { providerCode });
        res.status(200).json(result.rows);
    } catch (error) {
        console.error("Database Query Error:", error.message);
        res.status(500).json({ error: "Failed to fetch individuals." });
    }
});

// --- API ROUTE 5: Fetch Attendance Type by Form ID ---
app.get('/api/attendance-types', async (req, res) => {
    try {
        const { formId } = req.query;
        if (!formId) return res.status(400).json({ error: "formId is required" });

        const sql = `
            SELECT t.id AS attendance_type_id, 
                   t.type_name AS attendance_type_name,
                   t.cal_unit_frm_time_in_out,
                   t.use_direct_billing_units
            FROM bill_service bs
            JOIN attendance_type t ON bs.attendance_type_id = t.id
            WHERE bs.form_id = :formId
        `;
        
        const result = await executeQuery(sql, { formId });
        res.status(200).json(result.rows);
    } catch (error) {
        console.error("Error fetching Attendance Types:", error.message);
        res.status(500).json({ error: "Failed to fetch Attendance Types." });
    }
});

// --- API ROUTE 6: Fetch Options by Attendance Type ID ---
app.get('/api/attendance-options', async (req, res) => {
    try {
        const { typeId } = req.query;
        if (!typeId) return res.status(400).json({ error: "typeId is required" });

        const sql = `
            SELECT id AS attendance_option_id, option_name AS attendance_option_name, short_code, billable
            FROM attendance_option
            WHERE attendance_type_id = :typeId
            ORDER BY option_name
        `;
        
        const result = await executeQuery(sql, { typeId });
        res.status(200).json(result.rows);
    } catch (error) {
        console.error("Error fetching Attendance Options:", error.message);
        res.status(500).json({ error: "Failed to fetch Attendance Options." });
    }
});

// --- STARTUP ---
app.listen(PORT, async () => {
    console.log(`🚀 API Tester running on http://localhost:${PORT}`);
    try {
        await initializeDatabase();
    } catch (err) {
        console.error("Failed to start database pooling:", err.message);
    }
});