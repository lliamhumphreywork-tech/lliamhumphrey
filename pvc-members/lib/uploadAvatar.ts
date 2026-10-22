export async function uploadAvatar(file: File): Promise<string> {
  const img = new Image()
  const objectUrl = URL.createObjectURL(file)
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve()
    img.onerror = () => reject(new Error("Could not read image file"))
    img.src = objectUrl
  })
  const size = Math.min(img.width, img.height, 400)
  const canvas = document.createElement("canvas")
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext("2d")!
  const sx = (img.width - size) / 2
  const sy = (img.height - size) / 2
  ctx.drawImage(img, sx, sy, size, size, 0, 0, size, size)
  URL.revokeObjectURL(objectUrl)
  const blob: Blob | null = await new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/jpeg", 0.88))
  if (!blob) throw new Error("Failed to process image")
  const fd = new FormData()
  fd.append("file", blob, "avatar.jpg")
  const res = await fetch("/api/upload-avatar", { method: "POST", body: fd })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ?? "Upload failed")
  }
  const { url } = await res.json()
  return url
}
