package __APP_PACKAGE__;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.ByteArrayOutputStream;
import java.net.DatagramPacket;
import java.net.DatagramSocket;
import java.net.Inet4Address;
import java.net.InetAddress;
import java.net.SocketTimeoutException;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.Locale;
import java.util.regex.Pattern;

@CapacitorPlugin(name = "OscUdp")
public class OscUdpPlugin extends Plugin {
    private static final int DEFAULT_PORT = 10023;
    private static final int MAX_PACKET_BYTES = 8192;
    private static final Pattern CHANNEL_QUERY = Pattern.compile(
        "^/ch/(0[1-9]|[12][0-9]|3[0-2])/(config/name|mix/(fader|on|pan)|preamp/trim|eq/on|eq/[1-4]/(type|f|g|q))$"
    );

    @PluginMethod
    public void query(PluginCall call) {
        final String host = call.getString("host");
        final String address = call.getString("address");
        final Integer portValue = call.getInt("port");
        final Integer timeoutValue = call.getInt("timeoutMs");
        final int port = portValue == null ? DEFAULT_PORT : portValue;
        final int timeoutMs = timeoutValue == null ? 1500 : timeoutValue;

        if (host == null || host.trim().isEmpty()) {
            call.reject("Nhập địa chỉ IP của mixer.");
            return;
        }
        if (!isAllowedQuery(address)) {
            call.reject("Địa chỉ OSC không nằm trong danh sách truy vấn chỉ đọc.");
            return;
        }
        if (port < 1024 || port > 65535 || timeoutMs < 250 || timeoutMs > 5000) {
            call.reject("Port hoặc timeout không hợp lệ.");
            return;
        }

        Thread worker = new Thread(() -> performQuery(call, host.trim(), port, address, timeoutMs), "ChurchAudio-OscUdp");
        worker.start();
    }

    private void performQuery(PluginCall call, String host, int port, String address, int timeoutMs) {
        long started = System.currentTimeMillis();
        try {
            InetAddress target = InetAddress.getByName(host);
            if (!(target instanceof Inet4Address) || !isPrivateIpv4((Inet4Address) target)) {
                call.reject("Chỉ cho phép IP LAN IPv4 riêng (10.x, 172.16–31.x hoặc 192.168.x).");
                return;
            }

            byte[] request = encodeOscQuery(address);
            try (DatagramSocket socket = new DatagramSocket()) {
                socket.setSoTimeout(timeoutMs);
                socket.setReuseAddress(false);
                DatagramPacket outbound = new DatagramPacket(request, request.length, target, port);
                socket.send(outbound);

                byte[] buffer = new byte[MAX_PACKET_BYTES];
                DatagramPacket inbound = new DatagramPacket(buffer, buffer.length);
                socket.receive(inbound);

                byte[] response = Arrays.copyOfRange(inbound.getData(), inbound.getOffset(), inbound.getOffset() + inbound.getLength());
                OscMessage parsed = parseOscMessage(response);
                JSObject result = new JSObject();
                result.put("host", target.getHostAddress());
                result.put("port", port);
                result.put("requestedAddress", address);
                result.put("responseAddress", parsed.address);
                result.put("typeTags", parsed.typeTags);
                result.put("arguments", parsed.arguments);
                result.put("rawHex", toHex(response));
                result.put("rttMs", System.currentTimeMillis() - started);
                result.put("receivedAt", System.currentTimeMillis());
                call.resolve(result);
            }
        } catch (SocketTimeoutException error) {
            call.reject("Không nhận được phản hồi OSC. Kiểm tra IP, cùng mạng LAN, port 10023 và Remote Access của mixer.", error);
        } catch (Exception error) {
            call.reject("Lỗi truy vấn OSC: " + error.getMessage(), error);
        }
    }

    private static boolean isAllowedQuery(String address) {
        if (address == null) return false;
        return "/info".equals(address)
            || "/xinfo".equals(address)
            || "/status".equals(address)
            || CHANNEL_QUERY.matcher(address).matches();
    }

    private static boolean isPrivateIpv4(Inet4Address address) {
        byte[] b = address.getAddress();
        int a = b[0] & 0xff;
        int second = b[1] & 0xff;
        if (a == 10 || a == 192 && second == 168) return true;
        if (a == 172 && second >= 16 && second <= 31) return true;
        return a == 169 && second == 254;
    }

    private static byte[] encodeOscQuery(String address) throws Exception {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        writeOscString(out, address);
        writeOscString(out, ",");
        return out.toByteArray();
    }

    private static void writeOscString(ByteArrayOutputStream out, String value) throws Exception {
        byte[] bytes = value.getBytes(StandardCharsets.UTF_8);
        out.write(bytes);
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
                            args.put(input.getInt(cursor.position));
                            cursor.position += 4;
                            break;
                        case 'f':
                            args.put(input.getFloat(cursor.position));
                            cursor.position += 4;
                            break;
                        case 'h':
                            args.put(input.getLong(cursor.position));
                            cursor.position += 8;
                            break;
                        case 'd':
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
                            args.put((String) null);
                            break;
                        case 'b':
                            int length = input.getInt(cursor.position);
                            cursor.position += 4;
                            if (length < 0 || cursor.position + length > data.length) throw new IllegalArgumentException("OSC blob length invalid");
                            args.put(toHex(Arrays.copyOfRange(data, cursor.position, cursor.position + length)));
                            cursor.position += (length + 3) & ~3;
                            break;
                        default:
                            throw new IllegalArgumentException("Unsupported OSC type tag: " + tag);
                    }
                    if (cursor.position > data.length) throw new IllegalArgumentException("OSC response truncated");
                }
            }
        }
        return new OscMessage(address, tags, args);
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
