// src/app/create-market/CreateMarketView.tsx
'use client';

import Link from 'next/link';
import React from 'react';
import { useCreateMarket } from './useCreateMarket';

type Props = {
  oracleAddress: `0x${string}`;
};

export function CreateMarketView({ oracleAddress }: Props) {
  const m = useCreateMarket();

  return (
    <div className="container py-4">
      <header className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <h1 className="h4 mb-1">Create market</h1>
          <div className="text-muted small">Resolving markets only.</div>
          <div className="text-muted small">
            Oracle: <span className="font-monospace">{oracleAddress}</span>
          </div>
        </div>

        <Link href="/" className="btn btn-outline-secondary btn-sm">
          ← Back
        </Link>
      </header>

      {/* What will happen */}
      <div className="card mb-3">
        <div className="card-body">
          <h2 className="h6 mb-2">What this button will do</h2>
          <ol className="mb-0 small text-muted">
            <li>Clone an LMSR market maker (UNBOUND)</li>
            <li>Create a resolving market (doesResolve=true) with dmm=0 and isc=0</li>
            <li>Create positions</li>
            <li>Init LMSR for that market (bind + seed)</li>
            <li>Set the LMSR clone as the pricing market maker</li>
            <li>(Optional) Lock positions</li>
          </ol>
        </div>
      </div>

      {/* Status banners */}
      {m.status === 'pending' && (
        <div className="alert alert-warning py-2 mb-3">Transaction pending…</div>
      )}
      {m.status === 'error' && (
        <div className="alert alert-danger py-2 mb-3" style={{ whiteSpace: 'pre-wrap' }}>
          {m.errorMessage}
        </div>
      )}
      {m.status === 'success' && (
        <div className="alert alert-success py-2 mb-3">
          Market created{m.createdMarketId !== null ? `: #${m.createdMarketId}` : ''}.
        </div>
      )}

      {/* Per-step progress */}
      <div className="card mb-3">
        <div className="card-body">
          <h2 className="h6 mb-2">Progress</h2>
          <ol className="mb-0">
            {m.steps.map((s) => (
              <li key={s.key} className="mb-1">
                <div className="d-flex align-items-center justify-content-between">
                  <span>
                    {s.title}{' '}
                    <span className="text-muted small">({s.status})</span>
                  </span>
                  {s.txHash && (
                    <span className="text-muted small font-monospace">
                      {s.txHash.slice(0, 10)}…
                    </span>
                  )}
                </div>
                {s.error && (
                  <div className="text-danger small" style={{ whiteSpace: 'pre-wrap' }}>
                    {s.error}
                  </div>
                )}
              </li>
            ))}
          </ol>

          {(m.createdMarketId !== null || m.createdMM !== null) && (
            <div className="mt-3 small text-muted">
              <div>
                Market ID:{' '}
                <span className="font-monospace">
                  {m.createdMarketId !== null ? m.createdMarketId.toString() : '—'}
                </span>
              </div>
              <div>
                LMSR MM:{' '}
                <span className="font-monospace">{m.createdMM ?? '—'}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Form */}
      <div className="card mb-3">
        <div className="card-body">
          <div className="row g-3">
            <div className="col-md-8">
              <label className="form-label">Market name</label>
              <input
                className="form-control"
                value={m.marketName}
                onChange={(e) => m.setMarketName(e.target.value)}
              />
            </div>

            <div className="col-md-4">
              <label className="form-label">Market ticker (max 4)</label>
              <input
                className={`form-control ${
                  m.marketTicker.length > 0 && !m.marketTickerOk ? 'is-invalid' : ''
                }`}
                value={m.marketTicker}
                onChange={(e) => m.onMarketTickerChange(e.target.value)}
              />
              {!m.marketTickerOk && m.marketTicker.length > 0 && (
                <div className="invalid-feedback">
                  Use A–Z / 0–9 only, uppercase, max 4 chars.
                </div>
              )}
            </div>
          </div>

          <div className="mt-3 text-muted small">
            Market creation uses dmm=0 and isc=0; LMSR is cloned and initialized afterwards.
          </div>
        </div>
      </div>

      <div className="card mb-3">
        <div className="card-body">
          <div className="d-flex justify-content-between align-items-center mb-2">
            <h2 className="h6 mb-0">Positions</h2>

            <div className="d-flex align-items-center gap-2">
              <span className="text-muted small">Count</span>
              <input
                type="number"
                min={2}
                max={200}
                className="form-control form-control-sm"
                style={{ width: 90 }}
                value={m.positionsCount}
                onChange={(e) =>
                  m.setPositionsCount(Math.max(2, Number(e.target.value) || 2))
                }
              />
            </div>
          </div>

          <div className="list-group">
            {m.positions.map((p, i) => {
              const tickerOk =
                p.ticker.length === 0 ? true : /^[A-Z0-9]{1,4}$/.test(p.ticker);
              return (
                <div key={i} className="list-group-item">
                  <div className="row g-2 align-items-center">
                    <div className="col-md-8">
                      <label className="form-label small mb-1">Name</label>
                      <input
                        className="form-control"
                        value={p.name}
                        onChange={(e) => m.updatePos(i, { name: e.target.value })}
                      />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label small mb-1">Ticker (max 4)</label>
                      <input
                        className={`form-control ${
                          p.ticker.length > 0 && !tickerOk ? 'is-invalid' : ''
                        }`}
                        value={p.ticker}
                        onChange={(e) => m.onPositionTickerChange(i, e.target.value)}
                      />
                      {p.ticker.length > 0 && !tickerOk && (
                        <div className="invalid-feedback">
                          Use A–Z / 0–9 only, uppercase, max 4 chars.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="d-flex justify-content-end gap-2">
        <button
          className="btn btn-primary"
          disabled={!m.canCreate}
          onClick={() => m.createMarket(oracleAddress)}
        >
          Create market
        </button>
      </div>
    </div>
  );
}
