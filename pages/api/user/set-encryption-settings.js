// --- /pages/api/user/set-encryption-settings.js ---
import { getSession } from 'next-auth/react';
import dbConnect from '../../../lib/mongodb';
import User from '../../../models/User';

export default async function handler(req, res) {
  const session = await getSession({ req });

  if (!session) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  await dbConnect();

  if (req.method === 'POST') {
    const { salt } = req.body;

    if (!salt) {
      return res.status(400).json({ message: 'Salt is required' });
    }

    try {
      const userId = session.user.id;
      // Обновляем пользователя, добавляя/заменяя encryptionSalt
      await User.findByIdAndUpdate(userId, { encryptionSalt: salt }, { new: true, upsert: true });
      return res.status(200).json({ message: 'Encryption settings saved' });
    } catch (error) {
      console.error("Error saving encryption settings:", error);
      return res.status(500).json({ message: error.message || 'Failed to save encryption settings' });
    }
  }

  return res.status(405).end(`Method ${req.method} Not Allowed`);
}
