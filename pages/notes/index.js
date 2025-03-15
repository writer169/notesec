// --- /pages/notes/index.js ---
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import NoteList from '../../components/NoteList';
import NoteEditor from '../../components/NoteEditor';
import { encrypt, decrypt, deriveKey } from '../../lib/encryption';
import { getSession } from 'next-auth/react';
// import crypto from 'crypto'; // УДАЛЯЕМ! crypto больше не нужен на клиенте
import Modal from '../../components/Modal';
import clientPromise from '../../lib/mongodb';
import { ObjectId } from 'mongodb';

export default function Notes({ initialNotes, hasSetupKey: initialHasSetupKey, initialSalt, error }) {
  const router = useRouter();
  const [notes, setNotes] = useState(initialNotes || []);
  const [selectedNote, setSelectedNote] = useState(null);
  const [encryptionKey, setEncryptionKey] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [masterPassword, setMasterPassword] = useState('');
  const [hasSetupKey, setHasSetupKey] = useState(initialHasSetupKey);
  const [salt, setSalt] = useState(initialSalt);
  const [showMasterPasswordModal, setShowMasterPasswordModal] = useState(false);
  const [showUnlockModal, setShowUnlockModal] = useState(false); // Добавили состояние для модалки разблокировки
  const [errorMessage, setErrorMessage] = useState(error || '');

  const fetchNotes = useCallback(async () => {
    if (!encryptionKey) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const response = await fetch('/api/notes');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      const decryptedNotes = data.map(note => {
        if (note.content) {
          try {
            return { ...note, content: decrypt(note.content, encryptionKey) };
          } catch (e) {
            console.error("Decryption error", e);
            return { ...note, content: null, error: 'Decryption failed' }
          }
        }
        return note;
      });

      setNotes(decryptedNotes);
    } catch (error) {
      console.error('Failed to fetch notes:', error);
      setErrorMessage('Не удалось загрузить заметки.');
    } finally {
      setLoading(false);
    }
  }, [encryptionKey]);

  useEffect(() => {
    if (encryptionKey) {
      fetchNotes();
    }
  }, [encryptionKey, fetchNotes]);

  const handleSetupMasterPassword = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (!masterPassword || masterPassword.length < 8) {
      setErrorMessage('Master password must be at least 8 characters long.');
      return;
    }

    try {
      const response = await fetch('/api/user/setup-encryption-key', { // Вызываем API-маршрут
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ masterPassword }), // Передаем только мастер-пароль
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to set up encryption key.');
      }

      setShowMasterPasswordModal(false);
      setMasterPassword('');
      //Сразу после установки ключа шифрования запрашиваем его, чтобы отобразить заметки
      setShowUnlockModal(true);

    } catch (error) {
      console.error('Failed to setup encryption key:', error);
      setErrorMessage(error.message || 'Failed to set up encryption key.');
    }
  };

  const unlockNotes = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (!masterPassword || masterPassword.length < 8) {
      setErrorMessage('Please enter your master password.');
      return;
    }

    try {
      // Получаем соль с сервера
      const saltResponse = await fetch('/api/user/get-encryption-salt');
      if (!saltResponse.ok) {
        const errorData = await saltResponse.json();
        throw new Error(errorData.message || 'Failed to get encryption salt.');
      }
      const { salt: fetchedSalt } = await saltResponse.json();
      setSalt(fetchedSalt);

      // Генерируем ключ
      const key = deriveKey(masterPassword, Buffer.from(fetchedSalt, 'hex'));
      setEncryptionKey(key);
      setHasSetupKey(true); // hasSetupKey теперь устанавливаем, когда знаем, что ключ получен
      setShowUnlockModal(false);
      setMasterPassword('');

    } catch (error) {
      console.error('Failed to unlock notes:', error);
      setErrorMessage(error.message || 'Failed to unlock notes.');
    }
  };

  const createNewNote = () => {
    setSelectedNote(null);
    setIsEditing(true);
  };

  const selectNote = (note) => {
    setSelectedNote(note);
    setIsEditing(false);
  };

  const editNote = () => {
    setIsEditing(true);
  };

  const fetchFullNote = async (noteId) => {
    try {
      const response = await fetch(`/api/notes/${noteId}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const note = await response.json();

      if (note.content && encryptionKey) {
        try {
          const decryptedContent = decrypt(note.content, encryptionKey);
          return { ...note, content: decryptedContent };
        } catch (error) {
          console.error('Ошибка при расшифровке заметки:', error);
          return { ...note, content: null, error: 'Decryption failed' };
        }
      }

      return note;
    } catch (error) {
      console.error('Failed to fetch full note:', error);
      setErrorMessage('Не удалось загрузить полное содержимое заметки.');
      return null;
    }
  };

  const saveNote = async (noteData) => {
    if (!encryptionKey) {
      setErrorMessage('Encryption key is not available');
      return;
    }

    try {
      const encryptedNoteData = {
        ...noteData,
        content: noteData.content ? encrypt(noteData.content, encryptionKey) : null,
      };

      const url = encryptedNoteData._id ? `/api/notes/${encryptedNoteData._id}` : '/api/notes';
      const method = encryptedNoteData._id ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(encryptedNoteData),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const updatedNote = await response.json();

      if (method === 'PUT') {
        setNotes((prevNotes) =>
          prevNotes.map((note) =>
            note._id === updatedNote._id ? { ...note, title: updatedNote.title } : note
          )
        );
        if (selectedNote && selectedNote._id === updatedNote._id) {
          setSelectedNote((prevSelectedNote) => ({
            ...prevSelectedNote,
            title: updatedNote.title,
          }));
        }
      } else {
        try {
          const decryptedContent = decrypt(updatedNote.content, encryptionKey);
          setNotes((prevNotes) => [
            { _id: updatedNote._id, title: updatedNote.title, updatedAt: updatedNote.updatedAt, content: decryptedContent },
            ...prevNotes,
          ]);
          setSelectedNote({
            _id: updatedNote._id,
            title: updatedNote.title,
            updatedAt: updatedNote.updatedAt,
            content: decryptedContent
          });
        }
        catch (error){
          console.error('Failed to decrypt new note:', error);
          setNotes((prevNotes) => [
            { _id: updatedNote._id, title: updatedNote.title, updatedAt: updatedNote.updatedAt, content: null, error: "Decryption failed" },
            ...prevNotes,
          ]);
          setSelectedNote({
            _id: updatedNote._id,
            title: updatedNote.title,
            updatedAt: updatedNote.updatedAt,
            content: null, error: "Decryption failed"
          });
        }

      }
      setIsEditing(false);

    } catch (error) {
      console.error('Failed to save note:', error);
      setErrorMessage(`Не удалось сохранить заметку: ${error.message}`);
    }
  };

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
      setErrorMessage(`Не удалось удалить заметку: ${error.message}`);
    }
  };

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

        const encryptedNotes = importData.notes.map((note) => ({
          ...note,
          content: note.content ? encrypt(note.content, encryptionKey) : null,
        }));

        const response = await fetch('/api/notes/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ notes: encryptedNotes }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Failed to import notes');
        }

        alert('Заметки успешно импортированы');
        fetchNotes();
      } catch (error) {
        console.error('Failed to import notes:', error);
        setErrorMessage(`Ошибка импорта: ${error.message}`);
      }
    };

    reader.onerror = () => {
      setErrorMessage('Не удалось прочитать файл.');
    };

    reader.readAsText(file);
  };

  const exportNotes = async () => {
    try {
      const response = await fetch('/api/notes');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const notesFromApi = await response.json();

      const decryptedNotes = notesFromApi.map(note => {
        if (note.content) {
          try {
            const decryptedContent = decrypt(note.content, encryptionKey);
            return { ...note, content: decryptedContent };
          } catch (error) {
            console.error('Ошибка при расшифровке заметки для экспорта:', error);
            return { ...note, content: null, error: 'Decryption failed' };
          }
        }
        return note;
      });

      const exportData = {
        notes: decryptedNotes,
      };

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
      setErrorMessage('Не удалось экспортировать заметки.');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Head>
        <title>Secure Notes</title>
        <meta name="description" content="Secure personal notes application" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      {/* Master Password Modal */}
      <Modal isOpen={showMasterPasswordModal} onClose={() => setShowMasterPasswordModal(false)}>
        <div className="p-6">
          <h2 className="text-lg font-bold mb-4">Enter Master Password</h2>
          <form onSubmit={handleSetupMasterPassword} className="space-y-4">
            {errorMessage && <p className="text-red-500 text-sm">{errorMessage}</p>}
            <div>
              <input
                type="password"
                placeholder="Master Password"
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
              Set Up Master Password
            </button>
          </form>
        </div>
      </Modal>

      {/* Unlock Notes Modal */}
      <Modal isOpen={showUnlockModal} onClose={() => setShowUnlockModal(false)}>
        <div className="p-6">
          <h2 className="text-lg font-bold mb-4">Enter Master Password</h2>
          <form onSubmit={unlockNotes} className="space-y-4">
            {errorMessage && <p className="text-red-500 text-sm">{errorMessage}</p>}
            <div>
              <input
                type="password"
                placeholder="Master Password"
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
              Unlock Notes
            </button>
          </form>
        </div>
      </Modal>

      <div className="container mx-auto px-4 py-8 md:flex md:space-x-4">
        <div className="md:w-1/4 mb-8 md:mb-0">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-xl font-bold">Заметки</h1>
              {!hasSetupKey && (
                <button
                  onClick={(e) => { e.preventDefault(); setShowMasterPasswordModal(true); }}
                  className="bg-blue-500 hover:bg-blue-600 text-white rounded-full p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  title="Установить мастер-пароль"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-6 h-6">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                </button>
              )}
              {hasSetupKey && !encryptionKey &&(
                <button
                    onClick={(e) => { e.preventDefault(); setShowUnlockModal(true); }}
                    className="bg-blue-500 hover:bg-blue-600 text-white rounded-full p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    title="Разблокировать"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-6 h-6">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                </button>
              )}
              {hasSetupKey && encryptionKey && (
                <button
                  onClick={createNewNote}
                  className="bg-blue-500 hover:bg-blue-600 text-white rounded-full p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  title="Новая заметка"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-6 h-6">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                </button>
              )}
            </div>

            {hasSetupKey && encryptionKey && (
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
            )}

            {loading ? (
              <div className="text-center py-4">Загрузка...</div>
            ) :  notes.length === 0 && hasSetupKey ? (
              <div className="text-center py-4 text-gray-500">Нет заметок</div>
            ) : !hasSetupKey ? (
              <div className="text-center py-4 text-gray-500">Настройте мастер-пароль</div>
            ) : (
              <NoteList notes={notes} onSelect={selectNote} onDelete={deleteNote} />
            )}
          </div>
        </div>

        {hasSetupKey && (
          <div className="md:w-3/4">
            <div className="bg-white rounded-lg shadow p-4 min-h-[70vh]">
              {selectedNote && !isEditing ? (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold">{selectedNote.title || 'Без заголовка'}</h2>
                    {encryptionKey && (
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
                    )}
                  </div>
                  <p className="text-sm text-gray-500 mb-4">
                    Последнее обновление: {new Date(selectedNote.updatedAt).toLocaleString()}
                  </p>
                  {selectedNote.content !== null ? (
                    <div className="prose">
                      {selectedNote.content}
                    </div>
                  ) : (
                    <div className="text-center py-4">
                      <p>Загрузка содержимого...</p>
                      {encryptionKey && (
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
                      )}
                    </div>
                  )}
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
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-16 h-16 text-gray-400 mb-4 mx-auto">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-gray-600">Выберите заметку или создайте новую</p>
                    {encryptionKey && (
                      <button
                        onClick={createNewNote}
                        className="bg-blue-500 hover:bg-blue-600 text-white rounded p-2 mt-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        Создать заметку
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
        {errorMessage && (
          <div className="fixed bottom-4 right-4 bg-red-500 text-white p-4 rounded-md shadow-lg z-50">
            <p>{errorMessage}</p>
          </div>
        )}
      </div>
    </div>
  );
}

export async function getServerSideProps(context) {
  const session = await getSession(context);

  if (!session) {
    return {
      redirect: {
        destination: '/api/auth/signin',
        permanent: false,
      },
    };
  }

  try {
    const client = await clientPromise;
    const db = client.db();

    const userId = session.user.id;
    const user = await db.collection('users').findOne({ _id: new ObjectId(userId) });
    let hasSetupKey = false;
    let initialSalt = null;
    let initialNotes = [];

    if (user && user.encryptionSalt) {
      hasSetupKey = true;
      initialSalt = user.encryptionSalt;

      const encryptedNotes = await db.collection('notes').find({ userId: new ObjectId(userId) }).sort({ updatedAt: -1 }).project({ content: 0 }).toArray();
      initialNotes = encryptedNotes.map(note => ({
        _id: note._id.toString(),
        title: note.title,
        updatedAt: note.updatedAt.toISOString(),
        tags: note.tags,
        content: note.content
      }));
    }
    return {
      props: {
        initialNotes: JSON.parse(JSON.stringify(initialNotes)),
        hasSetupKey,
        initialSalt,
      },
    };
  }
  catch(error){
    console.error("Failed to fetch data:", error);
    return {
      props: {
        initialNotes: [],
        hasSetupKey: false,
        initialSalt: null,
        error: "Failed to connect to the database",
      },
    };
  }
}