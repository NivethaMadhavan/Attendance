const express = require('express');
const app = express();

// Use environment variables or default values
const port = process.env.PORT || 10001; // Port for teacher.js
const qrPort = process.env.DB_PORT || 10000; // Port for QR code generation
const port = process.env.DB_PORT || 10002; // home.js

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
        body {
          font-family: Arial, sans-serif;
          background-color: #f0f0f0;
          padding: 20px;
        }
        .container {
          max-width: 600px;
          margin: auto;
          background-color: #fff;
          padding: 20px;
          border-radius: 8px;
          box-shadow: 0 0 10px rgba(0,0,0,0.1);
        }
        h1 {
          text-align: center;
          color: #333;
        }
        .btn-container {
          display: flex;
          justify-content: center;
          margin-top: 20px;
        }
        .btn {
          margin: 0 10px;
          padding: 10px 20px;
          font-size: 16px;
          background-color: #007bff;
          color: #fff;
          border: none;
          border-radius: 4px;
          cursor: pointer;
        }
        .btn:hover {
          background-color: #0056b3;
        }
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
  res.redirect(`/teacher-dashboard`);
});

// Start the server
app.listen(port, '0.0.0.0', () => {
  console.log(`Server is running at http://0.0.0.0:${port}`);
});
