import { useCallback, useEffect, useRef, useState } from "react";

type SinkCapableAudio = HTMLAudioElement & { setSinkId?: (sinkId: string) => Promise<void> };
export type SignalType = "sine" | "white" | "pink" | "sweep";

function createNoiseBuffer(audio: AudioContext, type: "white" | "pink"): AudioBuffer {
  const seconds = 5;
  const buffer = audio.createBuffer(1, Math.floor(audio.sampleRate * seconds), audio.sampleRate);
  const samples = buffer.getChannelData(0);
  let b0=0,b1=0,b2=0,b3=0,b4=0,b5=0,b6=0;
  for(let i=0;i<samples.length;i++){
    const white=Math.random()*2-1;
    if(type==="white") samples[i]=white*0.22;
    else{
      b0=0.99886*b0+white*0.0555179;
      b1=0.99332*b1+white*0.0750759;
      b2=0.96900*b2+white*0.1538520;
      b3=0.86650*b3+white*0.3104856;
      b4=0.55000*b4+white*0.5329522;
      b5=-0.7616*b5-white*0.0168980;
      const pink=b0+b1+b2+b3+b4+b5+b6+white*0.5362;
      b6=white*0.115926;
      samples[i]=pink*0.055;
    }
  }
  return buffer;
}

function createSweepBuffer(audio: AudioContext): AudioBuffer {
  const seconds=10, count=Math.floor(audio.sampleRate*seconds);
  const buffer=audio.createBuffer(1,count,audio.sampleRate);
  const samples=buffer.getChannelData(0);
  const low=20,high=Math.min(20000,audio.sampleRate*.42);
  const logRatio=Math.log(high/low),constant=seconds/logRatio;
  const fadeSamples=Math.floor(audio.sampleRate*.04);
  for(let i=0;i<count;i++){
    const time=i/audio.sampleRate;
    const phase=2*Math.PI*low*constant*(Math.exp(time/constant)-1);
    const fade=Math.min(1,i/fadeSamples,(count-1-i)/fadeSamples);
    samples[i]=Math.sin(phase)*Math.max(0,fade)*.16;
  }
  return buffer;
}

export function useToneGenerator() {
  const ctx = useRef<AudioContext | null>(null);
  const osc = useRef<OscillatorNode | null>(null);
  const bufferSource = useRef<AudioBufferSourceNode | null>(null);
  const gain = useRef<GainNode | null>(null);
  const output = useRef<SinkCapableAudio | null>(null);
  const [frequency, setFrequency] = useState(1000);
  const [volume, setVolume] = useState(-30);
  const [signalType, setSignalType] = useState<SignalType>("sine");
  const [active, setActive] = useState(false);
  const [outputDevice, setOutputDevice] = useState("");
  const [outputError, setOutputError] = useState("");

  const supportsOutputSelection =
    typeof HTMLMediaElement !== "undefined" &&
    "setSinkId" in HTMLMediaElement.prototype;

  const stop = useCallback(() => {
    try { osc.current?.stop(); } catch { /* already stopped */ }
    try { bufferSource.current?.stop(); } catch { /* already stopped */ }
    osc.current?.disconnect();
    bufferSource.current?.disconnect();
    gain.current?.disconnect();
    osc.current = null;
    bufferSource.current = null;
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
      const amplifier = audio.createGain();
      const streamDestination = audio.createMediaStreamDestination();
      const element = output.current ?? (new Audio() as SinkCapableAudio);
      element.autoplay = true;
      element.volume = 1;
      element.srcObject = streamDestination.stream;
      amplifier.gain.value = Math.pow(10, volume / 20) * 0.08;
      amplifier.connect(streamDestination);

      let oscillator: OscillatorNode | null = null;
      let bufferNode: AudioBufferSourceNode | null = null;
      if (signalType === "sine") {
        oscillator = audio.createOscillator();
        oscillator.type = "sine";
        oscillator.frequency.value = frequency;
        oscillator.connect(amplifier);
      } else {
        bufferNode = audio.createBufferSource();
        bufferNode.buffer = signalType === "sweep"
          ? createSweepBuffer(audio)
          : createNoiseBuffer(audio, signalType);
        bufferNode.loop = true;
        bufferNode.connect(amplifier);
      }

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
      bufferSource.current = bufferNode;
      gain.current = amplifier;
      oscillator?.start();
      bufferNode?.start();
      setActive(true);
    } catch (error) {
      if (audio && audio.state !== "closed") await audio.close().catch(() => undefined);
      setOutputError(error instanceof Error ? error.message : "Không thể khởi động bộ phát tín hiệu.");
    }
  }, [frequency, outputDevice, signalType, stop, volume]);

  useEffect(() => {
    if (osc.current && ctx.current && signalType === "sine") {
      osc.current.frequency.setTargetAtTime(frequency, ctx.current.currentTime, 0.02);
    }
  }, [frequency, signalType]);

  useEffect(() => {
    if (gain.current && ctx.current) {
      gain.current.gain.setTargetAtTime(Math.pow(10, volume / 20) * 0.08, ctx.current.currentTime, 0.02);
    }
  }, [volume]);

  useEffect(() => {
    if (active) stop();
  }, [signalType, stop]);

  useEffect(() => () => {
    try { osc.current?.stop(); } catch { /* already stopped */ }
    try { bufferSource.current?.stop(); } catch { /* already stopped */ }
    output.current?.pause();
    if (output.current) output.current.srcObject = null;
    void ctx.current?.close().catch(() => undefined);
  }, []);

  return {
    frequency, setFrequency, volume, setVolume, signalType, setSignalType,
    active, start, stop, outputDevice, selectOutput, supportsOutputSelection, outputError,
  };
}
