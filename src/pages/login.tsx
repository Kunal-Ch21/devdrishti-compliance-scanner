import { useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { useAuthStore } from '@/store/authStore';

export default function Login() {
  const router = useRouter();
  const [inspectorId, setInspectorId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const login = useAuthStore((state) => state.login);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const success = login(inspectorId, password);
      
      if (success) {
        router.push('/dashboard');
      } else {
        setError('Invalid Inspector ID or Password');
      }
    } catch (err) {
      setError('Login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>Inspector Login - DevDrishti</title>
      </Head>

      <div className="min-h-screen bg-gradient-to-br from-blue-600 to-indigo-800 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="text-5xl font-bold text-white mb-2">🏛️</div>
            <h1 className="text-3xl font-bold text-white">DevDrishti</h1>
            <p className="text-blue-100 mt-2">Inspector Portal</p>
          </div>

          {/* Login Card */}
          <div className="bg-white rounded-xl shadow-2xl p-8">
            <form onSubmit={handleLogin} className="space-y-6">
              {/* Error Message */}
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              {/* Inspector ID */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Inspector ID
                </label>
                <input
                  type="text"
                  value={inspectorId}
                  onChange={(e) => setInspectorId(e.target.value)}
                  placeholder="e.g., INS-001"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={isLoading}
                  required
                />
                <p className="text-xs text-gray-500 mt-1">Demo: INS-001, INS-002, INS-003, INS-004</p>
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={isLoading}
                  required
                />
                <p className="text-xs text-gray-500 mt-1">Demo passwords: demo123, demo456, demo789, demo321</p>
              </div>

              {/* Login Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-bold py-2 px-4 rounded-lg transition-colors"
              >
                {isLoading ? '🔄 Logging in...' : '🔐 Login'}
              </button>
            </form>

            {/* Demo Credentials */}
            <div className="mt-6 pt-6 border-t border-gray-200">
              <p className="text-xs font-medium text-gray-600 mb-3">DEMO CREDENTIALS:</p>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between bg-gray-50 p-2 rounded">
                  <span className="font-mono">INS-001 / demo123</span>
                  <span className="text-gray-500">Senior</span>
                </div>
                <div className="flex justify-between bg-gray-50 p-2 rounded">
                  <span className="font-mono">INS-002 / demo456</span>
                  <span className="text-gray-500">Inspector</span>
                </div>
                <div className="flex justify-between bg-gray-50 p-2 rounded">
                  <span className="font-mono">INS-003 / demo789</span>
                  <span className="text-gray-500">Junior</span>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <p className="text-center text-blue-100 text-sm mt-6">
            Ministry of Consumer Affairs, Food & Public Distribution
          </p>
        </div>
      </div>
    </>
  );
}
