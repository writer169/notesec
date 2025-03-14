// --- /lib/encryption.js ---
import crypto from 'crypto';

// Функция для создания ключа из пароля с использованием соли
export const deriveKey = (password, salt) => {
  return crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha512');
};

// Шифрование данных
export const encrypt = (text, encryptionKey) => {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey, iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag().toString('hex');

  // Сохраняем IV и authTag вместе с зашифрованными данными для расшифровки
  return {
    iv: iv.toString('hex'),
    encrypted,
    authTag
  };
};

// Дешифрование данных
export const decrypt = (encryptedData, encryptionKey) => {
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    encryptionKey,
    Buffer.from(encryptedData.iv, 'hex')
  );

  decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));

  let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
};
