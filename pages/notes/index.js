// --- /pages/notes/index.js ---
import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import NoteList from '../../components/NoteList';
import NoteEditor from '../../components/NoteEditor';
import { encrypt, decrypt, deriveKey } from '../../lib/encryption';

export default function Notes() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [notes, setNotes] = useState([]);
  const [selectedNote, setSelectedNote] = useState(null);
  const [encryptionKey, setEncryptionKey] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [masterPassword, setMasterPassword] = useState('');
  const [hasSetupKey, setHasSetupKey] = useState(false);

  // Проверка аутентификации
  useEffect(() => {
    if (status !== 'loading' && !session) {
      router.push('/');
    }
  }, [session, status, router]);

  // Загрузка заметок
  const fetchNotes = useCallback(async () => {
    if (!session || !encryptionKey) return;

    try {
      const response = await fetch('/api/notes');
      const data = await response.json();
      setNotes(data);
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch notes:', error);
      setLoading(false);
    }
  }, [session, encryptionKey]);

  // Загрузка заметок при изменении ключа шифрования
  useEffect(() => {
    if (encryptionKey) {
      fetchNotes();
    }
  }, [encryptionKey, fetchNotes]);

  // Установка мастер-пароля и создание ключа шифрования
  const setupEncryptionKey = (e) => {
    e.preventDefault();

    if (!masterPassword || masterPassword.length < 8) {
      alert('Пожалуйста, введите мастер-пароль (минимум 8 символов)');
      return;
    }

    try {
      // Используем email пользователя как соль для ключа
      const salt = session.user.email;
      const key = deriveKey(masterPassword, salt);

      // Сохраняем ключ в состоянии (не в localStorage для безопасности)
      setEncryptionKey(key);
      setHasSetupKey(true);

      // Сохраняем признак того, что пользователь настроил ключ в sessionStorage
      // (сам ключ не сохраняем нигде постоянно для безопасности)
      sessionStorage.setItem('hasSetupKey', 'true');
    } catch (error) {
      console.error('Failed to setup encryption key:', error);
      alert('Не удалось создать ключ шифрования');
    }
  };

  // Проверка, был ли уже настроен ключ в текущей сессии
  useEffect(() => {
    if (session) {
      const hasKey = sessionStorage.getItem('hasSetupKey') === 'true';
      setHasSetupKey(hasKey);
    }
  }, [session]);

  // Создание новой заметки
  const createNewNote = () => {
    setSelectedNote(null);
    setIsEditing(true);
  };

  // Выбор и просмотр заметки
  const selectNote = async (note) => {
    setSelectedNote(note);
    setIsEditing(false);
  };

  // Редактирование заметки
  const editNote = () => {
    setIsEditing(true);
  };

  // Получение полной заметки с зашифрованным содержимым
  const fetchFullNote = async (noteId) => {
    try {
      const response = await fetch(`/api/notes/${noteId}`);
      const note = await response.json();
      return note;
    } catch (error) {
      console.error('Failed to fetch note:', error);
      return null;
    }
  };

  // Сохранение заметки
  const saveNote = async (noteData) => {
    try {
      if (noteData._id) {
        // Обновление существующей заметки
        const response = await fetch(`/api/notes/${noteData._id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(noteData),
        });

        if (response.ok) {
          // Обновляем локальный список заметок
          setNotes(notes.map(note =>
            note._id === noteData._id ? { ...note, title: noteData.title } : note
          ));

          setSelectedNote({ ...noteData, content: null }); // Update selectedNote after saving
          setIsEditing(false);
        }
      } else {
        // Создание новой заметки
        const response = await fetch('/api/notes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(noteData),
        });

        if (response.ok) {
          const newNote = await response.json();
          setNotes([{ ...newNote, content: null }, ...notes]);
          setSelectedNote({ ...newNote, content: null }); // And here
          setIsEditing(false);
        }
      }
    } catch (error) {
      console.error('Failed to save note:', error);
      alert('Не удалось сохранить заметку');
    }
  };

  // Удаление заметки
  const deleteNote = async (noteId) => {
    if (!confirm('Вы уверены, что хотите удалить эту заметку?')) {
      return;
    }

    try {
      const response = await fetch(`/api/notes/${noteId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setNotes(notes.filter(note => note._id !== noteId));

        if (selectedNote && selectedNote._id === noteId) {
          setSelectedNote(null);
          setIsEditing(false);
        }
      }
    } catch (error) {
      console.error('Failed to delete note:', error);
      alert('Не удалось удалить заметку');
    }
  };

  // Импорт заметок
  const importNotes = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const reader = new FileReader();

      reader.onload = async (event) => {
        try {
          const importData = JSON.parse(event.target.result);

          if (!importData.notes || !Array.isArray(importData.notes)) {
            throw new Error('Invalid import format');
          }

          const response = await fetch('/api/notes/import', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ notes: importData.notes }),
          });

          if (response.ok) {
            alert('Заметки успешно импортированы');
            fetchNotes();
          } else {
            const error = await response.json();
            throw new Error(error.message);
          }
        } catch (error) {
          console.error('Failed to import notes:', error);
          alert(`Ошибка импорта: ${error.message}`);
        }
      };

      reader.readAsText(file);
    } catch (error) {
      console.error('Failed to read import file:', error);
      alert('Не удалось прочитать файл импорта');
    }
  };

  // Экспорт заметок
  const exportNotes = async () => {
    try {
      const response = await fetch('/api/notes/export');
      const exportData = await response.json();

      // Создаем файл для скачивания
      const dataStr = JSON.stringify(exportData, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const dataUrl = URL.createObjectURL(dataBlob);

      // Создаем временную ссылку для скачивания файла
      const downloadLink = document.createElement('a');
      downloadLink.href = dataUrl;
      downloadLink.download = `secure-notes-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
    } catch (error) {
      console.error('Failed to export notes:', error);
      alert('Не удалось экспортировать заметки');
    }
  };
    // Corrected SVG paths in multiple places below:

  if (status === 'loading') {
    return <div className="flex justify-center items-center h-screen">Loading...</div>;
  }

  if (!session) {
    return null; // Редирект обрабатывается в useEffect
  }

  // Страница для установки мастер-пароля
  if (!hasSetupKey) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full p-6 bg-white rounded-lg shadow-md">
          <h1 className="text-xl font-bold mb-4 text-center">Установите мастер-пароль</h1>
          <p className="mb-4 text-gray-600 text-sm">
            Этот пароль будет использоваться для шифрования ваших заметок.
            Пароль не сохраняется нигде, поэтому важно его запомнить.
          </p>

          <form onSubmit={setupEncryptionKey} className="space-y-4">
            <div>
              <input
                type="password"
                placeholder="Введите мастер-пароль (минимум 8 символов)"
                value={masterPassword}
                onChange={(e) => setMasterPassword(e.target.value)}
                className="w-full p-2 border rounded focus:ring focus:ring-blue-300"
                minLength={8}
                required
              />
            </div>
            <div>
              <button
                type="submit"
                className="w-full px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                Продолжить
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Head>
        <title>Secure Notes</title>
        <meta name="description" content="Secure personal notes application" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div className="container mx-auto px-4 py-8 md:flex md:space-x-4">
        {/* Боковая панель со списком заметок */}
        <div className="md:w-1/3 lg:w-1/4 mb-4 md:mb-0">
          <div className="bg-white p-4 rounded-lg shadow-md">
            <div className="flex justify-between items-center mb-4">
              <h1 className="text-xl font-bold">Мои заметки</h1>
              <button
                onClick={createNewNote}
                className="p-2 bg-blue-500 text-white rounded-full hover:bg-blue-600"
                title="Новая заметка"
              >
                {/* Corrected SVG */}
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-6 h-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>

              </button>
            </div>

            {/* Управление импортом/экспортом */}
            <div className="flex justify-between mb-4">
              <label className="flex items-center justify-center px-3 py-1 bg-gray-100 rounded cursor-pointer hover:bg-gray-200 text-sm">
                {/* Corrected SVG */}
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-4 h-4 mr-1">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m5.231 13.481L15 17.25m-4.5-15H5.625c-.621 0-1.125.504-1.125 1.125v16.5c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9zm3.75 11.625a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                </svg>

                Импорт
                <input
                  type="file"
                  accept=".json"
                  onChange={importNotes}
                  className="hidden"
                />
              </label>

              <button
                onClick={exportNotes}
                className="flex items-center px-3 py-1 bg-gray-100 rounded hover:bg-gray-200 text-sm"
              >
                {/* Corrected SVG */}
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-4 h-4 mr-1">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 20.25c4.97 0 9-3.694 9-8.25s-4.03-8.25-9-8.25S3 7.444 3 12c0 2.104.859 4.023 2.273 5.48.432.447.74 1.04.586 1.641a4.483 4.483 0 01-.923 1.785A5.969 5.969 0 006 21c1.282 0 2.47-.402 3.445-1.087.81.22 1.668.337 2.555.337z" />
                </svg>
                Экспорт
              </button>
            </div>

            {/* Список заметок */}
            {loading ? (
              <div className="text-center py-4">Загрузка...</div>
            ) : notes.length === 0 ? (
              <div className="text-center py-4 text-gray-500">Нет заметок</div>
            ) : (
              <div className="space-y-2 max-h-[70vh] overflow-y-auto">
                {notes.map(note => (
                  <div
                    key={note._id}
                    className={`p-3 rounded cursor-pointer hover:bg-gray-100 ${
                      selectedNote && selectedNote._id === note._id ? 'bg-blue-100' : ''
                    }`}
                    onClick={() => selectNote(note)}
                  >
                    <h3 className="font-medium truncate">{note.title || 'Без заголовка'}</h3>
                    <p className="text-xs text-gray-500">
                      {new Date(note.updatedAt).toLocaleDateString()}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Основная область просмотра/редактирования */}
        <div className="md:w-2/3 lg:w-3/4">
          <div className="bg-white p-4 rounded-lg shadow-md min-h-[70vh]">
            {selectedNote && !isEditing ? (
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-bold">{selectedNote.title || 'Без заголовка'}</h2>
                  <div className="flex space-x-2">
                    <button
                      onClick={editNote}
                      className="p-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                      title="Редактировать"
                    >
                      {/* Corrected SVG */}
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-6 h-6">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" />
                      </svg>
                    </button>
                    <button
                      onClick={() => deleteNote(selectedNote._id)}
                      className="p-2 bg-red-500 text-white rounded hover:bg-red-600"
                      title="Удалить"
                    >
                      {/* Corrected SVG */}
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-6 h-6">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                      </svg>
                    </button>
                  </div>
                </div>

                <div className="mb-4">
                  <p className="text-sm text-gray-500">
                    Последнее обновление: {new Date(selectedNote.updatedAt).toLocaleString()}
                  </p>
                </div>

                {selectedNote.content ? (
                  <div className="prose max-w-none">
                    {/* Content will be decrypted and displayed by NoteEditor during edit */}
                    {/* Decrypt and display content here only for viewing */}
                    {decrypt(selectedNote.content, encryptionKey)}
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <p>Загрузка содержимого...</p>
                    <button
                      onClick={async () => {
                        const fullNote = await fetchFullNote(selectedNote._id);
                        if (fullNote) {
                          setSelectedNote(fullNote); // Update with full content
                        }
                      }}
                      className="mt-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                    >
                      Загрузить
                    </button>
                  </div>
                )}

                {selectedNote.tags && selectedNote.tags.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {selectedNote.tags.map(tag => (
                      <span
                        key={tag}
                        className="px-2 py-1 bg-gray-100 rounded-full text-xs"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ) : isEditing ? (
              <div>
                <h2 className="text-xl font-bold mb-4">
                  {selectedNote ? 'Редактирование заметки' : 'Новая заметка'}
                </h2>
                <NoteEditor
                  note={selectedNote}
                  encryptionKey={encryptionKey}
                  onSave={saveNote}
                  onCancel={() => {
                    setIsEditing(false);
                    if (!selectedNote) {
                      setSelectedNote(null); // Reset if creating a new note and cancel
                    }
                  }}
                />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-[60vh] text-gray-500">
                {/* Corrected SVG */}
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-16 h-16 mb-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>

                <p>Выберите заметку или создайте новую</p>
                <button
                  onClick={createNewNote}
                  className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                >
                  Создать заметку
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
