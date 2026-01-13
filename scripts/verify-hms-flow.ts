
import axios from 'axios';

const API_URL = 'http://localhost:3000/api';

function decodeJwt(token: string) {
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = Buffer.from(base64, 'base64').toString();
        return JSON.parse(jsonPayload);
    } catch (e) {
        return null;
    }
}

async function main() {
    console.log('🚀 Starting HMS Flow Verification (API Mode)...\n');

    try {
        // 1. Login
        console.log('🔑 Logging in as Clinic 1 Owner...');
        const loginRes = await axios.post(`${API_URL}/auth/login`, {
            email: 'clinic1.owner@test.com',
            password: 'password123'
        });
        console.log('Login Response Data:', loginRes.data);
        const token = loginRes.data.accessToken;
        console.log('✅ Login Successful! Token:', token ? token.substring(0, 20) + '...' : 'UNDEFINED');
        if (!token) throw new Error('Token is missing in login response');

        const decoded = decodeJwt(token);
        console.log('🧐 Decoded Token:', decoded);

        const config = { headers: { Authorization: `Bearer ${token}` } };

        // 2. Create Patient
        console.log('\n🏥 Creating Patient "Test Patient"...');
        const patientPayload = {
            firstName: 'Backend',
            lastName: 'TestPatient',
            patientId: `PT-${Date.now()}`,
            phone: '9876543210',
            email: 'backend.test@example.com',
            dateOfBirth: '1990-01-01',
            gender: 'male',
            address: {
                street: '123 Test St',
                city: 'Test City',
                state: 'TS',
                zipCode: '500001',
                country: 'India'
            },
            bloodGroup: 'O+'
        };
        const patientRes = await axios.post(`${API_URL}/patients`, patientPayload, config);
        const patientId = patientRes.data.id;
        console.log(`✅ Patient Created: ${patientRes.data.firstName} ${patientRes.data.lastName} (ID: ${patientId})`);

        // 3. Get Doctor (Dr. Ayesha Khan)
        console.log('\n👨‍⚕️ Fetching Doctor...');
        const doctorsRes = await axios.get(`${API_URL}/doctors`, config);
        const doctor = doctorsRes.data.data.find((d: any) => d.firstName === 'Ayesha' && d.lastName === 'Khan');
        if (!doctor) throw new Error('Dr. Ayesha Khan not found! Run seed-doctors.ts first.');
        console.log(`✅ Found Doctor: Dr. ${doctor.firstName} ${doctor.lastName} (ID: ${doctor.id})`);

        // 4. Create Appointment
        console.log('\n📅 Scheduling Appointment...');
        const appointmentDate = new Date();
        appointmentDate.setDate(appointmentDate.getDate() + 1); // Tomorrow
        const dateStr = appointmentDate.toISOString().split('T')[0];

        const appointmentPayload = {
            patientId: patientId,
            doctorId: doctor.id,
            appointmentDate: dateStr,
            appointmentTime: '10:00',
            duration: 30,
            status: 'scheduled',
            appointmentType: 'consultation',
            reason: 'General Checkup'
        };
        const appointmentRes = await axios.post(`${API_URL}/appointments`, appointmentPayload, config);
        console.log(`✅ Appointment Scheduled! ID: ${appointmentRes.data.id} for ${dateStr} @ 10:00`);

        console.log('\n========================================');
        console.log('✅ HMS Flow Verification PASSED');
        console.log('========================================\n');

    } catch (error: any) {
        console.error('❌ Error during verification:', error.response?.data || error.message);
        process.exit(1);
    }
}

main();
