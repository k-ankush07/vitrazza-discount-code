import {render} from 'preact';
import {useState, useEffect} from 'preact/hooks';

export default async () => {
  render(<DiscountSettings />, document.body);

  try {
    shopify.discounts?.updateDiscountClasses(['order']);
  } catch (error) {
    console.error('Could not pin discount classes to order', error);
  }
};

function DiscountSettings() {
  const [tiers, setTiers] = useState(/** @type {{spend:number,save:number}[]} */ ([]));

  useEffect(() => {
    try {
      const raw = shopify.data?.metafield?.value; 
      const parsed = raw ? JSON.parse(raw) : {tiers: []};
      setTiers(parsed.tiers ?? []);
    } catch (e) {
      console.error('Could not parse tier configuration', e);
      setTiers([]);
    }
  }, []);

  return (
    <s-function-settings>
      <s-section heading="Tiered cart discount">
        <s-paragraph>
          The discount below is applied to the order subtotal once the customer
          enters this discount code. Only the highest matching tier applies.
          Gift cards are excluded — they don't count toward the spend threshold
          and are never discounted.
        </s-paragraph>
        {tiers.length > 0 ? (
          <s-unordered-list>
            {tiers.map((tier) => (
              <s-list-item key={tier.spend}>
                Spend ${tier.spend} or more — save ${tier.save}
              </s-list-item>
            ))}
          </s-unordered-list>
        ) : (
          <s-paragraph>No tiers configured for this discount.</s-paragraph>
        )}
        <s-paragraph>
          These amounts are set in the app's discount function and can't be
          edited here.
        </s-paragraph>
      </s-section>
    </s-function-settings>
  );
}