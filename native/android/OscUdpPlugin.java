package __APP_PACKAGE__;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONException;

import java.io.ByteArrayOutputStream;
import java.net.DatagramPacket;
import java.net.DatagramSocket;
import java.net.Inet4Address;
import java.net.InetAddress;
import java.net.SocketTimeoutException;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

@CapacitorPlugin(name = "OscUdp")
public class OscUdpPlugin extends Plugin {
    private static final int DEFAULT_PORT = 10023;
    private static final int MAX_PACKET_BYTES = 8192;
    private static final int MAX_BATCH_ADDRESSES = 64;
    private static final Pattern CHANNEL_QUERY = Pattern.compile(
        "^/ch/(0[1-9]|[12][0-9]|3[0-2])/(config/(name|color|icon)|mix/(fader|on|pan|st|mono)|preamp/(trim|invert)|eq/on|eq/[1-4]/(type|f|g|q)|delay/(on|time)|dyn/(on|thr|ratio|attack|hold|release|mgain)|gate/(on|thr|range|attack|hold|release)|grp/(dca|mute))$"
    );
    private static final Pattern BUS_QUERY = Pattern.compile(
        "^/bus/(0[1-9]|1[0-6])/(config/(name|color|icon)|mix/(fader|on|pan|st)|eq/on|eq/[1-6]/(type|f|g|q)|dyn/(on|thr|ratio|attack|hold|release|mgain))$"
    );
    private static final Pattern AUX_QUERY = Pattern.compile(
        "^/(auxin|fxrtn)/(0[1-8])/(config/(name|color|icon)|mix/(fader|on|pan|st)|eq/on|eq/[1-4]/(type|f|g|q))$"
    );
    private static final Pattern MATRIX_QUERY = Pattern.compile(
        "^/mtx/0[1-6]/(config/(name|color|icon)|mix/(fader|on)|eq/on|eq/[1-6]/(type|f|g|q)|dyn/(on|thr|ratio|attack|hold|release|mgain))$"
    );
    private static final Pattern DCA_QUERY = Pattern.compile(
        "^/dca/[1-8]/(config/(name|color|icon)|mix/(fader|on))$"
    );
    private static final Pattern MAIN_QUERY = Pattern.compile(
        "^/main/(st|m)/(config/(name|color|icon)|mix/(fader|on|pan)|eq/on|eq/[1-6]/(type|f|g|q)|dyn/(on|thr|ratio|attack|hold|release|mgain))$"
    );

    @PluginMethod
    public void query(PluginCall call) {
        String address = call.getString("address");
        JSArray addresses = new JSArray();
        addresses.put(address == null ? "" : address);
        queryBatchInternal(call, addresses);
    }

    @PluginMethod
    public void queryBatch(PluginCall call) {
        JSArray addresses = call.getArray("addresses");
        if (addresses == null || addresses.length() == 0) {
            call.reject("Danh sách địa chỉ OSC đang trống.");
            return;
        }
        if (addresses.length() > MAX_BATCH_ADDRESSES) {
            call.reject("Mỗi lượt chỉ được truy vấn tối đa " + MAX_BATCH_ADDRESSES + " tham số.");
            return;
        }
        queryBatchInternal(call, addresses);
    }

    private void queryBatchInternal(PluginCall call, JSArray requestedAddresses) {
        final String host = call.getString("host");
        final Integer portValue = call.getInt("port");
        final Integer timeoutValue = call.getInt("timeoutMs");
        final int port = portValue == null ? DEFAULT_PORT : portValue;
        final int timeoutMs = timeoutValue == null ? 1600 : timeoutValue;

        if (host == null || host.trim().isEmpty()) {
            call.reject("Nhập địa chỉ IP của mixer.");
            return;
        }
        if (port < 1024 || port > 65535 || timeoutMs < 250 || timeoutMs > 8000) {
            call.reject("Port hoặc timeout không hợp lệ.");
            return;
        }

        final List<String> addresses = new ArrayList<>();
        final Set<String> unique = new HashSet<>();
        try {
            for (int i = 0; i < requestedAddresses.length(); i++) {
                String address = requestedAddresses.getString(i);
                if (!isAllowedQuery(address)) {
                    call.reject("Địa chỉ OSC không nằm trong danh sách truy vấn chỉ đọc: " + address);
                    return;
                }
                if (unique.add(address)) addresses.add(address);
            }
        } catch (JSONException error) {
            call.reject("Danh sách truy vấn OSC không hợp lệ.", error);
            return;
        }

        Thread worker = new Thread(
            () -> performBatchQuery(call, host.trim(), port, addresses, timeoutMs),
            "ChurchAudio-OscUdp"
        );
        worker.start();
    }

