// pages/api/user/setup-encryption-key.js
import { getSession } from 'next-auth/react';
import { deriveKey } from '../../../lib/encryption';
import clientPromise from '../../../lib/mongodb';
import crypto from 'crypto'; // crypto здесь доступен
import { ObjectId } from 'mongodb';

export default async function handler(req, res) {
  const session = await getSession({ req });

  if (!session) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  if (req.method === 'POST') {
    const { masterPassword } = req.body;

    if (!masterPassword || masterPassword.length < 8) {
      return res.status(400).json({ message: 'Master password must be at least 8 characters long.' });
    }

    try {
      const salt = crypto.randomBytes(16).toString('hex'); // Генерируем соль *на сервере*
      const encryptionKey = deriveKey(masterPassword, Buffer.from(salt, 'hex'));

      const client = await clientPromise;
      const db = client.db();
      const userId = session.user.id;

      await db.collection('users').updateOne(
        { _id: new ObjectId(userId) },
        { $set: { encryptionSalt: salt } },
        { upsert: true }
      );

      // *Не* возвращаем ключ шифрования клиенту!
      return res.status(200).json({ success: true }); // Возвращаем только успех

    } catch (error) {
      console.error('Failed to setup encryption key:', error);
      return res.status(500).json({ message: error.message || 'Failed to set up encryption key.' });
    }
  }

  return res.status(405).end(`Method ${req.method} Not Allowed`);
}