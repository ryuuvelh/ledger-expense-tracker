"use client";

import { COLOR_PALETTE } from "@/lib/colorPalette";

export default function ColorPalettePicker(props: {
  value: string;
  onChange: (color: string) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-8 gap-2">
        {COLOR_PALETTE.map((color) => {
          const selected = props.value.toLowerCase() === color.toLowerCase();
          return (
            <button
              key={color}
              type="button"
              onClick={() => props.onChange(color)}
              className={[
                "h-7 w-7 rounded-full border-2 transition-transform",
                selected
                  ? "scale-110 border-primary ring-2 ring-primary/30"
                  : "border-transparent hover:scale-105",
              ].join(" ")}
              style={{ backgroundColor: color }}
              aria-label={`Select color ${color}`}
              aria-pressed={selected}
            />
          );
        })}
      </div>
      <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
        <span
          className="h-3 w-3 rounded-full border border-border"
          style={{ backgroundColor: props.value }}
        />
        {props.value}
      </div>
    </div>
  );
}
