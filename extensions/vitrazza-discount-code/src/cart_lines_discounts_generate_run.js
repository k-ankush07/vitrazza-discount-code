import {
  DiscountClass,
  OrderDiscountSelectionStrategy,
} from '../generated/api';

/**
  * @typedef {import("../generated/api").CartInput} RunInput
  * @typedef {import("../generated/api").CartLinesDiscountsGenerateRunResult} CartLinesDiscountsGenerateRunResult
  */

/**
  * @param {RunInput} input
  * @returns {CartLinesDiscountsGenerateRunResult}
  */
export function cartLinesDiscountsGenerateRun(input) {
  if (!input.cart.lines.length) {
    return { operations: [] };
  }

  const hasOrderDiscountClass = input.discount.discountClasses.includes(
    DiscountClass.Order,
  );

  if (!hasOrderDiscountClass) {
    return { operations: [] };
  }

  // Tiers now come from the function's metafield, not a hardcoded list.
  /** @type {{tiers: {spend: number, save: number}[]}} */
  let configuration = {tiers: []};
  try {
    configuration = JSON.parse(input.discount.metafield?.value ?? '{"tiers":[]}');
  } catch {
    configuration = {tiers: []};
  }

  const tiers = (configuration.tiers ?? [])
    .filter((t) => t.spend > 0 && t.save > 0)
    .sort((a, b) => b.spend - a.spend); // highest spend checked first

  if (!tiers.length) {
    return { operations: [] };
  }

  const isGiftCardLine = (line) =>
    line.merchandise?.__typename === 'ProductVariant' &&
    line.merchandise?.product?.isGiftCard === true;

  const giftCardLineIds = input.cart.lines
    .filter(isGiftCardLine)
    .map((line) => line.id);

  const eligibleLines = input.cart.lines.filter((line) => !isGiftCardLine(line));

  if (!eligibleLines.length) {
    return { operations: [] };
  }

  const cartSubtotal = eligibleLines.reduce((total, line) => {
    return total + Number(line.cost.subtotalAmount.amount);
  }, 0);

  let discountAmount = 0;
  for (const tier of tiers) {
    if (cartSubtotal >= tier.spend) {
      discountAmount = tier.save;
      break;
    }
  }

  if (discountAmount === 0) {
    return { operations: [] };
  }

  const operations = [
    {
      orderDiscountsAdd: {
        candidates: [
          {
            message: `SAVE $${discountAmount}`,
            targets: [
              {
                orderSubtotal: {
                  excludedCartLineIds: giftCardLineIds,
                },
              },
            ],
            value: {
              fixedAmount: {
                amount: discountAmount,
              },
            },
          },
        ],
        selectionStrategy: OrderDiscountSelectionStrategy.First,
      },
    },
  ];

  return {
    operations,
  };
}