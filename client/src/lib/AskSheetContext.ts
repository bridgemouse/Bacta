import { createContext, useContext } from 'react'

interface AskSheetContextValue {
  openAskSheet: () => void
}

export const AskSheetContext = createContext<AskSheetContextValue>({
  openAskSheet: () => {},
})

export function useAskSheet(): AskSheetContextValue {
  return useContext(AskSheetContext)
}
