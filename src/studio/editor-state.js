import { defaults, sanitizeConfig } from "./model";
import { effectDefaults, effectSnapshot } from "./effect-registry";

const snapshot = (state) => ({
  present: state.present,
  trim: state.trim,
  effectSettings: state.effectSettings,
});
export function historyReducer(state, action) {
  if (action.type === "undo" || action.type === "redo") {
    const undo = action.type === "undo",
      from = undo ? state.past : state.future;
    if (!from.length) return state;
    return {
      ...state,
      ...(undo ? from.at(-1) : from[0]),
      group: null,
      past: undo ? from.slice(0, -1) : [...state.past, snapshot(state)],
      future: undo ? [snapshot(state), ...state.future] : from.slice(1),
    };
  }
  if (action.type === "source")
    return { ...state, trim: action.trim, past: [], future: [], group: null };
  if (action.type === "project")
    return {
      present: sanitizeConfig(action.config),
      trim: action.trim,
      effectSettings: action.effectSettings || {},
      past: [],
      future: [],
      group: null,
    };
  let present = state.present,
    trim = state.trim;
  let effectSettings = state.effectSettings || {};
  if (action.type === "trim") trim = action.value;
  else if (action.type === "effect") {
    if (present.effect === action.value) return state;
    effectSettings = {
      ...effectSettings,
      [present.effect]: effectSnapshot(present),
    };
    present = sanitizeConfig({
      ...present,
      ...effectSnapshot(defaults),
      ...(effectSettings[action.value] || effectDefaults[action.value]),
      effect: action.value,
    });
  } else
    present = sanitizeConfig(
      action.config || { ...present, [action.key]: action.value },
    );
  if (
    JSON.stringify(present) === JSON.stringify(state.present) &&
    JSON.stringify(trim) === JSON.stringify(state.trim)
  )
    return state;
  const group = action.type === "trim" ? "trim" : action.key;
  const grouped = group && state.group === group && Date.now() - state.at < 500;
  return {
    past: grouped ? state.past : [...state.past, snapshot(state)].slice(-80),
    present,
    trim,
    effectSettings,
    future: [],
    group,
    at: Date.now(),
  };
}
