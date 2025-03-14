// --- /components/NoteList.js ---
import { useState } from 'react';

export default function NoteList({ notes, onSelect, onDelete }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedId, setSelectedId] = useState(null);

  const filteredNotes = notes.filter(note =>
    note.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSelect = (note) => {
    setSelectedId(note._id);
    onSelect(note);
  };

  return (
    <div>
      <div className="mb-4">
        <input
          type="text"
          placeholder="Поиск..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full p-2 border rounded focus:ring focus:ring-blue-300"
        />
      </div>

      <div className="space-y-2">
        {filteredNotes.length === 0 ? (
          <div className="text-center py-4 text-gray-500">Нет результатов</div>
        ) : (
          filteredNotes.map(note => (
            <div
              key={note._id}
              className={`p-3 rounded cursor-pointer hover:bg-gray-100 ${
                selectedId === note._id ? 'bg-blue-100' : ''
              }`}
              onClick={() => handleSelect(note)}
            >
              <div className="flex justify-between">
                <h3 className="font-medium truncate">{note.title || 'Без заголовка'}</h3>
                <button
                  onClick={(e) => {
                    e.stopPropagation(); // Prevent note selection when deleting
                    onDelete(note._id);
                  }}
                  className="text-red-500 hover:text-red-700"
                >
                  {/* Corrected SVG */}
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                  </svg>

                </button>
              </div>
              <p className="text-xs text-gray-500">
                {new Date(note.updatedAt).toLocaleDateString()}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
