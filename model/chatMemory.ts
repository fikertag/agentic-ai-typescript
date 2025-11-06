import mongoose from "mongoose";

const ChatMemorySchema = new mongoose.Schema({
  thread_id: { type: String, required: true, unique: true },
  full_history: [{ role: { type: String }, content: { type: String } }],
  summary_history: { type: String, default: "" },
  updated_at: { type: Date, default: Date.now },
});
const ChatMemory =
  mongoose.models.ChatMemory || mongoose.model("ChatMemory", ChatMemorySchema);

export default ChatMemory;
