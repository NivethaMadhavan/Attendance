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
      <title>Home</title>
      <style>
        /* Your existing styles */
      </style>
    </head>
    <body>
      <div class="container">
        <h1>Welcome to Home</h1>
        <div class="btn-container">
          <a href="/teacher-dashboard" class="btn">Teacher Dashboard</a>
        </div>
      </div>
    </body>
    </html>
  `);
});

// Route to redirect to Teacher Dashboard
app.get('/teacher-dashboard', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Teacher Dashboard</title>
      <style>
        .container {
          text-align: center;
        }
        .btn-container {
          margin: 20px;
        }
        .btn {
          padding: 10px 20px;
          background-color: #5F7DEF;
          color: white;
          border: none;
          border-radius: 5px;
          cursor: pointer;
          margin: 10px;
          text-decoration: none;
        }
        .btn:hover {
          background-color: #3e4093;
        }
        .qr-code {
          margin: 20px;
        }
      </style>
      <script>
        // JavaScript part of your teacher dashboard HTML
        let currentClassName = 'ClassA'; // Initial class name

        function generateQRCode(className) {
          fetch('/generate-qr', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ className: className })
          })
          .then(response => response.json())
          .then(data => {
            const img = document.createElement('img');
            img.src = data.qrCode;
            document.getElementById('qrCodeContainer').innerHTML = ''; // Clear previous QR code
            document.getElementById('qrCodeContainer').appendChild(img);
            currentClassName = className; // Update current class name
          })
          .catch(error => console.error('Error generating QR code:', error));
        }

        // Function to refresh the QR code every 30 seconds
        function refreshQRCode() {
          generateQRCode(currentClassName); // Call generateQRCode with current class name
        }

        function initPage() {
          // Event listeners for buttons to change the class name
          document.getElementById('btnClassA').addEventListener('click', () => {
            generateQRCode('ClassA');
            setInterval(refreshQRCode, 30000);
          });

          document.getElementById('btnClassB').addEventListener('click', () => {
            generateQRCode('ClassB');
            setInterval(refreshQRCode, 30000);
          });
        }

        // JavaScript to fetch and set the client fingerprint
        // Using FingerprintJS library
        function setClientFingerprint() {
          FingerprintJS.load().then(fp => {
            fp.get().then(result => {
              const visitorId = result.visitorId;
              document.getElementById('clientFingerprint').value = visitorId;
            });
          });
        }

        // Function to initialize the page
        function initPage() {
          setClientFingerprint(); // Set initial client fingerprint
          refreshQRCode(); // Initial call to start refreshing
        }

        window.onload = initPage;
      </script>
    </head>
    <body>
      <div class="container">
        <h1>Teacher Dashboard</h1>
        <div class="btn-container">
          <button id="btnClassA" class="btn">Generate QR for Class A</button>
          <button id="btnClassB" class="btn">Generate QR for Class B</button>
        </div>
        <div class="qr-code" id="qrCodeContainer">
          <!-- QR code will be inserted here -->
        </div>
        <input type="hidden" id="clientFingerprint" name="clientFingerprint">
      </div>
    </body>
    </html>
  `);
});

// Endpoint to generate QR code based on class name
app.post('/generate-qr', (req, res) => {
  try {
    const className = req.body.className; // Get class name from request body
    if (className !== currentSession.className) {
      currentClassName = className; // Update global current class name
      currentSession.className = className;
      currentSession.timestamp = new Date();
      currentSession.tableName = `Department_${className}_${currentSession.timestamp.toISOString().replace(/[:.]/g, '-')}`;
      startQRCodeGenerationInterval(className); // Start generating QR code for new class
    }

    generateQRCode(className)
      .then(qrCode => {
        res.json({ qrCode: qrCode });
      })
      .catch(err => {
        console.error('Error generating QR code:', err);
        res.status(500).json({ error: 'Failed to generate QR code' });
      });
  } catch (error) {
    console.error('Error generating QR code:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Function to handle attendance submission
async function handleAttendanceSubmission(req) {
  const { name, usn, className, deviceFingerprint } = req.body;

  if (!name || !usn || !className || !deviceFingerprint) {
    throw new Error('Missing required fields');
  }

  try {
    // Store attendance data in PostgreSQL database
    const tableName = `Department_${className}_${new Date().toISOString().replace(/[:.]/g, '-')}`;
    const createTableQuery = `CREATE TABLE IF NOT EXISTS ${tableName} (id SERIAL PRIMARY KEY, name TEXT, usn TEXT, timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`;
    await client.query(createTableQuery);

    const insertAttendanceQuery = `INSERT INTO ${tableName} (name, usn) VALUES ($1, $2)`;
    const values = [name, usn];
    await client.query(insertAttendanceQuery, values);

    return 'Attendance submitted successfully';
  } catch (error) {
    console.error('Error handling attendance submission:', error);
    throw new Error('Failed to submit attendance');
  }
}

// Endpoint to handle attendance submission
app.post('/submit', async (req, res) => {
  try {
    const { name, usn, className, deviceFingerprint } = req.body;
    
    // Verify device fingerprint
    if (!verifyDeviceFingerprint(deviceFingerprint)) {
      throw new Error('Invalid device fingerprint');
    }

    const result = await handleAttendanceSubmission(req);
    res.status(200).send(result);
  } catch (error) {
    console.error('Error submitting attendance:', error);
    res.status(500).send('Failed to submit attendance');
  }
});

// Function to verify device fingerprint
function verifyDeviceFingerprint(fingerprint) {
  // Implement your verification logic here
  // For example, compare against a stored fingerprint
  return fingerprint === req.body.clientFingerprint; // Example: compare against stored fingerprint
}

// Initialize server
app.listen(port, localip, () => {
  console.log(`Server is running on http://${localip}:${port}`);
});
