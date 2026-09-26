"use client";

import { Button } from "@/components/ui/button";
import { expandUiColor, isUiColor } from "@/lib/plugin-ui";
import { PluginUiSection, PluginUiValues } from "@/types/plugins/ui";
import { IconZoomIn, IconZoomOut, IconZoomReset } from "@tabler/icons-react";
import { ReactNode, useCallback, useEffect, useRef, useState } from "react";

/*
 * Approximate preview of a plugin's in-game UI on a 320x180 manialink screen.
 * The geometry mirrors the manialink templates, fonts and text sizes are approximations.
 * Coordinates are manialink coordinates: y goes up, elements are positioned by their top left corner.
 */

type Ui = PluginUiValues;

// Rough height of one textsize unit in manialink units
const TEXT_SCALE = 2.25;

const FONT_STYLES: Record<string, { family: string; weight: number }> = {
  GameFontRegular: { family: "inherit", weight: 400 },
  GameFontSemiBold: { family: "inherit", weight: 600 },
  GameFontBlack: { family: "inherit", weight: 900 },
  Oswald: { family: "Oswald, 'Arial Narrow', sans-serif", weight: 500 },
  OswaldMono: { family: "Oswald, monospace", weight: 500 },
  RajdhaniMono: { family: "Rajdhani, monospace", weight: 500 },
  RobotoCondensed: {
    family: "'Roboto Condensed', 'Arial Narrow', sans-serif",
    weight: 400,
  },
  RobotoCondensedBold: {
    family: "'Roboto Condensed', 'Arial Narrow', sans-serif",
    weight: 700,
  },
  "Nadeo/Trackmania/BebasNeueRegular": {
    family: "'Bebas Neue', Impact, sans-serif",
    weight: 400,
  },
};

const NAMES = [
  "Racer",
  "Speedy",
  "Drifter",
  "Apex",
  "Turbo",
  "Glider",
  "Boost",
  "Nitro",
  "Slipstream",
  "Nosebug",
];

