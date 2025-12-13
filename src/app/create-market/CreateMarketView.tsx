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

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await m.createMarket(oracleAddress);
  };

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

      <form onSubmit={onSubmit} className="card">
        <div className="card-body">
          {/* Market fields */}
          <div className="row g-3">
            <div className="col-12">
              <label className="form-label">Market name</label>
              <input
                className="form-control"
                value={m.marketName}
                onChange={(e) => m.setMarketName(e.target.value)}
                placeholder="e.g. Premier League Winner 2026"
              />
            </div>

            <div className="col-sm-4">
              <label className="form-label">Market ticker (4 chars)</label>
              <input
                className={`form-control ${m.marketTickerOk ? '' : 'is-invalid'}`}
                value={m.marketTicker}
                onChange={(e) => m.onMarketTickerChange(e.target.value)}
                placeholder="EPL6"
              />
              {!m.marketTickerOk && (
                <div className="invalid-feedback">Ticker must be 1–4 A-Z/0-9</div>
              )}
            </div>

            <div className="col-sm-4">
              <label className="form-label"># positions</label>
              <input
                className="form-control"
                type="number"
                min={2}
                max={64}
                value={m.positionsCount}
                onChange={(e) => m.setPositionsCount(Number(e.target.value))}
              />
              <div className="form-text">Creates Back+Lay ERC20 mirrors per position.</div>
            </div>

            <div className="col-sm-4">
              <label className="form-label">LMSR max liability (USDC)</label>
              <input
                className="form-control"
                value={m.liabilityUSDCInput}
                onChange={(e) => m.setLiabilityUSDCInput(e.target.value)}
                placeholder="100 or 100.50"
              />
              <div className="form-text">You type USDC; we pass raw 1e6 to initMarket.</div>
            </div>
          </div>

          <hr className="my-4" />

          {/* Positions */}
          <div className="d-flex justify-content-between align-items-center mb-2">
            <h2 className="h6 mb-0">Positions</h2>
            <span className="text-muted small">Each gets a Weight (normalized by LMSR)</span>
          </div>

          <div className="table-responsive">
            <table className="table table-sm align-middle mb-0">
              <thead>
                <tr>
                  <th style={{ width: '50%' }}>Name</th>
                  <th style={{ width: '20%' }}>Ticker (4)</th>
                  <th style={{ width: '20%' }} className="text-end">
                    Weight
                  </th>
                </tr>
              </thead>
              <tbody>
                {m.positions.map((p, i) => {
                  const nameOk = p.name.trim().length > 0;
                  const tickerOk = p.ticker.trim().length > 0; // your hook validates properly
                  const weightOk = /^\d+$/.test(p.weight) && p.weight !== '0' && p.weight !== '';
                  return (
                    <tr key={i}>
                      <td>
                        <input
                          className={`form-control form-control-sm ${nameOk ? '' : 'is-invalid'}`}
                          value={p.name}
                          onChange={(e) => m.updatePos(i, { name: e.target.value })}
                          placeholder={`Position ${i + 1} name`}
                        />
                      </td>
                      <td>
                        <input
                          className={`form-control form-control-sm ${tickerOk ? '' : 'is-invalid'}`}
                          value={p.ticker}
                          onChange={(e) => m.onPositionTickerChange(i, e.target.value)}
                          placeholder="ARSN"
                        />
                      </td>
                      <td className="text-end">
                        <input
                          className={`form-control form-control-sm text-end ${
                            weightOk ? '' : 'is-invalid'
                          }`}
                          value={p.weight}
                          onChange={(e) => m.onPositionWeightChange(i, e.target.value)}
                          placeholder="1"
                          inputMode="numeric"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <hr className="my-4" />

          {/* Action */}
          <div className="d-flex align-items-center gap-3">
            <button
              type="submit"
              className="btn btn-primary"
              disabled={!m.canCreate}
            >
              {m.status === 'pending' ? 'Creating…' : 'Create market'}
            </button>

            {m.errorMessage && (
              <div className="text-danger small">{m.errorMessage}</div>
            )}
          </div>

          {/* Steps */}
          <div className="mt-4">
            <h3 className="h6 mb-2">Progress</h3>
            <ul className="list-group">
              {m.steps.map((s) => (
                <li key={s.key} className="list-group-item d-flex justify-content-between">
                  <div>
                    <div className="fw-semibold">{s.title}</div>
                    {s.error && <div className="text-danger small">{s.error}</div>}
                  </div>
                  <div className="text-end">
                    <span
                      className={
                        s.status === 'success'
                          ? 'badge text-bg-success'
                          : s.status === 'pending'
                          ? 'badge text-bg-warning'
                          : s.status === 'error'
                          ? 'badge text-bg-danger'
                          : 'badge text-bg-secondary'
                      }
                    >
                      {s.status}
                    </span>
                    {s.txHash && (
                      <div className="small text-muted mt-1">
                        {s.txHash.slice(0, 10)}…{s.txHash.slice(-8)}
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* Result */}
          {(m.createdMarketId !== null || m.createdMM !== null) && (
            <div className="alert alert-success mt-4 mb-0">
              <div className="fw-semibold">Created</div>
              {m.createdMarketId !== null && (
                <div className="small">Market ID: {m.createdMarketId.toString()}</div>
              )}
              {m.createdMM !== null && (
                <div className="small">Pricing MM: {m.createdMM}</div>
              )}
            </div>
          )}
        </div>
      </form>
    </div>
  );
}
