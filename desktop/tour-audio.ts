const chords = [
  [50, 57, 61, 64, 66],
  [47, 54, 57, 62, 66],
  [43, 55, 59, 62, 66],
  [45, 52, 57, 59, 64]
];

function frequency(note: number) {
  return 440 * 2 ** ((note - 69) / 12);
}

export function createTourAudio() {
  let context: AudioContext | undefined;
  let master: GainNode | undefined;
  let timer: number | undefined;
  let muted = false;
  let bar = 0;
  let nextBar = 0;
  const barSeconds = 3.6;

  function note(pitch: number, at: number, duration: number, volume: number, attack: number, type: OscillatorType) {
    if (!context || !master) return;
    const oscillator = context.createOscillator();
    const envelope = context.createGain();
    oscillator.type = type;
    oscillator.frequency.value = frequency(pitch);
    envelope.gain.setValueAtTime(.0001, at);
    envelope.gain.exponentialRampToValueAtTime(volume, at + attack);
    envelope.gain.exponentialRampToValueAtTime(.0001, at + duration);
    oscillator.connect(envelope);
    envelope.connect(master);
    oscillator.start(at);
    oscillator.stop(at + duration + .01);
  }

  function schedule() {
    if (muted || !context || context.state !== 'running') return;
    if (nextBar < context.currentTime) nextBar = context.currentTime + .05;
    if (nextBar > context.currentTime + .35) return;
    const chord = chords[bar % chords.length];
    note(chord[0], nextBar, 3.45, .11, .65, 'sine');
    for (const pitch of chord.slice(1, 4)) note(pitch, nextBar, 3.35, .037, .72, 'sine');
    [1, 3, 2, 4, 3].forEach((index, beat) => note(chord[index] + 12, nextBar + .36 + beat * .51, .83, .065, .015, 'triangle'));
    bar += 1;
    nextBar += barSeconds;
  }

  function volume(level: number, seconds: number) {
    if (!context || !master) return;
    master.gain.cancelScheduledValues(context.currentTime);
    master.gain.setTargetAtTime(level, context.currentTime, seconds);
  }

  return {
    click() {
      if (muted || !window.AudioContext) return;
      if (!context) {
        context = new AudioContext();
        master = context.createGain();
        master.gain.value = .22;
        master.connect(context.destination);
        timer = window.setInterval(schedule, 150);
      }
      void context.resume().catch(() => {});
      const at = context.currentTime + .012;
      note(83, at, .09, .19, .009, 'sine');
      note(90, at + .015, .075, .11, .008, 'sine');
    },
    setMuted(next: boolean) {
      muted = next;
      volume(next ? 0 : .22, .055);
    },
    fadeOut() { volume(0, .075); },
    dispose() {
      window.clearInterval(timer);
      if (context && context.state !== 'closed') void context.close().catch(() => {});
    }
  };
}
