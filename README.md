# Attendance
## Dependencies and Setup
### Dependencies:

#### express: A web framework for Node.js.
#### qrcode: A library to generate QR codes.
body-parser: Middleware to parse incoming request bodies.
pg: PostgreSQL client for Node.js.
ip: A library to get the server's IP address.
Initial Setup:

An Express application instance is created.
The port is set from an environment variable PORT or defaults to 10000. If the port is invalid, it falls back to 10000.
The local IP address is retrieved using the ip library.
Variables like qrCodeCounter, currentClassName, intervalId, and currentSession are initialized.
Middleware bodyParser is set up to parse JSON and URL-encoded request bodies.
Database Connection
Database Connection:
The PostgreSQL client is configured with a connection string from the environment variable DB_URI_INTERNAL.
The client connects to the database and logs success or failure.
QR Code Generation
QR Code Generation Function:

generateQRCode(className): Generates a QR code using the qrcode library with a URL that includes the QR code counter, timestamp, and class name.
QR Code Generation Interval:

startQRCodeGenerationInterval(className): Sets an interval to generate a new QR code every 30 seconds and updates the qrCodeCounter.
Routes
QR Code Routes:

GET /latest-qr-code: Generates and returns the latest QR code.
GET /latest-qr-code-org: Generates and returns an HTML page with the QR code that refreshes every 30 seconds.
Home and Dashboard Routes:

GET /: Returns the home page with links to the teacher dashboard, registration, and login pages.
GET /login: Returns the login page.
POST /login: Handles login form submission, checks credentials, and redirects to the student dashboard if successful.
GET /register: Returns the registration page.
POST /register: Handles registration form submission, inserts the student into the students and login tables, and redirects to the home page.
GET /dashboard: Returns the student dashboard with attendance details based on the USN query parameter.
Teacher Dashboard Routes:

GET /teacher-dashboard: Returns the teacher dashboard with buttons to generate QR codes for different classes.
POST /generate-qr: Generates a QR code for a specific class, creates a new table for the class if it doesn't exist, and updates the attendance total for the subject.
QR Code Validation and Form Submission:

GET /submit: Validates the QR code from the query parameters and shows a form for submission if the QR code is valid.
Explanation of Key Concepts
QR Code Generation: QR codes are generated with unique URLs that include a counter and timestamp to ensure they change periodically.
Sessions and Intervals: The app uses intervals to update the QR code every 30 seconds. When the class name changes, the interval is reset.
Database Interaction: The app connects to a PostgreSQL database to store and retrieve student and attendance information.
Routing and Views: The app uses Express routes to handle different functionalities like generating QR codes, user registration, and login, and serving HTML pages for the teacher and student dashboards.
