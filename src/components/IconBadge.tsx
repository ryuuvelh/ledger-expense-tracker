import { renderIcon } from "@/lib/iconRegistry";

const DEFAULT_COLOR = "#00d4aa";

export default function IconBadge(props: {
  iconKey: string;
  color?: string;
  size?: number;
  boxSize?: number;
}) {
  const color = props.color || DEFAULT_COLOR;
  const iconSize = props.size ?? 16;
  const box = props.boxSize ?? 32;

  return (
    <div
      className="flex shrink-0 items-center justify-center rounded"
      style={{
        width: box,
        height: box,
        backgroundColor: `${color}20`,
        color,
      }}
    >
      {renderIcon(props.iconKey, iconSize)}
    </div>
  );
}
