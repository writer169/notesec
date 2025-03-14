// --- /pages/api/notes/export.js ---
import { getSession } from 'next-auth/react';
import Note from '../../../models/Note';

export default async function handler(req, res) {
  const session = await getSession({ req });

  if (!session) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const notes = await Note.find({ userId: session.user.id });

    // Возвращаем данные в формате, который можно будет импортировать позже
    return res.status(200).json({
      exportedAt: new Date().toISOString(),
      notes: notes
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}
