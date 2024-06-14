-- init.sql

CREATE TABLE IF NOT EXISTS "FormSubmissions" (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  usn VARCHAR(50),
  ip_address VARCHAR(50) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

SELECT * FROM Formsubmissions;
