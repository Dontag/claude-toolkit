import { defineConfig } from "astro/config";

// GitHub Pages project site: https://dontag.github.io/claude-toolkit/
export default defineConfig({
  site: "https://dontag.github.io",
  base: "/claude-toolkit",
  trailingSlash: "ignore",
});
