import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
  {
    files: ["src/components/**/*.{ts,tsx}", "src/pages/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "warn",
        {
          paths: [
            {
              name: "@/integrations/supabase/client",
              message:
                "Route database access through src/services/*. Use hooks that wrap services.",
            },
          ],
        },
      ],
    },
  }
);
