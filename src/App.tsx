import {
  Activity,
  AudioWaveform,
  Mic,
  Radio,
  Volume2,
  Waves,
  RefreshCw,
  Square,
  ShieldAlert,
  Timer,
  Layers3,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { useAudioAnalyzer } from "./audio/useAudioAnalyzer";
import { useToneGenerator } from "./audio/useToneGenerator";
import { equipment } from "./data/equipment";
import MeasurementPlanner from "./audio/MeasurementPlanner";
import TransferFunctionPanel from "./audio/TransferFunctionPanel";
import FeedbackMonitor from "./audio/FeedbackMonitor";
import TuningAdvisor from "./audio/TuningAdvisor";
import RoomPlanner3D from "./audio/RoomPlanner3D";

export default function App() {
  const a = useAudioAnalyzer();
  const t = useToneGenerator();
  const inputs = a.devices.filter((device) => device.kind === "audioinput");
  const outputs = a.devices.filter((device) => device.kind === "audiooutput");

  const micStatus = a.running
    ? "MICRO ĐANG HOẠT ĐỘNG"
    : a.connecting
      ? "ĐANG XIN QUYỀN / KẾT NỐI"
      : a.permissionState === "denied"
        ? "CHƯA CÓ QUYỀN MICRO"
        : "SẴN SÀNG KIỂM TRA";
  const micStatusClass = a.running
    ? "online"
    : a.connecting
      ? "pending"
      : a.permissionState === "denied"
        ? "failed"
        : "standby";

  return (
    <main className="shell">
      <header>
        <div className="brand">
          <AudioWaveform />
          <div>
            <b>CHURCH AUDIO</b>
            <small>ANALYZER · SYSTEM TUNING</small>
          </div>
        </div>
        <span className={a.running ? "live" : a.connecting ? "pending-text" : "idle"}>
          {a.running ? "● ĐANG ĐO" : a.connecting ? "● KẾT NỐI..." : "● SẴN SÀNG"}
        </span>
      </header>

      <section className="hero">
        <small>ACOUSTIC MEASUREMENT WORKSPACE</small>
        <h1>
          Âm thanh nhà thờ,
          <br />
          <em>đo lường rõ ràng.</em>
        </h1>
        <p>
          Một bảng điều khiển cho kiểm tra micro, phổ tần, suy giảm âm học và căn chỉnh
          hệ thống loa — tối ưu cho điện thoại Android và máy tính.
        </p>
      </section>

      <nav className="quick-nav" aria-label="Điều hướng công cụ">
        <a href="#live">ĐO TRỰC TIẾP</a>
        <a href="#survey">KHẢO SÁT</a>
        <a href="#transfer">PHA / DELAY</a>
        <a href="#feedback">CHỐNG HÚ</a>
        <a href="#room">BỐ TRÍ LOA</a>
      </nav>

      <section className="metrics">
        <article>
          <small>INPUT PEAK</small>
          <strong>
            {a.level <= -99 ? "−∞" : a.level.toFixed(0)} <small>dBFS</small>
          </strong>
          <div className="meter">
            <i style={{ width: `${Math.max(0, Math.min(100, ((a.level + 60) / 60) * 100))}%` }} />
          </div>
        </article>
        <article>
          <small>INPUT DEVICES</small>
          <strong>
            {inputs.length} <small>MIC</small>
          </strong>
        </article>
        <article>
          <small>OUTPUT DEVICES</small>
          <strong>
            {outputs.length} <small>OUT</small>
          </strong>
        </article>
      </section>

      <section className="grid" id="live">
        <article className="panel">
          <div className="heading">
            <Activity />
            <h2>RTA · Phân tích phổ</h2>
            <span>{a.running ? "LIVE" : "WAITING"}</span>
          </div>
          <div className="chart">
            {a.spectrum.map((value, index) => (
              <i key={index} style={{ height: `${Math.max(2, (value + 100) * 0.98)}%` }} />
            ))}
          </div>
          <div className="axis">
            <span>20 Hz</span>
            <span>100 Hz</span>
            <span>1 kHz</span>
            <span>5 kHz</span>
            <span>20 kHz</span>
          </div>
          <small className="muted">FFT 8192 · LOG DISPLAY · RELATIVE dBFS</small>
        </article>

        <article className="panel device-panel">
          <div className="heading">
            <Radio />
            <h2>Thiết bị âm thanh</h2>
          </div>

          <div className={`mic-status ${micStatusClass}`}>
            <span className="mic-status-icon">
              {a.running ? <CheckCircle2 /> : a.error ? <AlertCircle /> : <Mic />}
            </span>
            <div>
              <b>{micStatus}</b>
              <small>
                {a.trackInfo ||
                  (a.permissionState === "denied"
                    ? "Mở Cài đặt Android và cho phép Microphone."
                    : "Nhấn Bắt đầu đo để yêu cầu quyền truy cập micro.")}
              </small>
            </div>
          </div>

          <label htmlFor="mic-input">MICROPHONE INPUT</label>
          <select
            id="mic-input"
            value={a.selectedInput}
            disabled={a.running || a.connecting}
            onChange={(event) => a.setSelectedInput(event.target.value)}
          >
            <option value="">Micro mặc định hệ thống</option>
            {inputs.map((device, index) => (
              <option key={device.deviceId || `mic-${index}`} value={device.deviceId}>
                {device.label || `Microphone ${index + 1}`}
              </option>
            ))}
          </select>
          <p className="muted">
            {a.running
              ? "Đang dùng micro hiện tại. Dừng đo trước khi đổi thiết bị đầu vào."
              : "Danh sách tên thiết bị sẽ đầy đủ hơn sau khi bạn cấp quyền microphone."}
          </p>

          <label htmlFor="audio-output">OUTPUT DEVICE</label>
          <select
            id="audio-output"
            value={t.outputDevice}
            disabled={!t.supportsOutputSelection || outputs.length === 0}
            onChange={(event) => void t.selectOutput(event.target.value)}
          >
            <option value="">Đầu ra mặc định của hệ thống</option>
            {outputs.map((device, index) => (
              <option key={device.deviceId || `out-${index}`} value={device.deviceId}>
                {device.label || `Thiết bị đầu ra ${index + 1}`}
              </option>
            ))}
          </select>
          <p className="muted">
            {!t.supportsOutputSelection
              ? "Trình duyệt này không hỗ trợ chọn đầu ra riêng; đang dùng đầu ra mặc định."
              : outputs.length
                ? "Chọn đầu ra cho tín hiệu thử."
                : "Danh sách đầu ra có thể xuất hiện sau khi cấp quyền micro."}
          </p>

          {t.outputError && <p className="error">{t.outputError}</p>}
          {a.fallbackNotice && <p className="device-notice">{a.fallbackNotice}</p>}

          <button disabled={a.connecting} onClick={() => (a.running ? a.stop() : void a.start())}>
            {a.running ? <Square /> : <Mic />}
            {a.running ? "Dừng đo microphone" : a.connecting ? "Đang kết nối micro…" : "Bắt đầu đo microphone"}
          </button>
          <button className="secondary" onClick={() => void a.refreshDevices()}>
            <RefreshCw /> Làm mới thiết bị
          </button>

          <div className="permission-help">
            <b>Android không nhận micro?</b>
            <span>
              Vào Cài đặt → Ứng dụng → Church Audio Analyzer → Quyền → Microphone → Cho phép.
              Sau đó quay lại và bấm Bắt đầu đo.
            </span>
          </div>

          {a.error && (
            <p className="error">
              <ShieldAlert /> {a.error}
            </p>
          )}
        </article>

        <article className="panel">
          <div className="heading">
            <Timer />
            <h2>RT60 · Suy giảm âm</h2>
          </div>
          <strong className="rt-value">{a.rt60 === null ? "—" : a.rt60.toFixed(2) + " s"}</strong>
          <p className="muted">
            Ước tính từ bản ghi microphone 6 giây; cần xung/sweep rõ và nền ồn thấp.
          </p>
          <button disabled={!a.running || a.capturingRt60} onClick={() => void a.captureRt60()}>
            {a.capturingRt60 ? "Đang ghi mẫu 6 giây…" : "Ghi mẫu và ước tính RT60"}
          </button>
          <p className="warning">
            Đây là ước tính hiện trường, không thay thế phép đo đáp ứng xung chuẩn IEC/ISO.
            Phát tín hiệu thử ở mức an toàn.
          </p>
        </article>

        <article className="panel">
          <div className="heading">
            <Layers3 />
            <h2>Spectrogram · Waterfall</h2>
            <span>{a.history.length} FRAMES</span>
          </div>
          <div className="spectrogram">
            {a.history.slice(-24).map((row, index) => (
              <div className="spectro-row" key={index}>
                {row.map((value, column) => (
                  <i
                    key={column}
                    style={{ opacity: Math.max(0.08, Math.min(1, (value + 100) / 100)) }}
                  />
                ))}
              </div>
            ))}
          </div>
          <small className="muted">
            Trục ngang: tần số log · Trục dọc: thời gian · Màu sáng: mức tương đối
          </small>
        </article>

        <article className="panel">
          <div className="heading">
            <Waves />
            <h2>Signal Generator</h2>
          </div>
          <div className="value">
            <label>Tần số</label>
            <b>{t.frequency.toLocaleString("vi-VN")} Hz</b>
          </div>
          <input
            type="range"
            min="20"
            max="20000"
            step="10"
            value={t.frequency}
            onChange={(event) => t.setFrequency(+event.target.value)}
          />
          <div className="value">
            <label>Mức phát</label>
            <b>{t.volume} dB</b>
          </div>
          <input
            type="range"
            min="-60"
            max="0"
            value={t.volume}
            onChange={(event) => t.setVolume(+event.target.value)}
          />
          <button onClick={() => (t.active ? t.stop() : void t.start())}>
            <Volume2 />
            {t.active ? "Dừng tín hiệu" : "Phát tín hiệu thử"}
          </button>
          <p className="warning">Bắt đầu ở mức thấp, giảm âm lượng ampli trước khi thử.</p>
        </article>

        <article className="panel">
          <div className="heading">
            <Volume2 />
            <h2>Thư viện thiết bị</h2>
            <span>{equipment.length} ITEMS</span>
          </div>
          {equipment.map((item) => (
            <div className="item" key={item.name}>
              <b>{item.name}</b>
              <small>{item.type} · Cần xác minh thông số hãng</small>
            </div>
          ))}
        </article>
      </section>

      <MeasurementPlanner running={a.running} spectrum={a.spectrum} />
      <TransferFunctionPanel selectedInput={a.selectedInput} running={a.running} />
      <FeedbackMonitor history={a.history} />
      <TuningAdvisor history={a.history} />
      <RoomPlanner3D />

      <section className="roadmap">
        <small>ROADMAP</small>
        <p>
          01 RTA + SPECTROGRAM <b>→</b> 02 RT60 / DELAY <b>→</b> 03 AUTO EQ / FEEDBACK <b>→</b> 04 3D COVERAGE <b>→</b> 05 DSP CONTROL
        </p>
      </section>
      <footer>
        CHURCH AUDIO ANALYZER <span>BUILD 0.9.2 · MICROPHONE FIX</span>
      </footer>
    </main>
  );
}
