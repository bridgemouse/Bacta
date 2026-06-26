import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { ProviderCard } from '../../../client/src/components/ProviderCard'

const noop = () => {}
const defaultProps = {
  provider: 'oura',
  isOAuth: true,
  connected: false,
  lastSync: null,
  clientId: '',
  clientSecret: '',
  apiKey: '',
  onClientIdChange: noop,
  onClientSecretChange: noop,
  onApiKeyChange: noop,
  onConnect: noop,
  onDisconnect: noop,
  onSync: noop,
  syncStatus: 'idle' as const,
  syncError: '',
  connectError: '',
}

describe('ProviderCard', () => {
  it('shows DISCONNECTED status when not connected', () => {
    render(<ProviderCard {...defaultProps} />)
    expect(screen.getByText(/DISCONNECTED/)).toBeInTheDocument()
  })

  it('shows Client ID and Client Secret inputs for OAuth providers when disconnected', () => {
    render(<ProviderCard {...defaultProps} isOAuth={true} connected={false} />)
    expect(screen.getByPlaceholderText('Client ID')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Client Secret')).toBeInTheDocument()
  })

  it('shows API Key input (not OAuth inputs) for non-OAuth providers', () => {
    render(<ProviderCard {...defaultProps} provider="hevy" isOAuth={false} connected={false} />)
    expect(screen.getByPlaceholderText('API Key')).toBeInTheDocument()
    expect(screen.queryByPlaceholderText('Client ID')).toBeNull()
  })

  it('calls onConnect when CONNECT button clicked', () => {
    const onConnect = vi.fn()
    render(<ProviderCard {...defaultProps} onConnect={onConnect} />)
    fireEvent.click(screen.getByText('CONNECT'))
    expect(onConnect).toHaveBeenCalledOnce()
  })

  it('shows CONNECTED status and SYNC NOW + DISCONNECT buttons when connected', () => {
    render(<ProviderCard {...defaultProps} connected={true} />)
    expect(screen.getByText(/CONNECTED/)).toBeInTheDocument()
    expect(screen.getByText('SYNC NOW')).toBeInTheDocument()
    expect(screen.getByText('DISCONNECT')).toBeInTheDocument()
  })

  it('calls onSync when SYNC NOW clicked', () => {
    const onSync = vi.fn()
    render(<ProviderCard {...defaultProps} connected={true} onSync={onSync} />)
    fireEvent.click(screen.getByText('SYNC NOW'))
    expect(onSync).toHaveBeenCalledOnce()
  })

  it('calls onDisconnect when DISCONNECT clicked', () => {
    const onDisconnect = vi.fn()
    render(<ProviderCard {...defaultProps} connected={true} onDisconnect={onDisconnect} />)
    fireEvent.click(screen.getByText('DISCONNECT'))
    expect(onDisconnect).toHaveBeenCalledOnce()
  })

  it('shows SYNCING… text and disables sync button when syncStatus=syncing', () => {
    render(<ProviderCard {...defaultProps} connected={true} syncStatus="syncing" />)
    const btn = screen.getByText('SYNCING…')
    expect(btn).toBeDisabled()
  })

  it('shows SYNCED ✓ when syncStatus=synced', () => {
    render(<ProviderCard {...defaultProps} connected={true} syncStatus="synced" />)
    expect(screen.getByText('SYNCED ✓')).toBeInTheDocument()
  })

  it('shows RETRY with error when syncStatus=error', () => {
    render(<ProviderCard {...defaultProps} connected={true} syncStatus="error" syncError="Sync failed: 401" />)
    expect(screen.getByText('RETRY')).toBeInTheDocument()
    expect(screen.getByText('Sync failed: 401')).toBeInTheDocument()
  })

  it('shows connectError text when provided', () => {
    render(<ProviderCard {...defaultProps} connectError="OAuth failed — check credentials." />)
    expect(screen.getByText('OAuth failed — check credentials.')).toBeInTheDocument()
  })

  it('shows syncError text when provided', () => {
    render(
      <ProviderCard {...defaultProps} connected={true} syncError="Sync failed: 401" />
    )
    expect(screen.getByText('Sync failed: 401')).toBeInTheDocument()
  })

  it('shows lastSync timestamp when connected with a lastSync value', () => {
    render(
      <ProviderCard
        {...defaultProps}
        connected={true}
        lastSync="2026-06-25T10:00:00.000Z"
      />
    )
    expect(screen.getByText(/LAST SYNC/)).toBeInTheDocument()
  })
})
