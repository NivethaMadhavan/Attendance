#!/bin/bash

# Ensure PGPASSWORD is set (only necessary if using password authentication)
export PGPASSWORD=5LwG3ddvMUxytEwxP2cLpoWpbCBwicvE

# Define database connection details
DB_HOST=dpg-cpitueuct0pc738154gg-a
DB_PORT=5432  # Or your PostgreSQL port
DB_NAME=attendence_unym
DB_USER=root

# Path to your init.sql file
INIT_SQL_PATH=./init.sql

# Execute the SQL script
psql -h $DB_HOST -p $DB_PORT -d $DB_NAME -U $DB_USER -f $INIT_SQL_PATH
