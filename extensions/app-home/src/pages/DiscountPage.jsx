import {useState, useEffect} from 'preact/hooks';
import {
  listDiscountFunctions,
  createDiscountCode,
} from '../../../../shared/models/discount';
import {gidToId} from '../../../../shared/utils/gid';

/** @typedef {import('../../../../shared/models/discount').DiscountFunction} DiscountFunction */

const TIERS = [
  {spend: 350, save: 50},
  {spend: 600, save: 100},
  {spend: 850, save: 150},
];

export default function DiscountPage() {
  const [functions, setFunctions] = useState(
    /** @type {DiscountFunction[]} */ ([]),
  );
  const [functionId, setFunctionId] = useState('');
  const [code, setCode] = useState('SPENDSAVE');
  const [combines, setCombines] = useState(false);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState(/** @type {string | null} */ (null));
  const [createdId, setCreatedId] = useState(
    /** @type {string | null} */ (null),
  );

  useEffect(() => {
    (async () => {
      try {
        const found = await listDiscountFunctions();
        setFunctions(found);
        // Prefer this app's own function so the merchant rarely has to choose.
        const own = found.find((fn) => fn.appTitle === 'vitrazza discount code');
        setFunctionId((own ?? found[0])?.id ?? '');
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

  const handleSubmit = async () => {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) {
      setError('Enter a discount code');
      throw new Error('Validation failed');
    }
    if (!functionId) {
      setError('Select a discount function');
      throw new Error('Validation failed');
    }

    setStatus('saving');
    setError(null);
    setCreatedId(null);

    try {
      const discountId = await createDiscountCode({
        code: trimmed,
        functionId,
        combinesWithOrderDiscounts: combines,
      });
      setCreatedId(discountId);
      setStatus('idle');
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : 'Could not create the discount',
      );
      setStatus('idle');
      throw saveError;
    }
  };

  /** @param {any} event */
  const onSubmit = (event) => {
    event?.waitUntil?.(handleSubmit());
  };

  const isLoading = status === 'loading';

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

      <s-section heading="Tiers">
        <s-paragraph>
          Applied to the order subtotal once the code is entered. Only the
          highest matching tier applies.
        </s-paragraph>
        <s-unordered-list>
          {TIERS.map((tier) => (
            <s-list-item key={tier.spend}>
              Spend ${tier.spend} or more — save ${tier.save}
            </s-list-item>
          ))}
        </s-unordered-list>
      </s-section>

      {!isLoading && (
        <s-section heading="Discount code">
          <s-form onSubmit={onSubmit}>
            <s-text-field
              label="Code"
              name="code"
              labelAccessibilityVisibility="visible"
              value={code}
              onInput={(e) =>
                setCode(/** @type {HTMLInputElement} */ (e.target).value)
              }
              details="Customers enter this at checkout"
              required
            />

            <s-select
              label="Discount function"
              name="functionId"
              labelAccessibilityVisibility="visible"
              value={functionId}
              onChange={(e) =>
                setFunctionId(/** @type {HTMLSelectElement} */ (e.target).value)
              }
              details="The function that calculates the tiers"
            >
              {functions.map((fn) => (
                <s-option key={fn.id} value={fn.id}>
                  {fn.title} ({fn.appTitle})
                </s-option>
              ))}
            </s-select>

            <s-switch
              label="Combine with other order discounts"
              name="combines"
              checked={combines}
              onChange={(e) =>
                setCombines(
                  /** @type {HTMLInputElement} */ (e.target).checked,
                )
              }
              details="Leave off so this code can't stack with the existing percentage-off codes"
            />

            <s-button
              variant="primary"
              type="submit"
              loading={status === 'saving'}
            >
              Create discount
            </s-button>
          </s-form>
        </s-section>
      )}
    </s-page>
  );
}
