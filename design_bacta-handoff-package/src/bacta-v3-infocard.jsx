/* bacta-v3-infocard.jsx — Tap-to-explain frosted overlay for any card.
   - No × button anywhere — tap outside to dismiss
   - compact prop: no title, tighter padding, smaller font, no SOURCE line
   - Outer div is flex col so it propagates height correctly in flex rows */

const { useState: useStateIC, useEffect: useEffectIC } = React;

function InfoCard({ id, title, description, source, accent, children, radius = 10, style: outerStyle, disabled = false, compact = false, noStretch = false, size = null }) {
  const [open, setOpen] = useStateIC(false);
  const ac = accent || BACTA.home.accent;
  const minH = size && BACTA.CARD_SIZES ? BACTA.CARD_SIZES[size] : undefined;

  useEffectIC(() => {
    const handler = (e) => { if (e.detail !== id) setOpen(false); };
    window.addEventListener('bacta:infocard', handler);
    return () => window.removeEventListener('bacta:infocard', handler);
  }, [id]);

  useEffectIC(() => {
    if (!open) return;
    const dismiss = () => setOpen(false);
    const t = setTimeout(() => document.addEventListener('click', dismiss, { once: true }), 30);
    return () => { clearTimeout(t); document.removeEventListener('click', dismiss); };
  }, [open]);

  const handleTap = (e) => {
    if (disabled) return;
    e.stopPropagation();
    if (open) {
      setOpen(false);
    } else {
      setOpen(true);
      window.dispatchEvent(new CustomEvent('bacta:infocard', { detail: id }));
    }
  };

  return (
    <div
      onClick={handleTap}
      style={{
        position: 'relative', borderRadius: radius, overflow: 'hidden',
        cursor: disabled ? 'default' : 'pointer',
        display: 'flex', flexDirection: 'column',
        minHeight: minH,
        ...outerStyle,
      }}>

      {/* Children — fill available height; noStretch skips flex injection for standalone full-width cards */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {noStretch ? children : React.Children.map(children, child =>
          React.isValidElement(child)
            ? React.cloneElement(child, { style: { ...(child.props.style || {}), flex: 1 } })
            : child
        )}
      </div>

      {/* Frosted overlay */}
      {open && (
        <div
          onClick={e => {
            e.stopPropagation();
            if (e.nativeEvent) e.nativeEvent.stopImmediatePropagation();
            setOpen(false);
          }}
          style={{
            position: 'absolute', inset: 0, zIndex: 30,
            background: `linear-gradient(145deg, ${hexA(ac, 0.32)}, ${hexA(ac, 0.12)})`,
            backdropFilter: 'blur(22px)',
            WebkitBackdropFilter: 'blur(22px)',
            borderRadius: radius,
            border: `1px solid ${hexA(ac, 0.55)}`,
            padding: compact ? '9px 13px' : '10px 14px',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            gap: compact ? 4 : 7,
            overflow: 'hidden',
          }}>

          {/* Title — full cards only, centered, no × */}
          {!compact && (
            <span style={{
              fontFamily: BACTA.FONT_MONO, fontSize: 8, fontWeight: 700,
              letterSpacing: '0.13em', color: ac, textAlign: 'center', lineHeight: 1,
            }}>
              {title.toUpperCase()}
            </span>
          )}

          {/* Description */}
          <p style={{
            margin: 0,
            fontFamily: BACTA.FONT_UI,
            fontSize: compact ? 11.5 : 12,
            fontStyle: 'italic',
            lineHeight: compact ? 1.45 : 1.5,
            color: 'rgba(255,255,255,0.90)',
            textAlign: 'center',
            textWrap: 'pretty',
            overflow: 'hidden',
            flex: 1,
            display: 'flex', alignItems: 'center',
          }}>
            {description}
          </p>

          {/* Source — full cards only */}
          {source && !compact && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 7,
                letterSpacing: '0.08em', color: hexA(ac, 0.5) }}>SOURCE</span>
              <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 7,
                color: hexA(ac, 0.8) }}>{source}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

Object.assign(window, { InfoCard });
