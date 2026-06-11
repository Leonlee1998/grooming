export type CustomFieldDef = {
  key: string
  label: string
  type: 'text' | 'textarea' | 'number' | 'date' | 'checkbox'
  required: boolean
  locked?: boolean
  sortOrder: number
}

export const LOCKED_FIELDS: CustomFieldDef[] = [
  {
    key: 'customer_name',
    label: '客戶姓名',
    type: 'text',
    required: true,
    locked: true,
    sortOrder: 0,
  },
  {
    key: 'pet_name',
    label: '寵物名稱',
    type: 'text',
    required: true,
    locked: true,
    sortOrder: 1,
  },
  {
    key: 'service_items',
    label: '服務項目',
    type: 'textarea',
    required: true,
    locked: true,
    sortOrder: 2,
  },
  {
    key: 'service_price',
    label: '費用（元）',
    type: 'number',
    required: true,
    locked: true,
    sortOrder: 3,
  },
  {
    key: 'groomer_name',
    label: '美容人員',
    type: 'text',
    required: true,
    locked: true,
    sortOrder: 4,
  },
  {
    key: 'health_notes',
    label: '寵物健康狀況',
    type: 'textarea',
    required: true,
    locked: true,
    sortOrder: 5,
  },
  {
    key: 'vet_clinic',
    label: '指定獸醫院',
    type: 'text',
    required: true,
    locked: true,
    sortOrder: 6,
  },
]
