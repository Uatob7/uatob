function playRequestChime() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioCtx();

    const master = ctx.createGain();
    master.gain.value = 0.18;
    master.connect(ctx.destination);

    const playTone = ({ freq, type = "sine", start, duration, volume = 0.25 }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, start);

      osc.connect(gain);
      gain.connect(master);

      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(volume, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

      osc.start(start);
      osc.stop(start + duration);
    };

    const now = ctx.currentTime + 0.02;

    // Dispatch-style 3-part repeating tone
    const pattern = [
      { t: 0.00, f1: 740,  f2: 1110, d: 0.18 },
      { t: 0.24, f1: 880,  f2: 1320, d: 0.18 },
      { t: 0.48, f1: 1047, f2: 1568, d: 0.26 },

      { t: 0.95, f1: 740,  f2: 1110, d: 0.18 },
      { t: 1.19, f1: 880,  f2: 1320, d: 0.18 },
      { t: 1.43, f1: 1047, f2: 1568, d: 0.30 },
    ];

    pattern.forEach(({ t, f1, f2, d }) => {
      playTone({
        freq: f1,
        type: "sine",
        start: now + t,
        duration: d,
        volume: 0.22,
      });

      playTone({
        freq: f2,
        type: "triangle",
        start: now + t,
        duration: d,
        volume: 0.12,
      });
    });

    // subtle "tap" click for urgency
    const noise = ctx.createBufferSource();
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 0.08, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / 1800);
    }

    noise.buffer = buffer;

    const noiseGain = ctx.createGain();
    noiseGain.gain.value = 0.03;
    noise.connect(noiseGain);
    noiseGain.connect(master);

    noise.start(now + 0.01);
    noise.stop(now + 0.08);

    setTimeout(() => {
      ctx.close().catch(() => {});
    }, 3000);
  } catch (err) {
    console.warn("Audio playback failed:", err);
  }
}