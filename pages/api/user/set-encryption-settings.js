// --- /pages/api/user/set-encryption-settings.js ---
import { getSession } from 'next-auth/react';
// import dbConnect from '../../../lib/mongodb'; // Больше не нужно
// import User from '../../../models/User'; // Больше не нужно
import clientPromise from '../../../lib/mongodb';
import {ObjectId} from 'mongodb';


export default async function handler(req, res) {
  const session = await getSession({ req });

  if (!session) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  // await dbConnect(); // Больше не нужно

  if (req.method === 'POST') {
    const { salt } = req.body;

    if (!salt) {
      return res.status(400).json({ message: 'Salt is required' });
    }

    try {
      const userId = session.user.id;
        const client = await clientPromise;
        const db = client.db();
      // Обновляем пользователя, добавляя/заменяя encryptionSalt
      // await User.findByIdAndUpdate(userId, { encryptionSalt: salt }, { new: true, upsert: true }); // Заменяем на:
        const result = await db.collection('users').updateOne(
            { _id: new ObjectId(userId) },
            { $set: { encryptionSalt: salt } },
            { upsert: true } // Создать документ, если он не существует
        );

        if (result.acknowledged) { // Проверяем результат операции
           return res.status(200).json({ message: 'Encryption settings saved' });
        }
        else{
            throw new Error("Failed to update user");
        }

    } catch (error) {
      console.error("Error saving encryption settings:", error);
      return res.status(500).json({ message: error.message || 'Failed to save encryption settings' });
    }
  }

  return res.status(405).end(`Method ${req.method} Not Allowed`);
}
