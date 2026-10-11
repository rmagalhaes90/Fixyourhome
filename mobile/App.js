import { useRef, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { WebView } from "react-native-webview";
import * as ImagePicker from "expo-image-picker";
import { appHtml } from "./html";

const BEFORE_LOAD = "window.TidyNextNative=true;document.documentElement.classList.add('native');true;";

export default function App() {
  const web = useRef(null);
  const [ready, setReady] = useState(false);

  async function pickPhoto(kind) {
    const permission = kind === "camera"
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permissão", "O TidyNext precisa da câmera ou das fotos para montar o plano neste iPhone.");
      return;
    }
    const result = kind === "camera"
      ? await ImagePicker.launchCameraAsync({ quality: 0.6, base64: true, exif: false })
      : await ImagePicker.launchImageLibraryAsync({ quality: 0.6, base64: true, exif: false });
    if (result.canceled || !result.assets?.[0]?.base64) return;
    const mime = result.assets[0].mimeType || "image/jpeg";
    const dataUrl = JSON.stringify(`data:${mime};base64,${result.assets[0].base64}`);
    web.current?.injectJavaScript(`window.TidyNextPhoto && window.TidyNextPhoto(${dataUrl});true;`);
  }

  function onMessage(event) {
    let data;
    try {
      data = JSON.parse(event.nativeEvent.data);
    } catch {
      return;
    }
    if (data.type === "ready") {
      setReady(true);
      return;
    }
    if (data.type !== "photo") return;
    Alert.alert("Foto do cômodo", "A foto fica neste iPhone.", [
      { text: "Câmera", onPress: () => { void pickPhoto("camera"); } },
      { text: "Biblioteca", onPress: () => { void pickPhoto("library"); } },
      { text: "Cancelar", style: "cancel" },
    ]);
  }

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <WebView
        ref={web}
        style={styles.web}
        originWhitelist={["*"]}
        source={{ html: appHtml, baseUrl: "https://tidynext.local" }}
        injectedJavaScriptBeforeContentLoaded={BEFORE_LOAD}
        onMessage={onMessage}
        javaScriptEnabled
        domStorageEnabled
        allowsInlineMediaPlayback
        mediaCapturePermissionGrantType="grant"
        setSupportMultipleWindows={false}
        bounces={false}
        onLoadEnd={() => setReady(true)}
        onError={() => setReady(false)}
      />
      {ready ? null : (
        <View style={styles.boot}>
          <Text style={styles.bootTitle}>TidyNext</Text>
          <Text style={styles.bootText}>Abrindo neste iPhone…</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#f4f7f4" },
  web: { flex: 1, backgroundColor: "#f4f7f4" },
  boot: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f4f7f4",
    padding: 24,
  },
  bootTitle: { color: "#0c7b67", fontSize: 28, fontWeight: "800" },
  bootText: { color: "#10322d", fontSize: 16, marginTop: 8 },
});
