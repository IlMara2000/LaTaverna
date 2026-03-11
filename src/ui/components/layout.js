import "../style.css";

export const metadata = {
  title: 'T.Alverna - La Taverna Protetta',
  description: 'VTT con AI Groq e Appwrite',
}

export default function RootLayout({ children }) {
  return (
    <html lang="it">
      <head>
        {/* Qui Next.js inserisce automaticamente meta e titoli */}
      </head>
      <body className="bg-[#050505] text-white antialiased">
        {children}
      </body>
    </html>
  );
}
