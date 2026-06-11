export interface ServiceItem {
  serviceName: string
  unitPrice: number
}

export interface CustomField {
  label: string
  value: string
}

export interface SupplementaryContractData {
  storeName: string
  storePhone: string
  customerName: string
  customerPhone: string
  petName: string
  /** 顯示用的短 ID，例如原契約 DB id 的後 8 碼 */
  parentContractRef: string
  services: ServiceItem[]
  staffName: string
  staffSurcharge: number
  supplementaryAmount: number
  signedAt: string
  signatureDataUrl: string
}

export interface ContractData {
  // § 店家資訊
  storeName: string
  storeAddress: string
  storePhone: string

  // § 消費者資訊
  customerName: string
  customerPhone: string
  customerEmail: string
  emergencyContact: string
  emergencyPhone: string

  // § 寵物資訊
  petName: string
  petSpecies: string
  petBreed: string
  petWeight: string
  petGender: string
  petBirthDate: string

  // § 健康聲明（法規 §4）
  isAggressive: string
  hasDisease: string
  diseaseNotes: string
  isVaccinated: string
  isDewormed: string
  preferredVetName: string
  preferredVetPhone: string

  // § 服務明細（法規 §3）
  services: ServiceItem[]
  staffName: string
  staffSurcharge: number
  subtotalAmount: number
  discountAmount: number
  totalAmount: number

  // § 時間安排
  scheduledAt: string
  estimatedDuration: number
  pickupDeadlineAt: string

  // § 自訂欄位
  customFields: CustomField[]

  // § 簽名
  signatureDataUrl: string
  signedAt: string
}
