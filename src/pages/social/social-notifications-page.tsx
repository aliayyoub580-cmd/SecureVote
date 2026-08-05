import * as React from 'react'
import { Link }   from 'react-router-dom'
import { Bell, Heart, MessageCircle, Repeat2, UserPlus, AtSign, CheckCheck } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { motion, AnimatePresence } from 'framer-motion'

import { SocialAvatar }  from '@/components/social/avatar'
import { useSocialNotifications } from '@/hooks/use-social-notifications'
import { useAuth }       from '@/contexts/auth-context'
import type { SocialNotification } from '@/types/social'

const NOTIF_ICONS: Record<SocialNotification['notif_type'], { Icon: React.FC<{className?:string}>; color: string }> = {
  like:             { Icon: Heart,          color: 'text-rose-400'    },
  comment:          { Icon: MessageCircle,  color: 'text-blue-400'    },
  reply:            { Icon: MessageCircle,  color: 'text-violet-400'  },
  mention:          { Icon: AtSign,         color: 'text-amber-400'   },
  follow:           { Icon: UserPlus,       color: 'text-[#2EE6B8]'  },
  repost:           { Icon: Repeat2,        color: 'text-[#2EE6B8]'  },
  election_invite:  { Icon: Bell,           color: 'text-[#F5A15C]'  },
  election_started: { Icon: Bell,           color: 'text-[#F5A15C]'  },
  election_ended:   { Icon: Bell,           color: 'text-[#7FA3AB]'  },
  result_published: { Icon: Bell,           color: 'text-amber-400'  },
}

const NOTIF_TEXT: Record<SocialNotification['notif_type'], string> = {
  like:             'liked your post',
  comment:          'commented on your post',
  reply:            'replied to your comment',
  mention:          'mentioned you',
  follow:           'started following you',
  repost:           'reposted your post',
  election_invite:  'invited you to an election',
  election_started: 'an election you joined has started',
  election_ended:   'an election you joined has ended',
  result_published: 'election results have been published',
}

export function SocialNotificationsPage() {
  const { user } = useAuth()
  const { notifications, unreadCount, loading, markAllRead } = useSocialNotifications(user?.id)

  return (
    <div className="mx-auto max-w-2xl px-4 pt-6 pb-32 space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell className="size-5 text-[#2EE6B8]" />
          <h1 className="text-xl font-black text-[#EDF7F6]">Notifications</h1>
          {unreadCount > 0 && (
            <span className="px-2 py-0.5 bg-[#2EE6B8] text-[#031F28] text-xs font-bold rounded-full">{unreadCount}</span>
          )}
        </div>
        {unreadCount > 0 && (
          <button onClick={markAllRead} className="flex items-center gap-1.5 text-xs text-[#7FA3AB] hover:text-[#2EE6B8] transition-colors">
            <CheckCheck className="size-3.5" /> Mark all read
          </button>
        )}
      </div>

      {loading ? (
        Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-16 bg-[#0B3541] border border-[#0F4A5E] rounded-xl animate-pulse" />
        ))
      ) : notifications.length === 0 ? (
        <div className="text-center py-16 text-[#7FA3AB]">
          <Bell className="size-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No notifications yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          <AnimatePresence initial={false}>
            {notifications.map(n => {
              const cfg = NOTIF_ICONS[n.notif_type]
              const isUnread = !n.read_at
              return (
                <motion.div key={n.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}>
                  <Link
                    to={n.post_id ? `/social/posts/${n.post_id}` : n.actor?.username ? `/social/profile/${n.actor.username}` : '#'}
                    className={`flex items-center gap-3 p-4 rounded-xl border transition-all hover:border-[#2EE6B8]/30 ${
                      isUnread ? 'bg-[#2EE6B8]/5 border-[#2EE6B8]/20' : 'bg-[#0B3541] border-[#0F4A5E]'
                    }`}
                  >
                    <div className="relative flex-shrink-0">
                      <SocialAvatar src={n.actor?.avatar_path} name={n.actor?.full_name} size="sm" />
                      <div className={`absolute -bottom-0.5 -right-0.5 size-5 rounded-full bg-[#0B3541] flex items-center justify-center border border-[#0F4A5E] ${cfg.color}`}>
                        <cfg.Icon className="size-2.5" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-[#EDF7F6] truncate">
                        <span className="font-semibold">@{n.actor?.username ?? 'Someone'}</span>
                        {' '}{NOTIF_TEXT[n.notif_type]}
                      </p>
                      <p className="text-[10px] text-[#7FA3AB] mt-0.5">
                        {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                      </p>
                    </div>
                    {isUnread && <div className="size-2 rounded-full bg-[#2EE6B8] flex-shrink-0" />}
                  </Link>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}
