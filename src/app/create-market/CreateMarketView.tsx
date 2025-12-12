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
        </div>

        <Link href="/" className="btn btn-outline-secondary btn-sm">
          ← Back
        </Link>
      </header>

      {m.status === 'pending' && (
        <div className="alert alert-warning py-2 mb-3">Transaction pending…</div>
      )}
      {m.status === 'error' && (
        <div className="alert alert-danger py-2 mb-3">{m.errorMessage}</div>
      )}
      {m.status === 'success' && (
        <div className="alert alert-success py-2 mb-3">
          Market created{m.createdMarketId !== null ? `: #${m.createdMarketId}` : ''}.
        </div>
      )}

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
                className={`form-control ${m.marketTicker.length > 0 && !m.marketTickerOk ? 'is-invalid' : ''}`}
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
            AMM/DMM + seed are not set at market creation in this flow (dmm=0, isc=0).
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
                onChange={(e) => m.setPositionsCount(Math.max(2, Number(e.target.value) || 2))}
              />
            </div>
          </div>

          <div className="list-group">
            {m.positions.map((p, i) => {
              const tickerOk = p.ticker.length === 0 ? true : /^[A-Z0-9]{1,4}$/.test(p.ticker);
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
                        className={`form-control ${p.ticker.length > 0 && !tickerOk ? 'is-invalid' : ''}`}
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
