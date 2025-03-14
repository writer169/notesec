import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import NoteList from '../../components/NoteList';
import NoteEditor from '../../components/NoteEditor';
import { encrypt, decrypt, deriveKey } from '../../lib/encryption';
import { getServerSideProps } from '../../lib/auth'; // Import from lib/auth.js

export default function Notes({ session }) {
  const { data: clientSession, status } = useSession();
  const router = useRouter();
  const [notes, setNotes] = useState([]);
  const [selectedNote, setSelectedNote] = useState(null);
  const [encryptionKey, setEncryptionKey] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [masterPassword, setMasterPassword] = useState('');
  const [hasSetupKey, setHasSetupKey] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  // Use client-side session data when available, fallback to server-side
  const activeSession = clientSession || session;

  // Prevent rendering until mounted
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Client-side redirect if unauthenticated (only after mounting)
  useEffect(() => {
    if (isMounted && status === 'unauthenticated' && !session) {
      router.push('/');
    }
  }, [isMounted, status, session, router]);

  // Fetch notes (only if there's a session and an encryption key)
  const fetchNotes = useCallback(async () => {
    if (!activeSession || !encryptionKey) {
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/notes');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setNotes(data);
    } catch (error) {
      console.error('Failed to fetch notes:', error);
      alert('Не удалось загрузить заметки. Пожалуйста, обновите страницу.');
    } finally {
      setLoading(false);
    }
  }, [activeSession, encryptionKey]);

  // Load notes when encryption key changes
  useEffect(() => {
    if (isMounted && encryptionKey) {
      fetchNotes();
    }
  }, [isMounted, encryptionKey, fetchNotes]);

  // Setup master password
  const setupEncryptionKey = (e) => {
    e.preventDefault();

    if (!masterPassword || masterPassword.length < 8) {
      alert('Пожалуйста, введите мастер-пароль (минимум 8 символов)');
      return;
    }

    if (!activeSession) {
      alert('Сессия не найдена. Пожалуйста, войдите снова.');
      return;
    }

    try {
      const salt = activeSession.user.email;
      const key = deriveKey(masterPassword, salt);
      setEncryptionKey(key);
      setHasSetupKey(true);
      sessionStorage.setItem('hasSetupKey', 'true');
    } catch (error) {
      console.error('Failed to setup encryption key:', error);
      alert('Не удалось создать ключ шифрования');
    }
  };

  // Check for key in sessionStorage
  useEffect(() => {
    if (isMounted && activeSession) {
      const hasKey = sessionStorage.getItem('hasSetupKey') === 'true';
      setHasSetupKey(hasKey);
    }
  }, [isMounted, activeSession]);

  // Create new note
  const createNewNote = () => {
    setSelectedNote(null);
    setIsEditing(true);
  };

  // Select and view note
  const selectNote = (note) => {
    setSelectedNote(note);
    setIsEditing(false);
  };

  // Edit note
  const editNote = () => {
    setIsEditing(true);
  };

  // Fetch full note (encrypted content)
  const fetchFullNote = async (noteId) => {
    try {
      const response = await fetch(`/api/notes/${noteId}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const note = await response.json();
      return note;
    } catch (error) {
      console.error('Failed to fetch full note:', error);
      alert('Не удалось загрузить полное содержимое заметки.');
      return null;
    }
  };

  // Save note
  const saveNote = async (noteData) => {
    try {
      const url = noteData._id ? `/api/notes/${noteData._id}` : '/api/notes';
      const method = noteData._id ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(noteData),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const updatedNote = await response.json();

      if (method === 'PUT') {
        setNotes(prevNotes =>
          prevNotes.map(note => (note._id === updatedNote._id ? { ...note, title: updatedNote.title } : note))
        );
      } else {
        setNotes(prevNotes => [{ ...updatedNote, content: null }, ...prevNotes]);
      }
      setSelectedNote({ ...updatedNote, content: null }); // Clear content after saving
      setIsEditing(false);

    } catch (error) {
      console.error('Failed to save note:', error);
      alert(`Не удалось сохранить заметку: ${error.message}`);
    }
  };

  // Delete note
  const deleteNote = async (noteId) => {
    if (!confirm('Вы уверены, что хотите удалить эту заметку?')) {
      return;
    }

    try {
      const response = await fetch(`/api/notes/${noteId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      setNotes(prevNotes => prevNotes.filter(note => note._id !== noteId));
      if (selectedNote && selectedNote._id === noteId) {
        setSelectedNote(null);
        setIsEditing(false);
      }
    } catch (error) {
      console.error('Failed to delete note:', error);
      alert(`Не удалось удалить заметку: ${error.message}`);
    }
  };

  // Import notes
  const importNotes = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

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

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Failed to import notes');
        }

        alert('Заметки успешно импортированы');
        fetchNotes(); // Reload notes after successful import
      } catch (error) {
        console.error('Failed to import notes:', error);
        alert(`Ошибка импорта: ${error.message}`);
      }
    };

    reader.onerror = () => {
      alert('Не удалось прочитать файл.');
    };

    reader.readAsText(file);
  };

  // Export notes
  const exportNotes = async () => {
    try {
      const response = await fetch('/api/notes/export');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const exportData = await response.json();

      const dataStr = JSON.stringify(exportData, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const dataUrl = URL.createObjectURL(dataBlob);

      const downloadLink = document.createElement('a');
      downloadLink.href = dataUrl;
      downloadLink.download = `secure-notes-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
    } catch (error) {
      console.error('Failed to export notes:', error);
      alert('Не удалось экспортировать заметки.');
    }
  };

  if (!isMounted) {
    return <div className="flex justify-center items-center h-screen">Loading...</div>;
  }

  if (!activeSession) {
    return null; // Will be handled by getServerSideProps redirect
  }

  // Master password setup page
  if (!hasSetupKey) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full p-6 bg-white rounded-lg shadow-md">
          <h1 className="text-xl font-bold mb-4 text-center">Установите мастер-пароль</h1>
          <p className="mb-4 text-gray-600 text-sm">
            Этот пароль будет использоваться для шифрования ваших заметок. Он не сохраняется, поэтому важно его запомнить.
          </p>
          <form onSubmit={setupEncryptionKey} className="space-y-4">
            <div>
              <input
                type="password"
                placeholder="Мастер-пароль (мин. 8 символов)"
                value={masterPassword}
                onChange={(e) => setMasterPassword(e.target.value)}
                className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
                minLength="8"
              />
            </div>
            <button
              type="submit"
              className="w-full bg-blue-500 text-white p-2 rounded hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              Установить пароль
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Main notes interface
  return (
    <div className="min-h-screen bg-gray-50">
      <Head>
        <title>Secure Notes</title>
        <meta name="description" content="Secure personal notes application" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className="container mx-auto px-4 py-8 md:flex md:space-x-4">
        {/* Sidebar */}
        <div className="md:w-1/4 mb-8 md:mb-0">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-xl font-bold">Заметки</h1>
              <button
                onClick={createNewNote}
                className="bg-blue-500 hover:bg-blue-600 text-white rounded-full p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                title="Новая заметка"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-6 h-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
              </button>
            </div>

            {/* Import/Export Buttons */}
            <div className="flex justify-between mb-4">
              <label className="flex items-center justify-center px-3 py-1 bg-gray-100 rounded cursor-pointer hover:bg-gray-200 text-sm">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-4 h-4 mr-1">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m5.231 13.481L15 17.25m-4.5-15H5.625c-.621 0-1.125.504-1.125 1.125v16.5c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9zm3.75 11.625a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                </svg>
                <span>Импорт</span>
                <input type="file" accept=".json" onChange={importNotes} className="hidden" />
              </label>

              <button onClick={exportNotes} className="flex items-center px-3 py-1 bg-gray-100 rounded hover:bg-gray-200 text-sm">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-4 h-4 mr-1">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 20.25c4.97 0 9-3.694 9-8.25s-4.03-8.25-9-8.25S3 7.444 3 12c0 2.104.859 4.023 2.273 5.48.432.447.74 1.04.586 1.641a4.483 4.483 0 01-.923 1.785A5.969 5.969 0 006 21c1.282 0 2.47-.402 3.445-1.087.81.22 1.668.337 2.555.337z" />
                </svg>
                <span>Экспорт</span>
              </button>
            </div>

            {/* Note List */}
            {loading ? (
              <div className="text-center py-4">Загрузка...</div>
            ) : notes.length === 0 ? (
              <div className="text-center py-4 text-gray-500">Нет заметок</div>
            ) : (
              <NoteList notes={notes} onSelect={selectNote} onDelete={deleteNote} />
            )}
          </div>
        </div>

        {/* Main Content Area */}
        <div className="md:w-3/4">
          <div className="bg-white rounded-lg shadow p-4 min-h-[70vh]">
            {selectedNote && !isEditing ? (
              // Note View
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold">{selectedNote.title || 'Без заголовка'}</h2>
                  <div className="flex space-x-2">
                    <button
                      onClick={editNote}
                      className="bg-blue-500 hover:bg-blue-600 text-white rounded p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      title="Редактировать"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-6 h-6">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" />
                      </svg>
                    </button>
                    <button
                      onClick={() => deleteNote(selectedNote._id)}
                      className="bg-red-500 hover:bg-red-600 text-white rounded p-2 focus:outline-none focus:ring-2 focus:ring-red-500"
                      title="Удалить"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-6 h-6">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                      </svg>
                    </button>
                  </div>
                </div>
                <p className="text-sm text-gray-500 mb-4">
                  Последнее обновление: {new Date(selectedNote.updatedAt).toLocaleString()}
                </p>
                {selectedNote.content ? (
                  <div className="prose">
                    {decrypt(selectedNote.content, encryptionKey)}
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <p>Загрузка содержимого...</p>
                    <button
                      onClick={async () => {
                        const fullNote = await fetchFullNote(selectedNote._id);
                        if (fullNote) {
                          setSelectedNote(fullNote);
                        }
                      }}
                      className="bg-blue-500 hover:bg-blue-600 text-white rounded p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      Загрузить
                    </button>
                  </div>
                )}
                {/* Display Tags */}
                {selectedNote.tags && selectedNote.tags.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {selectedNote.tags.map((tag) => (
                      <span key={tag} className="bg-gray-200 rounded-full px-3 py-1 text-xs font-semibold text-gray-700">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ) : isEditing ? (
              // Note Editor
              <div>
                <h2 className="text-xl font-bold mb-4">
                  {selectedNote ? 'Редактировать заметку' : 'Новая заметка'}
                </h2>
                <NoteEditor
                  note={selectedNote}
                  encryptionKey={encryptionKey}
                  onSave={saveNote}
                  onCancel={() => {
                    setIsEditing(false);
                    if (!selectedNote) {
                      setSelectedNote(null);
                    }
                  }}
                />
              </div>
            ) : (
              // Default View (No Note Selected)
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-16 h-16 text-gray-400 mb-4 mx-auto">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-gray-600">Выберите заметку или создайте новую</p>
                  <button
                    onClick={createNewNote}
                    className="bg-blue-500 hover:bg-blue-600 text-white rounded p-2 mt-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    Создать заметку
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Export the getServerSideProps function
export { getServerSideProps };
