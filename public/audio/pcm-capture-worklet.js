class ChurchPcmCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.stopped = false;
    this.blockSize = 2048;
    this.pending = new Float32Array(this.blockSize);
    this.writeOffset = 0;
    this.blockStartFrame = currentFrame;
    this.port.onmessage = (event) => {
      if (event.data && event.data.command === "stop") {
        this.flush();
        this.stopped = true;
      }
    };
  }

  flush() {
    if (!this.writeOffset) return;
    const pcm = this.pending.slice(0, this.writeOffset);
    this.port.postMessage({
      pcm: pcm.buffer,
      frameStart: this.blockStartFrame,
      channelCount: this.lastChannelCount || 1,
      sampleRate,
    }, [pcm.buffer]);
    this.writeOffset = 0;
  }

  process(inputs, outputs) {
    const output = outputs[0];
    if (output) for (const channel of output) channel.fill(0);
    if (this.stopped) return false;
    const input = inputs[0];
    if (!input || input.length === 0 || !input[0]) return true;

    const frameCount = input[0].length;
    this.lastChannelCount = input.length;
    for (let i = 0; i < frameCount; i++) {
      if (this.writeOffset === 0) this.blockStartFrame = currentFrame + i;
      let mono = 0;
      for (const channel of input) mono += channel[i] / input.length;
      this.pending[this.writeOffset++] = mono;
      if (this.writeOffset === this.blockSize) this.flush();
    }
    return true;
  }
}

registerProcessor("church-pcm-capture", ChurchPcmCaptureProcessor);
