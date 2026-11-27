import {
  useCallback,
  useId,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  type TouchEvent as ReactTouchEvent,
} from 'react'
import { Icon } from '@/common/components/Icon'
import type { IconName } from '@/common/components/icons'
import { IMG_RULES, imgAdd, imgEditState, imgOriginalSrc, imgSrc, imgsOf, replaceImgData } from '../imageStore'
import { useTindahan } from '../context/TindahanContext'
import type { PrototypeProduct } from '../types'
import './PhotoUploader.css'

interface PhotoUploaderProps {
  ids: string[]
  max?: number
  label?: string
  hint?: string
  errorMsg?: string
  onChange: (nextIds: string[]) => void
  onError?: (err: string) => void
}

interface CropModalProps {
  imgId: string
  onClose: () => void
  onSave: () => void
}

type AspectPreset = 'fit' | '1:1' | '4:3' | '3:4' | '16:9'

const ASPECT_PRESETS: Record<AspectPreset, { label: string; ar: number; viewW: number; viewH: number }> = {
  fit: { label: 'Fit', ar: 4 / 3, viewW: 400, viewH: 300 },
  '1:1': { label: '1:1', ar: 1, viewW: 320, viewH: 320 },
  '4:3': { label: '4:3', ar: 4 / 3, viewW: 400, viewH: 300 },
  '3:4': { label: '3:4', ar: 3 / 4, viewW: 240, viewH: 320 },
  '16:9': { label: '16:9', ar: 16 / 9, viewW: 420, viewH: 236 },
}

