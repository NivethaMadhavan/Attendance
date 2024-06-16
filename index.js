const express = require('express');
const bodyParser = require('body-parser');
const ip = require('ip');

const app = express();
let port = parseInt(process.env.PORT, 10) || 10000; // Default to 10000 if PORT is not set or invalid

// Ensure the port is within the valid range
if (port < 0 || port > 65535) {
  console.error(`Invalid port number: ${port}. Falling back to default port 10000.`);
  port = 10000;
}

const localip = ip.address();

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Simplified route for testing
app.get('/', async (req, res) => {
  try {
    res.send('Hello, World! The server is running.');
  } catch (error) {
    console.error('Error:', error);
    res.status(500).send('Internal Server Error');
  }
});

app.listen(port, localip, () => {
  console.log(`Server is running on http://${localip}:${port}`);
});
