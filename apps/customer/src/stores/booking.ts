import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export interface BookingService {
  serviceId: string
  serviceName: string
  unitPrice: number
  quantity: number
}

export interface BookingDraft {
  storeSlug: string
  storeId: string
  storeName: string
  storeAddress: string
  storePhone: string
  // 客戶資訊
  customerName: string
  customerPhone: string
  customerEmail: string
  emergencyContact: string
  emergencyPhone: string
  // 寵物資訊
  petName: string
  petSpecies: string
  petBreed: string
  petWeight: string
  petGender: string
  petBirthDate: string
  isAggressive: boolean
  hasDisease: boolean
  diseaseNotes: string
  isVaccinated: boolean
  isDewormed: boolean
  preferredVetName: string
  preferredVetPhone: string
  // 服務
  services: BookingService[]
  staffId?: string
  staffName: string
  staffSurcharge: number
  subtotalAmount: number
  discountAmount: number
  totalAmount: number
  // 時間
  scheduledAt: string
  estimatedDuration: number
  pickupDeadlineAt: string
}

interface BookingStore {
  draft: BookingDraft | null
  setDraft: (draft: BookingDraft) => void
  clearDraft: () => void
}

export const useBookingStore = create<BookingStore>()(
  persist(
    (set) => ({
      draft: null,
      setDraft: (draft) => set({ draft }),
      clearDraft: () => set({ draft: null }),
    }),
    {
      name: 'customer-booking-draft',
      storage: createJSONStorage(() =>
        typeof window !== 'undefined' ? sessionStorage : localStorage,
      ),
    },
  ),
)
