export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-aris-primary-700 via-aris-primary-600 to-aris-secondary-700 items-center justify-center p-12">
        <div className="max-w-md text-white">
          <div className="mb-8">
            <h1 className="text-4xl font-bold tracking-tight">ARIS</h1>
            <p className="mt-1 text-lg text-aris-primary-200">
              Animal Resources Information System
            </p>
          </div>
          <p className="text-aris-primary-100 leading-relaxed">
            AU-IBAR Continental Digital Infrastructure for Animal Resources
            across 55 Member States and 8 Regional Economic Communities.
          </p>
          <div className="mt-10 grid grid-cols-3 gap-4 text-center">
            <div className="rounded-lg bg-white/10 p-3">
              <p className="text-2xl font-bold">55</p>
              <p className="text-xs text-aris-primary-200">Member States</p>
            </div>
            <div className="rounded-lg bg-white/10 p-3">
              <p className="text-2xl font-bold">8</p>
              <p className="text-xs text-aris-primary-200">RECs</p>
            </div>
            <div className="rounded-lg bg-white/10 p-3">
              <p className="text-2xl font-bold">9</p>
              <p className="text-xs text-aris-primary-200">Domains</p>
            </div>
          </div>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex w-full items-center justify-center p-8 lg:w-1/2">
        <div className="w-full max-w-md">{children}</div>
      </div>
    </div>
  );
}
