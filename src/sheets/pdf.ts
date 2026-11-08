import { fromPdfFields, type Sheet } from './parse'

/**
 * The filled-in boxes of a fillable PDF sheet. The PDF reader is a big library, so it only loads
 * when someone picks a PDF.
 *
 * Most sheets list their boxes in the PDF's form, which pdf-lib reads. Some (D&D Beyond's PDFs since
 * the 2024 sheet) leave that list out and keep each box only on its page, so when the form is empty
 * the boxes are read from the pages themselves.
 */
export async function readPdfSheet(file: Blob, fileName: string): Promise<Sheet> {
  const lib = await import('pdf-lib')
  const { PDFDocument, PDFTextField, PDFCheckBox, PDFDropdown, PDFOptionList, PDFRadioGroup } = lib
  let doc
  try {
    doc = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true, updateMetadata: false })
  } catch {
    throw new Error('The app couldn’t open that PDF. If it’s a scan or a picture, copy its text and use “Paste the sheet’s text”.')
  }
  let boxes = doc
    .getForm()
    .getFields()
    .map((f) => {
      let value = ''
      try {
        if (f instanceof PDFTextField) value = f.getText() ?? ''
        else if (f instanceof PDFCheckBox) value = f.isChecked() ? 'Yes' : ''
        else if (f instanceof PDFDropdown || f instanceof PDFOptionList) value = f.getSelected().join(', ')
        else if (f instanceof PDFRadioGroup) value = f.getSelected() ?? ''
      } catch {
        // A box the reader can't make sense of: leave it out.
      }
      return { name: f.getName(), value }
    })
  if (!boxes.some((b) => b.value.trim())) boxes = pageBoxes(doc, lib)
  return fromPdfFields(boxes, fileName)
}

type Lib = typeof import('pdf-lib')

/** Every form box on the pages (widget annotations), with its full name and value, in page order. */
function pageBoxes(doc: import('pdf-lib').PDFDocument, lib: Lib) {
  const { PDFDict, PDFName } = lib
  const out: { name: string; value: string }[] = []
  for (const page of doc.getPages()) {
    const annots = page.node.Annots()
    if (!annots) continue
    for (let i = 0; i < annots.size(); i++) {
      const a = annots.lookup(i)
      if (!(a instanceof PDFDict) || a.get(PDFName.of('Subtype')) !== PDFName.of('Widget')) continue
      // A box's name and value can sit on it or on its parent (a box shown on several pages).
      const names: string[] = []
      let value: unknown
      let node: unknown = a
      for (let depth = 0; node instanceof PDFDict && depth < 10; depth++) {
        const t = node.get(PDFName.of('T'))
        if (t) names.unshift(pdfText(t, lib))
        if (value === undefined && node.has(PDFName.of('V'))) value = node.lookup(PDFName.of('V'))
        node = node.lookup(PDFName.of('Parent'))
      }
      if (names.length) out.push({ name: names.join('.'), value: value === undefined ? '' : pdfText(value, lib) })
    }
  }
  return out
}

/**
 * A PDF text value as a string. Hex strings are decoded here rather than by pdf-lib, which slips a
 * half-byte when the hex is broken over lines (as D&D Beyond writes it) and turns the text to noise.
 */
function pdfText(v: unknown, { PDFHexString, PDFString, PDFName }: Lib): string {
  if (v instanceof PDFName) return v.decodeText()
  if (v instanceof PDFString) return v.decodeText()
  if (!(v instanceof PDFHexString)) return ''
  const hex = v.toString().replace(/[<>\s]/g, '')
  const bytes = new Uint8Array(Math.floor(hex.length / 2) + (hex.length % 2))
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt((hex.slice(i * 2, i * 2 + 2) + '0').slice(0, 2), 16) || 0
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder('utf-16be').decode(bytes.subarray(2))
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder('utf-16le').decode(bytes.subarray(2))
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) return new TextDecoder().decode(bytes.subarray(3))
  return new TextDecoder('latin1').decode(bytes)
}
