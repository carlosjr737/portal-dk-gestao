import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/features/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      /*
       * As cores viraram objetos com DEFAULT + foreground. As classes antigas
       * não mudam: `bg-primary` sai do DEFAULT e `text-primary-foreground` sai
       * do foreground aninhado, exatamente como antes. O ganho é poder pedir
       * `bg-card`, `bg-secondary` e `bg-destructive` sem inventar hex na tela.
       */
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
          /* Estado de hover do botão primário — cor sólida, não opacidade. */
          hover: "hsl(var(--primary-hover))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        /* Barra lateral e outras áreas de contraste alto. */
        inverse: "hsl(var(--surface-inverse))",
        /*
         * Semânticas com três papéis. `DEFAULT` é PREENCHIMENTO (barra,
         * ponto, ícone), `text` é a variante legível sobre branco e `tint`
         * é o fundo do selo. Usar `text-warning` num rótulo dá 2,29:1 —
         * é para isso que `text-warning-text` existe.
         */
        success: {
          DEFAULT: "hsl(var(--success))",
          text: "hsl(var(--success-text))",
          tint: "hsl(var(--success-tint))",
          strong: "hsl(var(--success-strong))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          text: "hsl(var(--warning-text))",
          tint: "hsl(var(--warning-tint))",
        },
        danger: {
          DEFAULT: "hsl(var(--danger))",
          text: "hsl(var(--danger-text))",
          tint: "hsl(var(--danger-tint))",
        },
        info: {
          DEFAULT: "hsl(var(--info))",
          text: "hsl(var(--info-text))",
          tint: "hsl(var(--info-tint))",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      /*
       * Raio conforme a direção: 8px em campo, botão e chip; 12px em card e
       * painel. Antes era 6px em tudo.
       *
       * `rounded-md` (o que campo e botão usam) vira 8px e `rounded-xl` (o
       * card) vira 12px. Os dois saem do mesmo --radius, então mudam juntos.
       */
      borderRadius: {
        md: "var(--radius)",
        lg: "calc(var(--radius) + 2px)",
        xl: "calc(var(--radius) + 4px)",
      },

      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
