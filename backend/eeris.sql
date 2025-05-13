-- Drop existing tables if they exist
DROP TABLE IF EXISTS receipt_audit, receipts, users, permissions, user_roles, expenses, expense_items CASCADE;

-- Create User Roles Table
CREATE TABLE user_roles (
    id SERIAL PRIMARY KEY,
    role VARCHAR(20) UNIQUE NOT NULL,
    description TEXT
);

-- Insert default roles
INSERT INTO user_roles (role, description) VALUES
    ('Employee', 'Can submit receipts'),
    ('Supervisor', 'Can approve/reject receipts'),
    ('Admin', 'Can manage users and receipts');

-- Create Permissions Table
CREATE TABLE permissions (
    id SERIAL PRIMARY KEY,
    role_id INT REFERENCES user_roles(id) ON DELETE CASCADE,
    permission VARCHAR(50) UNIQUE NOT NULL
);

-- Assign permissions to roles
INSERT INTO permissions (role_id, permission)
SELECT id, 'Submit Receipts' FROM user_roles WHERE role = 'Employee'
UNION ALL
SELECT id, 'Approve Receipts' FROM user_roles WHERE role = 'Supervisor'
UNION ALL
SELECT id, 'Reject Receipts' FROM user_roles WHERE role = 'Supervisor'
UNION ALL
SELECT id, 'Manage Users' FROM user_roles WHERE role = 'Admin'
UNION ALL
SELECT id, 'Manage Receipts' FROM user_roles WHERE role = 'Admin';

-- Create Users Table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    role_id INT REFERENCES user_roles(id) ON DELETE SET NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL
);

-- Create Receipts Table
CREATE TABLE receipts (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    category VARCHAR(50) DEFAULT 'Unknown',
    amount DECIMAL(10,2) DEFAULT NULL,
    status VARCHAR(20) CHECK (status IN ('Pending', 'Approved', 'Rejected')) DEFAULT 'Pending',
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    extracted_text TEXT,
    store_name VARCHAR(50) DEFAULT 'Unknown'
);

-- Create Audit Log for Approvals/Rejections
CREATE TABLE receipt_audit (
    id SERIAL PRIMARY KEY,
    receipt_id INT REFERENCES receipts(id) ON DELETE CASCADE,
    supervisor_id INT REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(20) CHECK (action IN ('Approved', 'Rejected')) NOT NULL,
    action_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    comments TEXT
);

-- Insert a few test users
INSERT INTO users (name, role_id, email, password_hash)
VALUES 
    ('Alice Employee', (SELECT id FROM user_roles WHERE role = 'Employee'), 'alice@example.com', 'hashed_password_1'),
    ('Bob Supervisor', (SELECT id FROM user_roles WHERE role = 'Supervisor'), 'bob@example.com', 'hashed_password_2'),
    ('Charlie Admin', (SELECT id FROM user_roles WHERE role = 'Admin'), 'charlie@example.com', 'hashed_password_3');

-- Main table: expenses
CREATE TABLE expenses (
    id SERIAL PRIMARY KEY,
    user_id INTEGER,  -- Optional: if you want to track who submitted
    store VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL,
    subcategory VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Subtable: items inside each expense
CREATE TABLE expense_items (
    id SERIAL PRIMARY KEY,
    expense_id INTEGER REFERENCES expenses(id) ON DELETE CASCADE,
    item_name VARCHAR(255) NOT NULL,
    amount NUMERIC(10, 2) NOT NULL
);