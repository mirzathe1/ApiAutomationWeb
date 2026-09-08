import axios from 'axios';
import { wrapper } from 'axios-cookiejar-support';
import { CookieJar } from 'tough-cookie';

export class TherapClient {
    constructor(baseUrl) {
        this.baseUrl = baseUrl;
        this.authToken = null;
        this.providerCode = null;

        // Create an Axios instance that remembers cookies automatically
        const jar = new CookieJar();
        this.client = wrapper(axios.create({
            baseURL: this.baseUrl,
            jar,
            withCredentials: true
        }));
    }

    async authenticate(credentials) {
        this.providerCode = credentials.providerCode;

        // Step 1: Fetch Bearer Token
        const loginResponse = await this.client.post('/therap-api/v1/login', {
            ...credentials,
            maxInactiveMinutes: "30",
            cookieEnabled: "true"
        }, {
            headers: { "Content-Type": "application/x-www-form-urlencoded" }
        });

        if (loginResponse.status !== 200) throw new Error("API Login Failed");
        this.authToken = "Bearer " + loginResponse.data.Token;

        // Step 2: Establish Session Cookies
        const cookieResponse = await this.client.post('/auth/api/v1/login', {
            ...credentials,
            maxInactiveMinutes: "30",
            cookieEnabled: "true"
        }, {
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                "RequestSource": "iOS"
            }
        });

        if (cookieResponse.status !== 200) throw new Error("Cookie Login Failed");
    }

    async submitAttendance(dataPayload) {
        // Axios automatically parses JSON and throws an error if it fails (like a 422 error)
        return await this.client.post('/therap-api/v1/attendance/inputData', dataPayload, {
            headers: {
                "Authorization": this.authToken,
                "Content-Type": "application/json",
                "Accept": "application/json",
                "RequestSource": "iOS",
                "Provider-Code": this.providerCode,
                "X-Provider": this.providerCode
            }
        });
    }

    async verifyAttendance(formId) {
        return await this.client.get(`/api/v1/attendances/${formId}`, {
            headers: {
                "Authorization": this.authToken,
                "Accept": "application/json",
                "RequestSource": "iOS",
                "Provider-Code": this.providerCode,
                "X-Provider": this.providerCode
            },
            timeout: 60000
        });
    }
}