const express = require('express');
const qr = require('qrcode');
const ip = require('ip');
const app = express();
const port = 3050;
const localip = ip.address();
let qrCodeCounter = 0;
const bodyParser = require('body-parser');
app.use(bodyParser.urlencoded({ extended: false }));


// Parse application/json
app.use(bodyParser.json());

app.get('/', async (req, res) => {
  try {
    console.log('Generating QR code for home page');
    const qrCode = await generateQRCode(res);
  } catch (error) {
    console.error('Error generating QR code:', error);
    res.status(500).send('Internal Server Error');
  }
});

app.get('/submit', async (req, res) => {
  console.log('start: qrCodeCounter:', qrCodeCounter);
  try {
    const requestedQrCode = parseInt(req.query['qrcode']);
    console.log(`Received submit request with qrcode: ${requestedQrCode}, current qrCodeCounter: ${qrCodeCounter}`);
    
    if (qrCodeCounter !== requestedQrCode) {
      res.send("Rejected");
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
<form id="hire_now" action="/submit" method="post"> <!-- Updated action to POST endpoint -->
    <h2>Accepted! Enter details:</h2>
    <label for="name">Your Name:</label>
    <input type="text" id="name" name="name" required>
    <label for="email">Your Email:</label>
    <input type="email" id="email" name="email" required>
    <label for="project">Project Description:</label>
    <textarea id="project" name="project" rows="4" required></textarea>
    <label for="budget">Budget (if any):</label>
    <input type="text" id="budget" name="budget">
    <label for="timeline">Timeline (if any):</label>
    <input type="text" id="timeline" name="timeline">


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
    const requestedQrCode = parseInt(req.body['qrcode']); // Retrieve from request body, not query
    console.log(`Received submit request with qrcode: ${requestedQrCode}, current qrCodeCounter: ${qrCodeCounter}`);
    console.log(typeof(qrCodeCounter),typeof(requestedQrCode));
    
    const currentTime = new Date().getTime();
    const tenSecondsAgo = currentTime - 60000;

    if (qrCodeCounter === requestedQrCode) {
      // Form submitted within 10 seconds and QR code matches
      // Extract form data from the request
      const name = req.body.name;
      const email = req.body.email;
      const project = req.body.project;
      const budget = req.body.budget;
      const timeline = req.body.timeline;

      // Process the form data as needed (for example, log it)
      console.log('Form submitted successfully:', { name, email, project, budget, timeline });

      // Send a response to the client
      res.send('Form submitted successfully');
    } else {
      // QR code doesn't match or time expired
      console.log('Form submission rejected');
      res.send('Form submission rejected');
    }
  } catch (error) {
    console.error('Error processing form submission:', error);
    res.status(500).send('Internal Server Error');
  }
});



setInterval(() => {
  qrCodeCounter++;
  console.log(`QR code counter updated to: ${qrCodeCounter}`);
  generateQRCode(); // Generate QR code without sending a response
}, 60000);

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
                  setTimeout(() => { window.location.reload() }, 60000);
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

app.listen(port, () => console.log(`Server running on http://${localip}:${port}`));
