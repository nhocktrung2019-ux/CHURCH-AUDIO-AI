import { useEffect, useRef, useState, type FormEvent } from "react";
import { AudioLines, Keyboard, Mic, MicOff, Send } from "lucide-react";
import { describeVoiceIntent, parseVoiceCommand } from "./voiceCommands";
import type { VoiceIntent } from "./voiceCommands";

interface SpeechAlternativeLike {
  transcript: string;
}

interface SpeechResultLike extends ArrayLike<SpeechAlternativeLike> {
  isFinal: boolean;
}

interface SpeechEventLike {
  resultIndex: number;
  results: ArrayLike<SpeechResultLike>;
}

interface SpeechErrorLike {
  error: string;
}

interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onresult: ((event: SpeechEventLike) => void) | null;
  onerror: ((event: SpeechErrorLike) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

type Props = {
  measuring: boolean;
  onIntent: (intent: VoiceIntent) => string;
};

function errorMessage(code: string): string {
  switch (code) {
    case "not-allowed":
    case "service-not-allowed":
      return "Trình duyệt chưa cấp quyền nhận dạng giọng nói. Hãy kiểm tra quyền microphone và dịch vụ nhận dạng trên Android.";
    case "no-speech":
      return "Chưa nhận được giọng nói. Hãy thử lại ở nơi ít ồn.";
    case "audio-capture":
      return "Không truy cập được microphone cho nhận dạng giọng nói. Dừng phép đo khác và kiểm tra thiết bị đầu vào.";
    case "network":
      return "Dịch vụ nhận dạng giọng nói báo lỗi mạng. Lệnh văn bản vẫn dùng được.";
    default:
      return "Nhận dạng giọng nói không khả dụng (" + code + "). Có thể nhập lệnh bên dưới.";
  }
}

export default function VoiceAssistantPanel({ measuring, onIntent }: Props) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [command, setCommand] = useState("");
  const [transcript, setTranscript] = useState("");
  const [response, setResponse] = useState("Lệnh cục bộ bằng tiếng Việt: mở RTA, bắt đầu/dừng đo, chọn tần số, mở RT60, chống hú, 3D, DSP hoặc hỗ trợ.");
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const pendingTranscriptRef = useRef("");
  const recognitionErrorRef = useRef("");

  useEffect(() => {
    const speechWindow = window as Window & {
      SpeechRecognition?: SpeechRecognitionConstructor;
      webkitSpeechRecognition?: SpeechRecognitionConstructor;
    };
    setSupported(Boolean(speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition));
    return () => {
      recognitionRef.current?.abort();
      recognitionRef.current = null;
    };
  }, []);

  const dispatch = (raw: string) => {
    const intent = parseVoiceCommand(raw);
    const description = describeVoiceIntent(intent);
    const actionMessage = onIntent(intent);
    setTranscript(raw);
    setResponse(actionMessage || description);
  };

  const startListening = () => {
    if (measuring) {
      setResponse("Hãy dừng phép đo microphone trước khi bật nhận dạng giọng nói để tránh hai luồng cùng chiếm đầu vào.");
      return;
    }
    const speechWindow = window as Window & {
      SpeechRecognition?: SpeechRecognitionConstructor;
      webkitSpeechRecognition?: SpeechRecognitionConstructor;
    };
    const Constructor = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
    if (!Constructor) {
      setSupported(false);
      setResponse("WebView này không có Web Speech Recognition. Có thể nhập lệnh bằng bàn phím ở ô bên dưới.");
      return;
    }

    try {
      recognitionRef.current?.abort();
      const recognition = new Constructor();
      recognition.lang = "vi-VN";
      recognition.interimResults = true;
      recognition.continuous = false;
      recognition.maxAlternatives = 3;
      pendingTranscriptRef.current = "";
      recognitionErrorRef.current = "";
      recognition.onstart = () => {
        setListening(true);
        setResponse("Đang nghe tiếng Việt… Hãy nói một lệnh ngắn.");
      };
      recognition.onresult = (event) => {
        const parts: string[] = [];
        for (let index = event.resultIndex; index < event.results.length; index++) {
          const result = event.results[index];
          if (result?.isFinal && result[0]?.transcript) parts.push(result[0].transcript.trim());
        }
        if (parts.length) pendingTranscriptRef.current = parts.join(" ");
      };
      recognition.onerror = (event) => {
        recognitionErrorRef.current = errorMessage(event.error);
      };
      recognition.onend = () => {
        setListening(false);
        recognitionRef.current = null;
        const spoken = pendingTranscriptRef.current.trim();
        pendingTranscriptRef.current = "";
        if (spoken) dispatch(spoken);
        else if (recognitionErrorRef.current) setResponse(recognitionErrorRef.current);
        else setResponse("Không nhận được lệnh hoàn chỉnh. Hãy thử lại hoặc nhập bằng bàn phím.");
      };
      recognitionRef.current = recognition;
      recognition.start();
    } catch (cause) {
      recognitionRef.current = null;
      setListening(false);
      setResponse(cause instanceof Error ? cause.message : "Không khởi động được nhận dạng giọng nói.");
    }
  };

  const stopListening = () => recognitionRef.current?.stop();

  const submitCommand = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const raw = command.trim();
    if (!raw) return;
    dispatch(raw);
    setCommand("");
  };

  return <section className="panel voice-assistant-panel" aria-label="Trợ lý lệnh giọng nói">
    <div className="heading"><AudioLines /><h2>Voice Control · Lệnh tiếng Việt</h2><span>{listening ? "LISTENING" : supported ? "READY" : "TEXT FALLBACK"}</span></div>
    <p className="muted">Điều khiển cục bộ theo tập lệnh đã định nghĩa. Không gửi dữ liệu âm thanh lên AI cloud và không tự điều chỉnh DSP hay thay đổi cấu hình âm thanh nguy hiểm.</p>
    <div className="voice-assistant-actions">
      <button type="button" disabled={listening || measuring || !supported} onClick={startListening}>
        <Mic /> {listening ? "Đang nghe…" : "Ra lệnh bằng giọng nói"}
      </button>
      <button type="button" className="secondary" disabled={!listening} onClick={stopListening}>
        <MicOff /> Dừng nghe
      </button>
    </div>
    {measuring && <p className="warning">Đang có phiên đo microphone. Dừng đo trước khi bật nhận dạng giọng nói.</p>}
    <form className="voice-command-form" onSubmit={submitCommand}>
      <label htmlFor="voice-command-input"><Keyboard /> Nhập lệnh thay thế</label>
      <div>
        <input id="voice-command-input" value={command} onChange={event => setCommand(event.target.value)} placeholder="Ví dụ: chọn tần số 1 kHz" />
        <button type="submit" disabled={!command.trim()}><Send /> Gửi</button>
      </div>
    </form>
    {transcript && <p className="voice-transcript"><b>Đã nhận:</b> {transcript}</p>}
    <p className="device-notice" role="status">{response}</p>
  </section>;
}