function ImageAdjustModal({ imgId, onClose, onSave }: CropModalProps) {
  const { toast, bumpImgVersion } = useTindahan()
  // Always load the full untouched original so re-adjusting never loses data.
  const originalSrc = imgOriginalSrc(imgId)
  const savedEdit = imgEditState(imgId)

  const [zoom, setZoom] = useState(() => savedEdit?.zoom ?? 1.0)
  const [rotation, setRotation] = useState(() => savedEdit?.rotation ?? 0) // 0, 90, 180, 270
  const [pan, setPan] = useState<{ x: number; y: number }>(
    () => savedEdit?.pan ?? { x: 0, y: 0 },
  )
  const [preset, setPreset] = useState<AspectPreset>(
    () => (savedEdit?.preset ? (savedEdit.preset as AspectPreset) : 'fit'),
  )
  const [imgSize, setImgSize] = useState<{ w: number; h: number } | null>(null)
  const [dragging, setDragging] = useState(false)
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const [startPan, setStartPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 })

  const viewportRef = useRef<HTMLDivElement | null>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)

  const presetMeta = ASPECT_PRESETS[preset]
  const { viewW: VIEW_W, viewH: VIEW_H } = presetMeta

  const handlePresetChange = (next: AspectPreset) => {
    setPreset(next)
    setZoom(1.0)
    setPan({ x: 0, y: 0 })
  }

  // Load natural dimensions
  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const target = e.currentTarget
    setImgSize({ w: target.naturalWidth, h: target.naturalHeight })
    setPan({ x: 0, y: 0 })
  }

  // Calculate clamped pan to prevent dragging beyond boundaries
  const clampPan = useCallback(
    (nextX: number, nextY: number, curZoom: number, curRot: number) => {
      if (!imgSize) return { x: 0, y: 0 }
      const isRotated90 = curRot === 90 || curRot === 270
      const iw = isRotated90 ? imgSize.h : imgSize.w
      const ih = isRotated90 ? imgSize.w : imgSize.h

      // 'fit' uses Math.min (whole image visible, space around), all others use Math.max (fills the box)
      const baseScale =
        preset === 'fit'
          ? Math.min(VIEW_W / iw, VIEW_H / ih)
          : Math.max(VIEW_W / iw, VIEW_H / ih)

      const renderedW = iw * baseScale * curZoom
      const renderedH = ih * baseScale * curZoom

      const maxPanX = Math.max(0, (renderedW - VIEW_W) / 2)
      const maxPanY = Math.max(0, (renderedH - VIEW_H) / 2)

      return {
        x: Math.max(-maxPanX, Math.min(maxPanX, nextX)),
        y: Math.max(-maxPanY, Math.min(maxPanY, nextY)),
      }
    },
    [imgSize, preset, VIEW_W, VIEW_H],
  )

  const handleZoomChange = (newZoom: number) => {
    const clampedZoom = Math.max(1.0, Math.min(3.0, newZoom))
    setZoom(clampedZoom)
    setPan((prev) => clampPan(prev.x, prev.y, clampedZoom, rotation))
  }

  const handleRotate = () => {
    const nextRot = (rotation + 90) % 360
    setRotation(nextRot)
    setPan((prev) => clampPan(prev.x, prev.y, zoom, nextRot))
  }

  const handleReset = () => {
    setZoom(1.0)
    setRotation(0)
    setPan({ x: 0, y: 0 })
  }

  // Drag handling
  const onMouseDown = (e: ReactMouseEvent) => {
    e.preventDefault()
    setDragging(true)
    setDragStart({ x: e.clientX, y: e.clientY })
    setStartPan(pan)
  }

  const onMouseMove = (e: ReactMouseEvent) => {
    if (!dragging) return
    const dx = e.clientX - dragStart.x
    const dy = e.clientY - dragStart.y
    const clamped = clampPan(startPan.x + dx, startPan.y + dy, zoom, rotation)
    setPan(clamped)
  }

  const onMouseUp = () => {
    setDragging(false)
  }

  // Touch drag
  const onTouchStart = (e: ReactTouchEvent) => {
    if (e.touches.length === 1) {
      setDragging(true)
      setDragStart({ x: e.touches[0].clientX, y: e.touches[0].clientY })
      setStartPan(pan)
    }
  }

  const onTouchMove = (e: ReactTouchEvent) => {
    if (!dragging || e.touches.length !== 1) return
    const dx = e.touches[0].clientX - dragStart.x
    const dy = e.touches[0].clientY - dragStart.y
    const clamped = clampPan(startPan.x + dx, startPan.y + dy, zoom, rotation)
    setPan(clamped)
  }

  const onTouchEnd = () => {
    setDragging(false)
  }

  // Save the cropped image to canvas — exact WYSIWYG export
  const handleSaveCrop = () => {
    if (!imgRef.current || !imgSize) {
      onClose()
      return
    }

    const isRotated90 = rotation === 90 || rotation === 270
    const iw = isRotated90 ? imgSize.h : imgSize.w
    const ih = isRotated90 ? imgSize.w : imgSize.h

    // Output canvas size: 2.5x the view size, longest edge capped at 1000px
    const scale25 = 2.5
    let OUT_W = VIEW_W * scale25
    let OUT_H = VIEW_H * scale25
    const maxEdge = 1000
    if (Math.max(OUT_W, OUT_H) > maxEdge) {
      const fit = maxEdge / Math.max(OUT_W, OUT_H)
      OUT_W = Math.round(OUT_W * fit)
      OUT_H = Math.round(OUT_H * fit)
    } else {
      OUT_W = Math.round(OUT_W)
      OUT_H = Math.round(OUT_H)
    }

    const scaleFactor = OUT_W / VIEW_W

    // baseScale matches preview exactly
    const baseScale =
      preset === 'fit'
        ? Math.min(VIEW_W / iw, VIEW_H / ih)
        : Math.max(VIEW_W / iw, VIEW_H / ih)

    const canvas = document.createElement('canvas')
    canvas.width = OUT_W
    canvas.height = OUT_H
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      toast('Failed to adjust image.')
      onClose()
      return
    }

    // Leave uncovered space transparent (no solid white fill) so it blends
    // with the card background in Light Mode or Dark Mode.
    ctx.save()
    ctx.translate(OUT_W / 2 + pan.x * scaleFactor, OUT_H / 2 + pan.y * scaleFactor)
    ctx.rotate((rotation * Math.PI) / 180)
    ctx.scale(baseScale * zoom * scaleFactor, baseScale * zoom * scaleFactor)
    ctx.drawImage(imgRef.current, -imgSize.w / 2, -imgSize.h / 2)
    ctx.restore()

    let dataUrl: string
    try {
      dataUrl = canvas.toDataURL('image/webp', 0.9)
    } catch {
      dataUrl = canvas.toDataURL('image/png')
    }
    replaceImgData(imgId, dataUrl, OUT_W, OUT_H, {
      preset,
      zoom,
      rotation,
      pan: { x: pan.x, y: pan.y },
    })
    bumpImgVersion()
    toast('Photo adjusted.')
    onSave()
    onClose()
  }

  // Base scale calculation for preview styling
  const isRotated90 = rotation === 90 || rotation === 270
  const iw = imgSize ? (isRotated90 ? imgSize.h : imgSize.w) : VIEW_W
  const ih = imgSize ? (isRotated90 ? imgSize.w : imgSize.h) : VIEW_H

  const baseScale =
    preset === 'fit'
      ? Math.min(VIEW_W / iw, VIEW_H / ih)
      : Math.max(VIEW_W / iw, VIEW_H / ih)

  return (
    <div className="crop-overlay" role="dialog" aria-modal="true" aria-label="Adjust photo preview">
      <div className="crop-modal card">
        <div className="row between" style={{ marginBottom: 12 }}>
          <div>
            <b>Adjust photo preview</b>
            <div className="tiny muted">
              Drag to reposition · Zoom in to frame the best view without empty borders.
            </div>
          </div>
          <button type="button" className="iconbtn" aria-label="Close" onClick={onClose}>
            <Icon name="x" size="sm" />
          </button>
        </div>

        <div className="crop-stage">
          <div
            ref={viewportRef}
            className={`crop-viewport ${dragging ? 'is-dragging' : ''}`}
            style={{
              width: VIEW_W + 'px',
              height: VIEW_H + 'px',
              maxWidth: '100%',
              boxSizing: 'border-box',
            }}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseUp}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
          >
          <img
            ref={imgRef}
            src={originalSrc}
            alt="Adjusting"
            draggable={false}
            onLoad={handleImageLoad}
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              transform: `translate(-50%, -50%) translate(${pan.x}px, ${pan.y}px) rotate(${rotation}deg) scale(${baseScale * zoom})`,
              transformOrigin: 'center center',
              userSelect: 'none',
              pointerEvents: 'none',
              maxWidth: 'none',
              maxHeight: 'none',
            }}
          />
          <div className="crop-grid-overlay" />
          </div>
        </div>

        {/* Aspect ratio presets */}
        <div
          className="row wrap"
          style={{ gap: 6, justifyContent: 'center', marginTop: 10, flexWrap: 'wrap' }}
        >
          {Object.entries(ASPECT_PRESETS).map(([key, p]) => {
            const active = preset === key
            return (
              <button
                key={key}
                type="button"
                className={`aspect-pill ${active ? 'on' : ''}`}
                aria-label={`Aspect ratio ${p.label}`}
                onClick={() => handlePresetChange(key as AspectPreset)}
              >
                {p.label}
              </button>
            )
          })}
        </div>

        <div className="crop-controls stack" style={{ gap: 12, marginTop: 14 }}>
          <div className="row wrap" style={{ alignItems: 'center', gap: 10 }}>
            <span className="small muted">Zoom</span>
            <button
              type="button"
              className="btn ghost sm"
              aria-label="Zoom out"
              onClick={() => handleZoomChange(zoom - 0.2)}
            >
              −
            </button>
            <input
              type="range"
              min="1.0"
              max="3.0"
              step="0.05"
              value={zoom}
              onChange={(e) => handleZoomChange(parseFloat(e.target.value))}
              style={{ flex: 1, minWidth: 120 }}
            />
            <button
              type="button"
              className="btn ghost sm"
              aria-label="Zoom in"
              onClick={() => handleZoomChange(zoom + 0.2)}
            >
              +
            </button>
            <span className="tiny tnum muted">{Math.round(zoom * 100)}%</span>
          </div>

          <div className="row wrap" style={{ gap: 8, justifyContent: 'space-between' }}>
            <div className="row" style={{ gap: 6 }}>
              <button type="button" className="btn ghost sm" onClick={handleRotate}>
                <Icon name="arrow" size="sm" />
                Rotate 90°
              </button>
              <button type="button" className="btn ghost sm" onClick={handleReset}>
                Reset
              </button>
            </div>

            <div className="row" style={{ gap: 6 }}>
              <button type="button" className="btn ghost sm" onClick={onClose}>
                Cancel
              </button>
              <button type="button" className="btn yellow sm" onClick={handleSaveCrop}>
                Apply & Save
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

