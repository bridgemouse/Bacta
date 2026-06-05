import { createContext, useContext } from 'react'

export type Tab = 'overview' | 'trends'

interface TabContextValue {
  tab: Tab
  setTab: (t: Tab) => void
}

const DEFAULT: TabContextValue = { tab: 'overview', setTab: () => {} }

export const TabContext = createContext<TabContextValue>(DEFAULT)
export const useTab = (): Tab => useContext(TabContext).tab
