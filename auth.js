const express = require("express");
const path = require("path");
const mongoose = require("mongoose");
require("dotenv").config();
const fs = require("fs");
const axios = require("axios");


const multer = require("multer");

const { GoogleGenerativeAI } = require("@google/generative-ai");

const User = require("./models/User");
const FoundItem = require("./models/FoundItem");

const app = express();
const PORT = 3000;

/* ======================
   ENV CHECK
====================== */
if (!process.env.GEMINI_API_KEY) {
  console.error("❌ GEMINI_API_KEY missing in .env");
  process.exit(1);
}

/* ======================
   GEMINI INIT
====================== */
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const geminiModel = genAI.getGenerativeModel({
  model: "gemini-2.5-flash"
});

/* ======================
   Ensure uploads folder
====================== */
if (!fs.existsSync("uploads")) fs.mkdirSync("uploads");

/* ======================
   Middleware
====================== */
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static("public"));
app.use("/uploads", express.static("uploads"));

/* ======================
   MongoDB
====================== */
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch(err => console.error("❌ MongoDB error:", err));

/* ======================
   View engine
====================== */
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

/* ======================
   Routes
====================== */
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

/* ======================
   Login (basic demo)
====================== */
app.post("/login", async (req, res) => {
  const { username, password } = req.body;

  const user = await User.findOne({ username });
  if (!user || user.password !== password) {
    return res.send("<h1>Invalid credentials</h1>");
  }

  res.render("welcome", { username });
});

/* ======================
   Multer setup
====================== */
const storage = multer.diskStorage({
  destination: "uploads/",
  filename: (req, file, cb) =>
    cb(null, Date.now() + "-" + file.originalname)
});

const upload = multer({ storage });

/* ======================
   IMAGE → DESCRIPTION
====================== */
async function generateImageDescription(imagePath, mimeType) {
  const imageBase64 = fs.readFileSync(imagePath).toString("base64");

  const result = await geminiModel.generateContent([
    {
      inlineData: {
        mimeType: mimeType,
        data: imageBase64
      }
    },
    {
      text:
        "Describe this object clearly for a lost and found system. Mention color, size, brand, visible text, and unique features."
    }
  ]);

  return result.response.text() || "No description generated";
}


/* ======================
   Report Found Item
====================== */
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
    console.error("❌ Image processing failed:", err);
    res.status(500).send("Image processing failed");
  }
});

/* ======================
   JSON CLEANER
====================== */
function extractJSON(text) {
  return text.replace(/```json|```/g, "").trim();
}

/* ======================
   MATCHING LOGIC
====================== */
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

  const result = await geminiModel.generateContent(prompt);
  const raw = result.response.text() || "[]";

  try {
    return JSON.parse(extractJSON(raw));
  } catch (err) {
    console.error("❌ Invalid JSON from Gemini:", raw);
    return [];
  }
}

/* ======================
   Match endpoint
====================== */
app.post("/match-lost", async (req, res) => {
  try {
    const foundItems = await FoundItem.find({}); // ❌ remove .lean()

    const matches = await matchLostItem(req.body.description, foundItems);

    const enriched = matches
      .filter(m => m.score >= 60)
      .map(m => {
        const item = foundItems.find(f => f._id.toString() === m.id);
        if (!item) return null;

        return {
          _id: item._id,                 // ✅ FORCE _id
          imagePath: item.imagePath,
          description: item.description,
          location: item.location,
          score: m.score,
          reason: m.reason
        };
      })
      .filter(Boolean);

    console.log("ENRICHED ITEMS:", enriched); // ✅ DEBUG

    res.render("matches", { matchedItems: enriched });
  } catch (err) {
    console.error(err);
    res.status(500).send("Matching failed");
  }
});


/* ======================
   CLAIM & DELETE ITEM
====================== */
app.post("/claim-item/:id", async (req, res) => {
  try {
    const item = await FoundItem.findById(req.params.id);
    if (!item) {
      return res.status(404).render("claimed", { message: "Item not found" });
    }

    // Delete the image file if it exists
    if (fs.existsSync(item.imagePath)) fs.unlinkSync(item.imagePath);

    // Delete the item from the database
    await FoundItem.findByIdAndDelete(req.params.id);

    console.log("✅ Item claimed & deleted:", req.params.id);

    // Render a simple confirmation page
    res.render("claimed", { message: "✅ Item has been marked as claimed!" });
  } catch (err) {
    console.error("❌ Claim failed:", err);
    res.status(500).render("claimed", { message: "❌ Failed to claim item" });
  }
});

// ======================
// CHECK AVAILABLE GEMINI MODELS
// ======================
app.get("/check-gemini-models", async (req, res) => {
  try {
    const response = await axios.get(
      "https://generativelanguage.googleapis.com/v1beta/models",
      {
        params: {
          key: process.env.GEMINI_API_KEY
        }
      }
    );

    // Send only useful fields
    const models = response.data.models.map(m => ({
      name: m.name,
      supportedMethods: m.supportedGenerationMethods
    }));

    res.json({
      success: true,
      models
    });
  } catch (err) {
    console.error("❌ Failed to fetch models:", err.response?.data || err.message);
    res.status(500).json({
      success: false,
      error: err.response?.data || err.message
    });
  }
});


/* ======================
   Start server
====================== */
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
