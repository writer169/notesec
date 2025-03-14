// --- /pages/api/notes/import.js ---
import { getSession } from 'next-auth/react';
import Note from '../../../models/Note';

export default async function handler(req, res) {
  const session = await getSession({ req });

  if (!session) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { notes } = req.body;

    if (!Array.isArray(notes)) {
      return res.status(400).json({ message: 'Invalid import format' });
    }

    const userId = session.user.id;

    // Проверяем каждую заметку перед импортом
    const validNotes = notes.filter(note =>
      note.content &&
      note.content.iv &&
      note.content.encrypted &&
      note.content.authTag
    ).map(note => ({
      ...note,
      userId, // Устанавливаем текущего пользователя как владельца
      _id: undefined // Удаляем ID, чтобы MongoDB создал новый
    }));

    if (validNotes.length === 0) {
      return res.status(400).json({ message: 'No valid notes to import' });
    }

    await Note.insertMany(validNotes);

    return res.status(200).json({
      message: `Successfully imported ${validNotes.length} notes`
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}
