# BeliMudah API

E-commerce services.

## Layout

- `apps/go`: Gin
- `apps/js`: Express
- `db/`: Migrations

## Requirements

- [mise](https://mise.jdx.dev)
- Running Postgres server with an empty database

## Setup

```sh
mise install
aube install

cp .env.example .env # set PGPASSWORD, PGDATABASE, JWT_SECRET
mise run db:up
mise run db:seed
```

## Running

```sh
mise run dev
mise run dev:go # Gin only
mise run dev:js # Express only
```

Docs are at either:

- <http://localhost:3001/docs>
- <http://localhost:3002/docs>

`GET /healthz` to check each service's database connection.

## Tasks

| command                     | description                             |
| --------------------------- | --------------------------------------- |
| `mise run dev`              | run services with auto-reload           |
| `mise run docs`             | regenerate OpenAPI specs                |
| `mise run db:up`            | migrations: apply                       |
| `mise run db:down`          | migrations: roll back                   |
| `mise run db:create <name>` | migrations: scaffold empty up/down file |
| `mise run db:seed`          | load the sample catalogue               |
| `mise run test`             | run tests                               |
| `mise run test:watch`       | run tests with auto-reload              |
| `mise run check`            | vet Go, lint, format and typecheck JS   |

## ERD

```mermaid
---
title: BeliMudah
---
erDiagram

users             ||--o{ roles             : "holds"
users             ||--|| profile           : "described by"
categories        |o--o{ products          : "groups"
brands            |o--o{ products          : "makes"
products          ||--o{ products_variants : "varies as"
products          ||--o{ products_images   : "shown by"
products_variants |o--o{ products_images   : "shown by"
products_variants ||--|| products_price    : "priced at"
users             ||--o{ ratings           : "writes"
products_variants ||--o{ ratings           : "rated by"
users             ||--o{ saved_address     : "has"
users             ||--o{ saved_payments    : "has"
users             ||--o{ cart_items        : "has"
products_variants ||--o{ cart_items        : "in"
users             ||--o{ wishlist_items    : "has"
products          ||--o{ wishlist_items    : "in"
users             ||--o{ orders            : "places"
orders            ||--o{ order_items       : "detailed by"
products_variants |o--o{ order_items       : "snapshotted in"

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

products_variants {
 int id PK

 timestamptz  created_at
 timestamptz  updated_at
 timestamptz? deleted_at

 int id_product FK
 int position

 int inventory

 string  name
 string? description
}

products_images {
 int id PK

 int  id_product FK
 int? id_variant FK

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

saved_address {
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

saved_payments {
 int id PK

 timestamptz  created_at
 timestamptz  updated_at
 timestamptz? deleted_at

 int id_user FK

 string type
 bool   is_default
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

 enum   status "pending | packed | shipped | delivered | cancelled"
 string payment_method

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

order_items {
 int id PK

 int  id_order   FK
 int? id_variant FK

 string product_name
 string variant_name
 bigint unit_price_idr
 int    quantity
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
