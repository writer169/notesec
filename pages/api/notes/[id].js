// --- /pages/api/notes/[id].js ---
import { getSession } from 'next-auth/react';
import clientPromise from '../../../../lib/mongodb'; // Правильный относительный путь
import { ObjectId } from 'mongodb';

export default async function handler(req, res) {
    const session = await getSession({ req });

    if (!session) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    const {
        query: { id },
        method,
    } = req;

    const client = await clientPromise;
    const db = client.db();

    switch (method) {
        case 'GET':
            try {
                const note = await db.collection('notes').findOne({ _id: new ObjectId(id) });
                if (!note) {
                    return res.status(404).json({ message: 'Note not found' });
                }
                return res.status(200).json(note);
            } catch (error) {
                return res.status(500).json({ message: error.message });
            }

        case 'PUT':
            try {
                const { title, content, tags } = req.body;
                const result = await db.collection('notes').findOneAndUpdate(
                    { _id: new ObjectId(id), userId: new ObjectId(session.user.id) }, // Проверяем userId
                    { $set: { title, content, tags, updatedAt: new Date() } },
                    { returnDocument: 'after' } // Возвращаем обновленный документ
                );

                if (!result) {
                    return res.status(404).json({ message: 'Note not found or unauthorized' });
                }

                return res.status(200).json(result);
            } catch (error) {
                return res.status(500).json({ message: error.message });
            }

        case 'DELETE':
            try {
                const result = await db.collection('notes').deleteOne({ _id: new ObjectId(id), userId: new ObjectId(session.user.id) }); // Проверяем userId

                if (result.deletedCount === 0) {
                    return res.status(404).json({ message: 'Note not found or unauthorized' });
                }
                return res.status(204).end(); // No Content
            }
            catch (error) {
                return res.status(500).json({ message: error.message });
            }

        default:
            res.setHeader('Allow', ['GET', 'PUT', 'DELETE']);
            return res.status(405).end(`Method ${method} Not Allowed`);
    }
}
