// --- /components/NoteEditor.js ---
import { useState, useEffect } from 'react';
import { encrypt, decrypt } from '../lib/encryption';

export default function NoteEditor({ note, encryptionKey, onSave, onCancel }) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [tags, setTags] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (note) {
      setTitle(note.title || '');

      if (note.content && encryptionKey) {
        try {
          const decryptedContent = decrypt(note.content, encryptionKey);
          setContent(decryptedContent);
        } catch (error) {
          console.error('Failed to decrypt note:', error);
          setContent('');
        }
      } else {
        setContent('');
      }

      setTags((note.tags || []).join(', '));
    } else {
      setTitle('');
      setContent('');
      setTags('');
    }
  }, [note, encryptionKey]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!encryptionKey) {
      alert('Encryption key is not available');
      return;
    }

    try {
      setIsSaving(true);

      const encryptedContent = encrypt(content, encryptionKey);

      const tagArray = tags
        .split(',')
        .map(tag => tag.trim())
        .filter(tag => tag.length > 0);

      await onSave({
        ...note,
        title,
        content: encryptedContent,
        tags: tagArray,
      });

      setIsSaving(false);
    } catch (error) {
      console.error('Error saving note:', error);
      setIsSaving(false);
      alert('Failed to save note');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <input
          type="text"
          placeholder="Заголовок"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full p-2 border rounded focus:ring focus:ring-blue-300"
        />
      </div>

      <div>
        <textarea
          placeholder="Содержание заметки"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="w-full p-2 border rounded focus:ring focus:ring-blue-300 min-h-[200px]"
        />
      </div>

      <div>
        <input
          type="text"
          placeholder="Теги (через запятую)"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          className="w-full p-2 border rounded focus:ring focus:ring-blue-300"
        />
      </div>

      <div className="flex justify-end space-x-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 border rounded hover:bg-gray-100"
        >
          Отмена
        </button>
        <button
          type="submit"
          disabled={isSaving}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-blue-300"
        >
          {isSaving ? 'Сохранение...' : 'Сохранить'}
        </button>
      </div>
    </form>
  );
}
