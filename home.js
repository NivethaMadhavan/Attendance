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
let currentClassName = 'defaultClassName'; // Initial class name
let intervalId = null; // To store the interval ID

// Store session information
let currentSession = {
  className: null,
  timestamp: null,
  tableName: null,
};

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
async function generateQRCode(className) {
  const randomComponent = Math.floor(Math.random() * 1000);
  const timestamp = new Date().getTime();
  const cloudURL = `https://attendance-4au9.onrender.com/submit`;
  const qrCodeData = `${cloudURL}?qrcode=${qrCodeCounter}&timestamp=${timestamp}_${randomComponent}&className=${className}`;
  console.log(`Current:${qrCodeCounter}`);

  return new Promise((resolve, reject) => {
    qr.toDataURL(qrCodeData, { errorCorrectionLevel: 'H' }, (err, qrCode) => {
      if (err) {
        console.error(`Error generating QR code:`, err);
        reject(err);
      } else {
        console.log(`Generated QR code with data: ${qrCodeData}`);
        resolve(qrCode);
      }
    });
  });
}

// Function to periodically generate new QR code
function startQRCodeGenerationInterval(className) {
  if (intervalId !== null) {
    clearInterval(intervalId); // Clear any existing interval
  }
  qrCodeCounter = 0; // Reset counter when interval restarts
  intervalId = setInterval(() => {
    qrCodeCounter++;
    console.log(`QR code counter updated to: ${qrCodeCounter}`);
    generateQRCode(className)
      .then(qrCode => {
        // Optionally do something with the newly generated QR code
      })
      .catch(err => console.error('Error generating QR code during interval:', err));
  }, 30000);
}

app.get('/submit', async (req, res) => {
  try {
    const requestedQrCode = parseInt(req.query.qrcode);
    const className = req.query.className; // Get className from query

    if (qrCodeCounter !== requestedQrCode) {
      res.send('Rejected');
      console.log(`Received qr code : "${requestedQrCode}", Current qr code : "${qrCodeCounter}"`);
    } else {
      res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Attendance</title>
          <link rel="icon" href="letter_logo.png" type="image/x-icon">
          <style>
            body {
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
              background-color: teal;
              background-size: contain;
              background-image: url("hire_now_bg.jpg") fixed;
              background-position: center;
              margin: 0;
              padding: 0;
              display: flex;
              justify-content: center;
              align-items: center;
              height: 100vh;
              color: navy;
            }
            h2 {
              color: white;
              font-weight: 700;
              font-size: 28px;
              text-align: center;
            }
            form {
              backdrop-filter: blur(100px);
              padding: 20px;
              padding-right: 70px;
              padding-left: 50px;
              box-shadow: 0px 4px 6px #38497C;
              border-radius: 15px;
              width: 500px;
            }
            label {
              display: block;
              margin-bottom: 10px;
              color: black;
              font-size: 22px;
            }
            input, textarea {
              width: 100%;
              padding: 10px;
              margin-bottom: 15px;
              border: none;
              border-radius: 8px;
              background: rgba(255, 255, 255, 0.1);
              color: black;
            }
            input {
              height: 40px;
            }
            textarea {
              height: 110px;
            }
            button {
              background-color: #5F7DEF;
              color: black;
              padding: 10px 15px;
              border: none;
              border-radius: 8px;
              cursor: pointer;
              transition: background-color 0.3s ease;
            }
            button:hover {
              background-color: #3e4093;
              color: white;
            }
          </style>
          <script src="https://cdn.jsdelivr.net/npm/@fingerprintjs/fingerprintjs@3/dist/fp.min.js"></script>
        </head>
        <body>
          <form id="hire_now" action="/submit" method="post">
            <h2>Accepted! Enter details:</h2>
            <label for="name">Your Name:</label>
            <input type="text" id="name" name="name" required>
            <label for="usn">USN:</label>
            <input type="text" id="usn" name="usn" required>
            <input type="hidden" id="qrcode" name="qrcode" value="${requestedQrCode}">
            <input type="hidden" id="className" name="className" value="${className}">
            <input type="hidden" id="clientFingerprint" name="clientFingerprint">
            <button type="submit">Submit</button>
          </form>
          <script>
            // JavaScript to fetch and set the client fingerprint
            // Using FingerprintJS library
            FingerprintJS.load().then(fp => {
              fp.get().then(result => {
                const visitorId = result.visitorId;
                document.getElementById('clientFingerprint').value = visitorId;
              });
            });
          </script>
        </body>
        </html>
      `);
    }
  } catch (error) {
    console.error(`Error generating form page:`, error);
    res.status(500).send('Internal Server Error');
  }
});

// Endpoint to serve the latest QR code image
app.get('/latest-qr-code', async (req, res) => {
  try {
    const qrCode = await generateQRCode(currentClassName);
    res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Latest QR Code</title>
        <style>
          /* Your existing styles */
        </style>
      </head>
      <body>
        <div style="display: flex; justify-content: center; align-items: center; height: 100vh;">
          <img id="qrCodeImg" src="${qrCode}" alt="QR Code ${qrCodeCounter}" style="border: 2px solid #000; padding: 10px; background-color: #fff;" />
        </div>
        <script>
          function refreshQRCode() {
            fetch('/latest-qr-code')
              .then(response => response.text())
              .then(data => {
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = data;
                const newQRCodeImg = tempDiv.querySelector('#qrCodeImg');
                document.getElementById('qrCodeImg').src = newQRCodeImg.src;
              })
              .catch(error => console.error('Error fetching QR code:', error))
              .finally(() => {
                setTimeout(refreshQRCode, 30000); // Refresh every 30 seconds
              });
          }

          refreshQRCode(); // Initial call to start refreshing
        </script>
      </body>
      </html>
    `);
  } catch (error) {
    console.error(`Error generating QR code:`, error);
    res.status(500).send('Internal Server Error');
  }
});

