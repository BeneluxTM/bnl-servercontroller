import HandlebarsServer from "handlebars";
import layouts from "handlebars-layouts";
import Handlebars from "handlebars/runtime";
import { expandUiColor, roundUiNumber } from "./plugin-ui";

Handlebars.registerHelper("boolToNum", (value: boolean) => (value ? 1 : 0));

Handlebars.registerHelper("eq", (a, b) => a === b);
HandlebarsServer.registerHelper("eq", (a, b) => a === b);

Handlebars.registerHelper("default", function (value, defaultValue) {
  return value || defaultValue;
});

Handlebars.registerHelper("length", function (array: any[]) {
  return array.length;
});

Handlebars.registerHelper("jsonLength", function (json: string) {
  try {
    return JSON.parse(json || "[]").length;
  } catch {
    return 0;
  }
});

Handlebars.registerHelper("bool", function (value) {
  return value ? "True" : "False";
});

Handlebars.registerHelper(layouts(Handlebars));

Handlebars.registerHelper(
  "range",
  function (from: number, to: number, options: Handlebars.HelperOptions) {
    let out = "";
    for (let i = from; i < to; i++) {
      out += options.fn({ i });
    }
    return out;
  },
);

// Math helpers round their result, so templates never print floating point
// artifacts (5.1 * 3 = 15.299999999999999) or exponents, which manialinks don't accept.
Handlebars.registerHelper("add", function (...args: unknown[]) {
  // The last argument is the Handlebars options object
  return roundUiNumber(
    args.slice(0, -1).reduce<number>((sum, value) => sum + Number(value), 0),
  );
});

Handlebars.registerHelper("subtract", function (a: number, b: number) {
  return roundUiNumber(a - b);
});

Handlebars.registerHelper("multiply", function (a: number, b: number) {
  return roundUiNumber(a * b);
});

Handlebars.registerHelper("divide", function (a: number, b: number) {
  return roundUiNumber(a / b);
});

Handlebars.registerHelper("neg", function (value: number) {
  return roundUiNumber(-value);
});

// Y position of a vertically centered label inside a box of the given height,
// e.g. -2.25 for a row with a height of 5.
Handlebars.registerHelper("labelY", function (height: number) {
  return roundUiNumber(0.25 - height / 2);
});

function toManiaScriptReal(value: number): string {
  const text = String(roundUiNumber(value));
  return text.includes(".") ? text : `${text}.`;
}

// Formats a number as a ManiaScript Real literal, e.g. 42 -> "42."
Handlebars.registerHelper("real", function (value: number) {
  return toManiaScriptReal(value);
});

// Formats a hex color as a ManiaScript Vec3 literal, e.g. "F80" -> "<1., 0.5333, 0.>"
Handlebars.registerHelper("vec3", function (color: string) {
  const hex = expandUiColor(String(color));
  const channels = [0, 2, 4].map((i) =>
    toManiaScriptReal(parseInt(hex.slice(i, i + 2), 16) / 255),
  );
  return new Handlebars.SafeString(`<${channels.join(", ")}>`);
});

export { Handlebars, HandlebarsServer };
