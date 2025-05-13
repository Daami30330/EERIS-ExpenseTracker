# 💰 EERIS Expense Tracker

A full-stack web application built for the EERIS-17 project that helps users manage their expenses, track financial history, and export reports. Includes secure user authentication, audit logging, and PDF generation.

---

## 🚀 Tech Stack

- **Frontend:** React.js + Tailwind CSS
- **Backend:** Flask (Python)
- **Database:** PostgreSQL
- **Authentication:** JSON Web Tokens (JWT)
- **Extras:** PDF generation with ReportLab

---

## ✅ Features

- 🔐 User registration and login
- 🧾 Add, edit, and delete expense entries
- 📊 Filter expenses by category or date
- 📜 Full audit log of user actions
- 📄 Export expense reports as PDFs
- 🎨 Clean, responsive UI built with Tailwind

---

## 📂 Folder Structure
EERIS-ExpenseTracker/
├── backend/ # Flask backend (API, models, routes)
├── src/ # React frontend components
├── public/ # Static files
├── uploads/ # Uploaded receipt images
├── .gitignore
├── package.json
├── README.md


---

## ⚙️ Getting Started

### 🐍 1. Backend Setup (Flask)
cd backend
python -m venv venv
venv\Scripts\activate           # or source venv/bin/activate for macOS/Linux
pip install -r requirements.txt
python app.py

Make sure PostgreSQL is running and configure .env with your DB URL and JWT secret.

⚛️ 2. Frontend Setup (React)
cd ..
npm install
npm start

✍️ Author
Imaad Fahimuddin
Full-stack developer and recent CS graduate
Built as a final project for my SOftware Engineer class

📜 License
This project is intended for educational/demo use only.

