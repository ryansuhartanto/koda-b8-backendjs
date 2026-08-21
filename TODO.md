# TODO

## Admin surface

The customer-facing routes nest under `/me` so the flat collections stay free
for admin. Built so far: `GET /orders`, `PATCH /orders/:id_order`,
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

**Ceiling:** revocation waits out the 24h token TTL. Re-read roles per request if
that matters, at the cost of a round trip.

Tokens issued before this carry no claim and read as non-admin; admins must log
in again.

### Before the rest of admin lands

- An edit path needs `id_category` and `id_brand` on `products_summary`; the
  view exposes only the resolved `name`, so a write cannot round-trip what it
  just read. `POST /products` sidesteps this by taking the ids in the body.
- Nothing grants the `admin` role over HTTP, so parity covers only the 401 and
  403 paths. The happy paths need a seeded admin account.
- The ETag middleware has no invalidation, but it hashes each response body as
  it is sent rather than caching one, so writes do not stale it.

## Deferred elsewhere

- `orders_summary` exposes `id_payment` but not the payment method's name, so a
  client rendering an order must join `GET /payment-methods`. Add
  `pm.name AS payment_name` to the view if that becomes annoying.
- `GET /me/payments` returns `users_payments_active.data` verbatim. It is
  operator-supplied JSON with no schema; validate it if users ever write to it.
- `products_variants.price` is written on create to satisfy `NOT NULL`, but no
  view reads it. Drop the column if nothing claims it.
