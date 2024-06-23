const express = require('express');
const qr = require('qrcode');
const bodyParser = require('body-parser');
const { Client } = require('pg');
const ip = require('ip');
const FingerprintJS = require('@fingerprintjs/fingerprintjs');

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
async function generateQRCode(className = '') {
  const randomComponent = Math.floor(Math.random() * 1000);
  const timestamp = new Date().getTime();
  const cloudURL = "https://attendance-4au9.onrender.com/submit";
  const qrCodeData = `${cloudURL}?qrcode=${qrCodeCounter}&timestamp=${timestamp}_${randomComponent}&className=${className}`;

  return new Promise((resolve, reject) => {
    qr.toDataURL(qrCodeData, { errorCorrectionLevel: 'H' }, (err, qrCode) => {
      if (err) {
        console.error('Error generating QR code:', err);
        reject(err);
      } else {
        console.log(`Generated QR code with data: ${qrCodeData}`);
        resolve(qrCode);
      }
    });
  });
}

let qrIntervals = {};
let latestQRCodes = {};

app.post('/start-qr-generation', async (req, res) => {
  const className = req.body.className;

  // Clear any existing interval for this class
  if (qrIntervals[className]) {
    clearInterval(qrIntervals[className]);
  }

  // Start generating new QR codes every 30 seconds
  qrIntervals[className] = setInterval(async () => {
    qrCodeCounter++;
    const qrCode = await generateQRCode(className);
    latestQRCodes[className] = qrCode;
    console.log(`QR code counter updated to: ${qrCodeCounter} for class: ${className}`);
  }, 30000);

  res.send(`Started generating QR codes for class ${className}`);
});

app.get('/latest-qr-code/:className', async (req, res) => {
  const className = req.params.className;
  const qrCode = latestQRCodes[className];
  if (qrCode) {
    res.send(qrCode);
  } else {
    res.status(404).send('QR code not found for the specified class');
  }
});

app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Home</title>
    </head>
    <body>
      <div class="container">
        <h1>Welcome to Home</h1>
        <div class="btn-container">
          <a href="/teacher-dashboard" class="btn">Teacher Dashboard</a>
        </div>
      </div>
    </body>
    </html>`
  );
});

app.get('/teacher-dashboard', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Teacher Dashboard</title>
    </head>
    <body>
      <div class="container">
        <h1>Teacher Dashboard</h1>
        <div class="btn-container">
          <button class="btn" onclick="startQRCodeGeneration('ClassA')">Generate QR for Class A</button>
          <button class="btn" onclick="startQRCodeGeneration('ClassB')">Generate QR for Class B</button>
        </div>
        <div class="qr-code" id="qrCodeContainer">
          <!-- QR code will be inserted here -->
        </div>
      </div>
      <script>
  function startQRCodeGeneration(className) {
    fetch('/start-qr-generation', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ className: className })
    })
    .then(response => response.text())
    .then(message => {
      console.log(message);
      fetchLatestQRCode(className);
      // Periodically fetch the latest QR code
      setInterval(() => fetchLatestQRCode(className), 30000);
    })
    .catch(error => console.error('Error starting QR code generation:', error));
  }

  function fetchLatestQRCode(className) {
    fetch(`/latest-qr-code/"${className}"`)
      .then(response => response.text())
      .then(qrCode => {
        const qrCodeContainer = document.getElementById('qrCodeContainer');
        qrCodeContainer.innerHTML = `<img src="${qrCode}" alt="QR Code for ${className}" />`;
      })
      .catch(error => console.error('Error fetching latest QR code:', error));
  }
</script>

    </body>
    </html>`
  );
});

