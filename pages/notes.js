// pages/notes.js
import { useSession } from 'next-auth/react';

function NotesPage() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return <p>Loading...</p>;
  }

  if (status === "unauthenticated") {
    return <p>Access Denied</p>;
  }

    if (status === "authenticated") {
    return (
      <div>
        <h1>My Notes</h1>
        <p>This is the notes page. You are logged in as {session.user.email}.</p>
        {/* Здесь будет твой NoteList и NoteEditor */}
      </div>
    );
  }
  return <p>Something went wrong</p>
}

export default NotesPage;
