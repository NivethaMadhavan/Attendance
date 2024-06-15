const express = require('express');
const qr = require('qrcode');
const ip = require('ip');
const { Client } = require('pg');
const bodyParser = require('body-parser');
const Fingerprint2 = require('fingerprintjs2');

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

// PostgreSQL database connection setup
const client = new Client({
  connectionString: connectionString
});

client.connect()
  .then(() => console.log('Connected to the database'))
  .catch(err => console.error('Error connecting to the database:', err));

// Initialize fingerprint generator
function generateDeviceFingerprint(req) {
  return new Promise((resolve, reject) => {
    Fingerprint2.get((components) => {
      const values = components.map(component => component.value);
      const fingerprint = Fingerprint2.x64hash128(values.join(''), 31);
      resolve(fingerprint);
    });
  });
}

// Endpoint to generate the QR code for the home page
app.get('/', async (req, res) => {
  try {
    console.log('Generating QR code for home page');
    await generateQRCode(res, req); // Pass req to generateQRCode to include fingerprint
  } catch (error) {
    console.error('Error generating QR code:', error);
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
    console.log(`Received submit request with qrcode: ${requestedQrCode}, current qrCodeCounter: ${qrCodeCounter}`);

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
          <title>Attendance</title>
          <link rel="icon" href="letter_logo.png" type="image/x-icon">
          <style>
            /* Your styles here */
          </style>
        </head>
        <body>
          <h2>Accepted! Enter details:</h2>
          <form id="attendanceForm" action="/submit" method="post">
            <label for="name">Your Name:</label>
            <input type="text" id="name" name="name" required>
            <label for="usn">USN:</label>
            <input type="text" id="usn" name="usn">
            <input type="hidden" id="qrcode" name="qrcode" value="${qrCodeCounter}">
            <input type="hidden" id="fingerprint" name="fingerprint" value="${fingerprint}">
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
        </html>
      `);
      console.log('End: qrCodeCounter:', qrCodeCounter);
    }
  } catch (error) {
    console.error('Error processing submit request:', error);
    res.status(500).send('Internal Server Error');
  }
});

// POST route handler for form submission
app.post('/submit', (req, res) => {
  console.log('Request body:', req.body);
  try {
    const requestedQrCode = parseInt(req.body.qrcode);
    console.log(`Received submit request with qrcode: ${requestedQrCode}, current qrCodeCounter: ${qrCodeCounter}`);

    const deviceFingerprint = req.body.fingerprint;

    if (qrCodeCounter === requestedQrCode) {
      // Check if the fingerprint is already in the table
      const checkQuery = 'SELECT COUNT(*) AS count FROM "FormSubmissions" WHERE device_fingerprint = $1';
      client.query(checkQuery, [deviceFingerprint], (checkError, checkResults) => {
        if (checkError) {
          console.error('Error checking fingerprint:', checkError);
          res.status(500).send('Internal Server Error');
          return;
        }
        const count = checkResults.rows[0].count;
        if (count > 0) {
          // Fingerprint already submitted
          console.log('Form submission rejected: Device fingerprint already submitted');
          res.send('Form submission rejected: Device fingerprint already submitted');
        } else {
          // Extract form data from the request
          const { name, usn } = req.body;

          // Insert the form data into the database
          const insertQuery = 'INSERT INTO "FormSubmissions" (name, usn, device_fingerprint) VALUES ($1, $2, $3)';
          client.query(insertQuery, [name, usn, deviceFingerprint], (insertError, insertResults) => {
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

// Function to generate the QR code
async function generateQRCode(res = null, req) {
  return new Promise((resolve, reject) => {
    const randomComponent = Math.floor(Math.random() * 1000);
    const timestamp = new Date().getTime();
    const cloudURL = `https://attendance-4au9.onrender.com/submit`; // Replace with your cloud URL
    const qrCodeData = `${cloudURL}?qrcode=${qrCodeCounter}&timestamp=${timestamp}_${randomComponent}`;

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
                </html>
              `);
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


// Update QR code counter and generate a new QR code every 30 seconds
setInterval(async () => {
  qrCodeCounter++;
  console.log(`QR code counter updated to: ${qrCodeCounter}`);
  await generateQRCode(); // Generate QR code with no response needed
}, 30000);

// Start the server
app.listen(port, '0.0.0.0', () => {
  console.log(`Server is running at http://${localip}:${port}`);
});

 
