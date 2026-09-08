import xlsx from 'xlsx';

export function sanitizeText(val) {
    if (val === undefined || val === null) return "";
    return String(val).trim();
}

export function getExcelData(filePath) {
    const workbook = xlsx.readFile(filePath);
    
    // 1. Read Credentials Sheet
    const credsSheet = workbook.Sheets['Credentials'];
    if (!credsSheet) {
        throw new Error("Sheet named 'Credentials' not found in Excel file.");
    }
    const credsData = xlsx.utils.sheet_to_json(credsSheet);
    
    const loginCredentials = {
        loginName: credsData[0]?.loginName || credsData[0]?.username || "",
        password: credsData[0]?.password || "",
        providerCode: credsData[0]?.providerCode || ""
    };

    // 2. Read Attendance Records Sheet
    const attendanceSheet = workbook.Sheets['AttendanceRecords'];
    if (!attendanceSheet) {
        throw new Error("Sheet named 'AttendanceRecords' not found in Excel file.");
    }
    const rows = xlsx.utils.sheet_to_json(attendanceSheet);

    return { loginCredentials, rows };
}