    private void performBatchQuery(PluginCall call, String host, int port, List<String> addresses, int timeoutMs) {
        long started = System.currentTimeMillis();
        try {
            InetAddress target = InetAddress.getByName(host);
            if (!(target instanceof Inet4Address) || !isPrivateIpv4((Inet4Address) target)) {
                call.reject("Chỉ cho phép IP LAN IPv4 riêng (10.x, 172.16–31.x hoặc 192.168.x).");
                return;
            }

            Map<String, JSObject> received = new LinkedHashMap<>();
            try (DatagramSocket socket = new DatagramSocket()) {
                socket.setReuseAddress(false);
                for (String address : addresses) {
                    byte[] request = encodeOscQuery(address);
                    DatagramPacket outbound = new DatagramPacket(request, request.length, target, port);
                    socket.send(outbound);
                }

                long deadline = System.currentTimeMillis() + timeoutMs;
                socket.setSoTimeout(Math.min(400, timeoutMs));
                byte[] buffer = new byte[MAX_PACKET_BYTES];

                while (System.currentTimeMillis() < deadline && received.size() < addresses.size()) {
                    DatagramPacket inbound = new DatagramPacket(buffer, buffer.length);
                    try {
                        socket.receive(inbound);
                    } catch (SocketTimeoutException idle) {
                        // OSC consoles commonly reply to the client's ephemeral source port.
                        // Keep waiting until the overall deadline instead of assuming a fixed reply port.
                        continue;
                    }

                    // Accept replies only from the selected console IP. The reply source port may be ephemeral.
                    if (!target.equals(inbound.getAddress())) {
                        continue;
                    }

                    byte[] response = Arrays.copyOfRange(
                        inbound.getData(),
                        inbound.getOffset(),
                        inbound.getOffset() + inbound.getLength()
                    );
                    OscMessage parsed;
                    try {
                        parsed = parseOscMessage(response);
                    } catch (Exception malformedPacket) {
                        // Ignore unrelated or malformed UDP traffic and keep collecting valid replies.
                        continue;
                    }
                    if (!uniqueContains(addresses, parsed.address)) continue;

                    JSObject result = new JSObject();
                    result.put("host", target.getHostAddress());
                    result.put("port", port);
                    result.put("requestedAddress", parsed.address);
                    result.put("responseAddress", parsed.address);
                    result.put("typeTags", parsed.typeTags);
                    result.put("arguments", parsed.arguments);
                    result.put("rawHex", toHex(response));
                    result.put("rttMs", System.currentTimeMillis() - started);
                    result.put("receivedAt", System.currentTimeMillis());
                    received.put(parsed.address, result);
                }
            }

            JSArray results = new JSArray();
            for (JSObject item : received.values()) results.put(item);

            JSObject output = new JSObject();
            output.put("host", target.getHostAddress());
            output.put("port", port);
            output.put("requestedCount", addresses.size());
            output.put("receivedCount", received.size());
            output.put("missingCount", addresses.size() - received.size());
            output.put("results", results);
            output.put("elapsedMs", System.currentTimeMillis() - started);
            output.put("completedAt", System.currentTimeMillis());
            call.resolve(output);
        } catch (Exception error) {
            call.reject("Lỗi truy vấn OSC: " + error.getMessage(), error);
        }
    }