app.get('/qr-code', async (req, res) => {
  try {
    const qrCode = await generateQRCode();
    res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Latest QR Code</title>
      </head>
      <body>
        <div class="qr-code">
          <img src="${qrCode}" alt="QR Code ${qrCodeCounter}" />
        </div>
      </body>
      </html>`
    );
  } catch (error) {
    console.error('Error generating QR code:', error);
    res.status(500).send('Internal Server Error');
  }
});

app.get('/new-qrcode', async (req, res) => {
  try {
    const qrCodeData = await generateQRCode();
    res.json({ qrCodeData });
  } catch (error) {
    console.error('Error generating new QR code:', error);
    res.status(500).send('Internal Server Error');
  }
});

app.get('/submit', async (req, res) => {
  try {
    const requestedQrCode = parseInt(req.query.qrcode);
    const className = req.query.className;
    const timestampPart = req.query.timestamp.split('_')[0];
    const timestamp = parseInt(timestampPart);

    const currentTime = new Date().getTime();
    const isValidTime = currentTime - timestamp <= 30000; // 30 seconds

    if (qrCodeCounter === requestedQrCode && isValidTime) {
      const fpPromise = await FingerprintJS.load();
      const fpInstance = await fpPromise.get();
      const clientFingerprint = fpInstance.visitorId;

      res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Attendance</title>
        </head>
        <body>
          <form id="attendanceForm" action="/submit" method="post">
            <h2>Accepted! Enter details:</h2>
            <label for="name">Your Name:</label>
            <input type="text" id="name" name="name" required>
            <label for="usn">USN:</label>
            <input type="text" id="usn" name="usn" required>
            <input type="hidden" id="qrcode" name="qrcode" value="${requestedQrCode}">
            <input type="hidden" id="className" name="className" value="${className}">
            <input type="hidden" id="clientFingerprint" name="clientFingerprint" value="${clientFingerprint}">
            <button type="submit">Submit</button>
          </form>
        </body>
        </html>`
      );
    } else {
      res.send('Rejected');
      console.log(`Received qr code: "${requestedQrCode}", Current qr code: "${qrCodeCounter}", Valid time: ${isValidTime}`);
    }
  } catch (error) {
    console.error('Error generating form page:', error);
    res.status(500).send('Internal Server Error');
  }
});

// POST route handler for form submission
app.post('/submit', async (req, res) => {
  try {
    const requestedQrCode = parseInt(req.body.qrcode);
    const clientFingerprint = req.body.clientFingerprint;
    const { name, usn, className } = req.body;
    const timestamp = new Date();
    const formattedTimestamp = timestamp.toISOString().replace(/[:.]/g, '-');
    const tableName = `Department_${className}_${formattedTimestamp}`;

    if (!clientFingerprint) {
      throw new Error('Client fingerprint is missing.');
    }

    // Verify the QR code and time validity
    const currentTime = new Date().getTime();
    const isValidTime = currentTime - timestamp <= 30000; // 30 seconds

    if (qrCodeCounter === requestedQrCode && isValidTime) {
      const fpPromise = await FingerprintJS.load();
      const fpInstance = await fpPromise.get();
      const serverFingerprint = fpInstance.visitorId;

      // Compare client and server fingerprints for verification
      if (clientFingerprint !== serverFingerprint) {
        throw new Error('Client fingerprint does not match server fingerprint.');
      }

      // Create the table if it doesn't exist
      const createTableQuery = 
        `CREATE TABLE IF NOT EXISTS "${tableName}" (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255),
          usn VARCHAR(255)
        )`
      ;
      await client.query(createTableQuery);

      // Insert data into the table
      const insertQuery = `INSERT INTO "${tableName}" (name, usn) VALUES ($1, $2)`;
      await client.query(insertQuery, [name, usn]);

      res.send('Attendance submitted successfully.');
    } else {
      res.status(403).send('Attendance submission failed. Invalid QR code or time exceeded.');
      console.log(`Received qr code: "${requestedQrCode}", Current qr code: "${qrCodeCounter}", Valid time: ${isValidTime}`);
    }
  } catch (error) {
    console.error('Error submitting attendance:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server running on http://${localip}:${port}`);
});
