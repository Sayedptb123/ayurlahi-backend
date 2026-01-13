
import axios from 'axios';

const API_URL = 'http://localhost:3000/api';

// Helper to decode JWT manually
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
    console.log('🚀 Starting HMS Extended Verification (API Mode)...\n');

    try {
        // 1. Login
        console.log('🔑 Logging in as Clinic 1 Owner...');
        const loginRes = await axios.post(`${API_URL}/auth/login`, {
            email: 'clinic1.owner@test.com',
            password: 'password123'
        });
        const token = loginRes.data.accessToken || loginRes.data.access_token;
        if (!token) throw new Error('Token is missing in login response');
        console.log(`✅ Login Successful! User: ${loginRes.data.user.email}`);

        const config = { headers: { Authorization: `Bearer ${token}` } };

        // 2. Setup Base Data (Create Patient, Get Doctor, Create Appointment)
        console.log('\n🏥 Creating Base Data...');

        // Create Patient
        const patientPayload = {
            firstName: 'ExtVerify',
            lastName: `Patient-${Date.now()}`,
            patientId: `PT-${Date.now()}`,
            phone: '9876543210',
            email: `ext.verify.${Date.now()}@example.com`,
            dateOfBirth: '1985-06-15',
            gender: 'male',
            address: { street: '456 Verify Ln', city: 'Test City', state: 'TS', zipCode: '500001', country: 'India' },
            bloodGroup: 'B+'
        };
        const patientRes = await axios.post(`${API_URL}/patients`, patientPayload, config);
        const patientId = patientRes.data.id;
        console.log(`✅ Patient Created: ${patientRes.data.firstName} (ID: ${patientId})`);

        // Get Doctor
        const doctorsRes = await axios.get(`${API_URL}/doctors`, config);
        const doctor = doctorsRes.data.data.find((d: any) => d.firstName === 'Ayesha' && d.lastName === 'Khan');
        if (!doctor) throw new Error('Dr. Ayesha Khan not found! Run seed-doctors.ts first.');
        const doctorId = doctor.id;
        console.log(`✅ Found Doctor: Dr. ${doctor.firstName} ${doctor.lastName} (ID: ${doctorId})`);

        // Create Appointment with Random Time
        const appointmentDate = new Date();
        appointmentDate.setDate(appointmentDate.getDate() + 1);
        const dateStr = appointmentDate.toISOString().split('T')[0];

        // Generate random time between 09:00 and 17:00
        const hour = Math.floor(Math.random() * (17 - 9) + 9);
        const minute = Math.floor(Math.random() * 60);
        const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;

        const appointmentPayload = {
            patientId: patientId,
            doctorId: doctorId,
            appointmentDate: dateStr,
            appointmentTime: timeStr,
            duration: 30,
            status: 'scheduled',
            appointmentType: 'consultation',
            reason: 'Extended Verification Session'
        };
        const appointmentRes = await axios.post(`${API_URL}/appointments`, appointmentPayload, config);
        const appointmentId = appointmentRes.data.id;
        console.log(`✅ Appointment Created (ID: ${appointmentId}) Time: ${timeStr}`);


        // 3. Verify Medical Records
        console.log('\n📋 Verifying Medical Records Module...');
        const medicalRecordPayload = {
            patientId,
            doctorId,
            appointmentId,
            visitDate: new Date().toISOString().split('T')[0],
            chiefComplaint: 'Severe headache and fatigue',
            diagnosis: 'Migraine',
            treatment: 'Rest and hydration. Prescribed pain relief.',
            vitals: {
                bloodPressure: '120/80',
                temperature: 98.6,
                pulse: 72,
                weight: 70
            },
            notes: 'Patient has history of migraines.'
        };
        const medRecordRes = await axios.post(`${API_URL}/medical-records`, medicalRecordPayload, config);
        console.log(`✅ Medical Record Created (ID: ${medRecordRes.data.id})`);


        // 4. Verify Prescriptions
        console.log('\nRx Verifying Prescriptions Module...');
        const prescriptionPayload = {
            patientId,
            doctorId,
            appointmentId,
            prescriptionDate: new Date().toISOString().split('T')[0],
            diagnosis: 'Migraine',
            status: 'active',
            items: [
                {
                    medicineName: 'Paracetamol',
                    dosage: '500mg',
                    frequency: 'Twice a day',
                    duration: '5 days',
                    quantity: 10,
                    instructions: 'Take after food'
                }
            ],
            notes: 'Avoid bright lights.'
        };
        const prescriptionRes = await axios.post(`${API_URL}/prescriptions`, prescriptionPayload, config);
        console.log(`✅ Prescription Created (ID: ${prescriptionRes.data.id})`);


        // 5. Verify Lab Reports
        console.log('\n🧪 Verifying Lab Reports Module...');
        const labReportPayload = {
            reportNumber: `LR-${Date.now()}`,
            patientId,
            doctorId,
            appointmentId,
            orderDate: new Date().toISOString().split('T')[0],
            status: 'ordered',
            tests: [
                {
                    testName: 'Complete Blood Count (CBC)',
                    status: 'pending',
                    notes: 'Routine check'
                }
            ]
        };
        const labReportRes = await axios.post(`${API_URL}/lab-reports`, labReportPayload, config);
        console.log(`✅ Lab Report Created (ID: ${labReportRes.data.id})`);


        // 6. Verify Billing
        console.log('\n💰 Verifying Patient Billing Module...');
        const billPayload = {
            billNumber: `BILL-${Date.now()}`,
            patientId,
            appointmentId,
            billDate: new Date().toISOString().split('T')[0],
            status: 'pending',
            items: [
                {
                    itemType: 'consultation',
                    itemName: 'General Consultation',
                    quantity: 1,
                    unitPrice: 500,
                    discount: 0
                },
                {
                    itemType: 'medicine',
                    itemName: 'Paracetamol',
                    quantity: 10,
                    unitPrice: 5,
                    discount: 0
                }
            ]
        };
        const billRes = await axios.post(`${API_URL}/patient-billing`, billPayload, config);
        console.log(`✅ Patient Bill Created (ID: ${billRes.data.id})`);


        console.log('\n========================================');
        console.log('✅ COMPLETE HMS VERIFICATION PASSED');
        console.log('   - Patients: OK');
        console.log('   - Doctors: OK');
        console.log('   - Appointments: OK');
        console.log('   - Medical Records: OK');
        console.log('   - Prescriptions: OK');
        console.log('   - Lab Reports: OK');
        console.log('   - Billing: OK');
        console.log('========================================\n');

    } catch (error: any) {
        console.error('❌ Error during extended verification:', error.response?.data || error.message);
        if (error.response?.data?.message) {
            console.error('Validation details:', JSON.stringify(error.response.data.message, null, 2));
        }
        process.exit(1);
    }
}

main(); 
