import { describe, expect, it } from 'vitest';
import type { LeadRecord } from '@/types/leads';
import {
  getLeadWorkflowStage,
  matchesLeadQuickFilter,
} from './leadWorkflowUtils';

const baseLead = (overrides: Partial<LeadRecord> = {}): LeadRecord => ({
  id: 'lead-1',
  full_name: 'Test',
  whatsapp_number: '9647700000000',
  status: 'new',
  source: 'web',
  notes: null,
  selected_plan_id: 'annual',
  selected_plan_name: 'سنوي',
  governorate: 'بغداد',
  instagram_url: null,
  expected_monthly_orders: null,
  admin_read_at: null,
  converted_user_id: null,
  converted_at: null,
  created_at: '2026-06-01T00:00:00Z',
  updated_at: '2026-06-01T00:00:00Z',
  is_unread: true,
  has_pending_code: false,
  ...overrides,
});

describe('getLeadWorkflowStage', () => {
  it('classifies unread new leads', () => {
    expect(getLeadWorkflowStage(baseLead())).toBe('unread');
  });

  it('classifies read new leads as awaiting contact', () => {
    expect(
      getLeadWorkflowStage(
        baseLead({ admin_read_at: '2026-06-01T01:00:00Z', is_unread: false })
      )
    ).toBe('awaiting_contact');
  });

  it('classifies contacted leads without code as needs_code', () => {
    expect(getLeadWorkflowStage(baseLead({ status: 'contacted', is_unread: false }))).toBe(
      'needs_code'
    );
  });

  it('classifies active code as completed (pending_activation stage)', () => {
    expect(
      getLeadWorkflowStage(
        baseLead({ status: 'interested', has_pending_code: true, is_unread: false })
      )
    ).toBe('pending_activation');
  });

  it('classifies converted leads as customer', () => {
    expect(
      getLeadWorkflowStage(
        baseLead({
          status: 'customer',
          converted_user_id: 'user-1',
          has_pending_code: false,
        })
      )
    ).toBe('customer');
  });
});

describe('matchesLeadQuickFilter', () => {
  it('matches unread only for new unread leads', () => {
    expect(matchesLeadQuickFilter(baseLead(), 'unread')).toBe(true);
    expect(
      matchesLeadQuickFilter(
        baseLead({ admin_read_at: '2026-06-01T01:00:00Z', is_unread: false }),
        'unread'
      )
    ).toBe(false);
  });

  it('matches needs_code for contacted without pending code', () => {
    expect(
      matchesLeadQuickFilter(baseLead({ status: 'contacted', is_unread: false }), 'needs_code')
    ).toBe(true);
    expect(
      matchesLeadQuickFilter(
        baseLead({ status: 'contacted', has_pending_code: true, is_unread: false }),
        'needs_code'
      )
    ).toBe(false);
  });

  it('excludes completed leads from pipeline', () => {
    expect(
      matchesLeadQuickFilter(
        baseLead({ status: 'interested', has_pending_code: true, is_unread: false }),
        'pipeline'
      )
    ).toBe(false);
    expect(matchesLeadQuickFilter(baseLead({ status: 'contacted', is_unread: false }), 'pipeline')).toBe(
      true
    );
  });

  it('matches pending_activation when code is active', () => {
    expect(
      matchesLeadQuickFilter(
        baseLead({ status: 'interested', has_pending_code: true, is_unread: false }),
        'pending_activation'
      )
    ).toBe(true);
  });

  it('matches customers after activation', () => {
    expect(
      matchesLeadQuickFilter(
        baseLead({
          status: 'customer',
          converted_user_id: 'user-1',
          has_pending_code: false,
        }),
        'customers'
      )
    ).toBe(true);
  });

  it('matches pipeline for non-customer non-rejected leads without active code', () => {
    expect(matchesLeadQuickFilter(baseLead(), 'pipeline')).toBe(true);
    expect(
      matchesLeadQuickFilter(
        baseLead({ status: 'customer', converted_user_id: 'user-1' }),
        'pipeline'
      )
    ).toBe(false);
  });
});
