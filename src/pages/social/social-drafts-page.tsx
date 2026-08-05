import * as React from 'react'
import { Link }   from 'react-router-dom'
import { FileEdit, Trash2 } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { useAuth }             from '@/contexts/auth-context'
import { socialDraftsService } from '@/services/social.service'
import { toast }               from '@/lib/toast'

export function SocialDraftsPage() {
  const { user }           = useAuth()
  const [drafts, setDrafts]= React.useState<any[]>([])
  const [loading, setLoad] = React.useState(true)

  React.useEffect(() => {
    if (!user) return
    void socialDraftsService.listDrafts(user.id).then(d => { setDrafts(d); setLoad(false) })
  }, [user])

  const remove = async (id: string) => {
    await socialDraftsService.deleteDraft(id)
    setDrafts(d => d.filter(x => x.id !== id))
    toast.success('Draft deleted.')
  }

  return (
    <div className="mx-auto max-w-2xl px-4 pt-6 pb-32 space-y-5">
      <div className="flex items-center gap-2">
        <FileEdit className="size-5 text-[#7FA3AB]" />
        <h1 className="text-xl font-black text-[#EDF7F6]">Drafts</h1>
        <span className="text-xs text-[#7FA3AB] ml-auto">{drafts.length} draft{drafts.length !== 1 ? 's' : ''}</span>
      </div>

      {loading ? (
        Array.from({length:3}).map((_,i) => <div key={i} className="h-20 bg-[#0B3541] border border-[#0F4A5E] rounded-xl animate-pulse" />)
      ) : drafts.length === 0 ? (
        <div className="text-center py-16 text-[#7FA3AB]">
          <FileEdit className="size-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No drafts saved.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {drafts.map(d => (
            <div key={d.id} className="flex items-start gap-4 p-4 bg-[#0B3541] border border-[#0F4A5E] rounded-xl hover:border-[#2EE6B8]/30 transition-all">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[#EDF7F6] truncate">{d.title || d.content?.slice(0,80) || 'Untitled draft'}</p>
                <p className="text-xs text-[#7FA3AB] mt-0.5">{formatDistanceToNow(new Date(d.updated_at), { addSuffix: true })}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Link to={`/social/create?draft=${d.id}`} className="px-3 py-1.5 bg-[#0F4A5E] hover:bg-[#2EE6B8]/10 text-[#EDF7F6] hover:text-[#2EE6B8] rounded-lg text-xs font-medium transition-colors">
                  Edit
                </Link>
                <button onClick={() => remove(d.id)} className="p-1.5 text-[#7FA3AB] hover:text-rose-400 transition-colors">
                  <Trash2 className="size-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
