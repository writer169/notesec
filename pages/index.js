// pages/index.js
import { signIn, signOut } from 'next-auth/react'; // useSession больше не нужен
import { useRouter } from 'next/router';
// import { useEffect, useState } from 'react'; // useState и useEffect тоже больше не нужны на главной
import Head from 'next/head';
import { getServerSideProps } from '../lib/auth';

export default function Home({ session }) { // Получаем session из props
  const router = useRouter();

  // Если сессии нет (пользователь не залогинен), показываем кнопку входа
  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Head>
          <title>Secure Notes - Login</title>
          <meta name="description" content="Secure personal notes application" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
        </Head>

        <div className="max-w-md w-full p-6 bg-white rounded-lg shadow-md">
          <h1 className="text-2xl font-bold text-center mb-6">Secure Notes</h1>
          <div className="space-y-4">
            <p className="text-center">Sign in to access your secure notes</p>
            <div className="flex justify-center">
              <button
                onClick={() => signIn('google')}
                className="flex items-center px-4 py-2 bg-white border rounded hover:bg-gray-50 shadow"
              >
                {/* ... (SVG код Google кнопки) ... */}
                Sign in with Google
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Если сессия есть (пользователь залогинен), показываем кнопку выхода и переход к заметкам
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Head>
        <title>Secure Notes</title>
        <meta name="description" content="Secure personal notes application" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <div className="max-w-md w-full p-6 bg-white rounded-lg shadow-md">
        <h1 className="text-2xl font-bold text-center mb-6">Secure Notes</h1>
        <div className="space-y-4">
          <p className="text-center">Logged in as {session.user.email}</p>
          <div className="flex justify-center">
            <button
              onClick={() => router.push('/notes')}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Go to Notes
            </button>
          </div>
          <div className="flex justify-center">
            <button
              onClick={() => signOut()}
              className="px-4 py-2 border rounded hover:bg-gray-100"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Export the getServerSideProps function (оставляем как есть)
export { getServerSideProps }
