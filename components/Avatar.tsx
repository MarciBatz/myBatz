interface AvatarProps {
  name?: string | null
  firstName?: string | null
  nickname?: string | null
  email?: string
  avatarUrl?: string | null
  size?: 'sm' | 'md'
}

export default function Avatar({ name, firstName, nickname, email, avatarUrl, size = 'sm' }: AvatarProps) {
  const dim = size === 'sm' ? 'w-7 h-7 text-xs' : 'w-9 h-9 text-sm'
  // Becenév első betűje, ha nincs, akkor keresztnév, ha nincs, akkor teljes név, ha nincs, akkor email
  const initialSource = nickname || firstName || name || email || '?'
  const initial = initialSource[0].toUpperCase()

  return (
    <div className={`${dim} rounded-full flex items-center justify-center text-white font-medium flex-shrink-0 overflow-hidden`}
      style={{ background: '#6C5CE7' }}>
      {avatarUrl ? (
        <img src={avatarUrl} alt={name || email || ''} className="w-full h-full object-cover" />
      ) : (
        initial
      )}
    </div>
  )
}
