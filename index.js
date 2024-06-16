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
async function generateQRCode(res = null, req = null) {
  const randomComponent = Math.floor(Math.random() * 1000);
  const timestamp = new Date().getTime();
  const cloudURL = `https://attendance-4au9.onrender.com/submit`;
  const qrCodeData = `${cloudURL}?qrcode=${qrCodeCounter}&timestamp=${timestamp}_${randomComponent}`;

  return new Promise((resolve, reject) => {
    qr.toDataURL(qrCodeData, { errorCorrectionLevel: 'H' }, (err, qrCode) => {
      if (err) {
        console.error('Error generating QR code:', err);
        if (res) {
          res.status(500).send('Internal Server Error');
        }
        reject(err);
      } else {
        console.log(`Generated QR code with data: ${qrCodeData}`);
        if (res) {
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
            </html>
          `);
        } else {
          resolve(qrCode);
        }
      }
    });
  });
}

// Endpoint to generate the QR code for the home page
app.get('/', async (req, res) => {
  try {
    console.log('Generating QR code for home page');
    await generateQRCode(res, req);
    qrCodeCounter++;
  } catch (error) {
    console.error('Error generating QR code:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Endpoint to fetch a new QR code
app.get('/new-qrcode', async (req, res) => {
  try {
    console.log('Generating new QR code');
    const qrCodeData = await generateQRCode(null, req);
    qrCodeCounter++;
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
            <input type="text" id="usn" name="usn">
            <input type="hidden" id="qrcode" name="qrcode" value="${qrCodeCounter}">
            <input type="hidden" id="clientFingerprint" name="clientFingerprint">
            <button type="submit">Submit</button>
          </form>
          <script>
            async function generateFingerprint() {
              const fp = await FingerprintJS.load();
              const result = await fp.get();
              document.getElementById('clientFingerprint').value = result.visitorId;
            }
            generateFingerprint();
          </script>
        </body>
        </html>
      `);
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
  setInterval(async () => {
    try {
      console.log('Generating new QR code periodically',qrCodeCounter);
      await generateQRCode();
      qrCodeCounter++;
    } catch (error) {
      console.error('Error generating QR code periodically:', error);
    }
  }, 30000); // Generate a new QR code every 30 seconds
}

// Start the periodic QR code generation
generateQRCodePeriodically();

app.listen(port, localip, () => {
  console.log(`Server is running on http://${localip}:${port}`);
});
