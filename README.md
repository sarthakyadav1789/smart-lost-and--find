# smart-lost-and--find
A smart AI assisted centralised lost and found system for college campuses.

🧠 Smart Lost & Found System

An AI-powered web application that helps users report lost items and intelligently match them with found items using Google AI technologies.

🚀 Project Overview

The Smart Lost & Found System is a full-stack web application designed to solve a real-world problem commonly faced in campuses and public spaces: recovering lost items efficiently.

Instead of relying on manual searching, this system uses AI-generated descriptions and semantic matching to automatically suggest potential matches between lost and found items.

================================================================================================================================

✨ Key Features

- Secure authentication using MongoDB records
- Report lost items using text descriptions
- Report found items by uploading images
- AI-generated item descriptions from images using Google Gemini
- Intelligent matching system with similarity scores (0–100)
- Dashboard showing potential matches
- System Architecture

================================================================================================================================

Frontend (HTML / CSS / JS)
↓
Node.js + Express Backend
↓
MongoDB (Lost & Found items)

Google Gemini API (Text)
Multer (image uploads)

================================================================================================================================
🧰 Tech Stack
#Frontend

    - HTML5
    - CSS3
    - EJS Templates

#Backend

    - Node.js
    - Express.js
    - MongoDB
    - Mongoose
    - Multer
    - Axios
    - Google Gemini API         <=====

================================================================================================================================

🧠 AI Workflow

1. User reports a lost item using text
2. Another user uploads an image of a found item
3. Gemini generates a structured description from the image
4. Gemini compares lost and found descriptions
5. System returns similarity scores with reasoning
6. High-confidence matches are shown to users

================================================================================================================================

📂 Project Structure

smart-lost-and-found/
├── models/
│ ├── User.js
│ └── FoundItem.js
│
├── public/
│ ├── css/
│ └── uploads/
│
├── views/
│ ├── success.ejs
│ ├── welcome.ejs
│ └── matches.ejs
│
├── server.js
├── auth.js
├── .env
├── package.json
└── README.md

================================================================================================================================

⚙️ Installation & Setup
1️⃣ Clone the Repository

git clone https://github.com/your-username/smart-lost-and-found.git

cd smart-lost-and-found

2️⃣ Install Dependencies

npm install

3️⃣ Environment Variables

Create a .env file:

MONGODB_URI=your_mongodb_connection_string
GEMINI_API_KEY=your_gemini_api_key
FIREBASE_API_KEY=your_firebase_api_key

4️⃣ Run the Application

node server.js

Open in browser:
http://localhost:3000

🧪 Demo Flow

    Login using Google

    Report a lost item

    Upload a found item image

    AI generates description automatically

    Matching results appear with confidence scores

🎯 Use Cases

College & university campuses

Offices

Hostels

Events and conferences

================================================================================================================================

🔮 Future Enhancements

Mobile application

Location-based matching

Email / WhatsApp notifications

Vector embeddings for faster matching

Admin moderation panel
