import { signIn, signOut, useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { getServerSession } from "next-auth/next";
import { authOptions } from "./api/auth/[...nextauth]";

export default function Home({ session }) {
  const router = useRouter();
  // Используем useSession для дополнительной проверки на клиенте
  const { data: clientSession, status } = useSession();
  
  // Используем либо серверную сессию, либо клиентскую
  const userSession = session || clientSession;
  
  // Если статус загрузки, показываем индикатор загрузки
  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  // Если сессии нет (пользователь не залогинен), показываем кнопку входа
  if (!userSession) {
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
                onClick={() => signIn('google', { callbackUrl: '/' })}
                className="flex items-center px-4 py-2 bg-white border rounded hover:bg-gray-50 shadow"
              >
                <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
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
          <p className="text-center">Logged in as {userSession.user.email}</p>
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
              onClick={() => signOut({ callbackUrl: '/' })}
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

export async function getServerSideProps(context) {
  const session = await getServerSession(context.req, context.res, authOptions);
  
  return {
    props: {
      session: session || null,
    },
  };
}