interface AvatarAdjustModalProps {
  src: string
  onClose: () => void
  onSave: (dataUrl: string) => void
}

/**
 * AvatarAdjustModal — circular 1:1 avatar crop/zoom/rotate editor.
 * Fixed 300×300 viewport with a circular preview mask so the user sees
 * exactly how their circular avatar will look. Exports a crisp 512×512
 * JPEG data URL via onSave.
 */
export function AvatarAdjustModal({ src, onClose, onSave }: AvatarAdjustModalProps) {
  const [zoom, setZoom] = useState(1.0)
  const [rotation, setRotation] = useState(0) // 0, 90, 180, 270
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const [imgSize, setImgSize] = useState<{ w: number; h: number } | null>(null)
  const [dragging, setDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [startPan, setStartPan] = useState({ x: 0, y: 0 })

  const viewportRef = useRef<HTMLDivElement | null>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)

  // Fixed square viewport for avatar (1:1)
  const VIEW_W = 300
  const VIEW_H = 300
  const OUT_W = 512
  const OUT_H = 512

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    setImgSize({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })
    setPan({ x: 0, y: 0 })
  }

  const clampPan = useCallback(
    (nextX: number, nextY: number, curZoom: number, curRot: number) => {
      if (!imgSize) return { x: 0, y: 0 }
      const isRotated90 = curRot === 90 || curRot === 270
      const iw = isRotated90 ? imgSize.h : imgSize.w
      const ih = isRotated90 ? imgSize.w : imgSize.h
      // Always fit mode: min scale keeps the whole image inside the box
      const baseScale = Math.min(VIEW_W / iw, VIEW_H / ih)
      const renderedW = iw * baseScale * curZoom
      const renderedH = ih * baseScale * curZoom
      const maxPanX = Math.max(0, (renderedW - VIEW_W) / 2)
      const maxPanY = Math.max(0, (renderedH - VIEW_H) / 2)
      return {
        x: Math.max(-maxPanX, Math.min(maxPanX, nextX)),
        y: Math.max(-maxPanY, Math.min(maxPanY, nextY)),
      }
    },
    [imgSize],
  )

  const handleZoomChange = (newZoom: number) => {
    const clampedZoom = Math.max(1.0, Math.min(3.0, newZoom))
    setZoom(clampedZoom)
    setPan((prev) => clampPan(prev.x, prev.y, clampedZoom, rotation))
  }

  const handleRotate = () => {
    const nextRot = (rotation + 90) % 360
    setRotation(nextRot)
    setPan((prev) => clampPan(prev.x, prev.y, zoom, nextRot))
  }

  const handleReset = () => {
    setZoom(1.0)
    setRotation(0)
    setPan({ x: 0, y: 0 })
  }

  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    setDragging(true)
    setDragStart({ x: e.clientX, y: e.clientY })
    setStartPan(pan)
  }

  const onMouseMove = (e: React.MouseEvent) => {
    if (!dragging) return
    const dx = e.clientX - dragStart.x
    const dy = e.clientY - dragStart.y
    const clamped = clampPan(startPan.x + dx, startPan.y + dy, zoom, rotation)
    setPan(clamped)
  }

  const onMouseUp = () => {
    setDragging(false)
  }

  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      setDragging(true)
      setDragStart({ x: e.touches[0].clientX, y: e.touches[0].clientY })
      setStartPan(pan)
    }
  }

  const onTouchMove = (e: React.TouchEvent) => {
    if (!dragging || e.touches.length !== 1) return
    const dx = e.touches[0].clientX - dragStart.x
    const dy = e.touches[0].clientY - dragStart.y
    const clamped = clampPan(startPan.x + dx, startPan.y + dy, zoom, rotation)
    setPan(clamped)
  }

  const onTouchEnd = () => {
    setDragging(false)
  }

  const handleSaveAvatar = () => {
    if (!imgRef.current || !imgSize) {
      onClose()
      return
    }
    const canvas = document.createElement('canvas')
    canvas.width = OUT_W
    canvas.height = OUT_H
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      onClose()
      return
    }
    const isRotated90 = rotation === 90 || rotation === 270
    const iw = isRotated90 ? imgSize.h : imgSize.w
    const ih = isRotated90 ? imgSize.w : imgSize.h
    const baseScale = Math.min(VIEW_W / iw, VIEW_H / ih)
    const scaleFactor = OUT_W / VIEW_W

    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, OUT_W, OUT_H)
    ctx.save()
    ctx.translate(OUT_W / 2 + pan.x * scaleFactor, OUT_H / 2 + pan.y * scaleFactor)
    ctx.rotate((rotation * Math.PI) / 180)
    ctx.scale(baseScale * zoom * scaleFactor, baseScale * zoom * scaleFactor)
    ctx.drawImage(imgRef.current, -imgSize.w / 2, -imgSize.h / 2)
    ctx.restore()

    const dataUrl = canvas.toDataURL('image/jpeg', 0.88)
    onSave(dataUrl)
    onClose()
  }

  // Preview base scale (fit mode)
  const isRotated90 = rotation === 90 || rotation === 270
  const iw = imgSize ? (isRotated90 ? imgSize.h : imgSize.w) : VIEW_W
  const ih = imgSize ? (isRotated90 ? imgSize.w : imgSize.h) : VIEW_H
  const baseScale = Math.min(VIEW_W / iw, VIEW_H / ih)

  return (
    <div
      className="avatar-adjust-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Adjust avatar"
    >
      <div
        className="avatar-adjust-shell"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="avatar-adjust-header">
          <h2 className="avatar-adjust-title">Adjust profile picture</h2>
          <button
            type="button"
            className="avatar-adjust-close"
            aria-label="Close"
            onClick={onClose}
          >
            &times;
          </button>
        </div>

        <div
          ref={viewportRef}
          className={`avatar-viewport ${dragging ? 'is-dragging' : ''}`}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          <img
            ref={imgRef}
            src={src}
            alt="Adjusting avatar"
            draggable={false}
            onLoad={handleImageLoad}
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              transform: `translate(-50%, -50%) translate(${pan.x}px, ${pan.y}px) rotate(${rotation}deg) scale(${baseScale * zoom})`,
              transformOrigin: 'center center',
              userSelect: 'none',
              pointerEvents: 'none',
              maxWidth: 'none',
              maxHeight: 'none',
            }}
          />
          <div className="avatar-mask" />
          <div className="avatar-grid-overlay" />
        </div>

        <div className="avatar-adjust-controls stack" style={{ gap: 12, marginTop: 14 }}>
          <div className="row wrap" style={{ alignItems: 'center', gap: 10 }}>
            <span className="small muted">Zoom</span>
            <button
              type="button"
              className="btn ghost sm"
              aria-label="Zoom out"
              onClick={() => handleZoomChange(zoom - 0.2)}
            >
              −
            </button>
            <input
              type="range"
              min="1.0"
              max="3.0"
              step="0.05"
              value={zoom}
              onChange={(e) => handleZoomChange(parseFloat(e.target.value))}
              style={{ flex: 1, minWidth: 120 }}
            />
            <button
              type="button"
              className="btn ghost sm"
              aria-label="Zoom in"
              onClick={() => handleZoomChange(zoom + 0.2)}
            >
              +
            </button>
            <span className="tiny tnum muted">{Math.round(zoom * 100)}%</span>
          </div>

          <div className="row wrap" style={{ gap: 8, justifyContent: 'space-between' }}>
            <div className="row" style={{ gap: 6 }}>
              <button type="button" className="btn ghost sm" onClick={handleRotate}>
                <Icon name="arrow" size="sm" />
                Rotate 90°
              </button>
              <button type="button" className="btn ghost sm" onClick={handleReset}>
                Reset
              </button>
            </div>
            <div className="row" style={{ gap: 6 }}>
              <button type="button" className="btn ghost sm" onClick={onClose}>
                Cancel
              </button>
              <button type="button" className="btn yellow sm" onClick={handleSaveAvatar}>
                Apply & Save
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function PhotoUploader({
  ids,
  max = IMG_RULES.listing,
  label = 'Photos',
  hint,
  errorMsg,
  onChange,
  onError,
}: PhotoUploaderProps) {
  const { toast, bumpImgVersion } = useTindahan()
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [busy, setBusy] = useState(false)
  const [localErr, setLocalErr] = useState('')
  const [cropTargetId, setCropTargetId] = useState<string | null>(null)

  const cleanIds = (ids || []).filter((id) => imgSrc(id)).slice(0, max)

  const handleFiles = async (files: File[]) => {
    if (!files.length || busy) return
    const room = max - cleanIds.length
    if (room <= 0) {
      const msg = `You can upload up to ${max} photo${max > 1 ? 's' : ''}. Remove one first.`
      setLocalErr(msg)
      toast(msg)
      onError?.(msg)
      return
    }

    const errs: string[] = []
    let todo = files
    if (todo.length > room) {
      errs.push(
        `Maximum of ${max} photos allowed. Only ${room} more photo${
          room === 1 ? '' : 's'
        } fit${room === 1 ? 's' : ''}; the rest were skipped.`,
      )
      todo = todo.slice(0, room)
    }

    setBusy(true)
    setLocalErr('')
    const next = [...cleanIds]
    let firstNewId: string | null = null

    for (const file of todo) {
      if (next.length >= max) break
      const res = await imgAdd(file)
      if (res.id) {
        next.push(res.id)
        if (!firstNewId) firstNewId = res.id
      } else if (res.err) {
        errs.push(res.err)
      }
    }

    setBusy(false)
    if (errs.length) {
      const joined = errs.join(' ')
      setLocalErr(joined)
      toast(joined)
      onError?.(joined)
    }
    bumpImgVersion()
    onChange(next.slice(0, max))

    if (firstNewId) {
      setCropTargetId(firstNewId)
    }
  }

  const moveImage = (fromIdx: number, toIdx: number) => {
    if (toIdx < 0 || toIdx >= cleanIds.length) return
    const copy = [...cleanIds]
    const [picked] = copy.splice(fromIdx, 1)
    copy.splice(toIdx, 0, picked)
    onChange(copy)
  }

  const shownErr = errorMsg || localErr

  return (
    <div className="field">
      <div className="row between">
        <label htmlFor={inputId}>{label}</label>
        <span className="tiny muted tnum" style={{ fontWeight: 700 }}>
          {cleanIds.length}/{max} Photos
        </span>
      </div>

      <div
        className={`row wrap upl ${dragOver ? 'drag' : ''}`.trim()}
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragOver(false)
          const dropped = Array.from(e.dataTransfer?.files || [])
          void handleFiles(dropped)
        }}
      >
        {cleanIds.map((id, i) => {
          const src = imgSrc(id)
          if (!src) return null
          return (
            <div key={id} className="uthumb">
              <img src={src} alt={`Photo ${i + 1} preview`} />
              {i === 0 && max > 1 && <span className="ubadge">Main</span>}
              {i > 0 && max > 1 && (
                <button
                  type="button"
                  className="ubadge btn-mini"
                  title="Use as main primary photo"
                  aria-label={`Make photo ${i + 1} the main photo`}
                  onClick={() => {
                    const copy = [...cleanIds]
                    const [picked] = copy.splice(i, 1)
                    copy.unshift(picked)
                    onChange(copy)
                  }}
                >
                  Make main
                </button>
              )}
              {cleanIds.length > 1 && (
                <div className="uorder-row" role="group" aria-label={`Reorder photo ${i + 1}`}>
                  <button
                    type="button"
                    className="uorder-btn"
                    disabled={i === 0}
                    title="Move earlier"
                    aria-label={`Move photo ${i + 1} left`}
                    onClick={() => moveImage(i, i - 1)}
                  >
                    ‹
                  </button>
                  <button
                    type="button"
                    className="uorder-btn"
                    disabled={i === cleanIds.length - 1}
                    title="Move later"
                    aria-label={`Move photo ${i + 1} right`}
                    onClick={() => moveImage(i, i + 1)}
                  >
                    ›
                  </button>
                </div>
              )}
              <button
                type="button"
                className="uadjust"
                title="Adjust position & zoom"
                aria-label={`Adjust photo ${i + 1}`}
                onClick={() => setCropTargetId(id)}
              >
                Adjust
              </button>
              <button
                type="button"
                className="uremove"
                aria-label={`Remove photo ${i + 1}`}
                onClick={() => {
                  const copy = cleanIds.filter((_, idx) => idx !== i)
                  onChange(copy)
                }}
              >
                <Icon name="x" size="sm" />
              </button>
            </div>
          )
        })}

        {cleanIds.length < max && (
          <>
            <label htmlFor={inputId} className={`uadd ${busy ? 'busy' : ''}`.trim()}>
              <Icon name="plus" />
              <span className="tiny">{busy ? 'Adding photos' : 'Add photo'}</span>
            </label>
            <input
              ref={inputRef}
              id={inputId}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple={max > 1}
              hidden
              disabled={busy}
              onChange={(e) => {
                const selected = Array.from(e.target.files || [])
                e.target.value = ''
                void handleFiles(selected)
              }}
            />
          </>
        )}
      </div>

      <span className="tiny muted">
        {hint ||
          `Upload up to ${max} photos (JPEG, PNG or WebP, up to 5 MB each). The first photo is used as the primary listing image. Tap "Adjust" to crop or use ‹ › to rearrange.`}
      </span>
      {shownErr && (
        <span className="err" role="alert">
          {shownErr}
        </span>
      )}

      {cropTargetId && (
        <ImageAdjustModal
          imgId={cropTargetId}
          onClose={() => setCropTargetId(null)}
          onSave={() => {
            onChange([...cleanIds])
          }}
        />
      )}
    </div>
  )
}

