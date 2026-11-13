/**
 * Localized labels for the ui-common Table/TableView stacked card layout
 * (`table.cardLayout`) used on phones and in narrow drawers.
 */

import type { TableCardLabels } from '@castmill/ui-common';
import { useI18n } from '../i18n';

export function useTableCardLabels(): TableCardLabels {
  const { t } = useI18n();
  return {
    sortBy: () => t('common.sortBy'),
    sortAscending: () => t('common.sortAscending'),
    sortDescending: () => t('common.sortDescending'),
    selectAll: () => t('common.selectAll'),
    selectRow: (id) => t('common.selectRow', { id }),
  };
}
