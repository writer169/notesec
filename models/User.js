// --- models/User.js ---
import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema({
  // Поля, которые уже могут быть в твоей модели (пример)
  name: {
    type: String,
  },
  email: {
    type: String,
    unique: true, // Важно: email должен быть уникальным
  },
  image: {
    type: String,
  },
  // Добавляем поле для хранения соли
  encryptionSalt: {
    type: String,
  },
}, { timestamps: true }); // timestamps: createdAt, updatedAt

// Важно: эта проверка нужна, чтобы избежать ошибки при повторном запуске сервера (hot-reloading)
export default mongoose.models.User || mongoose.model('User', UserSchema);