export function ProductGallery({
  product,
  favButton,
  onMainImageClick,
  onNavigate,
}: {
  product: PrototypeProduct
  favButton?: ReactNode
  onMainImageClick?: (idx: number) => void
  onNavigate?: (dir: -1 | 1) => void
}) {
  const list = imgsOf(product)
  const [selectedIdx, setSelectedIdx] = useState(0)

  if (!list.length) {
    return (
      <div className="rel">
        <div
          className={`photo ${product.tone || 't-study'} nophoto-tile`}
          style={{ aspectRatio: '4 / 3', borderRadius: 16 }}
        >
          <Icon name={(product.icon || 'bag') as IconName} />
          <span className="tag">{product.tag || ''}</span>
          <span className="nophoto">No photo yet</span>
        </div>
        {favButton}
      </div>
    )
  }

  const clampedIdx = Math.min(selectedIdx, Math.max(0, list.length - 1))
  const activeId = list[clampedIdx] || list[0]
  const activeSrc = imgSrc(activeId) || imgSrc(list[0]) || ''

  const goTo = (dir: -1 | 1) => {
    const next = clampedIdx + dir
    if (next < 0 || next >= list.length) return
    setSelectedIdx(next)
    onNavigate?.(dir)
  }

  return (
    <div className="stack" style={{ gap: 10 }}>
      <div className="rel gal-main">
        <img
          className="gal-img pimg"
          src={activeSrc}
          alt={`${product.name}, photo ${clampedIdx + 1} of ${list.length}`}
          style={{ cursor: list.length > 1 ? 'zoom-in' : 'default' }}
          onClick={() => onMainImageClick?.(clampedIdx)}
        />
        <span className="tag gal-tag">{product.tag || ''}</span>
        {favButton}
        {list.length > 1 && (
          <>
            <button
              type="button"
              className="gal-nav gal-nav-prev"
              aria-label="Previous photo"
              onClick={(e) => { e.stopPropagation(); goTo(-1) }}
            >
              ‹
            </button>
            <button
              type="button"
              className="gal-nav gal-nav-next"
              aria-label="Next photo"
              onClick={(e) => { e.stopPropagation(); goTo(1) }}
            >
              ›
            </button>
          </>
        )}
      </div>
      {list.length > 1 && (
        <div className="row pdp-thumbs">
          {list.map((id, i) => {
            const src = imgSrc(id)
            if (!src) return null
            return (
              <button
                key={id}
                type="button"
                className={`gal-th ${i === clampedIdx ? 'on' : ''}`.trim()}
                aria-label={`Show photo ${i + 1}`}
                aria-pressed={i === clampedIdx}
                onClick={() => setSelectedIdx(i)}
              >
                <img src={src} alt="" />
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
