# TODO

## Admin surface

The customer-facing routes nest under `/me` specifically so the flat collections
stay free for admin. Built so far: `GET /orders`, `PATCH /orders/:id_order`,
`POST /products`. Still open:

| Route                                                | Model               | Notes                                                    |
| ---------------------------------------------------- | ------------------- | -------------------------------------------------------- |
| `PATCH /products/:id_product`                        | `ProductsSummary`   |                                                          |
| `DELETE /products/:id_product`                       |                     | soft delete, `deleted_at`                                |
| `POST /products/:id_product/variants`                | `ProductVariant`    | price lands in `products_price`, not `products_variants` |
| `PATCH /variants/:id_variant`                        | `ProductVariant`    |                                                          |
| `POST /categories`, `PATCH /categories/:id_category` | `CategoriesSummary` |                                                          |
| `POST /brands`, `PATCH /brands/:id_brand`            | `BrandsSummary`     |                                                          |
| `GET /users`                                         | `UsersMe`           | paginated, admin only                                    |

### Role gate

Login puts `roles` in the JWT and the `admin` middleware reads the claim.

**Ceiling:** revocation waits out the 24h token TTL. If that matters, re-read
roles per request instead and accept the extra round trip.

Tokens issued before this carry no claim, so they read as non-admin. Admins have
to log in once more.

### Before the rest of admin lands

- An edit path needs `id_category` and `id_brand` on `products_summary`; today
  the view exposes only the resolved `name`, so a write cannot round-trip what
  it just read. `POST /products` sidesteps this by taking the ids in the body.
- Nothing grants the `admin` role over HTTP, so parity covers only the 401 and
  403 paths. The admin happy paths need a seeded admin account to log in as.
- The ETag middleware has no invalidation, but it hashes each response body as
  it is sent rather than caching one, so writes do not stale it.

## Deferred elsewhere

- `orders_summary` exposes `id_payment` but not the payment method's name, so a
  client rendering an order has to join it against `GET /payment-methods`
  itself. Add `pm.name AS payment_name` to the view if that turns out annoying.
- `GET /me/payments` returns `users_payments_active.data` verbatim. It is
  operator-supplied JSON with no schema; validate it if users ever write to it.
- `products_variants.price` is written on create to satisfy `NOT NULL`, but no
  view reads it. Drop the column if nothing ever claims it.
