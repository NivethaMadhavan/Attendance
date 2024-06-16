const express = require('express');
const bodyParser = require('body-parser');
const ip = require('ip');

const app = express();
let port = parseInt(process.env.PORT, 10);

// Validate the port number
if (isNaN(port) || port < 0 || port > 65535) {
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
    console.log('Hello World');
  } catch (error) {
    console.error('Error:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Listen on 0.0.0.0 to accept connections on all network interfaces
app.listen(port, '0.0.0.0', () => {
  console.log(`Server is running on http://0.0.0.0:${port}`);
});
