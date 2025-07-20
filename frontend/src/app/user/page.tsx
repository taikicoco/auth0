'use client';

import { useUser, withPageAuthRequired } from '@auth0/nextjs-auth0/client';
import { useState } from 'react';

function ApiTestPage() {
  const { user, isLoading } = useUser();
  const [publicResponse, setPublicResponse] = useState<string>('');
  const [protectedResponse, setProtectedResponse] = useState<string>('');
  const [loading, setLoading] = useState<{ [key: string]: boolean }>({});

  const callPublicAPI = async () => {
    setLoading({ ...loading, public: true });
    try {
      const response = await fetch('http://localhost:8080/public');
      const data = await response.json();
      setPublicResponse(JSON.stringify(data, null, 2));
    } catch (error) {
      setPublicResponse(`Error: ${error}`);
    } finally {
      setLoading({ ...loading, public: false });
    }
  };

  const callProtectedAPI = async () => {
    setLoading({ ...loading, protected: true });
    try {
      const response = await fetch('/api/auth/token');
      const { accessToken } = await response.json();

      const apiResponse = await fetch('http://localhost:8080/protected/profile', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });
      const data = await apiResponse.json();
      setProtectedResponse(JSON.stringify(data, null, 2));
    } catch (error) {
      setProtectedResponse(`Error: ${error}`);
    } finally {
      setLoading({ ...loading, protected: false });
    }
  };

  if (isLoading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-100 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-4xl font-bold text-gray-800">API Test Page</h1>
          <div className="flex gap-4">
            <a
              href="/"
              className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-md transition-colors"
            >
              Home
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
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">Public API</h2>
            <p className="text-gray-600 mb-4">
              This endpoint doesn't require authentication
            </p>
            <button
              onClick={callPublicAPI}
              disabled={loading.public}
              className="bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white px-4 py-2 rounded-md transition-colors mb-4"
            >
              {loading.public ? 'Loading...' : 'Call Public API'}
            </button>
            {publicResponse && (
              <div>
                <h3 className="font-medium text-gray-700 mb-2">Response:</h3>
                <pre className="bg-gray-100 p-4 rounded-md overflow-auto text-sm">
                  {publicResponse}
                </pre>
              </div>
            )}
          </div>

          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">Protected API</h2>
            <p className="text-gray-600 mb-4">
              This endpoint requires a valid JWT token
            </p>
            <button
              onClick={callProtectedAPI}
              disabled={loading.protected}
              className="bg-green-500 hover:bg-green-600 disabled:bg-green-300 text-white px-4 py-2 rounded-md transition-colors mb-4"
            >
              {loading.protected ? 'Loading...' : 'Call Protected API'}
            </button>
            {protectedResponse && (
              <div>
                <h3 className="font-medium text-gray-700 mb-2">Response:</h3>
                <pre className="bg-gray-100 p-4 rounded-md overflow-auto text-sm">
                  {protectedResponse}
                </pre>
              </div>
            )}
          </div>
        </div>

        {user && (
          <div className="mt-6 bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">Current User</h2>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <p><span className="font-medium">Name:</span> {user.name}</p>
                <p><span className="font-medium">Email:</span> {user.email}</p>
                <p><span className="font-medium">Sub:</span> {user.sub}</p>
              </div>
              {user.picture && (
                <div className="flex justify-center">
                  <img
                    src={user.picture}
                    alt="Profile"
                    className="w-16 h-16 rounded-full border-2 border-gray-200"
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default withPageAuthRequired(ApiTestPage);