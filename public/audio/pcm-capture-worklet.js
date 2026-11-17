class ChurchPcmCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.stopped = false;
    this.port.onmessage = (event) => {
      if (event.data && event.data.command === "stop") this.stopped = true;
    };
  }

  process(inputs, outputs) {
    const output = outputs[0];
    if (output) for (const channel of output) channel.fill(0);
    if (this.stopped) return false;
    const input = inputs[0];
    if (!input || input.length === 0 || !input[0]) return true;

    const frameCount = input[0].length;
    const mono = new Float32Array(frameCount);
    for (const channel of input) {
      for (let i = 0; i < frameCount; i++) mono[i] += channel[i] / input.length;
    }
    this.port.postMessage({
      pcm: mono.buffer,
      frameStart: currentFrame,
      channelCount: input.length,
      sampleRate,
    }, [mono.buffer]);
    return true;
  }
}

registerProcessor("church-pcm-capture", ChurchPcmCaptureProcessor);
