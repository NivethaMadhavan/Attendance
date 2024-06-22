const express = require('express');
const qr = require('qrcode');
const bodyParser = require('body-parser');
const { Client } = require('pg');
const ip = require('ip');

const app = express();
let port = parseInt(process.env.PORT, 10) || 10001; // Use a different port if running simultaneously with another service

const localip = ip.address();
const connectionString = process.env.DATABASE_URL;

const client = new Client({
  connectionString: connectionString,
});

client.connect()
  .then(() => console.log('Connected to the database'))
  .catch(err => console.error('Error connecting to the database:', err));

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

async function generateQRCode(sessionData) {
  const randomComponent = Math.floor(Math.random() * 1000);
  const timestamp = new Date().getTime();
  const cloudURL = `https://attendance-4au9.onrender.com/submit`;
  const qrCodeData = `${cloudURL}?qrcode=${sessionData.qrCodeCounter}&timestamp=${timestamp}_${randomComponent}&class=${sessionData.className}&date=${sessionData.date}&time=${sessionData.time}`;

  return new Promise((resolve, reject) => {
    qr.toDataURL(qrCodeData, { errorCorrectionLevel: 'H' }, (err, qrCode) => {
      if (err) {
        console.error('Error generating QR code:', err);
        reject(err);
      } else {
        resolve(qrCode);
      }
    });
  });
}

app.get('/teacher-dashboard', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Teacher Dashboard</title>
    </head>
    <body>
      <h1>Teacher Dashboard</h1>
      <div>
        <button onclick="generateQRCode('ClassA')">Generate QR for Class A</button>
        <button onclick="generateQRCode('ClassB')">Generate QR for Class B</button>
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
            document.body.appendChild(img);
          })
          .catch(error => console.error('Error generating QR code:', error));
        }
      </script>
    </body>
    </html>
  `);
});

app.post('/generate-qr', async (req, res) => {
  try {
    const { className } = req.body;
    const sessionData = {
      qrCodeCounter: Math.floor(Math.random() * 10000), // This should be replaced with a proper counter logic
      className: className,
      date: new Date().toISOString().split('T')[0], // YYYY-MM-DD
      time: new Date().toTimeString().split(' ')[0] // HH:MM:SS
    };
    const qrCode = await generateQRCode(sessionData);
    res.json({ qrCode: qrCode });
  } catch (error) {
    console.error('Error generating QR code:', error);
    res.status(500).send('Internal Server Error');
  }
});

app.listen(port, () => {
  console.log(`Teacher service is running on http://${localip}:${port}`);
});
