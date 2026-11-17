import { useMemo, useState } from "react";
import { usePersistentState } from "./usePersistentState";
import { Activity, Play, Square, AlertTriangle, Download, Waves } from "lucide-react";
import { analyzeSynchronousTransfer, analyzeTransfer, makeReferenceNoise, measurePcmCaptureQuality, type TransferResult } from "./transfer";
import { deinterleaveInterleavedPcm, mixInterleavedPcmToMono } from "./pcmCapture.ts";
import { PcmCaptureIntegrityMonitor } from "./pcmCaptureIntegrity";
import { assessAutoEqReadiness, suggestParametricEq } from "./autoEq";
import { comparePhaseInBand } from "./phaseAlignment";
import { explainMicrophoneError, requestMicrophoneStream } from "./microphone";
import type { MicCalibrationPoint } from "./micCalibration";
import {
  assessChannelCalibrationRepeatability,
  applyDifferentialChannelCalibration,
  correctDifferentialLoopbackDelayMs,
  deleteChannelCalibrationProfile,
  loadChannelCalibrationProfile,
  saveChannelCalibrationProfile,
  validateChannelCalibrationProfile,
  type ChannelCalibrationProfile,
} from "./channelCalibration";

export default function TransferFunctionPanel({ selectedInput, selectedOutput, running, calibrationPoints = [] }: { selectedInput: string; selectedOutput: string; running: boolean; calibrationPoints?: MicCalibrationPoint[] }) {
  const [result, setResult] = usePersistentState<TransferResult | null>("church-audio-transfer-latest",null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [eqCopied, setEqCopied] = useState(false);
  const [referenceA, setReferenceA] = usePersistentState<TransferResult | null>("church-audio-transfer-reference-a",null);
  const [referenceB, setReferenceB] = usePersistentState<TransferResult | null>("church-audio-transfer-reference-b",null);
  const [crossoverHz, setCrossoverHz] = usePersistentState("church-audio-transfer-crossover",1000);
  const [analysisMode, setAnalysisMode] = usePersistentState<"mono-acoustic" | "synchronous-dual-channel">("church-audio-transfer-mode", "mono-acoustic");
  const [referenceChannel, setReferenceChannel] = usePersistentState("church-audio-transfer-reference-channel", 0);
  const [measurementChannel, setMeasurementChannel] = usePersistentState("church-audio-transfer-measurement-channel", 1);
  const [capturePurpose, setCapturePurpose] = usePersistentState<"transfer" | "channel-calibration">(
    "church-audio-capture-purpose", "transfer",
  );
  const [calibrationChannel, setCalibrationChannel] = usePersistentState("church-audio-calibration-channel", 0);
  const [lastCalibrationProfile, setLastCalibrationProfile] = useState<ChannelCalibrationProfile | null>(null);
  const [pendingCalibrationProfile, setPendingCalibrationProfile] = useState<ChannelCalibrationProfile | null>(null);
  const eqReadiness = useMemo(() => {
    if (!result) return null;
    const base = assessAutoEqReadiness(result.points);
    if (result.analysisMode === "synchronous-dual-channel") {
      return { ...base, ready: false, reason: "Đo hai kênh chưa có hiệu chuẩn riêng cho từng kênh ADC/DAC; chưa mở khóa Auto EQ." };
    }
    const quality = result.captureQuality;
    if (!quality) return { ...base, ready: false, reason: "Phép đo đã lưu từ phiên bản cũ chưa có metadata PCM thô. Hãy đo lại trước khi tạo Auto EQ." };
    if (quality.invalidSamplePercent > 0.01 || quality.clippedSamplePercent > 0.1) {
      return { ...base, ready: false, reason: "Dữ liệu PCM có mẫu lỗi hoặc clipping. Giảm mức vào, kiểm tra gain và đo lại." };
    }
    if (quality.rmsDbfs < -55 || quality.peakDbfs > -0.5) {
      return { ...base, ready: false, reason: "Mức PCM quá thấp hoặc quá sát full-scale. Điều chỉnh gain để có headroom rồi đo lại." };
    }
    return base;
  }, [result]);
  const eq = useMemo(
    () => result && eqReadiness?.ready ? suggestParametricEq(result.points) : [],
    [result, eqReadiness],
  );

  const measure = async () => {
    setBusy(true); setError(""); setNotice(""); setResult(null); setEqCopied(false);
    let stream: MediaStream | undefined, audio: AudioContext | undefined;
    let microphoneSource: MediaStreamAudioSourceNode | undefined;
    let legacyProcessor: ScriptProcessorNode | undefined;
    let workletNode: AudioWorkletNode | undefined;
    let silentGain: GainNode | undefined;
    let source: AudioBufferSourceNode | undefined, playbackGain: GainNode | undefined;
    try {
      if (running) throw new Error("Hãy dừng RTA trực tiếp trước khi đo Transfer Function.");
      const requested = await requestMicrophoneStream(selectedInput);
      stream = requested.stream;
      if (capturePurpose === "channel-calibration" && requested.usedFallbackInput) {
        throw new Error("Không thể hiệu chuẩn khi ứng dụng tự chuyển sang input mặc định. Hãy chọn lại đúng USB interface.");
      }
      if (requested.usedFallbackInput) setNotice("Micro được chọn không khả dụng; đã chuyển sang micro mặc định.");
      audio = new AudioContext();
      if (analysisMode === "synchronous-dual-channel" || capturePurpose === "channel-calibration") {
        if (!selectedOutput) throw new Error("Chọn OUTPUT DEVICE của đúng USB interface đang dùng làm INPUT.");
        const sinkable = audio as AudioContext & { setSinkId?: (sinkId: string) => Promise<void> };
        if (typeof sinkable.setSinkId !== "function") throw new Error("WebView không hỗ trợ AudioContext.setSinkId; không thể xác nhận đường output đến interface đã chọn. Hãy cập nhật WebView.");
        await sinkable.setSinkId(selectedOutput);
      }
      await audio.resume();
      if (audio.state !== "running") throw new Error("Audio engine chưa chạy. Chạm đo lại và kiểm tra quyền micro.");

      const reference = makeReferenceNoise(audio.sampleRate, 5);
      const buffer = audio.createBuffer(1, reference.length, audio.sampleRate);
      buffer.copyToChannel(reference, 0);
      const blockSize = 2048;
      const blocks: Float32Array[] = [];
      let firstBlockPlaybackTime: number | null = null;
      let previousBlockPlaybackTime: number | null = null;
      let missedBlocks = 0;
      let metadataError = "";
      const pcmIntegrity = new PcmCaptureIntegrityMonitor(audio.sampleRate);
      let stableInputChannelCount: number | null = null;
      let workletStopped = false;
      let resolveWorkletStopped: (() => void) | null = null;
      let captureEngine: "AudioWorklet" | "ScriptProcessor fallback" = "AudioWorklet";
      microphoneSource = audio.createMediaStreamSource(stream);

      if (audio.audioWorklet && typeof AudioWorkletNode !== "undefined") {
        try {
          await audio.audioWorklet.addModule("/audio/pcm-capture-worklet.js");
          workletNode = new AudioWorkletNode(audio, "church-pcm-capture", {
            numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1],
            channelCountMode: "max", channelInterpretation: "discrete",
          });
          workletNode.port.onmessage = (event: MessageEvent<{ type?: string; pcm?: ArrayBuffer; frameStart?: number; frameCount?: number; pcmChannelCount?: number; inputChannelCount?: number; channelMix?: string; sampleFormat?: string; sequence?: number; sampleRate?: number; reason?: string }>) => {
            const message = event.data;
            if (message?.type === "stopped") {
              workletStopped = true;
              resolveWorkletStopped?.();
              return;
            }
            if (message?.type === "capture-error") {
              metadataError = message.reason || "AudioWorklet capture error.";
              return;
            }
            if (message?.type !== "pcm" || !(message.pcm instanceof ArrayBuffer)
              || !Number.isSafeInteger(message.frameStart) || !Number.isSafeInteger(message.frameCount)
              || !Number.isInteger(message.pcmChannelCount) || !Number.isInteger(message.inputChannelCount)
              || !Number.isFinite(message.sampleRate)
              || !Number.isSafeInteger(message.sequence)
              || message.channelMix !== "interleaved-preserved"
              || message.sampleFormat !== "float32") {
              metadataError = "AudioWorklet gửi metadata PCM không hợp lệ.";
              missedBlocks++;
              return;
            }
            const pcm = new Float32Array(message.pcm);
            const accepted = pcmIntegrity.accept({
              frameStart: message.frameStart!,
              frameCount: message.frameCount!,
              sampleRate: message.sampleRate!,
              pcmChannelCount: message.pcmChannelCount!,
              inputChannelCount: message.inputChannelCount!,
              byteLength: message.pcm.byteLength,
            }, pcm, message.sequence!, message.channelMix!, message.sampleFormat!);
            if (!accepted.valid) {
              metadataError = accepted.reason;
              missedBlocks++;
              return;
            }
            stableInputChannelCount = pcmIntegrity.getSnapshot().channelCount;
            if (firstBlockPlaybackTime === null) firstBlockPlaybackTime = message.frameStart! / audio!.sampleRate;
            blocks.push(pcm);
          };
          workletNode.onprocessorerror = () => { metadataError = "AudioWorklet processor gặp lỗi trong khi thu."; };
          microphoneSource.connect(workletNode);
          silentGain = audio.createGain();
          silentGain.gain.value = 0;
          workletNode.connect(silentGain);
          silentGain.connect(audio.destination);
        } catch {
          workletNode?.disconnect();
          workletNode = undefined;
          captureEngine = "ScriptProcessor fallback";
          setNotice("AudioWorklet chưa khởi tạo được trên WebView này; đang dùng ScriptProcessor dự phòng đã lỗi thời. Không coi đây là chế độ đo chuẩn cuối cùng.");
        }
      } else {
        captureEngine = "ScriptProcessor fallback";
        setNotice("WebView không hỗ trợ AudioWorklet; đang dùng ScriptProcessor dự phòng đã lỗi thời. Nên cập nhật Android System WebView.");
      }

      if ((analysisMode === "synchronous-dual-channel" || capturePurpose === "channel-calibration") && !workletNode) {
        throw new Error("Đo đồng bộ/hiệu chuẩn loopback yêu cầu AudioWorklet; ScriptProcessor dự phòng không đủ độ tin cậy.");
      }
      if (!workletNode) {
        if (typeof audio.createScriptProcessor !== "function") {
          throw new Error("Thiết bị không hỗ trợ AudioWorklet hoặc ScriptProcessor. Cập nhật Android System WebView/Chrome rồi thử lại.");
        }
        legacyProcessor = audio.createScriptProcessor(blockSize, 1, 1);
        silentGain = audio.createGain();
        silentGain.gain.value = 0;
        legacyProcessor.onaudioprocess = (event) => {
          const playbackTime = event.playbackTime;
          if (!Number.isFinite(playbackTime)) { missedBlocks++; return; }
          if (firstBlockPlaybackTime === null) firstBlockPlaybackTime = playbackTime;
          if (previousBlockPlaybackTime !== null) {
            const expectedSeconds = blockSize / audio!.sampleRate;
            const elapsed = playbackTime - previousBlockPlaybackTime;
            if (elapsed > expectedSeconds * 1.5) missedBlocks += Math.max(1, Math.round(elapsed / expectedSeconds) - 1);
          }
          previousBlockPlaybackTime = playbackTime;
          const input = event.inputBuffer;
          if (!input.numberOfChannels) return;
          if (stableInputChannelCount !== null && input.numberOfChannels !== stableInputChannelCount) {
            metadataError = "ScriptProcessor input channel count changed during capture.";
            missedBlocks++;
            return;
          }
          stableInputChannelCount = input.numberOfChannels;
          const pcm = new Float32Array(input.length);
          for (let channel = 0; channel < input.numberOfChannels; channel++) {
            const samples = input.getChannelData(channel);
            for (let i = 0; i < samples.length; i++) pcm[i] += samples[i] / input.numberOfChannels;
          }
          blocks.push(pcm);
        };
        microphoneSource.connect(legacyProcessor);
        legacyProcessor.connect(silentGain);
        silentGain.connect(audio.destination);
      }

      source = audio.createBufferSource();
      playbackGain = audio.createGain();
      source.buffer = buffer;
      playbackGain.gain.value = 0.18;
      source.connect(playbackGain).connect(audio.destination);
      const playbackStartTime = audio.currentTime + 0.25;
      source.start(playbackStartTime);
      await new Promise<void>(resolve => window.setTimeout(resolve, 5600));
      if (legacyProcessor) legacyProcessor.onaudioprocess = null;
      const activeWorkletNode = workletNode;
      if (activeWorkletNode) {
        await new Promise<void>((resolve) => {
          const timeout = window.setTimeout(resolve, 750);
          resolveWorkletStopped = () => { window.clearTimeout(timeout); resolve(); };
          activeWorkletNode.port.postMessage({ command: "stop" });
        });
        if (!workletStopped) throw new Error("AudioWorklet không xác nhận kết thúc và xả block PCM cuối. Hãy đo lại.");
      }

      if (metadataError) throw new Error(metadataError);
      if (!blocks.length || firstBlockPlaybackTime === null) {
        throw new Error("Không nhận được khung PCM từ microphone. Kiểm tra quyền, input và kết nối USB/OTG.");
      }
      if (missedBlocks > 0) {
        throw new Error("Luồng PCM bị mất hoặc sai thứ tự frame trong lúc đo. Hãy đóng ứng dụng dùng micro, giảm tải thiết bị và đo lại; kết quả không được dùng cho Auto EQ.");
      }
      const totalSamples = blocks.reduce((sum, block) => sum + block.length, 0);
      const interleavedCaptured = new Float32Array(totalSamples);
      let writeOffset = 0;
      for (const block of blocks) { interleavedCaptured.set(block, writeOffset); writeOffset += block.length; }
      const rawPcmChannelCount = captureEngine === "AudioWorklet" ? (stableInputChannelCount ?? 1) : 1;
      if (totalSamples % rawPcmChannelCount !== 0) throw new Error("PCM đa kênh có số mẫu không chia hết theo số kênh.");
      const frameCount = totalSamples / rawPcmChannelCount;
      const integritySnapshot = captureEngine === "AudioWorklet" ? pcmIntegrity.getSnapshot() : null;
      if (captureEngine === "AudioWorklet" && (
        !integritySnapshot
        || integritySnapshot.blocksReceived !== blocks.length
        || integritySnapshot.framesCaptured !== frameCount
        || integritySnapshot.channelCount !== rawPcmChannelCount
      )) {
        throw new Error("PCM integrity totals do not match the assembled capture buffer. Measurement was rejected.");
      }
      const trackSettings = stream.getAudioTracks()[0]?.getSettings() ?? {};

      if (capturePurpose === "channel-calibration") {
        if (captureEngine !== "AudioWorklet" || rawPcmChannelCount < 1) {
          throw new Error("Hiệu chuẩn loopback yêu cầu AudioWorklet và ít nhất một kênh input được bảo toàn.");
        }
        if (audio!.sampleRate > 96000) {
          throw new Error("Hiệu chuẩn kênh hiện yêu cầu sample rate 96 kHz trở xuống để FFT 4096 bao phủ đúng vùng từ 50 Hz. Hãy đặt interface ở 48 kHz hoặc 96 kHz rồi đo lại.");
        }
        if (!selectedInput || !selectedOutput) {
          throw new Error("Phải chọn rõ USB INPUT và OUTPUT DEVICE; không dùng thiết bị mặc định cho hồ sơ hiệu chuẩn.");
        }
        if (!Number.isInteger(calibrationChannel) || calibrationChannel < 0 || calibrationChannel >= rawPcmChannelCount) {
          throw new Error("Kênh hiệu chuẩn không tồn tại trong luồng PCM hiện tại. Kiểm tra số kênh input của interface.");
        }
        const deviceKey = typeof trackSettings.deviceId === "string" && trackSettings.deviceId
          ? trackSettings.deviceId
          : selectedInput;
        const channelData = deinterleaveInterleavedPcm(interleavedCaptured, frameCount, rawPcmChannelCount);
        const calibrationSamples = channelData?.[calibrationChannel];
        if (!calibrationSamples) throw new Error("Không thể tách kênh input cần hiệu chuẩn từ PCM.");
        const captureQuality = measurePcmCaptureQuality(calibrationSamples);
        if (!captureQuality || captureQuality.invalidSamplePercent > 0.01
          || captureQuality.clippedSamplePercent > 0.1
          || captureQuality.rmsDbfs < -55 || captureQuality.peakDbfs > -0.5) {
          throw new Error("Mức loopback không đạt: kiểm tra dây line, pad/attenuator và gain. Tránh clipping; cần RMS > -55 dBFS và peak dưới -0.5 dBFS.");
        }
        const playbackOffsetSeconds = playbackStartTime - firstBlockPlaybackTime;
        if (!Number.isFinite(playbackOffsetSeconds) || playbackOffsetSeconds < 0 || playbackOffsetSeconds > 1) {
          throw new Error("Không xác định được thời điểm phát so với PCM input. Hiệu chuẩn bị hủy.");
        }
        const measured = analyzeTransfer(
          reference, calibrationSamples, audio.sampleRate, [], playbackOffsetSeconds,
        );
        if (!measured || measured.averageCoherence < 0.8 || measured.reliableBandPercent < 75) {
          throw new Error("Coherence loopback không đủ ổn định. Kiểm tra kết nối/gain, giảm nhiễu và đo lại.");
        }
        const profile: ChannelCalibrationProfile = {
          schemaVersion: 1,
          deviceKey,
          inputChannel: calibrationChannel,
          outputKey: selectedOutput,
          sampleRate: audio.sampleRate,
          loopbackDelayMs: measured.estimatedDelayMs,
          points: measured.points
            .filter(point => point.frequencyHz >= (2 * audio.sampleRate / 4096) && point.frequencyHz <= 10000)
            .map(point => ({
              frequencyHz: point.frequencyHz,
              magnitudeDb: point.magnitudeDb,
              phaseDeg: point.phaseDeg,
            })),
        };
        const validation = validateChannelCalibrationProfile(profile);
        if (!validation.valid) throw new Error("Hồ sơ loopback không đạt kiểm tra: " + validation.reason);
        if (!pendingCalibrationProfile
          || pendingCalibrationProfile.deviceKey !== profile.deviceKey
          || pendingCalibrationProfile.inputChannel !== profile.inputChannel
          || pendingCalibrationProfile.outputKey !== profile.outputKey
          || pendingCalibrationProfile.sampleRate !== profile.sampleRate) {
          setPendingCalibrationProfile(profile);
          setNotice(
            "Đã ghi nhận mẫu loopback lần 1 cho CH " + (calibrationChannel + 1)
            + ". Chưa lưu hồ sơ chính thức. Giữ nguyên dây/gain/interface và chạy lại để kiểm tra độ lặp.",
          );
          return;
        }

        const repeatability = assessChannelCalibrationRepeatability(pendingCalibrationProfile, profile);
        if (!repeatability?.stable) {
          setPendingCalibrationProfile(profile);
          throw new Error(
            "Độ lặp loopback chưa đạt nên không lưu hồ sơ. "
            + (repeatability
              ? "Δ magnitude trung bình " + repeatability.meanMagnitudeDeltaDb.toFixed(2)
                + " dB; Δ phase RMS " + repeatability.rmsPhaseDeltaDeg.toFixed(1)
                + "°; Δ delay " + repeatability.delayDeltaMs.toFixed(3) + " ms. "
              : "Không đủ điểm tần số chung để so sánh. ")
            + "Mẫu hiện tại được dùng làm mốc mới; hãy đo lại và giữ nguyên route/gain.",
          );
        }

        let saved = false;
        try {
          saved = saveChannelCalibrationProfile(window.localStorage, profile);
        } catch {
          saved = false;
        }
        if (!saved) throw new Error("Không lưu được hồ sơ hiệu chuẩn vào bộ nhớ thiết bị. Kiểm tra dung lượng/quyền lưu trữ.");
        setPendingCalibrationProfile(null);
        setLastCalibrationProfile(profile);
        setNotice(
          "Đã lưu loopback profile sau 2 lần đo lặp đạt yêu cầu cho input CH " + (calibrationChannel + 1)
          + ". Δmag " + repeatability.meanMagnitudeDeltaDb.toFixed(2)
          + " dB · Δphase RMS " + repeatability.rmsPhaseDeltaDeg.toFixed(1)
          + "° · Δdelay " + repeatability.delayDeltaMs.toFixed(3)
          + " ms. Hồ sơ chỉ hiệu chuẩn đường điện interface.",
        );
        return;
      }

      if (analysisMode === "synchronous-dual-channel") {
        if (captureEngine !== "AudioWorklet" || rawPcmChannelCount < 2) {
          throw new Error("Input hiện chỉ cung cấp một kênh hoặc không dùng AudioWorklet. Cần USB interface trả về ít nhất hai kênh trong cùng một stream.");
        }
        if (!Number.isInteger(referenceChannel) || !Number.isInteger(measurementChannel)
          || referenceChannel < 0 || measurementChannel < 0
          || referenceChannel >= rawPcmChannelCount || measurementChannel >= rawPcmChannelCount
          || referenceChannel === measurementChannel) {
          throw new Error("Reference và Measurement phải là hai kênh khác nhau, tồn tại trên input hiện tại.");
        }
        const channelData = deinterleaveInterleavedPcm(interleavedCaptured, frameCount, rawPcmChannelCount);
        if (!channelData) throw new Error("Không thể tách PCM theo từng kênh. Dữ liệu capture không hợp lệ.");
        const referenceSamples = channelData[referenceChannel];
        const measurementSamples = channelData[measurementChannel];
        const referenceCaptureQuality = measurePcmCaptureQuality(referenceSamples);
        const captureQuality = measurePcmCaptureQuality(measurementSamples);
        if (!referenceCaptureQuality || !captureQuality) throw new Error("Kênh Reference hoặc Measurement không có dữ liệu PCM hợp lệ.");
        if (referenceCaptureQuality.clippedSamplePercent > 0.1 || captureQuality.clippedSamplePercent > 0.1) {
          throw new Error("Reference hoặc Measurement đang clipping. Giảm gain ngõ loopback/micro rồi đo lại.");
        }
        if (referenceCaptureQuality.rmsDbfs < -70 || captureQuality.rmsDbfs < -70) {
          throw new Error("Mức tín hiệu Reference hoặc Measurement quá thấp. Kiểm tra dây loopback, gain input và micro.");
        }
        const measured = analyzeSynchronousTransfer(
          referenceSamples, measurementSamples, audio.sampleRate, calibrationPoints,
        );
        if (!measured) throw new Error("Không tìm thấy tín hiệu tương quan đủ rõ giữa Reference và Measurement. Kiểm tra loopback, dây nối, gain và chọn đúng kênh.");
        const captureMetadata = {
          captureEngine,
          inputChannelCount: stableInputChannelCount,
          pcmChannelCount: rawPcmChannelCount,
          channelMix: "interleaved-preserved-synchronous-pair" as const,
          trackChannelCount: Number.isInteger(trackSettings.channelCount) ? trackSettings.channelCount! : null,
          trackSampleRate: Number.isFinite(trackSettings.sampleRate) ? trackSettings.sampleRate! : null,
          analysisMode,
          referenceChannel,
          measurementChannel,
          clockBasis: "same-mediastream-audioworklet-frame-clock" as const,
          hardwareClockStatus: "not-verified" as const,
          pcmIntegrity: integritySnapshot,
          referenceCaptureQuality,
        };
        const deviceKey = typeof trackSettings.deviceId === "string" && trackSettings.deviceId
          ? trackSettings.deviceId
          : selectedInput;
        let calibratedPoints = null as typeof measured.points | null;
        let calibratedDelay: number | null = null;
        try {
          if (deviceKey && selectedOutput) {
            const storage = window.localStorage;
            const referenceProfile = loadChannelCalibrationProfile(storage, {
              deviceKey, inputChannel: referenceChannel, outputKey: selectedOutput, sampleRate: audio.sampleRate,
            });
            const measurementProfile = loadChannelCalibrationProfile(storage, {
              deviceKey, inputChannel: measurementChannel, outputKey: selectedOutput, sampleRate: audio.sampleRate,
            });
            if (referenceProfile && measurementProfile) {
              calibratedPoints = applyDifferentialChannelCalibration(
                measured.points, referenceProfile, measurementProfile,
              );
              calibratedDelay = correctDifferentialLoopbackDelayMs(
                measured.estimatedDelayMs, referenceProfile, measurementProfile,
              );
            }
          }
        } catch {
          // Missing browser storage never blocks raw measurement.
        }
        if (calibratedPoints && calibratedDelay !== null) {
          setResult({
            ...measured,
            points: calibratedPoints,
            estimatedDelayMs: calibratedDelay,
            captureQuality,
            captureMetadata,
          });
          setNotice(
            "Đã áp dụng hiệu chuẩn vi sai cho Reference CH " + (referenceChannel + 1)
            + " và Measurement CH " + (measurementChannel + 1)
            + ". Biểu đồ chỉ hiển thị dải tần được cả hai hồ sơ cùng bao phủ; Auto EQ vẫn khóa cho đến khi kiểm chứng phần cứng.",
          );
        } else {
          setResult({ ...measured, captureQuality, captureMetadata });
          setNotice(
            "Đã đo đồng bộ hai kênh cùng AudioWorklet clock nhưng chưa tìm thấy đủ hai hồ sơ loopback tương thích. "
            + "Kết quả hiện là dữ liệu thô, chưa bù lệch đáp tuyến/pha/latency giữa kênh; Auto EQ vẫn khóa an toàn.",
          );
        }
        return;
      }

      const captured = captureEngine === "AudioWorklet"
        ? mixInterleavedPcmToMono(interleavedCaptured, frameCount, rawPcmChannelCount)
        : interleavedCaptured;
      if (!captured) throw new Error("Không thể giải mã PCM đa kênh; dữ liệu bị sai cấu trúc hoặc có mẫu không hợp lệ.");
      const playbackOffsetSeconds = playbackStartTime - firstBlockPlaybackTime;
      if (!Number.isFinite(playbackOffsetSeconds) || playbackOffsetSeconds < 0 || playbackOffsetSeconds > 1) {
        throw new Error("Không xác định được thời điểm bắt đầu phát so với PCM capture. Hãy đo lại.");
      }
      const captureQuality = measurePcmCaptureQuality(captured);
      if (!captureQuality) throw new Error("Dữ liệu PCM không hợp lệ hoặc rỗng.");
      const measured = analyzeTransfer(
        reference, captured, audio.sampleRate, calibrationPoints, playbackOffsetSeconds,
      );
      if (!measured) throw new Error("Không tìm được tín hiệu tham chiếu đủ rõ. Kiểm tra loa, micro, tiếng ồn và mức phát.");
      const fallbackWarning = captureEngine === "ScriptProcessor fallback"
        ? " CẢNH BÁO: phiên đo đang dùng ScriptProcessor dự phòng đã lỗi thời; nên cập nhật WebView và đo lại bằng AudioWorklet."
        : "";
      if (measured.averageCoherence < 0.6) {
        setNotice("Coherence thấp: phép đo có thể bị nhiễu, phản xạ hoặc tín hiệu không ổn định. Không dùng EQ tự động từ lần đo này." + fallbackWarning);
      } else if (captureQuality.clippedSamplePercent > 0.1 || captureQuality.rmsDbfs < -55 || captureQuality.peakDbfs > -0.5) {
        setNotice("PCM đã được thu không nén. Tuy nhiên, mức vào/clipping chưa đạt điều kiện Auto EQ; điều chỉnh gain và đo lại." + fallbackWarning);
      } else if (captureEngine === "AudioWorklet") {
        setNotice("Đã thu PCM thô bằng AudioWorklet trên sample clock của AudioContext; pre-roll đã được bù. Đường đo vẫn là loa–phòng–micro, chưa phải loopback đồng bộ hai kênh.");
      } else {
        setNotice("Đã thu PCM bằng ScriptProcessor dự phòng; kết quả cần được kiểm tra lại bằng AudioWorklet trước khi dùng cho nghiệm thu." + fallbackWarning);
      }
      const captureMetadata = {
        captureEngine,
        inputChannelCount: stableInputChannelCount,
        pcmChannelCount: rawPcmChannelCount,
        channelMix: captureEngine === "AudioWorklet" && rawPcmChannelCount > 1
          ? "interleaved-preserved-then-arithmetic-mean" as const
          : captureEngine === "ScriptProcessor fallback" && (stableInputChannelCount ?? 1) > 1
            ? "arithmetic-mean" as const
            : "direct-mono" as const,
        trackChannelCount: Number.isInteger(trackSettings.channelCount) ? trackSettings.channelCount! : null,
        trackSampleRate: Number.isFinite(trackSettings.sampleRate) ? trackSettings.sampleRate! : null,
        analysisMode,
        pcmIntegrity: integritySnapshot,
      };
      setResult({ ...measured, captureQuality, captureMetadata });
    } catch (cause) {
      setError(explainMicrophoneError(cause));
    } finally {
      legacyProcessor && (legacyProcessor.onaudioprocess = null);
      workletNode && (workletNode.port.onmessage = null);
      microphoneSource?.disconnect();
      legacyProcessor?.disconnect();
      workletNode?.disconnect();
      silentGain?.disconnect();
      source?.disconnect(); playbackGain?.disconnect();
      stream?.getTracks().forEach(track => track.stop());
      await audio?.close().catch(() => undefined);
      setBusy(false);
    }
  };

  const exportEq = () => {
    if (!eq.length) return;
    const payload = {
      format: "Church Audio Parametric EQ Suggestion",
      status: "advisory-not-applied",
      generatedAt: new Date().toISOString(),
      requirements: "Verify by listening and repeat measurement before manual DSP entry. No parameters are written to hardware.",
      measurement: { sampleRate: result?.sampleRate, averageCoherence: result?.averageCoherence, captureQuality: result?.captureQuality, captureMetadata: result?.captureMetadata },
      filters: eq.map((filter, index) => ({
        band: index + 1, type: "PEQ", frequencyHz: filter.frequencyHz,
        gainDb: filter.gainDb, q: filter.q, coherence: Number(filter.coherence.toFixed(3)),
      })),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url; anchor.download = "church-audio-peq-suggestion.json"; anchor.click();
    URL.revokeObjectURL(url);
    setEqCopied(true);
  };

  const exportCalibrationProfile = () => {
    if (!lastCalibrationProfile) return;
    const blob = new Blob([JSON.stringify(lastCalibrationProfile, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "church-audio-channel-calibration-ch" + (lastCalibrationProfile.inputChannel + 1) + ".json";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const removeCalibrationProfile = () => {
    if (!lastCalibrationProfile) return;
    try {
      const removed = deleteChannelCalibrationProfile(window.localStorage, lastCalibrationProfile);
      if (removed) {
        setLastCalibrationProfile(null);
        setNotice("Đã xóa hồ sơ hiệu chuẩn khỏi bộ nhớ ứng dụng.");
      } else {
        setError("Không xóa được hồ sơ hiệu chuẩn khỏi bộ nhớ ứng dụng.");
      }
    } catch {
      setError("Bộ nhớ trình duyệt không khả dụng; không thể xóa hồ sơ hiệu chuẩn.");
    }
  };

  const phasePoints = result?.points.filter(p => p.frequencyHz >= 30 && p.frequencyHz <= 18000) ?? [];
  const phaseMin = phasePoints.length ? Math.min(...phasePoints.map(p => p.phaseDeg)) : -180;
  const phaseMax = phasePoints.length ? Math.max(...phasePoints.map(p => p.phaseDeg)) : 180;
  const phaseRange = Math.max(90, phaseMax - phaseMin);
  const phasePath = phasePoints.map((p, index) => {
    const x = Math.log(p.frequencyHz / 30) / Math.log(18000 / 30) * 740 + 10;
    const y = 100 - ((p.phaseDeg - phaseMin) / phaseRange) * 88;
    return (index ? "L" : "M") + x.toFixed(1) + " " + y.toFixed(1);
  }).join(" ");

  const phaseComparison = useMemo(() => {
    if (!referenceA || !referenceB) return null;
    return comparePhaseInBand(referenceA.points, referenceB.points, crossoverHz);
  }, [referenceA, referenceB, crossoverHz]);

  return <section className="panel transfer-pro-panel" id="transfer">
    <div className="heading"><Activity /><h2>Transfer Function · Magnitude · Phase · Coherence</h2><span>WELCH H1</span></div>
    <p className="muted">{capturePurpose === "channel-calibration"
      ? "Đo loopback điện từ output đã chọn sang một input cụ thể. Hồ sơ được lưu theo USB interface, input channel, output và sample rate."
      : analysisMode === "synchronous-dual-channel"
        ? "Đo H1 đồng thời từ hai kênh của cùng một USB interface và cùng AudioWorklet clock. Phase không bị căn chỉnh độc lập; độ chính xác cuối cùng vẫn phụ thuộc hiệu chuẩn đường tín hiệu và độ lệch ADC/DAC."
        : "Tạo tín hiệu broadband tham chiếu, ghi micro, căn chỉnh thời gian và ước tính H1 transfer function bằng averaging. Chế độ mono này không dùng để xác định delay loa tuyệt đối."}</p>
    <div className="phase-ab-controls">
      <label>CAPTURE TASK
        <select value={capturePurpose} onChange={event => setCapturePurpose(event.target.value as typeof capturePurpose)} disabled={busy}>
          <option value="transfer">Transfer / acoustic measurement</option>
          <option value="channel-calibration">USB channel loopback calibration</option>
        </select>
      </label>
      <label>MEASUREMENT MODE
        <select value={analysisMode} onChange={event => setAnalysisMode(event.target.value as typeof analysisMode)} disabled={busy || capturePurpose === "channel-calibration"}>
          <option value="mono-acoustic">Single microphone · mono</option>
          <option value="synchronous-dual-channel">Synchronous loopback · 2 channels</option>
        </select>
      </label>
      {capturePurpose === "channel-calibration" && <label>INPUT CHANNEL TO CALIBRATE (ZERO-BASED)
        <input type="number" min="0" max="31" step="1" value={calibrationChannel}
          onChange={event => setCalibrationChannel(Math.max(0, Math.min(31, Math.floor(Number(event.target.value) || 0))))}
          disabled={busy} />
      </label>}
      {analysisMode === "synchronous-dual-channel" && capturePurpose !== "channel-calibration" && <>
        <label>REFERENCE INPUT
          <select value={referenceChannel} onChange={event => setReferenceChannel(Number(event.target.value))} disabled={busy}>
            {Array.from({length: 32}, (_, index) => <option key={index} value={index}>CH {index + 1}</option>)}
          </select>
        </label>
        <label>MEASUREMENT INPUT
          <select value={measurementChannel} onChange={event => setMeasurementChannel(Number(event.target.value))} disabled={busy}>
            {Array.from({length: 32}, (_, index) => <option key={index} value={index}>CH {index + 1}</option>)}
          </select>
        </label>
      </>}
    </div>
    {capturePurpose === "channel-calibration" && <p className="warning">Hiệu chuẩn từng kênh: chọn INPUT và OUTPUT của cùng USB interface, nối LINE OUTPUT → LINE INPUT đang hiệu chuẩn qua pad/attenuator phù hợp; lặp lại cho từng CH. Tắt đường loa/ampli đến hệ thống PA trong lúc loopback. Tuyệt đối không nối ngõ công suất ampli/loa vào input. Cần AudioWorklet, thiết bị phải trả về đúng kênh PCM và không được tự fallback sang micro khác.</p>}
    {analysisMode === "synchronous-dual-channel" && capturePurpose !== "channel-calibration" && <p className="warning">Đấu nối: OUTPUT L của đúng USB interface → LINE INPUT CH Reference (nên dùng pad/attenuator); micro đo → CH Measurement. Chọn OUTPUT DEVICE của chính interface đó. Không đưa ngõ công suất ampli vào input. Không ghép USB và Bluetooth làm hai kênh reference/measurement.</p>}
    {pendingCalibrationProfile && <div className="device-notice">
      <b>Loopback capture đang chờ đo lặp · CH {pendingCalibrationProfile.inputChannel + 1}</b>
      <span>{pendingCalibrationProfile.deviceKey} · output {pendingCalibrationProfile.outputKey} · {pendingCalibrationProfile.sampleRate.toLocaleString("vi-VN")} Hz</span>
      <button className="secondary" onClick={() => setPendingCalibrationProfile(null)}>Hủy mẫu chờ</button>
    </div>}
    {lastCalibrationProfile && <div className="device-notice">
      <b>Loopback profile đã lưu · CH {lastCalibrationProfile.inputChannel + 1}</b>
      <span>{lastCalibrationProfile.deviceKey} · output {lastCalibrationProfile.outputKey} · {lastCalibrationProfile.sampleRate.toLocaleString("vi-VN")} Hz · {lastCalibrationProfile.points.length} calibration points</span>
      <div className="phase-ab-controls">
        <button className="secondary" onClick={exportCalibrationProfile}><Download /> Export calibration JSON</button>
        <button className="secondary" onClick={removeCalibrationProfile}>Delete profile</button>
      </div>
    </div>}
    {running && <p className="device-notice">Dừng RTA trực tiếp trước khi đo để tránh hai phiên ghi âm tranh microphone.</p>}
    <button disabled={busy || running} onClick={() => void measure()}>{busy ? <Square /> : <Play />}{busy ? "Đang phát và ghi 5 giây…" : capturePurpose === "channel-calibration" ? "Đo & lưu loopback profile" : "Chạy phép đo Transfer Function"}</button>
    {notice && <p className="device-notice">{notice}</p>}
    {error && <p className="error"><AlertTriangle /> {error}</p>}
    {result && <>
      <div className="metrics transfer-metrics">
        <article><small>RELATIVE PATH DELAY</small><strong>{result.estimatedDelayMs.toFixed(2)} <small>ms</small></strong></article>
        <article><small>AVERAGE COHERENCE · 100 Hz–10 kHz</small><strong>{(result.averageCoherence*100).toFixed(1)} <small>%</small></strong></article>
        <article><small>COHERENT BINS · ≥0.80</small><strong>{result.reliableBandPercent.toFixed(0)} <small>%</small></strong></article>
      </div>
      <p className="muted">Correlation { (result.confidence*100).toFixed(1) }% · {result.framesAveraged} Welch averages · {result.sampleRate.toLocaleString("vi-VN")} Hz · {result.points.length} bins</p>
      {result.captureQuality && <p className="muted">Analysis mono · raw PCM {result.captureMetadata?.pcmChannelCount ?? 1} ch · Peak {result.captureQuality.peakDbfs.toFixed(1)} dBFS · RMS {result.captureQuality.rmsDbfs.toFixed(1)} dBFS · clipping {result.captureQuality.clippedSamplePercent.toFixed(3)}%</p>}
      {result.captureMetadata && <p className="muted">Capture {result.captureMetadata.captureEngine} · input {result.captureMetadata.inputChannelCount ?? "unknown"} ch → raw PCM {result.captureMetadata.pcmChannelCount} ch ({result.captureMetadata.channelMix}) · track {result.captureMetadata.trackChannelCount ?? "unknown"} ch / {result.captureMetadata.trackSampleRate?.toLocaleString("vi-VN") ?? "unknown"} Hz</p>}
      {result.captureMetadata?.pcmIntegrity && <p className="muted">PCM integrity · {result.captureMetadata.pcmIntegrity.blocksReceived} blocks · {result.captureMetadata.pcmIntegrity.framesCaptured.toLocaleString("vi-VN")} frames · {result.captureMetadata.pcmIntegrity.durationSeconds.toFixed(2)} s · {result.captureMetadata.pcmIntegrity.channelStats.map(channel => "CH" + (channel.channelIndex + 1) + " peak " + (channel.peakDbfs === null ? "—" : channel.peakDbfs.toFixed(1)) + " dBFS / near-full-scale " + channel.nearFullScalePercent.toFixed(3) + "%").join(" · ")}</p>}
      {result.captureMetadata?.analysisMode === "synchronous-dual-channel" && <p className="device-notice">Synchronous pair · Reference CH {Number(result.captureMetadata.referenceChannel) + 1} → Measurement CH {Number(result.captureMetadata.measurementChannel) + 1} · common AudioWorklet frame clock</p>}
      {result.captureMetadata?.referenceCaptureQuality && <p className="muted">Reference · peak {result.captureMetadata.referenceCaptureQuality.peakDbfs.toFixed(1)} dBFS · RMS {result.captureMetadata.referenceCaptureQuality.rmsDbfs.toFixed(1)} dBFS · Measurement · peak {result.captureQuality?.peakDbfs.toFixed(1)} dBFS · RMS {result.captureQuality?.rmsDbfs.toFixed(1)} dBFS</p>}
      <div className="response-chart"><span className="chart-label">RELATIVE MAGNITUDE · dB</span>{result.points.filter((_,i)=>i%2===0).map((point,index)=><i key={index} title={point.frequencyHz.toFixed(0)+" Hz · "+point.magnitudeDb.toFixed(1)+" dB · coh "+point.coherence.toFixed(2)} style={{height:Math.max(3,Math.min(100,(point.magnitudeDb+45)*1.5))+"%",opacity:point.coherence<.5?.28:1}} />)}</div>
      <div className="phase-panel"><div className="heading"><Waves /><h3>{result.analysisMode === "synchronous-dual-channel" ? "Synchronous phase response · common clock" : "Time-aligned phase response"}</h3></div><svg viewBox="0 0 760 120" role="img" aria-label="Phase response"><path d="M10 12 H750 M10 56 H750 M10 100 H750" stroke="#354a55" strokeDasharray="4 4" fill="none"/><path d={phasePath} stroke="#e4b86f" strokeWidth="1.5" fill="none" vectorEffect="non-scaling-stroke"/></svg><div className="axis"><span>30 Hz</span><span>100 Hz</span><span>1 kHz</span><span>10 kHz</span><span>18 kHz</span></div></div>
      <div className="table-wrap"><table><thead><tr><th>Frequency</th><th>Magnitude</th><th>{result.analysisMode === "synchronous-dual-channel" ? "Phase · common clock" : "Phase aligned"}</th><th>Coherence</th></tr></thead><tbody>{result.points.filter((_,i)=>i%Math.max(1,Math.floor(result.points.length/16))===0).slice(0,16).map(point=><tr key={point.frequencyHz}><td>{point.frequencyHz.toFixed(0)} Hz</td><td>{point.magnitudeDb.toFixed(1)} dB</td><td>{point.phaseDeg.toFixed(0)}°</td><td><b className={point.coherence>=.8?"coherence-good":point.coherence>=.5?"coherence-mid":"coherence-low"}>{(point.coherence*100).toFixed(0)}%</b></td></tr>)}</tbody></table></div>
      <div className="phase-panel phase-align-panel"><div className="heading"><Activity/><h3>A/B Phase & Polarity comparison</h3><span>COHERENT BINS</span></div>
        <p className="muted">Đo loa A tại cùng vị trí microphone, lưu A; đổi sang loa B, giữ gain và xử lý không đổi, đo lại rồi lưu B. So sánh phase-shape và polarity tương đối quanh crossover.</p>
        <div className="phase-ab-controls"><label>CROSSOVER CENTER<select value={crossoverHz} onChange={event=>setCrossoverHz(+event.target.value)}><option value={80}>80 Hz</option><option value={100}>100 Hz</option><option value={120}>120 Hz</option><option value={150}>150 Hz</option><option value={200}>200 Hz</option><option value={250}>250 Hz</option><option value={500}>500 Hz</option><option value={1000}>1 kHz</option><option value={2000}>2 kHz</option></select></label><button className="secondary" onClick={()=>setReferenceA(result)}>Save current as A</button><button className="secondary" onClick={()=>setReferenceB(result)}>Save current as B</button></div>
        <div className="phase-ab-status"><span>A: <b>{referenceA?referenceA.points.length+" bins saved":"not saved"}</b></span><span>B: <b>{referenceB?referenceB.points.length+" bins saved":"not saved"}</b></span><button className="icon-button" onClick={()=>{setReferenceA(null);setReferenceB(null);}}>Reset A/B</button></div>
        {phaseComparison&&<div className="phase-ab-result"><article><small>MEAN PHASE B − A</small><b>{phaseComparison.meanPhaseDeg===null?"—":phaseComparison.meanPhaseDeg.toFixed(1)+"°"}</b></article><article><small>MAGNITUDE DELTA B − A</small><b>{phaseComparison.magnitudeDeltaDb===null?"—":phaseComparison.magnitudeDeltaDb.toFixed(1)+" dB"}</b></article><article><small>PHASE CONCENTRATION</small><b>{(phaseComparison.phaseConcentration*100).toFixed(0)}%</b></article><article><small>AVG COHERENCE</small><b>{(phaseComparison.averageCoherence*100).toFixed(0)}%</b></article><p>{phaseComparison.interpretation}</p></div>}
        <p className="warning">Important: each capture is independently time-aligned to its own correlation peak, so this tool does not retain the absolute A-to-B arrival-time difference. Use it only as a phase-shape/polarity diagnostic. True relative speaker delay requires a synchronous dual-channel reference/measurement chain, common clock and simultaneous capture.</p>
      </div>
      <div className="auto-eq-results">
        <div className="heading"><Waves /><h3>Auto EQ · PEQ cut suggestions</h3><span>{eq.length} FILTERS</span></div>
        {eqReadiness && <div className={eqReadiness.ready ? "feedback-clear" : "device-notice"}>
          <b>{eqReadiness.ready ? "Đủ điều kiện tạo PEQ tư vấn" : "Auto EQ đang bị khóa an toàn"}</b>
          <span>{eqReadiness.reason}</span>
          <small>{eqReadiness.coherentBins}/{eqReadiness.totalBins} bin coherence ≥0.80 · {eqReadiness.coherentPercent.toFixed(1)}% · trung bình {(eqReadiness.averageCoherence*100).toFixed(1)}%</small>
        </div>}
        {eq.length ? <>
          <div className="table-wrap"><table><thead><tr><th>Band</th><th>Frequency</th><th>Gain</th><th>Q</th><th>Coherence</th></tr></thead>
            <tbody>{eq.map((f,index)=><tr key={f.frequencyHz}><td>{index+1}</td><td>{f.frequencyHz.toLocaleString("vi-VN")} Hz</td><td><b>{f.gainDb.toFixed(1)} dB</b></td><td>{f.q.toFixed(1)}</td><td>{(f.coherence*100).toFixed(0)}%</td></tr>)}</tbody>
          </table></div>
          <button className="secondary" onClick={exportEq}><Download /> {eqCopied?"Xuất lại cấu hình PEQ":"Xuất cấu hình PEQ JSON"}</button>
        </> : <p className="muted">Không có filter phù hợp trong dữ liệu hiện tại. Không tự tạo boost để bù null hoặc vùng triệt tiêu pha.</p>}
      </div>
      <p className="warning">Delay hiển thị đã bù pre-roll đã biết nhưng vẫn là tổng latency của chuỗi phát–loa–phòng–micro–input, không phải delay loa tuyệt đối. Pha đã loại phần delay phân số sau khi time-align. A/B độc lập chỉ dùng kiểm tra phase-shape/polarity. Auto EQ chỉ đề xuất PEQ cắt khi PCM không clipping và coherence đạt ngưỡng; không tự ghi vào DSP.</p>
    </>}
    <p className="warning">{result?.analysisMode === "synchronous-dual-channel"
      ? "Kết quả dùng hai kênh cùng AudioWorklet frame clock. Chưa bù skew phần cứng ADC/DAC, đáp tuyến từng kênh hoặc latency của dây loopback; phải hiệu chuẩn và so sánh với thiết bị tham chiếu trước khi căn delay/phase chính thức."
      : "Không thể chứng nhận pha/delay chuyên nghiệp qua một micro và loa mặc định: để căn delay tuyệt đối cần loopback/reference input có đồng hồ đồng bộ, thiết bị đo phù hợp và kiểm tra polarity. Giữ nguyên gain/processing giữa các lần đo."}</p>
  </section>;
}