// Endpoint to generate the QR code for the home page
app.get('/', (req, res) => {
      res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>QR Code Generator</title>
        <style>
          /* Your existing styles */
        </style>
      </head>
      <body>
        <h1>QR Code Generator</h1>
        <form action="/start-session" method="post">
          <label for="className">Class Name:</label>
          <input type="text" id="className" name="className" required>
          <button type="submit">Start Session</button>
        </form>
        <div id="qrCode">
          <!-- QR code will be displayed here -->
        </div>
        <script>
          // JavaScript to handle QR code updates
        </script>
      </body>
      </html>
    `);
});

// Endpoint to handle form submission and save to the database
app.post('/submit', async (req, res) => {
  try {
    const { name, usn, qrcode, clientFingerprint, className } = req.body;
    console.log(`Received submission: name="${name}", usn="${usn}", qrcode="${qrcode}", fingerprint="${clientFingerprint}", className="${className}"`);

    currentClassName = className; // Update global current class name
    currentSession.className = className;
    currentSession.timestamp = new Date();
    const tableName = `attendance_${className}_${currentSession.timestamp.toISOString().replace(/[:.]/g, '-')}`;
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS "${tableName}" (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100),
        usn VARCHAR(50),
        client_fingerprint VARCHAR(255),
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    await client.query(createTableQuery);
    console.log(`Table "${tableName}" created or already exists`);

    // Check if the client fingerprint already exists in any table
    const checkFingerprintQuery = `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = '${tableName}' AND table_schema = 'public');`;
    const result = await client.query(checkFingerprintQuery);
    
    if (!result.rows[0].exists) {
      // Table does not exist, create it and insert data
      const insertQuery = `
        INSERT INTO ${tableName} (name, usn, client_fingerprint)
        VALUES ($1, $2, $3)
      `;
      await client.query(insertQuery, [name, usn, clientFingerprint]);
      console.log(`Data inserted into "${tableName}": name="${name}", usn="${usn}", fingerprint="${clientFingerprint}"`);

      res.send('Submission received and saved!');
    } else {
      // Table exists, reject the submission
      res.send('Submission rejected: Duplicate fingerprint.');
      console.log(`Duplicate fingerprint detected for ${clientFingerprint}. Submission rejected.`);
    }
  } catch (error) {
    console.error('Error handling form submission:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Endpoint to start a new session with class name
app.post('/start-session', async (req, res) => {
  try {
    const { className } = req.body;
    currentClassName = className;
    startQRCodeGenerationInterval(className); // Start generating QR codes for the new class session
    res.redirect('/latest-qr-code'); // Redirect to the page displaying the latest QR code
  } catch (error) {
    console.error('Error starting new session:', error);
    res.status(500).send('Internal Server Error');
  }
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Server is running on http://0.0.0.0:${port}`);
});
