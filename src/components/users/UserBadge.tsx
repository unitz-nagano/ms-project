'use client'

import { cn } from '@/lib/utils'

interface UserBadgeProps {
  name: string
  color?: string
  className?: string
}

export function UserBadge({ name, color = '#94a3b8', className }: UserBadgeProps) {
  return (
    <span
      className={cn('inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs font-medium text-zinc-800', className)}
      style={{ backgroundColor: `${color}22`, border: `1px solid ${color}55` }}
    >
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
      {name}
    </span>
  )
}
