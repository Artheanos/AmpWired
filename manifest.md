# Guitar Effects Editor – Web App Specification

## 1. Project Overview

**Product Name:** *AmpWired* (codename)  
**Type:** Single-Page Web Application (SPA)  
**Core Feature:** Visual patch-bay / modular guitar effects editor using a node‑based canvas. Users create signal chains by dragging nodes, adjusting knobs, and connecting outputs to inputs with virtual wires. The app uses the Web Audio API for real‑time sound processing.

## 2. Core User Stories

- As a user, I can **add** effect nodes (distortion, reverb, delay, EQ, etc.) plus a **source** node (mic/instrument) and a **destination** node (speakers/headphones).
- As a user, I can **click and drag** any node to reposition it on the canvas.
- As a user, I can **connect** the output of one node to the input of another by dragging from an output jack to an input jack.
- As a user, I can **adjust** effect parameters (knobs/sliders) on any node and hear the change in real time.
- As a user, I can **delete** a node or a wire.
- As a user, I can **save/load** a patch configuration (JSON).
- As a user, I can **enable/disable** the audio processing globally (mute/unmute).

## 3. Technical Stack (Recommended)

- **Frontend Framework:** React (with Hooks)
- **Canvas Rendering:** HTML elements
- **Audio Engine:** Web Audio API (`AudioContext`, `GainNode`, `Convolver`, `DelayNode`, `BiquadFilter`, `WaveShaper`, etc.)
- **State Management:** React Context
- **Serialization:** JSON export/import (base64 for impulse responses if needed).
- **Styling:** CSS Modules

## 4. Node System – Data Model

### 4.1. Node Types

| Type          | Description                                                                                        | Fixed I/O         |
| ------------- | -------------------------------------------------------------------------------------------------- | ----------------- |
| `source`      | Input from microphone or line‑in. Has a dropdown to select input device.                           | 1 output only     |
| `effect`      | Process audio (distortion, reverb, delay, chorus, EQ, compressor). Each has adjustable parameters. | 1 input, 1 output |
| `destination` | Output to speakers/headphones. Has volume control and speaker configuration (mono/stereo).         | 1 input only      |


### 4.2. Node Object (JSON)

```json
{
  "id": "uuid-v4",
  "type": "effect",
  "effectType": "distortion",
  "x": 250,
  "y": 150,
  "params": {
    "gain": 0.5,
    "tone": 0.7,
    "level": 0.8
  },
  "label": "Distortion 1"
}
```

- `id` – unique identifier.
- `type` – `"source"`, `"effect"`, `"destination"`.
- `effectType` – only for `"effect"`; one of: `distortion`, `reverb`, `delay`, `chorus`, `eq`, `compressor`.
- `x`, `y` – canvas position (top‑left corner of node).
- `params` – key‑value map of knob values (0–1 or meaningful ranges).
- `label` – user‑editable or auto‑generated.


### 4.3. Connection Object (Wire)

```json
{
  "id": "uuid-v4",
  "sourceNodeId": "node-1",
  "sourcePort": "output",
  "targetNodeId": "node-2",
  "targetPort": "input"
}
```

- **Constraints:**  
  - A source node has no input; a destination has no output.  
  - Only one wire per input (new wire replaces old).  
  - Outputs can have multiple outgoing wires (split signal).  
  - No self‑connections.  
  - No connections that create a cycle (must be a DAG – directed acyclic graph).


## 5. Canvas & Interaction Design

### 5.1. Canvas Layout

- Background: dark grid (like DAW/Modular synths).
- Nodes are rendered as rounded rectangles with:
  - **Header:** node type icon + label + close (×) button.
  - **Knobs section:** 2–4 rotary knobs/sliders with value displays.
  - **Input port:** small circle on the left side (only for effect & destination).
  - **Output port:** small circle on the right side (only for source & effect).



### 5.2. Interactions


| Action              | Behavior                                                                                                                                              |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Add Node**        | Click a "+" button → dropdown menu → choose node type. New node appears at center of canvas (or offset to avoid overlap).                             |
| **Move Node**       | Click on node body (not on port/knob) and drag. All connected wires update in real time (rubber‑banding).                                             |
| **Connect Wire**    | Click and hold on an output port → drag a temporary wire (bezier curve) → release over an input port to connect. If release on empty canvas → cancel. |
| **Disconnect Wire** | Click on a wire → press `Delete` or `Backspace` key, or right‑click → "Remove wire".                                                                  |
| **Delete Node**     | Click the × on the node header → removes node and all attached wires.                                                                                 |
| **Adjust Knob**     | Click on a knob and drag vertically (or use mousewheel) → value updates live and audio changes immediately.                                           |




### 5.3. Visual Feedback

