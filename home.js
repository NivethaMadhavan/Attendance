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

        function initPage(){
          setClientFingerprint(); // Set initial client fingerprint
          refreshQRCode(); // Initial call to start refreshing

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
        
        function initPage2() {
          setClientFingerprint(); // Set initial client fingerprint
          refreshQRCode(); // Initial call to start refreshing
        }

        function setClientFingerprint() {
          // JavaScript to fetch and set the client fingerprint
          // Using FingerprintJS library
          FingerprintJS.load().then(fp => {
            fp.get().then(result => {
              const visitorId = result.visitorId;
              document.getElementById('clientFingerprint').value = visitorId;
            });
          });
        }
      </script>
    </head>
    <body onload="initPage(); initPage2();">
      <div class="container">
        <h1>Teacher Dashboard</h1>
        <div class="btn-container">
          <button id="btnClassA" class="btn">Generate QR for Class A</button>
          <button id="btnClassB" class="btn">Generate QR for Class B</button>
        </div>
        <div class="qr-code" id="qrCodeContainer">
          <!-- QR code will be inserted here -->
        </div>
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
      currentClassName = className;
      startQRCodeGenerationInterval(className);
      currentSession.className = className;
      currentSession.timestamp = new Date();
    }
    generateQRCode(className).then(qrCode => {
      res.json({ qrCode: qrCode });
    }).catch(error => {
      console.error('Error generating QR code:', error);
      res.status(500).json({ error: 'Error generating QR code' });
    });
  } catch (error) {
    console.error('Error in /generate-qr route:', error);
    res.status(500).json({ error: 'Error processing request' });
  }
});

// Endpoint to handle /submit
app.post('/submit', (req, res) => {
  const { qrCodeCounter, timestamp, fingerprint } = req.body;

  const className = currentClassName;
  const tableName = `attendance_${className.toLowerCase()}`;
  
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS ${tableName} (
      id SERIAL PRIMARY KEY,
      qrCodeCounter INT,
      timestamp VARCHAR(255),
      fingerprint VARCHAR(255)
    )
  `;
  
  const insertDataQuery = `
    INSERT INTO ${tableName} (qrCodeCounter, timestamp, fingerprint)
    VALUES ($1, $2, $3)
  `;

  client.query(createTableQuery)
    .then(() => {
      return client.query(insertDataQuery, [qrCodeCounter, timestamp, fingerprint]);
    })
    .then(() => {
      console.log(`Inserted data into ${tableName}`);
      res.status(200).send('Data received and stored successfully');
    })
    .catch(error => {
      console.error('Error inserting data:', error);
      res.status(500).send('Error storing data');
    });
});

// Start the server
app.listen(port, () => {
  console.log(`Server running on http://${localip}:${port}`);
});
