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
        console.error('Error generating QR code:', err);
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
          setTimeout(() => { window.location.reload() }, 40000); // Reload every 40 seconds
        </script>
      </body>
      </html>
    `);
  } catch (error) {
    console.error('Error generating QR code:', error);
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

  let classButtons = classes.map(className => `
    <button class="btn" onclick="generateQRCode('${className}')">Generate QR for ${className}</button>
  `).join('');

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
      ${classButtons}
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
          <title>Submit Form</title>
          <style>
                    .container {
            text-align: center;
            margin-top: 50px;
          }
          .form-container {
            max-width: 400px;
            margin: auto;
            padding: 20px;
            background: #f9f9f9;
            border-radius: 8px;
            box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
          }
          .form-group {
            margin-bottom: 20px;
          }
          .form-group label {
            display: block;
            font-weight: bold;
            margin-bottom: 5px;
          }
          .form-group input {
            width: calc(100% - 20px);
            padding: 8px;
            border: 1px solid #ccc;
            border-radius: 4px;
            font-size: 16px;
          }
          .form-group textarea {
            width: calc(100% - 20px);
            padding: 8px;
            border: 1px solid #ccc;
            border-radius: 4px;
            font-size: 16px;
          }
          .form-group button {
            background-color: #5F7DEF;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 5px;
            cursor: pointer;
            font-size: 16px;
          }
          .form-group button:hover {
            background-color: #3e4093;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="form-container">
            <h2>Submit Attendance</h2>
            <form action="/submit" method="post">
              <div class="form-group">
                <label for="studentName">Student Name</label>
                <input type="text" id="studentName" name="studentName" required>
              </div>
              <div class="form-group">
                <label for="attendanceStatus">Attendance Status</label>
                <select id="attendanceStatus" name="attendanceStatus" required>
                  <option value="Present">Present</option>
                  <option value="Absent">Absent</option>
                </select>
              </div>
              <div class="form-group">
                <label for="comments">Comments (if any)</label>
                <textarea id="comments" name="comments" rows="4"></textarea>
              </div>
              <input type="hidden" name="className" value="${className}">
              <input type="hidden" name="timestamp" value="${req.query.timestamp}">
              <input type="hidden" name="qrcode" value="${requestedQrCode}">
              <div class="form-group">
                <button type="submit">Submit</button>
              </div>
            </form>
          </div>
        </div>
      </body>
      </html>
      `);
    }
  } catch (error) {
    console.error('Error processing QR code submission:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Endpoint to handle form submission
app.post('/submit', async (req, res) => {
  try {
    const { studentName, attendanceStatus, comments, className, timestamp, qrcode } = req.body;

    // Insert data into database
    const query = {
      text: 'INSERT INTO attendance (student_name, attendance_status, comments, class_name, timestamp, qrcode) VALUES ($1, $2, $3, $4, $5, $6)',
      values: [studentName, attendanceStatus, comments, className, timestamp, qrcode],
    };

    await client.query(query);
    console.log(`Attendance submitted for ${studentName} in ${className}`);

    res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Attendance Submitted</title>
        <style>
          .container {
            text-align: center;
            margin-top: 50px;
          }
          .message-container {
            max-width: 400px;
            margin: auto;
            padding: 20px;
            background: #f9f9f9;
            border-radius: 8px;
            box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
          }
          .message-container h2 {
            margin-bottom: 20px;
          }
          .message-container p {
            font-size: 18px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="message-container">
            <h2>Attendance Submitted</h2>
            <p>Thank you, ${studentName}, for submitting your attendance for ${className}.</p>
          </div>
        </div>
      </body>
      </html>
    `);
  } catch (error) {
    console.error('Error submitting attendance:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Start server
app.listen(port, () => {
  console.log(`Server is running on http://${localip}:${port}`);
});

