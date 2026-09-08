import express from 'express';
import multer from 'multer';
import fs from 'fs';
import { getExcelData, sanitizeText } from './utils/excelReader.js';
import { TherapClient } from './api/TherapClient.js';

const app = express();
const upload = multer({ dest: 'uploads/' });
const BASE_URL = "https://billing.therapdev.net";

app.use(express.static('public')); // Serves your index.html
app.use(express.json());

app.post('/api/run-automation', upload.single('excelFile'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No file uploaded." });

    const filePath = req.file.path;
    let passed = 0;
    let failed = 0;
    let logs = [];

    try {
        // 1. Read Excel Data
        const { loginCredentials, rows } = getExcelData(filePath);
        
        // 2. Initialize API
        const api = new TherapClient(BASE_URL);
        await api.authenticate(loginCredentials);
        logs.push("[SYSTEM] Authenticated successfully.");

        // 3. Process Rows
        for (let index = 0; index < rows.length; index++) {
            const row = rows[index];
            if (!row.serviceDate) continue;

            let formattedDate = typeof row.serviceDate === 'number' 
                ? new Date(Date.UTC(0, 0, row.serviceDate - 1)).toLocaleDateString('en-US', { timeZone: 'UTC', year: 'numeric', month: '2-digit', day: '2-digit' })
                : String(row.serviceDate).split(" ")[0];

            const dataPayload = {
                serviceDate: formattedDate,
                timeInOut: [{ timeIn: sanitizeText(row.timeIn), timeOut: sanitizeText(row.timeOut) }],
                optionCode: row.optionCode ? String(row.optionCode).trim() : "",
                status: row.status ? String(row.status).trim().toUpperCase() : "INPREP",
                serviceFormId: sanitizeText(row.serviceFormId),
                comments: sanitizeText(row.comments)
            };

            try {
                // Axios automatically throws an error if status is not 2xx, 
                // which acts exactly like our "Option B" graceful skip!
                const postResponse = await api.submitAttendance(dataPayload);
                const newFormId = postResponse.data.formId;

                const verifyResponse = await api.verifyAttendance(newFormId);
                
                passed++;
                logs.push(`✅ Row ${index + 1}: SUCCESS`);
            } catch (error) {
                failed++;
                // Extract API error message if it exists
                const errorDetail = error.response?.data ? JSON.stringify(error.response.data) : error.message;
                logs.push(`❌ Row ${index + 1}: FAILED - ${errorDetail}`);
            }
        }

        // Cleanup: Delete the uploaded file from the server
        fs.unlinkSync(filePath);

        // 4. Send Results
        res.status(200).json({
            message: "Automation Complete",
            passed,
            failed,
            logs
        });

    } catch (error) {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

const PORT = 3000;
app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));