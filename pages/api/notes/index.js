// --- /pages/api/notes/index.js ---
import { getSession } from 'next-auth/react';
// import dbConnect from '../../../lib/mongodb';  // Corrected import // УДАЛЯЕМ
// import Note from '../../../models/Note'; // УДАЛЯЕМ
import clientPromise from '../../../lib/mongodb';
import { ObjectId } from 'mongodb';

export default async function handler(req, res) {
  const session = await getSession({ req });

  if (!session) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  // await dbConnect(); // No need to connect again if using adapter  // УДАЛЯЕМ

  const { method } = req;
  const userId = session.user.id;

    const client = await clientPromise; // Получаем клиент MongoDB
    const db = client.db(); // Получаем базу данных

  switch (method) {
    case 'GET':
      try {
        // const notes = await Note.find({ userId }).sort({ updatedAt: -1 }).select('-content'); // Заменяем на:
          const notes = await db.collection('notes').find({ userId: new ObjectId(userId) }).sort({ updatedAt: -1 }).project({ content: 0 }).toArray();
        return res.status(200).json(notes);
      } catch (error) {
        return res.status(500).json({ message: error.message });
      }

    case 'POST':
      try {
        // const note = new Note({
        //   userId,
        //   title: req.body.title || 'Untitled',
        //   content: req.body.content,
        //   tags: req.body.tags || [],
        // });

        // await note.save();
        // return res.status(201).json(note);

        // Заменяем на:
          const note = {
            userId: new ObjectId(userId), // Преобразуем в ObjectId
            title: req.body.title || 'Untitled',
            content: req.body.content,
            tags: req.body.tags || [],
            createdAt: new Date(), // Добавляем timestamps
            updatedAt: new Date(),
          };
          const result = await db.collection('notes').insertOne(note);
          const newNote = await db.collection('notes').findOne({_id: result.insertedId}); //получаем добавленную заметку
        return res.status(201).json(newNote);


      } catch (error) {
        return res.status(500).json({ message: error.message });
      }

    default:
      res.setHeader('Allow', ['GET', 'POST']);
      return res.status(405).end(`Method ${method} Not Allowed`);
  }
}
