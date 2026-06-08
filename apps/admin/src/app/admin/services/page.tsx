import { getServices } from './actions'
import { ServiceManagementClient } from './ServiceManagementClient'

export const dynamic = 'force-dynamic'

export default async function ServicesPage() {
  const services = await getServices()

  return <ServiceManagementClient initialServices={services} />
}
