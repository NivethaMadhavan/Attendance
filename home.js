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
              <style>
                /* Add your CSS styles here */
              </style>
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
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Home</title>
      <style>
        /* Add your CSS styles here */
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
        /* Add your CSS styles here */
      </style>
    </head>
    <body>
      <div class="container">
        <h1>Teacher Dashboard</h1>
        <div class="btn-container">
          <button class="btn" onclick="generateQRCode('ClassA')">Generate QR for Class A</button>
          <button class="btn" onclick="generateQRCode('ClassB')">Generate QR for Class B</button>
          <a href="/qr-code" class="btn" target="_blank">QR Generation</a>
        </div>
        <div class="qr-code" id="qrCodeContainer">
          <!-- QR code will be inserted here -->
        </div>
      </div>
      <script>
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
          })
          .catch(error => console.error('Error generating QR code:', error));
        }
      </script>
    </body>
    </html>
  `);
});

// Endpoint to generate QR code based on class name
app.post('/generate-qr', async (req, res) => {
  try {
    const className = req.body.className; // Get class name from request body
    const qrCodeData = await generateQRCode(className); // Call function to generate QR code
    res.json({ qrCode: qrCodeData }); // Send generated QR code as JSON response
  } catch (error) {
    console.error('Error generating QR code:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Endpoint to generate the QR code for the QR code page
app.get('/qr-code', async (req, res) => {
  try {
    console.log('Generating QR code for QR code page');
    await generateQRCode(res, req);
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
            /* Add your CSS styles here */
          </style>
        </head>
        <body>
          <form action="/submit" method="post">
            <label for="name">Name:</label><br>
            <input type="text" id="name" name="name"><br>
            <label for="message">Message:</label><br>
            <textarea id="message" name="message"></textarea><br><br>
            <button type="submit">Submit</button>
          </form>
        </body>
        </html>
      `);
    }
  } catch (error) {
    console.error('Error handling submit:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Endpoint to handle the form submission
app.post('/submit', async (req, res) => {
  try {
    const { name, message } = req.body;
    console.log(`Received submission: Name - ${name}, Message - ${message}`);
    res.send('Form submitted successfully!');
  } catch (error) {
    console.error('Error submitting form:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running on http://${localip}:${port}`);
});
