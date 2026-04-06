export default function ProfileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="w-full px-4 py-6 sm:px-6 lg:px-8">{children}</div>;
}
