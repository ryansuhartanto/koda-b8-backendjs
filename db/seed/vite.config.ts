import { defineConfig } from "vite-plus";

export default defineConfig({
	pack: {
		entry: ["seed.ts"],
		exe: true,
		deps: { alwaysBundle: /./ },
	},
});
