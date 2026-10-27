const mongoose = require("mongoose");
const schema = new mongoose.Schema({
  socketId: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true },
  room: { type: String, required: true, index: true },
  location: {
    type: { type: String, enum: ["Point"], default: "Point" },
    coordinates: { type: [Number], default: [0, 0] }
  },
  updatedAt: { type: Date, default: Date.now }
});
schema.index({ location: "2dsphere" });
module.exports = mongoose.model("Participant", schema);
