import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_inappwebview/flutter_inappwebview.dart';

// THIS FIXES THE "BLACK PAGE" FOR VITE APPS
void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Create a local server to serve assets over http://localhost for ESM support
  final InAppLocalServer localServer = InAppLocalServer(port: 8080);
  await localServer.start();

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
          // Load the local server URL instead of a file URI
          initialUrlRequest: URLRequest(
            url: WebUri("http://localhost:8080/assets/www/index.html"), 
          ),
          initialSettings: InAppWebViewSettings(
            mediaPlaybackRequiresUserGesture: false,
            allowsInlineMediaPlayback: true,
            iframeAllow: "autoplay",
            iframeAllowFullscreen: true,
            useOnLoadResource: true,
            cacheEnabled: true,
            domStorageEnabled: true,
            javaScriptEnabled: true,
            mixedContentMode: MixedContentMode.MIXED_CONTENT_ALWAYS_ALLOW,
          ),
          onConsoleMessage: (controller, consoleMessage) {
            print("VITE CONSOLE: ${consoleMessage.message}");
          },
        ),
      ),
    );
  }
}