function num(ui: Ui, section: PluginUiSection, key: string, fallback: number) {
  const value = ui[section]?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function text(ui: Ui, section: PluginUiSection, key: string, fallback = "") {
  const value = ui[section]?.[key];
  return typeof value === "string" ? value : fallback;
}

function color(ui: Ui, key: string, fallback: string) {
  const value = ui.colors?.[key];
  return `#${expandUiColor(typeof value === "string" && isUiColor(value) ? value : fallback)}`;
}

function Rect({
  x,
  y,
  w,
  h,
  fill,
  opacity = 1,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  fill: string;
  opacity?: number;
}) {
  return (
    <rect
      x={x}
      y={-y}
      width={Math.max(0, w)}
      height={Math.max(0, h)}
      fill={fill}
      fillOpacity={opacity}
    />
  );
}

function Label({
  x,
  y,
  size,
  fill,
  font = "GameFontRegular",
  halign = "left",
  valign = "center",
  italic = false,
  children,
}: {
  x: number;
  y: number;
  size: number;
  fill: string;
  font?: string;
  halign?: "left" | "center" | "right";
  valign?: "top" | "center" | "bottom";
  italic?: boolean;
  children: ReactNode;
}) {
  const style = FONT_STYLES[font] ?? FONT_STYLES.GameFontRegular;
  return (
    <text
      x={x}
      y={-y}
      fontSize={Math.max(0, size) * TEXT_SCALE}
      fill={fill}
      fontFamily={style.family}
      fontWeight={style.weight}
      fontStyle={italic ? "italic" : undefined}
      textAnchor={
        halign === "center" ? "middle" : halign === "right" ? "end" : "start"
      }
      dominantBaseline={
        valign === "center"
          ? "central"
          : valign === "top"
            ? "text-before-edge"
            : "text-after-edge"
      }
    >
      {children}
    </text>
  );
}

function Flag({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <Rect x={x} y={y} w={4.5} h={1} fill="#AE1C28" />
      <Rect x={x} y={y - 1} w={4.5} h={1} fill="#FFFFFF" />
      <Rect x={x} y={y - 2} w={4.5} h={1} fill="#21468B" />
    </g>
  );
}

const labelY = (height: number) => 0.25 - height / 2;

type Rendered = {
  content: ReactNode;
  width: number;
  height: number;
  /** Fixed position, for windows that are centered on the screen */
  position?: { x: number; y: number };
};

function Header({ ui, width }: { ui: Ui; width: number }) {
  const height = num(ui, "spacing", "headerHeight", 5);
  return (
    <>
      <Rect
        x={0}
        y={0}
        w={width}
        h={height}
        fill={color(ui, "headerBackground", "222")}
        opacity={num(ui, "colors", "headerOpacity", 1)}
      />
      <Label
        x={width / 2}
        y={labelY(height)}
        size={num(ui, "textSizes", "title", 1)}
        fill={color(ui, "headerText", "FFF")}
        font={text(ui, "fonts", "title")}
        halign="center"
      >
        {text(ui, "texts", "title")}
      </Label>
    </>
  );
}

type ListKind =
  | "ta-leaderboard"
  | "live-ranking"
  | "ta-active-runs"
  | "live-round";

function renderList(ui: Ui, kind: ListKind): Rendered {
  const W = num(ui, "layout", "width", 55);
  const H = num(ui, "spacing", "headerHeight", 5);
  const h = num(ui, "spacing", "rowHeight", 5);
  const g = num(ui, "spacing", "rowGap", 0.25);
  const rows = kind === "live-round" ? 8 : num(ui, "layout", "visibleRows", 8);

  const accent = color(ui, "accentBackground", "222");
  const accentOpacity = num(ui, "colors", "accentOpacity", 1);
  const accentText = color(ui, "accentText", "DDD");
  const row = color(ui, "rowBackground", "DDD");
  const rowOpacity = num(ui, "colors", "rowOpacity", 1);
  const rowText = color(ui, "rowText", "222");
  const secondary = color(ui, "secondaryBackground", "BBB");
  const secondaryText = color(ui, "secondaryText", "222");
  const size = (key: string, fallback: number) =>
    num(ui, "textSizes", key, fallback);
  const font = (key: string) => text(ui, "fonts", key);
  const y = labelY(h);
  const hasRank = kind !== "ta-active-runs";
  const hasTimeColumn = kind === "ta-active-runs" || kind === "live-round";

  const content = (
    <>
      <Header ui={ui} width={W} />
      {Array.from({ length: rows }, (_, i) => {
        const top = -(H + g) - i * (h + g);
        const name = NAMES[i % NAMES.length];
        const millis = String(123 + i * 71).slice(-3);
        // Live round shows the gap to the leader, active runs the current time
        const time =
          kind === "live-round" && i > 0
            ? `+0:0${i}.${millis}`
            : `0:${String(12 + i * 3).padStart(2, "0")}.${millis}`;
        return (
          <g key={i} transform={`translate(0 ${-top})`}>
            {hasRank && (
              <>
                <Rect
                  x={0}
                  y={0}
                  w={h}
                  h={h}
                  fill={accent}
                  opacity={accentOpacity}
                />
                <Label
                  x={h / 2 - 0.1}
                  y={y}
                  size={size("accent", 1.25)}
                  fill={accentText}
                  font={font("accent")}
                  halign="center"
                >
                  {i + 1}
                </Label>
              </>
            )}
            <Rect
              x={hasRank ? h : 0}
              y={0}
              w={W - (hasRank ? h : 0) - (hasTimeColumn ? 14.5 : 0)}
              h={h}
              fill={row}
              opacity={rowOpacity}
            />
            {hasTimeColumn && (
              <Rect
                x={W - 14.5}
                y={0}
                w={14.5}
                h={h}
                fill={secondary}
                opacity={rowOpacity}
              />
            )}
            <Flag x={(hasRank ? h : 0) + 1.25} y={1.5 - h / 2} />
            <Label
              x={(hasRank ? h : 0) + 7}
              y={y}
              size={size("name", 1.2)}
              fill={rowText}
              font={font("name")}
            >
              {name}
            </Label>
            {kind === "ta-leaderboard" && (
              <Label
                x={W - 2}
                y={y}
                size={size("time", 1)}
                fill={rowText}
                font={font("time")}
                halign="right"
              >
                {`0:${String(40 + i).padStart(2, "0")}.${String(123 + i * 71).slice(-3)}`}
              </Label>
            )}
            {kind === "live-ranking" && (
              <Label
                x={W - 2}
                y={y}
                size={size("points", 1)}
                fill={rowText}
                font={font("points")}
                halign="right"
              >
                {Math.max(0, 50 - i * 5)}
              </Label>
            )}
            {kind === "ta-active-runs" && (
              <Label
                x={W - 15.25}
                y={y}
                size={size("checkpoint", 1)}
                fill={rowText}
                font={font("checkpoint")}
                halign="right"
              >
                {Math.max(1, 9 - i)}
              </Label>
            )}
            {kind === "live-round" && (
              <Label
                x={W - 15.25}
                y={y}
                size={size("points", 1)}
                fill={rowText}
                font={font("points")}
                halign="right"
              >
                {Math.max(0, 30 - i * 3)}
              </Label>
            )}
            {hasTimeColumn && (
              <Label
                x={W - 1}
                y={y}
                size={size("time", 1)}
                fill={secondaryText}
                font={font("time")}
                halign="right"
              >
                {time}
              </Label>
            )}
          </g>
        );
      })}
    </>
  );

  return { content, width: W, height: H + g + rows * (h + g) };
}

function renderRecordsInfo(ui: Ui): Rendered {
  const W = num(ui, "layout", "width", 55);
  const h = num(ui, "spacing", "rowHeight", 5);
  const g = num(ui, "spacing", "rowGap", 0.25);
  const y = labelY(h);

  const content = [
    ["WR", "Speedy", "0:41.203"],
    ["LR", "Racer", "0:42.588"],
  ].map(([tag, name, time], i) => (
    <g key={tag} transform={`translate(0 ${i * (h + g)})`}>
      <Rect
        x={0}
        y={0}
        w={10}
        h={h}
        fill={color(ui, "accentBackground", "222")}
        opacity={num(ui, "colors", "accentOpacity", 1)}
      />
      <Rect
        x={10}
        y={0}
        w={W - 10}
        h={h}
        fill={color(ui, "rowBackground", "DDD")}
        opacity={num(ui, "colors", "rowOpacity", 1)}
      />
      <Label
        x={5}
        y={y}
        size={num(ui, "textSizes", "accent", 1)}
        fill={color(ui, "accentText", "DDD")}
        font={text(ui, "fonts", "accent")}
        halign="center"
      >
        {tag}
      </Label>
      <Label
        x={11.5}
        y={y}
        size={num(ui, "textSizes", "name", 1)}
        fill={color(ui, "rowText", "222")}
        font={text(ui, "fonts", "name")}
        italic
      >
        {name}
      </Label>
      <Label
        x={W - 2}
        y={y}
        size={num(ui, "textSizes", "time", 1)}
        fill={color(ui, "rowText", "222")}
        font={text(ui, "fonts", "time")}
        halign="right"
      >
        {time}
      </Label>
    </g>
  ));

  return { content, width: W, height: 2 * h + g };
}

function renderMapInfo(ui: Ui): Rendered {
  const W = num(ui, "layout", "width", 55);
  const H = num(ui, "layout", "height", 10);
  const accentText = color(ui, "accentText", "DDD");
  const icon = num(ui, "textSizes", "icon", 2.5) * TEXT_SCALE * 0.5;

  const content = (
    <>
      <Rect
        x={0}
        y={0}
        w={H}
        h={H}
        fill={color(ui, "accentBackground", "222")}
        opacity={num(ui, "colors", "accentOpacity", 1)}
      />
      <Rect
        x={H}
        y={0}
        w={W - H}
        h={H}
        fill={color(ui, "rowBackground", "DDD")}
        opacity={num(ui, "colors", "rowOpacity", 1)}
      />
      <path
        d={`M ${H / 2 - icon} ${H / 2 - icon * 0.7} l ${icon * 0.66} -${icon * 0.3} l ${icon * 0.67} ${icon * 0.3} l ${icon * 0.67} -${icon * 0.3} v ${icon * 1.7} l -${icon * 0.67} ${icon * 0.3} l -${icon * 0.67} -${icon * 0.3} l -${icon * 0.66} ${icon * 0.3} z`}
        fill="none"
        stroke={accentText}
        strokeWidth={0.4}
        strokeLinejoin="round"
      />
      <Label
        x={H + 2}
        y={-0.25 - H / 2}
        size={num(ui, "textSizes", "name", 1.75)}
        fill={color(ui, "rowText", "222")}
        font={text(ui, "fonts", "name")}
        valign="bottom"
      >
        Summer 2026 - 01
      </Label>
      <Label
        x={H + 1.75}
        y={-0.5 - H / 2}
        size={num(ui, "textSizes", "author", 1)}
        fill={color(ui, "authorText", "222")}
        font={text(ui, "fonts", "author")}
        valign="top"
        italic
      >
        Nadeo
      </Label>
    </>
  );

  return { content, width: W, height: H };
}

function renderPlayerInfo(ui: Ui): Rendered {
  const W = num(ui, "layout", "width", 55);
  const N = num(ui, "spacing", "nameHeight", 7);
  const S = num(ui, "spacing", "sectionGap", 1);
  const HH = num(ui, "spacing", "headerHeight", 5);
  const h = num(ui, "spacing", "rowHeight", 8);
  const g = num(ui, "spacing", "rowGap", 0.25);
  const C = W / 2;
  const accent = color(ui, "accentBackground", "222");
  const accentOpacity = num(ui, "colors", "accentOpacity", 1);
  const accentText = color(ui, "accentText", "DDD");
  const row = color(ui, "rowBackground", "DDD");
  const rowOpacity = num(ui, "colors", "rowOpacity", 1);
  const rowText = color(ui, "rowText", "222");

  const cells = (top: number, items: [string, string][]) =>
    items.map(([tag, value], column) => {
      const x = column * C;
      return (
        <g key={`${top}-${tag}`} transform={`translate(${x} ${-top})`}>
          <Rect x={0} y={0} w={h} h={h} fill={accent} opacity={accentOpacity} />
          <Rect x={h} y={0} w={C - h} h={h} fill={row} opacity={rowOpacity} />
          <Label
            x={h / 2}
            y={labelY(h)}
            size={num(ui, "textSizes", "accent", 1.5)}
            fill={accentText}
            font={text(ui, "fonts", "accent")}
            halign="center"
          >
            {tag}
          </Label>
          <Label
            x={(C + h) / 2}
            y={labelY(h)}
            size={num(ui, "textSizes", "value", 1.5)}
            fill={rowText}
            font={text(ui, "fonts", "value")}
            halign="center"
          >
            {value}
          </Label>
        </g>
      );
    });

  const recordsTop = -(N + S + HH + g);
  const content = (
    <>
      <Rect x={0} y={0} w={N} h={N} fill={accent} opacity={accentOpacity} />
      <Rect x={N} y={0} w={W - N} h={N} fill={row} opacity={rowOpacity} />
      <Flag x={N / 2 - 2.25} y={1.5 - N / 2} />
      <Label
        x={N + 1.5}
        y={labelY(N)}
        size={num(ui, "textSizes", "name", 2)}
        fill={rowText}
        font={text(ui, "fonts", "name")}
      >
        Racer
      </Label>
      <g transform={`translate(0 ${N + S})`}>
        <Header ui={ui} width={W} />
      </g>
      {cells(recordsTop, [
        ["PB", "0:42.588"],
        ["LR", "0:41.921"],
      ])}
      {cells(recordsTop - h - g, [
        ["D", "Keyboard"],
        ["C", "Cam 1"],
      ])}
    </>
  );

  return { content, width: W, height: N + S + HH + g + 2 * h + g };
}

function renderNotifyAdmin(ui: Ui): Rendered {
  const W = num(ui, "layout", "width", 36);
  const H = num(ui, "layout", "height", 8);

  const content = (
    <>
      <Rect
        x={0}
        y={0}
        w={W}
        h={H}
        fill={color(ui, "rowBackground", "DDD")}
        opacity={num(ui, "colors", "rowOpacity", 1)}
      />
      <Rect
        x={0}
        y={-H}
        w={W}
        h={0.5}
        fill={color(ui, "accentBackground", "222")}
      />
      <Label
        x={W / 2}
        y={labelY(H)}
        size={num(ui, "textSizes", "label", 2)}
        fill={color(ui, "rowText", "222")}
        font={text(ui, "fonts", "label")}
        halign="center"
      >
        {text(ui, "texts", "label")}
      </Label>
    </>
  );

  return { content, width: W, height: H + 0.5 };
}

function renderPickBan(ui: Ui): Rendered {
  const maps = 5;
  const headerText = color(ui, "headerText", "DDD");
  const rowText = color(ui, "rowText", "222");
  const rowOpacity = num(ui, "colors", "rowOpacity", 1);
  const size = (key: string, fallback: number) =>
    num(ui, "textSizes", key, fallback);
  const font = (key: string) => text(ui, "fonts", key);

  const content = (
    <>
      <Rect
        x={0}
        y={0}
        w={120}
        h={10}
        fill={color(ui, "headerBackground", "222")}
        opacity={num(ui, "colors", "headerOpacity", 1)}
      />
      <Label
        x={12}
        y={-4.75}
        size={size("header", 1.75)}
        fill={headerText}
        font={font("header")}
      >
        {`Racer ${text(ui, "texts", "picking")}`}
      </Label>
      <Label
        x={115}
        y={-4.75}
        size={size("header", 1.75)}
        fill={headerText}
        font={font("header")}
        halign="right"
      >
        0:25
      </Label>
      <Rect
        x={0}
        y={-9}
        w={72}
        h={1}
        fill={color(ui, "progressBar", "DDD")}
        opacity={0.9}
      />
      <Rect
        x={0}
        y={-10}
        w={120}
        h={maps * 11.5 + 9}
        fill={color(ui, "backdrop", "222")}
        opacity={num(ui, "colors", "backdropOpacity", 0.75)}
      />
      {Array.from({ length: maps }, (_, i) => {
        const picked = i === 0;
        const banned = i === 1;
        const selected = i === 2;
        const status = picked
          ? `${text(ui, "texts", "pickedBy")} Racer`
          : banned
            ? `${text(ui, "texts", "bannedBy")} Speedy`
            : "";
        return (
          <g
            key={i}
            transform={`translate(${picked ? 15 : 5} ${15 + i * 11.5})`}
          >
            <Rect
              x={0}
              y={0}
              w={10}
              h={10}
              fill={color(ui, "accentBackground", "222")}
              opacity={num(ui, "colors", "accentOpacity", 1)}
            />
            <Rect
              x={10}
              y={0}
              w={90}
              h={10}
              fill={
                selected
                  ? color(ui, "highlightBackground", "999")
                  : color(ui, "rowBackground", "DDD")
              }
              opacity={banned ? 0.7 * rowOpacity : rowOpacity}
            />
            {picked && (
              <Label
                x={5}
                y={-4.5}
                size={size("accent", 3)}
                fill={color(ui, "accentText", "DDD")}
                font={font("accent")}
                halign="center"
              >
                1
              </Label>
            )}
            <Label
              x={12}
              y={-5.25}
              size={size("name", 1.75)}
              fill={rowText}
              font={font("name")}
              valign="bottom"
            >
              {`Map ${i + 1}`}
            </Label>
            <Label
              x={11.75}
              y={-5.5}
              size={size("author", 1)}
              fill={rowText}
              font={font("author")}
              valign="top"
              italic
            >
              Author
            </Label>
            <Label
              x={95}
              y={-4.75}
              size={size("status", 1.75)}
              fill={rowText}
              font={font("status")}
              halign="right"
            >
              {status}
            </Label>
          </g>
        );
      })}
    </>
  );

  return { content, width: 120, height: 10 + maps * 11.5 + 9 };
}

function renderEcmWindow(ui: Ui): Rendered {
  const textColor = color(ui, "text", "222");
  const button = color(ui, "buttonBackground", "CCC");
  const underline = color(ui, "buttonAccent", "222");
  const textSize = num(ui, "textSizes", "text", 1);
  const labelSize = num(ui, "textSizes", "label", 0.6);
  const font = text(ui, "fonts", "text");
  const labelFont = text(ui, "fonts", "label");

  const Button = ({
    x,
    y,
    w,
    children,
  }: {
    x: number;
    y: number;
    w: number;
    children: ReactNode;
  }) => (
    <>
      <Rect x={x} y={y} w={w} h={5} fill={button} />
      <Rect x={x} y={y - 4.75} w={w} h={0.25} fill={underline} />
      <Label
        x={x + w / 2}
        y={y - 2.25}
        size={textSize}
        fill={textColor}
        font={font}
        halign="center"
      >
        {children}
      </Label>
    </>
  );

  const content = (
    <>
      <Rect
        x={0}
        y={0}
        w={54}
        h={5}
        fill={color(ui, "windowHeaderBackground", "222")}
      />
      <Label
        x={1.5}
        y={-2.25}
        size={1}
        fill={color(ui, "windowHeaderText", "FFF")}
        font="GameFontSemiBold"
      >
        eCircuitMania
      </Label>
      <Rect
        x={0}
        y={-5}
        w={54}
        h={32.5}
        fill={color(ui, "windowBackground", "DDD")}
      />
      <g transform="translate(2 7)">
        <circle cx={0.8} cy={2.25} r={0.8} fill={color(ui, "error", "D22")} />
        <Label x={3.5} y={-2.25} size={textSize} fill={textColor} font={font}>
          Not Recording
        </Label>
        <Button x={25} y={0} w={25}>
          Start recording
        </Button>
        <Label
          x={0}
          y={-8.25}
          size={labelSize}
          fill={textColor}
          font={labelFont}
        >
          API Key
        </Label>
        <Rect x={0} y={-10.5} w={32} h={4.5} fill={button} />
        <Rect x={0} y={-15.25} w={37} h={0.25} fill={underline} />
        <Button x={38} y={-10.5} w={12}>
          Save
        </Button>
        <Label
          x={0}
          y={-21.25}
          size={labelSize}
          fill={textColor}
          font={labelFont}
        >
          Round info
        </Label>
        <Label x={0} y={-25.75} size={textSize} fill={textColor} font={font}>
          Round 3
        </Label>
        <Button x={14} y={-23.5} w={5}>
          -
        </Button>
        <Button x={20} y={-23.5} w={5}>
          +
        </Button>
      </g>
    </>
  );

  // The window template centers the body, the header sits on top of it
  return { content, width: 54, height: 37.5, position: { x: -27, y: 16.25 } };
}

function renderPlugin(pluginName: string, ui: Ui): Rendered | null {
  switch (pluginName) {
    case "ta-leaderboard":
    case "live-ranking":
    case "ta-active-runs":
    case "live-round":
      return renderList(ui, pluginName);
    case "records-info":
      return renderRecordsInfo(ui);
    case "map-info":
      return renderMapInfo(ui);
    case "player-info":
      return renderPlayerInfo(ui);
    case "admin":
      return renderNotifyAdmin(ui);
    case "match":
      return renderPickBan(ui);
    case "ecm":
      return renderEcmWindow(ui);
    default:
      return null;
  }
}

// The preview's own zoom, independent of the widget's "scale" UI field —
// 1x shows the full 320x180 manialink screen (the previous, only, view).
const MIN_ZOOM = 1;
const MAX_ZOOM = 8;
const clamp = (value: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, value));

