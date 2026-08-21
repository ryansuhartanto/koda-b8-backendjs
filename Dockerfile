FROM node:26-alpine AS base

COPY --from=oven/bun:1-alpine /usr/local/bin/bun /usr/local/bin/

WORKDIR /var/app/

COPY --parents package.json bun.lock ./
COPY --parents apps/js/package.json db/seed/package.json parity/package.json ./
RUN bun ci --ignore-scripts

COPY --parents tsconfig.json vite.config.ts ./
ENV PATH="/var/app/node_modules/.bin:$PATH"

FROM golang:1.26-alpine AS build-go

WORKDIR /var/app/
COPY --parents go.work apps/go/go.mod apps/go/go.sum ./
RUN go mod download

COPY --parents apps/go/ ./
RUN go -C apps/go build -o /usr/local/bin/api .

FROM golang:1.26-alpine AS build-migrate

RUN go install -tags pgx5 github.com/golang-migrate/migrate/v4/cmd/migrate@latest

FROM base AS build-js

COPY --parents apps/js/ ./
RUN bun run --cwd apps/js build

FROM base AS build-seed

COPY --parents db/seed/ ./
RUN bun run --cwd db/seed pack

FROM alpine:latest AS tools

RUN apk add --no-cache libstdc++

COPY --from=build-migrate /go/bin/migrate /usr/local/bin/
COPY --from=build-seed /var/app/db/seed/build/seed /usr/local/bin/
COPY db/migrations/ /migrations/

CMD [ "sh", "-c", "migrate -database pgx5://: -path /migrations up && seed" ]

FROM alpine:latest AS go

WORKDIR /var/app/
COPY --from=build-go /usr/local/bin/api /usr/local/bin/

EXPOSE 3001
CMD [ "api" ]

FROM alpine:latest AS js

RUN apk add --no-cache libstdc++

COPY --from=build-js /var/app/apps/js/build/index /usr/local/bin/js

EXPOSE 3002
CMD [ "js" ]
