import {render} from 'preact';


const TIERS = [
  {spend: 350, save: 50},
  {spend: 600, save: 100},
  {spend: 850, save: 150},
];

export default async () => {
  render(<DiscountSettings />, document.body);

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
          Gift cards are excluded — they don't count toward the spend threshold
          and are never discounted.
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
