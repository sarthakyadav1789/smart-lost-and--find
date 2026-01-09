const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");
const mongoose = require("mongoose");
require("dotenv").config();

const User = require("./models/User");
const FoundItem = require("./models/FoundItem");

const multer = require("multer");
const fs = require("fs");
const axios = require("axios");

const app = express();
const PORT = 3000;

// ======================
// ENV CHECK
// ======================
if (!process.env.GEMINI_API_KEY) {
  console.error("❌ GEMINI_API_KEY missing in .env");
  process.exit(1);
}

// ======================
// Ensure uploads folder
// ======================
if (!fs.existsSync("uploads")) fs.mkdirSync("uploads");

// ======================
// Middleware
// ======================
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static("public"));
app.use("/uploads", express.static("uploads"));

// ======================
// GEMINI HELPER
// ======================
async function callGeminiWithRetry(payload, retries = 3, delay = 1500) {
  let lastError;

  for (let i = 0; i < retries; i++) {
    try {
      return await axios.post(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent",
        payload,
        {
          params: { key: process.env.GEMINI_API_KEY },
          headers: { "Content-Type": "application/json" },
          timeout: 30000
        }
      );
    } catch (err) {
      lastError = err;
      console.error("Gemini error:", err.response?.status);

      if (err.response?.status === 503 && i < retries - 1) {
        await new Promise(r => setTimeout(r, delay));
      } else break;
    }
  }
  throw lastError;
}

// ======================
// MongoDB
// ======================
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch(err => console.error(err));

// ======================
// View engine
// ======================
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// ======================
// Routes
// ======================
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// ======================
// Login
// ======================
app.post("/login", async (req, res) => {
  const { username, password } = req.body;

  const user = await User.findOne({ username });
  if (!user || user.password !== password) {
    return res.send("<h1>Invalid credentials</h1>");
  }

  res.render("welcome", { username });
});

// ======================
// Multer
// ======================
const storage = multer.diskStorage({
  destination: "uploads/",
  filename: (req, file, cb) =>
    cb(null, Date.now() + "-" + file.originalname)
});
const upload = multer({ storage });

// ======================
// IMAGE → DESCRIPTION (GEMINI)
// ======================
async function generateImageDescription(imagePath, mimeType) {
  const imageBase64 = fs.readFileSync(imagePath).toString("base64");

  const payload = {
    contents: [
      {
        parts: [
          {
            inlineData: {
              mimeType,
              data: imageBase64
            }
          },
          {
            text:
              "Describe this object clearly for a lost and found system. Mention color, size, brand, visible text, and unique features."
          }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.4,
      maxOutputTokens: 200
    }
  };

  const response = await callGeminiWithRetry(payload);

  return response.data.candidates[0].content.parts[0].text;
}

// ======================
// Report Found Item
// ======================
app.post("/report-found", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).send("Image is required");
    }

    const description = await generateImageDescription(
      req.file.path,
      req.file.mimetype
    );

    await FoundItem.create({
      imagePath: req.file.path,
      description,
      location: req.body.location || "Unknown"
    });

    res.render("Success");
  } catch (err) {
    console.error(err);
    res.status(500).send("Image processing failed");
  }
});

// ======================
// JSON CLEANER
// ======================
function extractJSON(text) {
  return text.replace(/```json|```/g, "").trim();
}

// ======================
// MATCHING LOGIC
// ======================
async function matchLostItem(userDescription, items) {
  const simplifiedItems = items.map(i => ({
    id: i._id.toString(),
    description: i.description,
    location: i.location
  }));

  const prompt = `
User lost item description:
"${userDescription}"

Compare with found items below.

Return ONLY valid JSON.
Format:
[
  { "id": "<id>", "score": 80, "reason": "why matched" }
]

Found items:
${JSON.stringify(simplifiedItems, null, 2)}
`;

  const response = await callGeminiWithRetry({
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.2 }
  });

  const raw = response.data.candidates[0].content.parts[0].text;

  try {
    return JSON.parse(extractJSON(raw));
  } catch {
    console.error("Invalid JSON from Gemini:", raw);
    return [];
  }
}

// ======================
// Match endpoint
// ======================
app.post("/match-lost", async (req, res) => {
  try {
    const foundItems = await FoundItem.find({}).lean();
    const matches = await matchLostItem(req.body.description, foundItems);

    const enriched = matches
      .filter(m => m.score >= 60)
      .map(m => {
        const item = foundItems.find(f => f._id.toString() === m.id);
        return item ? { ...item, score: m.score, reason: m.reason } : null;
      })
      .filter(Boolean);

    res.render("matches", { matchedItems: enriched });
  } catch (err) {
    console.error(err);
    res.status(500).send("Matching failed");
  }
});

// ======================
// Start server
// ======================
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
