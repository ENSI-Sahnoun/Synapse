'use client'

import { useState, useMemo } from 'react'
import { useAction } from 'next-safe-action/hooks'
import { toast } from 'sonner'
import { searchStudentsByNameAction } from '@/actions/employee/search-students-by-name'
import { grantAchievementAction } from '@/actions/admin/achievements'
import { UserAvatar } from '@/components/user/UserAvatar'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card } from '@/components/ui/card'
import { resolveAchievementIcon } from '@/utils/achievement-icons'

interface ManualAchievement {
  id: string
  title: string
  emoji: string
}

interface Props {
  achievements: ManualAchievement[]
}

export function ManualGrantPanel({ achievements }: Props) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedStudentId, setSelectedStudentId] = useState('')
  const [selectedAchievementId, setSelectedAchievementId] = useState('')
  const [searchResults, setSearchResults] = useState<
    Array<{
      studentId: string
      fullName: string
      phone: string | null
      avatarUrl: string | null
      loyaltyBalance: number
    }>
  >([])

  const { execute: search, status: searchStatus } = useAction(
    searchStudentsByNameAction,
    {
      onSuccess: ({ data }) => {
        if (data) {
          setSearchResults(data)
        }
      },
      onError: ({ error }) => {
        toast.error(error.serverError ?? 'Erreur de recherche')
        setSearchResults([])
      },
    },
  )

  const { execute: grant, status: grantStatus } = useAction(
    grantAchievementAction,
    {
      onSuccess: () => {
        toast.success('Succès attribué')
        setSearchQuery('')
        setSelectedStudentId('')
        setSelectedAchievementId('')
        setSearchResults([])
      },
      onError: ({ error }) => {
        toast.error(error.serverError ?? 'Erreur')
      },
    },
  )

  // Debounced search
  useMemo(() => {
    if (searchQuery.length < 2) {
      setSearchResults([])
      return
    }
    const timer = setTimeout(() => {
      search({ query: searchQuery })
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery, search])

  const selectedStudent = searchResults.find(
    (s) => s.studentId === selectedStudentId,
  )

  function handleGrant() {
    if (!selectedStudentId || !selectedAchievementId) {
      toast.error('Veuillez sélectionner un étudiant et un succès')
      return
    }
    grant({
      studentId: selectedStudentId,
      achievementId: selectedAchievementId,
    })
  }

  const isExecuting = searchStatus === 'executing' || grantStatus === 'executing'

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4">Attribution manuelle</h3>
      <div className="space-y-4">
        <div className="space-y-1">
          <Label htmlFor="student-search">Rechercher un étudiant *</Label>
          <Input
            id="student-search"
            placeholder="Tapez un nom ou un numéro de téléphone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            disabled={isExecuting}
          />
          {searchResults.length > 0 && (
            <div className="border rounded-md mt-2 max-h-48 overflow-y-auto">
              {searchResults.map((student) => (
                <div
                  key={student.studentId}
                  className={`p-3 border-b last:border-0 cursor-pointer hover:bg-muted transition-colors flex items-center gap-3 ${
                    selectedStudentId === student.studentId
                      ? 'bg-muted'
                      : ''
                  }`}
                  onClick={() => {
                    setSelectedStudentId(student.studentId)
                    setSearchQuery(student.fullName)
                    setSearchResults([])
                  }}
                >
                  <UserAvatar fullName={student.fullName} avatarUrl={student.avatarUrl} className="h-8 w-8 flex-shrink-0" />
                  <div>
                    <div className="font-medium">{student.fullName}</div>
                    {student.phone && (
                      <div className="text-xs text-muted-foreground">
                        {student.phone}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {selectedStudent && (
          <div className="p-3 bg-muted rounded-md text-sm flex items-center gap-3">
            <UserAvatar fullName={selectedStudent.fullName} avatarUrl={selectedStudent.avatarUrl} className="h-8 w-8 flex-shrink-0" />
            <div>
              <div className="font-medium">{selectedStudent.fullName}</div>
              {selectedStudent.phone && (
                <div className="text-muted-foreground">{selectedStudent.phone}</div>
              )}
            </div>
          </div>
        )}

        <div className="space-y-1">
          <Label htmlFor="achievement-select">Succès à attribuer *</Label>
          <Select
            value={selectedAchievementId}
            onValueChange={setSelectedAchievementId}
            disabled={isExecuting}
          >
            <SelectTrigger id="achievement-select">
              <SelectValue placeholder="Choisir un succès" />
            </SelectTrigger>
            <SelectContent>
              {achievements.map((ach) => {
                const Icon = resolveAchievementIcon(ach.emoji)
                return (
                  <SelectItem key={ach.id} value={ach.id}>
                    <span className="flex items-center gap-2">
                      <Icon size={16} />
                      {ach.title}
                    </span>
                  </SelectItem>
                )
              })}
            </SelectContent>
          </Select>
        </div>

        <Button
          onClick={handleGrant}
          disabled={
            !selectedStudentId || !selectedAchievementId || isExecuting
          }
          className="w-full"
        >
          {grantStatus === 'executing'
            ? 'Attribution en cours...'
            : 'Attribuer le succès'}
        </Button>
      </div>
    </Card>
  )
}
