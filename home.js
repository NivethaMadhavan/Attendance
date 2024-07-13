const express = require('express');
const qr = require('qrcode');
const bodyParser = require('body-parser');
const { Client } = require('pg');
const ip = require('ip');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);

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

app.use(session({
  store: new pgSession({
    pool: client // Your PostgreSQL client
  }),
  secret: 'your_secret_key', // Replace with a secure secret key
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
  }
}));

function isAuthenticated(req, res, next) {
  if (req.session.user) {
    next();
  } else {
    res.redirect('/login');
  }
}




// Function to generate the QR code
async function generateQRCode(className) {
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
    console.log("Generating QR Code for client - counter is "+qrCodeCounter);
    const qrCode = await generateQRCode(currentClassName);
    res.send(qrCode);
  } catch (error) {
    console.error(`Error generating QR code:`, error);
    res.status(500).send('Internal Server Error');
  }
});

app.get('/latest-qr-code-org', async (req, res) => {
  try {
    console.log("Generating QR Code for client - counter is "+qrCodeCounter);
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
          <a href="/register" class="btn">Register</a>
          <li><a href="/login">Login</a></li>
          <li><a href="/student-dashboard">Student Dashboard</a></li>
        </div>
      </div>
    </body>
    </html>
  `);
});

app.get('/register', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Register</title>
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
        input {
          width: 100%;
          padding: 10px;
          margin-bottom: 15px;
          border: none;
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.1);
          color: black;
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
      <form action="/register" method="post">
        <h2>Register</h2>
        <label for="name">Your Name:</label>
        <input type="text" id="name" name="name" required>
        <label for="usn">USN:</label>
        <input type="text" id="usn" name="usn" required>
        <label for="className">Class Name:</label>
        <input type="text" id="className" name="className" required>
        <label for="password">Password:</label>
        <input type="password" id="password" name="password" required>
        <button type="submit">Submit</button>
      </form>
    </body>
    </html>
  `);
});

// Login route
app.get('/login', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Login</title>
    </head>
    <body>
      <h2>Login</h2>
      <form action="/login" method="post">
        <label for="usn">USN:</label>
        <input type="text" id="usn" name="usn" required><br>
        <label for="password">Password:</label>
        <input type="password" id="password" name="password" required><br>
        <button type="submit">Login</button>
      </form>
    </body>
    </html>
  `);
});

// Student Dashboard route
app.get('/student-dashboard', isAuthenticated, (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Student Dashboard</title>
    </head>
    <body>
      <h2>Hello!</h2>
      <a href="/logout">Logout</a>
    </body>
    </html>
  `);
});


// Login route
app.post('/login', async (req, res) => {
  const { usn, password } = req.body;

  try {
    const result = await client.query('SELECT * FROM login_credentials WHERE usn = $1 AND password = $2', [student_id,password_hash]);
    if (result.rows.length > 0) {
      req.session.user = { usn: result.rows[0].usn, name: result.rows[0].name };
      res.redirect('/student-dashboard');
    } else {
      res.status(401).send('Invalid credentials');
    }
  } catch (err) {
    console.error('Error logging in:', err);
    res.status(500).send('Internal Server Error');
  }
});

// Logout route
app.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).send('Unable to log out');
    }
    res.redirect('/');
  });
});

