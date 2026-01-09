const mongoose = require("mongoose");

const foundItemSchema = new mongoose.Schema({
  imagePath: String,
  description: String,
  location: String,
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model("FoundItem", foundItemSchema);
