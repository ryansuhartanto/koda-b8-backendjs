FROM alpine:latest AS base

RUN apk add --no-cache bash libstdc++
RUN apk add --no-cache \
	--repository=http://dl-cdn.alpinelinux.org/alpine/edge/community \
	mise

WORKDIR /var/app/

ENV \
	MISE_ALL_COMPILE=false \
	MISE_NODE_MIRROR_URL=https://unofficial-builds.nodejs.org/download/release/ \
	MISE_TRUSTED_CONFIG_PATHS=/var/app/
COPY --parents .config/mise.toml ./
RUN mise install

COPY --parents package.json aube-lock.yaml go.work ./
COPY --parents apps/js/package.json db/seed/package.json apps/go/go.mod apps/go/go.sum ./
RUN mise exec -- sh -c "aube ci --ignore-scripts && go mod download"

COPY --parents tsconfig.json vite.config.ts ./
ENV PATH="/var/app/node_modules/.bin:$PATH"

FROM base AS build-go

COPY --parents apps/go/ ./
RUN mise exec -- go -C apps/go build -o /usr/local/bin/api .

FROM base AS build-js

COPY --parents apps/js/ ./
RUN mise exec -- aube --dir apps/js run pack

FROM base AS build-tools

COPY --parents db/seed/ ./
RUN mise exec -- aube --dir db/seed run pack
RUN cp "$(mise where 'go:github.com/golang-migrate/migrate/v4/cmd/migrate')/bin/migrate" /usr/local/bin/

FROM alpine:latest AS tools

RUN apk add --no-cache libstdc++

COPY --from=build-tools /usr/local/bin/migrate /var/app/db/seed/build/seed /usr/local/bin/
COPY db/migrations/ /migrations/

CMD [ "sh", "-c", "migrate -database pgx5://: -path /migrations up && seed" ]

FROM alpine:latest AS go

WORKDIR /var/app/
COPY --from=build-go /usr/local/bin/api /usr/local/bin/
COPY --from=build-go /var/app/apps/go/docs/swagger.json docs/

EXPOSE 3001
CMD [ "api" ]

FROM alpine:latest AS js

RUN apk add --no-cache libstdc++

COPY --from=build-js /var/app/apps/js/build/index /usr/local/bin/js

EXPOSE 3002
CMD [ "js" ]
