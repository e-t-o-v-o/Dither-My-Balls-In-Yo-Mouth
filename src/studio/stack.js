export const stackEntries = config => config.stack?.length
  ? config.stack : [{ id: "main", enabled: true, mix: 1 }];
export const layerConfig = (config, layer) => layer.id === "main" ? config : layer.settings;
export const activeLayers = config => stackEntries(config).filter(layer => layer.enabled && layer.mix > 0);
export function moveLayer(stack, id, direction) {
  const index = stack.findIndex(layer => layer.id === id), next = index + direction;
  if (index < 0 || next < 0 || next >= stack.length) return stack;
  const ordered = [...stack];
  [ordered[index], ordered[next]] = [ordered[next], ordered[index]];
  return ordered;
}