    @PluginMethod
    public void writeGuarded(PluginCall call) {
        final String host = call.getString("host");
        final String address = call.getString("address");
        final Double expectedRawValue = call.getDouble("expectedRawValue");
        final Double requestedValue = call.getDouble("value");
        final Integer portValue = call.getInt("port");
        final Integer timeoutValue = call.getInt("timeoutMs");
        final int port = portValue == null ? DEFAULT_PORT : portValue;
        final int timeoutMs = timeoutValue == null ? 1800 : timeoutValue;
        final WriteSpec spec = getWriteSpec(address);

        if (host == null || host.trim().isEmpty() || spec == null) {
            call.reject("Địa chỉ hoặc tham số ghi không nằm trong danh sách được bảo vệ.");
            return;
        }
        if (expectedRawValue == null || requestedValue == null
            || !Double.isFinite(expectedRawValue) || !Double.isFinite(requestedValue)) {
            call.reject("Giá trị đọc trước hoặc giá trị mới không hợp lệ.");
            return;
        }
        if (port < 1024 || port > 65535 || timeoutMs < 500 || timeoutMs > 8000) {
            call.reject("Port hoặc timeout không hợp lệ.");
            return;
        }
        if (requestedValue < spec.minValue || requestedValue > spec.maxValue) {
            call.reject("Giá trị mới vượt giới hạn an toàn của tham số (" + spec.minValue + " đến " + spec.maxValue + ").");
            return;
        }
        if (spec.integer && requestedValue != Math.rint(requestedValue)) {
            call.reject("Tham số ON/OFF chỉ nhận giá trị nguyên 0 hoặc 1.");
            return;
        }
        if (spec.step > 0 && !spec.integer) {
            double steps = (requestedValue - spec.minValue) / spec.step;
            if (Math.abs(steps - Math.rint(steps)) > 0.02) {
                call.reject("Giá trị phải tuân theo bước chỉnh " + spec.step + ".");
                return;
            }
        }

        Thread worker = new Thread(
            () -> performGuardedWrite(call, host.trim(), port, address, expectedRawValue, requestedValue, spec, timeoutMs),
            "ChurchAudio-OscGuardedWrite"
        );
        worker.start();
    }


    private void performGuardedWrite(
        PluginCall call,
        String host,
        int port,
        String address,
        double expectedRawValue,
        double requestedValue,
        WriteSpec spec,
        int timeoutMs
    ) {
        long started = System.currentTimeMillis();
        boolean packetSent = false;
        try {
            InetAddress target = InetAddress.getByName(host);
            if (!(target instanceof Inet4Address) || !isPrivateIpv4((Inet4Address) target)) {
                call.reject("Chỉ cho phép IP LAN IPv4 riêng (10.x, 172.16–31.x hoặc 192.168.x).");
                return;
            }

            try (DatagramSocket socket = new DatagramSocket()) {
                socket.setReuseAddress(false);

                // Re-read immediately before the write. Abort if another operator changed the control.
                OscMessage before = queryOne(socket, target, port, address, timeoutMs);
                if (before == null) {
                    call.reject("Không đọc được giá trị hiện tại. Đã hủy lệnh ghi.");
                    return;
                }
                double beforeRaw = firstNumericArgument(before);
                if (Math.abs(beforeRaw - expectedRawValue) > spec.rawTolerance) {
                    call.reject("Giá trị mixer đã thay đổi kể từ lúc chuẩn bị. Đã hủy để tránh ghi đè thao tác khác.");
                    return;
                }

                double wireValue = toWireValue(spec, requestedValue);
                byte[] packet = encodeOscWrite(address, spec.integer, wireValue);
                socket.send(new DatagramPacket(packet, packet.length, target, port));
                packetSent = true;

                // Query again after the set packet. A UDP send alone is not proof of success.
                OscMessage after = queryOne(socket, target, port, address, timeoutMs);
                Double afterRaw = after == null ? null : firstNumericArgument(after);
                boolean verified = afterRaw != null && Math.abs(afterRaw - wireValue) <= spec.rawTolerance;

                JSObject output = new JSObject();
                output.put("host", target.getHostAddress());
                output.put("port", port);
                output.put("address", address);
                output.put("sent", true);
                output.put("verified", verified);
                output.put("beforeRawValue", beforeRaw);
                output.put("requestedValue", requestedValue);
                output.put("wireValue", wireValue);
                output.put("afterRawValue", afterRaw == null ? org.json.JSONObject.NULL : afterRaw);
                output.put("elapsedMs", System.currentTimeMillis() - started);
                output.put("completedAt", System.currentTimeMillis());
                output.put("status", verified ? "verified" : "sent-unverified");
                call.resolve(output);
            }
        } catch (Exception error) {
            if (packetSent) {
                JSObject output = new JSObject();
                output.put("host", host);
                output.put("port", port);
                output.put("address", address);
                output.put("sent", true);
                output.put("verified", false);
                output.put("status", "sent-unverified");
                output.put("warning", "Đã gửi gói OSC nhưng không thể xác minh phản hồi: " + error.getMessage());
                output.put("elapsedMs", System.currentTimeMillis() - started);
                call.resolve(output);
            } else {
                call.reject("Lệnh ghi an toàn thất bại: " + error.getMessage(), error);
            }
        }
    }

