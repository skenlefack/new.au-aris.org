export default function ProfileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">{children}</div>;
}
