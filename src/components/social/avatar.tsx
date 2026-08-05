import { User, BadgeCheck } from 'lucide-react'

interface SocialAvatarProps {
  src?:      string | null
  name?:     string | null
  size?:     'sm' | 'md' | 'lg' | 'xl'
  verified?: boolean
}

const SIZES = { sm: 'size-8', md: 'size-10', lg: 'size-12', xl: 'size-16' }
const BADGE = { sm: 'size-3 -bottom-0.5 -right-0.5', md: 'size-4 -bottom-0.5 -right-0.5', lg: 'size-4 -bottom-1 -right-1', xl: 'size-5 -bottom-1 -right-1' }

export function SocialAvatar({ src, name, size = 'md', verified }: SocialAvatarProps) {
  const initials = name ? name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : '?'
  return (
    <div className={`relative flex-shrink-0 ${SIZES[size]} rounded-full`}>
      {src ? (
        <img src={src} alt={name ?? 'avatar'} className={`${SIZES[size]} rounded-full object-cover ring-2 ring-[#0F4A5E] bg-[#0B3541]`} />
      ) : (
        <div className={`${SIZES[size]} rounded-full ring-2 ring-[#0F4A5E] bg-[#0B3541] flex items-center justify-center`}>
          {name
            ? <span className="text-[#2EE6B8] font-bold text-xs">{initials}</span>
            : <User className="size-4 text-[#7FA3AB]" />}
        </div>
      )}
      {verified && (
        <BadgeCheck className={`absolute ${BADGE[size]} text-[#2EE6B8] fill-[#0B3541]`} />
      )}
    </div>
  )
}
