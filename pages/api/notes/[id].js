// --- /pages/api/notes/[id].js ---
import { getSession } from 'next-auth/react';
import dbConnect from '../../../lib/mongodb'; // Corrected import
import Note from '../../../models/Note';

export default async function handler(req, res) {
  const session = await getSession({ req });
  if (!session) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  await dbConnect(); // No need to connect again if using adapter.

  const {
    query: { id },
    method,
  } = req;

  const userId = session.user.id;

  switch (method) {
    case 'GET':
      try {
        const note = await Note.findOne({ _id: id, userId });  // Find by both _id and userId
        if (!note) {
          return res.status(404).json({ message: 'Note not found' });
        }
        return res.status(200).json(note);
      } catch (error) {
        return res.status(500).json({ message: error.message });
      }

    case 'PUT':
      try {
        const updatedNote = await Note.findOneAndUpdate(
          { _id: id, userId },  // Find by both _id and userId
          {
            title: req.body.title,
            content: req.body.content,
            tags: req.body.tags,
            updatedAt: Date.now(),
          },
          { new: true, runValidators: true }
        );

        if (!updatedNote) {
          return res.status(404).json({ message: 'Note not found' });
        }
        return res.status(200).json(updatedNote);
      } catch (error) {
        return res.status(500).json({ message: error.message });
      }

    case 'DELETE':
      try {
        const deletedNote = await Note.findOneAndDelete({ _id: id, userId }); // Find by both _id and userId

        if (!deletedNote) {
          return res.status(404).json({ message: 'Note not found' });
        }
        return res.status(200).json({ message: 'Note deleted' });
      } catch (error) {
        return res.status(500).json({ message: error.message });
      }

    default:
      res.setHeader('Allow', ['GET', 'PUT', 'DELETE']);
      return res.status(405).end(`Method ${method} Not Allowed`);
  }
}
