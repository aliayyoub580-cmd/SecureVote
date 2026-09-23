export interface SavedVoterCodeItem {
  electionId: string
  electionTitle: string
  votingCode: string
  savedAt: string
  userId?: string
}

const STORAGE_KEY = 'securevote_saved_voting_credentials'

function getStoredItems(): SavedVoterCodeItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch (e) {
    console.error('Failed to parse saved voting credentials from localStorage', e)
    return []
  }
}

function persistItems(items: SavedVoterCodeItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  } catch (e) {
    console.error('Failed to save voting credentials to localStorage', e)
  }
}

export const savedVoterCodesService = {
  /**
   * Saves or updates a voting code associated with an election name and ID.
   */
  saveVoterCode(params: {
    electionId: string
    electionTitle: string
    votingCode: string
    userId?: string
  }): SavedVoterCodeItem {
    const items = getStoredItems()
    const now = new Date().toISOString()
    const cleanCode = params.votingCode.trim()

    const existingIndex = items.findIndex((item) => {
      const matchElection = item.electionId === params.electionId
      const matchUser = params.userId ? item.userId === params.userId : true
      return matchElection && matchUser
    })

    const newItem: SavedVoterCodeItem = {
      electionId: params.electionId,
      electionTitle: params.electionTitle || 'Election',
      votingCode: cleanCode,
      savedAt: now,
      userId: params.userId,
    }

    if (existingIndex >= 0) {
      items[existingIndex] = {
        ...items[existingIndex],
        ...newItem,
      }
    } else {
      items.unshift(newItem)
    }

    persistItems(items)
    return newItem
  },

  /**
   * Retrieves the saved voting code for a given election.
   */
  getVoterCode(electionId: string, userId?: string): string | null {
    const item = this.getVoterCodeItem(electionId, userId)
    return item ? item.votingCode : null
  },

  /**
   * Retrieves the full saved credential item for a given election.
   */
  getVoterCodeItem(electionId: string, userId?: string): SavedVoterCodeItem | null {
    const items = getStoredItems()
    const found = items.find((item) => {
      const matchElection = item.electionId === electionId
      const matchUser = userId ? item.userId === userId : true
      return matchElection && matchUser
    })
    return found || null
  },

  /**
   * Lists all saved voting codes, optionally filtered by user ID.
   */
  getAllSavedCodes(userId?: string): SavedVoterCodeItem[] {
    const items = getStoredItems()
    if (!userId) return items
    return items.filter((i) => !i.userId || i.userId === userId)
  },

  /**
   * Generates a downloadable text file for the user's voting credentials.
   */
  downloadCredentialsFile(electionTitle: string, votingCode: string): void {
    const safeTitle = (electionTitle || 'election')
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .substring(0, 30)

    const content = [
      '====================================================================',
      ' SECUREVOTE - OFFICIAL VOTING CREDENTIALS',
      '====================================================================',
      `Election:         ${electionTitle}`,
      `Your Voting ID:   ${votingCode}`,
      `Date Saved:       ${new Date().toLocaleString()}`,
      '--------------------------------------------------------------------',
      'CRITICAL INSTRUCTION:',
      '- Keep this Voting ID confidential and safe.',
      '- You will be asked to enter this Voting ID when casting your ballot.',
      '- Email delivery has been disabled; this file or saved code is your key.',
      '====================================================================',
    ].join('\r\n')

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `Voting-ID-${safeTitle}.txt`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  },
}
