import {render} from 'preact';

// Mirrors the thresholds hardcoded in
// extensions/vitrazza-discount-code/src/cart_lines_discounts_generate_run.js
// Keep both in sync — this UI is display-only.
const TIERS = [
  {spend: 350, save: 50},
  {spend: 600, save: 100},
  {spend: 850, save: 150},
];

export default async () => {
  render(<DiscountSettings />, document.body);

  // The function only emits an order discount when the Order class is present,
  // and its delivery target gives 100% off shipping whenever the Shipping class
  // is present. Pin to Order so shipping can never be discounted by accident.
  // Guarded so a failure here can never stop the settings UI from rendering.
  try {
    shopify.discounts?.updateDiscountClasses(['order']);
  } catch (error) {
    console.error('Could not pin discount classes to order', error);
  }
};

function DiscountSettings() {
  return (
    <s-function-settings>
      <s-section heading="Tiered cart discount">
        <s-paragraph>
          The discount below is applied to the order subtotal once the customer
          enters this discount code. Only the highest matching tier applies.
        </s-paragraph>
        <s-unordered-list>
          {TIERS.map((tier) => (
            <s-list-item key={tier.spend}>
              Spend ${tier.spend} or more — save ${tier.save}
            </s-list-item>
          ))}
        </s-unordered-list>
        <s-paragraph>
          These amounts are set in the app's discount function and can't be
          edited here.
        </s-paragraph>
      </s-section>
    </s-function-settings>
  );
}