- **Temporary wire:** dashed line, follows mouse, changes color when over a valid input port (green) or invalid (red).
- **Ports:** highlight on hover.
- **Active path:** highlight all nodes & wires that are part of the active audio chain (from source to destination).



## 6. Audio Engine – Signal Flow



### 6.1. Web Audio Graph Construction

- Each node creates one or more Web Audio nodes:
  - `source` → `AudioContext.createMediaStreamSource()` (or oscillator for testing).
  - `effect` → e.g., `WaveShaperNode` (distortion), `ConvolverNode` (reverb), `DelayNode`, `BiquadFilterNode`, etc.
  - `destination` → `AudioContext.createGain()` (master volume) → `context.destination`.
- **Routing:** When a wire connects `nodeA.output` → `nodeB.input`, the audio engine disconnects any previous input on `nodeB` and connects the output of `nodeA`’s internal node to the input of `nodeB`’s internal node.
- **Parameter updates:** Each knob change directly updates the corresponding `AudioParam` (e.g., `gain.gain.value = newVal`).



### 6.2. Processing Chain Order

- The engine must traverse the graph **topologically** (source → effects → destination) to ensure correct order.
- If a cycle is detected, the connection is rejected and a user warning is shown.



### 6.3. Audio Context Lifecycle

- The `AudioContext` is created on first user interaction (due to browser autoplay policy).
- A global **Mute** button suspends/resumes the context.



## 7. UI – Layout & Components



### 7.1. Main Layout

```
+-------------------------------------------------+
| [Logo]   [Add Node ▼]   [Save] [Load] [Mute]    |
+-------------------------------------------------+
|                                                   |
|    (Canvas – full remaining area)                 |
|                                                   |
|                                                   |
+-------------------------------------------------+
| Status Bar:  CPU usage | Sample rate | Nodes: 3   |
+-------------------------------------------------+
```



### 7.2. Component Breakdown

- **Toolbar:** Add node dropdown, save/load buttons, mute toggle, clear all.
- **CanvasContainer:** Contains the <div> element or SVG overlay for wires.
- **NodeComponent:** Renders a node with knobs, ports, and drag handlers.
- **WireComponent:** Renders a bezier curve between two ports.
- **KnobComponent:** Custom rotary knob (using CSS or canvas), supports drag & mousewheel.
- **Modal/Dialog:** For loading patches or selecting input devices (microphone list).



## 8. Non‑Functional Requirements

- **Performance:** Should handle at least 20 nodes without noticeable audio glitches (optimize by using `AudioNode` connections directly, not scripting per sample).
- **Responsive:** Canvas should resize with the browser window (full‑width, full‑height).
- **Offline Support:** Not required, but local storage for auto‑save is a plus.
- **Browser Support:** Latest Chrome, Firefox, Edge (all support Web Audio API).
- **Error Handling:** Graceful fallback if microphone not available.



## 9. Persistence – Save/Load Format

- **Export:** Download `patch.json` with the following schema:

```json
{
  "version": "1.0",
  "nodes": [ /* array of Node objects */ ],
  "connections": [ /* array of Connection objects */ ],
  "metadata": {
    "name": "My Patch",
    "created": "2026-07-03T10:00:00Z"
  }
}
```

- **Import:** User selects a `.json` file → validates schema → clears current graph → loads new nodes and connections.



## 12. Sample Wire Rendering (Bezier)

- Use quadratic or cubic bezier from output port center to input port center.
- Control points: offset horizontally by 50px from each port.
- Color: light blue (#4FC3F7) with 2px stroke.
- On hover: stroke width increases to 4px.



## 13. Port Coordinates (relative to node)

- **Input port:** `(x: 0, y: headerHeight/2 + 10)` – left edge.
- **Output port:** `(x: nodeWidth, y: headerHeight/2 + 10)` – right edge.


## 15. Example Effects & Their Parameters


| Effect      | Web Audio Node              | Parameters                                       |
| ----------- | --------------------------- | ------------------------------------------------ |
| Distortion  | `WaveShaperNode`            | Drive (0–1), Tone (0–1), Output Level (0–1)      |
| Reverb      | `ConvolverNode` (with IR)   | Mix (0–1), Decay (0.1–5s) – simulated via gain   |
| Delay       | `DelayNode` + feedback gain | Time (0–1s), Feedback (0–0.9), Mix               |
| Chorus      | `DelayNode` with LFO        | Rate (0–20Hz), Depth (0–1), Mix                  |
| EQ (3‑band) | 3 `BiquadFilterNode`        | Low gain, Mid gain, High gain (each -20..+20 dB) |
| Compressor  | `DynamicsCompressorNode`    | Threshold, Ratio, Attack, Release                |
