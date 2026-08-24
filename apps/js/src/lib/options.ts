import type { Options } from "@sequelize/core";
import { PostgresDialect } from "@sequelize/postgres";

// pg reads PG* from the environment
const options: Options<PostgresDialect> = {
	dialect: PostgresDialect,
};

export default options;
