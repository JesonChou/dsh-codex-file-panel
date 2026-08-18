/** E2E: full PDF pipeline against a live server — session, write, /raw bytes, pdf.js parse. */
const PDF_TEXT = '%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n4 0 obj\n<< /Length 44 >>\nstream\nBT /F1 12 Tf 72 100 Td (Hello) Tj ET\nendstream\nendobj\n5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\ntrailer\n<< /Root 1 0 R /Size 6 >>\n%%EOF\n'

const run = async () => {
  const base = process.env.DSH_E2E_BASE_URL ?? 'http://127.0.0.1:3080'
  const cwd = process.env.DSH_E2E_CWD ?? process.cwd()
  const create = await fetch(base + '/api/session.create', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: base },
    body: JSON.stringify({ type: 'client-request', rpcId: 'e2e-pdf', method: 'session.create', payload: { cwd } }),
  })
  const created = await create.json()
  const sessionId = created.result?.value?.sessionId
  if (!sessionId) { console.log('no session:', JSON.stringify(created).slice(0, 120)); return }
  const write = await fetch(base + '/plugins/dsh-codex-file-panel/write', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: base },
    body: JSON.stringify({ sessionId, path: 'codex-e2e.pdf', content: PDF_TEXT }),
  })
  console.log('write:', (await write.text()).slice(0, 70))
  const raw = await fetch(base + '/plugins/dsh-codex-file-panel/raw?sessionId=' + sessionId + '&path=codex-e2e.pdf')
  const bytes = new Uint8Array(await raw.arrayBuffer())
  console.log('raw:', raw.status, raw.headers.get('content-type'), bytes.length, 'bytes')
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const doc = await pdfjs.getDocument({ data: bytes, isEvalSupported: false }).promise
  console.log('pdfjs parse over /raw bytes: numPages =', doc.numPages)
  await doc.destroy()
}
run().catch(e => { console.error(e); process.exit(1) })
