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
  orderId: null as string | null,

  contractId: null as string | null,
  pdfUrl: null as string | null,

  orderNotes: '',
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
  }) => void
  setOrder: (data: {
    scheduledAt: string
    estimatedDuration: number
    pickupDeadlineAt: string
    subtotalAmount: number
    discountAmount: number
    totalAmount: number
    orderId: string
  }) => void
  setContract: (data: { contractId: string; pdfUrl: string }) => void
  setOrderNotes: (notes: string) => void
  reset: () => void
}

export const useCheckinStore = create<State & Actions>((set) => ({
  ...initialState,
  setCustomer: (data) => set(data),
  setPet: (data) => set(data),
  setServices: (selectedServices) => set({ selectedServices }),
  setStaff: (data) => set(data),
  setPriceQuote: (data) => set(data),
  setOrder: (data) => set(data),
  setContract: (data) => set(data),
  setOrderNotes: (orderNotes) => set({ orderNotes }),
  reset: () => set(initialState),
}))
