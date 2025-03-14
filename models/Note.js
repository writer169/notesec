// --- /models/Note.js ---
import mongoose from 'mongoose';

const NoteSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  title: { type: String, required: false },
  content: {
    iv: { type: String, required: true },
    encrypted: { type: String, required: true },
    authTag: { type: String, required: true },
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  tags: [{ type: String }],
});

export default mongoose.models.Note || mongoose.model('Note', NoteSchema);
