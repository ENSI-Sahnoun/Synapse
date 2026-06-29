'use client'

import { useState } from 'react'
import { useAction } from 'next-safe-action/hooks'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createAnnouncementAction, deleteAnnouncementAction } from '@/actions/employee/announcements'

interface Announcement {
  id: string
  title: string
  body: string
  pinned: boolean
  created_at: string
  created_by: string | null
}

export function AnnouncementsClient({
  announcements,
  currentUserId,
}: {
  announcements: Announcement[]
  currentUserId: string
}) {
  const router = useRouter()
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [pinned, setPinned] = useState(false)

  const { execute: create, isPending: creating } = useAction(createAnnouncementAction, {
    onSuccess: () => {
      setShowForm(false)
      setTitle('')
      setBody('')
      setPinned(false)
      toast.success('Annonce publiée')
      router.refresh()
    },
    onError: ({ error }) => toast.error(error.serverError ?? 'Erreur'),
  })

  const { execute: remove } = useAction(deleteAnnouncementAction, {
    onSuccess: () => { toast.success('Annonce supprimée'); router.refresh() },
    onError: ({ error }) => toast.error(error.serverError ?? 'Erreur'),
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700 }}>Annonces</h1>
        <button
          onClick={() => setShowForm(v => !v)}
          style={{
            background: 'var(--accent-brand)', color: '#fff',
            border: 'none', borderRadius: 'var(--radius-lg)',
            padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}
        >
          {showForm ? 'Annuler' : '+ Publier'}
        </button>
      </div>

      {showForm && (
        <div style={{
          background: '#fff', border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-xl)', padding: 16,
          display: 'flex', flexDirection: 'column', gap: 12,
        }}>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Titre…"
            style={{
              border: '1px solid var(--border-default)', borderRadius: 'var(--radius-lg)',
              padding: '10px 12px', fontSize: 14, outline: 'none', background: 'transparent',
            }}
          />
          <textarea
            value={body}
            onChange={e => setBody(e.target.value)}
            placeholder="Contenu de l'annonce…"
            rows={4}
            style={{
              border: '1px solid var(--border-default)', borderRadius: 'var(--radius-lg)',
              padding: '10px 12px', fontSize: 14, outline: 'none', background: 'transparent',
              resize: 'vertical', fontFamily: 'inherit',
            }}
          />
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={pinned}
              onChange={e => setPinned(e.target.checked)}
            />
            Épingler cette annonce
          </label>
          <button
            onClick={() => create({ title, body, pinned })}
            disabled={creating || !title.trim() || !body.trim()}
            style={{
              background: 'var(--accent-brand)', color: '#fff',
              border: 'none', borderRadius: 'var(--radius-lg)',
              padding: '12px', fontSize: 14, fontWeight: 600,
              cursor: creating || !title.trim() || !body.trim() ? 'not-allowed' : 'pointer',
              opacity: creating ? 0.7 : 1,
            }}
          >
            {creating ? 'Publication…' : 'Publier'}
          </button>
        </div>
      )}

      {announcements.length === 0 && !showForm && (
        <div style={{
          background: '#fff', border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-lg)', padding: '32px 16px',
          textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 14,
        }}>
          Aucune annonce
        </div>
      )}

      {announcements.map((a, i) => (
        <div
          key={a.id}
          style={{
            background: '#fff', border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-lg)', padding: '14px 16px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 700, fontSize: 14 }}>{a.title}</span>
                {a.pinned && (
                  <span style={{
                    fontSize: 11, fontWeight: 600, color: 'var(--accent-brand)',
                    background: 'rgba(162,114,74,0.1)', borderRadius: 99, padding: '1px 8px',
                  }}>Épinglé</span>
                )}
              </div>
              <div style={{
                fontSize: 13, color: 'var(--muted-foreground)', marginTop: 4,
                overflow: 'hidden', display: '-webkit-box',
                WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
              }}>
                {a.body}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 6 }}>
                {new Date(a.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
            {a.created_by === currentUserId && (
              <button
                onClick={() => remove({ id: a.id })}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--text-tertiary)', fontSize: 18, lineHeight: 1,
                  padding: '2px 4px', flexShrink: 0,
                }}
              >
                ×
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
