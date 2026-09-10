import React, { useState } from "react";
import { Icon, Select } from "./Controls";
import { Dialog } from "./Dialog";
import { TimeField } from "./TimeField";
import { timeLabel } from "./model";
import { Filmstrip } from "./Filmstrip";

export function Timeline({ source, time, trim, busy, loading, playing, loop,
  muted, scrub, togglePlay, toggleSound, setLoop, changeTrim, setTrim, frameRate = 30 }) {
  const [trimming, setTrimming] = useState(false);
  const [stepRate, setStepRate] = useState(frameRate);
  const camera = source.kind === "camera";
  const openTrim = () => {
    if (playing) togglePlay();
    setTrimming(true);
  };
  if (source.kind === "image") return null;
  return <div className="timeline">
    <div className="transport">
      <div className="transport-buttons">
        {!camera && <>
          <button className="icon-button return-start" aria-label="Back to trim start" disabled={busy || loading} onClick={() => scrub(trim[0])}><Icon name="back" /></button>
          <button className="play-button" aria-label={playing ? "Pause" : "Play"} onClick={togglePlay} disabled={busy || loading}><Icon name={playing ? "pause" : "play"} /></button>
        </>}
        <button className="timecode quiet" aria-label="Edit playhead and trim" disabled={busy || loading} onClick={openTrim}>{camera ? "Live camera" : <>{timeLabel(time)}<span> / {timeLabel(source.duration)}</span></>}</button>
      </div>
      <div className="transport-options">
        {source.kind === "video" && <button className="icon-button" aria-label={muted ? "Unmute preview" : "Mute preview"} onClick={toggleSound} disabled={busy}><Icon name={muted ? "mute" : "sound"} /></button>}
        {!camera && <button className="icon-button loop-button" aria-label="Loop preview" aria-pressed={loop} onClick={() => setLoop(!loop)} disabled={busy}><Icon name="loop" /></button>}
        <button className="quiet trim-button" onClick={openTrim} disabled={busy || loading}>{camera ? "Length" : "Trim"}<Icon name="chevron" /></button>
      </div>
    </div>
    {!camera && <div className="scrubber">
      <Filmstrip source={source} trim={trim} changeTrim={changeTrim} disabled={busy} interactive={false} />
      <input className="playhead" aria-label="Video playhead" type="range" min="0" max={source.duration || 1} step="0.01" value={Math.min(time, source.duration || 1)} disabled={busy || loading} onChange={e => scrub(Number(e.target.value))} />
    </div>}
    {trimming && <Dialog title={camera ? "Recording length" : "Trim & timing"} onClose={() => setTrimming(false)}>
      <div className="modal-body trim-editor">
        {!camera && <>
          <Filmstrip source={source} trim={trim} changeTrim={changeTrim} disabled={busy} />
          <div className="precise-playhead">
            <TimeField label="Playhead in seconds" value={time} min={0} max={source.duration} onCommit={scrub} />
            <div className="button-row">
              <button className="icon-button" aria-label="Previous frame step" disabled={time <= 0} onClick={() => scrub(Math.max(0, (Math.round(time * stepRate) - 1) / stepRate))}><Icon name="back" /></button>
              <button className="icon-button" aria-label="Next frame step" disabled={time >= source.duration} onClick={() => scrub(Math.min(source.duration, (Math.round(time * stepRate) + 1) / stepRate))}><Icon name="next" /></button>
            </div>
          </div>
          <Select label="Frame-step rate" value={stepRate} onChange={value => setStepRate(Number(value))}>{[24, 25, 30, 50, 60].map(rate => <option key={rate} value={rate}>{rate} fps</option>)}</Select>
        </>}
        <div className="trim-fields">
          {!camera && <div><TimeField label="Trim start in seconds" caption="In" value={trim[0]} min={0} max={trim[1] - .05} onCommit={value => changeTrim(0, value)} /><button className="small" onClick={() => changeTrim(0, time)}>Set in here</button></div>}
          <div><TimeField label={camera ? "Recording duration in seconds" : "Trim end in seconds"} caption={camera ? "Length" : "Out"} value={trim[1]} min={trim[0] + .05} max={source.duration || 300} onCommit={value => changeTrim(1, value)} />{!camera && <button className="small" onClick={() => changeTrim(1, time)}>Set out here</button>}</div>
        </div>
        <div className="trim-summary"><span>{(trim[1] - trim[0]).toFixed(2)} seconds selected</span>{!camera && <button className="quiet" disabled={trim[0] === 0 && trim[1] === source.duration} onClick={() => setTrim([0, source.duration])}>Full clip</button>}</div>
        <button className="primary full" onClick={() => setTrimming(false)}>Done</button>
      </div>
    </Dialog>}
  </div>;
}
