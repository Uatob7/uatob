// ── BookRideCard payment panel diffs ─────────────────────────────────────────
// Drop these in as replacements for the existing CashAppPanel and CashPanel.
// useCardPayment API is unchanged (handleSubmit). Only CashApp renames the handler.

// ── CashApp panel ─────────────────────────────────────────────────────────────
function CashAppPanel({ uid, bookingPayload, total, scheduled, onSuccess, onError }) {
  const { loading, handleCashApp } = useCashAppPayment({ uid, bookingPayload, onSuccess, onError });
  return (
    <>
      <div style={{ background:'rgba(0,214,50,.07)', border:`1px solid rgba(0,214,50,.22)`,
        borderRadius:11, padding:'12px 13px', marginBottom:10,
        display:'flex', alignItems:'center', gap:10 }}>
        <div style={{ width:32, height:32, borderRadius:9, background:C.cashApp,
          display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
          <span style={{ fontSize:16, fontWeight:900, color:'#000', fontFamily:'system-ui', lineHeight:1 }}>$</span>
        </div>
        <div>
          <div style={{ fontFamily:COND, fontSize:12, fontWeight:800, color:'#fff', marginBottom:2 }}>
            Pay with Cash App
          </div>
          <div style={{ fontFamily:MONO, fontSize:8.5, color:C.dim }}>
            You'll confirm in the Cash App
          </div>
        </div>
      </div>
      <PrimaryBtn loading={loading} disabled={loading} onClick={handleCashApp}
        style={{ background:'linear-gradient(135deg,#00E03A,#00B82B)',
          boxShadow:'0 4px 18px rgba(0,214,50,.3)', animation:'none' }}>
        {scheduled ? `Schedule · $${total}` : 'Continue to Cash App'}
        <Ico n="fwd" size={13}/>
      </PrimaryBtn>
    </>
  );
}

// ── Cash panel ────────────────────────────────────────────────────────────────
function CashPanel({ uid, bookingPayload, total, scheduled, scheduledAt, onSuccess, onError, onClose }) {
  const { loading, handleCash } = useCashPayment({ uid, bookingPayload, onSuccess, onError, onClose });
  return (
    <>
      <div style={{ background:C.amberDim, border:`1px solid ${C.amberBorder}`,
        borderRadius:11, padding:'14px 13px', marginBottom:10 }}>
        <div style={{ display:'flex', alignItems:'flex-start', gap:9, marginBottom:10 }}>
          <Ico n="cash" size={16} color={C.amber} style={{ flexShrink:0, marginTop:1 }}/>
          <div>
            <div style={{ fontFamily:COND, fontSize:12.5, fontWeight:800, color:C.amber, marginBottom:2 }}>
              Pay driver in cash
            </div>
            <div style={{ fontFamily:MONO, fontSize:8.5, color:'rgba(245,158,11,.75)', lineHeight:1.6 }}>
              Have <strong style={{ color:C.amber }}>${total}</strong> ready on arrival.
              Exact change appreciated.
            </div>
          </div>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8,
          paddingTop:10, borderTop:`1px solid rgba(245,158,11,.14)` }}>
          <div>
            <div style={{ fontSize:8, fontWeight:700, color:C.amber, letterSpacing:'.1em',
              textTransform:'uppercase', fontFamily:MONO, marginBottom:3 }}>Amount Due</div>
            <div style={{ fontFamily:MONO, fontSize:18, fontWeight:700, color:C.amber }}>${total}</div>
          </div>
          <div>
            <div style={{ fontSize:8, fontWeight:700, color:C.amber, letterSpacing:'.1em',
              textTransform:'uppercase', fontFamily:MONO, marginBottom:3 }}>When</div>
            <div style={{ fontFamily:MONO, fontSize:11, color:C.amber }}>
              {scheduledAt ? 'On driver arrival' : 'Driver arrival'}
            </div>
          </div>
        </div>
      </div>
      <PrimaryBtn loading={loading} disabled={loading} onClick={handleCash}
        style={{ background:'linear-gradient(135deg,#F59E0B,#B45309)',
          boxShadow:'0 4px 18px rgba(245,158,11,.28)', animation:'none' }}>
        <Ico n="cash" size={14}/>
        {scheduledAt ? `Schedule · $${total}` : `Confirm Cash · $${total}`}
      </PrimaryBtn>
    </>
  );
}
