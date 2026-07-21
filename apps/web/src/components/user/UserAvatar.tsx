import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'

function initialsOf(name: string | null | undefined): string {
  if (!name) return '?'
  return name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('') || '?'
}

type Props = {
  fullName: string | null | undefined
  avatarUrl?: string | null
  className?: string
}

export function UserAvatar({ fullName, avatarUrl, className }: Props) {
  return (
    <Avatar className={cn('h-8 w-8', className)}>
      {avatarUrl && <AvatarImage src={avatarUrl} alt={fullName ?? 'Avatar'} />}
      <AvatarFallback className="text-xs font-semibold">{initialsOf(fullName)}</AvatarFallback>
    </Avatar>
  )
}