app.post('/register', async (req, res) => {
  try {
    const { name, usn, className, password } = req.body;
    
    // Insert the new student into the students table
    const insertQuery = `
      INSERT INTO students (name, usn, class_name)
      VALUES ($1, $2, $3)
      ON CONFLICT (usn) DO NOTHING;
    `;
    await client.query(insertQuery, [name, usn, className]);

    const insertQuery2 = `
      INSERT INTO login_credentials (student_id, password_hash)
      VALUES ($1, $2)
      ON CONFLICT (usn) DO NOTHING;
    `;
    await client.query(insertQuery2, [student_id, password_hash]);
    
    // Redirect the user back to the home page after successful registration
    res.redirect('/');
  } catch (error) {
    console.error('Error registering student:', error);
    res.status(500).send('Internal Server Error');
  }
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
        let currentClassName = 'Computer'; // Initial class name

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
          fetch('/latest-qr-code', {
            method: 'GET'
          })
          .then(response => response.text())
          .then(data => {
            const img = document.createElement('img');
            img.src = data;
            document.getElementById('qrCodeContainer').innerHTML = ''; // Clear previous QR code
            document.getElementById('qrCodeContainer').appendChild(img);
            //currentClassName = className; // Update current class name
          })
          .catch(error => console.error('Error generating QR code:', error));
//          generateQRCode(currentClassName); // Call generateQRCode with current class name
        }

        function initPage(){
       
          
        // Event listeners for buttons to change the class name
        document.getElementById('btnClassA').addEventListener('click', () => {
          generateQRCode('computer');
          setInterval(refreshQRCode, 30000);
        });

        document.getElementById('btnClassB').addEventListener('click', () => {
          generateQRCode('math');
          setInterval(refreshQRCode, 30000);
        });
        }
        
      </script>
    </head>
    <body onload="initPage()">
      <div class="container">
        <h1>Teacher Dashboard</h1>
        <div class="btn-container">
          <button id="btnClassA" class="btn">Generate QR for Computer</button>
          <button id="btnClassB" class="btn">Generate QR for Maths</button>
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
app.post('/generate-qr', async (req, res) => {
  try {
    const className = req.body.className; // Get class name from request body
    const subject = req.body.className; // Assuming subject is also passed in the request body

    if (className !== currentSession.className) {
      currentClassName = className; // Update global current class name
      currentSession.className = className;
      currentSession.timestamp = new Date();
      currentSession.tableName = `Department_${className}_${currentSession.timestamp.toISOString().replace(/[:.]/g, '-')}`;
      startQRCodeGenerationInterval(className); // Start a new interval with the updated class name
    }

    // Generate the first QR code immediately
    const qrCode = await generateQRCode(className);

    // Create table if it doesn't exist
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS "${currentSession.tableName}" (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255),
        usn VARCHAR(255),
        device_fingerprint VARCHAR(255)
      )
    `;
    await client.query(createTableQuery);

    // Update subject total field
    const subjectTotalField = `${className.toLowerCase()}_total`;
    console.log(subjectTotalField);
    const updateQuery = `
      UPDATE students
      SET ${subjectTotalField} = ${subjectTotalField} + 1
      WHERE class_name = $1
    `;
    await client.query(updateQuery, [className]);

    res.json({ qrCode });

  } catch (error) {
    console.error(`Error generating QR code for class ${className}:`, error);
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
      console.log(`Received qr code : "${requestedQrCode}", Current qr code : "${qrCodeCounter}"`);
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
            // JavaScript to fetch and set the client fingerprint
            // Using FingerprintJS library
            FingerprintJS.load().then(fp => {
              fp.get().then(result => {
                const visitorId = result.visitorId;
                document.getElementById('clientFingerprint').value = visitorId;
              });
            });
          </script>
        </body>
        </html>
      `);
    }
  } catch (error) {
    console.error(`Error generating form page:`, error);
    res.status(500).send('Internal Server Error');
  }
});

// POST route handler for form submission
app.post('/submit', async (req, res) => {
  try {
    const requestedQrCode = parseInt(req.body.qrcode);
    const clientFingerprint = req.body.clientFingerprint;
    const { name, usn, className } = req.body;

    if (!clientFingerprint) {
      res.status(400).send('Bad Request: Missing client fingerprint');
      return;
    }

    if (qrCodeCounter === requestedQrCode) {
      // Check if the fingerprint is already in the table
      const checkQuery = `
        SELECT COUNT(*) AS count FROM "${currentSession.tableName}" WHERE device_fingerprint = $1
      `;
      const checkResult = await client.query(checkQuery, [clientFingerprint]);

      if (checkResult.rows[0].count > 0) {
        res.send('Form submission rejected: Fingerprint already submitted');
      } else {
        const insertQuery = `
          INSERT INTO "${currentSession.tableName}" (name, usn, device_fingerprint) VALUES ($1, $2, $3)
        `;
        await client.query(insertQuery, [name, usn, clientFingerprint]);
        const subjectTotalField = `${className.toLowerCase()}_total`;
        const subjectAttendanceField = `${className.toLowerCase()}_attendance`;
        const updateQuery = `
          UPDATE students
          SET ${subjectTotalField} = ${subjectTotalField} + 1, ${subjectAttendanceField} = ${subjectAttendanceField} + 1
          WHERE usn = $1
        `;
        await client.query(updateQuery, [usn]);
        
        res.send('Form submitted successfully');
      }
    } else {
      res.send('Form submission rejected: QR code mismatch');
      console.log(`Received qr code : "${requestedQrCode}", Current qr code : "${qrCodeCounter}"`);
    }
  } catch (error) {
    console.error(`Error processing form submission:`, error);
    res.status(500).send('Internal Server Error');
  }
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Server is running on http://0.0.0.0:${port}`);
});
