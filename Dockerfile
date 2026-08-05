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

COPY --parents package.json aube-lock.yaml ./
COPY --parents apps/js/package.json db/seed/package.json ./
RUN mise exec -- aube ci --ignore-scripts

COPY --parents tsconfig.json ./
ENV PATH="/var/app/node_modules/.bin:$PATH"

FROM base AS tools

COPY --parents db/ ./

CMD [ "sh", "-c", "mise exec -- migrate -database pgx5://: -path db/migrations up && mise exec -- aube --dir db/seed run start" ]

FROM base AS go

COPY --parents apps/go/ go.work ./
RUN mise exec -- go -C apps/go build -o /usr/local/bin/api .

WORKDIR /var/app/apps/go/

EXPOSE 3001
CMD [ "api" ]

FROM base AS js

COPY --parents apps/js/ ./

WORKDIR /var/app/apps/js/

EXPOSE 3002
CMD [ "mise", "exec", "--", "node", "src/index.ts" ]
