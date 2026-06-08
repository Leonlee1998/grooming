'use client'

import { useRef, useCallback, useState } from 'react'
import { BigButton } from '@/components/ui/BigButton'

interface SignaturePadProps {
  onConfirm: (dataUrl: string) => void
}

export function SignaturePad({ onConfirm }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const isDrawing = useRef(false)
  const [isEmpty, setIsEmpty] = useState(true)

  const getPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    return {
      x: (e.clientX - rect.left) * (canvas.width / rect.width),
      y: (e.clientY - rect.top) * (canvas.height / rect.height),
    }
  }

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      e.currentTarget.setPointerCapture(e.pointerId)
      isDrawing.current = true
      setIsEmpty(false)
      const ctx = canvasRef.current?.getContext('2d')
      if (!ctx) return
      const { x, y } = getPos(e)
      ctx.beginPath()
      ctx.moveTo(x, y)
    },
    [],
  )

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!isDrawing.current) return
      const ctx = canvasRef.current?.getContext('2d')
      if (!ctx) return
      const { x, y } = getPos(e)
      ctx.lineTo(x, y)
      ctx.strokeStyle = '#1c1917'
      ctx.lineWidth = 2.5
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.stroke()
    },
    [],
  )

  const onPointerUp = useCallback(() => {
    isDrawing.current = false
  }, [])

  const clear = useCallback(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setIsEmpty(true)
  }, [])

  const confirm = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    onConfirm(canvas.toDataURL('image/png'))
  }, [onConfirm])

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-stone-500">請在下方框內簽名</p>
      <canvas
        ref={canvasRef}
        width={900}
        height={320}
        className="w-full rounded-xl border-2 border-stone-300 bg-white touch-none cursor-crosshair"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
      />
      <div className="flex gap-3">
        <BigButton variant="secondary" onClick={clear} className="w-32">
          清除
        </BigButton>
        <BigButton fullWidth disabled={isEmpty} onClick={confirm}>
          確認簽名
        </BigButton>
      </div>
    </div>
  )
}
