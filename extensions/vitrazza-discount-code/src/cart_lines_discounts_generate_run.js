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

  const cartSubtotal = input.cart.lines.reduce((total, line) => {
    return total + Number(line.cost.subtotalAmount.amount);
  }, 0);

  let discountAmount = 0;
  let message = '';

  if (cartSubtotal >= 850) {
    discountAmount = 150;
    message = 'TIER 3: $150 OFF';
  } else if (cartSubtotal >= 600) {
    discountAmount = 100;
    message = 'TIER 2: $100 OFF';
  } else if (cartSubtotal >= 350) {
    discountAmount = 50;
    message = 'TIER 1: $50 OFF';
  }

  if (discountAmount === 0) {
    return { operations: [] };
  }

  const operations = [
    {
      orderDiscountsAdd: {
        candidates: [
          {
            message: message,
            targets: [
              {
                orderSubtotal: {
                  excludedCartLineIds: [],
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