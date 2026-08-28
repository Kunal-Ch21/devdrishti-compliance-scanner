import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { useAuthStore } from '@/store/authStore';
import { useInspectionStore } from '@/store/inspectionStore';

export default function Dashboard() {
  const router = useRouter();
  const inspector = useAuthStore((state) => state.inspector);
  const isLoggedIn = useAuthStore((state) => state.isLoggedIn);
  const logout = useAuthStore((state) => state.logout);
  const history = useInspectionStore((state) => state.inspectionHistory);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    setIsLoaded(true);
    if (!isLoggedIn) {
      router.push('/login');
    }
  }, [isLoggedIn, router]);

  const handleLogout = () => {
    logout();
    router.push('/');
  };

  if (!isLoaded || !inspector) {
    return <div className="min-h-screen bg-gray-100 flex items-center justify-center">Loading...</div>;
  }

  const todayInspections = history.filter(
    (h) => new Date(h.created_at).toDateString() === new Date().toDateString()
  ).length;

  const compliantCount = history.filter((h) => h.overall_status === 'COMPLIANT').length;
  const nonCompliantCount = history.filter((h) => h.overall_status === 'NON_COMPLIANT').length;

  return (
    <>
      <Head>
        <title>Dashboard - DevDrishti</title>
      </Head>

      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="bg-white shadow">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">🏛️ DevDrishti</h1>
                <p className="text-gray-600">Welcome, {inspector.name}</p>
              </div>
              <button
                onClick={handleLogout}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
              >
                🚪 Logout
              </button>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow p-6 border-l-4 border-blue-500">
              <div className="text-2xl font-bold text-blue-600">{history.length}</div>
              <p className="text-gray-600 text-sm">Total Inspections</p>
            </div>
            <div className="bg-white rounded-lg shadow p-6 border-l-4 border-green-500">
              <div className="text-2xl font-bold text-green-600">{compliantCount}</div>
              <p className="text-gray-600 text-sm">Compliant Products</p>
            </div>
            <div className="bg-white rounded-lg shadow p-6 border-l-4 border-red-500">
              <div className="text-2xl font-bold text-red-600">{nonCompliantCount}</div>
              <p className="text-gray-600 text-sm">Non-Compliant</p>
            </div>
            <div className="bg-white rounded-lg shadow p-6 border-l-4 border-amber-500">
              <div className="text-2xl font-bold text-amber-600">{todayInspections}</div>
              <p className="text-gray-600 text-sm">Today's Inspections</p>
            </div>
          </div>

          {/* Action Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <Link
              href="/scan"
              className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow p-6 cursor-pointer border-2 border-transparent hover:border-blue-500"
            >
              <div className="text-4xl mb-3">📷</div>
              <h2 className="text-xl font-bold text-gray-800 mb-2">Start New Scan</h2>
              <p className="text-gray-600 text-sm">Upload product image and extract data</p>
            </Link>

            <Link
              href="/verify"
              className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow p-6 cursor-pointer border-2 border-transparent hover:border-green-500"
            >
              <div className="text-4xl mb-3">✓</div>
              <h2 className="text-xl font-bold text-gray-800 mb-2">Verify Extraction</h2>
              <p className="text-gray-600 text-sm">Review and approve findings</p>
            </Link>

            <Link
              href="/history"
              className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow p-6 cursor-pointer border-2 border-transparent hover:border-purple-500"
            >
              <div className="text-4xl mb-3">📋</div>
              <h2 className="text-xl font-bold text-gray-800 mb-2">View History</h2>
              <p className="text-gray-600 text-sm">Check past inspections</p>
            </Link>
          </div>

          {/* Inspector Info */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-bold text-gray-800 mb-4">Inspector Information</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-gray-600">Badge Number</p>
                <p className="font-mono font-bold text-gray-900">{inspector.badge_number}</p>
              </div>
              <div>
                <p className="text-gray-600">Department</p>
                <p className="font-bold text-gray-900">{inspector.department}</p>
              </div>
              <div>
                <p className="text-gray-600">Region</p>
                <p className="font-bold text-gray-900">{inspector.region}</p>
              </div>
              <div>
                <p className="text-gray-600">Role</p>
                <p className="font-bold text-gray-900">{inspector.role}</p>
              </div>
            </div>
          </div>
        </main>
      </div>
    </>
  );
}
