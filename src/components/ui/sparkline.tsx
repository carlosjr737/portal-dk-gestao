/**
 * Sparkline.
 *
 * SVG à mão em vez de biblioteca: desenhar uma linha não justifica somar
 * ~50 kB de recharts ao bundle. No dia em que precisar de tooltip ou zoom,
 * aí sim entra biblioteca — e só na tela que precisar.
 *
 * `preserveAspectRatio="none"` estica o traçado na largura do card; por
 * isso a espessura usa `vector-effect="non-scaling-stroke"`, senão a linha
 * afina conforme o container cresce.
 */
type SparklineProps = {
  values: number[];
  /** Cor do traço. Aceita qualquer valor CSS — use um token. */
  color?: string;
  className?: string;
  /** Descrição para leitor de tela. Sem ela o gráfico não existe. */
  label: string;
};

const WIDTH = 140;
const HEIGHT = 36;
const PAD = 3;

export function Sparkline({
  values,
  color = "hsl(var(--primary))",
  className,
  label,
}: SparklineProps) {
  // Menos de dois pontos não é uma linha. Melhor não desenhar nada do que
  // desenhar um traço reto que sugere estabilidade inexistente.
  if (values.length < 2) {
    return null;
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const step = WIDTH / (values.length - 1);

  const points = values.map((value, index) => {
    const x = index * step;
    const y = HEIGHT - PAD - ((value - min) / span) * (HEIGHT - PAD * 2);
    return [x, y] as const;
  });

  const line = points
    .map(([x, y], index) => `${index ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`)
    .join(" ");
  const area = `${line} L${WIDTH},${HEIGHT} L0,${HEIGHT} Z`;
  const last = points[points.length - 1];
  const gradientId = `spark-${label.replace(/\W+/g, "-").toLowerCase()}`;

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className={className}
      preserveAspectRatio="none"
      role="img"
      aria-label={label}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.16" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradientId})`} />
      <path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      <circle cx={last[0].toFixed(1)} cy={last[1].toFixed(1)} r="2.4" fill={color} />
    </svg>
  );
}
