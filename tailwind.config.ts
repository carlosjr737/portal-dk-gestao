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

        /*
         * Tons semânticos. Nomeados pelo SIGNIFICADO, nunca pela cor: quem
         * escreve `tone="danger"` não decide qual vermelho, e o dia em que o
         * vermelho mudar, muda em todo lugar.
         */
        info: {
          DEFAULT: "hsl(var(--info))",
          fg: "hsl(var(--info-fg))",
          tint: "hsl(var(--info-tint))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          fg: "hsl(var(--success-fg))",
          tint: "hsl(var(--success-tint))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          fg: "hsl(var(--warning-fg))",
          tint: "hsl(var(--warning-tint))",
        },
        danger: {
          DEFAULT: "hsl(var(--danger))",
          fg: "hsl(var(--danger-fg))",
          tint: "hsl(var(--danger-tint))",
        },
      },
      fontFamily: {
        // `font-sans` passa a resolver para a Inter carregada no layout.
        // A pilha de sistema fica de reserva enquanto a fonte carrega.
        sans: [
          "var(--font-sans)",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Helvetica",
          "Arial",
          "sans-serif",
        ],
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
