export const metadata = {
  title: "Vercel Next Starter AI",
  description: "Sofort deploybar. Erstellt für daniels0608."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body style={{ fontFamily: 'system-ui, sans-serif', margin: 0 }}>
        {children}
      </body>
    </html>
  );
}
