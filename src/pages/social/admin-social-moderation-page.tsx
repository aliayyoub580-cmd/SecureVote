import * as React from 'react'
import { ShieldAlert, CheckCircle2, Trash2, User } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { useAuth }             from '@/contexts/auth-context'
import { socialAdminService }  from '@/services/social.service'
import { toast }               from '@/lib/toast'

export function AdminSocialModerationPage() {
  const { user } = useAuth()
  const [reports, setReports] = React.useState<any[]>([])
  const [loading, setLoad]    = React.useState(true)

  React.useEffect(() => {
    void socialAdminService.getPendingReports().then(d => { setReports(d); setLoad(false) })
  }, [])

  const resolve = async (reportId: string) => {
    if (!user) return
    await socialAdminService.resolveReport(reportId, user.id)
    setReports(r => r.filter(x => x.id !== reportId))
    toast.success('Report resolved.')
  }

  const removePost = async (postId: string, reportId: string) => {
    if (!user) return
    await socialAdminService.deletePost(user.id, postId)
    await resolve(reportId)
    toast.success('Post removed.')
  }

  return (
    <div className="mx-auto max-w-4xl px-4 pt-6 pb-32 space-y-6">
      <div className="flex items-center gap-2">
        <ShieldAlert className="size-5 text-rose-400" />
        <h1 className="text-xl font-black text-[#EDF7F6]">Content Moderation</h1>
        <span className="ml-auto px-2 py-0.5 bg-rose-500/20 text-rose-400 text-xs font-bold rounded-full border border-rose-500/30">{reports.length} pending</span>
      </div>

      {loading ? (
        Array.from({length:3}).map((_,i) => <div key={i} className="h-24 bg-[#0B3541] border border-[#0F4A5E] rounded-xl animate-pulse" />)
      ) : reports.length === 0 ? (
        <div className="text-center py-16 text-[#7FA3AB]">
          <CheckCircle2 className="size-10 mx-auto mb-3 text-[#2EE6B8] opacity-50" />
          <p className="font-medium">No pending reports.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map((r: any) => (
            <div key={r.id} className="bg-[#0B3541] border border-[#0F4A5E] rounded-xl p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-2 py-0.5 bg-rose-500/20 text-rose-400 text-[10px] font-bold uppercase rounded-full border border-rose-500/20">{r.reason}</span>
                    <span className="text-xs text-[#7FA3AB]">{formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}</span>
                  </div>
                  <p className="text-sm text-[#EDF7F6]">
                    <span className="font-semibold">@{r.reporter?.username}</span> reported a post
                  </p>
                  {r.details && <p className="text-xs text-[#7FA3AB] mt-0.5">"{r.details}"</p>}
                  {r.post?.content && (
                    <div className="mt-2 p-2 bg-[#031F28] border border-[#0F4A5E] rounded-lg">
                      <p className="text-xs text-[#EDF7F6]/70 line-clamp-2">{r.post.content}</p>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => resolve(r.id)} className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0F4A5E] hover:bg-[#2EE6B8]/10 hover:text-[#2EE6B8] text-[#EDF7F6] text-xs font-medium rounded-lg transition-colors">
                  <CheckCircle2 className="size-3.5" /> Dismiss
                </button>
                <button onClick={() => removePost(r.post_id, r.id)} className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 text-xs font-medium rounded-lg transition-colors">
                  <Trash2 className="size-3.5" /> Remove Post
                </button>
                {r.post?.author_id && (
                  <button onClick={() => socialAdminService.suspendPoster(user!.id, r.post.author_id).then(() => toast.success('User suspended'))} className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 border border-orange-500/20 text-xs font-medium rounded-lg transition-colors">
                    <User className="size-3.5" /> Suspend User
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
