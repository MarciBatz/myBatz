import { fullDisplayName } from '@/lib/utils'

interface AvatarProps {
  name?: string | null
  firstName?: string | null
  lastName?: string | null
  nickname?: string | null
  email?: string
  avatarUrl?: string | null
  size?: 'sm' | 'md'
  online?: boolean
}

export default function Avatar({ name, firstName, lastName, nickname, email, avatarUrl, size = 'sm', online }: AvatarProps) {
  const dim = size === 'sm' ? 'w-7 h-7 text-xs' : 'w-9 h-9 text-sm'
  // Derived from the same name the UI prints, so the initial always matches the
  // label next to it — with full names shown, a first-name initial wouldn't.
  const initialSource = fullDisplayName({ name, firstName, lastName, nickname, email }) || email || '?'
  const initial = initialSource[0].toUpperCase()

  return (
    <div className="relative inline-flex flex-shrink-0">
      <div className={`${dim} rounded-full flex items-center justify-center text-white font-medium overflow-hidden`}
        style={{ background: '#6C5CE7' }}>
        {avatarUrl ? (
          <img src={avatarUrl} alt={name || email || ''} className="w-full h-full object-cover" />
        ) : (
          initial
        )}
      </div>
      {online && (
        <span className="absolute bottom-0 right-0 block w-2.5 h-2.5 rounded-full bg-green-400 ring-2 ring-white" />
      )}
    </div>
  )
}
