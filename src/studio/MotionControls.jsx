import React, { useState } from "react";
import { Check, Range, Select } from "./Controls";
import { availableMotionControls, configAtTime } from "./motion";
import { timeLabel } from "./model";

export function MotionControls({ config, set, source, trim, time, seekTo }) {
  const [endpoint, setEndpoint] = useState(0);
  const motion = config.motion;
  const controls = availableMotionControls(config.effect);
  const active = controls.filter(([key]) => motion.tracks[key]);
  const update = patch => set("motion", { ...motion, ...patch });
  const destination = motion.playback === "return" ? (trim[0] + trim[1]) / 2 : trim[1];
  const jump = index => { setEndpoint(index); seekTo(index ? destination : trim[0]); };
  const add = key => {
    if (!key) return;
    update({ enabled: true, tracks: { ...motion.tracks, [key]: [config[key], config[key]] } });
  };
  if (!["video", "demo"].includes(source.kind)) return <section className="motion-controls">
    <h2>Motion</h2><p className="hint">Open a video to animate its effects across the selected trim. For camera footage, save a recording and open it here.</p>
  </section>;
  return <section className="motion-controls">
    <h2>Motion</h2>
    <p className="hint">Two endpoints. One continuous transformation. Timing follows your trim, in preview and every export.</p>
    <Check label="Animate effects" value={motion.enabled} onChange={enabled => update({ enabled })} />
    {!active.length && <button className="primary full" onClick={() => {
      update({ enabled: true, tracks: { ...motion.tracks, effectMix: [0, 1] } });
      jump(0);
    }}>Start with an effect reveal</button>}
    <div className="motion-endpoints" role="group" aria-label="Animation endpoint">
      <button aria-label={`Start ${timeLabel(trim[0])}`} aria-pressed={endpoint === 0} onClick={() => jump(0)}><span>Start</span><small>{timeLabel(trim[0])}</small></button>
      <span aria-hidden="true">→</span>
      <button aria-label={`${motion.playback === "return" ? "Turnaround" : "End"} ${timeLabel(destination)}`} aria-pressed={endpoint === 1} onClick={() => jump(1)}><span>{motion.playback === "return" ? "Turnaround" : "End"}</span><small>{timeLabel(destination)}</small></button>
    </div>
    <p className="hint">Select an endpoint to edit its values. Scrub or play the video to see the transition.</p>
    <Select label="Motion path" value={motion.playback} onChange={playback => update({ playback })}>
      <option value="once">Start → End</option><option value="return">Start → End → Start</option>
    </Select>
    <Select label="Easing" value={motion.easing} onChange={easing => update({ easing })}>
      <option value="smooth">Smooth · ease both ends</option><option value="linear">Linear · steady change</option><option value="in">Ease in · build speed</option><option value="out">Ease out · settle gently</option>
    </Select>
    {active.map(([key, [label, min, max, step]]) => <div className="motion-track" key={key}>
      <Range label={`${label} · ${endpoint ? "end" : "start"}`} value={motion.tracks[key][endpoint]} min={min} max={max} step={step} onChange={value => {
        const pair = [...motion.tracks[key]]; pair[endpoint] = value;
        update({ tracks: { ...motion.tracks, [key]: pair } });
        seekTo(endpoint ? destination : trim[0]);
      }} />
      <div className="motion-readout"><span>Now {Number(configAtTime(config, time, trim)[key].toFixed(2))}</span><button className="small" aria-label={`Remove ${label} animation`} onClick={() => {
        const tracks = { ...motion.tracks }; delete tracks[key]; update({ tracks });
      }}>Remove</button></div>
    </div>)}
    <Select label="Add animated control" value="" onChange={add}>
      <option value="">Choose a control…</option>
      {controls.filter(([key]) => !motion.tracks[key]).map(([key, [label]]) => <option value={key} key={key}>{label}</option>)}
    </Select>
    {active.length > 0 && <p className="hint">Animated controls use these endpoint values while enabled. Removing a track restores its regular setting.</p>}
    {Object.keys(motion.tracks).length > active.length && <p className="hint">Tracks for other effects are kept and resume when you return to those effects.</p>}
  </section>;
}
