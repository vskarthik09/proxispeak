# Architecture and week-by-week coverage

## System flow
1. React client connects to Express/Socket.io.
2. `room:join` registers an avatar and persists its latest position.
3. Canvas pointer movement emits `avatar:move`; server broadcasts position.
4. Proximity service computes pair distances and applies the configured 100 px radius.
5. Socket.io signaling exchanges SDP offers/answers and ICE candidates.
6. Remote audio streams are connected to Web Audio gain and stereo panner nodes.
7. Redis adapter distributes Socket.io events when multiple backend instances are used.

## Week 1 — Signaling and movement
- Express + Socket.io server and event contracts.
- MongoDB Avatar and Room schemas with geospatial index.
- Canvas grid, avatars, labels, pointer drag and live position broadcasts.

## Week 2 — Proximity and WebRTC
- Pairwise distance calculations and proximity updates.
- Peer connection offer/answer/ICE signaling.
- WebRTC audio tracks and participant state.

## Week 3 — Mesh scaling and dynamic attenuation
- Optional Redis Pub/Sub Socket.io adapter.
- Web Audio API GainNode and StereoPannerNode.
- Distance and obstacle attenuation calculations.
- Mesh is suitable for small rooms only; use an SFU for larger sessions.

## Week 4 — Persistence and polish
- Room/furniture persistence model.
- Wall intersection attenuation helper.
- Responsive UI, animation, status, controls and operational documentation.

## Event contract
- Client → server: `room:join`, `avatar:move`, `webrtc:offer`, `webrtc:answer`, `webrtc:ice`, `audio:state`
- Server → client: `room:state`, `user:joined`, `user:left`, `avatar:moved`, `proximity:update`, WebRTC signaling events.


## Video meeting extension
- REST `/api/auth/signup` and `/api/auth/login` issue JWTs after bcrypt password hashing.
- REST `POST /api/meetings` creates a short random meeting code.
- Socket.IO authenticates the JWT handshake, then broadcasts room membership, chat messages and raised-hand state.
- WebRTC peer connections carry camera/microphone streams and can switch their video sender to a screen-capture track.
- Participant count is derived from live room socket membership.
- Translation is requested by the browser from the configured public MyMemory endpoint in this starter.
