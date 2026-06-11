'use client'

import { create } from 'zustand'

export interface SelectedService {
  serviceId: string
  serviceName: string
  basePrice: number
  unitPrice: number
  quantity: number
  estimatedMinutes: number
  priceAdjustments: Array<{
    ruleName: string
    amount: number
  }>
}

const initialState = {
  customerId: null as string | null,
  customerName: '',
  customerPhone: '',
  customerEmail: '',
  emergencyContact: '',
  emergencyPhone: '',

  petId: null as string | null,
  petName: '',
  petSpecies: '',
  petBreed: '',
  petWeight: '',
  petGender: '',
  petBirthDate: '',
  isAggressive: false,
  hasDisease: false,
  diseaseNotes: '',
  isVaccinated: false,
  isDewormed: false,
  preferredVetName: '',
  preferredVetPhone: '',

  selectedServices: [] as SelectedService[],
  staffId: null as string | null,
  staffName: '',
  staffSurcharge: 0,

  scheduledAt: '',
  estimatedDuration: 60,
  pickupDeadlineAt: '',
  subtotalAmount: 0,
  discountAmount: 0,
  totalAmount: 0,

  memberId: null as string | null,
  memberBalance: null as number | null,

  paymentMethod: null as 'CASH' | 'CARD' | 'TRANSFER' | 'MEMBER_BALANCE' | null,

  orderId: null as string | null,
  contractId: null as string | null,
  earnedPoints: null as number | null,

  orderNotes: '',

  // 線上預簽契約資訊（加購補簽用）
  onlineContractId: null as string | null,
  appointmentId: null as string | null,
  originalDraftOrderId: null as string | null,
  onlineContractServiceIds: [] as string[],
  needsSupplementary: false,

  // 確認到店（線上已簽約，無需補簽）
  hasOnlineContract: false,
}

type State = typeof initialState

interface Actions {
  setCustomer: (data: {
    customerId: string
    customerName: string
    customerPhone: string
    customerEmail: string
    emergencyContact: string
    emergencyPhone: string
  }) => void
  setPet: (data: {
    petId: string
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
  }) => void
  setServices: (services: SelectedService[]) => void
  setStaff: (data: {
    staffId: string | null
    staffName: string
    staffSurcharge: number
  }) => void
  setPriceQuote: (data: {
    estimatedDuration: number
    subtotalAmount: number
    discountAmount: number
    totalAmount: number
    memberId: string | null
    memberBalance: number | null
  }) => void
  setPaymentMethod: (
    method: 'CASH' | 'CARD' | 'TRANSFER' | 'MEMBER_BALANCE' | null,
  ) => void
  setSchedule: (data: {
    scheduledAt: string
    estimatedDuration: number
    pickupDeadlineAt: string
  }) => void
  setOrderId: (orderId: string) => void
  setContract: (data: {
    contractId: string
    earnedPoints: number | null
  }) => void
  setOrderNotes: (notes: string) => void
  setOnlineContract: (data: {
    onlineContractId: string | null
    appointmentId: string | null
    originalDraftOrderId: string | null
    onlineContractServiceIds: string[]
  }) => void
  setNeedsSupplementary: (needs: boolean) => void
  setHasOnlineContract: (value: boolean) => void
  reset: () => void
}

export const useCheckinStore = create<State & Actions>((set) => ({
  ...initialState,
  setCustomer: (data) => set(data),
  setPet: (data) => set(data),
  setServices: (selectedServices) => set({ selectedServices }),
  setStaff: (data) => set(data),
  setPriceQuote: (data) => set(data),
  setPaymentMethod: (paymentMethod) => set({ paymentMethod }),
  setSchedule: (data) => set(data),
  setOrderId: (orderId) => set({ orderId }),
  setContract: (data) => set(data),
  setOrderNotes: (orderNotes) => set({ orderNotes }),
  setOnlineContract: (data) => set(data),
  setNeedsSupplementary: (needsSupplementary) => set({ needsSupplementary }),
  setHasOnlineContract: (hasOnlineContract) => set({ hasOnlineContract }),
  reset: () => set(initialState),
}))
