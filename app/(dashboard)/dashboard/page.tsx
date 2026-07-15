import { getSession } from '@/lib/auth'
import DashboardClient from './DashboardClient'

export default async function DashboardPage() {
  const user = await getSession()
  return <DashboardClient user={user!} />
}
