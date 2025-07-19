'use client';

import { useUser } from '@auth0/nextjs-auth0/client';

export default function Home() {
  const { user, error, isLoading } = useUser();

  if (isLoading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  if (error) return <div className="min-h-screen flex items-center justify-center">Error: {error.message}</div>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-center text-gray-800 mb-8">
          Auth0 Study App
        </h1>
        
        {user ? (
          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-semibold text-gray-800">Welcome!</h2>
              <div className="flex gap-4">
                <a
                  href="/api"
                  className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-md transition-colors"
                >
                  API Test
                </a>
                <a
                  href="/api/auth/logout"
                  className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-md transition-colors"
                >
                  Logout
                </a>
              </div>
            </div>
            
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-medium text-gray-700 mb-3">User Information</h3>
                <div className="space-y-2">
                  <p><span className="font-medium">Name:</span> {user.name}</p>
                  <p><span className="font-medium">Email:</span> {user.email}</p>
                  <p><span className="font-medium">Nickname:</span> {user.nickname}</p>
                </div>
              </div>
              
              {user.picture && (
                <div className="flex justify-center">
                  <img
                    src={user.picture}
                    alt="Profile"
                    className="w-24 h-24 rounded-full border-4 border-blue-200"
                  />
                </div>
              )}
            </div>
            
            <div className="mt-6">
              <h3 className="text-lg font-medium text-gray-700 mb-3">User Object (JSON)</h3>
              <pre className="bg-gray-100 p-4 rounded-md overflow-auto text-sm">
                {JSON.stringify(user, null, 2)}
              </pre>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-lg p-6 text-center">
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">
              Please sign in to continue
            </h2>
            <a
              href="/api/auth/login"
              className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-md text-lg transition-colors"
            >
              Sign In
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
