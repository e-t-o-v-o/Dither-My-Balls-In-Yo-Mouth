import React, { useState } from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { PaletteBrowser } from "./PaletteBrowser";
import { paletteCatalog, palettes } from "./palettes";
import { ColorControls } from "./Controls";
import { defaults, sanitizeConfig, looks } from "./model";

test("every palette exposes every color, with no hidden dropdown or shortened variants", () => {
  render(<PaletteBrowser value="Paper" onChange={() => {}} />);
  const group = screen.getByRole("group", { name: "Palette", exact: true });
  expect(within(group).getAllByRole("radio")).toHaveLength(paletteCatalog.length);
  expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  for (const { name, colors } of paletteCatalog) {
    const option = within(group).getByRole("radio", { name, exact: true });
    expect(option.closest("label").querySelectorAll(".swatches i")).toHaveLength(colors.length);
    expect(new Set(colors).size).toBe(colors.length);
    expect(colors.every(color => /^#[\da-f]{6}$/.test(color))).toBe(true);
  }
  expect(new Set(paletteCatalog.map(item => item.name)).size).toBe(paletteCatalog.length);
  expect(palettes["Ocean Breeze"]).toHaveLength(7);
  expect(palettes["Loom textile"]).toHaveLength(10);
  expect(palettes["Toner red"]).toHaveLength(3);
});

test("search reveals matching colors, selection survives clearing, and an empty search can recover", () => {
  function Harness() {
    const [value, setValue] = useState("Paper");
    return <PaletteBrowser value={value} onChange={setValue} />;
  }
  render(<Harness />);
  const search = screen.getByRole("searchbox", { name: "Search palettes" });
  fireEvent.change(search, { target: { value: "prussian clay" } });
  expect(screen.getAllByRole("radio")).toHaveLength(1);
  fireEvent.click(screen.getByRole("radio", { name: "Terracotta tide" }));
  fireEvent.click(screen.getByRole("button", { name: "Clear" }));
  expect(screen.getByRole("radio", { name: "Terracotta tide" })).toBeChecked();
  expect(screen.getAllByRole("radio")).toHaveLength(paletteCatalog.length);
  fireEvent.change(search, { target: { value: "no-such-color" } });
  expect(screen.getByText(/No matching palettes/)).toBeInTheDocument();
  expect(screen.getByLabelText("Terracotta tide colors")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Clear" }));
  expect(screen.getByRole("radio", { name: "Terracotta tide" })).toBeChecked();
});

test("effect and echo palettes have independent visual choices", () => {
  const set = vi.fn();
  render(<ColorControls config={{ ...defaults, echoCount: 2 }} set={set} motion echoes />);
  const effect = screen.getByRole("group", { name: "Palette", exact: true });
  const echo = screen.getByRole("group", { name: "Echo palette", exact: true });
  fireEvent.click(within(effect).getByRole("radio", { name: "Moss rose" }));
  expect(set).toHaveBeenLastCalledWith("palette", "Moss rose");
  fireEvent.click(within(echo).getByRole("radio", { name: "Indigo wash" }));
  expect(set).toHaveBeenLastCalledWith("echoPalette", "Indigo wash");
});

test("old palette aliases and all built-in looks resolve to the visible catalog", () => {
  expect(sanitizeConfig({ palette: "Default", echoPalette: "Default" })).toMatchObject({ palette: "Decade", echoPalette: "Decade" });
  for (const { config } of looks) {
    expect(Object.hasOwn(palettes, config.palette)).toBe(true);
    expect(Object.hasOwn(palettes, config.echoPalette)).toBe(true);
  }
});
