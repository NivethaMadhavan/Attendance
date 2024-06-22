const express = require('express');
const qr = require('qrcode');
const bodyParser = require('body-parser');
const { Client } = require('pg');
const ip = require('ip');

const app = express();
let port = parseInt(process.env.PORT, 10) || 10000; // Default to 10000 if PORT is not set or invalid

// Ensure the port is within the valid range
if (port < 0 || port > 65535) {
  console.error(`Invalid port number: ${port}. Falling back to default port 10000.`);
  port = 10000;
}

const localip = ip.address();
let qrCodeCounter = 0;

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

const connectionString = process.env.DB_URI_INTERNAL;

const client = new Client({
  connectionString: connectionString,
});

client.connect()
  .then(() => console.log('Connected to the database'))
  .catch(err => console.error('Error connecting to the database:', err));

// Function to generate the QR code
async function generateQRCode(sessionData) {
  const randomComponent = Math.floor(Math.random() * 1000);
  const timestamp = new Date().getTime();
  const cloudURL = `https://attendance-4au9.onrender.com/submit`;
  const qrCodeData = `${cloudURL}?qrcode=${qrCodeCounter}&timestamp=${timestamp}_${randomComponent}&class=${sessionData.className}&date=${sessionData.date}&time=${sessionData.time}`;

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

// Endpoint to generate the QR code for the home page
app.get('/', async (req, res) => {
  try {
    console.log('Generating QR code for home page');
    await generateQRCode({
      qrCodeCounter,
      className: 'Home',
      date: new Date().toISOString().split('T')[0], // YYYY-MM-DD format
      time: new Date().toTimeString().split(' ')[0] // HH:MM:SS format
    });
    res.sendFile(__dirname + '/index.html'); // Serve the main application UI
  } catch (error) {
    console.error('Error generating QR code:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Endpoint to fetch a new QR code
app.get('/new-qrcode', async (req, res) => {
  try {
    console.log('Generating new QR code');
    const qrCodeData = await generateQRCode({
      qrCodeCounter,
      className: 'Home',
      date: new Date().toISOString().split('T')[0], // YYYY-MM-DD format
      time: new Date().toTimeString().split(' ')[0] // HH:MM:SS format
    });
    qrCodeCounter++; // Increment QR code counter
    res.json({ qrCodeData });
  } catch (error) {
    console.error('Error generating new QR code:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Endpoint to handle the QR code validation and show the form
app.get('/submit', async (req, res) => {
  console.log('Start: qrCodeCounter:', qrCodeCounter);
  try {
    const requestedQrCode = parseInt(req.query.qrcode);
    console.log(`Received submit request with qrcode: ${requestedQrCode}, current qrCodeCounter: ${qrCodeCounter}`);

    if (qrCodeCounter !== requestedQrCode) {
      res.send('Rejected');
    } else {
      res.sendFile(__dirname + '/form.html'); // Serve the form submission HTML
      console.log('End: qrCodeCounter:', qrCodeCounter);
    }
  } catch (error) {
    console.error('Error processing submit request:', error);
    res.status(500).send('Internal Server Error');
  }
  console.log('qrCodeCounter:', qrCodeCounter);
});

// POST route handler for form submission
app.post('/submit', (req, res) => {
  console.log('Request body:', req.body);
  try {
    const requestedQrCode = parseInt(req.body.qrcode); // Retrieve from request body, not query
    console.log(`Received submit request with qrcode: ${requestedQrCode}, current qrCodeCounter: ${qrCodeCounter}`);
    console.log(typeof qrCodeCounter, typeof requestedQrCode);

    const clientFingerprint = req.body.clientFingerprint;

    if (!clientFingerprint) {
      res.status(400).send('Bad Request: Missing client fingerprint');
      return;
    }

    if (qrCodeCounter === requestedQrCode) {
      // Check if the fingerprint is already in the table
      const checkQuery = 'SELECT COUNT(*) AS count FROM "FormSubmissions" WHERE device_fingerprint = $1';
      client.query(checkQuery, [clientFingerprint], (checkError, checkResults) => {
        if (checkError) {
          console.error('Error checking fingerprint:', checkError);
          res.status(500).send('Internal Server Error');
          return;
        }
        const count = checkResults.rows[0].count;
        if (count > 0) {
          // Fingerprint already submitted
          console.log('Form submission rejected: Fingerprint already submitted');
          res.send('Form submission rejected: Fingerprint already submitted');
        } else {
          // Extract form data from the request
          const { name, usn } = req.body;

          // Insert the form data into the database
          const insertQuery = 'INSERT INTO "FormSubmissions" (name, usn, device_fingerprint) VALUES ($1, $2, $3)';
          client.query(insertQuery, [name, usn, clientFingerprint], (insertError, insertResults) => {
            if (insertError) {
              console.error('Error inserting form data:', insertError);
              res.status(500).send('Internal Server Error');
            } else {
              console.log('Form data inserted successfully');
              res.send('Form submitted successfully');
            }
          });
        }
      });
    } else {
      // QR code doesn't match
      console.log('Form submission rejected: QR code mismatch');
      res.send('Form submission rejected: QR code mismatch');
    }
  } catch (error) {
    console.error('Error processing form submission:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Function to periodically generate new QR code
function generateQRCodePeriodically() {
  setInterval(() => {
    qrCodeCounter++;
    console.log(`QR code counter updated to: ${qrCodeCounter}`);
    generateQRCode({
      qrCodeCounter,
      className: 'Home',
      date: new Date().toISOString().split('T')[0], // YYYY-MM-DD format
      time: new Date().toTimeString().split(' ')[0] // HH:MM:SS format
    }); // Generate QR code without sending a response
  }, 30000); // Generate a new QR code every 30 seconds
}

// Start the periodic QR code generation
generateQRCodePeriodically();

app.listen(port, '0.0.0.0', () => {
  console.log(`Server is running on http://0.0.0.0:${port}`);
});
