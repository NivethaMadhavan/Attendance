const express = require('express');
const qr = require('qrcode');
const bodyParser = require('body-parser');
const { Client } = require('pg');

const app = express();
let port = parseInt(process.env.PORT, 10) || 10001; // Port for teacher.js
let qrPort = parseInt(process.env.PORT, 10) || 10000;; // Port for QR code generation

if (port < 0 || port > 65535) {
  console.error(`Invalid port number: ${port}. Falling back to default port 10001.`);
  port = 10001;
}

const connectionString = process.env.DATABASE_URL;

const client = new Client({
  connectionString: connectionString,
});

client.connect()
  .then(() => console.log('Connected to the database'))
  .catch(err => console.error('Error connecting to the database:', err));

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

async function generateQRCode(sessionData) {
  const randomComponent = Math.floor(Math.random() * 1000);
  const timestamp = new Date().getTime();
  const cloudURL = `https://attendance-4au9.onrender.com/submit`;
  const qrCodeData = `${cloudURL}?qrcode=${sessionData.qrCodeCounter}&timestamp=${timestamp}_${randomComponent}&class=${sessionData.className}&date=${sessionData.date}&time=${sessionData.time}`;

  try {
    const qrCode = await qr.toDataURL(qrCodeData, { errorCorrectionLevel: 'H' });
    return qrCode;
  } catch (err) {
    console.error('Error generating QR code:', err);
    throw err; // Propagate error for proper error handling in endpoint
  }
}

// Endpoint to handle QR code generation requests
app.post('/generate-qr', async (req, res) => {
  try {
    const className = req.body.className;
    const sessionData = {
      qrCodeCounter: Math.floor(Math.random() * 10000), // Example data, replace with actual logic
      className: className,
      date: new Date().toISOString().split('T')[0], // Current date
      time: new Date().toISOString().split('T')[1].split('.')[0] // Current time
    };
    const qrCode = await generateQRCode(sessionData);
    res.json({ qrCode });
  } catch (error) {
    console.error('Error generating QR code:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Start the server
app.listen(port, '0.0.0.0', () => {
  console.log(`Teacher server is running at http://0.0.0.0:${port}`);
});
