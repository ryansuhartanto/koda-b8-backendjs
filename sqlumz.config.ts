import { defineConfig } from "sqlumz";

const config: ReturnType<typeof defineConfig> = defineConfig({
	sequelize: {
		dialect: "postgres",
	},
	naming: "sequence",
	path: {
		migrations: "db/migrations",
		seeds: "db/seeds",
	},
});

export default config;
