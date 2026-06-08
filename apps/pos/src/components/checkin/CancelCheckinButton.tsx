'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { BigButton } from '@/components/ui/BigButton'
import { useCheckinStore } from '@/stores/checkin'
import { cancelDraftOrder } from '@/app/(grooming)/checkin/actions'

interface CancelCheckinButtonProps {
  className?: string
}

export function CancelCheckinButton({
  className = '',
}: CancelCheckinButtonProps) {
  const router = useRouter()
  const { orderId, reset } = useCheckinStore((s) => ({
    orderId: s.orderId,
    reset: s.reset,
  }))
  const [loading, setLoading] = useState(false)

  async function handleCancel() {
    const confirmed = window.confirm('取消後會清除本次報到資料，確定要離開嗎？')
    if (!confirmed) return
    setLoading(true)
    if (orderId) await cancelDraftOrder(orderId)
    reset()
    router.push('/')
  }

  return (
    <BigButton
      variant="danger"
      onClick={handleCancel}
      disabled={loading}
      className={className}
    >
      {loading ? '取消中…' : '取消報到'}
    </BigButton>
  )
}
