"use client";

import { useUser } from "@auth0/nextjs-auth0/client";
import { useState } from "react";

interface ApiResponse {
  data: string;
  status: number;
  statusText: string;
}

const publicAPIUrl = "http://localhost:8080"

export default function Home() {
  const { user, error, isLoading } = useUser();
  const [publicResponse, setPublicResponse] = useState<ApiResponse | null>(
    null
  );
  const [protectedResponse, setProtectedResponse] =
    useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState<{ [key: string]: boolean }>({});

  const callPublicAPI = async () => {
    setLoading({ ...loading, public: true });
    try {
      const response = await fetch(`${publicAPIUrl}/public`);
      const data = await response.json();
      setPublicResponse({
        data: JSON.stringify(data, null, 2),
        status: response.status,
        statusText: response.statusText,
      });
    } catch (error) {
      setPublicResponse({
        data: `Error: ${error}`,
        status: 0,
        statusText: "Network Error",
      });
    } finally {
      setLoading({ ...loading, public: false });
    }
  };

  const callProtectedAPI = async () => {
    setLoading({ ...loading, protected: true });
    try {
      const response = await fetch("/api/auth/token");
      const { accessToken } = await response.json();

      const apiResponse = await fetch(
        `${publicAPIUrl}/protected/profile`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );
      const data = await apiResponse.json();
      setProtectedResponse({
        data: JSON.stringify(data, null, 2),
        status: apiResponse.status,
        statusText: apiResponse.statusText,
      });
    } catch (error) {
      setProtectedResponse({
        data: `Error: ${error}`,
        status: 0,
        statusText: "Network Error",
      });
    } finally {
      setLoading({ ...loading, protected: false });
    }
  };

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-center text-gray-800 mb-8">
          Auth0
        </h1>

        {user ? (
          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-semibold text-gray-800">
                Current User
              </h2>
              <div className="flex gap-4">
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
                <div className="space-y-2">
                  <p>
                    <span className="font-medium">Name:</span> {user.name}
                  </p>
                  <p>
                    <span className="font-medium">Email:</span> {user.email}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-6">
              <h3 className="text-lg font-medium text-gray-700 mb-3">
                User Object (JSON)
              </h3>
              <pre className="bg-gray-100 p-4 rounded-md overflow-auto text-sm">
                {JSON.stringify(user, null, 2)}
              </pre>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-lg p-6 text-center">
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">
              Sign in to access the Protected API
            </h2>
            <a
              href="/api/auth/login"
              className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-md text-lg transition-colors"
            >
              Sign In
            </a>
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-6 mt-6">
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">
              Public API
            </h2>
            <p className="text-gray-600 mb-4">
              This endpoint doesn't require authentication
            </p>
            <button
              onClick={callPublicAPI}
              disabled={loading.public}
              className="bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white px-4 py-2 rounded-md transition-colors mb-4"
            >
              Call Public API
            </button>
            {publicResponse && (
              <div>
                <h3 className="font-medium text-gray-700 mb-2">Response:</h3>
                <div className="mb-2">
                  <span
                    className={`inline-flex px-2 py-1 text-xs rounded-full ${
                      publicResponse.status >= 200 &&
                      publicResponse.status < 300
                        ? "bg-green-100 text-green-800"
                        : "bg-red-100 text-red-800"
                    }`}
                  >
                    {publicResponse.status} {publicResponse.statusText}
                  </span>
                </div>
                <pre className="bg-gray-100 p-4 rounded-md overflow-auto text-sm">
                  {publicResponse.data}
                </pre>
              </div>
            )}
          </div>

          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">
              Protected API
            </h2>
            <p className="text-gray-600 mb-4">
              This endpoint requires a valid JWT token
            </p>
            <button
              onClick={callProtectedAPI}
              disabled={loading.protected}
              className="bg-green-500 hover:bg-green-600 disabled:bg-green-300 text-white px-4 py-2 rounded-md transition-colors mb-4"
            >
              Call Protected API
            </button>
            {protectedResponse && (
              <div>
                <h3 className="font-medium text-gray-700 mb-2">Response:</h3>
                <div className="mb-2">
                  <span
                    className={`inline-flex px-2 py-1 text-xs rounded-full ${
                      protectedResponse.status >= 200 &&
                      protectedResponse.status < 300
                        ? "bg-green-100 text-green-800"
                        : "bg-red-100 text-red-800"
                    }`}
                  >
                    {protectedResponse.status} {protectedResponse.statusText}
                  </span>
                </div>
                <pre className="bg-gray-100 p-4 rounded-md overflow-auto text-sm">
                  {protectedResponse.data}
                </pre>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
