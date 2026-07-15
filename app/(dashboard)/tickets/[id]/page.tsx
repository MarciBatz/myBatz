import { getSession } from '@/lib/auth'
import TicketDetailClient from './TicketDetailClient'

export default async function TicketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getSession()
  return <TicketDetailClient ticketId={id} user={user!} />
}
