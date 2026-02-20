import { Shield } from 'lucide-react';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex bg-admin-bg">
      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-gray-900 via-gray-800 to-primary-900 p-12 flex-col justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Shield className="w-10 h-10 text-primary-400" />
            <div>
              <h1 className="text-2xl font-bold text-white">ARIS Admin</h1>
              <p className="text-gray-400 text-sm">System Administration</p>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div>
            <h2 className="text-3xl font-bold text-white mb-4">
              AU-IBAR Continental
              <br />
              Infrastructure Management
            </h2>
            <p className="text-gray-300 max-w-md">
              Manage tenants, users, data contracts, and system health across
              55 Member States and 8 Regional Economic Communities.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white/5 rounded-lg p-4 backdrop-blur">
              <p className="text-2xl font-bold text-primary-400">55</p>
              <p className="text-sm text-gray-400">Member States</p>
            </div>
            <div className="bg-white/5 rounded-lg p-4 backdrop-blur">
              <p className="text-2xl font-bold text-secondary-200">8</p>
              <p className="text-sm text-gray-400">RECs</p>
            </div>
            <div className="bg-white/5 rounded-lg p-4 backdrop-blur">
              <p className="text-2xl font-bold text-accent-200">9</p>
              <p className="text-sm text-gray-400">Domains</p>
            </div>
          </div>
        </div>

        <p className="text-gray-500 text-xs">
          African Union — Inter-African Bureau for Animal Resources
        </p>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">{children}</div>
      </div>
    </div>
  );
}
