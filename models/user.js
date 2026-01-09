const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  username: String,
  password: String,
  role: String
}, {
  collection: "lost-and-found"
});

module.exports = mongoose.model("User", userSchema);
