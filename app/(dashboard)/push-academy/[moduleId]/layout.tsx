'use client';

export default function AcademyModuleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="pr-80">
      {children}
    </div>
  );
}
