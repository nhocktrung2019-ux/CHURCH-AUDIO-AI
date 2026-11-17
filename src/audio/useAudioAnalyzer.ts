import { useCallback, useEffect, useRef, useState } from "react";
import { micCorrectionAt, type MicCalibrationPoint } from "./micCalibration";
import { getRtaSmoothing, type RtaSpeed } from "./rtaDisplaySettings";
import { createLeqIntegrationState, getLeqLevels, integrateLeqSample } from "./leqIntegration";
import {
  explainMicrophoneError,
  readMicrophonePermission,
  requestMicrophoneStream,
  type MicrophonePermissionState,
} from "./microphone";

function estimateRt60(samples: Float32Array, sampleRate: number): number | null {
  if (!samples.length) return null;
  const energy = new Float64Array(samples.length);
  let sum = 0;
  for (let i = samples.length - 1; i >= 0; i--) {
    sum += samples[i] * samples[i];
    energy[i] = sum;
  }

  const total = energy[0];
  if (!(total > 0)) return null;

  const db = new Float32Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    db[i] = 10 * Math.log10(Math.max(energy[i] / total, 1e-12));
  }

  const start = db.findIndex((value) => value <= -5);
  let end = -1;
  for (let i = start + 1; i < db.length; i++) {
    if (db[i] <= -25) {
      end = i;
      break;
    }
  }
  if (start < 0 || end <= start) return null;

  let n = 0;
  let sx = 0;
  let sy = 0;
  let sxx = 0;
  let sxy = 0;
  const stride = Math.max(1, Math.floor((end - start) / 4000));
  for (let i = start; i <= end; i += stride) {
    const x = i / sampleRate;
    const y = db[i];
    n++;
    sx += x;
    sy += y;
    sxx += x * x;
    sxy += x * y;
  }

  const denominator = n * sxx - sx * sx;
  const slope = denominator ? (n * sxy - sx * sy) / denominator : 0;
  if (slope >= -1 || slope < -600 || !Number.isFinite(slope)) return null;

  const rt60 = -60 / slope;
  if (rt60 < 0.1 || rt60 > 10) return null;
  return Math.round(rt60 * 100) / 100;
}

function createAudioContext(): AudioContext {
  const audioWindow = window as Window & { webkitAudioContext?: typeof AudioContext };
  const AudioContextClass = window.AudioContext || audioWindow.webkitAudioContext;
  if (!AudioContextClass) throw new Error("Thiết bị không hỗ trợ Web Audio API. Hãy cập nhật Android System WebView/Chrome.");
  return new AudioContextClass();
}

function stopTracks(stream: MediaStream | null): void {
  stream?.getTracks().forEach((track) => track.stop());
}

