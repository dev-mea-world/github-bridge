export const metadata = {
  title: "Glor.IA GitHub Bridge",
  description: "Next.js API for AI-driven GitHub operations",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}