    private static OscMessage queryOne(
        DatagramSocket socket,
        InetAddress target,
        int port,
        String address,
        int timeoutMs
    ) throws Exception {
        byte[] request = encodeOscQuery(address);
        socket.send(new DatagramPacket(request, request.length, target, port));
        long deadline = System.currentTimeMillis() + timeoutMs;
        byte[] buffer = new byte[MAX_PACKET_BYTES];
        while (System.currentTimeMillis() < deadline) {
            int remaining = (int) Math.max(1, deadline - System.currentTimeMillis());
            socket.setSoTimeout(Math.min(250, remaining));
            DatagramPacket inbound = new DatagramPacket(buffer, buffer.length);
            try {
                socket.receive(inbound);
            } catch (SocketTimeoutException idle) {
                continue;
            }
            if (!target.equals(inbound.getAddress())) continue;
            byte[] response = Arrays.copyOfRange(
                inbound.getData(),
                inbound.getOffset(),
                inbound.getOffset() + inbound.getLength()
            );
            try {
                OscMessage parsed = parseOscMessage(response);
                if (address.equals(parsed.address)) return parsed;
            } catch (Exception malformedPacket) {
                // Ignore malformed or unrelated traffic while waiting for the requested address.
            }
        }
        return null;
    }

    private static double firstNumericArgument(OscMessage message) throws Exception {
        if (message.arguments.length() < 1) throw new IllegalArgumentException("Mixer trả về không có giá trị tham số.");
        Object value = message.arguments.get(0);
        if (value instanceof Number) return ((Number) value).doubleValue();
        if (value instanceof Boolean) return ((Boolean) value) ? 1.0 : 0.0;
        throw new IllegalArgumentException("Mixer trả về kiểu dữ liệu không phải số.");
    }

    private static byte[] encodeOscWrite(String address, boolean integer, double wireValue) {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        writeOscString(out, address);
        writeOscString(out, integer ? ",i" : ",f");
        ByteBuffer value = ByteBuffer.allocate(4).order(ByteOrder.BIG_ENDIAN);
        if (integer) value.putInt((int) Math.rint(wireValue));
        else value.putFloat((float) wireValue);
        byte[] bytes = value.array();
        out.write(bytes, 0, bytes.length);
        return out.toByteArray();
    }

