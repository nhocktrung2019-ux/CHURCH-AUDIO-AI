import { useMemo, useState } from "react";
import { usePersistentState } from "./usePersistentState";
import { Activity, Play, Square, AlertTriangle, Download, Waves, MapPin, Trash2 } from "lucide-react";
import { analyzeSynchronousTransfer, analyzeTransfer, makeReferenceNoise, measurePcmCaptureQuality, type TransferResult } from "./transfer";
import { deinterleaveInterleavedPcm, mixInterleavedPcmToMono } from "./pcmCapture.ts";
import { PcmCaptureIntegrityMonitor } from "./pcmCaptureIntegrity";
import { AUTO_EQ_TARGETS, assessAutoEqReadiness, suggestParametricEq, type AutoEqTargetProfile } from "./autoEq.ts";
import { comparePhaseInBand } from "./phaseAlignment";
import { analyzeCrossoverAlignment } from "./crossoverAlignment";
import { aggregateMultiPositionAutoEq, assessMultiPositionAutoEq, type MultiPositionAutoEqSample } from "./multiPositionAutoEq";
import { analyzeMeasurementRepeatability } from "./measurementRepeatability.ts";
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
  const [eqTargetProfile, setEqTargetProfile] = usePersistentState<AutoEqTargetProfile>("church-audio-auto-eq-target-profile", "flat");
  const [eqSource,setEqSource]=usePersistentState<"single"|"multi-position">("church-audio-auto-eq-source","single");
  const [multiPositionSamples,setMultiPositionSamples]=usePersistentState<MultiPositionAutoEqSample[]>("church-audio-auto-eq-positions",[]);
  const [positionLabel,setPositionLabel]=useState("Khu vực 1");
  const [positionWeight,setPositionWeight]=useState(1);
  const [sameChainConfirmed,setSameChainConfirmed]=useState(false);
  const [positionRepeatCaptures,setPositionRepeatCaptures]=usePersistentState<TransferResult[]>("church-audio-position-repeat-captures",[]);
  const [positionRepeatLabel,setPositionRepeatLabel]=usePersistentState<string>("church-audio-position-repeat-label","");
  const repeatabilityAnalysis=useMemo(()=>analyzeMeasurementRepeatability(positionRepeatCaptures),[positionRepeatCaptures]);
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
  const multiPositionGate=useMemo(()=>assessMultiPositionAutoEq(multiPositionSamples),[multiPositionSamples]);
  const multiPositionAnalysis=useMemo(()=>aggregateMultiPositionAutoEq(multiPositionSamples),[multiPositionSamples]);
  const activeEqPoints=eqSource==="multi-position"?multiPositionAnalysis.points:(result?.points??[]);
  const activeEqReadiness=eqSource==="multi-position"
    ? {...multiPositionAnalysis.readiness,ready:multiPositionAnalysis.ready,reason:multiPositionAnalysis.reason}
    : eqReadiness;
  const eq=useMemo(
    ()=>activeEqReadiness?.ready?suggestParametricEq(activeEqPoints,eqTargetProfile):[],
    [activeEqReadiness,activeEqPoints,eqTargetProfile],
  );
  const canAddPositionRepeat=Boolean(result&&eqReadiness?.ready
    &&result.captureMetadata?.analysisMode==="mono-acoustic"
    &&result.captureMetadata?.captureEngine==="AudioWorklet"
    &&sameChainConfirmed&&positionLabel.trim()&&positionRepeatCaptures.length<5
    &&(!positionRepeatCaptures.length||positionRepeatLabel===positionLabel.trim())
    &&multiPositionSamples.length<8
    &&!multiPositionSamples.some(s=>s.label.trim().toLocaleLowerCase()===positionLabel.trim().toLocaleLowerCase()));
  const canSavePosition=Boolean(repeatabilityAnalysis.ready&&repeatabilityAnalysis.result
    &&positionRepeatCaptures.length>=3&&positionRepeatLabel===positionLabel.trim()
    &&sameChainConfirmed&&positionLabel.trim()&&multiPositionSamples.length<8
    &&!multiPositionSamples.some(s=>s.label.trim().toLocaleLowerCase()===positionLabel.trim().toLocaleLowerCase()));

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
          sampleRate: audio!.sampleRate,
          loopbackDelayMs: measured.estimatedDelayMs,
          points: measured.points
            .filter(point => point.frequencyHz >= (2 * audio!.sampleRate / 4096) && point.frequencyHz <= 10000)
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

  const addCurrentPositionRepeat=()=>{
    if(!result||!canAddPositionRepeat)return;
    const points=result.points.filter(point=>point.frequencyHz>=80&&point.frequencyHz<=10000);
    const stride=Math.max(1,Math.ceil(points.length/512));
    const capture:TransferResult={...result,points:points.filter((_,index)=>index%stride===0)};
    setPositionRepeatLabel(positionLabel.trim());
    setPositionRepeatCaptures(current=>[...current,capture].slice(0,5));
    setResult(null);
    setNotice("Đã thêm lần đo lặp "+(positionRepeatCaptures.length+1)+". Giữ nguyên vị trí micro và đo lại; cần ít nhất 3 lần.");
  };
  const clearPositionRepeats=()=>{setPositionRepeatCaptures([]);setPositionRepeatLabel("");};
  const saveCurrentPosition=()=>{
    if(!canSavePosition||!repeatabilityAnalysis.result)return;
    const sample:MultiPositionAutoEqSample={
      id:String(Date.now()),label:positionLabel.trim(),weight:Math.max(0.5,Math.min(2,positionWeight)),
      savedAt:new Date().toISOString(),sameChainConfirmed,result:repeatabilityAnalysis.result,
      repeatability:repeatabilityAnalysis.summary,repeatabilityDiagnostics:repeatabilityAnalysis.diagnostics,
    };
    setMultiPositionSamples(current=>[...current,sample].slice(0,8));
    clearPositionRepeats();setResult(null);
    setPositionLabel("Khu vực "+(multiPositionSamples.length+2));setSameChainConfirmed(false);
    setEqSource("multi-position");
    setNotice("Đã lưu "+sample.label+" sau "+sample.repeatability?.captureCount+" lần đo lặp. Di chuyển micro đến khu vực tiếp theo.");
  };
  const removeMultiPosition=(id:string)=>setMultiPositionSamples(current=>current.filter(s=>s.id!==id));

  const exportEq = () => {
    if (!eq.length) return;
    const multiPositionWorksheet=eqSource==="multi-position"?{
      source:"multi-position-aggregate",
      positions:multiPositionSamples.map(s=>({id:s.id,label:s.label,weight:s.weight,savedAt:s.savedAt,sampleRate:s.result.sampleRate,
        repeatability:s.repeatability??null,repeatabilityDiagnostics:(s.repeatabilityDiagnostics??[]).filter(d=>d.status!=="included").slice(0,100)})),
      spatialSummary:multiPositionAnalysis.summary,
      spatialDiagnostics:multiPositionAnalysis.diagnostics.filter(d=>d.status!=="included").slice(0,100),
    }:null;
    const payload = {
      format: "Church Audio Parametric EQ Suggestion",
      status: "advisory-not-applied",
      generatedAt: new Date().toISOString(),
      targetProfile: { id: eqTargetProfile, ...AUTO_EQ_TARGETS[eqTargetProfile] },
      requirements: "Verify by listening and repeat measurement before manual DSP entry. No parameters are written to hardware.",
      measurement: eqSource==="multi-position"?multiPositionWorksheet:{ sampleRate: result?.sampleRate, averageCoherence: result?.averageCoherence, captureQuality: result?.captureQuality, captureMetadata: result?.captureMetadata },
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

  const crossoverReview = useMemo(() => {
    if (!referenceA || !referenceB) return null;
    return analyzeCrossoverAlignment(referenceA.points, referenceB.points, crossoverHz);
  }, [referenceA, referenceB, crossoverHz]);

  const exportCrossoverJson = () => {
    if (!referenceA || !referenceB || !crossoverReview) return;
    const payload = {
      schema: "church-audio.crossover-alignment-report",
      schemaVersion: "1.0.0",
      generatedAt: new Date().toISOString(),
      application: { name: "CHURCH AUDIO AI", version: "0.30.0-beta.1" },
      reportStatus: "advisory-not-applied",
      analysis: crossoverReview,
      setup: {
        crossoverCenterHz: crossoverHz,
        analysisBandHz: [crossoverReview.bandLowHz, crossoverReview.bandHighHz],
        minimumCoherence: 0.8,
        captureA: { sampleRateHz: referenceA.sampleRate, analysisMode: referenceA.analysisMode ?? null, captureMetadata: referenceA.captureMetadata ?? null },
        captureB: { sampleRateHz: referenceB.sampleRate, analysisMode: referenceB.analysisMode ?? null, captureMetadata: referenceB.captureMetadata ?? null },
        operatorNote: "Confirm same microphone position, input, gain, routing and processing for A/B captures.",
      },
      responses: {
        A: referenceA.points.map(point => ({ frequencyHz: point.frequencyHz, magnitudeDb: point.magnitudeDb, phaseDeg: point.phaseDeg, coherence: point.coherence })),
        B: referenceB.points.map(point => ({ frequencyHz: point.frequencyHz, magnitudeDb: point.magnitudeDb, phaseDeg: point.phaseDeg, coherence: point.coherence })),
      },
      limitations: [
        "Sequential A/B captures support relative phase-shape review only.",
        "Absolute A-to-B arrival-time difference is unavailable from this report.",
        "Polarity, crossover and delay recommendations require operator verification.",
        "No DSP or mixer settings were changed.",
      ],
      units: { frequency: "Hz", magnitude: "dB relative", phase: "degrees", coherence: "0..1" },
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url; anchor.download = "church-audio-crossover-report.json"; anchor.click();
    URL.revokeObjectURL(url);
  };

  const exportCrossoverCsv = () => {
    if (!referenceA || !referenceB || !crossoverReview) return;
    const quote = (value: string | number | null) => {
      const text = value === null ? "" : String(value);
      return '"' + text.replace(/"/g, '""') + '"';
    };
    const rows = [
      ["record_type","measurement","frequency_hz","magnitude_db_relative","phase_deg","coherence_0_to_1","analysis_status","unit_note"],
      ["summary","A_vs_B","","","","",crossoverReview.status,"Phase degrees; relative magnitude dB; coherence 0..1"],
      ["summary","crossover_center",crossoverHz,"","","",crossoverReview.status,"Hz"],
      ["summary","mean_phase_difference","","",crossoverReview.meanPhaseDifferenceDeg ?? "","",crossoverReview.status,"degrees"],
      ["summary","mean_magnitude_difference","",crossoverReview.meanMagnitudeDifferenceDb ?? "","","",crossoverReview.status,"dB"],
      ["summary","average_coherence","","","",crossoverReview.averageCoherence,crossoverReview.status,"0..1"],
      ...referenceA.points.map(point=>["response","A",point.frequencyHz,point.magnitudeDb,point.phaseDeg,point.coherence,"",""]),
      ...referenceB.points.map(point=>["response","B",point.frequencyHz,point.magnitudeDb,point.phaseDeg,point.coherence,"",""]),
    ];
    const csv = "\uFEFF" + rows.map(row=>row.map(value=>quote(value as string | number | null)).join(",")).join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url; anchor.download = "church-audio-crossover-report.csv"; anchor.click();
    URL.revokeObjectURL(url);
  };

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
        {crossoverReview&&<div className="crossover-review-panel">
          <div className="heading"><Waves/><h3>Đánh giá vùng giao nhau · v1.08</h3><span>{crossoverReview.confidence.toUpperCase()} CONFIDENCE</span></div>
          <div className="crossover-review-grid">
            <article><small>TRẠNG THÁI</small><b className={"crossover-status "+crossoverReview.status}>{crossoverReview.status==="good-overlap"?"Tương đối phù hợp":crossoverReview.status==="review-polarity"?"Kiểm tra cực tính":crossoverReview.status==="review-level-balance"?"Kiểm tra cân mức":crossoverReview.status==="review-delay-or-filter"?"Kiểm tra delay / lọc":"Thiếu dữ liệu"}</b></article>
            <article><small>PHA TRUNG BÌNH B − A</small><b>{crossoverReview.meanPhaseDifferenceDeg===null?"—":crossoverReview.meanPhaseDifferenceDeg.toFixed(1)+"°"}</b></article>
            <article><small>CHÊNH MỨC B − A</small><b>{crossoverReview.meanMagnitudeDifferenceDb===null?"—":crossoverReview.meanMagnitudeDifferenceDb.toFixed(1)+" dB"}</b></article>
            <article><small>COHERENCE TRUNG BÌNH</small><b>{(crossoverReview.averageCoherence*100).toFixed(0)+"%"}</b></article>
            <article><small>SỐ BIN GHÉP</small><b>{crossoverReview.matchedBins}</b></article>
            <article><small>ĐỘ PHỦ DẢI TẦN</small><b>{crossoverReview.octaveCoverage.toFixed(2)+" octave"}</b></article>
          </div>
          <p className="crossover-recommendation">{crossoverReview.recommendation}</p>
          <p className="warning">Delay tuyệt đối: không khả dụng từ phép đo A/B tuần tự. Đây là báo cáo tư vấn, không tự đảo cực hoặc thay đổi crossover/DSP.</p>
          <div className="crossover-export-actions">
            <button className="secondary" onClick={exportCrossoverJson}><Download/>Xuất báo cáo JSON</button>
            <button className="secondary" onClick={exportCrossoverCsv}><Download/>Xuất dữ liệu CSV</button>
          </div>
        </div>}
        <p className="warning">Important: each capture is independently time-aligned to its own correlation peak, so this tool does not retain the absolute A-to-B arrival-time difference. Use it only as a phase-shape/polarity diagnostic. True relative speaker delay requires a synchronous dual-channel reference/measurement chain, common clock and simultaneous capture.</p>
      </div>
      <section className="multi-position-eq">
        <div className="heading"><MapPin/><h3>Auto EQ đa vị trí · Khu vực nhà thờ</h3><span>{multiPositionSamples.length}/8 VỊ TRÍ · {positionRepeatCaptures.length}/3 LẦN LẶP</span></div>
        <p className="muted">Tại mỗi khu vực, đo lặp 3–5 lần khi micro đứng yên. Chỉ giữ bin có spread giữa các lần đo không quá 3 dB; sau đó mới tổng hợp khác biệt âm học giữa các khu vực.</p>
        <label className="multi-position-confirm"><input type="checkbox" checked={sameChainConfirmed} onChange={event=>setSameChainConfirmed(event.target.checked)}/><span>Xác nhận giữ nguyên chuỗi đo và hệ thống loa; chỉ thay đổi vị trí micro.</span></label>
        <div className="form-grid">
          <div><label htmlFor="multi-position-label">TÊN VỊ TRÍ ĐO</label><input id="multi-position-label" value={positionLabel} maxLength={48} onChange={event=>setPositionLabel(event.target.value)} placeholder="Giữa nhà thờ / hàng ghế 5"/></div>
          <div><label htmlFor="multi-position-weight">TRỌNG SỐ KHU VỰC</label><select id="multi-position-weight" value={String(positionWeight)} onChange={event=>setPositionWeight(Number(event.target.value))}>
            <option value="0.5">0,5 · ít ưu tiên</option><option value="0.75">0,75</option><option value="1">1,0 · bình thường</option><option value="1.25">1,25</option><option value="1.5">1,5 · ưu tiên</option><option value="2">2,0 · ưu tiên cao</option>
          </select></div>
        </div>
        <div className="form-grid">
          <button className="secondary" disabled={!canAddPositionRepeat} onClick={addCurrentPositionRepeat}><Activity/>Thêm lần đo lặp ({positionRepeatCaptures.length}/3)</button>
          <button className="secondary" disabled={!canSavePosition} onClick={saveCurrentPosition}><MapPin/>Hoàn tất vị trí ({positionRepeatCaptures.length} lần)</button>
          <button className="icon-button" disabled={!positionRepeatCaptures.length} onClick={clearPositionRepeats}>Xóa lần đo lặp</button>
        </div>
        {!sameChainConfirmed&&<p className="warning">Cần xác nhận giữ nguyên chuỗi đo. Với các lần lặp, không di chuyển micro cho đến khi hoàn tất vị trí.</p>}
        {result&&!eqReadiness?.ready&&<p className="warning">Phép đo hiện tại chưa đủ điều kiện thêm vào bộ lặp: {eqReadiness?.reason??"Chưa có kết quả."}</p>}
        {positionRepeatCaptures.length>0&&positionRepeatLabel!==positionLabel.trim()&&<p className="warning">Tên vị trí đã thay đổi. Hãy khôi phục tên “{positionRepeatLabel}” hoặc xóa bộ lần đo lặp trước khi tiếp tục.</p>}
        {positionRepeatCaptures.length>0&&<div className={repeatabilityAnalysis.ready?"feedback-clear":"device-notice"}>
          <b>{repeatabilityAnalysis.ready?"Độ lặp đạt yêu cầu":"Đang kiểm tra độ lặp"}</b><span>{repeatabilityAnalysis.reason}</span>
          <small>{repeatabilityAnalysis.summary.includedBinCount} bin ổn định · {repeatabilityAnalysis.summary.unstableBinCount} bin không ổn định · spread trung vị {repeatabilityAnalysis.summary.medianSpreadDb.toFixed(1)} dB · RMS lệch {repeatabilityAnalysis.summary.rmsLevelSpreadDb.toFixed(1)} dB · metadata PCM {repeatabilityAnalysis.summary.captureChainConsistent?"đồng nhất":"không đồng nhất"}</small>
        </div>}
        {positionRepeatCaptures.length>0&&positionRepeatCaptures.length<3&&<p className="warning">Cần thêm {3-positionRepeatCaptures.length} lần đo tại đúng vị trí hiện tại. Sau mỗi lần thêm, hãy bấm ĐO lại.</p>}
        <div className="multi-position-list">{multiPositionSamples.map((s,i)=><div className="multi-position-item" key={s.id}>
          <div><b>{i+1}. {s.label}</b><span>Trọng số {s.weight.toFixed(2)} · {s.result.points.length} bins · {s.result.sampleRate.toLocaleString("vi-VN")} Hz · {s.repeatability?.captureCount??0} lần lặp · spread {s.repeatability?.medianSpreadDb.toFixed(1)??"—"} dB · loại {s.repeatability?.unstableBinCount??0} bin</span></div>
          <button className="icon-button" aria-label={"Xóa "+s.label} onClick={()=>removeMultiPosition(s.id)}><Trash2/></button>
        </div>)}</div>
        <div className={multiPositionGate.ready?"feedback-clear":"device-notice"}><b>{multiPositionGate.ready?"Đủ điều kiện đầu vào":"Chưa đủ điều kiện tổng hợp"}</b><span>{multiPositionGate.reason}</span>
          {multiPositionGate.issues.slice(1).map((issue,i)=><small key={i}>{issue}</small>)}
        </div>
        {multiPositionAnalysis.ready&&<div className="phase-ab-result">
          <article><small>BIN ĐƯỢC DÙNG</small><b>{multiPositionAnalysis.summary.contributingBinCount}</b></article>
          <article><small>BIN ĐÃ LOẠI</small><b>{multiPositionAnalysis.summary.suppressedVariableBinCount}</b></article>
          <article><small>SPREAD TRUNG VỊ</small><b>{multiPositionAnalysis.summary.medianSpatialSpreadDb.toFixed(1)} dB</b></article>
          <article><small>BIN BIẾN THIÊN</small><b>{multiPositionAnalysis.summary.suppressedVariableBinCount}</b></article>
          <article><small>BIN THIẾU PHỦ</small><b>{multiPositionAnalysis.summary.insufficientCoverageBinCount}</b></article>
          <p>{multiPositionAnalysis.reason}</p>
          {multiPositionAnalysis.diagnostics.some(d=>d.status!=="included")&&<div className="table-wrap">
            <table><thead><tr><th>Tần số</th><th>Phủ vị trí</th><th>Spread</th><th>Đánh giá</th></tr></thead>
              <tbody>{multiPositionAnalysis.diagnostics.filter(d=>d.status!=="included")
                .sort((a,b)=>(b.spreadDb??-1)-(a.spreadDb??-1)).slice(0,12).map(d=><tr key={d.frequencyHz}>
                  <td>{d.frequencyHz.toFixed(0)} Hz</td><td>{d.coverageCount}/{multiPositionAnalysis.summary.positionCount}</td>
                  <td>{d.spreadDb===null?"—":d.spreadDb.toFixed(1)+" dB"}</td>
                  <td>{d.status==="spatial-variance"?"Biến thiên không gian":"Thiếu dữ liệu"}</td>
                </tr>)}</tbody>
            </table>
          </div>}
        </div>}
        <div className="phase-ab-controls"><label>NGUỒN DỮ LIỆU AUTO EQ<select value={eqSource} onChange={event=>setEqSource(event.target.value as "single"|"multi-position")}>
          <option value="single">Phép đo đơn hiện tại</option><option value="multi-position">Tổng hợp đa vị trí ({multiPositionSamples.length})</option>
        </select></label><button className="icon-button" disabled={!multiPositionSamples.length} onClick={()=>setMultiPositionSamples([])}>Xóa toàn bộ vị trí</button></div>
      </section>
      <div className="auto-eq-results">
        <div className="heading"><Waves /><h3>Auto EQ · PEQ cut suggestions</h3><span>{eq.length} FILTERS</span></div>
        <div className="form-grid auto-eq-target-control">
          <div>
            <label htmlFor="auto-eq-target-profile">ĐƯỜNG CONG MỤC TIÊU</label>
            <select id="auto-eq-target-profile" value={eqTargetProfile} onChange={(event) => setEqTargetProfile(event.target.value as AutoEqTargetProfile)}>
              <option value="flat">Phẳng / trung tính</option>
              <option value="spoken-word">Lời nói / giảng lễ</option>
              <option value="worship-music">Nhạc thờ phượng / ban nhạc</option>
            </select>
          </div>
        </div>
        <p className="muted">{AUTO_EQ_TARGETS[eqTargetProfile].description} Đường cong chỉ ảnh hưởng cách đánh giá đỉnh; không tạo filter boost và không thay thế căn chỉnh theo nhiều vị trí nghe.</p>
        {activeEqReadiness && <div className={activeEqReadiness.ready ? "feedback-clear" : "device-notice"}>
          <b>{activeEqReadiness.ready ? "Đủ điều kiện tạo PEQ tư vấn" : "Auto EQ đang bị khóa an toàn"}</b>
          <span>{activeEqReadiness.reason}</span>
          <small>{activeEqReadiness.coherentBins}/{activeEqReadiness.totalBins} bin coherence ≥0.80 · {activeEqReadiness.coherentPercent.toFixed(1)}% · trung bình {(activeEqReadiness.averageCoherence*100).toFixed(1)}%</small>
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

