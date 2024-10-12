const mongoose = require("mongoose");

const linkSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  link: { type: String, required: true },
  pingTime: { type: Number } // Ping süresi (ms)
});

const Link = mongoose.model("Link", linkSchema);
module.exports = Link;
