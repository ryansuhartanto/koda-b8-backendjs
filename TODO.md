# TODO

## Admin surface (designed, not built)

The customer-facing routes nest under `/me` specifically so the flat collections
stay free for admin. Claim them in this order; nothing below is implemented.

| Route                                                | Model               | Notes                                                                                    |
| ---------------------------------------------------- | ------------------- | ---------------------------------------------------------------------------------------- |
| `GET /orders`                                        | `OrdersSummary`     | all orders, not the caller's — hence the `/me/orders` split                              |
| `PATCH /orders/:id_order`                            | `OrdersSummary`     | status transitions; `order_status` enum exists and nothing advances past `pending` today |
| `POST /products`                                     | `ProductsSummary`   | writes hit the base tables, reads still come from the views                              |
| `PATCH /products/:id_product`                        | `ProductsSummary`   |                                                                                          |
| `DELETE /products/:id_product`                       |                     | soft delete, `deleted_at`                                                                |
| `POST /products/:id_product/variants`                | `ProductVariant`    | price lands in `products_price`, not `products_variants`                                 |
| `PATCH /variants/:id_variant`                        | `ProductVariant`    |                                                                                          |
| `POST /categories`, `PATCH /categories/:id_category` | `CategoriesSummary` |                                                                                          |
| `POST /brands`, `PATCH /brands/:id_brand`            | `BrandsSummary`     |                                                                                          |
| `GET /users`                                         | `UsersMe`           | paginated, admin only                                                                    |

### Role gate

`users_me.roles` already carries the enum. Put roles in the JWT at login so the
admin middleware needs no per-request query.

**Ceiling:** revocation then waits out the 24h token TTL. If that matters,
re-read roles per request instead and accept the extra round trip.

### Before admin lands

- `POST /products/:id_product/variants` needs `id_category` and `id_brand` on
  `products_summary`; today the view exposes only the resolved `name`, so a
  write path cannot round-trip what it just read.
- Nothing invalidates the ETag middleware on write. It is currently safe only
  because every route is a read.

## Deferred elsewhere

- `orders_summary` exposes `id_payment` but not the payment method's name, so a
  client rendering an order has to join it against `GET /payment-methods`
  itself. Add `pm.name AS payment_name` to the view if that turns out annoying.
- `GET /me/payments` returns `users_payments_active.data` verbatim. It is
  operator-supplied JSON with no schema; validate it if users ever write to it.
