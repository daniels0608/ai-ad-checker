export const metadata = { title: "Ad Pretest (Vercel + Mini-API)", description: "Client ad pretest with API proxy for external heatmaps" };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body style={{fontFamily:'Inter, system-ui, sans-serif', background:'#0b0b0c', color:'#eaeaea'}}>
        <div style={{maxWidth: 1100, margin: '40px auto', padding:'0 20px'}}>
          {children}
        </div>
      </body>
    </html>
  );
}
