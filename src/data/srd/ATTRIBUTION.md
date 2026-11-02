# Attribuzione del corpus SRD

`corpus.json` contiene il testo del **System Reference Document 5.1 (SRD 5.1)**
di Wizards of the Coast LLC, rilasciato in **Creative Commons Attribution 4.0
International (CC BY 4.0)**.

- Fonte del testo: <https://github.com/your5e/5e-srd-markdown> (cartella
  `dnd/51/markdown`, conversione del PDF ufficiale in Markdown).
- Licenza ufficiale del SRD: <https://www.dndbeyond.com/srd>
- Licenza CC BY 4.0: <https://creativecommons.org/licenses/by/4.0/legalcode>

## Come è stato costruito

I file Markdown sono stati divisi per sezione (intestazioni di livello 2) e il
testo è stato ripulito dalla formattazione Markdown, senza modificare il
contenuto. Il risultato è l'array `passages` con:

- `c`: categoria (percorso della cartella di origine)
- `t`: titolo della sezione
- `x`: testo della sezione

## Modifiche apportate

- Rimozione della formattazione Markdown (enfasi, elenchi, tabelle, immagini).
- Unione dei file in un unico JSON per la ricerca full-testo nel client.
- Etichette di categoria tradotte in italiano per l'interfaccia (il testo delle
  regole resta nella sua forma ufficiale in inglese).

Il resto del contenuto è invariato rispetto alla fonte.
