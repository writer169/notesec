// --- /pages/api/notes/index.js ---
import { getSession } from 'next-auth/react';
import dbConnect from '../../../lib/mongodb';  // Corrected import
import Note from '../../../models/Note';

export default async function handler(req, res) {
  const session = await getSession({ req });

  if (!session) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  await dbConnect(); // No need to connect again if using adapter

  const { method } = req;
  const userId = session.user.id;

  switch (method) {
    case 'GET':
      try {
        const notes = await Note.find({ userId }).sort({ updatedAt: -1 }).select('-content');
        return res.status(200).json(notes);
      } catch (error) {
        return res.status(500).json({ message: error.message });
      }

    case 'POST':
      try {
        const note = new Note({
          userId,
          title: req.body.title || 'Untitled',
          content: req.body.content,
          tags: req.body.tags || [],
        });

        await note.save();
        return res.status(201).json(note);
      } catch (error) {
        return res.status(500).json({ message: error.message });
      }

    default:
      res.setHeader('Allow', ['GET', 'POST']);
      return res.status(405).end(`Method ${method} Not Allowed`);
  }
}
