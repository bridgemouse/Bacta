import { useEffect, useRef, useState, type ReactNode } from 'react'

interface FadeValueProps {
  value: string | number
  children: ReactNode
}

export function FadeValue({ value, children }: FadeValueProps) {
  const prevValue = useRef(value)
  const [animKey, setAnimKey] = useState(0)

  useEffect(() => {
    if (prevValue.current !== value) {
      prevValue.current = value
      setAnimKey(k => k + 1)
    }
  }, [value])

  return (
    <span key={animKey} style={{ display: 'inline-block', animation: 'valueFadeIn 400ms ease' }}>
      {children}
    </span>
  )
}
