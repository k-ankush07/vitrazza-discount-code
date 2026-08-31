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

export interface Tier {
  spend: number;
  save: number;
}

export interface DiscountListItem {
  id: string;
  code: string;
  status: string;
  combinesWithOrderDiscounts: boolean;
  functionId: string;
  tiers: Tier[];
}

export interface CreateDiscountInput {
  code: string;
  functionId: string;
  combinesWithOrderDiscounts: boolean;
  configuration: {
    tiers: Tier[];
  };
}

export interface UpdateDiscountInput {
  id: string;
  code: string;
  combinesWithOrderDiscounts: boolean;
  configuration: {
    tiers: Tier[];
  };
}

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

/**
 * Lists every code discount created by this app's function, including the
 * tiers stored in the "$app"/"function-configuration" metafield.
 *
 * `query: "type:app AND method:code"` scopes the server-side search to app
 * discounts only, so this app's discount doesn't get pushed off the first
 * page by unrelated auto-generated codes from other apps/integrations.
 *
 * `ownFunctionId`, when provided, further restricts the results to
 * discounts created by this app's own function — `type:app` alone matches
 * ANY installed app's code discounts, not just this one's.
 */
export async function listDiscountCodes(
  ownFunctionId?: string,
): Promise<DiscountListItem[]> {
  const json = await gqlFetch(
    `#graphql
    query ListAppDiscounts {
      codeDiscountNodes(first: 50, sortKey: CREATED_AT, reverse: true, query: "type:app AND method:code") {
        nodes {
          id
          metafield(namespace: "$app", key: "function-configuration") {
            value
          }
          codeDiscount {
            __typename
            ... on DiscountCodeApp {
              status
              codes(first: 1) {
                nodes {
                  code
                }
              }
              combinesWith {
                orderDiscounts
              }
              appDiscountType {
                functionId
              }
            }
          }
        }
      }
    }`,
  );

  const nodes = json?.data?.codeDiscountNodes?.nodes;
  if (!nodes) {
    throw new Error(
      json?.errors?.[0]?.message ?? "Could not load discounts",
    );
  }

  return nodes
    .filter(
      (n: any) =>
        n.codeDiscount?.__typename === "DiscountCodeApp" &&
        (!ownFunctionId ||
          n.codeDiscount.appDiscountType?.functionId === ownFunctionId),
    )
    .map((n: any) => {
      let tiers: Tier[] = [];
      try {
        const parsed = JSON.parse(n.metafield?.value ?? '{"tiers":[]}');
        tiers = parsed.tiers ?? [];
      } catch {
        tiers = [];
      }
      return {
        id: n.id,
        code: n.codeDiscount.codes.nodes[0]?.code ?? "",
        status: n.codeDiscount.status,
        combinesWithOrderDiscounts:
          n.codeDiscount.combinesWith?.orderDiscounts ?? false,
        functionId: n.codeDiscount.appDiscountType?.functionId ?? "",
        tiers,
      };
    });
}

export async function createDiscountCode({
  code,
  functionId,
  combinesWithOrderDiscounts,
  configuration,
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
        discountClasses: ["ORDER"],
        combinesWith: {
          orderDiscounts: combinesWithOrderDiscounts,
          productDiscounts: false,
          shippingDiscounts: false,
        },
        metafields: [
          {
            namespace: "$app",
            key: "function-configuration",
            type: "json",
            value: JSON.stringify(configuration),
          },
        ],
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

/**
 * Updates an existing app discount code: the code itself, whether it
 * combines with other order discounts, and its tier configuration.
 */
export async function updateDiscountCode({
  id,
  code,
  combinesWithOrderDiscounts,
  configuration,
}: UpdateDiscountInput): Promise<void> {
  const json = await gqlFetch(
    `#graphql
    mutation UpdateTieredDiscount($id: ID!, $discount: DiscountCodeAppInput!) {
      discountCodeAppUpdate(id: $id, codeAppDiscount: $discount) {
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
      id,
      discount: {
        title: code,
        code,
        combinesWith: {
          orderDiscounts: combinesWithOrderDiscounts,
          productDiscounts: false,
          shippingDiscounts: false,
        },
        metafields: [
          {
            namespace: "$app",
            key: "function-configuration",
            type: "json",
            value: JSON.stringify(configuration),
          },
        ],
      },
    },
  );

  const result = json?.data?.discountCodeAppUpdate;
  const userError = result?.userErrors?.[0];
  if (userError) {
    throw new Error(userError.message);
  }
  if (!result?.codeAppDiscount) {
    throw new Error(json?.errors?.[0]?.message ?? "Discount was not updated");
  }
}

export async function deleteDiscountCode(id: string): Promise<void> {
  const json = await gqlFetch(
    `#graphql
    mutation DeleteDiscount($id: ID!) {
      discountCodeDelete(id: $id) {
        deletedCodeDiscountId
        userErrors {
          field
          message
        }
      }
    }`,
    { id },
  );

  const result = json?.data?.discountCodeDelete;
  const userError = result?.userErrors?.[0];
  if (userError) {
    throw new Error(userError.message);
  }
  if (!result?.deletedCodeDiscountId) {
    throw new Error(json?.errors?.[0]?.message ?? "Discount was not deleted");
  }
}

/**
 * Activates or deactivates a code discount. Works for any code discount
 * type, including app discounts.
 */
export async function setDiscountActive(
  id: string,
  active: boolean,
): Promise<void> {
  const mutationName = active ? "discountCodeActivate" : "discountCodeDeactivate";
  const json = await gqlFetch(
    `#graphql
    mutation ToggleDiscount($id: ID!) {
      ${mutationName}(id: $id) {
        codeDiscountNode {
          id
        }
        userErrors {
          field
          message
        }
      }
    }`,
    { id },
  );

  const result = json?.data?.[mutationName];
  const userError = result?.userErrors?.[0];
  if (userError) {
    throw new Error(userError.message);
  }
  if (!result?.codeDiscountNode) {
    throw new Error(
      json?.errors?.[0]?.message ?? "Discount status was not updated",
    );
  }
}