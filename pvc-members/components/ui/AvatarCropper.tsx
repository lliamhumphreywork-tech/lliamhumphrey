"use client"

import { useRef, useState, useEffect, useCallback } from "react"

interface Props {
  file: File
  onConfirm: (blob: Blob) => void
  onCancel: () => void
}

export function AvatarCropper({ file, onConfirm, onCancel }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)

  // x/y = offset of image top-left relative to crop circle center
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [scale, setScale] = useState(1)
  const [dragging, setDragging] = useState(false)
  const dragStart = useRef({ mx: 0, my: 0, ox: 0, oy: 0 })
  const [ready, setReady] = useState(false)

  const CROP_SIZE = 260 // diameter of the visible crop circle

  // Load image
  useEffect(() => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      imgRef.current = img
      // Fit the image so its shorter side fills the crop circle
      const fit = CROP_SIZE / Math.min(img.naturalWidth, img.naturalHeight)
      setScale(fit)
      setOffset({ x: 0, y: 0 })
      setReady(true)
    }
    img.src = url
    return () => URL.revokeObjectURL(url)
  }, [file])

  // Draw preview on canvas
  useEffect(() => {
    if (!ready || !imgRef.current) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")!
    const img = imgRef.current
    const size = CROP_SIZE

    canvas.width = size
    canvas.height = size

    ctx.clearRect(0, 0, size, size)

    // Clip to circle
    ctx.save()
    ctx.beginPath()
    ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2)
    ctx.clip()

    const w = img.naturalWidth * scale
    const h = img.naturalHeight * scale
    const dx = size / 2 + offset.x - w / 2
    const dy = size / 2 + offset.y - h / 2
    ctx.drawImage(img, dx, dy, w, h)
    ctx.restore()
  }, [ready, offset, scale])

  // Drag handlers
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    setDragging(true)
    dragStart.current = { mx: e.clientX, my: e.clientY, ox: offset.x, oy: offset.y }
  }, [offset])

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging) return
    const dx = e.clientX - dragStart.current.mx
    const dy = e.clientY - dragStart.current.my
    setOffset({ x: dragStart.current.ox + dx, y: dragStart.current.oy + dy })
  }, [dragging])

  const onMouseUp = useCallback(() => setDragging(false), [])

  // Touch drag
  const lastTouch = useRef<{ x: number; y: number } | null>(null)
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0]
    lastTouch.current = { x: t.clientX, y: t.clientY }
  }
  const onTouchMove = (e: React.TouchEvent) => {
    e.preventDefault()
    if (!lastTouch.current) return
    const t = e.touches[0]
    const dx = t.clientX - lastTouch.current.x
    const dy = t.clientY - lastTouch.current.y
    lastTouch.current = { x: t.clientX, y: t.clientY }
    setOffset(o => ({ x: o.x + dx, y: o.y + dy }))
  }

  // Scroll to zoom
  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    setScale(s => Math.max(0.3, Math.min(5, s - e.deltaY * 0.001)))
  }

  // Zoom buttons
  const zoom = (delta: number) => setScale(s => Math.max(0.3, Math.min(5, s + delta)))

  function handleConfirm() {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.toBlob(blob => {
      if (blob) onConfirm(blob)
    }, "image/jpeg", 0.92)
  }

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 1000,
      background: "rgba(0,0,0,0.75)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 20,
    }}>
      <div style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)",
        padding: 24,
        maxWidth: 340,
        width: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 16,
      }}>
        <h3 style={{ fontFamily: "Syne, sans-serif", fontWeight: 700, fontSize: 16, margin: 0 }}>
          Crop your photo
        </h3>
        <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0, textAlign: "center" }}>
          Drag to reposition · scroll to zoom
        </p>

        {/* Crop area */}
        <div
          ref={containerRef}
          style={{
            width: CROP_SIZE,
            height: CROP_SIZE,
            borderRadius: "50%",
            overflow: "hidden",
            cursor: dragging ? "grabbing" : "grab",
            flexShrink: 0,
            border: "3px solid var(--accent)",
            boxShadow: "0 0 0 9999px rgba(0,0,0,0.5)",
            position: "relative",
          }}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
          onWheel={onWheel}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={() => { lastTouch.current = null }}
        >
          <canvas ref={canvasRef} style={{ display: "block", width: CROP_SIZE, height: CROP_SIZE }} />
        </div>

        {/* Zoom controls */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            type="button"
            onClick={() => zoom(-0.1)}
            style={{
              width: 32, height: 32, borderRadius: "50%",
              border: "1px solid var(--border)",
              background: "var(--bg-elevated)",
              color: "var(--text-primary)",
              fontSize: 18, lineHeight: 1,
              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >−</button>
          <span style={{ fontSize: 13, color: "var(--text-muted)", minWidth: 40, textAlign: "center" }}>
            {Math.round(scale * 100)}%
          </span>
          <button
            type="button"
            onClick={() => zoom(0.1)}
            style={{
              width: 32, height: 32, borderRadius: "50%",
              border: "1px solid var(--border)",
              background: "var(--bg-elevated)",
              color: "var(--text-primary)",
              fontSize: 18, lineHeight: 1,
              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >+</button>
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 10, width: "100%" }}>
          <button
            type="button"
            onClick={onCancel}
            style={{
              flex: 1, padding: "10px 0",
              border: "1px solid var(--border)",
              background: "var(--bg-elevated)",
              color: "var(--text-primary)",
              borderRadius: "var(--radius)",
              fontSize: 14, fontWeight: 600,
              fontFamily: "Plus Jakarta Sans, sans-serif",
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            style={{
              flex: 1, padding: "10px 0",
              border: "none",
              background: "var(--accent)",
              color: "#000",
              borderRadius: "var(--radius)",
              fontSize: 14, fontWeight: 600,
              fontFamily: "Plus Jakarta Sans, sans-serif",
              cursor: "pointer",
            }}
          >
            Use photo
          </button>
        </div>
      </div>
    </div>
  )
}
