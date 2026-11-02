# OCR locale

Asset usati da `src/services/magicDocumentScan.js` per leggere i nomi delle carte nei PDF scansionati direttamente nel browser. Non vengono inviati dati a servizi OCR esterni.

| File | Origine | Licenza |
| --- | --- | --- |
| `worker.min.js` | [tesseract.js](https://github.com/naptha/tesseract.js) 7.0.0, `dist/worker.min.js` | Apache-2.0 (`LICENSE-tesseract.js.txt`) |
| `tesseract-core-lstm.wasm.js` + `.wasm` | [tesseract.js-core](https://github.com/naptha/tesseract.js-core) | Apache-2.0 (`LICENSE-tesseract.js-core.txt`) |
| `eng.traineddata.gz` | [`@tesseract.js-data/eng` 4.0.0_best_int](https://cdn.jsdelivr.net/npm/@tesseract.js-data/eng/4.0.0_best_int/), derivato da [tessdata_best](https://github.com/tesseract-ocr/tessdata_best) | Apache-2.0 |

Il core non-SIMD è scelto per funzionare anche su browser più vecchi; se il worker non parte, la scansione passa al fallback AI già descritto nell'informativa privacy.

Per aggiornare gli asset, copiare i file dalle rispettive versioni dei pacchetti e mantenere allineati i percorsi in `magicDocumentScan.js` (`workerPath`, `corePath`, `langPath`).
