// Converts a still-image capture (#141) into the base64 payload the server's vision-model
// call expects — FileReader.readAsDataURL produces a "data:<mediaType>;base64,<data>"
// string; only the part after the comma is the actual base64 the AI SDK's image content
// part wants.
export function fileToBase64(file: File): Promise<{ data: string; mediaType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      const data = dataUrl.slice(dataUrl.indexOf(',') + 1)
      resolve({ data, mediaType: file.type })
    }
    reader.onerror = () => reject(reader.error ?? new Error('Could not read image file'))
    reader.readAsDataURL(file)
  })
}