    private static WriteSpec getWriteSpec(String address) {
        if (address == null || !address.matches("^/ch/(0[1-9]|[12][0-9]|3[0-2])/.+$")) return null;
        if (address.endsWith("/mix/fader")) return new WriteSpec("fader", false, -90.0, 0.0, 0.1, 0.003);
        if (address.endsWith("/mix/on")) return new WriteSpec("toggle", true, 0.0, 1.0, 1.0, 0.01);
        if (address.endsWith("/preamp/trim")) return new WriteSpec("trim", false, -18.0, 0.0, 0.25, 0.003);
        if (address.endsWith("/preamp/invert") || address.endsWith("/eq/on") || address.endsWith("/delay/on")) {
            return new WriteSpec("toggle", true, 0.0, 1.0, 1.0, 0.01);
        }
        if (address.matches("^/ch/(0[1-9]|[12][0-9]|3[0-2])/eq/[1-4]/f$")) {
            return new WriteSpec("eq-frequency", false, 20.0, 20000.0, 0.0, 0.003);
        }
        if (address.matches("^/ch/(0[1-9]|[12][0-9]|3[0-2])/eq/[1-4]/g$")) {
            return new WriteSpec("eq-gain", false, -15.0, 0.0, 0.25, 0.003);
        }
        if (address.matches("^/ch/(0[1-9]|[12][0-9]|3[0-2])/eq/[1-4]/q$")) {
            return new WriteSpec("eq-q", false, 0.3, 10.0, 0.0, 0.003);
        }
        if (address.endsWith("/delay/time")) return new WriteSpec("delay-time", false, 0.3, 200.0, 0.1, 0.003);
        return null;
    }

    private static double toWireValue(WriteSpec spec, double value) {
        switch (spec.kind) {
            case "toggle":
                return Math.rint(value);
            case "fader":
                double f;
                if (value < -60.0) f = (value + 90.0) / 480.0;
                else if (value < -30.0) f = (value + 70.0) / 160.0;
                else if (value < -10.0) f = (value + 50.0) / 80.0;
                else f = (value + 30.0) / 40.0;
                return Math.min(1.0, Math.max(0.0, Math.floor(f * 1023.5) / 1023.0));
            case "trim":
                return Math.rint((value + 18.0) / 0.25) / 144.0;
            case "eq-frequency":
                double frequencyIndex = Math.rint(Math.log(value / 20.0) / Math.log(1000.0) * 200.0);
                return frequencyIndex / 200.0;
            case "eq-gain":
                return Math.rint((value + 15.0) / 0.25) / 120.0;
            case "eq-q":
                double qIndex = Math.rint(Math.log(value / 10.0) / Math.log(0.03) * 71.0);
                return Math.min(1.0, Math.max(0.0, qIndex / 71.0));
            case "delay-time":
                double delayIndex = Math.rint((value - 0.3) / 0.1);
                return delayIndex / 4997.0;
            default:
                throw new IllegalArgumentException("Unsupported guarded OSC write type.");
        }
    }

    private static final class WriteSpec {
        final String kind;
        final boolean integer;
        final double minValue;
        final double maxValue;
        final double step;
        final double rawTolerance;
        WriteSpec(String kind, boolean integer, double minValue, double maxValue, double step, double rawTolerance) {
            this.kind = kind;
            this.integer = integer;
            this.minValue = minValue;
            this.maxValue = maxValue;
            this.step = step;
            this.rawTolerance = rawTolerance;
        }
    }

    private static boolean uniqueContains(List<String> addresses, String address) {
        return addresses.contains(address);
    }

    private static boolean isAllowedQuery(String address) {
        if (address == null) return false;
        if ("/info".equals(address) || "/xinfo".equals(address) || "/status".equals(address)) return true;
        return CHANNEL_QUERY.matcher(address).matches()
            || BUS_QUERY.matcher(address).matches()
            || AUX_QUERY.matcher(address).matches()
            || MATRIX_QUERY.matcher(address).matches()
            || DCA_QUERY.matcher(address).matches()
            || MAIN_QUERY.matcher(address).matches();
    }

    private static boolean isPrivateIpv4(Inet4Address address) {
        byte[] b = address.getAddress();
        int a = b[0] & 0xff;
        int second = b[1] & 0xff;
        if (a == 10 || (a == 192 && second == 168)) return true;
        if (a == 172 && second >= 16 && second <= 31) return true;
        return a == 169 && second == 254;
    }

