const express = require('express');
const qr = require('qrcode');
const { Client } = require('pg');
const bodyParser = require('body-parser');
const Fingerprint2 = require('fingerprintjs2');

const app = express();
const port = process.env.PORT || 10000;

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

// Store device fingerprints in memory
const fingerprints = new Map();

// Endpoint to generate the QR code for the home page
app.get('/', async (req, res) => {
  try {
    console.log('Generating QR code for home page');
    await generateQRCode(res); // Call generateQRCode function to generate and send QR code to response
  } catch (error) {
    console.error('Error generating QR code:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Endpoint to fetch a new QR code
app.get('/new-qrcode', async (req, res) => {
  try {
    console.log('Generating new QR code');
    await generateQRCode(); // Generate new QR code data without sending it directly to response
    res.json({ success: true });
  } catch (error) {
    console.error('Error generating new QR code:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Endpoint to handle the QR code validation and show the form
app.get('/submit', async (req, res) => {
  try {
    const { fingerprint } = req.query;
    console.log('Received submit request with fingerprint:', fingerprint);

    if (!fingerprint || fingerprints.has(fingerprint)) {
      const existingUser = fingerprints.get(fingerprint);
      res.status(403).json({ error: 'Device fingerprint already submitted', user: existingUser });
    } else {
      res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Attendance Form</title>
          <link rel="icon" href="letter_logo.png" type="image/x-icon">
          <style>
            /* Add your CSS styles here */
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
        </head>
        <body>
          <form id="attendanceForm" action="/submit" method="post" onsubmit="return checkLocalStorage();">
            <h2>Attendance Form</h2>
            <label for="name">Your Name:</label>
            <input type="text" id="name" name="name" required>
            <label for="usn">USN:</label>
            <input type="text" id="usn" name="usn">
            <input type="hidden" id="fingerprint" name="fingerprint" value="${fingerprint}">
            <button type="submit">Submit</button>
          </form>
          <script>
            const TIME_LIMIT = 60 * 60 * 1000; // 1 hour in milliseconds

            function checkLocalStorage() {
              const formSubmitted = localStorage.getItem('formSubmitted');
              const submissionTime = localStorage.getItem('submissionTime');
              const currentTime = Date.now();

              if (formSubmitted && submissionTime) {
                const timeElapsed = currentTime - parseInt(submissionTime, 10);
                
                if (timeElapsed < TIME_LIMIT) {
                  alert('Form already submitted from this device. Please wait before submitting again.');
                  return false; // Prevent form submission
                } else {
                  // Time limit has passed, allow submission and update timestamp
                  localStorage.setItem('submissionTime', currentTime.toString());
                  return true; // Allow form submission
                }
              } else {
                // First submission or local storage is cleared
                localStorage.setItem('formSubmitted', 'true');
                localStorage.setItem('submissionTime', currentTime.toString());
                return true; // Allow form submission
              }
            }
          </script>
        </body>
        </html>
      `);
    }
  } catch (error) {
    console.error('Error handling submit request:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Endpoint to handle form submissions
app.post('/submit', async (req, res) => {
  try {
    const { name, usn, qrcode, deviceFingerprint } = req.body;
    const requestedQrCode = parseInt(qrcode);

    if (qrCodeCounter !== requestedQrCode) {
      res.send('Invalid request');
      return;
    }

    // Check if the device fingerprint already exists in the database
    const queryText = 'SELECT name FROM "FormSubmissions" WHERE device_fingerprint = $1';
    const { rows } = await client.query(queryText, [deviceFingerprint]);

    if (rows.length > 0) {
      const existingName = rows[0].name;
      res.status(403).send(`Device fingerprint already submitted by ${existingName}`);
      return;
    }

    // If device fingerprint doesn't exist, insert the new submission
    const currentTime = new Date();
    const insertQueryText = 'INSERT INTO "FormSubmissions" (name, usn, submission_time, device_fingerprint) VALUES ($1, $2, $3, $4)';
    const values = [name, usn, currentTime, deviceFingerprint];

    await client.query(insertQueryText, values);
    console.log(`Inserted data into PostgreSQL: ${name}, ${usn}, ${currentTime}, ${deviceFingerprint}`);

    res.send('Form submitted successfully');
  } catch (error) {
    console.error('Error handling form submission:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Function to generate QR code and send to response
async function generateQRCode(res) {
  try {
    const fingerprint = await getDeviceFingerprint();
    const qrCodeData = await qr.toDataURL(`Attendance code: ${fingerprint}`);
    if (res) {
      res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Attendance QR Code</title>
        </head>
        <body>
          <img src="${qrCodeData}" alt="QR Code">
        </body>
        </html>
      `);
    }
    return qrCodeData;
  } catch (error) {
    console.error('Error generating QR code:', error);
    throw error;
  }
}

// Function to retrieve device fingerprint using Fingerprint2 library
function getDeviceFingerprint() {
  return new Promise(resolve => {
    new Fingerprint2().get((result) => {
      resolve(result);
    });
  });
}

// Update QR code every 30 seconds
setInterval(async () => {
  try {
    await generateQRCode(); // Generate new QR code data
    console.log('QR code updated');
  } catch (error) {
    console.error('Error updating QR code:', error);
  }
}, 30000);

// Start the server
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
