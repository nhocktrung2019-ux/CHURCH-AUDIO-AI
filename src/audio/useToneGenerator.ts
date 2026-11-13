import { useCallback, useEffect, useRef, useState } from "react";

type SinkCapableAudio = HTMLAudioElement & {
  setSinkId?: (sinkId: string) => Promise<void>;
};

export function useToneGenerator() {
  const ctx = useRef<AudioContext | null>(null);
  const osc = useRef<OscillatorNode | null>(null);
  const gain = useRef<GainNode | null>(null);
  const output = useRef<SinkCapableAudio | null>(null);
  const [frequency, setFrequency] = useState(1000);
  const [volume, setVolume] = useState(-30);
  const [active, setActive] = useState(false);
  const [outputDevice, setOutputDevice] = useState("");
  const [outputError, setOutputError] = useState("");

  const supportsOutputSelection =
    typeof HTMLMediaElement !== "undefined" &&
    "setSinkId" in HTMLMediaElement.prototype;

  const stop = useCallback(() => {
    try { osc.current?.stop(); } catch { /* already stopped */ }
    osc.current?.disconnect();
    gain.current?.disconnect();
    osc.current = null;
    gain.current = null;

    if (output.current) {
      output.current.pause();
      output.current.srcObject = null;
    }

    const previousContext = ctx.current;
    ctx.current = null;
    if (previousContext && previousContext.state !== "closed") {
      void previousContext.close().catch(() => undefined);
    }
    setActive(false);
  }, []);

  const selectOutput = useCallback(async (deviceId: string) => {
    try {
      const element = output.current;
      if (deviceId && !supportsOutputSelection) {
        throw new Error("Trình duyệt không hỗ trợ chọn thiết bị đầu ra riêng.");
      }
      if (element?.setSinkId) await element.setSinkId(deviceId);
      setOutputDevice(deviceId);
      setOutputError("");
    } catch (error) {
      setOutputError(error instanceof Error ? error.message : "Không thể đổi thiết bị đầu ra.");
    }
  }, [supportsOutputSelection]);

  const start = useCallback(async () => {
    stop();
    let audio: AudioContext | null = null;
    try {
      audio = new AudioContext();
      const oscillator = audio.createOscillator();
      const amplifier = audio.createGain();
      const streamDestination = audio.createMediaStreamDestination();
      const element = output.current ?? (new Audio() as SinkCapableAudio);

      element.autoplay = true;
      element.volume = 1;
      element.srcObject = streamDestination.stream;

      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      amplifier.gain.value = Math.pow(10, volume / 20) * 0.08;
      oscillator.connect(amplifier);
      amplifier.connect(streamDestination);

      let routed = true;
      try {
        if (outputDevice) {
          if (!element.setSinkId) throw new Error("Không hỗ trợ định tuyến đầu ra riêng.");
          await element.setSinkId(outputDevice);
        }
        await audio.resume();
        await element.play();
      } catch {
        routed = false;
        amplifier.disconnect();
        amplifier.connect(audio.destination);
        element.pause();
        element.srcObject = null;
        setOutputError("Không mở được đầu ra đã chọn; tín hiệu đang dùng đầu ra mặc định.");
      }

      if (routed) {
        output.current = element;
        setOutputError("");
      }
      ctx.current = audio;
      osc.current = oscillator;
      gain.current = amplifier;
      oscillator.start();
      setActive(true);
    } catch (error) {
      if (audio && audio.state !== "closed") await audio.close().catch(() => undefined);
      setOutputError(error instanceof Error ? error.message : "Không thể khởi động bộ phát tín hiệu.");
    }
  }, [frequency, outputDevice, stop, volume]);

  useEffect(() => {
    if (osc.current && ctx.current) {
      osc.current.frequency.setTargetAtTime(frequency, ctx.current.currentTime, 0.02);
    }
  }, [frequency]);

  useEffect(() => {
    if (gain.current && ctx.current) {
      gain.current.gain.setTargetAtTime(
        Math.pow(10, volume / 20) * 0.08,
        ctx.current.currentTime,
        0.02,
      );
    }
  }, [volume]);

  useEffect(() => () => {
    try { osc.current?.stop(); } catch { /* already stopped */ }
    output.current?.pause();
    output.current && (output.current.srcObject = null);
    void ctx.current?.close().catch(() => undefined);
  }, []);

  return {
    frequency, setFrequency, volume, setVolume, active, start, stop,
    outputDevice, selectOutput, supportsOutputSelection, outputError,
  };
}
