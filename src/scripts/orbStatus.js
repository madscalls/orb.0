// Effects the dropped-in items can put on the orb. Times are in seconds on
// the same clock as the animation loop (`now`).
export const orbStatus = {
  now: 0,
  slipUntil: 0, // banana peel / ice puddle: no grip
  sleepUntil: 0, // zzz cloud: dozes off
  beam: 0, // UFO tractor beam strength (0..1), cancels gravity
  hat: null, // the hat prop sitting on the orb, if any
};

export const isSlipping = () => orbStatus.now < orbStatus.slipUntil;
export const isAsleep = () => orbStatus.now < orbStatus.sleepUntil;
