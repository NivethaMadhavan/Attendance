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
async function generateQRCode(className = '', res = null, req = null) {
  const randomComponent = Math.floor(Math.random() * 1000);
  const timestamp = new Date().getTime();
  const cloudURL = `https://attendance-4au9.onrender.com/submit`;
  const qrCodeData = `${cloudURL}?qrcode=${qrCodeCounter}&timestamp=${timestamp}_${randomComponent}&className=${className}`;

  return new Promise((resolve, reject) => {
    qr.toDataURL(qrCodeData, { errorCorrectionLevel: 'H' }, (err, qrCode) => {
      if (err) {
        console.error(`Error generating QR code:`, err);
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
          resolve(); // Ensure the Promise is resolved
        } else {
          resolve(qrCode);
        }
      }
    });
  });
}

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
        <img src="${qrCode}?cb=${new Date().getTime()}" alt="QR Code ${qrCodeCounter}" />
        <script>
          setTimeout(() => { window.location.reload() }, 30000); // Reload every 40 seconds
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
  // Replace with actual class list retrieval logic if needed
  const classes = ['Class A', 'Class B', 'Class C'];

  let classButtons = classes.map(className => 
    `<button class="btn" onclick="generateQRCode('${className}')">Generate QR for ${className}</button>`
  ).join('');

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
    const qrCodeData = await generateQRCode(className); // Call function to generate QR code with className
    res.json({ qrCode: qrCodeData }); // Send generated QR code as JSON response
  } catch (error) {
    console.error(`Error generating QR code:`, error);
    res.status(500).send('Internal Server Error');
  }
});

// Endpoint to generate the QR code for the home page
app.get('/qr-code', async (req, res) => {
  try {
    console.log(`Generating QR code for QR code page`);
    await generateQRCode(res, req);
  } catch (error) {
    console.error(`Error generating QR code:`, error);
    res.status(500).send('Internal Server Error');
  }
});

// Endpoint to fetch a new QR code
app.get('/new-qrcode', async (req, res) => {
  try {
    console.log(`Generating new QR code`);
    const qrCodeData = await generateQRCode(null, req);
    res.json({ qrCodeData });
  } catch (error) {
    console.error(`Error generating new QR code:`, error);
    res.status(500).send('Internal Server Error');
  }
});

// Endpoint to handle the QR code validation and show the form
app.get('/submit', async (req, res) => {
  try {
    const requestedQrCode = parseInt(req.query.qrcode);
    const className = req.query.className; // Get className from query

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
                    <link rel="icon" href="data:,">
          <style>
            body {
              font-family: Arial, sans-serif;
              background-color: #f0f0f0;
              text-align: center;
              padding: 50px;
            }
            h1 {
              margin-bottom: 20px;
            }
            .container {
              max-width: 600px;
              margin: 0 auto;
              background-color: #fff;
              border-radius: 8px;
              box-shadow: 0 0 10px rgba(0,0,0,0.1);
              padding: 20px;
            }
            .form-group {
              margin-bottom: 20px;
              text-align: left;
            }
            .form-group label {
              display: block;
              font-weight: bold;
              margin-bottom: 5px;
            }
            .form-group input[type="text"] {
              width: calc(100% - 12px);
              padding: 8px;
              font-size: 16px;
              border: 1px solid #ccc;
              border-radius: 4px;
            }
            .form-group input[type="submit"] {
              background-color: #5F7DEF;
              color: white;
              border: none;
              border-radius: 4px;
              padding: 10px 20px;
              font-size: 16px;
              cursor: pointer;
            }
            .form-group input[type="submit"]:hover {
              background-color: #3e4093;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>Attendance Form</h1>
            <form action="/submit-attendance" method="post">
              <input type="hidden" name="qrcode" value="${requestedQrCode}">
              <input type="hidden" name="className" value="${className}">
              <div class="form-group">
                <label for="studentName">Student Name:</label>
                <input type="text" id="studentName" name="studentName" required>
              </div>
              <div class="form-group">
                <input type="submit" value="Submit Attendance">
              </div>
            </form>
          </div>
        </body>
        </html>
      `);
    }
  } catch (error) {
    console.error(`Error handling QR code submission:`, error);
    res.status(500).send('Internal Server Error');
  }
});

// Endpoint to handle attendance submission
app.post('/submit-attendance', async (req, res) => {
  try {
    const { qrcode, className, studentName } = req.body;
    const timestamp = new Date().toISOString();
    const query = {
      text: 'INSERT INTO attendance (qrcode, class_name, student_name, timestamp) VALUES ($1, $2, $3, $4)',
      values: [qrcode, className, studentName, timestamp],
    };
    await client.query(query);
    res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Attendance Submitted</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            background-color: #f0f0f0;
            text-align: center;
            padding: 50px;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            background-color: #fff;
            border-radius: 8px;
            box-shadow: 0 0 10px rgba(0,0,0,0.1);
            padding: 20px;
          }
          h1 {
            margin-bottom: 20px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Attendance Submitted</h1>
          <p>Thank you, ${studentName}, for submitting your attendance for ${className}.</p>
        </div>
      </body>
      </html>
    `);
  } catch (error) {
    console.error(`Error submitting attendance:`, error);
    res.status(500).send('Internal Server Error');
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running on http://${localip}:${port}`);
});

