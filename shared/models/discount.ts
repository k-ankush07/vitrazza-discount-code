function gqlFetch(query: string, variables?: Record<string, unknown>) {
  return fetch("shopify:admin/api/2026-07/graphql.json", {
    method: "POST",
    body: JSON.stringify({ query, variables }),
  }).then((r) => r.json());
}

export interface DiscountFunction {
  id: string;
  title: string;
  appTitle: string;
}

export interface CreateDiscountInput {
  code: string;
  functionId: string;
  combinesWithOrderDiscounts: boolean;
}

/**
 * Discount functions from every installed app, so the merchant can confirm
 * which one they're wiring the code to rather than us guessing by title.
 */
export async function listDiscountFunctions(): Promise<DiscountFunction[]> {
  const json = await gqlFetch(
    `#graphql
    query DiscountFunctions {
      shopifyFunctions(first: 50, apiType: "discount") {
        nodes {
          id
          title
          app {
            title
          }
        }
      }
    }`,
  );

  const nodes = json?.data?.shopifyFunctions?.nodes;
  if (!nodes) {
    throw new Error(
      json?.errors?.[0]?.message ?? "Could not load discount functions",
    );
  }

  return nodes.map((node: any) => ({
    id: node.id,
    title: node.title,
    appTitle: node.app?.title ?? "",
  }));
}

export async function createDiscountCode({
  code,
  functionId,
  combinesWithOrderDiscounts,
}: CreateDiscountInput): Promise<string> {
  const json = await gqlFetch(
    `#graphql
    mutation CreateTieredDiscount($discount: DiscountCodeAppInput!) {
      discountCodeAppCreate(codeAppDiscount: $discount) {
        codeAppDiscount {
          discountId
        }
        userErrors {
          field
          message
        }
      }
    }`,
    {
      discount: {
        title: code,
        code,
        functionId,
        startsAt: new Date().toISOString(),
        // The function only emits an order discount, and its delivery target
        // would give 100% off shipping if the Shipping class were present.
        discountClasses: ["ORDER"],
        combinesWith: {
          orderDiscounts: combinesWithOrderDiscounts,
          productDiscounts: false,
          shippingDiscounts: false,
        },
      },
    },
  );

  const result = json?.data?.discountCodeAppCreate;
  const userError = result?.userErrors?.[0];
  if (userError) {
    throw new Error(userError.message);
  }

  const discountId = result?.codeAppDiscount?.discountId;
  if (!discountId) {
    throw new Error(
      json?.errors?.[0]?.message ?? "Discount was not created",
    );
  }

  return discountId;
}
