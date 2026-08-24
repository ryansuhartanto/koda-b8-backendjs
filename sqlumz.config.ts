import { defineConfig } from "sqlumz";

const config: ReturnType<typeof defineConfig> = defineConfig({
	sequelize: {
		dialect: "sqlite3",
	},
	naming: "sequence",
	path: {
		migrations: "db/migrations",
		seeds: "db/seeds",
	},
});

export default config;
