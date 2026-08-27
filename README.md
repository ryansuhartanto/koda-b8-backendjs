# BeliMudah API

E-commerce services.

## Layout

- `apps/go`: Gin
- `apps/js`: Express
- `db/`: Migrations

## Requirements

- [bun](https://bun.com)
- [Go](https://go.dev) 1.26
- Postgres with an empty database

## Setup

```sh
bun install

cp .env.example .env # set PGPASSWORD, PGDATABASE, JWT_SECRET
bun run db:up
bun run db:seed:up
```

## Running

```sh
bun run dev
bun run dev:go # Gin only
bun run dev:js # Express only
```

Docs:

- <http://localhost:3001/docs>
- <http://localhost:3002/docs>

`GET /healthz` checks each service's database connection.

## Tasks

| command                    | description                             |
| -------------------------- | --------------------------------------- |
| `bun run dev`              | run services with auto-reload           |
| `bun run docs`             | regenerate OpenAPI specs                |
| `bun run db:up`            | migrations: apply                       |
| `bun run db:down`          | migrations: roll back                   |
| `bun run db:create <name>` | migrations: scaffold empty up/down file |
| `bun run db:seed:up`       | load the sample catalogue               |
| `bun run test`             | run tests                               |
| `bun run test:watch`       | run tests with auto-reload              |
| `bun run check`            | vet Go, lint, format and typecheck JS   |

## ERD

```mermaid
---
title: BeliMudah
---
erDiagram

users                   ||--o{ roles                     : "holds"
users                   ||--|| profile                   : "described by"
categories              |o--o{ products                  : "groups"
brands                  |o--o{ products                  : "makes"
products                ||--o{ products_options          : "varies by"
products_options        ||--o{ products_options_values   : "offers"
products                ||--o{ products_variants         : "varies as"
products_variants       ||--o{ products_variants_options : "configured by"
products_options_values ||--o{ products_variants_options : "selected in"
products                ||--o{ products_images           : "shown by"
products_variants       |o--o{ products_images           : "shown by"
products_variants       ||--|| products_price            : "priced at"
users                   ||--o{ ratings                   : "writes"
products_variants       ||--o{ ratings                   : "rated by"
users                   ||--o{ users_address             : "has"
users                   ||--o{ users_payments            : "has"
payment_methods         ||--o{ users_payments            : "saved as"
users                   ||--o{ cart_items                : "has"
products_variants       ||--o{ cart_items                : "in"
users                   ||--o{ wishlist_items            : "has"
products                ||--o{ wishlist_items            : "in"
users                   ||--o{ orders                    : "places"
payment_methods         ||--o{ orders                    : "pays"
orders                  ||--o{ orders_items              : "detailed by"
products_variants       |o--o{ orders_items              : "snapshotted in"

users {
 int id PK

 timestamptz  created_at
 timestamptz  updated_at
 timestamptz? deleted_at

 string email UK
 string password_hash
}

roles {
 int  id_user PK,FK
 enum role    PK,FK "customer | admin"

 timestamptz  created_at
 timestamptz  updated_at
 timestamptz? deleted_at
}

profile {
 int id_user PK,FK

 string name

 string? phone
 date?   birthdate
 enum?   gender "M | F | X"
 string? avatar
}

categories {
 int id PK

 timestamptz  created_at
 timestamptz  updated_at
 timestamptz? deleted_at

 string  name UK
 string? icon
 string? img
}

brands {
 int id PK

 timestamptz  created_at
 timestamptz  updated_at
 timestamptz? deleted_at

 string name UK
}

products {
 int id PK

 timestamptz  created_at
 timestamptz  updated_at
 timestamptz? deleted_at

 int? id_category FK
 int? id_brand    FK

 string  name
 string? description
}

products_options {
 int id PK

 timestamptz  created_at
 timestamptz  updated_at
 timestamptz? deleted_at

 int id_product FK,UK

 int    tier UK
 string name UK
}

products_options_values {
 int id PK

 timestamptz  created_at
 timestamptz  updated_at
 timestamptz? deleted_at

 int id_option FK,UK

 string  name UK
 string? description
}

products_variants {
 int id PK

 timestamptz  created_at
 timestamptz  updated_at
 timestamptz? deleted_at

 int id_product FK

 string? sku UK
 bigint  price "CHECK (price >= 0)"
 int     stock "CHECK (stock >= 0)"
}

products_variants_options {
 timestamptz created_at

 int id_variant PK,FK
 int id_value   PK,FK
}

products_images {
 int id PK

 int  id_product FK,UK
 int? id_variant FK

 int    position UK
 string url
}

products_price {
 int id_variant PK,FK

 bigint  original_price_idr
 bigint? discount_price_idr "CHECK (discount_price_idr < original_price_idr)"
 bigint  price_idr "GENERATED ALWAYS AS (COALESCE(discount_price_idr, original_price_idr)) STORED"
}

ratings {
 int id PK

 timestamptz  created_at
 timestamptz  updated_at
 timestamptz? deleted_at

 int id_user    FK,UK
 int id_variant FK,UK

 int     rating
 string? description
}

payment_methods {
 int id PK

 timestamptz  created_at
 timestamptz  updated_at
 timestamptz? deleted_at

 string name UK
 bool   is_available
 json   metadata
}

users_address {
 int id PK

 timestamptz  created_at
 timestamptz  updated_at
 timestamptz? deleted_at

 int id_user FK

 string  label
 string  name
 string  phone
 string  address
 string  city
 string  province
 string  postal_code
 bool    is_default
}

users_payments {
 int id PK

 timestamptz  created_at
 timestamptz  updated_at
 timestamptz? deleted_at

 int id_payment FK
 int id_user    FK

 bool is_default
 json data
}

cart_items {
 timestamptz created_at

 int id_user    PK,FK
 int id_variant PK,FK

 int quantity
}

wishlist_items {
 timestamptz created_at

 int id_user    PK,FK
 int id_product PK,FK
}

orders {
 int id PK

 timestamptz  created_at
 timestamptz  updated_at
 timestamptz? deleted_at

 int id_user FK

 enum status "pending | packed | shipped | delivered | cancelled"
 int  payment_method FK

 string? promo_code
 bigint  discount_idr
 bigint  subtotal_idr
 bigint  ship_cost_idr
 bigint  total_idr "GENERATED ALWAYS AS (subtotal_idr - discount_idr + ship_cost_idr) STORED"

 string  ship_name
 string  ship_phone
 string  ship_email
 string  ship_address
 string  ship_method
 string? ship_note
}

orders_items {
 int id PK

 int  id_order   FK
 int? id_variant FK

 string  product_name
 string? variant_name
 bigint  unit_price_idr
 int     quantity "CHECK (quantity > 0)"
}

shipping_methods {
 int id PK

 timestamptz  created_at
 timestamptz  updated_at
 timestamptz? deleted_at

 string name UK
 bigint cost_idr
}
```

## License

[MIT](LICENSE)
