import { describe, it, expect, vi, beforeEach } from "vitest"
import { uploadAvatar } from "../lib/uploadAvatar"

// ── browser API mocks ──────────────────────────────────────────────────────────

const mockObjectUrl = "blob:mock-url"

beforeEach(() => {
  vi.restoreAllMocks()

  // URL.createObjectURL / revokeObjectURL
  vi.stubGlobal("URL", {
    createObjectURL: vi.fn(() => mockObjectUrl),
    revokeObjectURL: vi.fn(),
  })
})

function makeImageMock(opts: { failLoad?: boolean; width?: number; height?: number }) {
  const { failLoad = false, width = 800, height = 600 } = opts
  return class MockImage {
    width = width
    height = height
    onload: (() => void) | null = null
    onerror: (() => void) | null = null
    set src(_val: string) {
      // fire on next microtask to simulate async load
      Promise.resolve().then(() => {
        if (failLoad) this.onerror?.()
        else this.onload?.()
      })
    }
  }
}

function makeCanvasMock(opts: { blobResult?: Blob | null }) {
  const { blobResult = new Blob(["img"], { type: "image/jpeg" }) } = opts
  return {
    width: 0,
    height: 0,
    getContext: vi.fn(() => ({
      drawImage: vi.fn(),
    })),
    toBlob: vi.fn((cb: (b: Blob | null) => void) => {
      Promise.resolve().then(() => cb(blobResult))
    }),
  }
}

// ── tests ──────────────────────────────────────────────────────────────────────

describe("uploadAvatar — bug regressions", () => {
  it("Bug 1: rejects with a clear error when image cannot be decoded (HEIC / corrupted)", async () => {
    vi.stubGlobal("Image", makeImageMock({ failLoad: true }))
    vi.stubGlobal("document", {
      createElement: vi.fn(() => makeCanvasMock({})),
    })

    const file = new File(["not-an-image"], "photo.heic", { type: "image/heic" })
    await expect(uploadAvatar(file)).rejects.toThrow("Could not read image file")
  })

  it("Bug 2: rejects with a clear error when canvas.toBlob returns null", async () => {
    vi.stubGlobal("Image", makeImageMock({}))
    vi.stubGlobal("document", {
      createElement: vi.fn(() => makeCanvasMock({ blobResult: null })),
    })

    const file = new File(["data"], "photo.jpg", { type: "image/jpeg" })
    await expect(uploadAvatar(file)).rejects.toThrow("Failed to process image")
  })

  it("Bug 3: rejects with server error message when upload API returns non-ok", async () => {
    vi.stubGlobal("Image", makeImageMock({}))
    vi.stubGlobal("document", {
      createElement: vi.fn(() => makeCanvasMock({})),
    })
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Invalid file type" }),
    }))

    const file = new File(["data"], "photo.jpg", { type: "image/jpeg" })
    await expect(uploadAvatar(file)).rejects.toThrow("Invalid file type")
  })

  it("returns the proxy URL on a successful upload", async () => {
    vi.stubGlobal("Image", makeImageMock({}))
    vi.stubGlobal("document", {
      createElement: vi.fn(() => makeCanvasMock({})),
    })
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ url: "/api/img?url=https%3A%2F%2Fblob.example.com%2Favatar.jpg" }),
    }))

    const file = new File(["data"], "photo.jpg", { type: "image/jpeg" })
    const url = await uploadAvatar(file)
    expect(url).toMatch(/^\/api\/img/)
  })

  it("falls back to 'Upload failed' when API returns non-ok with no error body", async () => {
    vi.stubGlobal("Image", makeImageMock({}))
    vi.stubGlobal("document", {
      createElement: vi.fn(() => makeCanvasMock({})),
    })
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      json: async () => { throw new Error("not json") },
    }))

    const file = new File(["data"], "photo.jpg", { type: "image/jpeg" })
    await expect(uploadAvatar(file)).rejects.toThrow("Upload failed")
  })
})
