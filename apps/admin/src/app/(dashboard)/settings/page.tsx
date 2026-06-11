import { getSettings, getContractCustomFields, getStaff } from './actions'
import { SettingsClient } from './SettingsClient'

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const [settings, fields, staff] = await Promise.all([
    getSettings(),
    getContractCustomFields(),
    getStaff(),
  ])

  return (
    <SettingsClient
      initialSettings={settings}
      initialFields={fields}
      initialStaff={staff}
    />
  )
}
