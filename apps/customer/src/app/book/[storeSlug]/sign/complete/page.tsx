import { notFound } from 'next/navigation'
import Link from 'next/link'
import { prismaAdmin } from '@repo/db'

interface Props {
  params: { storeSlug: string }
  searchParams: { appointmentId?: string }
}

export const metadata = {
  title: '預約完成',
}

function formatDateTime(date: Date): string {
  return date.toLocaleString('zh-TW', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

function formatCurrency(amount: number): string {
  return `NT$ ${amount.toLocaleString()}`
}

export default async function CompletePage({ params, searchParams }: Props) {
  const { appointmentId } = searchParams
  if (!appointmentId) notFound()

  const appointment = await prismaAdmin.appointment.findUnique({
    where: { id: appointmentId },
    select: {
      id: true,
      scheduledAt: true,
      estimatedDuration: true,
      pickupDeadlineAt: true,
      signedOnline: true,
      customer: { select: { name: true, phone: true } },
      pet: { select: { name: true, species: true } },
      staff: { select: { name: true } },
      order: {
        select: {
          id: true,
          totalAmount: true,
          subtotalAmount: true,
          discountAmount: true,
          items: {
            select: {
              serviceName: true,
              unitPrice: true,
              quantity: true,
              amount: true,
            },
          },
        },
      },
    },
  })

  if (!appointment) notFound()

  const store = await prismaAdmin.store.findUnique({
    where: { slug: params.storeSlug },
    select: { name: true, address: true, phone: true },
  })

  return (
    <div className="flex min-h-screen flex-col bg-[#FAF7F2]">
      {/* 成功橫幅 */}
      <div className="bg-[#78573A] px-6 py-8 text-center text-white">
        <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-white/20 text-3xl">
          ✓
        </div>
        <h1 className="text-xl font-bold">預約完成！</h1>
        <p className="mt-1 text-sm text-white/80">
          契約已線上簽署，請保留此頁截圖
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {/* 預約摘要 */}
        <section className="mb-4 overflow-hidden rounded-2xl border border-[#E5D9CC] bg-white">
          <div className="border-b border-[#E5D9CC] px-4 py-3">
            <h2 className="font-semibold text-[#3B2F2A]">預約摘要</h2>
          </div>
          <div className="divide-y divide-[#F0E8DF] px-4 py-2">
            <Row label="店家" value={store?.name ?? ''} />
            <Row
              label="預約時間"
              value={formatDateTime(appointment.scheduledAt)}
            />
            {appointment.pickupDeadlineAt && (
              <Row
                label="取件截止"
                value={formatDateTime(appointment.pickupDeadlineAt)}
              />
            )}
            <Row
              label="預估時長"
              value={`約 ${appointment.estimatedDuration} 分鐘`}
            />
            <Row
              label="毛孩"
              value={`${appointment.pet.name}（${appointment.pet.species === 'DOG' ? '狗' : '貓'}）`}
            />
            {appointment.staff && (
              <Row label="指定美容師" value={appointment.staff.name} />
            )}
          </div>
        </section>

        {/* 服務明細 */}
        {appointment.order && (
          <section className="mb-4 overflow-hidden rounded-2xl border border-[#E5D9CC] bg-white">
            <div className="border-b border-[#E5D9CC] px-4 py-3">
              <h2 className="font-semibold text-[#3B2F2A]">服務明細</h2>
            </div>
            <div className="px-4 py-2">
              {appointment.order.items.map((item, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between border-b border-[#F0E8DF] py-2 last:border-0"
                >
                  <span className="text-sm text-[#3B2F2A]">
                    {item.serviceName}
                    {item.quantity > 1 && (
                      <span className="ml-1 text-xs text-[#9ca3af]">
                        ×{item.quantity}
                      </span>
                    )}
                  </span>
                  <span className="text-sm text-[#3B2F2A]">
                    {formatCurrency(item.amount)}
                  </span>
                </div>
              ))}
              {appointment.order.discountAmount > 0 && (
                <div className="flex justify-between py-2 text-sm">
                  <span className="text-green-600">折扣</span>
                  <span className="text-green-600">
                    -{formatCurrency(appointment.order.discountAmount)}
                  </span>
                </div>
              )}
              <div className="flex justify-between py-2 font-semibold">
                <span className="text-[#3B2F2A]">合計</span>
                <span className="text-[#78573A]">
                  {formatCurrency(appointment.order.totalAmount)}
                </span>
              </div>
            </div>
          </section>
        )}

        {/* 契約已簽 Badge */}
        <div className="mb-4 flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3">
          <span className="text-green-600">📄</span>
          <div>
            <p className="text-sm font-medium text-green-700">
              定型化契約已線上簽署
            </p>
            <p className="text-xs text-green-600">
              契約 PDF 將透過 LINE 傳送，請妥善保存
            </p>
          </div>
        </div>

        {/* 加購提醒 */}
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-sm font-medium text-amber-800">到店加購提醒</p>
          <p className="mt-1 text-xs leading-relaxed text-amber-700">
            本次為線上簽約。如到店有需要增加服務項目，將由店家協助補簽「補充服務契約」，原契約費用不變。
          </p>
        </div>

        {/* 店家資訊 */}
        {store && (
          <section className="mb-4 overflow-hidden rounded-2xl border border-[#E5D9CC] bg-white">
            <div className="border-b border-[#E5D9CC] px-4 py-3">
              <h2 className="font-semibold text-[#3B2F2A]">店家資訊</h2>
            </div>
            <div className="divide-y divide-[#F0E8DF] px-4 py-2">
              <Row label="地址" value={store.address ?? ''} />
              <Row label="電話" value={store.phone ?? ''} />
            </div>
          </section>
        )}

        {/* 回首頁 */}
        <Link
          href={`/book/${params.storeSlug}`}
          className="flex min-h-[52px] items-center justify-center rounded-2xl border border-[#E5D9CC] bg-white text-[#78573A]"
        >
          返回預約頁
        </Link>

        <p className="mt-6 mb-4 text-center text-xs text-[#9ca3af]">
          預約編號：{appointment.id.slice(0, 8).toUpperCase()}
        </p>
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  if (!value) return null
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <span className="shrink-0 text-sm text-[#9ca3af]">{label}</span>
      <span className="text-right text-sm text-[#3B2F2A]">{value}</span>
    </div>
  )
}