    private static byte[] encodeOscQuery(String address) throws Exception {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        writeOscString(out, address);
        // Empty OSC type-tag string: this is a read request, with no value payload.
        writeOscString(out, ",");
        return out.toByteArray();
    }

    private static void writeOscString(ByteArrayOutputStream out, String value) {
        byte[] bytes = value.getBytes(StandardCharsets.UTF_8);
        out.write(bytes, 0, bytes.length);
        out.write(0);
        while ((out.size() & 3) != 0) out.write(0);
    }

    private static OscMessage parseOscMessage(byte[] data) throws Exception {
        Cursor cursor = new Cursor();
        String address = readOscString(data, cursor);
        String tags = "";
        JSArray args = new JSArray();
        if (cursor.position < data.length) {
            tags = readOscString(data, cursor);
            if (tags.startsWith(",")) {
                ByteBuffer input = ByteBuffer.wrap(data).order(ByteOrder.BIG_ENDIAN);
                for (int i = 1; i < tags.length(); i++) {
                    char tag = tags.charAt(i);
                    switch (tag) {
                        case 'i':
                            ensureRemaining(cursor.position, 4, data.length);
                            args.put(input.getInt(cursor.position));
                            cursor.position += 4;
                            break;
                        case 'f':
                            ensureRemaining(cursor.position, 4, data.length);
                            args.put(input.getFloat(cursor.position));
                            cursor.position += 4;
                            break;
                        case 'h':
                            ensureRemaining(cursor.position, 8, data.length);
                            args.put(input.getLong(cursor.position));
                            cursor.position += 8;
                            break;
                        case 'd':
                            ensureRemaining(cursor.position, 8, data.length);
                            args.put(input.getDouble(cursor.position));
                            cursor.position += 8;
                            break;
                        case 's':
                            args.put(readOscString(data, cursor));
                            break;
                        case 'T':
                            args.put(true);
                            break;
                        case 'F':
                            args.put(false);
                            break;
                        case 'N':
                            args.put(org.json.JSONObject.NULL);
                            break;
                        case 'b':
                            ensureRemaining(cursor.position, 4, data.length);
                            int length = input.getInt(cursor.position);
                            cursor.position += 4;
                            if (length < 0 || cursor.position + length > data.length) throw new IllegalArgumentException("OSC blob length invalid");
                            args.put(toHex(Arrays.copyOfRange(data, cursor.position, cursor.position + length)));
                            cursor.position += (length + 3) & ~3;
                            break;
                        default:
                            throw new IllegalArgumentException("Unsupported OSC type tag: " + tag);
                    }
                }
            }
        }
        return new OscMessage(address, tags, args);
    }

    private static void ensureRemaining(int position, int length, int total) {
        if (position < 0 || length < 0 || position + length > total) {
            throw new IllegalArgumentException("OSC response truncated");
        }
    }

    private static String readOscString(byte[] data, Cursor cursor) {
        int start = cursor.position;
        int end = start;
        while (end < data.length && data[end] != 0) end++;
        if (end >= data.length) throw new IllegalArgumentException("OSC string is not null-terminated");
        String value = new String(data, start, end - start, StandardCharsets.UTF_8);
        cursor.position = (end + 4) & ~3;
        return value;
    }

    private static String toHex(byte[] bytes) {
        StringBuilder hex = new StringBuilder(bytes.length * 2);
        for (byte value : bytes) hex.append(String.format(Locale.US, "%02x", value & 0xff));
        return hex.toString();
    }

    private static final class Cursor { int position = 0; }
    private static final class OscMessage {
        final String address;
        final String typeTags;
        final JSArray arguments;
        OscMessage(String address, String typeTags, JSArray arguments) {
            this.address = address;
            this.typeTags = typeTags;
            this.arguments = arguments;
        }
    }
}
