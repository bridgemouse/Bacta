import { createContext, useContext } from 'react'

export type Tab = 'overview' | 'trends'

export const TabContext = createContext<Tab>('overview')
export const useTab = (): Tab => useContext(TabContext)
