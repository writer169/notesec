// --- pages/api/user/get-encryption-salt.js ---
import { getSession } from 'next-auth/react';
import dbConnect from '../../../lib/mongodb';
import User from '../../../models/User';

export default async function handler(req, res) {
    const session = await getSession({ req });

    if (!session) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    await dbConnect();

    if (req.method === 'GET') {
        try {
            const userId = session.user.id;
            const user = await User.findById(userId);

            if (user && user.encryptionSalt) {
                return res.status(200).json({ salt: user.encryptionSalt });
            } else {
                return res.status(404).json({ message: 'Encryption salt not found' });
            }
        } catch (error) {
          console.error("Error getting salt:", error);
            return res.status(500).json({ message: error.message || 'Failed to get encryption salt' });
        }
    }

    return res.status(405).end(`Method ${req.method} Not Allowed`);
}
