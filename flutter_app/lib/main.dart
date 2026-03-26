import 'package:flutter/material.dart';
import 'package:flutter_inappwebview/flutter_inappwebview.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const MaterialApp(
    debugShowCheckedModeBanner: false,
    home: YTMApp(),
  ));
}

class YTMApp extends StatefulWidget {
  const YTMApp({super.key});
  @override
  State<YTMApp> createState() => _YTMAppState();
}

class _YTMAppState extends State<YTMApp> {
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      body: SafeArea(
        child: InAppWebView(
          // Pointing to our local assets folder
          initialFile: "assets/www/index.html",
          initialSettings: InAppWebViewSettings(
            mediaPlaybackRequiresUserGesture: false,
            allowsInlineMediaPlayback: true,
            iframeAllow: "autoplay",
            iframeAllowFullscreen: true,
            useOnLoadResource: true,
            cacheEnabled: true,
            domStorageEnabled: true,
            // Android-specific fixes for local file loading / black page
            mixedContentMode: MixedContentMode.MIXED_CONTENT_ALWAYS_ALLOW,
            allowFileAccessFromFileURLs: true,
            allowUniversalAccessFromFileURLs: true,
            // Support for ESM (Vite modules)
            javaScriptEnabled: true,
          ),
          onWebViewCreated: (controller) {
            // controller.setSettings(settings: settings);
          },
          onLoadError: (controller, url, code, message) {
            print("Page Load Error: $message");
          },
          onConsoleMessage: (controller, consoleMessage) {
            print("JS Console: ${consoleMessage.message}");
          },
        ),
      ),
    );
  }
}
