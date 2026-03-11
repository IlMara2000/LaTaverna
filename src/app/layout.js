import "../style.css"; 

export default function RootLayout({ children }) {
  return (
    <html lang="it">
      <body className="bg-[#0a0a0a] text-white">{children}</body>
    </html>
  );
}