export default function PluginUiPreview({
  pluginName,
  ui,
  onMove,
}: {
  pluginName: string;
  ui: Ui;
  onMove?: (x: number, y: number) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<{
    pointerX: number;
    pointerY: number;
    x: number;
    y: number;
  } | null>(null);
  const pan = useRef<{
    pointerId: number;
    clientX: number;
    clientY: number;
    cx: number;
    cy: number;
  } | null>(null);

  // The centre of the view, in the same -160..160 / -90..90 manialink
  // space as everything else here; zoom shrinks how much of it is shown.
  const [view, setView] = useState({ zoom: 1, cx: 0, cy: 0 });
  const viewW = 320 / view.zoom;
  const viewH = 180 / view.zoom;
  const viewX = view.cx - viewW / 2;
  const viewY = view.cy - viewH / 2;

  const rendered = renderPlugin(pluginName, ui);

  // Keeps the point under the cursor/pinch-centre fixed while the zoom
  // changes — the standard "zoom to point" trick, computed from the
  // element's own rendered box rather than getScreenCTM so it works out
  // to the same view whatever the current viewBox already is.
  const zoomAt = useCallback((clientX: number, clientY: number, factor: number) => {
    const box = svgRef.current?.getBoundingClientRect();
    if (!box) return;
    const fx = (clientX - box.left) / box.width;
    const fy = (clientY - box.top) / box.height;
    setView((prev) => {
      const nextZoom = clamp(prev.zoom * factor, MIN_ZOOM, MAX_ZOOM);
      if (nextZoom === prev.zoom) return prev;
      const prevW = 320 / prev.zoom;
      const prevH = 180 / prev.zoom;
      const curX = prev.cx - prevW / 2 + fx * prevW;
      const curY = prev.cy - prevH / 2 + fy * prevH;
      const nextW = 320 / nextZoom;
      const nextH = 180 / nextZoom;
      return {
        zoom: nextZoom,
        cx: clamp(curX - fx * nextW + nextW / 2, -160, 160),
        cy: clamp(curY - fy * nextH + nextH / 2, -90, 90),
      };
    });
  }, []);
  const resetView = useCallback(() => setView({ zoom: 1, cx: 0, cy: 0 }), []);

  // A React onWheel handler can't preventDefault (passive by default), so
  // the page would scroll along with the zoom; a manually-attached
  // listener can opt out of that.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      zoomAt(e.clientX, e.clientY, e.deltaY < 0 ? 1.2 : 1 / 1.2);
    };
    svg.addEventListener("wheel", onWheel, { passive: false });
    return () => svg.removeEventListener("wheel", onWheel);
  }, [zoomAt]);

  if (!rendered) return null;

  const x = rendered.position?.x ?? num(ui, "layout", "x", 0);
  const y = rendered.position?.y ?? num(ui, "layout", "y", 0);
  // Values can be temporarily out of range while typing
  const scale = Math.max(0.05, num(ui, "layout", "scale", 1));
  const draggable = !rendered.position && !!onMove;

  const toScreen = (e: React.PointerEvent) => {
    const matrix = svgRef.current?.getScreenCTM()?.inverse();
    if (!matrix) return null;
    return new DOMPoint(e.clientX, e.clientY).matrixTransform(matrix);
  };

  const handlePointerDown = (e: React.PointerEvent<SVGRectElement>) => {
    // Keep the background pan below from also starting on this pointer.
    e.stopPropagation();
    const point = toScreen(e);
    if (!point) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { pointerX: point.x, pointerY: point.y, x, y };
  };

  const handlePointerMove = (e: React.PointerEvent<SVGRectElement>) => {
    e.stopPropagation();
    const point = toScreen(e);
    if (!drag.current || !point || !onMove) return;
    const round = (value: number) => Math.round(value * 2) / 2;
    onMove(
      round(drag.current.x + point.x - drag.current.pointerX),
      // Screen y goes down, manialink y goes up
      round(drag.current.y - (point.y - drag.current.pointerY)),
    );
  };

  const handlePointerUp = (e: React.PointerEvent<SVGRectElement>) => {
    e.stopPropagation();
    drag.current = null;
  };

  // Drag-to-pan on the background (anywhere that isn't the widget's own
  // drag rect, which stops propagation before this ever sees the event).
  const handleBackgroundPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    pan.current = {
      pointerId: e.pointerId,
      clientX: e.clientX,
      clientY: e.clientY,
      cx: view.cx,
      cy: view.cy,
    };
  };

  const handleBackgroundPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const started = pan.current;
    const box = svgRef.current?.getBoundingClientRect();
    if (!started || started.pointerId !== e.pointerId || !box) return;
    const dx = ((e.clientX - started.clientX) / box.width) * viewW;
    const dy = ((e.clientY - started.clientY) / box.height) * viewH;
    setView((prev) => ({
      ...prev,
      cx: clamp(started.cx - dx, -160, 160),
      cy: clamp(started.cy - dy, -90, 90),
    }));
  };

  const handleBackgroundPointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    if (pan.current?.pointerId === e.pointerId) pan.current = null;
  };

  return (
    <div className="flex flex-col gap-1">
      <div className="relative">
        <svg
          ref={svgRef}
          viewBox={`${viewX} ${viewY} ${viewW} ${viewH}`}
          className="aspect-video w-full touch-none select-none rounded-md border bg-gradient-to-b from-slate-700 via-slate-800 to-zinc-900"
          style={{ cursor: view.zoom > MIN_ZOOM ? "grab" : undefined }}
          role="img"
          aria-label="Preview of the in-game UI"
          onPointerDown={handleBackgroundPointerDown}
          onPointerMove={handleBackgroundPointerMove}
          onPointerUp={handleBackgroundPointerUp}
          onPointerCancel={handleBackgroundPointerUp}
        >
          <line
            x1={-160}
            y1={0}
            x2={160}
            y2={0}
            stroke="#FFFFFF"
            strokeOpacity={0.06}
            strokeWidth={0.4}
          />
          <line
            x1={0}
            y1={-90}
            x2={0}
            y2={90}
            stroke="#FFFFFF"
            strokeOpacity={0.06}
            strokeWidth={0.4}
          />
          <g transform={`translate(${x} ${-y}) scale(${scale})`}>
            {rendered.content}
            {draggable && (
              <rect
                x={0}
                y={0}
                width={rendered.width}
                height={rendered.height}
                fill="transparent"
                stroke="#FFFFFF"
                strokeOpacity={0.35}
                strokeDasharray="1.5 1"
                strokeWidth={0.4 / scale}
                className="cursor-move"
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
              />
            )}
          </g>
        </svg>

        <div className="absolute right-2 top-2 flex gap-1">
          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="size-7"
            title="Zoom out"
            aria-label="Zoom out"
            disabled={view.zoom <= MIN_ZOOM}
            onClick={() => {
              const box = svgRef.current?.getBoundingClientRect();
              zoomAt(
                (box?.left ?? 0) + (box?.width ?? 0) / 2,
                (box?.top ?? 0) + (box?.height ?? 0) / 2,
                1 / 1.5,
              );
            }}
          >
            <IconZoomOut className="size-4" />
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="size-7"
            title="Zoom in"
            aria-label="Zoom in"
            disabled={view.zoom >= MAX_ZOOM}
            onClick={() => {
              const box = svgRef.current?.getBoundingClientRect();
              zoomAt(
                (box?.left ?? 0) + (box?.width ?? 0) / 2,
                (box?.top ?? 0) + (box?.height ?? 0) / 2,
                1.5,
              );
            }}
          >
            <IconZoomIn className="size-4" />
          </Button>
          {view.zoom > MIN_ZOOM && (
            <Button
              type="button"
              variant="secondary"
              size="icon"
              className="size-7"
              title="Reset zoom"
              aria-label="Reset zoom"
              onClick={resetView}
            >
              <IconZoomReset className="size-4" />
            </Button>
          )}
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Approximate preview, fonts and text sizes can differ in game. Scroll
        or use the buttons to zoom, drag the background to pan.
        {draggable && " Drag the widget to change its position."}
      </p>
    </div>
  );
}