export function useAudioAnalyzer(calibrationPoints: MicCalibrationPoint[] = [], analysisSpeed: RtaSpeed = "medium") {
  const contextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sessionRef = useRef(0);

  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedInput, setSelectedInput] = useState("");
  const [running, setRunning] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [level, setLevel] = useState(-100);
  const [rmsDbfs, setRmsDbfs] = useState(-100);
  const [weightedLevels, setWeightedLevels] = useState({ z: -100, a: -100, c: -100 });
  const [leqLevels, setLeqLevels] = useState({ z: -100, a: -100, c: -100 });
  const [timeWeightedLevels, setTimeWeightedLevels] = useState({ af: -100, as: -100, cf: -100, cs: -100 });
  const [measurementSeconds, setMeasurementSeconds] = useState(0);
  const integrationRef = useRef<ReturnType<typeof createLeqIntegrationState> & { af: number; as: number; cf: number; cs: number }>({ ...createLeqIntegrationState(), af: 0, as: 0, cf: 0, cs: 0 });
  const startedAtRef = useRef<number | null>(null);
  const [spectrum, setSpectrum] = useState<number[]>(Array(64).fill(-100));
  const [history, setHistory] = useState<number[][]>([]);
  const [error, setError] = useState("");
  const [fallbackNotice, setFallbackNotice] = useState("");
  const [permissionState, setPermissionState] = useState<MicrophonePermissionState>("unknown");
  const [trackInfo, setTrackInfo] = useState("");
  const [rt60, setRt60] = useState<number | null>(null);
  const [capturingRt60, setCapturingRt60] = useState(false);

  const refreshDevices = useCallback(async () => {
    try {
      if (!navigator.mediaDevices?.enumerateDevices) {
        setDevices([]);
        return;
      }
      const listed = await navigator.mediaDevices.enumerateDevices();
      setDevices(
        listed
          .filter((device) => device.kind === "audioinput" || device.kind === "audiooutput")
          .sort((a, b) => a.kind.localeCompare(b.kind)),
      );
    } catch {
      // Device enumeration is optional on older WebViews; the default microphone can still work.
      setDevices([]);
    }
  }, []);

  const stop = useCallback(() => {
    sessionRef.current += 1;
    stopTracks(streamRef.current);
    streamRef.current = null;
    sourceRef.current?.disconnect();
    sourceRef.current = null;
    analyserRef.current?.disconnect();
    analyserRef.current = null;

    const previousContext = contextRef.current;
    contextRef.current = null;
    if (previousContext && previousContext.state !== "closed") {
      void previousContext.close().catch(() => undefined);
    }

    setRunning(false);
    setConnecting(false);
    setLevel(-100);
    setRmsDbfs(-100);
    setWeightedLevels({ z: -100, a: -100, c: -100 });
    setLeqLevels({ z: -100, a: -100, c: -100 });
    setTimeWeightedLevels({ af: -100, as: -100, cf: -100, cs: -100 });
    setMeasurementSeconds(0);
    integrationRef.current = { ...createLeqIntegrationState(), af: 0, as: 0, cf: 0, cs: 0 };
    startedAtRef.current = null;
    setTrackInfo("");
  }, []);

  const start = useCallback(async () => {
    stop();
    const session = sessionRef.current;
    setError("");
    setFallbackNotice("");
    setRt60(null);
    setConnecting(true);

    let stream: MediaStream | null = null;
    let audio: AudioContext | null = null;
    let source: MediaStreamAudioSourceNode | null = null;

    try {
      const requested = await requestMicrophoneStream(selectedInput);
      stream = requested.stream;

      if (session !== sessionRef.current) {
        stopTracks(stream);
        return;
      }

      audio = createAudioContext();
      await audio.resume();
      if (audio.state !== "running") {
        throw new Error("Audio engine chưa chạy. Hãy chạm Bắt đầu đo lần nữa và kiểm tra chế độ im lặng/tiết kiệm pin.");
      }

      const track = stream.getAudioTracks()[0];
      if (!track || track.readyState !== "live") {
        throw new Error("Microphone đã được cấp quyền nhưng không có luồng âm thanh hoạt động. Hãy chọn lại thiết bị đầu vào.");
      }

      source = audio.createMediaStreamSource(stream);
      const analyser = audio.createAnalyser();
      analyser.fftSize = 8192;
      analyser.smoothingTimeConstant = getRtaSmoothing(analysisSpeed);
      source.connect(analyser);

      if (session !== sessionRef.current) {
        stopTracks(stream);
        source.disconnect();
        await audio.close();
        return;
      }

      streamRef.current = stream;
      contextRef.current = audio;
      sourceRef.current = source;
      analyserRef.current = analyser;
      stream = null;
      audio = null;
      source = null;

      const settings = track.getSettings?.();
      const actualDevice = track.label || "Microphone mặc định";
      const sampleRate = settings?.sampleRate ? `${settings.sampleRate} Hz` : "sample rate tự động";
      const channels = settings?.channelCount ? `${settings.channelCount} kênh` : "kênh tự động";
      setTrackInfo(`${actualDevice} · ${sampleRate} · ${channels}`);
      setPermissionState("granted");
      setFallbackNotice(
        requested.usedFallbackInput
          ? "Micro đã chọn không còn khả dụng; ứng dụng đã tự chuyển sang micro mặc định hệ thống."
          : "",
      );
      setHistory([]);
      integrationRef.current = { ...createLeqIntegrationState(), af: 0, as: 0, cf: 0, cs: 0 };
      startedAtRef.current = Date.now();
      setLeqLevels({ z: -100, a: -100, c: -100 });
      setTimeWeightedLevels({ af: -100, as: -100, cf: -100, cs: -100 });
      setMeasurementSeconds(0);
      setRunning(true);

      track.addEventListener(
        "ended",
        () => {
          if (sessionRef.current !== session) return;
          stop();
          setError("Microphone đã bị ngắt. Hãy kết nối lại thiết bị và bấm Bắt đầu đo.");
        },
        { once: true },
      );

      await refreshDevices();
    } catch (cause) {
      source?.disconnect();
      stopTracks(stream);
      if (audio && audio.state !== "closed") await audio.close().catch(() => undefined);

      if (session === sessionRef.current) {
        const name = cause instanceof Error ? cause.name : "";
        if (name === "NotAllowedError" || name === "PermissionDeniedError") {
          setPermissionState("denied");
        } else {
          const permission = await readMicrophonePermission();
          setPermissionState(permission);
        }
        setError(explainMicrophoneError(cause));
        setRunning(false);
      }
    } finally {
      if (session === sessionRef.current) setConnecting(false);
    }
  }, [refreshDevices, selectedInput, stop]);

  const captureRt60 = useCallback(async () => {
    const stream = streamRef.current;
    if (!stream || contextRef.current?.state !== "running") {
      setError("Hãy bắt đầu đo microphone trước khi ghi mẫu RT60.");
      return;
    }
    if (typeof MediaRecorder === "undefined") {
      setError("Thiết bị/trình duyệt không hỗ trợ ghi âm để ước tính RT60.");
      return;
    }

    setCapturingRt60(true);
    setError("");
    try {
      const mimeType = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm"].find((type) =>
        MediaRecorder.isTypeSupported(type),
      );
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size) chunks.push(event.data);
      };

      const finished = new Promise<Blob>((resolve, reject) => {
        recorder.onstop = () =>
          resolve(new Blob(chunks, { type: recorder.mimeType || mimeType || "audio/webm" }));
        recorder.onerror = () => reject(new Error("Không ghi được mẫu âm thanh từ microphone."));
      });

      recorder.start();
      await new Promise<void>((resolve) => window.setTimeout(resolve, 6000));
      if (recorder.state === "recording") recorder.stop();
      const blob = await finished;
      if (!blob.size) throw new Error("Bản ghi microphone trống. Kiểm tra quyền và tín hiệu đầu vào.");

      const decodeContext = createAudioContext();
      let buffer: AudioBuffer;
      try {
        buffer = await decodeContext.decodeAudioData(await blob.arrayBuffer());
      } finally {
        await decodeContext.close().catch(() => undefined);
      }

      const mono = new Float32Array(buffer.length);
      for (let channelIndex = 0; channelIndex < buffer.numberOfChannels; channelIndex++) {
        const channel = buffer.getChannelData(channelIndex);
        for (let i = 0; i < channel.length; i++) {
          mono[i] += channel[i] / buffer.numberOfChannels;
        }
      }

      const result = estimateRt60(mono, buffer.sampleRate);
      setRt60(result);
      if (result === null) {
        setError("Không tìm thấy đoạn suy giảm đủ 20 dB. Hãy phát sweep/impulse rõ ở mức an toàn và đo trong phòng yên tĩnh.");
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không phân tích được mẫu RT60.");
    } finally {
      setCapturingRt60(false);
    }
  }, []);

  useEffect(() => {
    if (analyserRef.current) analyserRef.current.smoothingTimeConstant = getRtaSmoothing(analysisSpeed);
  }, [analysisSpeed]);

  useEffect(() => {
    let frameId = 0;
    let frame = 0;

    if (running) {
      const tick = () => {
        const analyser = analyserRef.current;
        if (analyser) {
          // 30 Hz is sufficient for a live spectrum and reduces Android WebView CPU use.
          if (frame % 2 === 0) {
            const data = new Float32Array(analyser.frequencyBinCount);
            analyser.getFloatFrequencyData(data);

            const context = contextRef.current;
            const fftSize = analyser.fftSize;
            const nyquist = context ? context.sampleRate / 2 : 24000;
            const minimumHz = 20;
            const maximumHz = Math.min(20000, nyquist);
            const ratio = maximumHz / minimumHz;
            const bins = Array.from({ length: 64 }, (_, index) => {
              const lowerHz = minimumHz * Math.pow(ratio, index / 64);
              const upperHz = minimumHz * Math.pow(ratio, (index + 1) / 64);
              const start = Math.max(1, Math.floor(lowerHz * fftSize / (context?.sampleRate ?? 48000)));
              const end = Math.min(data.length, Math.max(start + 1, Math.ceil(upperHz * fftSize / (context?.sampleRate ?? 48000))));
              let power = 0, count = 0;
              for (let i = start; i < end; i++) {
                if (Number.isFinite(data[i]) && data[i] > -120) {
                  power += Math.pow(10, data[i] / 10);
                  count++;
                }
              }
              const bandDb = count ? 10 * Math.log10(power / count) : -100;
              const correctionDb = micCorrectionAt(calibrationPoints, Math.sqrt(lowerHz * upperHz));
              return Math.max(-100, Math.min(24, bandDb + correctionDb));
            });

            const timeData = new Float32Array(fftSize);
            analyser.getFloatTimeDomainData(timeData);
            let inputPeak = 0, sumSquares = 0, mean = 0;
            for (let i = 0; i < timeData.length; i++) mean += timeData[i];
            mean /= Math.max(1, timeData.length);
            for (let i = 0; i < timeData.length; i++) {
              const sample = timeData[i] - mean;
              inputPeak = Math.max(inputPeak, Math.abs(sample));
              sumSquares += sample * sample;
            }
            const rms = Math.sqrt(sumSquares / Math.max(1, timeData.length));
            const peakDbfs = inputPeak > 0 ? 20 * Math.log10(inputPeak) : -100;
            const rmsLevelDbfs = rms > 0 ? 20 * Math.log10(rms) : -100;
            let totalSpectrumPower = 0, zPower = 0, aPower = 0, cPower = 0;
            const sampleRate = context?.sampleRate ?? 48000;
            for (let k = 1; k < data.length; k++) {
              if (!Number.isFinite(data[k]) || data[k] <= -120) continue;
              const hz = k * sampleRate / fftSize;
              const correctionDb = micCorrectionAt(calibrationPoints, hz);
              const power = Math.pow(10, (data[k] + correctionDb) / 10);
              totalSpectrumPower += power;
              if (hz < 20 || hz > Math.min(20000, sampleRate / 2)) continue;
              const f2 = hz * hz, f1 = 20.6, f2a = 107.7, f3 = 737.9, f4 = 12200;
              const aNumerator = f4 * f4 * f2 * f2;
              const aDenominator = (f2 + f1 * f1) * Math.sqrt(f2 + f2a * f2a) * Math.sqrt(f2 + f3 * f3) * (f2 + f4 * f4);
              const aWeightDb = 20 * Math.log10(Math.max(1e-20, aNumerator / aDenominator)) + 2.0;
              const cNumerator = f4 * f4 * f2;
              const cDenominator = (f2 + f1 * f1) * (f2 + f4 * f4);
              const cWeightDb = 20 * Math.log10(Math.max(1e-20, cNumerator / cDenominator)) + 0.06;
              zPower += power;
              aPower += power * Math.pow(10, aWeightDb / 10);
              cPower += power * Math.pow(10, cWeightDb / 10);
            }
            const bandRatio = totalSpectrumPower > 0 ? zPower / totalSpectrumPower : 1;
            const zLevel = rmsLevelDbfs + 10 * Math.log10(Math.max(1e-12, bandRatio));
            const aLevel = rmsLevelDbfs + 10 * Math.log10(Math.max(1e-12, totalSpectrumPower > 0 ? aPower / totalSpectrumPower : 1));
            const cLevel = rmsLevelDbfs + 10 * Math.log10(Math.max(1e-12, totalSpectrumPower > 0 ? cPower / totalSpectrumPower : 1));
            const safeLevels = { z: Math.max(-100, Math.min(0, zLevel)), a: Math.max(-100, Math.min(0, aLevel)), c: Math.max(-100, Math.min(0, cLevel)) };
            const previousTime = integrationRef.current.lastTime;
            const elapsed = integrateLeqSample(
              integrationRef.current,
              safeLevels,
              performance.now() / 1000,
            );
            const instantaneousA = Math.pow(10, safeLevels.a / 10);
            const instantaneousC = Math.pow(10, safeLevels.c / 10);
            if (previousTime === null) {
              integrationRef.current.af = instantaneousA;
              integrationRef.current.as = instantaneousA;
              integrationRef.current.cf = instantaneousC;
              integrationRef.current.cs = instantaneousC;
            } else if (elapsed !== null) {
              const fastAlpha = 1 - Math.exp(-elapsed / 0.125);
              const slowAlpha = 1 - Math.exp(-elapsed / 1.0);
              integrationRef.current.af += (instantaneousA - integrationRef.current.af) * fastAlpha;
              integrationRef.current.as += (instantaneousA - integrationRef.current.as) * slowAlpha;
              integrationRef.current.cf += (instantaneousC - integrationRef.current.cf) * fastAlpha;
              integrationRef.current.cs += (instantaneousC - integrationRef.current.cs) * slowAlpha;
            }
            setWeightedLevels(safeLevels);
            setTimeWeightedLevels({
              af: 10 * Math.log10(Math.max(1e-12, integrationRef.current.af)),
              as: 10 * Math.log10(Math.max(1e-12, integrationRef.current.as)),
              cf: 10 * Math.log10(Math.max(1e-12, integrationRef.current.cf)),
              cs: 10 * Math.log10(Math.max(1e-12, integrationRef.current.cs)),
            });
            setLeqLevels(getLeqLevels(integrationRef.current));
            setMeasurementSeconds(startedAtRef.current === null ? 0 : (Date.now() - startedAtRef.current) / 1000);
            setSpectrum(bins);
            setLevel(Math.max(-100, Math.min(0, peakDbfs)));
            setRmsDbfs(Math.max(-100, Math.min(0, rmsLevelDbfs)));
            if (frame % 6 === 0) {
              setHistory((current) => [...current.slice(-39), bins]);
            }
          }
          frame++;
          frameId = requestAnimationFrame(tick);
        }
      };
      frameId = requestAnimationFrame(tick);
    }

    return () => cancelAnimationFrame(frameId);
  }, [running, calibrationPoints]);

  useEffect(() => {
    void refreshDevices();
    void readMicrophonePermission().then(setPermissionState);

    const mediaDevices = navigator.mediaDevices;
    const onDeviceChange = () => void refreshDevices();
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") void refreshDevices();
    };

    mediaDevices?.addEventListener?.("devicechange", onDeviceChange);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      mediaDevices?.removeEventListener?.("devicechange", onDeviceChange);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      sessionRef.current += 1;
      stopTracks(streamRef.current);
      streamRef.current = null;
      sourceRef.current?.disconnect();
      analyserRef.current?.disconnect();
      void contextRef.current?.close().catch(() => undefined);
      contextRef.current = null;
    };
  }, [refreshDevices]);

  return {
    devices,
    selectedInput,
    setSelectedInput,
    running,
    connecting,
    level,
    rmsDbfs,
    weightedLevels,
    leqLevels,
    timeWeightedLevels,
    measurementSeconds,
    spectrum,
    history,
    error,
    fallbackNotice,
    permissionState,
    trackInfo,
    start,
    stop,
    refreshDevices,
    rt60,
    captureRt60,
    capturingRt60,
  };
}
