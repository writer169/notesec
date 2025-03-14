// --- pages/api/user/get-encryption-salt.js ---
import { getSession } from 'next-auth/react';
import clientPromise from '../../../lib/mongodb'; // Импортируем clientPromise
import { ObjectId } from 'mongodb';

export default async function handler(req, res) {
    const session = await getSession({ req });

    if (!session) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    // await dbConnect();  //  dbConnect больше нет!

    if (req.method === 'GET') {
        try {
            const userId = session.user.id;
            const client = await clientPromise; // Получаем клиент
            const db = client.db(); // Получаем базу данных (имя базы данных по умолчанию из строки подключения)
            // const db = client.db("your-database-name"); // Или явно укажи имя базы данных
            const user = await db.collection('users').findOne({ _id: new ObjectId(userId) }); // Ищем пользователя

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
