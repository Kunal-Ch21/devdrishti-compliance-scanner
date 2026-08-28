import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';

export default function Home() {
  const router = useRouter();
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    setIsLoaded(true);
  }, []);

  return (
    <>
      <Head>
        <title>DevDrishti - Legal Metrology Compliance Scanner</title>
        <meta name="description" content="AI-powered compliance scanner for packaged commodities" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="text-center space-y-8">
          {/* Logo & Header */}
          <div className="space-y-4">
            <div className="text-6xl md:text-7xl font-bold text-blue-600">
              🏛️ DevDrishti
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-gray-800">
              Legal Metrology Compliance Scanner
            </h1>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Automated package compliance checking for the Legal Metrology (Packaged Commodities) Rules, 2011
            </p>
          </div>

          {/* Features */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto py-8">
            <div className="bg-white rounded-lg p-6 shadow-lg border-t-4 border-green-500">
              <div className="text-4xl mb-3">📷</div>
              <h3 className="font-bold text-lg text-gray-800 mb-2">SCAN</h3>
              <p className="text-gray-600 text-sm">Upload product images and let AI extract label data</p>
            </div>

            <div className="bg-white rounded-lg p-6 shadow-lg border-t-4 border-blue-500">
              <div className="text-4xl mb-3">✓</div>
              <h3 className="font-bold text-lg text-gray-800 mb-2">VERIFY</h3>
              <p className="text-gray-600 text-sm">Inspector reviews and approves AI findings</p>
            </div>

            <div className="bg-white rounded-lg p-6 shadow-lg border-t-4 border-purple-500">
              <div className="text-4xl mb-3">📄</div>
              <h3 className="font-bold text-lg text-gray-800 mb-2">REPORT</h3>
              <p className="text-gray-600 text-sm">Generate digital compliance reports with evidence</p>
            </div>
          </div>

          {/* Key Stats */}
          <div className="bg-white rounded-lg shadow-xl p-8 max-w-2xl mx-auto">
            <div className="grid grid-cols-3 gap-6">
              <div>
                <div className="text-3xl font-bold text-green-600">24</div>
                <p className="text-gray-600 text-sm">Inspections This Month</p>
              </div>
              <div>
                <div className="text-3xl font-bold text-blue-600">87.5%</div>
                <p className="text-gray-600 text-sm">Compliance Rate</p>
              </div>
              <div>
                <div className="text-3xl font-bold text-amber-600">3</div>
                <p className="text-gray-600 text-sm">Pending Reviews</p>
              </div>
            </div>
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-8">
            <Link
              href="/login"
              className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg font-bold text-lg transition-colors"
            >
              🔐 Inspector Login
            </Link>
            <Link
              href="/about"
              className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-8 py-3 rounded-lg font-bold text-lg transition-colors"
            >
              📖 Learn More
            </Link>
          </div>

          {/* Footer Badge */}
          <div className="text-center pt-8 border-t border-gray-300 mt-8">
            <p className="text-gray-600 text-sm">
              🤖 <strong>AI recommends. The inspector decides.</strong>
            </p>
            <p className="text-gray-500 text-xs mt-2">
              Ministry of Consumer Affairs, Food & Public Distribution | SIH26034
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
