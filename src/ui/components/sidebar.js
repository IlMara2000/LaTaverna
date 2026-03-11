/* Esempio di background Vercel-style per LaTaverna */
body {
  background: radial-gradient(circle at top center, #1a1033 0%, #0a0a0c 100%);
  color: #f4f4f5;
  font-family: 'Inter', sans-serif; /* Font tipico dei SaaS moderni */
}

.card {
  background: rgba(22, 22, 26, 0.8);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(124, 58, 237, 0.1); /* Bordo viola appena accennato */
  transition: border 0.3s ease;
}

.card:hover {
  border: 1px solid rgba(124, 58, 237, 0.5);
}
