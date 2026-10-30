import { fromPdfFields, type Sheet } from './parse'

/**
 * The filled-in boxes of a fillable PDF sheet. The PDF reader is a big library, so it only loads
 * when someone picks a PDF.
 */
export async function readPdfSheet(file: Blob, fileName: string): Promise<Sheet> {
  const { PDFDocument, PDFTextField, PDFCheckBox, PDFDropdown, PDFOptionList, PDFRadioGroup } = await import('pdf-lib')
  let doc
  try {
    doc = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true, updateMetadata: false })
  } catch {
    throw new Error('The app couldn’t open that PDF. If it’s a scan or a picture, copy its text and use “Paste the sheet’s text”.')
  }
  const boxes = doc
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
  return fromPdfFields(boxes, fileName)
}
