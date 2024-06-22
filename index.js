const express = require('express');
const qr = require('qrcode');
const bodyParser = require('body-parser');
const { Client } = require('pg');
const ip = require('ip');

const app = express();
const port = process.env.PORT || 3000; // Define your desired port

// Initialize PostgreSQL client
const connectionString = process.env.DATABASE_URL; // Replace with your actual PostgreSQL database URL
const client = new Client({
  connectionString: connectionString,
});
client.connect()
  .then(() => console.log('Connected to the database'))
  .catch(err => console.error('Error connecting to the database:', err));

// Middleware to parse JSON and URL-encoded bodies
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Serve index.html for the root route
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

// Serve teacher-dashboard.html for the /teacher-dashboard route
app.get('/teacher-dashboard', (req, res) => {
  res.sendFile(__dirname + '/teacher-dashboard.html');
});

// Serve generate-qr.html for the /generate-qr route
app.get('/generate-qr', (req, res) => {
  res.sendFile(__dirname + '/generate-qr.html');
});

// Function to generate the QR code
async function generateQRCode(sessionData) {
  const randomComponent = Math.floor(Math.random() * 1000);
  const timestamp = new Date().getTime();
  const cloudURL = `https://attendance-4au9.onrender.com/submit`; // Replace with your cloud URL
  const qrCodeData = `${cloudURL}?qrcode=${sessionData.qrCodeCounter}&timestamp=${timestamp}_${randomComponent}&class=${sessionData.className}&date=${sessionData.date}&time=${sessionData.time}`;

  return new Promise((resolve, reject) => {
    qr.toDataURL(qrCodeData, { errorCorrectionLevel: 'H' }, (err, qrCode) => {
      if (err) {
        console.error('Error generating QR code:', err);
        reject(err);
      } else {
        resolve(qrCode);
      }
    });
  });
}

// POST route to handle form submission
app.post('/submit-form', (req, res) => {
  console.log('Form submitted:', req.body);
  const { name, usn, qrcode, clientFingerprint } = req.body;

  if (!clientFingerprint) {
    res.status(400).send('Bad Request: Missing client fingerprint');
    return;
  }

  const insertQuery = 'INSERT INTO "FormSubmissions" (name, usn, device_fingerprint) VALUES ($1, $2, $3)';
  const values = [name, usn, clientFingerprint];

  client.query(insertQuery, values)
    .then(() => {
      console.log('Form data inserted successfully');
      res.send('Form submitted successfully');
    })
    .catch(error => {
      console.error('Error inserting form data:', error);
      res.status(500).send('Internal Server Error');
    });
});

// Function to periodically generate new QR code
function generateQRCodePeriodically() {
  setInterval(() => {
    qrCodeCounter++;
    console.log(`QR code counter updated to: ${qrCodeCounter}`);
    generateQRCode(); // Generate QR code without sending a response
  }, 30000); // Generate a new QR code every 30 seconds
}

// Start the periodic QR code generation
let qrCodeCounter = 0;
generateQRCodePeriodically();

// Start the server
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
