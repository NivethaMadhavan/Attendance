const express = require('express');
const qr = require('qrcode');
const ip = require('ip');
const mysql = require('mysql');
const bodyParser = require('body-parser');

const app = express();
const port = process.env.PORT || 3050;
const localip = ip.address();
let qrCodeCounter = 0;

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// MySQL database connection setup
const connection = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
});

connection.connect(error => {
  if (error) {
    console.error('Error connecting to the database:', error);
    return;
  }
  console.log('Connected to the MySQL database.');
});

// Endpoint to generate the QR code for the home page
app.get('/', async (req, res) => {
  try {
    console.log('Generating QR code for home page');
    await generateQRCode(res);
  } catch (error) {
    console.error('Error generating QR code:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Endpoint to handle the QR code validation and show the form
app.get('/submit', async (req, res) => {
  console.log('start: qrCodeCounter:', qrCodeCounter);
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
      </head>
      <body>
        <form id="hire_now" action="/submit" method="post">
          <h2>Accepted! Enter details:</h2>
          <label for="name">Your Name:</label>
          <input type="text" id="name" name="name" required>
          <label for="usn">USN:</label>
          <input type="text" id="usn" name="usn">
          <input type="hidden" id="qrcode" name="qrcode" value="${qrCodeCounter}">
          <button type="submit">Submit</button>
        </form>
        <script>
          function updateQRCodeValue() {
            console.log("Start");
          }
          updateQRCodeValue();
        </script>
      </body>
      </html>
      `);
      console.log('end: qrCodeCounter:', qrCodeCounter);
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

    if (qrCodeCounter === requestedQrCode) {
      const clientIp = req.ip;
      // Check if the IP address is already in the table
      const checkQuery = 'SELECT COUNT(*) AS count FROM FormSubmissions WHERE ip_address = ?';
      connection.query(checkQuery, [clientIp], (checkError, checkResults) => {
        if (checkError) {
          console.error('Error checking IP address:', checkError);
          res.status(500).send('Internal Server Error');
          return;
        }
        const count = checkResults[0].count;
        if (count > 0) {
          // IP address already submitted
          console.log('Form submission rejected: IP address already submitted');
          res.send('Form submission rejected: IP address already submitted');
        } else {
          // Extract form data from the request
          const { name, usn } = req.body;

          // Insert the form data into the database
          const insertQuery = 'INSERT INTO FormSubmissions (name, usn, ip_address) VALUES (?, ?, ?)';
          connection.query(insertQuery, [name, usn, clientIp], (insertError, insertResults) => {
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
async function generateQRCode(res = null) {
  return new Promise((resolve, reject) => {
    const randomComponent = Math.floor(Math.random() * 1000);
    const timestamp = new Date().getTime();
    const fixedURL = `http://${localip}:${port}/submit`;
    const qrCodeData = `${fixedURL}?qrcode=${qrCodeCounter}&timestamp=${timestamp}_${randomComponent}`;

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
          setTimeout(() => {
            let html = `
              <html>
                <script>
                  function msg(text) {
                    console.log(text);
                  }
                  setTimeout(() => { window.location.reload() }, 40000);
                </script>
                <body onload='msg("QR Code Loaded")'>
                  <img src="${qrCode}" alt="QR Code ${qrCodeCounter}" />
                </body>
              </html>
            `;
            res.send(html);
            resolve();
          }, 1000); // Added a slight delay for response
        } else {
          resolve();
        }
      }
    });
  });
}

// Update QR code counter and generate new QR code every 30 seconds
setInterval(() => {
  qrCodeCounter++;
  console.log(`QR code counter updated to: ${qrCodeCounter}`);
  generateQRCode(); // Generate QR code without sending a response
}, 30000);

app.listen(port, () => console.log(`Server running on http://${localip}:${port}`));
