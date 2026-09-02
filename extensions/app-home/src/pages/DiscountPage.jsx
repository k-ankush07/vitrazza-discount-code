import { useState, useEffect } from 'preact/hooks';
import {
  listDiscountFunctions,
  listDiscountCodes,
  createDiscountCode,
  updateDiscountCode,
  deleteDiscountCode,
  setDiscountActive,
} from '../../../../shared/models/discount';
import { gidToId } from '../../../../shared/utils/gid';

/** @typedef {import('../../../../shared/models/discount').DiscountFunction} DiscountFunction */
/** @typedef {import('../../../../shared/models/discount').DiscountListItem} DiscountListItem */
/** @typedef {{spend: string, save: string}} Tier */

// combines is no longer user-controlled — always false so the code
// never stacks with existing percentage-off codes.
const COMBINES_WITH_ORDER_DISCOUNTS = false;

const EMPTY_FORM = {
  code: '',
  tiers: [{ spend: '', save: '' }],
};

/** @param {{spend: number|string, save: number|string}} tier */
const formatTierLine = (tier) => {
  const spend = Number(tier.spend);
  const save = Number(tier.save);
  if (!spend || !save) return null;
  return `Spend $${spend}+ — customer saves $${save}`;
};

export default function DiscountPage() {
  const [functions, setFunctions] = useState(
    /** @type {DiscountFunction[]} */([]),
  );
  const [functionId, setFunctionId] = useState('');

  const [discounts, setDiscounts] = useState(
    /** @type {DiscountListItem[]} */([]),
  );
  const [listStatus, setListStatus] = useState('loading');
  const [listError, setListError] = useState(/** @type {string | null} */(null));

  // Form state — shared between "create" and "edit" modes.
  const [editingId, setEditingId] = useState(/** @type {string | null} */(null));
  const [code, setCode] = useState(EMPTY_FORM.code);
  const [tiers, setTiers] = useState(/** @type {Tier[]} */(EMPTY_FORM.tiers));

  const [status, setStatus] = useState('loading');
  const [error, setError] = useState(/** @type {string | null} */(null));
  const [createdId, setCreatedId] = useState(
    /** @type {string | null} */(null),
  );

  // Per-row action state, keyed by discount id, e.g. { [id]: 'deleting' | 'toggling' }
  const [rowActions, setRowActions] = useState(
    /** @type {Record<string, string>} */({}),
  );

  // Returns the resolved function id so callers (e.g. the initial load)
  // can use it immediately without waiting on a state update to flush.
  const loadFunctions = async () => {
    const found = await listDiscountFunctions();
    setFunctions(found);
    const own = found.find((fn) => fn.appTitle === 'vitrazza discount code');
    const resolvedId = (own ?? found[0])?.id ?? '';
    setFunctionId(resolvedId);
    return resolvedId;
  };

  // Filters to discounts created by this app's own function, so discounts
  // from other installed apps (which also match "type:app") don't show up.
  const loadDiscounts = async (ownFunctionId) => {
    setListStatus('loading');
    try {
      const found = await listDiscountCodes(ownFunctionId);
      setDiscounts(found);
      setListStatus('idle');
    } catch (loadError) {
      setListError(
        loadError instanceof Error
          ? loadError.message
          : 'Could not load discounts',
      );
      setListStatus('idle');
    }
  };

  useEffect(() => {
    (async () => {
      try {
        // Sequenced (not Promise.all) so loadDiscounts has the resolved
        // functionId to filter by, instead of racing ahead of it.
        const resolvedId = await loadFunctions();
        await loadDiscounts(resolvedId);
        setStatus('idle');
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Could not load discount functions',
        );
        setStatus('idle');
      }
    })();
  }, []);

  /** @param {number} index @param {'spend'|'save'} field @param {string} value */
  const updateTier = (index, field, value) => {
    setTiers((prev) =>
      prev.map((t, i) => (i === index ? { ...t, [field]: value } : t)),
    );
  };

  const addTier = () => {
    setTiers((prev) => [...prev, { spend: '', save: '' }]);
  };

  /** @param {number} index */
  const removeTier = (index) => {
    setTiers((prev) => prev.filter((_, i) => i !== index));
  };

  /** @returns {{spend: number, save: number}[] | null} */
  const parseTiers = () => {
    const cleaned = tiers
      .map((t) => ({ spend: Number(t.spend), save: Number(t.save) }))
      .filter((t) => t.spend > 0 && t.save > 0);

    if (cleaned.length === 0) {
      setError('Add at least one valid tier (spend and save above 0)');
      return null;
    }
    // highest spend first, so the function can just walk down the list
    return cleaned.sort((a, b) => b.spend - a.spend);
  };

  const resetForm = () => {
    setEditingId(null);
    setCode(EMPTY_FORM.code);
    setTiers(EMPTY_FORM.tiers);
    setError(null);
    setCreatedId(null);
  };

  /** @param {DiscountListItem} discount */
  const startEdit = (discount) => {
    setEditingId(discount.id);
    setCode(discount.code);
    setTiers(
      discount.tiers.length
        ? discount.tiers.map((t) => ({
          spend: String(t.spend),
          save: String(t.save),
        }))
        : [{ spend: '', save: '' }],
    );
    setError(null);
    setCreatedId(null);
  };

  // Called directly from the button's onClick — no <s-form>/native submit
  // involved, so this fires the same way in both create and edit mode and
  // doesn't get tangled up with the admin's top "Unsaved changes" save bar.
  const handleSubmit = async () => {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) {
      setError('Enter a discount code');
      return;
    }
    if (!editingId && !functionId) {
      setError('Select a discount function');
      return;
    }

    const sortedTiers = parseTiers();
    if (!sortedTiers) {
      return;
    }

    setStatus('saving');
    setError(null);
    setCreatedId(null);

    try {
      if (editingId) {
        await updateDiscountCode({
          id: editingId,
          code: trimmed,
          combinesWithOrderDiscounts: COMBINES_WITH_ORDER_DISCOUNTS,
          configuration: { tiers: sortedTiers },
        });
        resetForm();
      } else {
        const discountId = await createDiscountCode({
          code: trimmed,
          functionId,
          combinesWithOrderDiscounts: COMBINES_WITH_ORDER_DISCOUNTS,
          // model layer writes this as JSON into the function's metafield
          configuration: { tiers: sortedTiers },
        });
        setCreatedId(discountId);
        setCode(EMPTY_FORM.code);
        setTiers(EMPTY_FORM.tiers);
      }
      setStatus('idle');
      await loadDiscounts(functionId);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : 'Could not save the discount',
      );
      setStatus('idle');
    }
  };

  /** @param {string} id */
  const handleDelete = async (id) => {
    setRowActions((prev) => ({ ...prev, [id]: 'deleting' }));
    setListError(null);
    try {
      await deleteDiscountCode(id);
      if (editingId === id) resetForm();
      await loadDiscounts(functionId);
    } catch (deleteError) {
      setListError(
        deleteError instanceof Error
          ? deleteError.message
          : 'Could not delete the discount',
      );
    } finally {
      setRowActions((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  };

  /** @param {string} id @param {boolean} makeActive */
  const handleToggleActive = async (id, makeActive) => {
    setRowActions((prev) => ({ ...prev, [id]: 'toggling' }));
    setListError(null);
    try {
      await setDiscountActive(id, makeActive);
      await loadDiscounts(functionId);
    } catch (toggleError) {
      setListError(
        toggleError instanceof Error
          ? toggleError.message
          : 'Could not update the discount status',
      );
    } finally {
      setRowActions((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  };

  const isLoading = status === 'loading';
  const activeCount = discounts.filter((d) => d.status === 'ACTIVE').length;

  return (
    <s-page heading="Create discount code">
      <s-link slot="breadcrumb-actions" href="/">
        FAQs
      </s-link>

      {error && (
        <s-section>
          <s-banner tone="critical">{error}</s-banner>
        </s-section>
      )}

      {createdId && (
        <s-section>
          <s-banner tone="success">
            <s-paragraph>
              Discount created. Customers can now enter this code at checkout.
            </s-paragraph>
            <s-link
              href={`shopify://admin/discounts/${gidToId(createdId)}`}
              target="_blank"
            >
              View discount
            </s-link>
          </s-banner>
        </s-section>
      )}

      {!isLoading && (
        <s-section heading="Tiers">
          <s-paragraph>
            Set spend thresholds for the order subtotal. Only the highest
            tier a customer qualifies for applies.
          </s-paragraph>

          <s-stack direction="block" gap="base">
            {tiers.map((tier, index) => {
              const preview = formatTierLine(tier);
              return (
                <s-box
                  key={index}
                  padding="base"
                  border="base"
                  borderRadius="base"
                >
                  <s-stack direction="block" gap="base">
                    <s-text fontWeight="bold">Tier {index + 1}</s-text>

                    <s-stack direction="inline" gap="base">
                      <s-number-field
                        label="Spend at least"
                        value={tier.spend}
                        onInput={(e) =>
                          updateTier(
                            index,
                            'spend',
                    /** @type {HTMLInputElement} */(e.target).value,
                          )
                        }
                        prefix="$"
                      />
                      <s-number-field
                        label="Customer saves"
                        value={tier.save}
                        onInput={(e) =>
                          updateTier(
                            index,
                            'save',
                    /** @type {HTMLInputElement} */(e.target).value,
                          )
                        }
                        prefix="$"
                      />
                    </s-stack>

                    {preview && <s-paragraph>{preview}</s-paragraph>}

                    {tiers.length > 1 && (
                      <s-stack direction="inline" justifyContent="end">
                        <s-button variant="secondary" tone="critical" onClick={() => removeTier(index)}>
                          Remove tier
                        </s-button>
                      </s-stack>
                    )}
                  </s-stack>
                </s-box>
              );
            })}

            <s-box padding-block-start="loose">
              <s-stack direction="inline" justifyContent="end">
                <s-button variant="secondary" onClick={addTier}>
                  Add tier
                </s-button>
              </s-stack>
            </s-box>
          </s-stack>
        </s-section>
      )}

      {!isLoading && (
        <s-section heading={editingId ? 'Edit discount code' : 'Discount code'}>
          <s-stack direction="block" gap="base">
            <s-text-field
              label="Code"
              name="code"
              labelAccessibilityVisibility="visible"
              value={code}
              onInput={(e) =>
                setCode(/** @type {HTMLInputElement} */(e.target).value)
              }
              details="Customers enter this at checkout"
              required
            />

            {!editingId && (
              <s-select
                label="Discount function"
                name="functionId"
                labelAccessibilityVisibility="visible"
                value={functionId}
                onChange={(e) =>
                  setFunctionId(
                    /** @type {HTMLSelectElement} */(e.target).value,
                  )
                }
                details="The function that calculates the tiers"
              >
                {functions.map((fn) => (
                  <s-option key={fn.id} value={fn.id}>
                    {fn.title} ({fn.appTitle})
                  </s-option>
                ))}
              </s-select>
            )}

            <s-stack direction="inline" gap="base">
              <s-button
                variant="primary"
                loading={status === 'saving'}
                onClick={handleSubmit}
              >
                {editingId ? 'Update discount' : 'Create discount'}
              </s-button>

              {editingId && (
                <s-button variant="tertiary" onClick={resetForm}>
                  Cancel
                </s-button>
              )}
            </s-stack>
          </s-stack>
        </s-section>
      )}

      <s-section
        slot="aside"
        heading={
          discounts.length
            ? `Existing discounts (${activeCount} active)`
            : 'Existing discounts'
        }
      >
        {listError && (
          <s-banner tone="critical">{listError}</s-banner>
        )}

        {listStatus === 'loading' && (
          <s-paragraph>Loading discounts…</s-paragraph>
        )}

        {listStatus === 'idle' && discounts.length === 0 && (
          <s-paragraph>
            No discount codes yet. Create one above to start offering
            spend-based savings.
          </s-paragraph>
        )}

        {listStatus === 'idle' && discounts.length > 0 && (
          <s-stack direction="block" gap="base">
            {discounts.map((discount) => {
              const isActive = discount.status === 'ACTIVE';
              const action = rowActions[discount.id];
              const tierLines = discount.tiers
                .map(formatTierLine)
                .filter(Boolean);

              return (
                <s-box
                  key={discount.id}
                  padding="base"
                  border="base"
                  borderRadius="base"
                >
                  <s-stack direction="block" gap="base">
                    <s-stack direction="inline" justifyContent="space-between">
                      <s-stack direction="inline" gap="base">
                        <s-text fontWeight="bold">{discount.code}</s-text>
                        <s-badge tone={isActive ? 'success' : 'neutral'}>
                          {discount.status}
                        </s-badge>
                      </s-stack>
                      <s-link
                        href={`shopify://admin/discounts/${gidToId(discount.id)}`}
                        target="_blank"
                      >
                        View
                      </s-link>
                    </s-stack>

                    <s-stack direction="block" gap="extraTight">
                      {tierLines.length ? (
                        tierLines.map((line, i) => (
                          <s-paragraph key={i}>{line}</s-paragraph>
                        ))
                      ) : (
                        <s-paragraph>No tiers configured</s-paragraph>
                      )}
                    </s-stack>

                    <s-stack direction="inline" gap="base" justifyContent="end" >
                      <s-button
                        variant="secondary"
                        onClick={() => startEdit(discount)}
                      >
                        Edit
                      </s-button>
                      <s-button
                        variant="secondary"
                        loading={action === 'toggling'}
                        onClick={() => handleToggleActive(discount.id, !isActive)}
                      >
                        {isActive ? 'Deactivate' : 'Activate'}
                      </s-button>
                      <s-button
                        variant="secondary"
                        tone="critical"
                        loading={action === 'deleting'}
                        onClick={() => handleDelete(discount.id)}
                      >
                        Delete
                      </s-button>
                    </s-stack>
                  </s-stack>
                </s-box>
              );
            })}
          </s-stack>
        )}
      </s-section>
    </s-page>
  );
}