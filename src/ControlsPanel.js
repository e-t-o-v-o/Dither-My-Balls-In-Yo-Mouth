import React, { useState } from 'react';
import {
  presetColors,
  effects,
  decadePalettes,
  charPalettes,
  asciiVariants,
  paletteSets
} from './constants';

export default function ControlsPanel(props) {
  const {
    config,
    dispatch,
    handleChange,
    handleVideoUpload,
    handleVideoPlay,
    handleVideoPause,
    handleImageUpload,
    handleFontUpload,
    startRecording,
    stopRecording,
    downloadSVG,
    downloadHighResPNG,
    downloadVideo,
    videoFileLoaded,
    imageLoaded,
    recorder,
    gifRecorder,
    fontsList,
    presets, selectedPreset,
    onSavePreset, onLoadPreset, onDeletePreset, onExportPresets, onImportPresets
  } = props;

  const [activeTab, setActiveTab] = useState('Input');
  const tabs = ['Input','Effects','Settings'];

  return (
    <aside className="controls">
      <div className="tab-bar">
        <button className={activeTab === 'Input' ? 'active' : ''} onClick={() => setActiveTab('Input')}>📹 Input</button>
        <button className={activeTab === 'Effects' ? 'active' : ''} onClick={() => setActiveTab('Effects')}>🎨 Effects</button>
        <button className={activeTab === 'Settings' ? 'active' : ''} onClick={() => setActiveTab('Settings')}>⚙️ Settings</button>
      </div>

      {activeTab === 'Input' && (
        <>
          <label>Mode
            <select name="mode" value={config.mode} onChange={handleChange}>
              <option value="video">Webcam</option>
              <option value="video-file">Upload Video</option>
              <option value="image">Image</option>
            </select>
          </label>

          {(config.mode === 'video' || config.mode === 'video-file') && (
            <>
              {config.mode === 'video-file' && (
                <>
                  <label>Upload Video<input type="file" accept="video/*" onChange={handleVideoUpload} /></label>
                  <button onClick={handleVideoPlay} disabled={!videoFileLoaded}>Play</button>
                  <button onClick={handleVideoPause} disabled={!videoFileLoaded}>Pause</button>
                  <button onClick={downloadVideo} disabled={!videoFileLoaded}>Download Processed Video</button>
                </>
              )}
              <label>Recording Format
                <select name="recordingFormat" value={config.recordingFormat} onChange={handleChange}>
                  <option value="mp4">MP4</option>
                  <option value="gif">GIF</option>
                </select>
              </label>
              <button onClick={startRecording} disabled={!!recorder || !!gifRecorder}>Start Recording</button>
              <button onClick={stopRecording} disabled={!recorder && !gifRecorder}>Stop & Download</button>
              <label>Smoothing
                <input
                  type="range"
                  name="smoothFactor"
                  min="0"
                  max="1"
                  step="0.05"
                  value={config.smoothFactor}
                  onChange={handleChange}
                />
                {Math.round(config.smoothFactor * 100)}%
              </label>
              <label>Resolution
                <select name="outputResolution" value={config.outputResolution} onChange={handleChange}>
                  <option value="native">Native</option>
                  <option value="1080p">1080p</option>
                  <option value="4k">4k</option>
                </select>
              </label>
            </>
          )}

          {activeTab === 'Input' && config.mode === 'image' && (
            <>
              <label>Upload Image<input type="file" accept="image/*" onChange={handleImageUpload} /></label>
              <label>Download As
                <select name="imageDownloadType" value={config.imageDownloadType} onChange={handleChange}>
                  <option value="png4x">PNG 4×</option>
                  <option value="png2x">PNG 2×</option>
                  <option value="png1x">PNG 1×</option>
                  <option value="svg">SVG</option>
                </select>
                <button onClick={() => {
                  // ASCII/dither-ascii look best as SVG, avoid PNG artifacts
                  if (config.effect === 'ascii' || config.effect === 'dither-ascii') {
                    downloadSVG();
                    return;
                  }
                  switch (config.imageDownloadType) {
                    case 'svg': downloadSVG(); break;
                    case 'png4x': downloadHighResPNG(4); break;
                    case 'png2x': downloadHighResPNG(2); break;
                    case 'png1x': downloadHighResPNG(1); break;
                    default: downloadHighResPNG(4);
                  }
                }} disabled={!imageLoaded}>Download</button>
              </label>
            </>
          )}
        </>
      )}

      {activeTab === 'Effects' && (
        <div className="effects-container">
          <div className="effects-inner">
            <label>Effect
              <select name="effect" value={config.effect} onChange={handleChange}>
                {effects.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </label>

            {config.effect === 'palette' && (
              <>
                <label>Palette</label>
                <div className="swatch-panel">
                  <div className="swatches">
                    {Object.entries(paletteSets).map(([name, colors]) => (
                      <div
                        key={name}
                        className={`palette-swatch${config.paletteName === name ? ' selected' : ''}`}
                        onClick={() => dispatch({ type: 'SET', name: 'paletteName', value: name })}
                      >
                        {colors.map(col => <div key={col} className="swatch" style={{ background: col }} />)}
                      </div>
                    ))}
                  </div>
                </div>
                <label>Or choose from list</label>
                <select name="paletteName" value={config.paletteName} onChange={handleChange}>
                  {Object.keys(paletteSets).map(p => <option key={p} value={p}>{p}</option>)}
                </select>
                <label>Overlay</label>
                <select name="overlayType" value={config.overlayType} onChange={handleChange}>
                  <option value="none">None</option>
                  <option value="number">Number</option>
                  <option value="character">Character</option>
                </select>
              </>
            )}

            {config.effect === 'decade' && (
              <>
                <label>Decade Palette</label>
                <div className="swatch-panel">
                  <div className="swatches">
                    {Object.entries(decadePalettes).map(([name, colors]) => (
                      <div
                        key={name}
                        className={`palette-swatch${config.decadePalette === name ? ' selected' : ''}`}
                        onClick={() => dispatch({ type: 'SET', name: 'decadePalette', value: name })}
                      >
                        {colors.map(col => <div key={col} className="swatch" style={{ background: col }} />)}
                      </div>
                    ))}
                  </div>
                </div>
                <label>Or choose from list</label>
                <select name="decadePalette" value={config.decadePalette} onChange={handleChange}>
                  {Object.keys(decadePalettes).map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </>
            )}

            {config.effect === 'dither' && (
              <>
                <label>Dither Palette
                  <select name="ditherPalette" value={config.ditherPalette} onChange={handleChange}>
                    {Object.keys(charPalettes).map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </label>
                <label>Dither Method
                  <select name="ditherMethod" value={config.ditherMethod} onChange={handleChange}>
                    <option value="ordered">Ordered</option>
                    <option value="floyd">Floyd–Steinberg</option>
                    <option value="jarvis">Jarvis–Judice–Ninke</option>
                    <option value="burkes">Burkes</option>
                    <option value="sierra">Sierra</option>
                    <option value="atkinson">Atkinson</option>
                  </select>
                </label>
              </>
            )}

            {config.effect === 'dither-ascii' && (
              <>
                <label>Dither Palette
                  <select name="ditherPalette" value={config.ditherPalette} onChange={handleChange}>
                    {Object.keys(charPalettes).map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </label>
                <label>Dither Method
                  <select name="ditherMethod" value={config.ditherMethod} onChange={handleChange}>
                    <option value="ordered">Ordered</option>
                    <option value="floyd">Floyd–Steinberg</option>
                    <option value="jarvis">Jarvis–Judice–Ninke</option>
                    <option value="burkes">Burkes</option>
                    <option value="sierra">Sierra</option>
                    <option value="atkinson">Atkinson</option>
                  </select>
                </label>
                <label>ASCII Palette
                  <select name="charPalette" value={config.charPalette} onChange={handleChange}>
                    {Object.entries(charPalettes).map(([p, cols]) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </label>
                <label>ASCII Mapping
                  <select name="asciiMapping" value={config.asciiMapping} onChange={handleChange}>
                    <option value="dynamic">Dynamic</option>
                    <option value="static">Ordered</option>
                  </select>
                </label>
              </>
            )}

            {['binary-char', 'numbers-0-9-palette', 'letter-char', 'circle-palette', 'letters-palette'].includes(config.effect) && (
              <label>Char Palette
                <select name="charPalette" value={config.charPalette} onChange={handleChange}>
                  {Object.keys(charPalettes).map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </label>
            )}

            {(config.effect === 'ascii' || config.effect === 'dither-ascii' || config.effect === 'dither' || config.effect === 'two-tone') && (
              <>
                <label>ASCII Variant
                  <select name="asciiVariant" value={config.asciiVariant} onChange={handleChange}>
                    {Object.keys(asciiVariants).map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </label>
                <label>
                  <input
                    type="checkbox"
                    name="removeGreen"
                    checked={config.removeGreen}
                    onChange={handleChange}
                  /> Remove Green Screen
                </label>
                {config.effect === 'two-tone' && config.removeGreen && (
                  <label>
                    Green Replace Color
                    <input
                      type="color"
                      name="greenReplaceColor"
                      value={config.greenReplaceColor}
                      onChange={handleChange}
                    />
                  </label>
                )}
              </>
            )}
            {config.effect === 'ascii' && (
              <>
                <label>ASCII Palette
                  <select name="charPalette" value={config.charPalette} onChange={handleChange}>
                    {Object.entries(charPalettes).map(([p, cols]) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </label>
                <label>
                  <input
                    type="checkbox"
                    name="asciiUnderlay"
                    checked={config.asciiUnderlay}
                    onChange={handleChange}
                  /> Show Underlying Video
                </label>
              </>
            )}
          </div>
        </div>
      )}

      {activeTab === 'Settings' && (
        <>
          <label>Foreground
            <div className="swatch-panel">
              <div className="swatches">
                {presetColors.map(c => (
                  <div
                    key={c.value}
                    className={`swatch${config.fgColor === c.value ? ' selected' : ''}`}
                    style={{ background: c.value }}
                    onClick={() => dispatch({ type: 'SET', name: 'fgColor', value: c.value })}
                  />
                ))}
              </div>
            </div>
          </label>

          <label>Background
            <div className="swatch-panel">
              <div className="swatches">
                {presetColors.map(c => (
                  <div
                    key={c.value}
                    className={`swatch${config.bgColor === c.value ? ' selected' : ''}`}
                    style={{ background: c.value }}
                    onClick={() => dispatch({ type: 'SET', name: 'bgColor', value: c.value })}
                  />
                ))}
              </div>
            </div>
          </label>

          <label>Threshold
            <input type="range" name="threshold" min="0" max="255" value={config.threshold} onChange={handleChange} />
            <span>{config.threshold}</span>
          </label>

          <label>Pixel Size
            <input type="range" name="pixelSize" min="2" max="100" value={config.pixelSize} onChange={handleChange} />
            <span>{config.pixelSize}</span>
            <button onClick={() => dispatch({ type: 'SNAP_FONT' })}>Snap Font</button>
          </label>

          <label>Font Size
            <input type="range" name="fontSize" min="8" max="100" value={config.fontSize} onChange={handleChange} />
            <span>{config.fontSize}px</span>
          </label>

          <label>Upload Font <input type="file" accept=".ttf,.otf" onChange={handleFontUpload} /></label>

          <label>Font
            <select name="font" value={config.font} onChange={handleChange}>
              {fontsList.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </label>

          <label>Char
            <input type="text" name="char" value={config.char} onChange={handleChange} maxLength={1} />
          </label>
        </>
      )}
    </aside>
  );
}
