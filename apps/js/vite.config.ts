import Raw from "unplugin-raw/rolldown";
import { defineConfig } from "vite-plus";

export default defineConfig({
	pack: {
		plugins: [Raw()],

		entry: ["src/index.ts"],
		deps: { alwaysBundle: /./ },
	},
});
