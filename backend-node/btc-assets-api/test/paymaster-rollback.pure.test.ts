import { describe, expect, it } from 'vitest';
import { decidePaymasterCellRollback } from '../src/services/paymaster-rollback';

describe('decidePaymasterCellRollback (BUG-B3)', () => {
  it('keeps cell spent once tx is broadcast to CKB', () => {
    // The critical regression case. Before BUG-B3 was fixed this
    // path returned "rollback", corrupting the cell state whenever
    // waitForTranscationConfirmed failed.
    expect(
      decidePaymasterCellRollback({
        ckbSubmitted: true,
        needPaymasterCell: true,
      }),
    ).toBe('keep-spent');
  });

  it('keeps cell spent even if needPaymasterCell is false (defensive)', () => {
    // Shouldn't happen in practice (you can't submit a tx that
    // didn't need a cell and then be here), but the decision table
    // should still be consistent.
    expect(
      decidePaymasterCellRollback({
        ckbSubmitted: true,
        needPaymasterCell: false,
      }),
    ).toBe('keep-spent');
  });

  it('rolls back when cell was acquired but tx never broadcast', () => {
    expect(
      decidePaymasterCellRollback({
        ckbSubmitted: false,
        needPaymasterCell: true,
      }),
    ).toBe('rollback');
  });

  it('is a no-op when the job never needed a paymaster cell', () => {
    expect(
      decidePaymasterCellRollback({
        ckbSubmitted: false,
        needPaymasterCell: false,
      }),
    ).toBe('no-op');
  });
});
