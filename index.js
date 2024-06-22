const express = require('express');
const qr = require('qrcode');
const bodyParser = require('body-parser');
const { Client } = require('pg');
const ip = require('ip');
const Fingerprint2 = require('@fingerprintjs/fingerprintjs');
const path = require('path'); // Node.js module to handle file paths

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

const connectionString = process.env.DATABASE_URI_INTERNAL; // Replace with your actual PostgreSQL database URL

// PostgreSQL database connection setup
const client = new Client({
  connectionString: connectionString,
});

client.connect()
  .then(() => console.log('Connected to the database'))
  .catch(err => console.error('Error connecting to the database:', err));

// Initialize fingerprint generator
async function generateDeviceFingerprint(req) {
  const components = await Fingerprint2.getPromise();
  const values = components.map(component => component.value);
  const fingerprint = Fingerprint2.x64hash128(values.join(''), 31);
  return fingerprint;
}

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Endpoint to serve index.html for the root route
app.get('/', async (req, res) => {
  try {
    console.log('Serving index.html');
    res.sendFile(path.join(__dirname, 'index.html'));
  } catch (error) {
    console.error('Error serving index.html:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Endpoint to serve teacher-dashboard.html for the /teacher-dashboard route
app.get('/teacher-dashboard', async (req, res) => {
  try {
    console.log('Serving teacher-dashboard.html');
    res.sendFile(path.join(__dirname, 'teacher-dashboard.html'));
  } catch (error) {
    console.error('Error serving teacher-dashboard.html:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Endpoint to serve generate-qr.html for the /generate-qr route
app.get('/generate-qr', async (req, res) => {
  try {
    console.log('Serving generate-qr.html');
    res.sendFile(path.join(__dirname, 'generate-qr.html'));
  } catch (error) {
    console.error('Error serving generate-qr.html:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Endpoint to fetch a new QR code
app.get('/new-qrcode', async (req, res) => {
  try {
    console.log('Generating new QR code');
    const qrCodeData = await generateQRCode(null, req); // Pass req to generateQRCode
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
    console.log('Received submit request with qrcode: ${requestedQrCode}, current qrCodeCounter: ${qrCodeCounter}');

    if (qrCodeCounter !== requestedQrCode) {
      res.send('Rejected');
    } else {
      // Generate device fingerprint and render form
      const fingerprint = await generateDeviceFingerprint(req);
      res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Attendance Form</title>
        </head>
        <body>
          <h2>Accepted! Enter details:</h2>
          <form id="attendanceForm" action="/submit-form" method="post">
            <label for="name">Your Name:</label>
            <input type="text" id="name" name="name" required>
            <label for="usn">USN:</label>
            <input type="text" id="usn" name="usn">
            <input type="hidden" id="qrcode" name="qrcode" value="${qrCodeCounter}">
            <input type="hidden" id="clientFingerprint" name="clientFingerprint" value="${fingerprint}">
            <button type="submit">Submit</button>
          </form>
          <div>
            <h1>Scan the QR code</h1>
            <img id="qrCodeImage" src="" alt="QR Code">
          </div>
          <script>
            function fetchNewQRCode() {
              fetch('/new-qrcode')
                .then(response => response.json())
                .then(data => {
                  document.getElementById('qrCodeImage').src = data.qrCodeData;
                })
                .catch(error => console.error('Error fetching new QR code:', error));
            }
            setInterval(fetchNewQRCode, 30000); // Fetch a new QR code every 30 seconds
            fetchNewQRCode(); // Initial fetch
          </script>
        </body>
        </html>`
      );
      console.log('End: qrCodeCounter:', qrCodeCounter);
    }
  } catch (error) {
    console.error('Error processing submit request:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Endpoint to handle form submission
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

// Function to generate the QR code
async function generateQRCode(res = null, req) {
  return new Promise((resolve, reject) => {
    const randomComponent = Math.floor(Math.random() * 1000);
    const timestamp = new Date().getTime();
    const cloudURL = 'https://attendance-4au9.onrender.com/submit'; // Replace with your cloud URL
    const qrCodeData = ${cloudURL}?qrcode=${qrCodeCounter}&timestamp=${timestamp}_${randomComponent};

    qr.toDataURL(qrCodeData, { errorCorrectionLevel: 'H' }, (err, qrCode) => {
      if (err) {
        console.error('Error generating QR code:', err);
        if (res) {
          res.status(500).send('Internal Server Error');
        }
        reject(err);
      } else {
        console.log('Generated QR code with data: ${qrCodeData}');
        if (res) {
          // Generate device fingerprint and send the HTML response
          generateDeviceFingerprint(req)
            .then(fingerprint => {
              res.send(`
                <!DOCTYPE html>
                <html lang="en">
                <head>
                  <meta charset="UTF-8">
                  <meta name="viewport" content="width=device-width, initial-scale=1.0">
                  <title>QR Code</title>
                </head>
                <body>
                  <h1>Scan the QR code</h1>
                  <img id="qrCodeImage" src="${qrCode}" alt="QR Code">
                  <script>
                    function fetchNewQRCode() {
                      fetch('/new-qrcode')
                        .then(response => response.json())
                        .then(data => {
                          document.getElementById('qrCodeImage').src = data.qrCodeData;
                        })
                        .catch(error => console.error('Error fetching new QR code:', error));
                    }
                    setInterval(fetchNewQRCode, 30000); // Fetch a new QR code every 30 seconds
                    fetchNewQRCode(); // Initial fetch
                  </script>
                </body>
                </html>`
              );
            })
            .catch(error => {
              console.error('Error generating fingerprint:', error);
              res.status(500).send('Internal Server Error');
            });
        } else {
          resolve(qrCode);
        }
      }
    });
  });
}
// Function to periodically generate new QR code
function generateQRCodePeriodically() {
  setInterval(() => {
    qrCodeCounter++;
    console.log('QR code counter updated to: ${qrCodeCounter}');
    generateQRCode(); // Generate QR code without sending a response
  }, 30000); // Generate a new QR code every 30 seconds
}

// Start the periodic QR code generation
generateQRCodePeriodically();

// Start the server
app.listen(port, () => {
  console.log('Server is running at http://${localip}:${port}');
});

