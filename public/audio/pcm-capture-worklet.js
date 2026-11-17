class ChurchPcmCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.stopped = false;
    this.blockSize = 2048;
    this.pending = new Float32Array(this.blockSize);
    this.writeOffset = 0;
    this.blockStartFrame = currentFrame;
    this.inputChannelCount = null;
    this.expectedNextFrame = null;
    this.hasReceivedInput = false;
    this.port.onmessage = (event) => {
      if (event.data && event.data.command === "stop" && !this.stopped) {
        this.flush();
        this.stopped = true;
        this.port.postMessage({ type: "stopped" });
      }
    };
  }

  flush() {
    if (!this.writeOffset) return;
    const pcm = this.pending.slice(0, this.writeOffset);
    this.port.postMessage({
      type: "pcm",
      pcm: pcm.buffer,
      frameStart: this.blockStartFrame,
      frameCount: pcm.length,
      pcmChannelCount: 1,
      inputChannelCount: this.inputChannelCount || 1,
      channelMix: this.inputChannelCount > 1 ? "arithmetic-mean" : "direct-mono",
      sampleRate,
    }, [pcm.buffer]);
    this.writeOffset = 0;
  }

  fail(reason) {
    this.port.postMessage({ type: "capture-error", reason });
    this.stopped = true;
  }

  process(inputs, outputs) {
    const output = outputs[0];
    if (output) for (const channel of output) channel.fill(0);
    if (this.stopped) return false;

    const input = inputs[0];
    if (!input || input.length === 0 || !input[0]) {
      if (this.hasReceivedInput) {
        this.fail("AudioWorklet input disappeared during PCM capture.");
        return false;
      }
      return true;
    }

    const frameCount = input[0].length;
    if (!frameCount || input.some(channel => channel.length !== frameCount)) {
      this.fail("Inconsistent AudioWorklet input channel frame lengths.");
      return false;
    }
    if (this.inputChannelCount !== null && input.length !== this.inputChannelCount) {
      this.fail("AudioWorklet input channel count changed during capture.");
      return false;
    }
    if (this.expectedNextFrame !== null && currentFrame !== this.expectedNextFrame) {
      this.fail("AudioWorklet render-frame clock jumped during PCM capture.");
      return false;
    }

    this.inputChannelCount = input.length;
    this.hasReceivedInput = true;
    for (let i = 0; i < frameCount; i++) {
      if (this.writeOffset === 0) this.blockStartFrame = currentFrame + i;
      let mono = 0;
      for (const channel of input) mono += channel[i] / input.length;
      this.pending[this.writeOffset++] = mono;
      if (this.writeOffset === this.blockSize) this.flush();
    }
    this.expectedNextFrame = currentFrame + frameCount;
    return true;
  }
}

registerProcessor("church-pcm-capture", ChurchPcmCaptureProcessor);
