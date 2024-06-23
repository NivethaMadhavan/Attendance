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
    console.log(`QR code counter updated to: ${qrCodeCounter} for class: ${className}`);
    // You can store the latest QR code data in a cache or a database if needed
  }, 30000);

  res.send(`Started generating QR codes for class ${className}`);
});

app.get('/latest-qr-code', async (req, res) => {
  try {
    const qrCode = await generateQRCode();
    res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Latest QR Code</title>
        <style>
          body {
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            background-color: #f0f0f0;
          }
          img {
            border: 2px solid #000;
            padding: 10px;
            background-color: #fff;
          }
        </style>
      </head>
      <body>
        <img src="${qrCode}" alt="QR Code ${qrCodeCounter}" />
        <script>
          setTimeout(() => { window.location.reload() }, 30000); // Reload every 30 seconds
        </script>
      </body>
      </html>`
    );
  } catch (error) {
    console.error('Error generating QR code:', error);
    res.status(500).send('Internal Server Error');
  }
});


// Endpoint to generate the QR code for the home page
// Route to the home page
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
    </html>`
  );
});

// Route to redirect to Teacher Dashboard
app.get('/teacher-dashboard', (req, res) => {
  // Replace with actual class list retrieval logic if needed
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
      // Optionally, update the UI to show that QR code generation has started
    })
    .catch(error => console.error('Error starting QR code generation:', error));
  }
</script>

</body>
</html>`

  );
});


// Endpoint to generate QR code based on class name
// Endpoint to generate QR code based on class name
// Endpoint to generate QR code based on class name
app.post('/generate-qr', async (req, res) => {
  try {
    const className = req.body.className; // Get class name from request body
    const qrCodeData = await generateQRCode(className); // Call function to generate QR code with className
    res.json({ qrCode: qrCodeData }); // Send generated QR code as JSON response
  } catch (error) {
    console.error('Error generating QR code:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Endpoint to generate the QR code for the home page
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
  try {
    const requestedQrCode = parseInt(req.query.qrcode);
    const className = req.query.className;
    const timestamp = parseInt(req.query.timestamp);

    const currentTime = new Date().getTime();
    const isValidTime = currentTime - timestamp <= 30000; // 30 seconds

    if (qrCodeCounter === requestedQrCode && isValidTime) {
      res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Attendance</title>
          <link rel="icon" href="letter_logo.png" type="image/x-icon">
          <style>
            /* Your existing styles */
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
            FingerprintJS.load().then(fp => {
              fp.get().then(result => {
                const visitorId = result.visitorId;
                document.getElementById('clientFingerprint').value = visitorId;
              });
            });
          </script>
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
      res.status(400).send('Bad Request: Missing client fingerprint');
      return;
    }

    if (qrCodeCounter === requestedQrCode) {
      // Create the table if it doesn't exist
      const createTableQuery = 
        `CREATE TABLE IF NOT EXISTS "${tableName}" (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255),
          usn VARCHAR(255),
          device_fingerprint VARCHAR(255)
        )`
      ;
      await client.query(createTableQuery);

      // Check if the fingerprint is already in the table
      const checkQuery = `SELECT COUNT(*) AS count FROM "${tableName}" WHERE device_fingerprint = $1`;
      const checkResult = await client.query(checkQuery, [clientFingerprint]);

      if (checkResult.rows[0].count > 0) {
        res.send('Form submission rejected: Fingerprint already submitted');
      } else {
        const insertQuery = `INSERT INTO "${tableName}" (name, usn, device_fingerprint) VALUES ($1, $2, $3)`;
        await client.query(insertQuery, [name, usn, clientFingerprint]);
        res.send('Form submitted successfully');
      }
    } else {
      res.send('Form submission rejected: QR code mismatch');
      console.log(`Reacieved qr code : "${requestedQrCode}", Current qr code : "${qrCodeCounter}"`);
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
    generateQRCode(); // Generate QR code without sending a response
  }, 30000); // Generate a new QR code every 30 seconds
}

// Start the periodic QR code generation
generateQRCodePeriodically();

app.listen(port, '0.0.0.0', () => {
  console.log(`Server is running on http://0.0.0.0:${port}`);
});
