import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import DashboardClient from '../dashboard/DashboardClient'

export default async function TicketsPage() {
  const user = await getSession()
  if (!user) redirect('/login')

  return <DashboardClient user={user} ticketsOnly />
}
